# Puntero

**Gestión de obra para Paraguay.** Presupuestos, cómputo de materiales, cronograma,
libro de obra, finanzas, contratos y seguimiento multi-proyecto. PWA offline-first.

> Estado: rama `v6` en desarrollo activo. La app funciona sin conexión: los datos se
> guardan en el dispositivo (localStorage + IndexedDB) y, con sesión iniciada, se
> sincronizan con Firestore.

---

## Estructura

```
index.html          Estructura, navegación (sidebar + FAB mobile) y carga de scripts
app.js              Núcleo: estado, helpers, presupuesto, proyectos, auth, sync
styles.css          Sistema de diseño (5 temas vía variables CSS)
sw.js               Service Worker (cache-first assets, network-first HTML)

db_precios.js       Base de precios (177 KB) — buildDB() construye el catálogo
xlsx-writer.js      Generador de XLSX (ZIP "store", sin dependencias)

Módulos por dominio:
  clients.js        Base de clientes y vinculación con proyectos
  ot.js             Órdenes de trabajo
  schedule.js       Cronograma de ejecución
  logs.js           Libro de obra / bitácora + recorrido con fotos
  contractors.js    Personal y contratistas (calificaciones)
  materials.js      Pedidos de materiales
  finances.js       Ingresos y gastos
  cajachica.js      Caja chica
  performance.js    KPIs
  documents.js      Planos y fotos, carpeta del proyecto
  suppliers.js      Proveedores y cotizaciones
  jornaleros.js     Jornaleros y jornales
  contracts.js      Contratos legales y generación de PDF
  resources.js      Biblioteca y plantillas

tests/              Vitest + smoke test con navegador
tools/              Scripts de desarrollo (no se despliegan)
precios/            db.json (copia maestra de precios) + manifest.json publicado
examples/           Archivos de ejemplo para probar importación (no se despliegan)
```

## Comandos

```bash
npm install             # dependencias de desarrollo
npm test                # suite de tests (Vitest)
npm run lint            # ESLint
npm run smoke           # los 5 smoke tests en navegador real
npm run smoke:clientes  # clientes y vinculación a obras
npm run smoke:panel     # panel de control, planes, suscripción y login
npm run smoke:precios   # flujo pagado de actualización de precios
npm run smoke:nube      # nube real: cuenta PRO creada, vinculada y sincronizada
npm run smoke:backup    # pérdida de datos del navegador y recuperación
npm run smoke:vivo      # contra el SITIO PUBLICADO: código sin secretos y login real
npm run precios:build   # regenera precios/manifest.json desde precios/db.json
node tools/ver_ledger.mjs   # qué cuentas hay en la nube (sin iniciar sesión)
# Los smokes que ESCRIBEN en el registro (panel y nube) necesitan las
# credenciales del dueño: creá tests/.secret.json con {"email":"...","pass":"..."}
# (está en .gitignore y firebase.json no publica tests/), o exportá
# PUNTERO_MASTER_EMAIL / PUNTERO_MASTER_PASS. Si faltan, avisan y salen con error
# en lugar de fingir que sincronizaron.
```

## Cómo funcionan los tests

`tests/helpers/app-loader.js` carga el **código fuente real** de `db_precios.js` y
`app.js` dentro de jsdom y expone las funciones de negocio. La app es vanilla JS sin
módulos, así que no se puede importar directamente.

Esto importa: antes los tests re-implementaban las funciones a mano y un `calcIVA`
con las tasas de IVA invertidas pasaba sin fallar. Ahora se testea la implementación real.

- `tests/business.test.js` — totales, IVA, descuentos, profit, cómputo de materiales
- `tests/helpers.test.js` — formateo, fechas, escape
- `tests/cloud-sync.test.js` — sincronización Firestore y conflictos local vs. nube
- `tests/runtime.test.js` — deep links del manifest, tiers de licencia, estado de sesión y conexión
- `tests/precios.test.js` — merge de la base de precios y gate de actualización por suscripción
- `tests/backup.test.js` — validación y resumen de backups, reglas de recuperación del espejo
- `tests/master-login.test.js` — el ingreso maestro se verifica contra Firebase Auth; falla
  si alguna contraseña vuelve a aparecer en el fuente publicado o si las reglas dejan de
  exigir el uid del dueño para escribir el registro
- `tests/smoke-panel.mjs` — flujo real en navegador: panel de control, planes, suscripción y login
- `tests/smoke-clients.mjs` — flujo real en navegador: clientes, alta de obra, PDF de vinculación
- `tests/smoke-precios.mjs` — flujo real en navegador: detectar precios nuevos, aplicarlos conservando ediciones, y que el plan usuario no reciba nada
- `tests/smoke-nube.mjs` — contra Firebase real: el panel crea una cuenta PRO, la vincula a Firebase, un dispositivo limpio la descubre sin sesión y su obra llega a la nube
- `tests/smoke-backup.mjs` — pérdida de datos del navegador: se recuperan solos de IndexedDB, y si se borra todo vuelven desde el archivo de backup (con deshacer)
- `tests/verify-login-vivo.mjs` — contra el **sitio publicado**: el código servido no
  tiene secretos, la contraseña incorrecta la rechaza Firebase Auth y con la correcta
  queda la sesión del dueño (9 checks, sin escribir nada en la nube)

