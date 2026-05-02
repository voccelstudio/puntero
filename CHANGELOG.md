# CHANGELOG — Bugs Corregidos

## Diagnóstico raíz

El código fue migrado a un modelo **multi-proyecto** (`state.projects[].execution.X`) pero muchas funciones todavía leían/escribían en el modelo viejo (`state.items`, `state.schedules`, `state.dailyLogs`, etc.). Esto causaba pérdida de datos al cambiar de proyecto, y que los cambios no se reflejaran donde correspondía.

Todos los archivos pasan `node --check` sin errores de sintaxis.

---

## Cambios por archivo

### `app.js`

**Modelo de datos**
- `buildDB` ahora incluye `y` (yield) — el cronograma puede usar rendimientos reales de la DB
- `addItem`, `addCustomItem`, `updateQty`, `updateDisc`, `updateNote`, `removeItem` — ahora trabajan con `getActiveAdenda()` y `p.execution.schedules`
- `removeItem` también limpia el schedule asociado
- `newBudget` — limpia la adenda activa, no datos globales
- `calcIVA` y `calcIVATotals` — ahora consultan la adenda activa
- `calcOverallProgress` — defensivo si no hay schedules

**Sistema de versiones**
- `saveVersion`/`loadVersion`/`deleteVersion` — usan `p.versions[]` por proyecto en vez de pisar `state.budgets`
- Modal `load_version` lee de `p.versions`
- `dupBudget` — duplica la adenda dentro del proyecto activo

**Generación de PDF/CSV**
- `generarPDF` reescrito completo: usa adenda y proyecto activos para todos los datos (cliente, IVA, honorarios, notas, etc.)
- `exportXLS` — mismo fix
- `exportDailyPDF` — lee del proyecto activo
- `exportWeeklyReport` — lee del proyecto activo
- `exportMonthlyReport` — agregada (faltaba, era llamada desde logs.js)

**Import/Export de proyectos**
- `exportProject`/`importProject` reescritos: serializan/deserializan estructura completa v7
- Compatibilidad backward con archivos `.ppy` legacy v5 (los convierte automáticamente)

**Renderizado**
- `renderDashboard` — lee `p.execution.schedules` y `p.execution.dailyLogs`
- `renderCatalog` — usa adenda para el flag de IVA
- Modal `breakdown` arreglado
- Modal `export_project` muestra nombre del proyecto activo
- `p.client` con fallback a `'—'` en renderBudget

**Limpieza**
- `doSave`/`doLoad`/`doDeleteBudget` — stubs que orientan al nuevo flujo
- `loadDemoProject` — escribe directamente en modelo nuevo (sin depender de migración)
- `migrateToV7` ahora incluye `projectStartDate`/`projectEndDate`
- `applyTemplate` (en app.js y resources.js) — usa adenda

---

### `materials.js`

- **Agregado modal `new_order`** que faltaba — la función `createOrder()` estaba huérfana. Ahora hay formulario con datalist de proveedores existentes y tabla de cantidades sugeridas vs necesidad total
- `payOrder` con safety checks de inicialización de `finances`/`expenses`

---

### `suppliers.js`

- **Implementado `viewSupplier()`** que faltaba — click en card ya no tira error. Muestra datos del proveedor, sus cotizaciones, y botón directo a WhatsApp
- Unificado `modal-hdr` → `modal-title` (consistencia visual)

---

### `finances.js`

- Pagos a contratistas se filtran por proyecto (solo los asignados al proyecto activo se cuentan)
- `saveFinance` con safety checks de inicialización
- Manejo correcto del fallback "no hay movimientos"

---

### `contractors.js`

- **Filtro de Lista Negra** funcional (Todos / Ocultar / Solo)
- Card de blacklist se muestra visualmente con borde rojo y badge "🚨 LISTA NEGRA"
- `assignItemToContractor` con safety checks

---

### `schedule.js`

- `exportSchedulePDF` **implementado** (antes era función vacía con solo un toast). Genera PDF con tabla autoTable de items, estados, fechas y contratistas
- `renderGanttChart` con sanitización contra `span <= 0`, `startIdx >= daysTotal`, y desbordes que rompían el layout

---

### `logs.js`

- Eliminado botón "Gestionar Personal" global (no tenía sentido — el personal está por contratista)
- Asistencia se construye desde contratistas asignados al proyecto, con campos correctos (`name`, `surname`, `idNumber`)
- `saveDailyLog` con safety check

---

### `documents.js`

- `renderDocuments`, `uploadDocument`, `deleteDocument`, `viewDocument` ahora leen/escriben en `proj.execution.documents` (eran `state.documents` global)
- `deleteDocument` con check seguro de string antes de `.startsWith()`
- Unificado `modal-hdr` → `modal-title`

---

### `performance.js`

- Reescrito completo: usa `getActiveProject()`, `getActiveAdenda()`
- Filtra pagos solo de contratistas asignados al proyecto
- Defensivo contra arrays vacíos en `Math.max(...)` (que antes explotaba)
- Cálculo de timeProgress robusto (antes asumía `state.projectStartDate` existente)

---

## Bugs que NO eran bugs (no se tocaron)

- `app.js:renderGlobalStats` — función deprecated, código muerto pero no daña
- Modal `save`/`load` — ya están deprecated por los stubs nuevos
- `db_precios.js` — está bien, sólo se sobreescribe `buildDB` desde app.js (ahora ya consistente con `y`)
