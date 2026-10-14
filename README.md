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
examples/           Archivos de ejemplo para probar importación (no se despliegan)
```

## Comandos

```bash
npm install          # dependencias de desarrollo
npm test             # suite de tests (Vitest)
npm run lint         # ESLint
npm run smoke        # smoke test end-to-end (Edge + puppeteer-core)
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
- `tests/runtime.test.js` — deep links del manifest, estado de sesión y conexión
- `tests/smoke-clients.mjs` — flujo real en navegador (clientes, alta de obra, PDF de vinculación)

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

Con sesión iniciada, `save()` empuja el estado a `users/{uid}` (debounced) y al iniciar
sesión se trae el de la nube. La resolución de conflictos es *last-writer-wins*, con una
salvaguarda: si el dispositivo ya sincronizó antes y tiene cambios locales más nuevos que
la nube, se sube lo local en lugar de pisarlo — así no se pierde el trabajo hecho offline.

La **cuenta maestra** y las **sesiones demo** son locales por diseño y nunca van a la nube.

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