## Modelo de datos (resumen)

```
state.projects[]            Proyectos (multi-proyecto)
  .budgets[]                Adendas / presupuestos por proyecto
    .items[]                Ítems con qty, unitPrice, matCost, laborCost, disc
  .execution.*              schedules, dailyLogs, materialOrders, finances, aftercare
state.clients[]             Base de clientes
state.contractors/suppliers/jornaleros/roles/contratos/finances/cajachica
```

## Sincronización en la nube

Solo sincronizan la **cuenta maestra** y las cuentas **PRO** con suscripción vigente.
El usuario de compra única y las demos corren **solo en su dispositivo** — es lo que hace
que su licencia de por vida tenga sentido y que la app nunca los deje afuera.

Con sesión PRO, `save()` empuja el estado a `users/{uid}` (debounced) y al iniciar sesión
se trae el de la nube. La resolución de conflictos es *last-writer-wins*, con una
salvaguarda: si el dispositivo ya sincronizó antes y tiene cambios locales más nuevos que
la nube, se sube lo local en lugar de pisarlo — así no se pierde el trabajo hecho offline.

**La nube exige una sesión real de Firebase** (`isCloudUser()` = plan PRO **y** sesión
autenticada). No es un capricho: las reglas de Firestore validan `request.auth.uid` contra
el documento, así que sin sesión la escritura se rechazaría y el sync fallaría en silencio.
Por eso `isCloudUser()` apaga en lugar de fingir. El efecto práctico:

- Al crear una cuenta PRO desde el panel, se la **vincula a Firebase** (botón ☁️ si se creó
  sin conexión). El panel pide la contraseña de la cuenta y **la verifica contra el hash
  local** antes de crear el usuario: si el admin teclea otra, el cliente entraría en local
  y quedaría sin nube sin entender por qué, así que se rechaza.
- Al iniciar sesión, la app usa la contraseña tecleada para abrir también la sesión de
  Firebase (best-effort): si Firebase está caído, **la app sigue funcionando**.
- La **cuenta maestra** entra con su contraseña **verificada por Firebase Auth** (se
  teclea `martin` o su correo): la contraseña no está escrita en el cliente ni en git,
  así que leer el código fuente (Ctrl+U) no abre el panel. Esa sesión es además la única
  con permiso para **escribir el registro de cuentas** (más abajo). Necesita internet la
  primera vez; después la sesión queda guardada y la app trabaja normal sin red.

**El registro de cuentas es de lectura pública** (así cualquier dispositivo descubre la
licencia), así que va sanitizado: nunca contraseñas en claro, y tampoco el hash de las
cuentas que pueden validar la contraseña en Firebase — publicarlo habilitaría un ataque
offline sobre contraseñas débiles. Solo llevan hash las cuentas creadas sin conexión (que
no tienen identidad en la nube) y las demos, que son efímeras.

Las eliminaciones dejan un *tombstone* de 10 minutos para que un pull concurrente no
resucite la cuenta recién borrada.

**Quién puede escribir el registro:** únicamente la sesión Firebase del **dueño**, por su
uid (`firestore.rules`); la lectura sigue siendo pública. Esto no es menor: antes existía
una "identidad de transporte" (`admin.sync@puntero.local`) con la contraseña escrita en
`app.js`, y el repositorio es **público** — es decir, no era un secreto: cualquiera podía
firmar como esa identidad y escribirse una cuenta PRO en el registro. Se retiró por
completo (la cuenta se borró de Firebase Auth y salió de las reglas) y ahora `login()`
verifica la contraseña del dueño contra Auth en lugar de compararla con un texto del
código. Dos pruebas automáticas lo cuidan:

- `tests/master-login.test.js` — falla si vuelve a aparecer una clave embebida en el
  fuente o si las reglas dejan de exigir el uid del dueño.
- `npm run smoke:nube` (19 checks) — intenta escribir el registro **sin sesión** y espera
  el rechazo de las reglas, y luego escribe **con la sesión del dueño** y espera que pase.

## Actualización de precios por suscripción

Es el beneficio que cobra la mensualidad PRO. La app no necesita actualizarse: los precios
viajan en un manifiesto versionado que se publica junto con la app.

```bash
# 1. Editar precios/db.json  (copia maestra: "version", "mes" y el catálogo)
# 2. Regenerar el manifiesto
npm run precios:build
# 3. Desplegar
firebase deploy
```

Del lado del cliente: `checkPreciosUpdate()` compara la versión del manifiesto contra la
que tiene **instalada** (`localStorage`) y, si hay más nueva, la sección 💰 Base de Precios
ofrece actualizar. `mergePriceDBs()` manda la base oficial **pero las ediciones del usuario
ganan**: quien corrigió el precio del cemento a mano no lo pierde, y sus rubros propios se
conservan aunque desaparezcan del catálogo.

Al aplicar, la base se marca con `ppy_db_source = "remoto"` para que el arranque no la
reemplace por la compilada en la app (eso bajaría los precios recién recibidos y volvería
a ofrecer la misma actualización para siempre). El botón *Restaurar* vuelve a la base
compilada y limpia esa marca.

Quien no paga la suscripción no consulta el manifiesto: ve la fecha de su base y la
indicación de que la actualización es un beneficio PRO. Su licencia sigue funcionando igual.

## Backup y recuperación

Es lo primero que hay que poder prometer antes de cobrar: que el trabajo de una obra no se
pierde. Hay tres capas, de menos a más resistente:

| Capa | Qué es | Cubre |
|---|---|---|
| `localStorage` | la copia de trabajo | — (se pierde con "borrar datos del sitio", disco lleno, etc.) |
| **IndexedDB** (Dexie) | espejo en cada guardado + historial de las últimas 5 copias | pérdida del navegador y datos corruptos/sobrescritos |
| **Carpeta en disco** | `puntero_backup_AAAA-MM-DD.json`, una vez por día | todo lo anterior: formateo, otro equipo, navegador nuevo |

Todo corre solo. `backupAutomatico()` se ejecuta al arranque (recién **después** de cargar
los datos, si no guardaría un estado vacío) y cada hora mientras la app está abierta. La
carpeta se elige una vez desde ☁️ Cloud → Backup y Datos; el *handle* vive en IndexedDB
porque no es serializable a JSON. Si el navegador no permite escribir en carpetas (Safari/
Firefox) o el permiso expiró, no insiste: se reintentará en el próximo arranque.

**La restauración es lo que hace que esto sea un backup**: valida el archivo antes de tocar
nada (un JSON ajeno o una imagen renombrada no pueden reemplazar una obra entera), muestra
qué va a reemplazar y qué hay ahora, y deja una copia de seguridad de lo actual para poder
**deshacer** un restore equivocado. También se puede restaurar una copia vieja del historial
local desde el mismo panel.

`validarBackup()` acepta los backups v1 (los `{ state, db }` que generaba la versión
anterior, sin marca de esquema) y rechaza todo lo que no sea un backup de Puntero.

> ⚠️ **Bug que esto destapó**: `initDexie()` se llamaba en la línea 431 mientras que
> `var _DEXIE = null;` estaba declarado en la 1511. Por el hoisting del `var`, la
> asignación `= null` se ejecuta *después* y borraba la instancia recién creada. El
> resultado: **IndexedDB estuvo mudo desde siempre**, sin un solo error visible — el espejo
> que el manual prometía no existía y un "borrar datos del sitio" era pérdida total. Si
> volvés a tocar el orden de arranque, ojo con eso.

Probado con `npm run smoke:backup` (24 checks): borra los datos del navegador y verifica
que vuelven solos, borra también IndexedDB y verifica que **no** quedan, restaura desde
archivo y verifica que regresan obra por obra, y comprueba que un archivo inválido no toca
nada y que un restore equivocado se deshace.

## Modelo de licencias

| Plan | Precio | Nube + backup | Actualización de precios |
|---|---|---|---|
| 👑 **Maestra** | — (tu cuenta) | ✅ | ✅ |
| ⭐ **PRO** | mensual fijo | ✅ | ✅ |
| 👤 **Usuario** | pago único | ❌ (solo local) | ❌ |
| 🎭 **Demo** | gratis 72h | ❌ | ❌ |

Las cuentas se emiten desde el **Panel de Control** (`🗝️ Cuentas (Admin)`, solo visible con sesión maestra). Ahí podés crear, cambiar el plan, sumar meses de suscripción, resetear contraseñas, activar/desactivar y borrar.

Las cuentas viven en un registro local (`pte_accounts`) que se réplica a Firestore, así que **el panel funciona aunque Firebase no responda** y la cuenta sirve en otros dispositivos. Cada cuenta guarda `salt` + SHA-256; la contraseña nunca viaja en claro.

Una demo por correo. Al vencer las 72h se bloquea y se borra.

La puerta de enganche `?section=` de los shortcuts del manifest se valida contra la lista real de secciones.

## Despliegue

Firebase Hosting (`firebase.json`). El `hosting.ignore` lista explícitamente lo que
**no** se publica: tests, tools, examples, reglas, documentación y manifiestos de npm.

```bash
firebase deploy
```

## Convenciones

- ES2022, sin framework ni bundler. Los globals compartidos entre archivos se declaran
  en `.eslintrc.json` — no convertir a módulos sin migrar todo junto.
- Los IDs de ítems y proveedores se generan como `number` (`Date.now()`) pero vuelven
  como `string` al pasar por atributos `onclick` del DOM, por eso las comparaciones usan
  `==` (la coerción es intencional). Ver `eqeqeq` en `.eslintrc.json`.
- Los archivos se organizan con títulos de sección: `// ── NOMBRE ───`.
