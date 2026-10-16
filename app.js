// ── HELPERS ──────────────────────────────────────────────────────────────

// Fuente única de verdad de las secciones navegables. La usa setSection para
// mostrar/ocultar vistas y marcar el botón activo, y el arranque para validar
// los deep links ?section= de los shortcuts del manifest.
//Declarada al inicio del archivo: setSection corre durante la carga y un const
// declarado más abajo estaría en TDZ.
const VALID_SECTIONS = [
  "global_dashboard", "budget", "ot", "schedule", "contractors", "jornaleros",
  "contratos", "prices", "dashboard", "themes", "logs", "materials", "finances",
  "cajachica", "performance", "documents", "suppliers", "resources", "projects",
  "clients", "aftercare", "computo", "computo_rapido", "folder", "accounts", "cloud",
];

// ══════════════════════════════════════════════════════════════════════
// BASE DE PRECIOS — merge y actualización remota
// ══════════════════════════════════════════════════════════════════════
//
// La DB viaja compilada dentro de app/db_precios.js, pero los suscriptores PRO
// reciben versiones nuevas sin tener que reinstalar la app: se publica un JSON
// versionado y se fusiona con lo que el usuario tenga.
//
// Regla del merge (importa, y es sutil): la DB nueva manda, PERO las ediciones
// manuales del usuario ganan. Así alguien que corrigió el precio del cemento a
// mano no lo pierde al actualizar — salvo que el ítem desapareció de la DB nueva,
// en cuyo caso su versión personalizada se conserva igual.

function mergePriceDBs(freshDB, userDB) {
  var merged = JSON.parse(JSON.stringify(freshDB || {}));
  var user = userDB || {};
  Object.keys(user).forEach(function (cat) {
    if (!merged[cat]) {
      // Categoría propia del usuario (o eliminada de la DB nueva): se conserva
      merged[cat] = JSON.parse(JSON.stringify(user[cat]));
      return;
    }
    Object.keys(user[cat]).forEach(function (name) {
      if (merged[cat][name]) {
        // El ítem existe en la DB nueva: respetar la edición del usuario
        merged[cat][name] = Object.assign({}, merged[cat][name], user[cat][name]);
      } else {
        // Ítem propio del usuario que ya no está en la DB nueva: conservarlo
        merged[cat][name] = JSON.parse(JSON.stringify(user[cat][name]));
      }
    });
  });
  return merged;
}

// Manifiesto de precios remoto. Se genera con tools/build_precios.js y se
// publica junto con la app (público: no contiene datos de clientes).
var PRECIOS_URL = "precios/manifest.json";

// Versión de la DB instalada en ESTE dispositivo. No usamos la constante
// compilada: la suscripción tiene sentido precisamente porque la app no se
// actualiza. Lo que manda es lo que el usuario tiene instalado, y si el
// manifiesto remoto trae algo más nuevo, se ofrece actualizar.
function preciosVersionInstalada() {
  var v = null;
  try { v = localStorage.getItem("ppy_db_version"); } catch (e) { v = null; }
  if (v) {return String(v);}
  return String(DB_VERSION);
}

// Mes de referencia de la DB instalada (lo que ve el usuario).
function preciosMesInstalado() {
  try {
    var m = localStorage.getItem("ppy_db_mes");
    if (m) {return m;}
  } catch (e) {}
  return DB_MES || null;
}

// Versión de la DB instalada (la que trae db_precios.js).
function preciosInstalados() {
  return { version: preciosVersionInstalada(), fecha: preciosMesInstalado() };
}

// Fecha legible de la DB instalada ("marzo 2026"), para mostrar al usuario.
function preciosFechaLabel(fecha) {
  if (!fecha) {return "sin fecha";}
  var m = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var p = String(fecha).split("-"); // "2026-03" o "2026-03-01"
  var anio = p[0];
  var mes = parseInt(p[1], 10);
  if (!anio || !mes) {return String(fecha);}
  return m[mes - 1] + " " + anio;
}

// ¿Hay precios más nuevos disponibles? Solo tiene sentido para suscriptores.
function checkPreciosUpdate() {
  if (!canUpdatePrices()) {return Promise.resolve(null);}
  if (typeof fetch !== "function") {return Promise.resolve(null);}
  return fetch(PRECIOS_URL, { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (man) {
      if (!man || !man.db || !man.version) {return null;}
      if (String(man.version) === preciosVersionInstalada()) {return null;}
      return {
        version: man.version,
        fecha: man.mes || null,
        // La app fusiona con lo del usuario al aplicar, conservando sus ediciones.
        db: man.db
      };
    })
    .catch(function () { return null; }); // offline: no molestar
}

// Aplica una versión nueva de precios preservando las ediciones del usuario.
function aplicarPreciosRemotos(nuevaDB, version, mes) {
  if (!nuevaDB) {return false;}
  // La DB nueva manda, pero las ediciones del usuario ganan (ver mergePriceDBs).
  DB = mergePriceDBs(nuevaDB, DB);
  localStorage.setItem("ppy_db5", JSON.stringify(DB));
  localStorage.setItem("ppy_db_version", String(version || ""));
  if (mes) {localStorage.setItem("ppy_db_mes", mes);}
  // Marca el origen: sin esto, el arranque migraría la base a la compilada y
  // el suscriptor "perdería" los precios que acaba de recibir.
  localStorage.setItem("ppy_db_source", "remoto");
  save();
  return true;
}

// Vuelve a la base que trae compilada la app (el botón "Restaurar").
function restaurarPreciosLocales() {
  DB = buildDB();
  try {
    localStorage.removeItem("ppy_db_source");
    localStorage.removeItem("ppy_db_mes");
    localStorage.setItem("ppy_db_version", DB_VERSION);
  } catch (e) {}
  save();
}

// Recorre la base en segundo plano y avisa si hay algo más nuevo.
function preciosUpdateSilencioso() {
  if (!canUpdatePrices()) {return;}
  checkPreciosUpdate().then(function (nuevo) {
    if (!nuevo) {return;}
    var fechaTxt = preciosFechaLabel(nuevo.fecha);
    toast("Hay precios actualizados (" + fechaTxt + "). Abrilo desde 💰 Base de Precios.", true);
    state._preciosPendientes = { version: nuevo.version, fecha: nuevo.fecha };
  }).catch(function () {});
}

// Extrae y valida la seccion de un query string (?section=logs).
// Devuelve null si no viene o si no es una seccion conocida: los shortcuts del
// manifest no deben poder inyectar valores arbitrarios en la app.
function sectionFromUrl(search) {
  var s = "";
  try { s = new URLSearchParams(search || "").get("section") || ""; }
  catch (e) { return null; }
  return VALID_SECTIONS.indexOf(s) !== -1 ? s : null;
}

function escapeHtml(str) {
  if (typeof str !== "string") {return "";}
  var map = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };
  return str.replace(/[&"'<>]/g, function (m) { return map[m]; });
}

var debounce = function (fn, ms) {
  if (ms === void 0) {ms = 200;}
  var t;
  return function () {
    var a = [];
    for (var _i = 0; _i < arguments.length; _i++) {a[_i] = arguments[_i];}
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(null, a); }, ms);
  };
};


const fmt = n => {
  if (n === undefined || n === null || isNaN(n)) {return "0";}
  let val = n;
  const symbol = state.currency === "USD" ? "U$S " : "";
  let dec = 0;
  if (state.currency === "USD") {
    val = n / (state.exchangeRate || 7500);
    dec = 2;
  }
  return symbol + new Intl.NumberFormat("es-PY", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
};
const fmtD = (n, d = 2) => +n.toFixed(d);
// Pluralización simple en español: plural(1,"proyecto") → "1 proyecto"; plural(2,"proyecto") → "2 proyectos".
const plural = (n, sing, plur) => `${n} ${n === 1 ? sing : (plur || sing + "s")}`;

// ── HELPERS DE FECHAS (todo PY: dd/mm/yyyy) ──────────────────────────────
/**
 * Formatea cualquier fecha como dd/mm/yyyy (formato paraguayo).
 * Acepta: Date, string ISO (yyyy-mm-dd), string dd/mm/yyyy, string d/m/yyyy (legacy), timestamp.
 * Devuelve "" si la entrada es inválida.
 */
function formatDatePY(input) {
  if (!input) {return "";}
  let d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "number") {
    d = new Date(input);
  } else if (typeof input === "string") {
    // Formato dd/mm/yyyy con ceros — devolver tal cual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {return input;}
    // Formato legacy d/m/yyyy o dd/m/yyyy (sin ceros — datos viejos guardados con toLocaleDateString)
    const pyLegacyMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (pyLegacyMatch) {
      const [, day, month, year] = pyLegacyMatch;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    // Formato ISO yyyy-mm-dd
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, day] = isoMatch;
      return `${day}/${m}/${y}`;
    }
    d = new Date(input);
  }
  if (!d || isNaN(d.getTime())) {return "";}
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Devuelve la fecha de hoy en formato ISO (yyyy-mm-dd) para inputs HTML date.
 * Los <input type="date"> SIEMPRE usan ISO internamente, no se puede cambiar.
 */
function todayISO() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Convierte cualquier formato a Date object para hacer cálculos/comparaciones.
 * Soporta dd/mm/yyyy, d/m/yyyy (legacy) y yyyy-mm-dd.
 */
function parseDate(input) {
  if (!input) {return null;}
  if (input instanceof Date) {return input;}
  if (typeof input === "string") {
    // dd/mm/yyyy o d/m/yyyy (paraguayo, con o sin ceros)
    const pyMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (pyMatch) {
      const [, d, m, y] = pyMatch;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    // yyyy-mm-dd (ISO)
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Genera un input de fecha custom que SIEMPRE muestra dd/mm/yyyy,
 * independiente del idioma del browser.
 *
 * Estrategia: <input type="date"> nativo (mantiene el contrato `this.value = ISO`
 * para todos los onchange existentes) + un overlay visual que muestra dd/mm/yyyy
 * encima de lo que el browser pinta. Cuando el usuario hace click, abre el picker
 * nativo. Cuando cambia el valor, el overlay se actualiza.
 *
 * @param {string} id          ID del input
 * @param {string} value       Valor inicial en formato ISO yyyy-mm-dd
 * @param {string} onchange    JS para onchange (recibe `this.value` en formato ISO)
 * @param {string} style       CSS inline extra
 * @param {string} cls         Clases CSS extra
 * @returns {string} HTML del componente
 */
function dateInputPY(id, value, onchange, style = "", cls = "") {
  const safeId = id || "date-" + Math.random().toString(36).slice(2, 9);
  const displayValue = value ? formatDatePY(value) : "dd/mm/aaaa";
  const wrappedOnchange = (onchange || "") + ";datePYUpdateLabel('" + safeId + "')";
  return `<span class="date-py-wrap ${cls}" style="position:relative; display:inline-block; ${style}">
    <input type="date" id="${safeId}" value="${value || ''}" class="date-py-native"
      onchange="${wrappedOnchange.replace(/"/g, '&quot;')}"
      style="opacity:0; position:absolute; inset:0; width:100%; height:100%; cursor:pointer; z-index:2; padding:0; border:none; margin:0">
    <span class="date-py-label" data-date-label-for="${safeId}"
      style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:8px 12px; border:1px solid var(--bor); border-radius:var(--rad); background:var(--bg); color:var(--tx); min-width:130px; font-size:14px; ${value ? '' : 'color:var(--tx3)'}">
      <span>${displayValue}</span>
      <span style="font-size:1rem">📅</span>
    </span>
  </span>`;
}

/**
 * Actualiza el label visible del componente dateInputPY tras un cambio.
 */
function datePYUpdateLabel(id) {
  const inp = document.getElementById(id);
  if (!inp) {return;}
  const labels = document.querySelectorAll(`[data-date-label-for="${id}"] > span:first-child`);
  labels.forEach(l => {
    l.textContent = inp.value ? formatDatePY(inp.value) : "dd/mm/aaaa";
  });
  // Color del placeholder vs valor real
  const wraps = document.querySelectorAll(`[data-date-label-for="${id}"]`);
  wraps.forEach(w => {
    w.style.color = inp.value ? "var(--tx)" : "var(--tx3)";
  });
}

/**
 * Refresca todos los labels de todos los date inputs (útil tras render masivo).
 */
function datePYRefreshAll() {
  document.querySelectorAll("input.date-py-native").forEach(inp => {
    datePYUpdateLabel(inp.id);
  });
}

const waLink = p => {
  if (!p) {return "";}
  let clean = p.replace(/\D/g, "");
  if (clean.startsWith("0") && clean.length === 10) {clean = "595" + clean.substring(1);}
  else if (clean.length === 9) {clean = "595" + clean;}
  return `https://wa.me/${clean}`;
};

const DEFAULT_YIELDS = {
  "ESTRUCTURAS": 1.5,
  "FUNDACIONES": 2,
  "MAMPOSTERÍA": 15,
  "CONTRAPISOS": 30,
  "REVOQUES": 20,
  "TECHOS": 10,
  "PISOS": 15,
  "AISLACIÓN": 30,
  "PINTURAS": 40,
  "CARPINTERÍA MADERA": 5,
  "CARPINTERÍA METÁLICA": 5,
  "DESAGÜE CLOACAL": 10,
  "AGUA CORRIENTE": 15,
  "ARTEFACTOS SANITARIOS": 4,
  "INSTALACIÓN ELÉCTRICA": 15,
  "VARIOS": 5
};

function buildDB() {
  const db = {};
  for (const [cat, items] of Object.entries(DB_RAW)) {
    db[cat] = {};
    const pct = LABOR_PCT[cat] || 30;
    for (const [name, item] of Object.entries(items)) {
      // MO embutida: si el rubro está en MO_YA_INCLUIDA (db_precios.js), `m` ya es
      // el TOTAL Mat+MO (fuente Mandua Costeo), así que la MO NO se suma de nuevo:
      // mat = m − lab y total = m. Rubros con MO explícita (campo `l`) la preservan.
      const lab = (item.l == null) ? Math.round(item.m * pct / 100) : item.l;
      const moEmbebida = (typeof MO_YA_INCLUIDA !== "undefined") && MO_YA_INCLUIDA.has(cat + "||" + name);
      const mat = moEmbebida ? Math.max(0, item.m - lab) : item.m;
      db[cat][name] = { unit: item.u, matCost: mat, laborCost: lab, laborPct: pct, total: mat + lab, mats: item.mats || [], y: item.y || null };
    }
  }
  return db;
}
let DB = buildDB();

// ── STATE ──────────────────────────────────────────────────────────────
const state = {
  section: "budget", computoView: "total", expandedCat: "ESTRUCTURAS", search: "", items: [],
  projectName: "Nuevo Proyecto", clientName: "", clientPhone: "", clientAddress: "",
  profitPct: 0, validDays: 30, budgetNum: 1, notes: "", pdfShowBreakdown: false,
  priceEditMode: "total", editPriceKey: null, editField: "total", activeBudgetId: null,
  theme: "slate",
  ivaEnabled: false, ivaEnPDF: false,
  adjustPct: 0,
  profile: { company: "", professional: "", matricula: "", ruc: "", phone: "", email: "", address: "", instagram: "", whatsapp: "", website: "" },
  contractors: [], // Base de datos de contratistas
  ownTeam: [],     // [NUEVO] Personal propio global
  roles: {         // [NUEVO] Valores base de jornales
    "Ayudante": 80000,
    "Oficial": 130000,
    "Puntero": 180000
  },
  schedules: {},   
  projectStartDate: null, 
  dailyLogs: [],   
  staff: [],       
  priceHistory: [
    { name: "Cemento tipo 1 /kg", aug25: 1165, mar26: 1165, unit: "kg" },
    { name: "Arena lavada /m3", aug25: 62000, mar26: 63500, unit: "m3" },
    { name: "Varilla conf. Ø8mm /kg", aug25: 9600, mar26: 9600, unit: "kg" },
    { name: "Ladrillo común /un", aug25: 740, mar26: 740, unit: "un" },
    { name: "Teja española Yoayu /un", aug25: 1850, mar26: 1905, unit: "un" },
    { name: "Piedra triturada IV /tn", aug25: 132500, mar26: 132500, unit: "tn" },
    { name: "Látex interior /lt", aug25: 30000, mar26: 30000, unit: "lt" },
    { name: "Cal triturada /kg", aug25: 1238, mar26: 1238, unit: "kg" },
  ],
  logoDataUrl: "",
  signDataUrl: "",
  isPro: true, 
  suppliers: [],   
  paymentAlarms: [], 
  materialOrders: [], 
  finances: { income: [], expenses: [] }, 
  performance: { goals: [] }, 
  documents: [], 
  currency: "PYG", 
  exchangeRate: 7500, 
  projects: [],      
  activeProjectId: null, 
  activeAdendaId: null,  
  migratedV6: false, 
  migratedV7: false, // [NUEVO] Flag para geoloc y jornaleros
  clients: [],       // [NUEVO] Base de datos de clientes
  migratedClients: false, // [NUEVO] Flag de migración de clientes
  clientFilter: "",  // [NUEVO] Filtro de la sección Clientes
  clientFilterProj: null, // [NUEVO] Filtro de proyectos por cliente
  phaseIdSeq: 1,     // [NUEVO] Secuencia de ids de fases
  quickBudgets: [],  // [NUEVO] Computos rapidos: presupuestos sueltos sin cliente ni ejecucion
  quickEditingId: null, // id del computo rapido en edicion (solo en memoria, no persiste)
};

// Load state from localStorage (fast cache)
try {
  var s = localStorage.getItem("ppy_v5");
  if (s) {
    Object.assign(state, JSON.parse(s));
  } else {
    loadDemoProject();
  }
  state.isPro = true;
  migrateToMultiProject();
  if (typeof ensureClients === "function") {ensureClients();}
} catch (e) { }

// El computo rapido en edicion es un "modo" que vive solo en memoria (el
// wrapper _quickProj no se serializa): si quedo activo de una sesion anterior
// (recarga), se limpia para no apuntar a un borrador inexistente.
state.quickEditingId = null;

// Init Dexie and try to load authoritative data from IndexedDB
//
// OJO con el hoisting: la declaración de `_DEXIE` tiene que estar ANTES de esta
// llamada. Si quedara más abajo (donde vive initDexie), `var` eleva la variable
// pero el `= null` se ejecuta DESPUÉS y borra la instancia recién creada: todo
// el guardado en IndexedDB quedaba mudo sin ningún error visible.
var _DEXIE = null;
initDexie();

// Este callback puede correr DURANTE la carga del propio app.js: si Dexie aún no
// está disponible, dexieLoad lo invoca en forma síncrona (ver dexieLoad). En ese
// momento los módulos que se cargan después (clients.js, ot.js, materials.js…)
// todavía no existen, y pintar una sección que los usa estalla con un
// ReferenceError y deja la pantalla en blanco. Se espera a que el documento
// termine de parsearse, que es cuando ya están todos.
function cuandoListosLosScripts(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

dexieLoad(function () {
  // Dexie loaded, re-render if needed
  cuandoListosLosScripts(function () {
    if (typeof ensureClients === "function") {ensureClients();}
    if (typeof setSection === "function" && state.section) {
      setSection(state.section);
    }
    // Recién acá, con los datos ya cargados: si no, guardaría un estado vacío.
    backupAutomatico();
    checkBackupReminder();
    // Sesiones largas (una obra abierta todo el día): se respalda igual.
    setInterval(backupAutomatico, 60 * 60 * 1000);
  });
});

try {
  const d = localStorage.getItem("ppy_db5");
  const cachedVersion = localStorage.getItem("ppy_db_version");
  // Origen de la base instalada. "remoto" = llegó por la suscripción (canal de
  // precios), por lo que es MÁS NUEVA que la que trae compilada esta versión de
  // la app. En ese caso no se migra ni se pisa la versión: reemplazarla por la
  // compilada sería bajar los precios que el suscriptor acaba de recibir, y
  // volvería a ofrecer la misma actualización en cada arranque.
  let dbOrigen = null;
  try { dbOrigen = localStorage.getItem("ppy_db_source"); } catch (e) { dbOrigen = null; }
  if (d) {
    const cachedDB = JSON.parse(d);
    if (dbOrigen === "remoto") {
      // Base de la suscripción: se usa tal cual, con las ediciones ya aplicadas
      DB = cachedDB;
    } else if (cachedVersion === DB_VERSION) {
      // Si la versión cacheada coincide con la actual, usarla tal cual
      DB = cachedDB;
    } else {
      // Si no, hacer merge: arrancar de la DB fresca (con categorías nuevas)
      // y sobrescribir con las ediciones manuales del usuario que existan
      const mergedDB = mergePriceDBs(buildDB(), cachedDB);
      DB = mergedDB;
      localStorage.setItem("ppy_db5", JSON.stringify(DB));
      localStorage.setItem("ppy_db_version", DB_VERSION);
      console.log("[DB] Migrada de", cachedVersion || "(sin versión)", "a", DB_VERSION, "— categorías nuevas añadidas, ediciones del usuario preservadas");
    }
  } else {
    localStorage.setItem("ppy_db_version", DB_VERSION);
  }
} catch (e) { console.warn("[DB] Error en merge, usando DB fresca:", e); }

applyTheme(state.theme);

function migrateToMultiProject() {
  if (state.migratedV6) {return;}
  
  if (state.budgets && state.budgets.length > 0) {
    let target = state.budgets.find(b => b.id === state.activeBudgetId);
    if (!target) {target = state.budgets[state.budgets.length - 1];}
    
    // Mover datos globales antiguos al proyecto "activo"
    if (target) {
      target.schedules = state.schedules || {};
      target.dailyLogs = state.dailyLogs || [];
      target.projectStartDate = state.projectStartDate || null;
      target.materialOrders = [];
      target.finances = { income: [], expenses: [] };
    }
  }
  
  state.migratedV6 = true;
  migrateToV8(); // Ejecutar nueva migración
  save();
}

function migrateToV8() {
    if (state.migratedV7) {return;}
    state.projects.forEach(p => {
        if (!p.location) {p.location = { lat: null, lng: null, address: "", mapUrl: "" };}
        if (!p.execution) {p.execution = {};}
        if (!p.execution.dayWorkers) {p.execution.dayWorkers = [];}
        if (!p.execution.laborPayments) {p.execution.laborPayments = [];}
    });
    if (!state.ownTeam) {state.ownTeam = [];}
    if (!state.roles) {
        state.roles = { "Ayudante": 80000, "Oficial": 130000, "Puntero": 180000 };
    }
    state.migratedV7 = true;
}

// ── FILE SYSTEM ACCESS API — CARPETA DE PROYECTO ───────────────────────
var DEFAULT_FOLDER_CATEGORIES = [
    { id: "planos",        name: "Planos",                  icon: "📐" },
    { id: "fotos_avance",  name: "Fotos de Avance",         icon: "📸" },
    { id: "fotos_detalle", name: "Fotos de Detalle",        icon: "🔍" },
    { id: "contratos",     name: "Contratos",               icon: "📝" },
    { id: "facturas",      name: "Facturas",                icon: "🧾" },
    { id: "manuales",      name: "Manuales",                icon: "📘" },
    { id: "planillas",     name: "Planillas",               icon: "📊" },
    { id: "exportados",    name: "Exportados",              icon: "📤" },
    { id: "otros",         name: "Otros",                   icon: "📁" }
];

function supportsFileSystemAccess() {
    return 'showDirectoryPicker' in window;
}

function getProjectFolderHandle(p) {
    if (!p || !p.execution) {return null;}
    return p.execution.folderHandle || null;
}

function getProjectFolderStatus(p) {
    if (!supportsFileSystemAccess()) {return 'unsupported';}
    if (!p || !p.execution || !p.execution.folderHandle) {return 'none';}
    return 'linked';
}

async function verifyFolderPermission(handle, requestWrite) {
    if (!handle) {return false;}
    try {
        var mode = requestWrite ? 'readwrite' : 'read';
        var perm = await handle.queryPermission({ mode: mode });
        if (perm === 'granted') {return true;}
        perm = await handle.requestPermission({ mode: mode });
        return perm === 'granted';
    } catch (e) {
        return false;
    }
}

async function initProjectFolder(p) {
    if (!supportsFileSystemAccess()) {
        toast("Tu navegador no soporta carpetas en disco. Usá Chrome o Edge.", false);
        return false;
    }
    try {
        var dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        // Crear subcarpetas
        for (var i = 0; i < DEFAULT_FOLDER_CATEGORIES.length; i++) {
            var cat = DEFAULT_FOLDER_CATEGORIES[i];
            await dirHandle.getDirectoryHandle(cat.name, { create: true });
        }
        // Escribir _metadata.json
        var metadata = {
            app: "Puntero",
            version: "3.0",
            project: p.name,
            client: p.client || "",
            created: new Date().toISOString(),
            categories: DEFAULT_FOLDER_CATEGORIES.map(function(c) { return c.name; })
        };
        var metaFile = await dirHandle.getFileHandle('_metadata.json', { create: true });
        var writable = await metaFile.createWritable();
        await writable.write(JSON.stringify(metadata, null, 2));
        await writable.close();

        if (!p.execution) {p.execution = {};}
        p.execution.folderHandle = dirHandle;
        p.execution.folderPath = dirHandle.name;
        p.execution.folderCategories = DEFAULT_FOLDER_CATEGORIES;
        save();
        toast("Carpeta vinculada: " + dirHandle.name + " ✓");
        return true;
    } catch (e) {
        if (e.name !== 'AbortError') {
            toast("Error al vincular carpeta: " + e.message, false);
        }
        return false;
    }
}

async function ensureSubfolders(dirHandle) {
    if (!dirHandle) {return;}
    for (var i = 0; i < DEFAULT_FOLDER_CATEGORIES.length; i++) {
        var cat = DEFAULT_FOLDER_CATEGORIES[i];
        await dirHandle.getDirectoryHandle(cat.name, { create: true });
    }
}

async function getSubfolderHandle(dirHandle, categoryObj) {
    if (!dirHandle) {return null;}
    try {
        return await dirHandle.getDirectoryHandle(categoryObj.name, { create: true });
    } catch (e) {
        return null;
    }
}

async function scanFolder(dirHandle) {
    var results = [];
    if (!dirHandle) {return results;}
    try {
        for await (var entry of dirHandle) {
            var name = entry[0];
            var handle = entry[1];
            if (name === '_metadata.json') {continue;}
            if (handle.kind === 'directory') {
                var catDef = DEFAULT_FOLDER_CATEGORIES.find(function(c) { return c.name === name; });
                var catId = catDef ? catDef.id : 'otros';
                var catIcon = catDef ? catDef.icon : '📁';
                for await (var fileEntry of handle) {
                    if (fileEntry[1].kind === 'file') {
                        var fHandle = fileEntry[1];
                        var file = await fHandle.getFile();
                        results.push({
                            name: fileEntry[0],
                            handle: fHandle,
                            category: catId,
                            categoryName: name,
                            categoryIcon: catIcon,
                            size: file.size,
                            type: file.type,
                            lastModified: file.lastModified
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.warn("[Folder] Error escaneando carpeta:", e);
    }
    return results;
}

async function writeFileToFolder(dirHandle, categoryName, fileName, data, mimeType) {
    if (!dirHandle) {return false;}
    try {
        var subHandle = await dirHandle.getDirectoryHandle(categoryName, { create: true });
        var fileHandle = await subHandle.getFileHandle(fileName, { create: true });
        var writable = await fileHandle.createWritable();
        if (data instanceof Blob) {
            await writable.write(data);
        } else if (data instanceof ArrayBuffer) {
            await writable.write(new Blob([data], { type: mimeType || 'application/octet-stream' }));
        } else if (typeof data === 'string') {
            await writable.write(data);
        }
        await writable.close();
        return true;
    } catch (e) {
        console.warn("[Folder] Error escribiendo archivo:", e);
        return false;
    }
}

async function readFileFromFolder(fileHandle) {
    try {
        return await fileHandle.getFile();
    } catch (e) {
        return null;
    }
}

async function deleteFileFromFolder(fileHandle) {
    try {
        await fileHandle.remove();
        return true;
    } catch (e) {
        return false;
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) {return '0 B';}
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

async function autoSavePhotoToFolder(photoDataUrl, photoName) {
    var p = getActiveProject();
    if (!p || !p.execution || !p.execution.folderHandle) {return false;}
    var handle = p.execution.folderHandle;
    var ok = await verifyFolderPermission(handle, true);
    if (!ok) {return false;}
    // Convertir data URL a Blob
    var parts = photoDataUrl.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var byteStr = atob(parts[1]);
    var ab = new ArrayBuffer(byteStr.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteStr.length; i++) {ia[i] = byteStr.charCodeAt(i);}
    var blob = new Blob([ab], { type: mime });
    return writeFileToFolder(handle, 'Fotos de Avance', photoName, blob, mime);
}

async function copyExportToFolder(blob, fileName) {
    var p = getActiveProject();
    if (!p || !p.execution || !p.execution.folderHandle) {return false;}
    var handle = p.execution.folderHandle;
    var ok = await verifyFolderPermission(handle, true);
    if (!ok) {return false;}
    return writeFileToFolder(handle, 'Exportados', fileName, blob, blob.type || 'application/octet-stream');
}

function migrateToV9() {
    if (state.migratedV8) {return;}
    state.projects.forEach(function(p) {
        if (!p.execution) {p.execution = {};}
        if (!p.execution.folderHandle) {p.execution.folderHandle = null;}
        if (!p.execution.folderPath) {p.execution.folderPath = '';}
        if (!p.execution.folderCategories) {p.execution.folderCategories = DEFAULT_FOLDER_CATEGORIES;}
    });
    state.migratedV8 = true;
    save();
}

function migrateToV10() {
    if (state.migratedV9) {return;}
    (state.contractors || []).forEach(function(c) {
        if (c.isBlacklisted !== undefined) {
            c.ratingAvg = 1;
            c.ratingCount = 0;
            c.ratings = {};
            delete c.isBlacklisted;
        } else {
            if (c.ratingAvg === undefined) {c.ratingAvg = 0;}
            if (c.ratingCount === undefined) {c.ratingCount = 0;}
            if (!c.ratings) {c.ratings = {};}
        }
    });
    state._globalContractorsCache = [];
    state._globalContractorsLastSync = null;
    state.migratedV9 = true;
    save();
}

// ── RATING & GLOBAL DB HELPERS ────────────────────────────────────────────

function isProUser() {
    return state.isPro === true;
}

function rateContractor(conId, stars, comment) {
    var con = (state.contractors || []).find(function(c) { return c.id === conId; });
    if (!con) {return;}
    if (!con.ratings) {con.ratings = {};}
    var uid = window._currentUser ? window._currentUser.uid : 'local';
    con.ratings[uid] = { stars: stars, comment: comment || '', date: todayISO() };
    var vals = Object.values(con.ratings);
    con.ratingAvg = vals.reduce(function(s, r) { return s + r.stars; }, 0) / vals.length;
    con.ratingCount = vals.length;
    save();
}

function getContractorRating(con) {
    if (!con || !con.ratings) {return { avg: 0, count: 0, userStars: 0 };}
    var vals = Object.values(con.ratings);
    var avg = vals.length ? vals.reduce(function(s, r) { return s + r.stars; }, 0) / vals.length : 0;
    var uid = window._currentUser ? window._currentUser.uid : 'local';
    var userStars = (con.ratings[uid] || {}).stars || 0;
    return { avg: Math.round(avg * 10) / 10, count: vals.length, userStars: userStars };
}

function renderStarsHTML(rating, interactive, conId) {
    var stars = [];
    var rounded = Math.round(rating);
    for (var i = 1; i <= 5; i++) {
        var cls = i <= rounded ? 'star filled' : 'star';
        if (interactive) {
            stars.push('<span class="' + cls + ' star-interactive" onclick="event.stopPropagation(); rateFromCard(\'' + conId + '\', ' + i + ')">' + (i <= rounded ? '★' : '☆') + '</span>');
        } else {
            stars.push('<span class="' + cls + '">' + (i <= rounded ? '★' : '☆') + '</span>');
        }
    }
    return '<span class="stars-display">' + stars.join('') + '</span>';
}

function rateFromCard(conId, stars) {
    var con = (state.contractors || []).find(function(c) { return c.id === conId; });
    if (!con) {return;}
    var existing = {};
    var uid = window._currentUser ? window._currentUser.uid : 'local';
    if (con.ratings && con.ratings[uid]) {existing = con.ratings[uid];}
    showRateModal(conId, con.name, existing.stars || 0, existing.comment || '');
}

function showRateModal(conId, conName, currentStars, currentComment) {
    var el = document.getElementById("modal-area");
    el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:380px">' +
        '<div class="modal-title">Calificar: ' + escapeHtml(conName) + '<button class="delbtn" onclick="closeModal()">✕</button></div>' +
        '<div style="text-align:center; padding:10px 0">' +
        '<div id="rate-stars" style="font-size:2.5rem; cursor:pointer; letter-spacing:4px">' +
        [1,2,3,4,5].map(function(s) {
            return '<span class="star-interactive" data-star="' + s + '" onclick="selectStar(' + s + ')" onmouseover="hoverStar(' + s + ')" onmouseout="resetStars()">' + (s <= currentStars ? '★' : '☆') + '</span>';
        }).join('') +
        '</div>' +
        '<div id="rate-label" style="margin-top:6px; font-size:0.85rem; color:var(--tx3)">' + (currentStars ? starLabel(currentStars) : 'Tocá una estrella') + '</div>' +
        '</div>' +
        '<textarea id="rate-comment" placeholder="Comentario (opcional)..." style="width:100%; min-height:60px; resize:vertical">' + escapeHtml(currentComment) + '</textarea>' +
        '<div class="modal-acts">' +
        '<button class="btn" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn primary" onclick="confirmRate(\'' + conId + '\')">Calificar ★</button>' +
        '</div></div></div>';
    window._selectedRating = currentStars;
}

function selectStar(n) {
    window._selectedRating = n;
    var stars = document.querySelectorAll('#rate-stars .star-interactive');
    stars.forEach(function(el) {
        var s = parseInt(el.getAttribute('data-star'));
        el.textContent = s <= n ? '★' : '☆';
        el.className = 'star-interactive' + (s <= n ? ' star-selected' : '');
    });
    document.getElementById('rate-label').textContent = starLabel(n);
}

function hoverStar(n) {
    var stars = document.querySelectorAll('#rate-stars .star-interactive');
    stars.forEach(function(el) {
        var s = parseInt(el.getAttribute('data-star'));
        el.textContent = s <= n ? '★' : '☆';
    });
}

function resetStars() {
    var cur = window._selectedRating || 0;
    var stars = document.querySelectorAll('#rate-stars .star-interactive');
    stars.forEach(function(el) {
        var s = parseInt(el.getAttribute('data-star'));
        el.textContent = s <= cur ? '★' : '☆';
        el.className = 'star-interactive' + (s <= cur ? ' star-selected' : '');
    });
}

function starLabel(n) {
    var labels = { 1: 'Malo', 2: 'Regular', 3: 'Bueno', 4: 'Muy Bueno', 5: 'Excelente' };
    return labels[n] || '';
}

function confirmRate(conId) {
    var stars = window._selectedRating || 0;
    if (!stars) {return toast("Seleccioná una estrella", false);}
    var comment = document.getElementById('rate-comment').value;
    rateContractor(conId, stars, comment);
    closeModal();
    renderContractors();
    toast("Calificación guardada ✓");
}

async function syncGlobalContractors() {
    if (!isProUser()) {return;}
    if (!window._FIRESTORE || !window._currentUser) {return;}
    try {
        var snap = await window._FIRESTORE.collection('globalContractors').limit(200).get();
        var list = [];
        snap.forEach(function(doc) { list.push({ id: doc.id, ...doc.data() }); });
        state._globalContractorsCache = list;
        state._globalContractorsLastSync = new Date().toISOString();
        save();
    } catch(e) { console.warn('[GlobalDB] Sync error:', e); }
}

/**
 * GESTIÓN DE MULTI-PROYECTOS Y ADENDAS
 */
function openProjectSection(id, section) {
    state.activeProjectId = id;
    const p = getActiveProject();
    if (p && p.budgets[0]) {state.activeAdendaId = p.budgets[0].id;}
    save();
    setSection(section);
}

function renderGlobalDashboard() {
    const el = document.getElementById("section-global_dashboard");
    if (!el) {return;}

    const urgentItems = [];
    const today = new Date();
    const activeProjects = state.projects.filter(p => !p.archived);

    state.projects.forEach(p => {
        (p.execution.materialOrders || []).forEach(o => {
            if (!o.isPaid) {
                urgentItems.push({ project: p.name, type: '💰 Pago Materiales', desc: `Proveedor: ${o.supplier}`, amount: o.total, date: o.date, color: 'var(--err)' });
            }
        });
        Object.entries(p.execution.schedules || {}).forEach(([itemId, sch]) => {
            if (sch.status !== 'done' && sch.end && new Date(sch.end) < today) {
                const adenda = p.budgets.find(b => b.items.find(i => i.id == itemId));
                const item = adenda ? adenda.items.find(i => i.id == itemId) : { name: 'Item desconocido' };
                urgentItems.push({ project: p.name, type: '⚠️ Retraso Obra', desc: item.name, amount: null, date: sch.end, color: 'var(--lab)' });
            }
        });
        (p.execution.aftercare || []).forEach(claim => {
            if (claim.status !== 'resolved') {
                urgentItems.push({ project: p.name, type: '🔧 Garantía', desc: claim.title, amount: null, date: claim.date, color: 'var(--acc)' });
            }
        });
    });

    // % de avance por proyecto: ítems con cronograma terminado / en curso.
    const progPct = (pp) => {
        const items = pp.budgets.reduce((acc, b) => acc.concat(b.items || []), []);
        if (!items.length) {return 0;}
        const sch = (pp.execution && pp.execution.schedules) || {};
        let done = 0;
        items.forEach(i => {
            const s = sch[i.id];
            if (s && s.status === 'done') {done++;}
            else if (s && s.status === 'progress') {done += 0.5;}
        });
        return Math.round((done / items.length) * 100);
    };
    // KPIs: 0 pendientes es bueno (verde); el color de alerta solo si hay pendiente.
    const kpiColor = (n, alerta) => n > 0 ? alerta : 'var(--ok)';
    const nPagos = urgentItems.filter(i => i.type.includes('💰')).length;
    const nRetrasos = urgentItems.filter(i => i.type.includes('⚠️')).length;
    const nGarantia = urgentItems.filter(i => i.type.includes('🔧')).length;

    const h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px">
            <div>
                <h2 class="sec-lbl" style="margin:0">PANEL GENERAL</h2>
                <p style="color:var(--tx3); font-size:0.9rem">${plural(activeProjects.length, "proyecto activo", "proyectos activos")}</p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
                <button class="btn primary" onclick="showModal('new_project')">+ Nuevo Proyecto</button>
                <button class="btn" onclick="setSection('projects')">📋 Gestionar</button>
            </div>
        </div>

        <div class="proj-dash-grid">
            ${activeProjects.map(p => {
                const total = p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
                const pid = p.id.replace(/'/g, "\\'");
                const itemsCount = p.budgets.reduce((s, b) => s + b.items.length, 0);
                const prog = progPct(p);
                return `
                <div class="proj-dash-card" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProjectSection('${pid}','dashboard')}" onclick="openProjectSection('${pid}','dashboard')">
                    <div class="proj-dash-hdr">
                        <div class="proj-dash-name">${escapeHtml(p.name)}</div>
                        <div class="proj-dash-client">👤 ${escapeHtml(p.client || 'Sin cliente')} · 📍 ${escapeHtml(p.address || '')}</div>
                    </div>
                    <div class="proj-dash-meta">
                        <span class="ichip mat">📦 ${itemsCount} items</span>
                        <span class="proj-dash-total">${fmt(total)}</span>
                    </div>
                    <div class="proj-prog-wrap">
                        <div class="proj-prog"><div class="proj-prog-bar" style="width:${prog}%"></div></div>
                        <span class="proj-prog-lbl">${prog}%</span>
                    </div>
                    <div class="proj-dash-actions">
                        <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','budget')">📋 Presupuesto</button>
                        <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','schedule')">📅 Cronograma</button>
                        <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','finances')">💰 Finanzas</button>
                        <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','ot')">📄 OT</button>
                        ${/* [OCULTO] Documentos <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','documents')">📁 Documentos</button> */""}
                        <details class="proj-more" onclick="event.stopPropagation()">
                            <summary class="btn sm" title="Más acciones">⋯</summary>
                            <div class="proj-more-menu">
                                <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','contractors')">👷 Contratistas</button>
                                <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','materials')">🧱 Materiales</button>
                                <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','logs')">📔 Libro de Obra</button>
                                <button class="btn sm" onclick="event.stopPropagation(); openProjectSection('${pid}','jornaleros')">👤 Jornaleros</button>
                            </div>
                        </details>
                    </div>
                </div>`;
            }).join("") || `
                <div class="empty" style="padding:44px 20px;text-align:center;grid-column:1/-1">
                    <div style="font-size:2rem;margin-bottom:8px">🏗️</div>
                    <div style="font-family:var(--font-display);font-weight:800;font-size:1.05rem;margin-bottom:4px">Todavía no hay proyectos activos</div>
                    <p style="color:var(--tx3);font-size:.9rem;margin:0 0 14px">Creá tu primer proyecto o armá un presupuesto suelto en dos minutos con el Cómputo Rápido.</p>
                    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                        <button class="btn primary" onclick="showModal('new_project')">+ Nuevo Proyecto</button>
                        <button class="btn" onclick="setSection('computo_rapido')">⚡ Cómputo Rápido</button>
                    </div>
                </div>`}
        </div>

        <div class="dash-grid" style="margin-top:24px">
            <div class="dash-card" style="border-top:4px solid ${kpiColor(nPagos, 'var(--err)')}">
                <div class="dash-num">${nPagos}</div>
                <div class="dash-lbl">Pagos Pendientes</div>
            </div>
            <div class="dash-card" style="border-top:4px solid ${kpiColor(nRetrasos, 'var(--lab)')}">
                <div class="dash-num">${nRetrasos}</div>
                <div class="dash-lbl">Retrasos Detectados</div>
            </div>
            <div class="dash-card" style="border-top:4px solid ${kpiColor(nGarantia, 'var(--warn)')}">
                <div class="dash-num">${nGarantia}</div>
                <div class="dash-lbl">Garantía / Reclamos</div>
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">📋 Acciones Urgentes / Prioridad</h3>
            <div class="scroll-area" style="max-height:400px">
                <table class="tbl">
                    <thead>
                        <tr>
                            <th>Proyecto</th>
                            <th>Tipo</th>
                            <th>Descripción</th>
                            <th>Fecha Límite / Venc.</th>
                            <th style="text-align:right">Monto</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${urgentItems.sort((a,b) => parseDate(a.date) - parseDate(b.date)).map(item => `
                            <tr>
                                <td style="font-weight:700">${item.project}</td>
                                <td><span class="iva-badge" style="background:${item.color}; color:white">${item.type}</span></td>
                                <td>${item.desc}</td>
                                <td>${formatDatePY(item.date)}</td>
                                <td style="text-align:right; font-weight:700">${item.amount ? fmt(item.amount) : '—'}</td>
                                <td><button class="btn sm" onclick="switchProjectFromName('${item.project.replace(/'/g, "\\'")}')">Ir →</button></td>
                            </tr>
                        `).join("") || '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--tx3)">No hay tareas urgentes detectadas. ¡Todo al día! 🚀</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    el.innerHTML = h;
}

function switchProjectFromName(name) {
    const p = state.projects.find(p => p.name === name);
    if (p) {switchProject(p.id);}
}

function renderAftercare() {
    const el = document.getElementById("section-aftercare");
    if (!el) {return;}
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }

    if (!p.execution.aftercare) {p.execution.aftercare = [];}

    const h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 class="sec-lbl" style="margin:0">GARANTÍA Y AJUSTES (POSTVENTA)</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Seguimiento de reclamos e intervenciones: <strong>${p.name}</strong></p>
            </div>
            <button class="btn primary" onclick="showModal('new_claim')">+ Nuevo Reclamo / Tarea</button>
        </div>

        <div class="con-grid">
            ${p.execution.aftercare.map((c, idx) => `
                <div class="card" style="border-left: 4px solid ${c.status === 'resolved' ? 'var(--ok)' : 'var(--warn)'}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px">
                        <span class="iva-badge" style="background:var(--sur2); color:var(--tx2)">${formatDatePY(c.date)}</span>
                        <span class="iva-badge" style="background:${c.status === 'resolved' ? 'var(--ok)' : 'var(--warn)'}; color:white">${c.status === 'resolved' ? 'RESUELTO' : 'PENDIENTE'}</span>
                    </div>
                    <h3 style="margin:0 0 8px 0; font-size:1.1rem">${c.title}</h3>
                    <p style="font-size:0.875rem; color:var(--tx2); margin-bottom:12px">${c.desc}</p>
                    <div style="display:flex; gap:10px">
                        ${c.status !== 'resolved' ? `<button class="btn sm ok-btn" onclick="updateClaimStatus(${idx}, 'resolved')">Marcar Resuelto</button>` : ''}
                        <button class="btn sm danger" onclick="deleteClaim(${idx})">✕ Eliminar</button>
                    </div>
                </div>
            `).join("") || '<div class="fullcol empty">No hay reclamos registrados.</div>'}
        </div>
    </div>`;

    el.innerHTML = h;
}

function fmtMaterialQty(q) {
    return Number.isInteger(q) ? q : fmtD(q, 2);
}

function renderComputoSection() {
    const el = document.getElementById("section-computo");
    if (!el) {return;}
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }

    const view = state.computoView === "rubros" ? "rubros" : "total";
    const tab = (id, label) =>
        `<button class="btn sm${view === id ? " primary" : ""}" onclick="state.computoView='${id}';renderComputoSection()">${label}</button>`;

    let h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px">
            <div>
                <h2 class="sec-lbl" style="margin:0">CÓMPUTO MÉTRICO DE MATERIALES</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Materiales necesarios para la obra: <strong>${p.name}</strong></p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
                <button class="btn sm" onclick="printComputo()">🖨️ PDF</button>
                <button class="btn sm" onclick="exportComputoCSV()">📄 CSV</button>
                <button class="btn sm" onclick="setSection('budget')">← Volver</button>
            </div>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap">
            ${tab("total", "🧱 Todo junto")}
            ${tab("rubros", "📦 Por rubro")}
        </div>
    `;

    if (view === "total") {
        const mats = calcMaterials();
        h += `
        <div class="info-box" style="margin-bottom:20px">
            <p>Este cómputo suma los materiales de <strong>todas las adendas</strong> del proyecto. Ideal para planificación de compras generales.</p>
        </div>

        <div class="mat-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:15px">
            ${mats.map(m => {
                const isCem = m.name.toLowerCase().includes("cemento");
                const bolsas = isCem ? Math.ceil(m.qty / 50) : null;
                return `
                <div class="mat-card" style="background:var(--sur); padding:15px; border-radius:var(--rad); border:1px solid var(--bor)">
                    <div class="mat-name" style="font-weight:700; font-size:1rem; margin-bottom:8px">${escapeHtml(m.name)}</div>
                    <div class="mat-qty" style="font-size:1.2rem; color:var(--acc)"><strong>${fmtMaterialQty(m.qty)}</strong> ${escapeHtml(m.unit)}</div>
                    ${bolsas ? `<div class="mat-bags" style="font-size:0.8rem; color:var(--tx3); margin-top:5px">≈ ${bolsas} bolsas de 50kg</div>` : ""}
                </div>`;
            }).join("") || '<div class="fullcol empty">No hay materiales calculados. Agregá rubros al presupuesto.</div>'}
        </div>`;
    } else {
        h += renderComputoPorRubro(p);
    }

    h += `</div>`;

    el.innerHTML = h;
}

function renderComputoPorRubro(p) {
    let h = "";
    (p.budgets || []).forEach(b => {
        const items = (b.items || []).filter(i => (i.mats || []).length);
        h += `<div style="margin-bottom:22px">
            <h3 class="sec-lbl" style="margin-bottom:12px">📋 ${escapeHtml(b.name)}</h3>`;
        if (!items.length) {
            h += `<div class="empty" style="padding:14px">Sin desglose de materiales en esta adenda.</div></div>`;
            return;
        }
        items.forEach(item => {
            const mats = calcItemMaterials(item);
            h += `<div class="card" style="margin-bottom:12px;padding:14px">
                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <div>
                        <div style="font-size:.72rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">${escapeHtml(item.cat || "")}</div>
                        <div style="font-weight:700">${escapeHtml(item.name)}</div>
                    </div>
                    <div class="ichip mat" style="align-self:center">${fmtMaterialQty(item.qty)} ${escapeHtml(item.unit || "")}</div>
                </div>
                ${mats.length
                    ? `<table class="tbl"><thead><tr><th>Material</th><th style="text-align:right">Cantidad</th><th style="text-align:center">Unidad</th></tr></thead><tbody>
                        ${mats.map(m => `<tr><td>${escapeHtml(m.name)}</td><td style="text-align:right;font-weight:600">${fmtMaterialQty(m.qty)}</td><td style="text-align:center;color:var(--tx3)">${escapeHtml(m.unit)}</td></tr>`).join("")}
                    </tbody></table>`
                    : `<div style="font-size:.8rem;color:var(--tx3)">Este ítem no tiene desglose de materiales.</div>`}
            </div>`;
        });
        h += `</div>`;
    });
    return h || '<div class="empty" style="padding:20px">No hay rubros en el presupuesto.</div>';
}

function showItemMaterials(itemId) {
    const adenda = getActiveAdenda();
    const item = adenda && adenda.items.find(x => x.id == itemId);
    if (!item) {return;}
    const mats = calcItemMaterials(item);
    const rows = mats.map(m => `<tr><td>${escapeHtml(m.name)}</td><td style="text-align:right;font-weight:600">${fmtMaterialQty(m.qty)}</td><td style="text-align:center;color:var(--tx3)">${escapeHtml(m.unit)}</td></tr>`).join("");
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" style="z-index:600" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:520px">
        <div class="modal-title">🧱 Cómputo del rubro<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="font-size:.72rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">${escapeHtml(item.cat || "")}</div>
        <div style="font-weight:700;margin-bottom:2px">${escapeHtml(item.name)}</div>
        <div style="font-size:.85rem;color:var(--tx3);margin-bottom:12px">Cantidad del ítem: <strong>${fmtMaterialQty(item.qty)} ${escapeHtml(item.unit || "")}</strong></div>
        ${mats.length
            ? `<table class="tbl" style="width:100%"><thead><tr><th>Material</th><th style="text-align:right">Cantidad</th><th style="text-align:center">Unidad</th></tr></thead><tbody>${rows}</tbody></table>`
            : '<div class="empty" style="padding:14px">Este ítem no tiene desglose de materiales.</div>'}
        <div class="modal-acts" style="margin-top:14px">
            <button class="btn" onclick="closeModal()">Cerrar</button>
            <button class="btn primary" onclick="closeModal();setSection('computo')">🧱 Cómputo de toda la obra</button>
        </div>
    </div></div>`;
}

function printComputo() {
    const p = getActiveProject();
    if (!p) {return toast("Sin proyecto activo", false);}
    const mats = calcMaterials();
    if (mats.length === 0) {return toast("No hay materiales calculados", false);}

    let rows = '';
    mats.forEach((m, i) => {
        const qty = Number.isInteger(m.qty) ? m.qty : fmtD(m.qty, 2);
        rows += `<tr><td style="text-align:center;width:40px">${i + 1}</td><td>${escapeHtml(m.name)}</td><td style="text-align:center;width:80px">${qty}</td><td style="text-align:center;width:80px">${escapeHtml(m.unit)}</td></tr>`;
    });

    const win = window.open("", "_blank");
    if (!win) { toast("Permití ventanas emergentes para imprimir", false); return; }

    const date = formatDatePY(new Date());
    win.document.write('<!DOCTYPE html><html><head><title>Cómputo de Materiales - ' + escapeHtml(p.name) + '</title>');
    win.document.write('<style>');
    win.document.write('@page{size:A4 landscape;margin:12mm}');
    win.document.write('*{box-sizing:border-box}');
    win.document.write('body{font-family:"Barlow","Segoe UI",sans-serif;color:#1e293b;padding:0;margin:0;background:#fff}');
    win.document.write('.wrap{max-width:100%;margin:0 auto;padding:20px}');
    win.document.write('.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:3px solid #1e293b;padding-bottom:12px}');
    win.document.write('.hdr h1{font-size:1.3rem;font-weight:800;text-transform:uppercase;margin:0}');
    win.document.write('.info{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;margin-bottom:16px;font-size:.85rem;color:#475569;padding:10px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}');
    win.document.write('table{width:100%;border-collapse:collapse;font-size:.8rem}');
    win.document.write('th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}');
    win.document.write('th{background:#f1f5f9;font-weight:700;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}');
    win.document.write('.tot-row td{background:#e2e8f0;font-weight:800;font-size:.85rem}');
    win.document.write('.foot{text-align:center;margin-top:20px;font-size:.7rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}');
    win.document.write('@media print{body{padding:0}.wrap{padding:0}}');
    win.document.write('</style></head><body>');
    win.document.write('<div class="wrap">');
    win.document.write('<div class="hdr"><h1>Cómputo de Materiales</h1><span style="font-weight:700;color:#475569">' + escapeHtml(p.name) + '</span></div>');
    win.document.write('<div class="info"><div><strong>Proyecto:</strong> ' + escapeHtml(p.name) + '</div><div><strong>Cliente:</strong> ' + escapeHtml(p.client || '—') + '</div><div><strong>Materiales:</strong> ' + mats.length + ' ítems</div><div><strong>Emisión:</strong> ' + date + '</div></div>');
    win.document.write('<table><thead><tr><th style="width:40px">N°</th><th>Material</th><th style="width:80px">Cantidad</th><th style="width:80px">Unidad</th></tr></thead><tbody>' + rows + '</tbody></table>');
    win.document.write('<div class="foot">Documento generado por Puntero — ' + date + '</div>');
    win.document.write('</div>');
    win.document.write('<script>window.onload=function(){setTimeout(function(){window.print();window.close()},300)}<\/script>');
    win.document.write('</body></html>');
    win.document.close();
}

function exportComputoCSV() {
    const p = getActiveProject();
    if (!p) {return toast("Sin proyecto activo", false);}
    const mats = calcMaterials();
    if (mats.length === 0) {return toast("No hay materiales calculados", false);}

    let csv = 'Material,Cantidad,Unidad\r\n';
    mats.forEach(m => {
        const qty = Number.isInteger(m.qty) ? m.qty : fmtD(m.qty, 2);
        csv += '"' + m.name.replace(/"/g, '""') + '",' + qty + ',"' + m.unit + '"\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'computo_' + p.name.replace(/[^a-zA-Z0-9]/g, '_') + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast('CSV descargado ✓');
}

window.modals = window.modals || {};
window.modals.new_claim = () => `
    <div class="modal-title">Registrar Intervención / Reclamo</div>
    <div style="display:flex; flex-direction:column; gap:12px">
        <input id="cl-title" placeholder="Título (ej: Filtración en baño social)">
        ${dateInputPY('cl-date', todayISO(), '', 'width:100%')}
        <textarea id="cl-desc" placeholder="Descripción del problema y acción a tomar..." rows="4"></textarea>
    </div>
    <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveClaim()">Registrar 🔧</button>
    </div>`;

function saveClaim() {
    const p = getActiveProject();
    const title = document.getElementById("cl-title").value.trim();
    const date = document.getElementById("cl-date").value;
    const desc = document.getElementById("cl-desc").value;
    if (!title) {return toast("Título requerido", false);}
    if (!p.execution.aftercare) {p.execution.aftercare = [];}
    p.execution.aftercare.push({ title, date, desc, status: 'pending', id: Date.now() });
    save(); closeModal(); renderAftercare();
    toast("Reclamo registrado ✓");
}

function updateClaimStatus(idx, status) {
    const p = getActiveProject();
    p.execution.aftercare[idx].status = status;
    save(); renderAftercare();
    toast("Estado actualizado ✓");
}

function deleteClaim(idx) {
    if (!confirm("¿Eliminar este registro?")) {return;}
    const p = getActiveProject();
    p.execution.aftercare.splice(idx, 1);
    save(); renderAftercare();
}

function migrateToV7() {
    if (state.projects && state.projects.length > 0) {return;}
    
    // Si hay datos actuales, convertirlos en el primer proyecto
    const initialProject = {
        id: 'p_' + Date.now(),
        name: state.projectName || "Proyecto Inicial",
        client: state.clientName,
        phone: state.clientPhone,
        address: state.clientAddress,
        date: formatDatePY(new Date()),
        status: 'active',
        activeAdendaId: 'main',
        budgets: [
            {
                id: 'main',
                name: 'Presupuesto Principal',
                items: state.items || [],
                profitPct: state.profitPct || 0,
                ivaEnabled: state.ivaEnabled || false,
                notes: state.notes || ""
            }
        ],
        execution: {
            schedules: state.schedules || {},
            dailyLogs: state.dailyLogs || [],
            materialOrders: state.materialOrders || [],
            finances: state.finances || { income: [], expenses: [] },
            documents: state.documents || [],
            aftercare: [],
            projectStartDate: state.projectStartDate || "",
            projectEndDate: ""
        }
    };

    state.projects = [initialProject];
    state.activeProjectId = initialProject.id;
    state.activeAdendaId = 'main';
    save();
}

// Wrapper vivo del computo rapido en edicion. Se declara aca (y no en el bloque
// de funciones de mas abajo) para que getActiveProject()/getActiveAdenda() lo
// vean inicializado aunque alguien pida el proyecto activo durante la carga.
var _quickProj = null;

function getActiveProject() {
    // Computo rapido en edicion: toda la maquinaria del presupuesto (catalogo,
    // tabla, totales, items, cronograma por item) trabaja sobre el borrador.
    if (state.quickEditingId && _quickProj) {return _quickProj;}
    if (!state.activeProjectId && state.projects.length > 0) {
        state.activeProjectId = state.projects[0].id;
    }
    return state.projects.find(p => p.id === state.activeProjectId);
}

function getActiveAdenda() {
    if (state.quickEditingId && _quickProj) {return _quickProj.budgets[0];}
    const p = getActiveProject();
    if (!p) {return null;}
    if (!p.budgets || p.budgets.length === 0) {return null;}
    if (!state.activeAdendaId) {state.activeAdendaId = p.budgets[0].id;}
    return p.budgets.find(b => b.id === state.activeAdendaId);
}

function switchProject(id) {
    state.activeProjectId = id;
    const p = getActiveProject();
    if (!p) {return;}

    state.activeAdendaId = p.budgets[0].id;
    save();

    // Lógica de redirección inteligente
    const hasStarted = p.execution.projectStartDate || 
                      Object.values(p.execution.schedules || {}).some(s => s.status !== 'pending');
    
    if (hasStarted) {
        setSection('schedule');
    } else {
        setSection('budget');
    }
    
    toast(`Proyecto: ${p.name} ✓`);
}

function renderProjects() {
    const el = document.getElementById("section-projects");
    if (!el) {return;}

    if (!state.projectSort) {state.projectSort = 'name';}
    if (!state.projectFilter) {state.projectFilter = '';}
    if (state.projectShowArchived === undefined) {state.projectShowArchived = false;}

    const filtered = [...state.projects].filter(p => {
        if (!state.projectShowArchived && p.archived) {return false;}
        if (state.clientFilterProj && p.clientId !== state.clientFilterProj) {return false;}
        const cname = clientName(p);
        return p.name.toLowerCase().includes(state.projectFilter.toLowerCase()) || 
            (cname && cname.toLowerCase().includes(state.projectFilter.toLowerCase()));
    });

    filtered.sort((a, b) => {
        if (state.projectSort === 'name') {return a.name.localeCompare(b.name);}
        if (state.projectSort === 'client') {return clientName(a).localeCompare(clientName(b));}
        if (state.projectSort === 'amount') {
            const getT = (p) => p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
            return getT(b) - getT(a);
        }
        return 0;
    });

    const archivedCount = state.projects.filter(p => p.archived).length;

    const h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px">
            <div>
                <h2 class="sec-lbl" style="margin:0">Catálogo de Proyectos</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Gestión y clasificación de obras</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap">
                <div class="srch" style="margin:0; flex:1 1 240px; min-width:220px; max-width:400px">
                    <span class="srch-ico">🔍</span>
                    <input placeholder="Buscar proyecto o cliente..." value="${state.projectFilter}" oninput="state.projectFilter=this.value; renderProjects()">
                </div>
                <button class="btn primary" onclick="showModal('new_project')">+ Nuevo Proyecto</button>
            </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:20px; align-items:center; overflow-x:auto; padding-bottom:5px">
            <span style="font-size:0.8rem; color:var(--tx3); font-weight:700; text-transform:uppercase; white-space:nowrap">Ordenar por:</span>
            <button class="btn sm ${state.projectSort === 'name' ? 'primary' : ''}" onclick="state.projectSort='name'; renderProjects()">🔤 Nombre</button>
            <button class="btn sm ${state.projectSort === 'client' ? 'primary' : ''}" onclick="state.projectSort='client'; renderProjects()">👤 Cliente</button>
            <button class="btn sm ${state.projectSort === 'amount' ? 'primary' : ''}" onclick="state.projectSort='amount'; renderProjects()">💰 Monto</button>
            <span style="width:1px;height:20px;background:var(--bor);margin:0 4px"></span>
            <span style="font-size:0.8rem; color:var(--tx3); font-weight:700; text-transform:uppercase; white-space:nowrap">Cliente:</span>
            <select onchange="state.clientFilterProj=this.value||null; renderProjects()">${clientOptionsHtml(state.clientFilterProj || "")}</select>
            <span style="width:1px;height:20px;background:var(--bor);margin:0 4px"></span>
            <button class="btn sm ${state.projectShowArchived ? 'primary' : ''}" onclick="state.projectShowArchived=!state.projectShowArchived; renderProjects()">📦 Archivados ${archivedCount > 0 ? `(${archivedCount})` : ''}</button>
        </div>

        <div class="grid3">
            ${filtered.map(p => {
                const isSelected = p.id === state.activeProjectId;
                const total = p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
                
                return `
                <div class="card ${isSelected ? 'active-proj' : ''}" style="border-top: 4px solid ${p.archived ? 'var(--tx3)' : isSelected ? 'var(--acc)' : 'var(--bor)'}; transition: transform 0.2s; ${p.archived ? 'opacity:0.7;' : ''}">
                    <div style="margin-bottom:10px">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start">
                            <div>
                                <div style="font-size:0.7rem; color:var(--acc); font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px">Proyecto</div>
                                <h3 style="margin:0; font-family:var(--font-display); font-weight:800; font-size:1.1rem; line-height:1.2">${p.name}${p.archived ? ' <span style="font-size:0.65rem;color:var(--tx3);font-weight:400">(archivado)</span>' : ''}</h3>
                            </div>
                            ${p.archived ? `<span style="font-size:1.2rem" title="Archivado">📦</span>` : ''}
                        </div>
                    </div>
                    
                    <div style="margin-bottom:10px">
                        <div style="font-size:0.7rem; color:var(--tx3); font-weight:700; text-transform:uppercase; margin-bottom:2px">Cliente</div>
                        <div style="font-size:0.95rem; font-weight:600; color:var(--tx2)">${clientName(p) || '—'}</div>
                    </div>

                    <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); margin-bottom:12px">
                        <div style="font-size:0.7rem; color:var(--tx3); text-transform:uppercase; margin-bottom:2px">Inversión Total</div>
                        <div style="font-weight:800; font-size:1.2rem; color:var(--acc)">${fmt(total)}</div>
                        <div style="font-size:0.75rem; color:var(--tx3); margin-top:4px">${plural(p.budgets.length, "Presupuesto", "Presupuestos")}</div>
                    </div>

                    <div style="margin-top:12px; display:flex; gap:6px; flex-wrap:wrap">
                        <button class="btn sm primary" style="flex:1" onclick="event.stopPropagation(); switchProject('${p.id}')">📋 Abrir</button>
                        <button class="btn sm" style="flex:1" onclick="event.stopPropagation(); showModal('edit_project','${p.id}')">✏️ Editar</button>
                        <details class="proj-more" onclick="event.stopPropagation()">
                            <summary class="btn sm" title="Más acciones">⋯</summary>
                            <div class="proj-more-menu">
                                ${p.archived 
                                    ? `<button class="btn sm" onclick="event.stopPropagation(); unarchiveProject('${p.id}')">♻️ Restaurar</button>` 
                                    : `<button class="btn sm" onclick="event.stopPropagation(); archiveProject('${p.id}')">📦 Archivar</button>`}
                                <button class="btn sm" onclick="event.stopPropagation(); shareProjectWhatsApp('${p.id}')">📤 Compartir</button>
                                <button class="btn sm danger" onclick="event.stopPropagation(); deleteProject('${p.id}')">✕ Eliminar</button>
                            </div>
                        </details>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px solid var(--bor)">
                        <div style="display:flex; gap:6px">
                            <span style="font-size:0.7rem; color:var(--tx3)">ID: ${p.id.toString().slice(-6)}</span>
                            ${p.location && p.location.lat ? '<span title="Ubicación registrada" style="cursor:help">📍</span>' : ''}
                        </div>
                        ${isSelected ? '<span style="color:var(--ok); font-size:0.7rem; font-weight:800">ACTIVO</span>' : '<span style="font-size:0.7rem; color:var(--tx3)">Seleccionar →</span>'}
                    </div>
                </div>
                `;
            }).join("") || `<div class="fullcol card empty" style="padding:40px; text-align:center">${state.projectShowArchived ? 'No hay proyectos archivados.' : 'No se encontraron proyectos. <button class="btn sm primary" onclick="showModal(\'new_project\')">+ Crear primero</button>'}</div>`}
        </div>
    </div>`;

    el.innerHTML = h;
}

function shareProjectWhatsApp(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) {return;}
    const total = p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
    const loc = p.location && p.location.lat ? `📍 ${p.location.address || 'Ver ubicación'}\n` : '';
    const msg = `📋 *${p.name}*\n👤 Cliente: ${p.client || '—'}\n💰 Inversión: ${fmt(total)}\n${loc}📎 Exportado desde Puntero`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    toast("Compartiendo por WhatsApp...");
}

// Recordatorio no intrusivo de Backup (cada 3 días). Nunca descarga archivos solo.
// Se muestra como banner descartable (no como toast rojo: no es un error).
async function checkBackupReminder() {
  // Con backup automático a carpeta configurado, no hay nada que recordar.
  var carpeta = await carpetaBackup();
  if (carpeta) {return;}
  const last = localStorage.getItem("ppy_last_backup") || 0;
  const seen = localStorage.getItem("pte_backup_banner_seen") || 0;
  const now = Date.now();
  const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;
  if (now - last > TRES_DIAS && now - seen > TRES_DIAS) {
    setTimeout(() => {
      var u = window._currentUser;
      if (!u || u.isGuest === true) { return; }
      if (state._requireAccount !== false && !masteredOrVerified(u)) { return; }
      var b = document.getElementById("backup-banner");
      if (b) {b.style.display = "flex";}
    }, 3000);
  }
}

// Acciones del banner de backup.
function descartarBannerBackup() {
  localStorage.setItem("pte_backup_banner_seen", Date.now());
  var b = document.getElementById("backup-banner");
  if (b) {b.style.display = "none";}
}
function irABackup() {
  descartarBannerBackup();
  setSection("cloud");
}

// ── DEXIE (IndexedDB) ────────────────────────────────────────────────
// `_DEXIE` se declara antes de la llamada a initDexie() (ver más arriba).
function initDexie() {
  if (typeof Dexie === "undefined") {return;}
  try {
    _DEXIE = new Dexie("PunteroDB");
    // v2: agrega `copias` (historial automático de backup local) y permite
    // guardar el handle de la carpeta de backup (no es serializable a JSON).
    _DEXIE.version(1).stores({ state: "id", db: "id" });
    _DEXIE.version(2).stores({ state: "id", db: "id", copias: "ts, tipo" });
  } catch (e) { console.warn("Dexie init failed:", e); }
}

function dexieSave() {
  if (!_DEXIE) {return;}
  _DEXIE.state.put({ id: "main", data: JSON.parse(JSON.stringify(state)) }).catch(function (e) {
    console.warn("Dexie save error:", e);
  });
  // Se guarda junto la metadata de precios: si un día hace falta reconstruir la
  // base desde acá, tiene que volver con su versión/mes/origen, no con los del
  // binario compilado.
  _DEXIE.db.put({ id: "main", data: JSON.parse(JSON.stringify(DB)), meta: metaPrecios() }).catch(function (e) {
    console.warn("Dexie db save error:", e);
  });
}

function dexieLoad(callback) {
  if (!_DEXIE) {return callback && callback();}
  // El espejo solo interviene cuando lo de afuera PERDIÓ datos o quedó viejo.
  // Pisarlo siempre haría dos cosas mal: revivir trabajo ya editado más tarde y
  // deshacer una migración de precios recién aplicada en este arranque.
  var estadoLocal = null;
  try { estadoLocal = JSON.parse(localStorage.getItem("ppy_v5") || "null"); } catch (e) { estadoLocal = null; }
  var dbLocal = null;
  try { dbLocal = localStorage.getItem("ppy_db5"); } catch (e) { dbLocal = null; }

  _DEXIE.state.get("main").then(function (doc) {
    var espejoMásNuevo = doc && doc.data &&
      (doc.data._localModifiedAt || 0) >= ((estadoLocal && estadoLocal._localModifiedAt) || 0);
    if (espejoMásNuevo) {
      Object.assign(state, doc.data);
    }
    return _DEXIE.db.get("main");
  }).then(function (doc) {
    // La base de precios solo se reconstruye si localStorage la perdió: si está
    // presente, ya pasó por la lógica de migración de este arranque.
    if (doc && doc.data && !dbLocal) {
      DB = doc.data;
      if (doc.meta) {aplicarMetaPrecios(doc.meta);}
    }
    localStorage.setItem("ppy_v5", JSON.stringify(state));
    localStorage.setItem("ppy_db5", JSON.stringify(DB));
    if (callback) {callback();}
  }).catch(function () {
    if (callback) {callback();}
  });
}

// ── CORE LOGIC ────────────────────────────────────────────────────────
var _saveTimer = null;
var _wsApplyingRemote = false;

function save() {
  if (_wsApplyingRemote) {
    // Remote workspace changes: save locally but don't write back
    try {
      localStorage.setItem("ppy_v5", JSON.stringify(state));
      localStorage.setItem("ppy_db5", JSON.stringify(DB));
    } catch (e) { }
    dexieSave();
    return;
  }
  try {
    state._localModifiedAt = Date.now();
    localStorage.setItem("ppy_v5", JSON.stringify(state));
    localStorage.setItem("ppy_db5", JSON.stringify(DB));
  } catch (e) { }
  dexieSave();
  firestoreSync();
  updateConnStatus();
}

function firestoreSync() {
  if (!isCloudUser()) {return;}
  if (state._cloudSyncEnabled === false) {return;}
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    try {
      var cloudUid = cloudIdentity();
      if (!cloudUid) {return;}
      state._lastCloudSync = new Date().toISOString();
      window._FIRESTORE.collection("users").doc(cloudUid).set({
        appState: JSON.parse(JSON.stringify(state)),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      // Sync workspace data if in a shared workspace
      if (state._workspaceId && window._workspaceRef) {
        window._workspaceRef.update({
          data: extractWorkspaceData(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: cloudUid
        }).catch(function (e) { console.warn("Workspace write error:", e); });
      }
    } catch (e) { console.warn("Firestore sync error:", e); }
  }, 100);
}

// Flush pending Firestore writes on tab close
window.addEventListener("beforeunload", function () {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    try {
      var cloudUser = isCloudUser();
      var cloudUidFlush = cloudIdentity();
      if (cloudUser && cloudUidFlush && state._cloudSyncEnabled !== false) {
        state._lastCloudSync = new Date().toISOString();
        window._FIRESTORE.collection("users").doc(cloudUidFlush).set({
          appState: JSON.parse(JSON.stringify(state)),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        if (state._workspaceId && window._workspaceRef) {
          window._workspaceRef.update({
            data: extractWorkspaceData(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: cloudUidFlush
          }).catch(function () {});
        }
      }
    } catch (e) {}
  }
});

// ── ESTADO DE CONEXIÓN / SINCRONIZACIÓN ───────────────────────────────
// La app es offline-first, pero el usuario necesita SABER si sus datos
// están a salvo: si está en la nube o solo en el dispositivo. Acá vive el
// indicador (banner + chip del top bar) y los listeners de red.
function isOnline() {
  return !(navigator && navigator.onLine === false);
}

// Cache del último texto renderizado: save() corre muy seguido y no
// queremos tocar el DOM si el estado no cambió.
var _lastConnLabel = null;

function updateConnStatus() {
  var online = isOnline();
  var banner = document.getElementById("conn-banner");
  if (banner) {banner.style.display = online ? "none" : "flex";}

  var chip = document.getElementById("sync-chip");
  if (chip) {
    var cloud = isCloudUser();
    var syncOn = state._cloudSyncEnabled !== false;
    var label, cls;
    if (!online) {
      label = "⚠️ Sin conexión · guardado local";
      cls = "offline";
    } else if (!cloud) {
      label = "💾 Guardado en este dispositivo";
      cls = "";
    } else if (!syncOn) {
      label = "☁️ Sync desactivada";
      cls = "";
    } else if (state._lastCloudSync) {
      var hm = (String(state._lastCloudSync).split("T")[1] || "").slice(0, 5);
      label = "☁️ Sincronizado " + hm;
      cls = "online";
    } else {
      label = "☁️ Cloud activo";
      cls = "online";
    }
    if (label !== _lastConnLabel) {
      _lastConnLabel = label;
      chip.textContent = label;
      chip.className = "sync-chip" + (cls ? " " + cls : "");
    }
  }
}

window.addEventListener("online", function () {
  toast("Conexión restaurada ✓");
  updateConnStatus();
  // Al volver la señal, subimos lo que quedó pendiente.
  if (isCloudUser() && state._cloudSyncEnabled !== false) {firestoreSync();}
});

window.addEventListener("offline", function () {
  toast("Sin conexión · seguís trabajando, se guarda en el dispositivo", false);
  updateConnStatus();
});

// ── WORKSPACE / COLLABORATION ──────────────────────────────────────────
var _workspaceListenerUnsub = null;
var WORKSPACE_FIELDS = ['projects','contractors','suppliers','jornaleros','roles','contratos','clients'];

function extractWorkspaceData() {
  var data = {};
  WORKSPACE_FIELDS.forEach(function (f) {
    if (state[f] !== undefined) {data[f] = JSON.parse(JSON.stringify(state[f]));}
  });
  return data;
}

function applyWorkspaceData(data) {
  if (!data) {return;}
  WORKSPACE_FIELDS.forEach(function (f) {
    if (data[f] !== undefined) {state[f] = data[f];}
  });
}

function generateWorkspaceCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = 'PUN-';
  for (var i = 0; i < 4; i++) {code += chars.charAt(Math.floor(Math.random() * chars.length));}
  return code;
}

async function createWorkspace() {
  if (!window._currentUser) {return toast("Iniciá sesión primero", false);}
  var code = generateWorkspaceCode();
  var wsData = {
    owner: window._currentUser.uid,
    members: [window._currentUser.uid],
    data: extractWorkspaceData(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: window._currentUser.uid,
    code: code
  };
  try {
    var ref = await window._FIRESTORE.collection("workspaces").add(wsData);
    state._workspaceId = ref.id;
    state._workspaceCode = code;
    window._workspaceRef = ref;
    startWorkspaceListener(ref.id);
    save();
    toast("Workspace creado ✓ Código: " + code);
    renderCloudSettings();
  } catch (e) { toast("Error: " + e.message, false); }
}

async function joinWorkspace() {
  if (!window._currentUser) {return toast("Iniciá sesión primero", false);}
  var inp = document.getElementById("ws-join-code");
  if (!inp) {return;}
  var code = inp.value.trim().toUpperCase();
  if (!code) {return toast("Ingresá el código del workspace", false);}
  try {
    var snap = await window._FIRESTORE.collection("workspaces")
      .where("code", "==", code).get();
    if (snap.empty) {return toast("Código inválido", false);}
    var doc = snap.docs[0];
    var ws = doc.data();
    if (ws.members.indexOf(window._currentUser.uid) !== -1) {
      toast("Ya estás en este workspace", false);
      return;
    }
    await doc.ref.update({
      members: firebase.firestore.FieldValue.arrayUnion(window._currentUser.uid),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (ws.data) {applyWorkspaceData(ws.data);}
    state._workspaceId = doc.id;
    state._workspaceCode = code;
    window._workspaceRef = doc.ref;
    localStorage.setItem("ppy_v5", JSON.stringify(state));
    startWorkspaceListener(doc.id);
    toast("¡Unido al workspace! ✓");
    renderCloudSettings();
    if (typeof setSection === "function") {setSection(state.section);}
  } catch (e) { toast("Error: " + e.message, false); }
}

function leaveWorkspace() {
  if (!state._workspaceId) {return;}
  stopWorkspaceListener();
  delete state._workspaceId;
  delete state._workspaceCode;
  delete window._workspaceRef;
  save();
  toast("Saliste del workspace");
  renderCloudSettings();
}

function startWorkspaceListener(wsId) {
  stopWorkspaceListener();
  window._workspaceRef = window._FIRESTORE.collection("workspaces").doc(wsId);
  _workspaceListenerUnsub = window._workspaceRef
    .onSnapshot(function (snap) {
      if (!snap.exists) {return;}
      var ws = snap.data();
      if (!ws.data) {return;}
      if (ws.updatedBy === window._currentUser.uid) {return;}
      _wsApplyingRemote = true;
      applyWorkspaceData(ws.data);
      localStorage.setItem("ppy_v5", JSON.stringify(state));
      _wsApplyingRemote = false;
      if (typeof setSection === "function") {setSection(state.section);}
      toast("🔄 Sincronizado con el workspace", true);
    }, function (err) { console.warn("Workspace listener error:", err); });
}

function stopWorkspaceListener() {
  if (_workspaceListenerUnsub) {
    _workspaceListenerUnsub();
    _workspaceListenerUnsub = null;
  }
}

// Fonts extra por tema: solo se piden a Google Fonts cuando el tema las usa
// (blueprint/obsidian → IBM Plex Mono; elegant/sand → Playfair; neon/crimson → Sora).
// El mapa vive dentro de la función: applyTheme corre en el arranque, antes de
// cualquier declaración const de este punto del archivo (temporal dead zone).
function ensureThemeFonts(t) {
  const fonts = {
    blueprint: "IBM+Plex+Mono:wght@400;600",
    obsidian: "IBM+Plex+Mono:wght@400;600",
    elegant: "Playfair+Display:wght@700;800",
    sand: "Playfair+Display:wght@700;800",
    neon: "Sora:wght@400;700;800",
    crimson: "Sora:wght@400;700;800"
  };
  var fam = fonts[t];
  var link = document.getElementById("theme-fonts");
  if (!fam) {if (link) {link.remove();} return;}
  var href = "https://fonts.googleapis.com/css2?family=" + fam + "&display=swap";
  if (link && link.href === href) {return;}
  if (link) {link.remove();}
  var l = document.createElement("link");
  l.id = "theme-fonts"; l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
}
function applyTheme(t) {
  t = t || "slate";
  document.documentElement.setAttribute("data-theme", t);
  ensureThemeFonts(t);
}

let _tt = null;
function toast(msg, ok = true) {
  const t = document.getElementById("toast-el");
  if (!t) {return;}
  t.textContent = msg;
  t.style.background = ok ? "var(--ok)" : "var(--err)";
  t.style.color = "var(--bg)";
  t.style.display = "";
  clearTimeout(_tt);
  _tt = setTimeout(() => t.style.display = "none", 2500);
}

function setSection(s) {
  // [OCULTO] Secciones aún no listas: Planos/Fotos y Carpeta del Proyecto
  if (s === "documents" || s === "folder") {
    if (typeof toast === "function") {toast("Esa sección estará disponible próximamente", false);}
    s = "global_dashboard";
  }
  state.section = s;
  // Cerrar drawer automáticamente al navegar (UX mobile)
  if (typeof closeSidebar === 'function') {closeSidebar();}
  // Higiene de DOM: #catalog, #table-area y #totals-area existen en Presupuesto
  // y también en Cómputo Rápido; si quedaran pintados en ambos habría ids
  // repetidos y getElementById apuntaría al contenedor equivocado.
  if (s !== "budget") {
    var _bma = document.getElementById("budget-main-area");
    if (_bma) {_bma.innerHTML = "";}
  }
  // El computo rapido en edicion es un modo: al salir de la seccion se desactiva
  // para que Presupuesto y el resto vuelvan a operar sobre el proyecto real.
  // Se conserva al ir a Computo de Materiales, que es la vista de materiales del
  // mismo presupuesto (el boton "Ver Computo" del editor).
  if (s !== "computo_rapido" && s !== "computo") {cerrarComputoRapido();}
  if (s !== "computo_rapido") {
    var _qea = document.getElementById("section-computo_rapido");
    if (_qea) {_qea.innerHTML = "";}
  }
  const titles = { 
    global_dashboard: "Panel General",
    budget: "Presupuesto de Obra", 
    ot: "Orden de Trabajo", 
    schedule: "Cronograma de Ejecución", 
    contractors: "Directorio de Contratistas", 
    prices: "Base de Datos de Precios", 
    dashboard: "Panel de Control", 
    themes: "Temas y Apariencia", 
    logs: "Libro de Obra / Bitácora",
    materials: "Gestión de Materiales",
    finances: "Caja y Finanzas",
    performance: "Rendimiento y KPIs",
    documents: "Planos y Galería",
    suppliers: "Directorio de Proveedores",
    jornaleros: "Jornaleros y Jornales",
    contratos: "Contratos Legales",
    resources: "Biblioteca y Recursos",
    projects: "Gestión de Proyectos",
    clients: "Base de Clientes",
    folder: "Carpeta del Proyecto",
    cajachica: "Caja Chica",
    computo: "Cómputo de Materiales",
    aftercare: "Garantía y Ajustes",
    computo_rapido: "Cómputo Rápido",
    accounts: "Gestión de Cuentas",
    cloud: "☁️ Cloud"
  };
  const vtitle = document.getElementById("view-title");
  if (vtitle) {vtitle.textContent = titles[s] || "Puntero";}

  VALID_SECTIONS.forEach(x => {
    const el = document.getElementById("section-" + x);
    if (el) {el.style.display = s === x ? "" : "none";}
    const b = document.getElementById("btn-" + x);
    if (b) {b.className = "nbtn" + (s === x ? " on" : "");}
  });
  if (s === "global_dashboard") {renderGlobalDashboard();}
  if (s === "projects") {renderProjects();}
  if (s === "clients") {renderClients();}
  if (s === "budget") {renderBudget();}
  if (s === "ot") {renderOT();}
  if (s === "computo") {renderComputoSection();}
  if (s === "computo_rapido") {renderComputoRapido();}
  if (s === "aftercare") {renderAftercare();}
  if (s === "prices") {renderPrices();}
  if (s === "themes") {renderThemes();}
  if (s === "dashboard") {renderDashboard();}
  if (s === "schedule") {renderSchedule();}
  if (s === "contractors") {renderContractors();}
  if (s === "jornaleros") {renderJornaleros();}
  if (s === "contratos") {renderContratos();}
  if (s === "logs") {renderLogs();}
  if (s === "materials") {renderMaterials();}
  if (s === "finances") {renderFinances();}
  if (s === "cajachica") {renderCajaChica();}
  if (s === "performance") {renderPerformance();}
  // [OCULTO] if (s === "documents") renderDocuments();
  if (s === "suppliers") {renderSuppliers();}
  if (s === "resources") {renderResources();}
  // [OCULTO] if (s === "folder") renderFolder();
  if (s === "accounts") {renderAccountsSettings();}
  if (s === "cloud") {renderCloudSettings();}
  // La barra sticky de totales solo vive en Presupuesto y en el editor del Cómputo Rápido.
  updateTotalBar();
}

function renderDashboard() {
  const el = document.getElementById("section-dashboard");
  if (!el) {return;}
  const p = getActiveProject();
  if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
  if (!p.execution) {p.execution = { schedules: {}, dailyLogs: [], materialOrders: [], finances: { income: [], expenses: [] }, documents: [], aftercare: [] };}
  if (!p.execution.schedules) {p.execution.schedules = {};}
  if (!p.execution.finances) {p.execution.finances = { income: [], expenses: [] };}
  if (!p.execution.finances.income) {p.execution.finances.income = [];}
  if (!p.execution.finances.expenses) {p.execution.finances.expenses = [];}

  const { totalProgress } = calcOverallProgress();
  const { total } = getTotals();
  
  // Financiero
  const finances = p.execution.finances || { income: [], expenses: [] };
  const incomeTotal = (finances.income || []).reduce((s, i) => s + i.amount, 0);
  const generalExpenses = (finances.expenses || []).reduce((s, e) => s + e.amount, 0);
  const contractorPayments = (state.contractors || []).reduce((s, c) => s + (c.payments || []).reduce((p, py) => p + py.amount, 0), 0);
  const totalPaid = contractorPayments + generalExpenses;
  const financialProgress = total > 0 ? Math.round((totalPaid / total) * 100) : 0;

  // Materiales
  const orders = p.execution.materialOrders || [];
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

  // Próximos hitos
  const adenda = getActiveAdenda();
  const nextMilestones = (adenda?.items || [])
    .filter(i => (p.execution.schedules[i.id]?.status || 'pending') !== 'done')
    .sort((a, b) => new Date(p.execution.schedules[a.id]?.start || '9999') - new Date(p.execution.schedules[b.id]?.start || '9999'))
    .slice(0, 3);

  el.innerHTML = `<div class="prices-wrap">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
        <div>
            <h2 class="sec-lbl" style="margin:0">Vista General</h2>
            <div style="font-size:0.85rem; color:var(--tx3); margin-top:4px; display:flex; gap:10px; align-items:center; flex-wrap:wrap">
                <span>📅 Inicio:</span>
                ${dateInputPY('proj-overview-start', p.execution.projectStartDate || '', "updateProjectDate('start', this.value)")}
                <span>Fin Est.:</span>
                ${dateInputPY('proj-overview-end', p.execution.projectEndDate || '', "updateProjectDate('end', this.value)")}
                <button class="btn sm" onclick="showProjectLocationModal()" style="margin-left:5px">📍 Ubicación de Obra</button>
            </div>
        </div>
        <div class="db-badge">${escapeHtml(p.name)}</div>
    </div>
    
    <div class="dash-grid">
        <div class="dash-card">
            <div class="dash-num">${totalProgress}%</div>
            <div class="dash-lbl">Avance Físico</div>
            <div style="background:var(--sur2); height:6px; border-radius:10px; margin-top:10px; overflow:hidden">
                <div style="background:var(--ok); height:100%; width:${totalProgress}%"></div>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-num" style="color:var(--err)">${fmt(totalPaid)}</div>
            <div class="dash-lbl">Inversión Realizada</div>
            <div style="font-size:0.8rem; color:var(--tx3); margin-top:5px">Ejecución: ${financialProgress}% del presupuesto</div>
        </div>
        <div class="dash-card">
            <div class="dash-num">${deliveredOrders}/${orders.length}</div>
            <div class="dash-lbl">Logística</div>
            <div style="font-size:0.8rem; color:var(--tx3); margin-top:5px">${orders.length - deliveredOrders} pendientes</div>
        </div>
        <div class="dash-card">
            <div class="dash-num" style="color:${(incomeTotal - totalPaid) >= 0 ? 'var(--ok)' : 'var(--err)'}">${fmt(incomeTotal - totalPaid)}</div>
            <div class="dash-lbl">Saldo de Caja</div>
            <div style="font-size:0.8rem; color:var(--tx3); margin-top:5px">
                Cobrado: ${fmt(incomeTotal)} · Gastado: ${fmt(totalPaid)}
            </div>
        </div>
    </div>

    <div class="grid2" style="margin-top:16px">
        <div class="card">
            <h3 class="sec-lbl">💰 Flujo Financiero</h3>
            <div style="margin-top:10px; display:flex; gap:12px; align-items:flex-end">
                <div style="flex:1">
                    <div style="font-size:0.75rem; color:var(--ok); font-weight:700">Ingresos</div>
                    <div style="background:var(--sur2); height:24px; border-radius:6px; margin-top:4px; overflow:hidden">
                        <div style="background:var(--ok); height:100%; width:${Math.min(100, total > 0 ? (incomeTotal / total) * 100 : 0)}%; border-radius:6px"></div>
                    </div>
                    <div style="font-size:0.8rem; font-weight:700; margin-top:2px">${fmt(incomeTotal)}</div>
                </div>
                <div style="flex:1">
                    <div style="font-size:0.75rem; color:var(--err); font-weight:700">Egresos</div>
                    <div style="background:var(--sur2); height:24px; border-radius:6px; margin-top:4px; overflow:hidden">
                        <div style="background:var(--err); height:100%; width:${Math.min(100, total > 0 ? (totalPaid / total) * 100 : 0)}%; border-radius:6px"></div>
                    </div>
                    <div style="font-size:0.8rem; font-weight:700; margin-top:2px">${fmt(totalPaid)}</div>
                </div>
                <div style="flex:1">
                    <div style="font-size:0.75rem; color:var(--tx3); font-weight:700">Meta</div>
                    <div style="background:var(--sur2); height:24px; border-radius:6px; margin-top:4px; overflow:hidden">
                        <div style="background:var(--tx3); height:100%; width:100%; border-radius:6px; opacity:0.3"></div>
                    </div>
                    <div style="font-size:0.8rem; font-weight:700; margin-top:2px">${fmt(total)}</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h3 class="sec-lbl">👷 Personal en Obra</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px">
                <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.3rem; font-weight:800; color:var(--acc)">${state.jornaleros ? state.jornaleros.filter(j => j.isActive !== false).length : 0}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Jornaleros Activos</div>
                </div>
                <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.3rem; font-weight:800; color:var(--acc)">${(state.contractors || []).length}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Contratistas</div>
                </div>
                <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.3rem; font-weight:800; color:var(--acc)">${(p.execution.dailyLogs || []).length}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Partes Diarios</div>
                </div>
                <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.3rem; font-weight:800; color:${(p.execution.aftercare || []).filter(a => a.status !== 'resolved').length > 0 ? 'var(--err)' : 'var(--ok)'}">${(p.execution.aftercare || []).filter(a => a.status !== 'resolved').length}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Garantías Pendientes</div>
                </div>
            </div>
            <button class="btn sm full" style="margin-top:10px" onclick="setSection('contractors')">👷 Gestionar Personal</button>
        </div>
    </div>

    <div class="grid2" style="margin-top:16px">
        <div class="card">
            <h3 class="sec-lbl">📅 Próximos Hitos</h3>
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px">
                ${nextMilestones.map(i => {
                    const s = (p.execution.schedules && p.execution.schedules[i.id]) || {};
                    const con = s.contractorId ? state.contractors.find(c => c.id === s.contractorId) : null;
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--sur2); border-radius:var(--rad)">
                            <div>
                                <div style="font-weight:700; font-size:0.9rem">${escapeHtml(i.name)}</div>
                                <div style="font-size:0.75rem; color:var(--tx3)">Inicia: ${formatDatePY(s.start) || 'S/D'}${con ? ' · ' + escapeHtml(con.name) : ''}</div>
                            </div>
                            <div class="iva-badge" style="background:${s.status === 'progress' ? 'var(--ok)' : 'var(--sur)'}; color:${s.status === 'progress' ? 'white' : 'var(--tx2)'}">${s.status === 'progress' ? 'EN CURSO' : 'PENDIENTE'}</div>
                        </div>
                    `;
                }).join("") || '<p style="color:var(--tx3); font-size:0.85rem">No hay tareas pendientes.</p>'}
            </div>
            <button class="btn sm full" style="margin-top:10px" onclick="setSection('schedule')">📅 Ver Cronograma Completo</button>
        </div>

        <div class="card">
            <h3 class="sec-lbl">📔 Últimos Partes</h3>
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px; max-height:250px; overflow-y:auto">
                ${(p.execution.dailyLogs || []).slice().sort((a,b) => parseDate(b.date) - parseDate(a.date)).slice(0, 4).map(log => `
                    <div style="padding:8px; background:var(--sur2); border-radius:var(--rad); border-left:3px solid var(--acc)">
                        <div style="font-size:0.8rem; font-weight:700">${formatDatePY(log.date)}</div>
                        <div style="font-size:0.75rem; color:var(--tx3); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden">${escapeHtml(log.workDone || 'Sin descripción')}</div>
                        <div style="font-size:0.65rem; color:var(--tx3); margin-top:2px">${(log.attendance || []).filter(a => a.present).length} presentes</div>
                    </div>
                `).join("") || '<p style="color:var(--tx3); font-size:0.85rem">Sin partes registrados.</p>'}
            </div>
            <button class="btn sm full" style="margin-top:10px" onclick="setSection('logs')">📔 Ir al Libro de Obra</button>
        </div>
    </div>

    <div class="card" style="margin-top:16px">
        <h3 class="sec-lbl">🖼️ Últimas Fotos de Obra</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap:8px; margin-top:10px">
            ${(p.execution.dailyLogs || []).flatMap(l => l.photos || []).slice(-6).map(ph => {
                const photoUrl = typeof ph === 'string' ? ph : (ph.url || '');
                const areaId = typeof ph === 'object' ? (ph.areaId || '') : '';
                const areaName = areaId && typeof getAreaName === 'function' ? getAreaName(areaId) : '';
                return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                    <button type="button" style="aspect-ratio:1;width:100%;background:url(${photoUrl}) center/cover;border-radius:4px;border:1px solid var(--bor);cursor:pointer;padding:0" onclick="previewImage('${photoUrl.replace(/'/g, "\\'")}')" aria-label="Ver foto"></button>
                    ${areaName ? `<span style="font-size:0.55rem;padding:0 4px;border-radius:6px;background:var(--sur2);color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:center">${areaName}</span>` : ''}
                </div>`;
            }).join("") || '<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--tx3); font-size:0.85rem">Sin fotos registradas aún.</div>'}
        </div>
        <!-- [OCULTO] <button class="btn sm full" style="margin-top:10px" onclick="setSection('documents')">Ver Galería Completa</button> -->
    </div>
  </div>`;
}

function updateProjectDate(type, val) {
    const p = getActiveProject();
    if (!p) {return;}
    if (type === 'start') {p.execution.projectStartDate = val;}
    else {p.execution.projectEndDate = val;}
    save();
    toast("Fecha actualizada ✓");
}

function calcOverallProgress() {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda || adenda.items.length === 0) {return { totalProgress: 0 };}
    if (!p.execution.schedules) {p.execution.schedules = {};}

    const items = adenda.items;
    let completed = 0;
    items.forEach(i => {
        const s = p.execution.schedules[i.id];
        if (s && s.status === 'done') {completed++;}
        else if (s && s.status === 'progress') {completed += 0.5;}
    });
    return { totalProgress: Math.round((completed / items.length) * 100) };
}

/**
 * GENERACIÓN DE REPORTES PDF (ESTILO REPORT AND RUN)
 */
async function exportDailyPDF(logId) {
  const proj = getActiveProject();
  if (!proj) {return toast("Sin proyecto activo", false);}
  const log = (proj.execution.dailyLogs || []).find(l => l.id === logId);
  if (!log) {return;}

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const theme = PDF_THEMES.find(t => t.id === state.pdfTheme) || PDF_THEMES[0];
  const margin = 20;
  let y = 20;

  // --- CARÁTULA ---
  doc.setFillColor(theme.bg);
  doc.rect(0, 0, 210, 60, 'F');
  
  if (state.logoDataUrl) {
    doc.addImage(state.logoDataUrl, 'PNG', margin, 15, 30, 30);
  }

  doc.setTextColor("#ffffff");
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME DIARIO DE OBRA", margin + 35, 30);
  doc.setFontSize(10);
  doc.text(`${proj.name} | ${formatDatePY(log.date)}`, margin + 35, 38);

  y = 80;
  doc.setTextColor("#333333");
  doc.setFontSize(14);
  doc.text("Resumen de la Jornada", margin, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${formatDatePY(log.date)}`, margin, y);
  doc.text(`Clima: ${log.weather.toUpperCase()}`, margin + 80, y);
  y += 10;

  doc.setDrawColor(theme.acc);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 190, y);
  y += 10;

  // Trabajos realizados
  doc.setFont("helvetica", "bold");
  doc.text("ACTIVIDADES REALIZADAS:", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const splitWork = doc.splitTextToSize(log.workDone || "Sin descripción", 170);
  doc.text(splitWork, margin, y);
  y += (splitWork.length * 5) + 10;

  // Asistencia
  doc.setFont("helvetica", "bold");
  doc.text("ASISTENCIA DE PERSONAL:", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const present = log.attendance.filter(a => a.present).map(a => a.name).join(", ");
  const absent = log.attendance.filter(a => !a.present).map(a => a.name).join(", ");
  doc.text(`Presentes: ${present || "Ninguno"}`, margin, y);
  y += 5;
  doc.text(`Ausentes: ${absent || "Ninguno"}`, margin, y);
  y += 15;

  // --- FOTOS (Página nueva si es necesario) ---
  if (log.photos && log.photos.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.text("REGISTRO FOTOGRÁFICO", margin, 20);
    let px = margin;
    let py = 30;
    for (let i = 0; i < log.photos.length; i++) {
        const ph = log.photos[i];
        const photoUrl = typeof ph === 'string' ? ph : (ph.url || '');
        const areaId = typeof ph === 'object' ? (ph.areaId || '') : '';
        let areaName = '';
        if (areaId && typeof getAreaName === 'function') {areaName = getAreaName(areaId);}
        try {
            doc.addImage(photoUrl, 'JPEG', px, py, 80, 60);
            if (areaName) {
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor("#666666");
                doc.text(areaName, px + 40, py + 66, { align: 'center' });
            }
        } catch(e) {}
        px += 90;
        if (px > 150) { px = margin; py += 75; }
        if (py > 250 && i < log.photos.length - 1) { doc.addPage(); px = margin; py = 20; }
    }
  }

  // --- PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor("#999999");
    doc.text(`Generado por Puntero - Página ${i} de ${pageCount}`, margin, 285);
  }

  doc.save(`Reporte_Diario_${formatDatePY(log.date).replace(/\//g, '-')}.pdf`);
  copyExportToFolder(doc.output('blob'), `Reporte_Diario_${formatDatePY(log.date).replace(/\//g, '-')}.pdf`);
  toast("PDF Diario generado ✓");
}

async function exportWeeklyReport() {
  const proj = getActiveProject();
  if (!proj) {return toast("Sin proyecto activo", false);}
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const theme = PDF_THEMES.find(t => t.id === state.pdfTheme) || PDF_THEMES[0];
  const margin = 20;

  // CARÁTULA DE INFORME SEMANAL
  doc.setFillColor(theme.bg);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor("#ffffff");
  doc.setFontSize(30);
  doc.text("INFORME SEMANAL", margin, 100);
  doc.setFontSize(15);
  doc.text("SEGUIMIENTO Y CONTROL DE OBRA", margin, 115);
  doc.setFontSize(12);
  doc.text(`PROYECTO: ${(proj.name || '').toUpperCase()}`, margin, 140);
  doc.text(`CLIENTE: ${proj.client || ''}`, margin, 150);
  doc.text(`FECHA DE EMISIÓN: ${formatDatePY(new Date())}`, margin, 160);

  // ÍNDICE
  doc.addPage();
  doc.setTextColor("#333333");
  doc.setFontSize(16);
  doc.text("ÍNDICE", margin, 30);
  doc.setFontSize(10);
  doc.text("1. Resumen Ejecutivo .................................................................... Pág. 3", margin, 50);
  doc.text("2. Estado del Cronograma ............................................................ Pág. 4", margin, 60);
  doc.text("3. Bitácora Diaria (Compilado) ..................................................... Pág. 5", margin, 70);
  doc.text("4. Memoria Fotográfica ................................................................ Pág. 6", margin, 80);

  // CONTENIDO (RESUMEN)
  doc.addPage();
  doc.setFontSize(14);
  doc.text("1. RESUMEN EJECUTIVO", margin, 30);
  doc.setFontSize(10);
  const { totalProgress } = calcOverallProgress();
  doc.text(`El proyecto presenta un avance global del ${totalProgress}%.`, margin, 45);

  // BITÁCORA COMPILADA
  doc.addPage();
  doc.setFontSize(14);
  doc.text("3. BITÁCORA DIARIA (ÚLTIMOS REGISTROS)", margin, 30);
  let y = 45;
  const lastLogs = (proj.execution.dailyLogs || []).slice(-7);
  lastLogs.forEach(log => {
     doc.setFont("helvetica", "bold");
     doc.text(`${formatDatePY(log.date)} - Clima: ${log.weather}`, margin, y);
     doc.setFont("helvetica", "normal");
     const txt = doc.splitTextToSize(log.workDone || "", 160);
     doc.text(txt, margin + 5, y + 5);
     y += (txt.length * 5) + 15;
     if (y > 270) { doc.addPage(); y = 30; }
  });

  // 4. MEMORIA FOTOGRÁFICA (agrupada por área)
  doc.addPage();
  doc.setFontSize(14);
  doc.text("4. MEMORIA FOTOGRÁFICA", margin, 30);
  const allWeeklyPhotos = [];
  lastLogs.forEach(log => {
     (log.photos || []).forEach(ph => allWeeklyPhotos.push({ ...(typeof ph === 'object' ? ph : { url: ph, areaId: '' }), logDate: log.date }));
  });
  if (allWeeklyPhotos.length > 0) {
    const areas = (typeof getAreas === 'function' ? getAreas() : []) || [];
    const grouped = {};
    areas.forEach(a => { grouped[a.id] = { name: a.name, color: a.color || '#888', photos: [] }; });
    grouped[''] = { name: 'Sin área', color: '#999', photos: [] };
    allWeeklyPhotos.forEach(ph => {
      const key = ph.areaId || '';
      if (!grouped[key]) {grouped[key] = { name: 'Sin área', color: '#999', photos: [] };}
      grouped[key].photos.push(ph);
    });
    let py = 45;
    Object.keys(grouped).forEach(key => {
      if (grouped[key].photos.length === 0) {return;}
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(grouped[key].color);
      doc.text(`${grouped[key].name} (${grouped[key].photos.length} fotos)`, margin, py);
      doc.setTextColor("#333333");
      py += 8;
      let px = margin;
      grouped[key].photos.forEach(ph => {
        try {
          doc.addImage(ph.url, 'JPEG', px, py, 40, 30);
        } catch(e) {}
        px += 45;
        if (px > 170) { px = margin; py += 35; }
        if (py > 260) { doc.addPage(); py = 30; px = margin; }
      });
      py += 35;
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor("#999999");
    doc.text("No hay fotos registradas en este período.", margin, 50);
  }

  doc.save(`Informe_Semanal_${(proj.name || 'proyecto').replace(/\s+/g,'_')}.pdf`);
  copyExportToFolder(doc.output('blob'), `Informe_Semanal_${(proj.name || 'proyecto').replace(/\s+/g,'_')}.pdf`);
  toast("Informe Semanal generado ✓");
}

async function exportMonthlyReport() {
  // Reutiliza la lógica semanal pero filtra logs del mes
  return exportWeeklyReport();
}

// ── IVA CALCULATIONS ──────────────────────────────────────────────────
function calcIVA(matCost, laborCost, qty = 1) {
  const adenda = getActiveAdenda();
  if (!adenda || !adenda.ivaEnabled) {return { ivaMat: 0, ivaLab: 0, ivaTotal: 0 };}
  const ivaMat = Math.round(matCost * qty * IVA_MAT);
  const ivaLab = Math.round(laborCost * qty * IVA_LAB);
  return { ivaMat, ivaLab, ivaTotal: ivaMat + ivaLab };
}

// ── ITEM ACTIONS ──────────────────────────────────────────────────────
function addItem(cat, name) {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda || !p) { toast("Seleccioná un proyecto", false); return; }
  if (!p.execution) {p.execution = {};}
  if (!p.execution.schedules) {p.execution.schedules = {};}

  if (!DB[cat]) { toast("Categoría no encontrada", false); return; }
  const data = DB[cat][name];
  if (!data) { toast("Ítem no encontrado en la base de precios", false); return; }
  const ex = adenda.items.find(i => i.cat === cat && i.name === name && !i.custom);
  if (ex) { ex.qty++; renderTable(); save(); return; }

  const y = data.y || DEFAULT_YIELDS[cat] || 10;
  const days = Math.ceil(1 / y) || 1;

  let startStr = p.execution.projectStartDate || todayISO();
  if (adenda.items.length > 0) {
    let maxEnd = 0;
    Object.values(p.execution.schedules).forEach(s => {
      if (s.end) {
        const endTs = new Date(s.end).getTime();
        if (endTs > maxEnd) {maxEnd = endTs;}
      }
    });
    if (maxEnd > 0) {
      startStr = new Date(maxEnd + 86400000).toISOString().split('T')[0];
    }
  }

  const startDate = new Date(startStr);
  const endStr = new Date(startDate.getTime() + (days - 1) * 86400000).toISOString().split('T')[0];

  const newItem = { cat, name, unit: data.unit, unitPrice: data.total, matCost: data.matCost, laborCost: data.laborCost, mats: data.mats || [], qty: 1, id: Date.now() + Math.random(), disc: 0, note: "" };
  adenda.items.push(newItem);
  p.execution.schedules[newItem.id] = { status: 'pending', start: startStr, end: endStr, contractorId: null };

  renderTable(); save();
}

function addCustomItem() {
  const adenda = getActiveAdenda();
  const pj = getActiveProject();
  if (!adenda || !pj) { toast("Seleccioná un proyecto", false); return; }
  const n = document.getElementById("ci-name").value.trim();
  const price = parseFloat(document.getElementById("ci-price").value) || 0;
  const u = document.getElementById("ci-unit").value.trim() || "gl";
  if (!n || !price) { toast("Completá nombre y precio", false); return; }
  const mat = Math.round(price * 0.65); const lab = Math.round(price * 0.35);
  const id = Date.now() + Math.random();
  adenda.items.push({ cat: "PERSONALIZADOS", name: n, unit: u, unitPrice: price, matCost: mat, laborCost: lab, mats: [], qty: 1, id, custom: true, disc: 0, note: "" });
  if (!pj.execution.schedules) {pj.execution.schedules = {};}
  if (!pj.execution.schedules[id]) {pj.execution.schedules[id] = { status: 'pending', start: '', end: '', contractorId: null };}
  document.getElementById("ci-name").value = ""; document.getElementById("ci-price").value = ""; document.getElementById("ci-unit").value = "";
  renderTable(); save(); toast("Ítem agregado ✓");
}

function updateQty(id, val) {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda || !p) {return;}
  const i = adenda.items.find(x => x.id == id);
  if (i) {
    i.qty = parseFloat(val) || 0;
    const cat = i.cat; const name = i.name;
    const dbItem = DB[cat] ? DB[cat][name] : null;
    const yieldRate = (dbItem && dbItem.y) ? dbItem.y : (DEFAULT_YIELDS[cat] || 10);
    const days = Math.max(1, Math.ceil(i.qty / yieldRate));
    if (!p.execution.schedules) {p.execution.schedules = {};}
    const sch = p.execution.schedules[id];
    if (sch && sch.start) {
      const startDate = new Date(sch.start);
      sch.end = new Date(startDate.getTime() + (days - 1) * 86400000).toISOString().split('T')[0];
    }
    renderTotals(); applyItemTotals(id); save();
  }
}
function updateDisc(id, v) { const adenda = getActiveAdenda(); if (!adenda) {return;} const i = adenda.items.find(x => x.id == id); if (i) { i.disc = Math.max(0, Math.min(100, parseFloat(v) || 0)); renderTotals(); applyItemTotals(id); save(); } }
function removeItem(id) {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda) {return;}
  adenda.items = adenda.items.filter(i => i.id != id);
  if (p && p.execution.schedules) {delete p.execution.schedules[id];}
  renderTable(); save();
}

function newBudget() {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda || !p) { toast("No hay proyecto activo", false); return; }
  if (adenda.items.length > 0 && !confirm("¿Limpiar este presupuesto? Se borrarán los ítems.")) {return;}

  // Borrar schedules de los items de esta adenda
  if (p.execution.schedules) {
    adenda.items.forEach(i => delete p.execution.schedules[i.id]);
  }
  adenda.items = [];
  adenda.profitPct = 0;
  adenda.ivaEnabled = false;
  adenda.notes = "";
  renderBudget(); save(); toast("Presupuesto limpiado ✓");
}

function saveVersion() {
    const adenda = getActiveAdenda();
    const p = getActiveProject();
    if (!adenda || !p) {return toast("Sin proyecto activo", false);}

    const name = prompt("Nombre de esta versión (ej: v1 - Inicial, v2 - Ajustado):", `v${(p.versions || []).length + 1}`);
    if (!name) {return;}

    if (!p.versions) {p.versions = [];}

    const snapshot = {
        id: 'v_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        name: name,
        date: formatDatePY(new Date()),
        adendaId: adenda.id,
        items: JSON.parse(JSON.stringify(adenda.items)),
        m2Area: p.m2Area || 0,
        profitPct: adenda.profitPct,
        ivaEnabled: adenda.ivaEnabled,
        notes: adenda.notes
    };

    p.versions.push(snapshot);
    save();
    toast(`Versión "${name}" guardada ✓`);
}

function loadVersion(id) {
    const p = getActiveProject();
    if (!p || !p.versions) {return;}
    const v = p.versions.find(b => b.id === id);
    if (!v) {return;}
    if (!confirm(`¿Cargar la versión "${v.name}"? Esto reemplazará los ítems actuales de la adenda.`)) {return;}

    const adenda = p.budgets.find(b => b.id === v.adendaId) || getActiveAdenda();
    if (!adenda) {return toast("Adenda no encontrada", false);}
    state.activeAdendaId = adenda.id;

    adenda.items = JSON.parse(JSON.stringify(v.items));
    p.m2Area = v.m2Area || 0;
    adenda.profitPct = v.profitPct || 0;
    adenda.ivaEnabled = v.ivaEnabled || false;
    adenda.notes = v.notes || "";

    save();
    renderBudget();
    closeModal();
    toast(`Versión "${v.name}" cargada ✓`);
}

function deleteVersion(id) {
    if (!confirm("¿Eliminar esta versión?")) {return;}
    const p = getActiveProject();
    if (!p || !p.versions) {return;}
    p.versions = p.versions.filter(b => b.id !== id);
    save();
}

// ── TOTALS ──────────────────────────────────────────────────────────
function effPrice(i) { return (Number(i.unitPrice) || 0) * (1 - (i.disc || 0) / 100); }
// Total de una línea de ítem (importe neto + IVA si corresponde).
function itemLineTotal(item, ivaEnabled) {
  const ep = effPrice(item);
  const qty = Number(item.qty) || 0;
  const iva = ivaEnabled ? calcIVA(Number(item.matCost) || 0, Number(item.laborCost) || 0, qty).ivaTotal : 0;
  return ep * qty + iva;
}
// Totales de una adenda. Sin argumento usa la adenda activa; con argumento
// calcula sobre esa (se usa para el listado de computos rapidos).
function getTotals(adenda) {
  adenda = adenda || getActiveAdenda();
  if (!adenda) {return { totalMats:0, totalLabor:0, subtotal:0, ivaMat:0, ivaLab:0, ivaTotal:0, profitAmt:0, total:0 };}
  
  const totalMats = adenda.items.reduce((s, i) => s + (Number(i.matCost) || 0) * (1 - (i.disc || 0) / 100) * (Number(i.qty) || 0), 0);
  const totalLabor = adenda.items.reduce((s, i) => s + (Number(i.laborCost) || 0) * (1 - (i.disc || 0) / 100) * (Number(i.qty) || 0), 0);
  const subtotal = adenda.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (1 - (i.disc || 0) / 100) * (Number(i.qty) || 0), 0);
  
  let ivaMat = 0, ivaLab = 0;
  if (adenda.ivaEnabled) {
      adenda.items.forEach(i => {
          ivaMat += Math.round((Number(i.matCost) || 0) * (Number(i.qty) || 0) * 0.10);
          ivaLab += Math.round((Number(i.laborCost) || 0) * (Number(i.qty) || 0) * 0.05);
      });
  }
  const ivaTotal = ivaMat + ivaLab;
  const profitAmt = (subtotal + ivaTotal) * (adenda.profitPct / 100);
  const total = subtotal + ivaTotal + profitAmt;
  return { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total };
}

function addAdenda() {
    const p = getActiveProject();
    if (!p) {return;}
    const name = prompt("Nombre de la Adenda (ej: Adenda 1 - Muro Perimetral):");
    if (!name) {return;}
    const newA = {
        id: 'ad_' + Date.now(),
        name: name,
        items: [],
        profitPct: 0,
        ivaEnabled: false,
        notes: ""
    };
    p.budgets.push(newA);
    state.activeAdendaId = newA.id;
    save();
    renderBudget();
    toast("Adenda creada ✓");
}

function getGrouped() { 
    const adenda = getActiveAdenda();
    if (!adenda) {return {};}
    const g = {}; 
    for (const i of adenda.items) { 
        if (!g[i.cat]) {g[i.cat] = [];} 
        g[i.cat].push(i); 
    } 
    return g; 
}

function getBreakdown() {
  return Object.entries(getGrouped()).map(([cat, ci]) => ({
    cat,
    matCost: ci.reduce((s, i) => s + (Number(i.matCost) || 0) * (1 - (i.disc || 0) / 100) * (Number(i.qty) || 0), 0),
    laborCost: ci.reduce((s, i) => s + (Number(i.laborCost) || 0) * (1 - (i.disc || 0) / 100) * (Number(i.qty) || 0), 0),
    total: ci.reduce((s, i) => s + effPrice(i) * (Number(i.qty) || 0), 0)
  }));
}

function calcItemMaterials(item) {
  const out = [];
  if (!item || !item.mats) {return out;}
  for (const mat of item.mats) {
    // Soportar ambos formatos: el compacto {n,q,u} de la DB y el extendido {name,qty,unit}
    const name = mat.name || mat.n;
    const unit = mat.unit || mat.u;
    const qty = mat.qty != null ? mat.qty : mat.q;
    if (!name || qty == null) {continue;}
    out.push({ name, unit: unit || "", qty: qty * (item.qty || 0) });
  }
  return out;
}

function calcMaterials() {
  const p = getActiveProject();
  if (!p) {return [];}

  const allItems = p.budgets.flatMap(b => b.items);
  const m = {};
  for (const item of allItems) {
    for (const mat of calcItemMaterials(item)) {
      const key = mat.name + "|" + mat.unit;
      if (!m[key]) {m[key] = { name: mat.name, unit: mat.unit, qty: 0 };}
      m[key].qty += mat.qty;
    }
  }
  return Object.values(m).sort((a, b) => a.name.localeCompare(b.name));
}

// ── CATALOG ──────────────────────────────────────────────────────────
const debouncedRenderCatalog = debounce(renderCatalog, 150);
function renderCatalog() {
  const adenda = getActiveAdenda();
  const ivaActive = adenda && adenda.ivaEnabled;
  const filtered = Object.entries(DB).reduce((acc, [cat, items]) => {
    const f = Object.entries(items).filter(([n]) => n.toLowerCase().includes(state.search.toLowerCase()) || cat.toLowerCase().includes(state.search.toLowerCase()));
    if (f.length) {acc[cat] = Object.fromEntries(f);} return acc;
  }, {});
  let h = "";
  for (const [cat, items] of Object.entries(filtered)) {
    const on = state.expandedCat === cat;
    const ec = cat.replace(/'/g, "\\'");
    h += `<button class="cat-hdr${on ? " on" : ""}" onclick="toggleCat('${ec}')">${cat}<span style="opacity:.5;font-size:1rem">${on ? "▲" : "▼"}</span></button>`;
    if (on) {for (const [name, data] of Object.entries(items)) {
      const en = name.replace(/'/g, "\\'");
      const { ivaMat, ivaLab } = calcIVA(data.matCost, data.laborCost);
      const totalDisp = data.total + ivaMat + ivaLab;
      h += `<button class="cat-item" onclick="addItem('${ec}','${en}')">
        <span class="iname">${name}</span>
        <span class="pchips">
          <span class="ptot">₲${fmt(totalDisp)}</span>
          <span class="pmat">${fmt(data.matCost)}</span>
          <span class="plab">${fmt(data.laborCost)}</span>
          ${ivaActive ? `<span class="iva-badge">IVA ₲${fmt(ivaMat + ivaLab)}</span>` : ""}
        </span>
        <span class="utag">${data.unit}</span>
        <span class="addbtn" aria-hidden="true">+</span>
      </button>`;
    }}
  }
  const el = document.getElementById("catalog"); if (el) {el.innerHTML = h;}
}
function toggleCat(c) { state.expandedCat = state.expandedCat === c ? null : c; renderCatalog(); }

// ── TOTALS RENDER ────────────────────────────────────────────────────
function renderTotals() {
  const adenda = getActiveAdenda();
  if (!adenda) {return;}
  const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const el = document.getElementById("totals-area"); if (!el) {return;}
  let h = `<div class="totals">
    <div class="tot-row"><span class="tot-lbl">Materiales</span><span class="tot-val tot-mat">₲ ${fmt(totalMats)}</span></div>
    <div class="tot-row"><span class="tot-lbl">Mano de obra</span><span class="tot-val tot-lab">₲ ${fmt(totalLabor)}</span></div>
    <div class="tot-row tot-sub"><span class="tot-lbl">Costo directo</span><span class="tot-val">₲ ${fmt(subtotal)}</span></div>`;
  if (adenda.ivaEnabled) {
    h += `<div class="tot-row"><span class="tot-lbl" style="color:var(--iva)">IVA materiales (10%)</span><span class="tot-val tot-iva">₲ ${fmt(ivaMat)}</span></div>
        <div class="tot-row"><span class="tot-lbl" style="color:var(--iva)">IVA mano de obra (5%)</span><span class="tot-val tot-iva">₲ ${fmt(ivaLab)}</span></div>
        <div class="tot-row"><span class="tot-lbl" style="color:var(--iva);font-weight:600">Total IVA</span><span class="tot-val tot-iva">₲ ${fmt(ivaTotal)}</span></div>`;
  }
  if (adenda.profitPct > 0) {h += `<div class="tot-row"><span class="tot-lbl">Honorarios (${adenda.profitPct}%)</span><span class="tot-val" style="color:var(--ok)">₲ ${fmt(profitAmt)}</span></div>`;}
  h += `<div class="tot-row tot-main"><span class="tot-lbl">TOTAL${adenda.ivaEnabled ? " (IVA inc.)" : ""}</span><span class="tot-val">₲ ${fmt(total)}</span></div>
    <div class="disc">Precios incluyen materiales y mano de obra${adenda.ivaEnabled ? ", con IVA incluido" : ""} — Válido ${state.validDays || 15} días desde la fecha de emisión</div>
  </div>`;
  el.innerHTML = h;
  updateTotalBar();
}

// ── TABLE RENDER ─────────────────────────────────────────────────────
// Configuración de fases de un presupuesto (adenda).
function getPhaseConfig(adenda) {
  if (!adenda || !Array.isArray(adenda.phases)) {return [];}
  return adenda.phases;
}

// Layout por fases: [{ id, name, items }]. Sin fases configuradas ni ítems
// asignados devuelve null (se mantiene el agrupado solo por categoría).
function getPhaseLayout(adenda) {
  if (!adenda) {return null;}
  const phases = getPhaseConfig(adenda);
  const anyAssigned = (adenda.items || []).some(i => i.phase);
  if (phases.length === 0 && !anyAssigned) {return null;}
  const groups = [];
  const map = {};
  phases.forEach(p => { map[p.id] = { id: p.id, name: p.name, items: [] }; groups.push(map[p.id]); });
  map[""] = map[""] || { id: "", name: "Etapa final / otros", items: [] };
  if (!phases.some(p => p.id === "")) {groups.push(map[""]);}
  (adenda.items || []).forEach(i => {
    const ph = phases.some(p => p.id === i.phase) ? i.phase : "";
    map[ph].items.push(i);
  });
  return groups.filter(g => g.items.length);
}

function phaseSubtotalIn(adenda, phaseId) {
  const layout = getPhaseLayout(adenda);
  if (!layout) {return 0;}
  const phases = getPhaseConfig(adenda);
  let s = 0;
  (adenda.items || []).forEach(i => {
    const ph = phases.some(p => p.id === i.phase) ? i.phase : "";
    if (ph === (phaseId || "")) {s += itemLineTotal(i, adenda.ivaEnabled);}
  });
  return s;
}

function catSubtotalIn(adenda, phaseId, cat) {
  const layout = getPhaseLayout(adenda);
  const phases = getPhaseConfig(adenda);
  let s = 0;
  (adenda.items || []).forEach(i => {
    if (i.cat !== cat) {return;}
    const inPhase = layout ? (phases.some(p => p.id === i.phase) ? i.phase : "") : "";
    if (!layout || inPhase === (phaseId || "")) {s += itemLineTotal(i, adenda.ivaEnabled);}
  });
  return s;
}

// Actualiza en vivo totales de una fila + subtotales + panel m² sin perder foco.
function applyItemTotals(id) {
  const adenda = getActiveAdenda(); if (!adenda) {return;}
  const item = adenda.items.find(x => x.id == id); if (!item) {return;}
  const ep = effPrice(item);
  const iva = adenda.ivaEnabled ? calcIVA(Number(item.matCost) || 0, Number(item.laborCost) || 0, Number(item.qty) || 0).ivaTotal : 0;
  const totalItem = ep * (Number(item.qty) || 0) + iva;
  const totEl = document.getElementById("it-tot-" + id);
  if (totEl) {totEl.textContent = "₲" + fmt(totalItem);}
  const uniEl = document.getElementById("it-uni-" + id);
  if (uniEl) {uniEl.textContent = "₲" + fmt(ep);}
  const ivaEl = document.getElementById("it-iva-" + id);
  if (ivaEl) {ivaEl.textContent = "₲" + fmt(iva);}
  document.querySelectorAll('td[data-role="catsub"]').forEach(td => {
    const ph = td.getAttribute("data-phase") || "";
    const cat = td.getAttribute("data-cat") || "";
    td.textContent = "₲" + fmt(catSubtotalIn(adenda, ph, cat));
  });
  document.querySelectorAll('td[data-role="phasesub"]').forEach(td => {
    const ph = td.getAttribute("data-phase") || "";
    td.textContent = "₲" + fmt(phaseSubtotalIn(adenda, ph));
  });
  renderM2Panel();
}

function renderM2Panel() {
  const pane = document.getElementById("m2-panel-area");
  if (!pane) {return;}
  const m2Area = getActiveProject()?.m2Area || 0;
  const totals = getTotals();
  pane.innerHTML = m2Area > 0
    ? `<div class="m2-panel">
        <div><div class="m2-val">₲ ${fmt(Math.round(totals.total / m2Area))}/m²</div><div class="m2-lbl">Costo por metro cuadrado</div></div>
        <div class="m2-ref">Sup: <span>${m2Area} m²</span></div>
        <div class="m2-ref">Total: <span>₲ ${fmt(totals.total)}</span></div>
      </div>`
    : "";
}

function setItemPhase(id, phase) {
  const adenda = getActiveAdenda();
  if (!adenda) {return;}
  const i = adenda.items.find(x => x.id == id);
  if (!i) {return;}
  i.phase = phase;
  renderTable(); save();
}

function phaseOptions(phases, current) {
  let h = '<option value=""' + (current ? "" : " selected") + '>Sin fase</option>';
  (phases || []).forEach(p => {
    h += '<option value="' + escapeHtml(p.id) + '"' + (current === p.id ? " selected" : "") + ">" + escapeHtml(p.name) + "</option>";
  });
  return h;
}

function renderTable() {
  const el = document.getElementById("table-area"); if (!el) {return;}
  const adenda = getActiveAdenda();
  if (!adenda || adenda.items.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-ico">📋</div><div>Seleccioná rubros del catálogo</div></div>`;
    const ta = document.getElementById("totals-area"); if (ta) {ta.innerHTML = "";}
    const mp = document.getElementById("m2-panel-area"); if (mp) {mp.innerHTML = "";}
    return;
  }
  const ivaEnabled = adenda.ivaEnabled;
  const colSpanFull = ivaEnabled ? 8 : 7;
  const layout = getPhaseLayout(adenda);
  const phases = getPhaseConfig(adenda);

  let h = `<div id="m2-panel-area"></div><div class="bud-hdr">
    <span style="font-size:.95rem;color:var(--tx3)">${adenda.items.length} ítem${adenda.items.length !== 1 ? "s" : ""}</span>
    <div style="flex:1"></div>
    <button class="btn sm" onclick="setSection('computo')">🧱 Ver Cómputo</button>
    <button class="btn sm" onclick="showModal('breakdown')">📊 Desglose</button>
  </div>
  <table class="tbl budget-tbl"><thead><tr><th>Descripción</th><th>U.</th><th>Cant.</th><th>Desc.%</th><th>P. Unit.</th>${ivaEnabled ? "<th style='color:var(--iva)'>IVA</th>" : ""}<th>Total</th><th></th></tr></thead><tbody>`;

  const renderCat = (cat, ci, phaseId) => {
    h += `<tr class="tbl-cat cat-row" data-cat="${escapeHtml(cat)}" data-phase="${phaseId || ""}"><td colspan="${colSpanFull}"><button type="button" class="drag-handle" data-drag-cat="1" title="Arrastrar para mover la categoría (↑↓ con el foco)" aria-label="Reordenar categoría ${escapeHtml(cat)}">⠿</button>${cat}</td></tr>`;
    let catSubtotal = 0;
    for (const item of ci) {
      const ep = effPrice(item);
      const iva = ivaEnabled ? calcIVA(Number(item.matCost) || 0, Number(item.laborCost) || 0, Number(item.qty) || 0).ivaTotal : 0;
      const totalItem = ep * (Number(item.qty) || 0) + iva;
      catSubtotal += totalItem;
      h += `<tr data-item-id="${item.id}">
        <td data-label="Item">
          <input value="${item.name.replace(/"/g, '&quot;')}" style="font-weight:600;color:var(--tx);font-size:.875rem;border:none;background:transparent;width:100%;padding:0;outline:none;" oninput="const i=getActiveAdenda().items.find(x=>x.id==${item.id});if(i){i.name=this.value;save();}">
          <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
            <span class="ichip mat">Mat ₲${fmt(item.matCost)}</span>
            <span class="ichip lab">MO ₲${fmt(item.laborCost)}</span>
            ${item.disc > 0 ? `<span class="disc-badge">-${item.disc}%</span>` : ""}
          </div>
          <textarea class="item-note-input" rows="1" placeholder="Nota interna..." oninput="const i=getActiveAdenda().items.find(x=>x.id==${item.id});if(i){i.note=this.value;save();}">${item.note || ""}</textarea>
          ${phases.length ? `<select class="ph-sel" onchange="setItemPhase(${item.id},this.value)">${phaseOptions(phases, item.phase || "")}</select>` : ""}
        </td>
        <td data-label="Unid."><span class="utag">${item.unit}</span></td>
        <td data-label="Cant."><input class="qty-in" type="number" min="0" step="0.5" value="${item.qty}" oninput="updateQty(${item.id},this.value)"></td>
        <td data-label="Desc.%"><input class="qty-in disc" type="number" min="0" max="100" step="1" value="${item.disc || 0}" oninput="updateDisc(${item.id},this.value)"></td>
        <td data-label="P. Unit." style="font-size:.875rem;color:var(--tx3)"><span id="it-uni-${item.id}">₲${fmt(ep)}</span></td>
        ${ivaEnabled ? `<td data-label="IVA" style="font-size:.95rem;color:var(--iva);font-weight:600"><span id="it-iva-${item.id}">₲${fmt(iva)}</span></td>` : ""}
        <td data-label="Total" style="font-weight:700;color:var(--acc);font-size:1rem"><span id="it-tot-${item.id}">₲${fmt(totalItem)}</span></td>
        <td data-label="" class="row-acts">
          <button type="button" class="drag-handle" data-drag-item="${item.id}" title="Arrastrar para reordenar (↑↓ con el foco)" aria-label="Reordenar ítem">⠿</button>
          ${(item.mats && item.mats.length) ? `<button class="btn sm" title="Ver cómputo de materiales de este rubro" onclick="showItemMaterials(${item.id})">🧱</button>` : ""}
          <button class="delbtn" onclick="removeItem(${item.id})">✕</button>
        </td>
      </tr>`;
    }
    h += `<tr class="tbl-subtotal subtotal-row"><td colspan="${colSpanFull - 2}" style="text-align:right">Subtotal ${cat}</td><td data-role="catsub" data-phase="${phaseId || ""}" data-cat="${escapeHtml(cat)}" style="text-align:right">₲${fmt(catSubtotal)}</td><td></td></tr>`;
  };

  if (layout) {
    for (const phase of layout) {
      h += `<tr class="tbl-phase phase-row"><td colspan="${colSpanFull}"><span class="ph-flag">FASE</span> ${escapeHtml(phase.name)}</td></tr>`;
      const cats = {};
      for (const i of phase.items) { if (!cats[i.cat]) {cats[i.cat] = [];} cats[i.cat].push(i); }
      let phaseSum = 0;
      const phaseCatTotals = [];
      for (const [cat, ci] of Object.entries(cats)) {
        renderCat(cat, ci, phase.id);
        phaseCatTotals.push(catSubtotalIn(adenda, phase.id, cat));
      }
      phaseSum = phaseCatTotals.reduce((s, v) => s + v, 0);
      h += `<tr class="tbl-phase-sub phase-subtotal-row"><td colspan="${colSpanFull - 2}" style="text-align:right">Subtotal ${escapeHtml(phase.name)}</td><td data-role="phasesub" data-phase="${phase.id}" style="text-align:right">₲${fmt(phaseSum)}</td><td></td></tr>`;
    }
  } else {
    const cats = {};
    for (const i of adenda.items) { if (!cats[i.cat]) {cats[i.cat] = [];} cats[i.cat].push(i); }
    for (const [cat, ci] of Object.entries(cats)) {renderCat(cat, ci, "");}
  }

  h += `</tbody></table>`;
  el.innerHTML = h; renderM2Panel(); renderTotals();
}

// ── REORDENAR ARRASTRANDO (presupuesto y cómputo rápido) ──────────────
// El orden del array adenda.items es el que ven la tabla, el PDF y el CSV
// (todo agrupa por categoría preservando el orden relativo). Se arrastra desde
// el asa ⠿: soltar sobre una fila = insertar antes/después (si cae en otra
// categoría, el ítem pasa a esa categoría y a la fase del destino); sobre un
// encabezado de categoría = mover esa fila a ese grupo. Con el foco en el asa,
// ↑↓ reordenan con teclado (mismo motor). Todo el drag usa pointer events:
// funciona igual con mouse y con dedo en móvil.
const _drag = { active: false, kind: null, id: null, cat: null, phase: null, handle: null, tbl: null, target: null, pid: null, x: 0, y: 0, raf: 0 };

// Fase efectiva de un ítem: la del config si es válida, si no "" (igual que
// getPhaseLayout, que agrupa los ítems con fase vieja en "Etapa final / otros").
function _ctxPhase(adenda, item) {
  const cfg = getPhaseConfig(adenda);
  return cfg.some(p => p.id === item.phase) ? (item.phase || "") : "";
}

function moveItemTo(dragId, targetItemId, side) {
  const adenda = getActiveAdenda();
  if (!adenda) {return;}
  const item = adenda.items.find(x => x.id == dragId);
  const anchor = adenda.items.find(x => x.id == targetItemId);
  if (!item || !anchor || item === anchor) {return;}
  item.cat = anchor.cat;
  const ph = _ctxPhase(adenda, anchor);
  if (ph) {item.phase = ph;} else {delete item.phase;}
  const from = adenda.items.indexOf(item);
  if (from > -1) {adenda.items.splice(from, 1);}
  let ai = adenda.items.indexOf(anchor);
  if (ai < 0) {ai = adenda.items.length - 1;}
  adenda.items.splice(ai + (side === "after" ? 1 : 0), 0, item);
  renderTable(); save();
}

function moveItemToCat(dragId, cat, phase) {
  const adenda = getActiveAdenda();
  if (!adenda || !cat) {return;}
  const item = adenda.items.find(x => x.id == dragId);
  if (!item) {return;}
  const anchor = adenda.items.find(x => x !== item && x.cat === cat && _ctxPhase(adenda, x) === (phase || ""));
  if (!anchor) {return;} // ya es el único ítem de ese grupo: nada que mover
  item.cat = cat;
  if (phase) {item.phase = phase;} else {delete item.phase;}
  const from = adenda.items.indexOf(item);
  if (from > -1) {adenda.items.splice(from, 1);}
  const ai = adenda.items.indexOf(anchor);
  adenda.items.splice(ai < 0 ? adenda.items.length : ai, 0, item);
  renderTable(); save();
}

function moveCatGroup(srcCat, srcPhase, tgtCat, tgtPhase, side) {
  const adenda = getActiveAdenda();
  if (!adenda || !srcCat || !tgtCat) {return;}
  if (srcCat === tgtCat && (srcPhase || "") === (tgtPhase || "")) {return;}
  const inSrc = (x) => x.cat === srcCat && _ctxPhase(adenda, x) === (srcPhase || "");
  const moved = adenda.items.filter(inSrc);
  if (!moved.length) {return;}
  const rest = adenda.items.filter(x => !inSrc(x));
  const dst = rest.filter(x => x.cat === tgtCat && _ctxPhase(adenda, x) === (tgtPhase || ""));
  if (!dst.length) {return;}
  const at = side === "after" ? rest.indexOf(dst[dst.length - 1]) + 1 : rest.indexOf(dst[0]);
  moved.forEach(x => {
    x.cat = tgtCat;
    if (tgtPhase) {x.phase = tgtPhase;} else {delete x.phase;}
  });
  rest.splice(at, 0, ...moved);
  adenda.items = rest;
  renderTable(); save();
}

function _dragItemBy(dragId, dir) {
  const rows = [...document.querySelectorAll("#table-area tr[data-item-id]")];
  const idx = rows.findIndex(r => r.getAttribute("data-item-id") == dragId);
  if (idx < 0 || !rows[idx + dir]) {return;}
  moveItemTo(dragId, rows[idx + dir].getAttribute("data-item-id"), dir < 0 ? "before" : "after");
  const h = document.querySelector('#table-area [data-drag-item="' + dragId + '"]');
  if (h) {h.focus();}
}

function _dragCatBy(srcCat, srcPhase, dir) {
  const rows = [...document.querySelectorAll("#table-area tr.cat-row")];
  const idx = rows.findIndex(r => (r.getAttribute("data-cat") || "") === srcCat && (r.getAttribute("data-phase") || "") === (srcPhase || ""));
  if (idx < 0 || !rows[idx + dir]) {return;}
  const t = rows[idx + dir];
  moveCatGroup(srcCat, srcPhase, t.getAttribute("data-cat") || "", t.getAttribute("data-phase") || "", dir < 0 ? "before" : "after");
  const after = document.querySelectorAll("#table-area tr.cat-row")[idx + dir];
  const h = after && after.querySelector(".drag-handle");
  if (h) {h.focus();}
}

function _dragClearIndicator() {
  if (!_drag.tbl) {return;}
  _drag.tbl.querySelectorAll(".drop-before,.drop-after,.drop-cat").forEach(tr => tr.classList.remove("drop-before", "drop-after", "drop-cat"));
}

function _dragPickTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  const tr = el && el.closest ? el.closest("tr") : null;
  _dragClearIndicator();
  if (!tr || !tr.closest || tr.closest("table") !== _drag.tbl) {_drag.target = null; return;}
  const r = tr.getBoundingClientRect();
  const side = y < r.top + r.height / 2 ? "before" : "after";

  if (_drag.kind === "cat") {
    if (!tr.classList.contains("cat-row")) {_drag.target = null; return;}
    _drag.target = { cat: tr.getAttribute("data-cat") || "", phase: tr.getAttribute("data-phase") || "", side };
    tr.classList.add(side === "before" ? "drop-before" : "drop-after");
    return;
  }
  // Arrastre de ítem: sobre un encabezado = entrar a ese grupo por el inicio.
  if (tr.classList.contains("cat-row")) {
    _drag.target = { cat: tr.getAttribute("data-cat") || "", phase: tr.getAttribute("data-phase") || "", side: "before" };
    tr.classList.add("drop-cat");
    return;
  }
  const id = tr.getAttribute("data-item-id");
  if (!id || id === String(_drag.id)) {_drag.target = null; return;}
  _drag.target = { id, side };
  tr.classList.add(side === "before" ? "drop-before" : "drop-after");
}

function _dragStep() {
  if (!_drag.active) {return;}
  // Auto-scroll al acercarse a los bordes del shell scrolleable.
  const sc = document.querySelector(".main-content");
  if (sc) {
    const r = sc.getBoundingClientRect();
    if (_drag.y < r.top + 70) {sc.scrollTop -= 16;}
    else if (_drag.y > r.bottom - 70) {sc.scrollTop += 16;}
  }
  _dragPickTarget(_drag.x, _drag.y);
}

function _dragCommit() {
  const t = _drag.target;
  if (!t) {return;}
  if (_drag.kind === "item") {
    if (t.id) {moveItemTo(_drag.id, t.id, t.side);}
    else {moveItemToCat(_drag.id, t.cat, t.phase);}
  } else if (_drag.kind === "cat") {
    moveCatGroup(_drag.cat, _drag.phase, t.cat, t.phase, t.side);
  }
}

function _dragTeardown() {
  document.removeEventListener("pointermove", _onDragMove);
  document.removeEventListener("pointerup", _onDragUp);
  document.removeEventListener("pointercancel", _onDragUp);
  if (_drag.handle && _drag.pid != null) { try {_drag.handle.releasePointerCapture(_drag.pid);} catch (e) {} }
  if (_drag.tbl) {
    _drag.tbl.querySelectorAll(".dragging,.drop-before,.drop-after,.drop-cat")
      .forEach(x => x.classList.remove("dragging", "drop-before", "drop-after", "drop-cat"));
  }
  document.body.classList.remove("drag-active");
  _drag.active = false; _drag.kind = null; _drag.id = null; _drag.cat = null; _drag.phase = null;
  _drag.handle = null; _drag.tbl = null; _drag.target = null; _drag.pid = null;
  if (_drag.raf) {cancelAnimationFrame(_drag.raf); _drag.raf = 0;}
}

function _onDragMove(e) {
  if (!_drag.active || (_drag.pid != null && e.pointerId !== _drag.pid)) {return;}
  _drag.x = e.clientX; _drag.y = e.clientY;
  if (!_drag.raf) {_drag.raf = requestAnimationFrame(() => {_drag.raf = 0; _dragStep();});}
}

function _onDragUp(e) {
  if (!_drag.active || (_drag.pid != null && e.pointerId !== _drag.pid)) {return;}
  if (e.type === "pointerup") {_dragPickTarget(_drag.x, _drag.y);}
  _dragCommit();
  _dragTeardown();
}

function _onDragPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) {return;}
  if (!e.isPrimary) {return;}
  const handle = e.target && e.target.closest ? e.target.closest("[data-drag-item],[data-drag-cat]") : null;
  if (!handle) {return;}
  const tr = handle.closest("tr");
  const tbl = tr && tr.closest("table");
  if (!tbl) {return;}
  e.preventDefault();
  _drag.active = true;
  _drag.kind = handle.hasAttribute("data-drag-item") ? "item" : "cat";
  _drag.id = handle.getAttribute("data-drag-item");
  _drag.cat = _drag.kind === "cat" ? (tr.getAttribute("data-cat") || "") : null;
  _drag.phase = _drag.kind === "cat" ? (tr.getAttribute("data-phase") || "") : null;
  _drag.handle = handle; _drag.tbl = tbl; _drag.target = null;
  _drag.pid = e.pointerId; _drag.x = e.clientX; _drag.y = e.clientY;
  tr.classList.add("dragging");
  document.body.classList.add("drag-active");
  try {handle.setPointerCapture(e.pointerId);} catch (err) {}
  document.addEventListener("pointermove", _onDragMove);
  document.addEventListener("pointerup", _onDragUp);
  document.addEventListener("pointercancel", _onDragUp);
}

document.addEventListener("pointerdown", _onDragPointerDown);
document.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {return;}
  const handle = e.target && e.target.closest ? e.target.closest("[data-drag-item],[data-drag-cat]") : null;
  if (!handle) {return;}
  e.preventDefault();
  const dir = e.key === "ArrowUp" ? -1 : 1;
  if (handle.hasAttribute("data-drag-item")) {
    _dragItemBy(handle.getAttribute("data-drag-item"), dir);
  } else {
    const tr = handle.closest("tr");
    _dragCatBy(tr.getAttribute("data-cat") || "", tr.getAttribute("data-phase") || "", dir);
  }
});

// ── BUDGET SECTION ────────────────────────────────────────────────────
function renderBudget() {
  const el = document.getElementById("budget-main-area");
  if (!el) {return;}
  const p = getActiveProject();
  if (!p) { el.innerHTML = "Seleccioná un proyecto."; return; }
  const adenda = getActiveAdenda();

  el.innerHTML = `
    <div class="adenda-bar" style="background:var(--sur2); padding:10px; border-radius:var(--rad); margin-bottom:15px; display:flex; align-items:center; gap:10px; border:1px solid var(--bor)">
        <span style="font-weight:700; font-size:0.85rem">Adenda Activa:</span>
        <select onchange="state.activeAdendaId=this.value; save(); renderBudget()">
            ${p.budgets.map(b => `<option value="${b.id}" ${b.id === adenda.id ? 'selected' : ''}>${b.name}</option>`).join("")}
        </select>
        <button class="btn sm" onclick="addAdenda()">+ Nueva Adenda</button>
    </div>

    <div class="main">
    <div class="card catalog-card catalog-col">
      <div class="srch"><span class="srch-ico">🔍</span><input placeholder="Buscar rubro..." value="${state.search.replace(/"/g, '&quot;')}" oninput="state.search=this.value;debouncedRenderCatalog()"></div>
      <div class="cat-scroll" id="catalog"></div>
    </div>
    <div class="budget-col" style="display:flex;flex-direction:column;gap:11px">
      <div class="card cfg-card">
        <button type="button" class="cfg-hdr" onclick="toggleCfgCard()">Configuración del presupuesto <span class="cfg-caret">▾</span></button>
        <div class="cfg-body">
        <div class="grid2">
          <div class="fullcol flex gap6">
            <input placeholder="Nombre de este presupuesto" value="${adenda.name.replace(/"/g, '&quot;')}" oninput="getActiveAdenda().name=this.value;save()" style="flex:1">
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--tx3);font-weight:700;text-transform:uppercase;margin-bottom:3px">Cliente (este presupuesto)</div>
            <div style="display:flex;gap:6px;align-items:center">
              <select id="bd-client-id" style="flex:1" onchange="setBudgetClient(this.value)">${clientOptionsHtml((resolveBudgetClient(p, adenda) || {}).id || "")}</select>
              <button class="btn sm" title="Agregar / gestionar clientes" onclick="openClientForm()">＋</button>
            </div>
          </div>
        </div>
        <div class="prof-row">
          <div class="prof-field">
            <label for="bd-profit">Honorarios:</label>
            <input id="bd-profit" class="sm" type="number" min="0" max="999" value="${adenda.profitPct}" style="width:52px" oninput="getActiveAdenda().profitPct=parseFloat(this.value)||0;renderTotals();save()">
            <span class="unit-lbl">%</span>
          </div>
          <div class="prof-field" style="margin-left:8px">
            <label for="bd-m2">Superficie:</label>
            <input id="bd-m2" class="sm" type="number" value="${p.m2Area||0}" style="width:70px" oninput="getActiveProject().m2Area=parseFloat(this.value)||0;renderTable();save()">
            <span class="unit-lbl">m²</span>
          </div>
        </div>
        <div class="opt-row">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <span class="toggle"><input type="checkbox" ${adenda.ivaEnabled ? "checked" : ""} onchange="getActiveAdenda().ivaEnabled=this.checked;renderTable();save()"><span class="tslider"></span></span>
            <span style="font-size:.875rem;color:var(--iva)">Incluir IVA</span>
          </label>
        </div>
        <div class="phases-row">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">
            <span style="font-size:.875rem;font-weight:600;white-space:nowrap">Fases de obra:</span>
            <div class="phase-chips" id="phase-chips">${phaseChipsHtml(adenda)}</div>
          </div>
          <div style="display:flex;gap:5px;align-items:center">
            <input id="new-phase-name" class="sm" placeholder="Nombre de la fase (ej: Instalación básica, Terminaciones)..." style="flex:1" onkeydown="if(event.key==='Enter')addPhase()">
            <button class="btn sm" onclick="addPhase()">+ Fase</button>
          </div>
        </div>
        </div>
      </div>
      <div class="card items-card">
        <div class="custom-item-row">
          <input id="ci-name" placeholder="Descripción del ítem personalizado..." style="font-size:.875rem">
          <input id="ci-price" type="number" placeholder="₲ precio" class="price sm" min="0">
          <input id="ci-unit" placeholder="und." class="unit sm" value="gl">
          <button class="btn sm primary" onclick="addCustomItem()">+ Agregar</button>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;flex-wrap:wrap">
          <button class="btn sm" onclick="newBudget()" style="margin-left:auto;background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.35);color:var(--blue)">+ Limpiar Presupuesto</button>
        </div>
        <div id="table-area"></div>
        <div id="totals-area"></div>
        <div class="mt7"><textarea placeholder="Notas / condiciones adicionales..." rows="2" style="resize:vertical;font-size:.875rem" oninput="getActiveAdenda().notes=this.value;save()">${adenda.notes || ""}</textarea></div>
      </div>
    </div>
  </div>`;
  // En móvil la configuración arranca colapsada: lo primero que se ve es el catálogo y la tabla.
  if (window.innerWidth <= 768) {
    var cfg = el.querySelector(".cfg-card");
    if (cfg) {cfg.classList.add("collapsed");}
  }
  renderCatalog(); renderTable(); updateBadge(); updateTotalBar();
}

// Toolbar del presupuesto: en móvil se pliega en un menú ⋯ (no ocupa la primera pantalla).
function toggleBudgetToolbar(ev) {
  if (ev) {ev.stopPropagation();}
  var t = document.getElementById("budget-toolbar");
  if (t) {t.classList.toggle("open");}
}
// Se cierra al tocar fuera del menú.
document.addEventListener("click", function (e) {
  var t = document.getElementById("budget-toolbar");
  if (t && !t.contains(e.target)) {t.classList.remove("open");}
  // Menús ⋯ de las tarjetas de proyecto: se cierran al tocar fuera.
  document.querySelectorAll(".proj-more[open]").forEach(function (d) {
    if (!d.contains(e.target)) {d.removeAttribute("open");}
  });
});
// Configuración del presupuesto: colapsable para que la tabla quede arriba.
function toggleCfgCard() {
  var c = document.querySelector("#budget-main-area .cfg-card, #section-computo_rapido .cfg-card");
  if (c) {c.classList.toggle("collapsed");}
}
// Barra sticky con el total siempre visible mientras se edita
// (Presupuesto y editor del Cómputo Rápido).
function updateTotalBar() {
  var bar = document.getElementById("total-bar");
  if (!bar) {return;}
  var visible = state.section === "budget" || state.section === "computo_rapido";
  var totalsEl = document.getElementById("totals-area");
  var adenda = getActiveAdenda();
  if (!visible || !totalsEl || !adenda) {bar.style.display = "none"; return;}
  var t = getTotals(adenda);
  var n = (adenda.items || []).length;
  var bits = [plural(n, "ítem", "ítems")];
  if (adenda.profitPct) {bits.push("honorarios " + adenda.profitPct + "%");}
  if (adenda.ivaEnabled) {bits.push("IVA incluido");}
  bar.innerHTML = `
    <span class="tb-meta">${bits.join(" · ")}</span>
    <span class="tb-total">₲ ${fmt(t.total)}</span>
    <button class="btn sm" onclick="var ta=document.getElementById('totals-area'); if(ta){ta.scrollIntoView({behavior:'smooth',block:'center'})}">Desglose</button>`;
  bar.style.display = "flex";
}

function phaseChipsHtml(adenda) {
  const phases = getPhaseConfig(adenda);
  if (!phases.length) {return '<span style="font-size:.8rem;color:var(--tx3)">Sin fases — dividí el presupuesto en etapas de obra.</span>';}
  return phases.map(p => `<span class="phase-chip"><span class="chp">${escapeHtml(p.name)}</span><button class="chx" onclick="removePhase('${p.id}')" title="Quitar fase">✕</button></span>`).join("");
}
function addPhase() {
  const adenda = getActiveAdenda(); if (!adenda) {return;}
  const inp = document.getElementById("new-phase-name");
  const name = (inp ? inp.value : "").trim();
  if (!name) {return toast("Ingresá un nombre para la fase", false);}
  if (!Array.isArray(adenda.phases)) {adenda.phases = [];}
  adenda.phases.push({ id: "ph" + (state.phaseIdSeq++), name: name });
  renderBudget(); save();
}
function removePhase(id) {
  const adenda = getActiveAdenda(); if (!adenda) {return;}
  if (!Array.isArray(adenda.phases)) {return;}
  adenda.phases = adenda.phases.filter(p => p.id !== id);
  (adenda.items || []).forEach(i => { if (i.phase === id) {i.phase = "";} });
  if (!adenda.phases.length) {delete adenda.phases;}
  renderBudget(); save();
}
function setBudgetClient(id) {
  const adenda = getActiveAdenda(); if (!adenda) {return;}
  adenda.clientId = id || null;
  save(); renderBudget();
}

// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═
// CÓMPUTO RÁPIDO — presupuestos sueltos, sin cliente ni ejecución
// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═
// Para armar un presupuesto en dos minutos —sin crear un proyecto ni cargar
// cliente u obreros— y después, si sirve, convertirlo en un proyecto real con
// su cliente y su propia ejecución (cronograma, obra, finanzas).
//
// Los borradores viven en state.quickBudgets: se guardan, respaldan y
// sincronizan con la nube igual que todo el state.
//
// Reuso: mientras se edita uno, getActiveProject()/getActiveAdenda() lo
// devuelven a él (override _quickProj), así el catálogo de precios, la tabla
// de ítems, los totales y hasta el cronograma por ítem funcionan tal cual. El
// wrapper solo existe en memoria y se desactiva al salir de la sección.

function getQuickBudgets() {
  if (!Array.isArray(state.quickBudgets)) {state.quickBudgets = [];}
  return state.quickBudgets;
}
function findQuickBudget(id) {
  return getQuickBudgets().find(q => q.id === id);
}

function nuevoComputoRapido() {
  const now = Date.now();
  const d = {
    id: "qk_" + now.toString(36) + Math.floor(Math.random() * 1000),
    name: "Cómputo rápido " + formatDatePY(new Date()),
    items: [], schedules: {},
    profitPct: 0, ivaEnabled: false, notes: "", clientId: null,
    createdAt: now, updatedAt: now
  };
  getQuickBudgets().push(d);
  save();
  abrirComputoRapido(d.id);
}

function abrirComputoRapido(id) {
  const d = findQuickBudget(id);
  if (!d) {return toast("No se encontró ese cómputo rápido", false);}
  if (!Array.isArray(d.items)) {d.items = [];}
  if (!d.schedules || typeof d.schedules !== "object") {d.schedules = {};}
  // budgets[0] y execution.schedules son referencias AL MISMO borrador: todo lo
  // que se edite cae en state.quickBudgets y se guarda solo.
  _quickProj = {
    id: d.id, name: d.name, quick: true,
    budgets: [d],
    execution: { schedules: d.schedules, projectStartDate: "" }
  };
  state.quickEditingId = d.id;
  renderComputoRapido();
}

function cerrarComputoRapido() {
  if (!state.quickEditingId) {return;}
  state.quickEditingId = null;
  _quickProj = null;
  save();
}

function volverAListaQuick() {
  const d = state.quickEditingId ? findQuickBudget(state.quickEditingId) : null;
  if (d) {d.updatedAt = Date.now();}
  cerrarComputoRapido();
  renderComputoRapido();
}

function limpiarComputoRapido() {
  const d = findQuickBudget(state.quickEditingId);
  if (!d) {return;}
  if ((d.items || []).length && !confirm("¿Vaciar este cómputo rápido? Se borrarán los ítems.")) {return;}
  (d.items || []).forEach(i => {
    if (_quickProj && _quickProj.execution && _quickProj.execution.schedules) {delete _quickProj.execution.schedules[i.id];}
  });
  d.items = [];
  d.schedules = {};
  if (_quickProj) {_quickProj.execution.schedules = d.schedules;}
  renderTable(); save(); toast("Cómputo vaciado ✓");
}

function borrarComputoRapido(id) {
  const d = findQuickBudget(id);
  if (!d) {return;}
  if (!confirm("¿Eliminar el cómputo rápido \"" + d.name + "\"? (" + (d.items || []).length + " ítems)")) {return;}
  if (state.quickEditingId === id) {cerrarComputoRapido();}
  state.quickBudgets = getQuickBudgets().filter(q => q.id !== id);
  save();
  renderComputoRapido();
  toast("Cómputo rápido eliminado ✓");
}

function duplicarComputoRapido(id) {
  const d = findQuickBudget(id);
  if (!d) {return;}
  const copia = JSON.parse(JSON.stringify(d));
  copia.id = "qk_" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  copia.name = (d.name || "Cómputo rápido") + " (copia)";
  copia.createdAt = Date.now();
  copia.updatedAt = Date.now();
  getQuickBudgets().push(copia);
  save();
  renderComputoRapido();
  toast("Copia creada ✓");
}

// Convertir el borrador en un proyecto real con cliente y ejecución propia.
function convertirQuickModal(id) {
  const d = findQuickBudget(id);
  if (!d) {return;}
  if (!(d.items || []).length) {return toast("Agregá al menos un ítem antes de convertirlo en proyecto", false);}
  window.modals = window.modals || {};
  window.modals.quick_to_project = function () {
    const n = d.items.length;
    return '<div class="modal-title">Convertir en proyecto<button class="delbtn" onclick="closeModal()">✕</button></div>' +
      '<div class="info-box" style="margin-bottom:12px">' +
        '<p style="margin:0"><strong>' + escapeHtml(d.name || "Sin nombre") + '</strong> · ' + n + ' ítem' + (n !== 1 ? "s" : "") + ' · ₱ ' + fmt(getTotals(d).total) + '</p>' +
        '<p style="margin:6px 0 0;font-size:.85rem;color:var(--tx3)">Se crea un proyecto nuevo con este presupuesto y su propia ejecución. El cómputo rápido pasa a la lista de Mis Proyectos.</p>' +
      '</div>' +
      '<label class="stat-lbl">Cliente del proyecto</label>' +
      '<select id="qk-client-id">' + clientOptionsHtml("") + '</select>' +
      '<input id="qk-new-client" placeholder="…o creá un cliente ahora: nombre" style="width:100%;margin-top:8px">' +
      '<div class="modal-acts">' +
        '<button class="btn" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn primary" onclick="convertirQuickAProyecto(\'' + d.id + '\')">Crear proyecto ✓</button>' +
      '</div>';
  };
  showModal("quick_to_project");
}

function convertirQuickAProyecto(id) {
  const d = findQuickBudget(id);
  if (!d) {return;}
  if (!(d.items || []).length) {
    if (document.getElementById("modal-area")) {closeModal();}
    return toast("Este cómputo no tiene ítems", false);
  }
  const nuevoNombre = String((document.getElementById("qk-new-client") || {}).value || "").trim();
  const selId = String((document.getElementById("qk-client-id") || {}).value || "");
  let cli = null;
  if (nuevoNombre) {
    cli = { id: "cli_" + Date.now().toString(36), name: nuevoNombre, phone: "", email: "", ruc: "", address: "", note: "", createdAt: Date.now() };
    getClients().push(cli);
  } else if (selId) {
    cli = getClients().find(c => c.id === selId) || null;
  }

  const nuevo = {
    id: "p_" + Date.now(),
    name: d.name || "Cómputo rápido",
    client: cli ? cli.name : "",
    clientId: cli ? cli.id : null,
    phone: cli ? (cli.phone || "") : "",
    email: cli ? (cli.email || "") : "",
    address: cli ? (cli.address || "") : "",
    ruc: cli ? (cli.ruc || "") : "",
    date: formatDatePY(new Date()),
    status: "active", archived: false, activeAdendaId: "main",
    budgets: [{
      id: "main",
      name: "Presupuesto Principal",
      items: d.items,
      profitPct: d.profitPct || 0,
      ivaEnabled: !!d.ivaEnabled,
      notes: d.notes || "",
      phases: Array.isArray(d.phases) ? JSON.parse(JSON.stringify(d.phases)) : [],
      clientId: cli ? cli.id : null
    }],
    execution: {
      schedules: d.schedules || {},   // el cronograma por ítem viene listo (pendiente)
      dailyLogs: [], materialOrders: [],
      finances: { income: [], expenses: [] },
      documents: [], aftercare: [],
      projectStartDate: "", projectEndDate: "",
      folderHandle: null, folderPath: "", folderCategories: []
    }
  };

  state.projects.push(nuevo);
  state.quickBudgets = getQuickBudgets().filter(q => q.id !== id);
  state.quickEditingId = null;
  _quickProj = null;
  state.activeProjectId = nuevo.id;
  state.activeAdendaId = "main";
  if (document.getElementById("modal-area")) {closeModal();}
  save();
  setSection("budget");
  toast(cli ? "Proyecto creado para " + cli.name + " ✓" : "Proyecto creado ✓");
  return nuevo;
}

function renderComputoRapido() {
  const el = document.getElementById("section-computo_rapido");
  if (!el) {return;}
  if (state.quickEditingId && _quickProj) {renderQuickEditor(el); return;}
  renderQuickList(el);
}

function renderQuickList(el) {
  const list = getQuickBudgets().slice().sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const cards = list.map(d => {
    const n = (d.items || []).length;
    return '<div class="card" style="margin-bottom:12px">' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:190px">' +
          '<div style="font-weight:800;font-size:1.02rem">' + escapeHtml(d.name || "Sin nombre") + '</div>' +
          '<div style="font-size:.8rem;color:var(--tx3);margin-top:3px">' + n + ' ítem' + (n !== 1 ? "s" : "") +
            ' · ' + (d.ivaEnabled ? "IVA inc." : "sin IVA") +
            (d.profitPct ? " · honorarios " + d.profitPct + "%" : "") +
            ' · modif. ' + (d.updatedAt || d.createdAt ? formatDatePY(new Date(d.updatedAt || d.createdAt)) : "—") +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;font-weight:800;color:var(--acc);font-size:1.05rem">₱ ' + fmt(getTotals(d).total) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
        '<button class="btn sm primary" style="flex:1" onclick="abrirComputoRapido(\'' + d.id + '\')">✏️ Editar</button>' +
        '<button class="btn sm" style="flex:1" onclick="convertirQuickModal(\'' + d.id + '\')">➡️ Convertir en proyecto</button>' +
        '<button class="btn sm" onclick="duplicarComputoRapido(\'' + d.id + '\')" title="Duplicar">📄</button>' +
        '<button class="btn sm danger" onclick="borrarComputoRapido(\'' + d.id + '\')" title="Eliminar">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join("");

  el.innerHTML = '<div style="max-width:900px;margin:0 auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">' +
      '<div style="flex:1;min-width:240px">' +
        '<h2 style="margin:0;font-size:1.15rem">⚡ Cómputo Rápido</h2>' +
        '<p style="color:var(--tx3);font-size:.88rem;margin:4px 0 0">Armá un presupuesto en minutos, sin cliente ni proyecto. Si sirve, convertilo en un proyecto con su propia ejecución.</p>' +
      '</div>' +
      '<button class="btn primary" onclick="nuevoComputoRapido()">+ Nuevo cómputo rápido</button>' +
    '</div>' +
    (cards || '<div class="empty"><div class="empty-ico">⚡</div><div>No hay cómputos rápidos todavía.<br>Creá uno y agregá rubros del catálogo de precios.</div></div>') +
  '</div>';
}

function renderQuickEditor(el) {
  const d = findQuickBudget(state.quickEditingId);
  if (!d) {cerrarComputoRapido(); renderQuickList(el); return;}
  const nm = String(d.name || "").replace(/"/g, '&quot;');
  const srch = String(state.search || "").replace(/"/g, '&quot;');
  el.innerHTML = '<div style="max-width:1100px;margin:0 auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
      '<div style="display:flex;gap:8px;align-items:center;flex:1;min-width:230px">' +
        '<button class="btn sm" onclick="volverAListaQuick()" title="Volver a la lista">← Volver</button>' +
        '<input value="' + nm + '" style="flex:1;font-weight:700" oninput="getActiveAdenda().name=this.value;save()">' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<span class="iva-badge" style="background:var(--sur2);color:var(--tx2)">BORRADOR · SIN CLIENTE</span>' +
        '<button class="btn sm" onclick="convertirQuickModal(\'' + d.id + '\')">➡️ Convertir en proyecto</button>' +
      '</div>' +
    '</div>' +
    '<div class="budget-col" style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="card cfg-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span style="font-size:.85rem;color:var(--tx2)">Honorarios:</span>' +
            '<input class="sm" type="number" min="0" max="999" value="' + (d.profitPct || 0) + '" style="width:60px" oninput="getActiveAdenda().profitPct=parseFloat(this.value)||0;renderTotals();save()">' +
            '<span style="font-size:.85rem;color:var(--tx2)">%</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--tx2);cursor:pointer">' +
            '<span class="toggle"><input type="checkbox" ' + (d.ivaEnabled ? "checked" : "") + ' onchange="getActiveAdenda().ivaEnabled=this.checked;renderTable();save()"><span class="tslider"></span></span>' +
            'Incluir IVA (10% mat. / 5% mano de obra)' +
          '</label>' +
          '<button class="btn sm danger" onclick="limpiarComputoRapido()">🗑️ Vaciar</button>' +
        '</div>' +
      '</div>' +
      '<div class="card catalog-col catalog-card">' +
        '<div class="srch"><span class="srch-ico">🔍</span><input placeholder="Buscar rubro..." value="' + srch + '" oninput="state.search=this.value;debouncedRenderCatalog()"></div>' +
        '<div class="cat-scroll" id="catalog"></div>' +
      '</div>' +
      '<div class="card items-card">' +
        '<div class="custom-item-row">' +
          '<input id="ci-name" placeholder="Descripción del ítem personalizado..." style="font-size:.875rem">' +
          '<input id="ci-price" type="number" placeholder="₱ precio" class="price sm" min="0">' +
          '<input id="ci-unit" placeholder="und." class="unit sm" value="gl">' +
          '<button class="btn sm primary" onclick="addCustomItem()">+ Agregar</button>' +
        '</div>' +
        '<div id="table-area"></div>' +
        '<div id="totals-area"></div>' +
        '<textarea placeholder="Notas / aclaraciones del presupuesto..." style="width:100%;margin-top:12px;min-height:60px" oninput="getActiveAdenda().notes=this.value;save()">' + escapeHtml(d.notes || "") + '</textarea>' +
      '</div>' +
    '</div>' +
  '</div>';
  renderCatalog();
  renderTable();
}

// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═// ═

// ── PRICES SECTION ────────────────────────────────────────────────────
// ── Actualización manual de precios (botón en la Base de Precios) ─────────
function preciosEstadoHtml() {
  var inst = preciosInstalados();
  var suscriptor = canUpdatePrices();
  return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.8rem;color:var(--tx3);margin:0 0 12px">' +
    '<span>📦 Precios instalados: <strong style="color:var(--tx2)">' + preciosFechaLabel(inst.fecha) + '</strong> (v' + inst.version + ')</span>' +
    (suscriptor
      ? '<span style="color:var(--ok)">✓ Suscripción activa: recibís actualizaciones</span>'
      : '<span style="color:var(--warn)">Sin suscripción PRO: los precios no se actualizan. ' +
        'Tu licencia sigue funcionando igual.</span>') +
    '</div>';
}

function chequearPrecios() {
  var av = document.getElementById("precios-aviso");
  if (!canUpdatePrices()) {
    if (av) {
      av.innerHTML = '<div class="info-box" style="border-color:var(--warn)"><p>⚠️ La actualización de precios es un beneficio del plan PRO mensual. Tu app funciona completa en local, solo que estos precios se quedan en la fecha que ves arriba.</p></div>';
    }
    toast("La actualización de precios es parte del plan PRO", false);
    return;
  }
  if (av) {av.innerHTML = '<div class="info-box"><p>Buscando precios actualizados…</p></div>';}
  checkPreciosUpdate().then(function (nuevo) {
    if (!nuevo) {
      if (av) {av.innerHTML = '<div class="info-box"><p>✓ Tus precios ya están al día.</p></div>';}
      toast("Tus precios ya están al día ✓");
      return;
    }
    var fechaTxt = preciosFechaLabel(nuevo.fecha);
    if (av) {
      av.innerHTML = '<div class="info-box" style="border-color:var(--ok)">' +
        '<p><strong>Hay precios nuevos (' + fechaTxt + ').</strong></p>' +
        '<p style="font-size:.85rem;color:var(--tx3);margin-top:4px">Se reemplaza la base oficial pero <strong>se conservan tus ediciones</strong> y tus ítems personalizados.</p>' +
        '<button class="btn sm primary" style="margin-top:8px" onclick="aplicarPreciosDesdeAviso()">Actualizar ahora</button></div>';
    }
    state._preciosPendientes = { version: nuevo.version, fecha: nuevo.fecha, db: nuevo.db };
    toast("Hay precios actualizados de " + fechaTxt, true);
  }).catch(function () {
    if (av) {av.innerHTML = '<div class="info-box"><p>No se pudo conectar. Revisá tu internet y volvé a intentar.</p></div>';}
  });
}

function aplicarPreciosDesdeAviso() {
  var p = state._preciosPendientes;
  if (!p || !p.db) {return chequearPrecios();}
  if (aplicarPreciosRemotos(p.db, p.version, p.fecha)) {
    delete state._preciosPendientes;
    toast("Precios actualizados ✓ · tus ediciones se conservaron");
    renderPrices();
  } else {
    toast("No se pudo actualizar", false);
  }
}

function renderPrices() {
  const el = document.getElementById("section-prices");
  if (!el) {return;}
  let h = `<div class="prices-wrap">
    <div class="prices-toolbar">
      <span style="font-family:var(--font-display);font-size:1.05rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em">Base de Precios</span>
      <div style="display:flex;gap:6px;margin-left:auto;align-items:center">
        <span style="font-size:.95rem;color:var(--tx3)">Ajuste global:</span>
        <input type="number" class="sm" style="width:60px" value="${state.adjustPct}" placeholder="%" oninput="state.adjustPct=parseFloat(this.value)||0" onkeydown="if(event.key==='Enter')applyGlobalAdjust()">
        <button class="btn sm primary" onclick="applyGlobalAdjust()">Aplicar</button>
        <span style="color:var(--tx3);font-size:.95rem">|</span>
        <span style="font-size:.95rem;color:var(--tx3)">Modo:</span>
        <button class="btn sm${state.priceEditMode === "total" ? " primary" : ""}" onclick="state.priceEditMode='total';renderPrices()">Total</button>
        <button class="btn sm${state.priceEditMode === "breakdown" ? " primary" : ""}" onclick="state.priceEditMode='breakdown';renderPrices()">Mat / MO</button>
        <button class="btn sm danger" onclick="if(confirm('Restaurar todos los precios a la DB original?')){restaurarPreciosLocales();renderPrices();toast('Precios restaurados');}">Restaurar</button>
        <button class="btn sm" id="btn-precios-update" onclick="chequearPrecios()" title="Buscar precios actualizados">☁️ Actualizar precios</button>
      </div>
    </div>
    <div class="info-box"><p>Los precios reflejan el mercado de la construcción en Paraguay. Podés editar cualquier precio haciendo clic sobre él. Usá el ajuste global para aplicar un porcentaje de actualización a toda la base de una sola vez.</p></div>
    ${preciosEstadoHtml()}
    <div id="precios-aviso"></div>
    <div class="pgrid">`;
  for (const [cat, items] of Object.entries(DB)) {
    h += `<div class="pcard"><span class="pcat-tag">${cat}</span>`;
    for (const [name, data] of Object.entries(items)) {
      const key = cat + "||" + name; const isEdit = state.editPriceKey === key;
      const ek = key.replace(/'/g, "\\'");
      h += `<div class="price-row"><div class="pname">${name} <span style="font-size:.875rem;color:var(--tx3)">${data.unit}</span></div><div class="pfields">`;
      if (state.priceEditMode === "breakdown") {
        if (isEdit && state.editField === "matCost") {h += `<input class="pedit" type="number" value="${data.matCost}" autofocus onblur="editPrice('${ek}','matCost',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;}
        else {h += `<span class="pchip mat" onclick="state.editPriceKey='${ek}';state.editField='matCost';renderPrices()">Mat ₲${fmt(data.matCost)}</span>`;}
        if (isEdit && state.editField === "laborCost") {h += `<input class="pedit" type="number" value="${data.laborCost}" autofocus onblur="editPrice('${ek}','laborCost',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;}
        else {h += `<span class="pchip lab" onclick="state.editPriceKey='${ek}';state.editField='laborCost';renderPrices()">MO ₲${fmt(data.laborCost)}${data.laborPct != null ? `<span class="pctbadge">${data.laborPct}%</span>` : ""}</span>`;}
        h += `<span class="pchip tot ro">= ₲${fmt(data.total)}</span>`;
      } else {
        h += `<span class="pct-pill mat">${Math.round(data.matCost / (data.total || 1) * 100)}% mat</span><span class="pct-pill lab">${Math.round(data.laborCost / (data.total || 1) * 100)}% MO</span>`;
        if (isEdit) {h += `<input class="pedit" type="number" value="${data.total}" autofocus onblur="editPrice('${ek}','total',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;}
        else {h += `<span class="pchip tot" onclick="state.editPriceKey='${ek}';state.editField='total';renderPrices()">₲${fmt(data.total)}</span>`;}
      }
      h += `</div></div>`;
    }
    h += `</div>`;
  }
  el.innerHTML = h + `</div></div>`;
}

function editPrice(key, field, val) {
  const v = parseFloat(val); if (isNaN(v) || v < 0) { state.editPriceKey = null; renderPrices(); return; }
  const sep = key.indexOf("||"); const cat = key.slice(0, sep); const name = key.slice(sep + 2);
  const item = { ...DB[cat][name] };
  if (field === "matCost") { item.matCost = v; if (item.laborPct != null) {item.laborCost = Math.round(v * item.laborPct / 100);} item.total = item.matCost + item.laborCost; }
  else if (field === "laborCost") { item.laborCost = v; item.laborPct = null; item.total = item.matCost + v; }
  else { const r = v / (item.total || 1); item.matCost = Math.round(item.matCost * r); item.laborCost = Math.round(item.laborCost * r); item.total = v; }
  DB[cat][name] = item; state.editPriceKey = null; save(); renderPrices();
}

function applyGlobalAdjust() {
  const pct = state.adjustPct;
  if (isNaN(pct) || pct === 0) { toast("Ingresá un % de ajuste", false); return; }
  const factor = 1 + pct / 100;
  for (const cat of Object.values(DB))
    {for (const item of Object.values(cat)) {
      item.matCost = Math.round(item.matCost * factor);
      item.laborCost = Math.round(item.laborCost * factor);
      item.total = item.matCost + item.laborCost;
    }}
  save(); renderPrices(); updateBadge(); toast(`Precios ajustados ${pct > 0 ? "+" : ""}${pct}% ✓`);
}

// ── THEMES SECTION ────────────────────────────────────────────────────
const THEMES = [
  { id: "dark", name: "Constructor Dark", desc: "Oscuro ámbar", prev: { bg: "#0f1117", sur: "#181c26", acc: "#f59e0b", row: "#1e2330" } },
  { id: "light", name: "Obra de Día", desc: "Claro terracota", prev: { bg: "#f4f1eb", sur: "#ffffff", acc: "#c2410c", row: "#f9f7f3" } },
  { id: "blueprint", name: "Plano Técnico", desc: "Azul blueprint", prev: { bg: "#071525", sur: "#0c1f35", acc: "#38bdf8", row: "#102846" } },
  { id: "elegant", name: "Estudio Elegante", desc: "Beige y dorado", prev: { bg: "#faf8f5", sur: "#ffffff", acc: "#8b6914", row: "#f5f2ed" } },
  { id: "neon", name: "Noche Neón", desc: "Dark ultravioleta", prev: { bg: "#050508", sur: "#0d0d14", acc: "#a855f7", row: "#12121c" } },
  { id: "forest", name: "Bosque", desc: "Verde selva oscuro", prev: { bg: "#0d1a12", sur: "#132018", acc: "#4ade80", row: "#192a1f" } },
  { id: "copper", name: "Cobre", desc: "Dark naranja cálido", prev: { bg: "#1a0f0a", sur: "#26160e", acc: "#fb923c", row: "#301c12" } },
  { id: "midnight", name: "Midnight", desc: "GitHub dark", prev: { bg: "#010409", sur: "#0d1117", acc: "#58a6ff", row: "#161b22" } },
  { id: "sand", name: "Arena", desc: "Claro cálido", prev: { bg: "#f7f3ee", sur: "#fffdf9", acc: "#b45309", row: "#f0ebe3" } },
  { id: "crimson", name: "Carmesí", desc: "Dark rojo intenso", prev: { bg: "#0f0508", sur: "#1a0a0f", acc: "#f43f5e", row: "#220e14" } },
  { id: "slate", name: "Pizarra", desc: "Claro minimalista", prev: { bg: "#f8fafc", sur: "#ffffff", acc: "#0f172a", row: "#f1f5f9" } },
  { id: "obsidian", name: "Obsidiana", desc: "Negro puro mono", prev: { bg: "#09090b", sur: "#18181b", acc: "#e4e4e7", row: "#1f1f23" } },
];

const PDF_THEMES = [
  { id: "corporate", name: "Corporativo", desc: "Azul profesional", bg: "#1e3a5f", sur: "#ffffff", acc: "#1e40af", row: "#eef2ff" },
  { id: "construction", name: "Construcción", desc: "Tierra y naranja", bg: "#7c2d12", sur: "#fffbf5", acc: "#c2410c", row: "#fef3e8" },
  { id: "minimal", name: "Minimalista", desc: "Blanco y negro", bg: "#111111", sur: "#ffffff", acc: "#111111", row: "#f5f5f5" },
  { id: "emerald", name: "Esmeralda", desc: "Verde ejecutivo", bg: "#064e3b", sur: "#f0fdf4", acc: "#059669", row: "#ecfdf5" },
  { id: "bordeaux", name: "Burdeos", desc: "Vino elegante", bg: "#4c0519", sur: "#fff1f2", acc: "#9f1239", row: "#ffe4e6" },
  { id: "slate", name: "Pizarra", desc: "Gris moderno", bg: "#1e293b", sur: "#f8fafc", acc: "#475569", row: "#f1f5f9" },
];

function renderThemes() {
  const el = document.getElementById("section-themes");
  if (!el) {return;}

  const appCards = THEMES.map(t => {
    const p = t.prev; const isActive = state.theme === t.id;
    return `<button type="button" class="theme-card${isActive ? " active" : ""}" onclick="selectTheme('${t.id}')" style="background:${p.sur};border-color:${isActive ? "var(--acc)" : "transparent"}">
      <div class="theme-preview" style="background:${p.bg}">
        <div class="theme-preview-hdr" style="background:${p.sur}"></div>
        <div class="theme-preview-body">
          <div class="theme-preview-sidebar" style="background:${p.sur}"></div>
          <div class="theme-preview-content">
            <div class="theme-preview-row" style="background:${p.row}"></div>
            <div class="theme-preview-row" style="background:${p.row}"></div>
            <div class="theme-preview-accent" style="background:${p.acc}"></div>
          </div>
        </div>
      </div>
      <div class="theme-label" style="background:${p.sur};color:${p.acc}">
        <div><div style="font-weight:700;font-size:0.95rem">${t.name}</div><div style="font-size:0.95rem;opacity:0.7;margin-top:1px">${t.desc}</div></div>
        <div class="theme-check" style="border-color:${p.acc};background:${isActive ? p.acc : "transparent"};color:${p.bg}">${isActive ? "✓" : ""}</div>
      </div>
    </button>`;
  }).join("");

  const pdfCards = PDF_THEMES.map(t => {
    const isA = state.pdfTheme === t.id;
    return `<button type="button" class="pdf-theme-card${isA ? " active" : ""}" onclick="state.pdfTheme='${t.id}';save();renderThemes();" style="background:${t.sur};border-color:${isA ? "var(--acc)" : "var(--bor)"}; padding: 10px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; width:100%; text-align:left; font-family:inherit; color:inherit">
      <div class="pdf-preview" style="background:${t.bg}; height: 60px; border-radius: 4px; position: relative; overflow: hidden; margin-bottom: 8px">
        <div style="background:${t.sur}20; height: 15px; width: 100%"></div>
        <div style="background:${t.sur}40; height: 2px; width: 70%; margin: 6px"></div>
        <div style="background:${t.sur}30; height: 2px; width: 50%; margin: 6px"></div>
        <div style="background:${t.acc}; height: 10px; width: 30%; position: absolute; bottom: 8px; right: 8px; border-radius: 2px"></div>
      </div>
      <div style="font-weight:700; font-size: 0.85rem">${t.name}</div>
      <div style="font-size: 0.75rem; opacity: 0.7">${t.desc}</div>
    </button>`;
  }).join("");

  el.innerHTML = `<div class="theme-wrap">
    <div class="sec-lbl">Interfaz de la Aplicación</div>
    <p style="font-size:.875rem;color:var(--tx3);margin-bottom:18px">Cambiá cómo se ve la herramienta mientras trabajás.</p>
    <div class="theme-grid">${appCards}</div>
    
    <div class="sec-lbl" style="margin-top:40px">Estilo de Documentos PDF</div>
    <p style="font-size:.875rem;color:var(--tx3);margin-bottom:18px">Seleccioná el diseño que verán tus clientes al exportar presupuestos y cronogramas.</p>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px">${pdfCards}</div>
  </div>`;
}
function selectTheme(id) { state.theme = id; applyTheme(id); save(); renderThemes(); toast("Tema aplicado ✓"); }

// ── EXPORT XLS ───────────────────────────────────────────────────────
function exportXLS() {
  const p = getActiveProject();
  const adenda = getActiveAdenda();
  if (!p || !adenda) {return;}

  const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const grouped = getGrouped();
  const cli = resolveBudgetClient(p, adenda);
  const csvClient = cli ? cli.name : (p.client || "-");
  const BOM = "\uFEFF", nl = "\r\n", q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csvCols = adenda.ivaEnabled ? 13 : 10;
  let csv = BOM;
  csv += q("PRESUPUESTO") + "," + q(adenda.name) + nl;
  csv += q("Proyecto") + "," + q(p.name) + nl;
  csv += q("Cliente") + "," + q(csvClient) + nl;
  csv += q("Dirección") + "," + q((cli && cli.address) || p.address || "-") + nl;
  csv += q("Fecha") + "," + q(formatDatePY(new Date())) + nl;
  csv += nl;
  const ivaHeader = adenda.ivaEnabled ? q("IVA mat (₲)") + "," + q("IVA MO (₲)") + "," + q("IVA Total (₲)") + "," : "";
  csv += q("CATEGORÍA") + "," + q("DESCRIPCIÓN") + "," + q("UNIDAD") + "," + q("CANTIDAD") + "," + q("DESC.%") + "," + q("MATERIALES (₲)") + "," + q("MANO DE OBRA (₲)") + "," + q("P. UNITARIO (₲)") + "," + ivaHeader + q("TOTAL (₲)") + "," + q("NOTA INTERNA") + nl;
  const csvItem = (cat, item) => {
    const ep = effPrice(item);
    const { ivaMat, ivaLab, ivaTotal } = calcIVA(Number(item.matCost) || 0, Number(item.laborCost) || 0, Number(item.qty) || 0);
    const totalItem = ep * (Number(item.qty) || 0) + ivaTotal;
    const ivaRow = adenda.ivaEnabled ? q(Math.round(ivaMat)) + "," + q(Math.round(ivaLab)) + "," + q(Math.round(ivaTotal)) + "," : "";
    csv += q(cat) + "," + q(item.name) + "," + q(item.unit) + "," + q(item.qty) + "," + q(item.disc || 0) + "," + q(Math.round(item.matCost)) + "," + q(Math.round(item.laborCost)) + "," + q(Math.round(ep)) + "," + ivaRow + q(Math.round(totalItem)) + "," + q(item.note || "") + nl;
  };
  const csvBlank = (label) => { const cells = [q(label)]; for (let i = 1; i < csvCols; i++) {cells.push('""');} csv += cells.join(",") + nl; };
  const layout = getPhaseLayout(adenda);
  if (layout) {
    for (const phase of layout) {
      csvBlank("FASE: " + phase.name);
      const pcat = {};
      for (const i of phase.items) { if (!pcat[i.cat]) {pcat[i.cat] = [];} pcat[i.cat].push(i); }
      for (const [cat, ci] of Object.entries(pcat)) {for (const item of ci) {csvItem(cat, item);}}
    }
  } else {
    for (const [cat, ci] of Object.entries(grouped)) {for (const item of ci) {csvItem(cat, item);}}
  }
  csv += nl;
  csv += q("RESUMEN") + nl;
  csv += q("Materiales") + ",,,,,,," + q(Math.round(totalMats)) + nl;
  csv += q("Mano de Obra") + ",,,,,,," + q(Math.round(totalLabor)) + nl;
  csv += q("Costo Directo") + ",,,,,,," + q(Math.round(subtotal)) + nl;
  if (adenda.ivaEnabled) {
    csv += q("IVA Materiales (10%)") + ",,,,,,," + q(Math.round(ivaMat)) + nl;
    csv += q("IVA Mano de Obra (5%)") + ",,,,,,," + q(Math.round(ivaLab)) + nl;
    csv += q("Total IVA") + ",,,,,,," + q(Math.round(ivaTotal)) + nl;
  }
  if ((adenda.profitPct || 0) > 0) {csv += q("Honorarios (" + adenda.profitPct + "%)") + ",,,,,,," + q(Math.round(profitAmt)) + nl;}
  csv += q("TOTAL" + (adenda.ivaEnabled ? " (IVA incluido)" : "")) + ",,,,,,," + q(Math.round(total)) + nl;
  const mats = calcMaterials();
  if (mats.length > 0) {
    csv += nl + q("CÓMPUTO DE MATERIALES") + nl;
    csv += q("MATERIAL") + "," + q("CANTIDAD") + "," + q("UNIDAD") + "," + q("BOLSAS 50kg") + nl;
    for (const m of mats) {
      const isCem = m.name.toLowerCase().includes("cemento");
      csv += q(m.name) + "," + q(fmtD(m.qty, 3)) + "," + q(m.unit) + "," + q(isCem ? Math.ceil(m.qty / 50) : "") + nl;
    }
  }
  if ((adenda.notes || "").trim()) {csv += nl + q("NOTAS") + nl + q(adenda.notes) + nl;}
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeClient = (csvClient || p.name || "Proyecto").replace(/\s+/g, "_");
  const csvFn = `Presupuesto_${String(state.budgetNum || 1).padStart(4, "0")}_${safeClient}.csv`;
  a.href = url; a.download = csvFn;
  a.click(); URL.revokeObjectURL(url);
  // Copiar a carpeta del proyecto si está vinculada
  copyExportToFolder(blob, csvFn);
  toast("Archivo exportado ✓"); closeModal();
}

// ── EXPORT FINANZAS CSV ──────────────────────────────────────────────
function exportFinancesCSV() {
  const p = getActiveProject();
  if (!p || !p.execution || !p.execution.finances) {return toast("Sin datos financieros", false);}
  const finances = p.execution.finances;
  const BOM = "\uFEFF", nl = "\r\n", q = v => `"${String(v).replace(/"/g, '""')}"`;
  let csv = BOM;
  csv += q("Fecha") + "," + q("Tipo") + "," + q("Concepto") + "," + q("Monto") + nl;
  [...(finances.income || []).map(i => ({ ...i, tipo: "Ingreso" })), ...(finances.expenses || []).map(e => ({ ...e, tipo: "Egreso" }))]
    .sort((a,b) => (a.date || "").localeCompare(b.date || "")).forEach(m => {
      csv += q(m.date) + "," + q(m.tipo) + "," + q(m.note || "") + "," + q(m.amount || 0) + nl;
    });
  csv += nl + q("Total Ingresos") + ",,," + q((finances.income || []).reduce((s, i) => s + i.amount, 0)) + nl;
  csv += q("Total Egresos") + ",,," + q((finances.expenses || []).reduce((s, e) => s + e.amount, 0)) + nl;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Finanzas_${(p.name || "proyecto").replace(/\s+/g, "_")}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast("Finanzas exportadas ✓");
}

// ── EXPORT JORNALEROS CSV ────────────────────────────────────────────
function exportJornalerosCSV() {
  if (!state.jornaleros || state.jornaleros.length === 0) {return toast("Sin jornaleros registrados", false);}
  const BOM = "\uFEFF", nl = "\r\n", q = v => `"${String(v).replace(/"/g, '""')}"`;
  let csv = BOM;
  csv += q("Nombre") + "," + q("Apellido") + "," + q("Cédula") + "," + q("Rol") + "," + q("Jornal Diario") + "," + q("Activo") + "," + q("IPS") + "," + q("Total Jornadas") + "," + q("Total Devengado") + nl;
  state.jornaleros.forEach(j => {
    const totalJornadas = (j.jornadas || []).length;
    const totalDevengado = (j.jornadas || []).reduce((s, jd) => s + (jd.monto || 0), 0);
    csv += q(j.name || "") + "," + q(j.surname || "") + "," + q(j.idNumber || "") + "," + q(j.role || "") + "," + q(j.dailyWage || "") + "," + q(j.isActive !== false ? "Si" : "No") + "," + q(j.hasIPS ? "Si" : "No") + "," + q(totalJornadas) + "," + q(totalDevengado) + nl;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Jornaleros_${todayISO()}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast("Jornaleros exportados ✓");
}

// ── EXPORT GOOGLE SHEETS (.xlsx real, OOXML) ─────────────────────────
function exportToGoogleSheets() {
  const p = getActiveProject();
  const adenda = getActiveAdenda();
  if (!p || !adenda) {return toast("Sin proyecto activo", false);}
  if (!adenda.items.length) {return toast("El presupuesto está vacío", false);}
  if (typeof XLSXWriter === 'undefined') {return toast("No se pudo cargar el generador de Excel", false);}

  toast("Generando archivo Excel...");

  const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const grouped = getGrouped();
  const ivaOn = adenda.ivaEnabled;
  const totalCols = ivaOn ? 13 : 10;
  const cli = resolveBudgetClient(p, adenda);
  const xlClient = cli ? cli.name : (p.client || '-');

  const wb = XLSXWriter.createWorkbook();
  const ws = wb.addSheet('Presupuesto', {
    cols: ivaOn
      ? [160, 280, 50, 70, 50, 110, 110, 110, 100, 100, 100, 130, 180]
      : [160, 280, 50, 70, 50, 110, 110, 110, 130, 180]
  });

  // ── HEADER del presupuesto ──
  ws.row([{ v: 'PRESUPUESTO DE OBRA', s: 'title' }, { v: adenda.name, s: 'titleVal' }], { h: 28 });
  ws.row([{ v: 'Proyecto', s: 'lbl' }, { v: p.name, s: 'val' }]);
  ws.row([{ v: 'Cliente', s: 'lbl' }, { v: xlClient, s: 'val' }]);
  ws.row([{ v: 'Dirección', s: 'lbl' }, { v: (cli && cli.address) || p.address || '-', s: 'val' }]);
  ws.row([{ v: 'Superficie', s: 'lbl' }, { v: (p.m2Area || '-') + ' m²', s: 'val' }]);
  ws.row([{ v: 'Fecha', s: 'lbl' }, { v: formatDatePY(new Date()), s: 'val' }]);
  if ((adenda.profitPct || 0) > 0)
    {ws.row([{ v: 'Honorarios', s: 'lbl' }, { v: adenda.profitPct + '%', s: 'val' }]);}
  ws.row([], { h: 8 });

  // ── ENCABEZADOS de tabla ──
  const hdr = [
    { v: 'CATEGORÍA', s: 'hdr' }, { v: 'DESCRIPCIÓN', s: 'hdr' },
    { v: 'UND', s: 'hdrC' }, { v: 'CANT.', s: 'hdrC' }, { v: 'DESC.%', s: 'hdrC' },
    { v: 'MATERIALES (Gs.)', s: 'hdrR' }, { v: 'MANO OBRA (Gs.)', s: 'hdrR' }, { v: 'P.UNIT (Gs.)', s: 'hdrR' }
  ];
  if (ivaOn) {hdr.push({ v: 'IVA Mat (Gs.)', s: 'hdrR' }, { v: 'IVA MO (Gs.)', s: 'hdrR' }, { v: 'IVA Total (Gs.)', s: 'hdrR' });}
  hdr.push({ v: 'TOTAL (Gs.)', s: 'hdrR' }, { v: 'NOTA INTERNA', s: 'hdr' });
  ws.row(hdr, { h: 24 });

  // ── ITEMS por fase/categoría ──
  const xlItems = (cat, item) => {
    const ep = effPrice(item);
    const { ivaMat: im, ivaLab: il, ivaTotal: it } = calcIVA(Number(item.matCost) || 0, Number(item.laborCost) || 0, Number(item.qty) || 0);
    const totalItem = ep * (Number(item.qty) || 0) + it;
    const cells = [
      { v: cat, s: 'd' }, { v: item.name, s: 'dBold' }, { v: item.unit, s: 'dc' },
      { v: item.qty, s: 'numC' }, { v: item.disc || 0, s: 'numC' },
      { v: Math.round(item.matCost), s: 'num' }, { v: Math.round(item.laborCost), s: 'num' }, { v: Math.round(ep), s: 'num' }
    ];
    if (ivaOn) {cells.push({ v: Math.round(im), s: 'numIva' }, { v: Math.round(il), s: 'numIva' }, { v: Math.round(it), s: 'numIva' });}
    cells.push({ v: Math.round(totalItem), s: 'numTotal' }, { v: item.note || '', s: 'dNote' });
    ws.row(cells);
  };
  const xlPhaseRow = (label) => {
    const cells = [{ v: label, s: 'phaseRow' }];
    for (let i = 1; i < totalCols; i++) {cells.push({ s: 'phaseRow' });}
    ws.row(cells, { h: 22 });
  };
  const layout = getPhaseLayout(adenda);
  if (layout) {
    for (const phase of layout) {
      xlPhaseRow('FASE: ' + phase.name);
      const pcat = {};
      for (const i of phase.items) { if (!pcat[i.cat]) {pcat[i.cat] = [];} pcat[i.cat].push(i); }
      for (const [cat, items] of Object.entries(pcat)) {
        const catCells = [{ v: cat, s: 'catRow' }];
        for (let i = 1; i < totalCols; i++) {catCells.push({ s: 'catRow' });}
        ws.row(catCells, { h: 22 });
        for (const item of items) {xlItems(cat, item);}
      }
    }
  } else {
    for (const [cat, items] of Object.entries(grouped)) {
      const catCells = [{ v: cat, s: 'catRow' }];
      for (let i = 1; i < totalCols; i++) {catCells.push({ s: 'catRow' });}
      ws.row(catCells, { h: 22 });
      for (const item of items) {xlItems(cat, item);}
    }
  }

  // ── RESUMEN ──
  ws.row([], { h: 8 });
  const sumLabelSpan = totalCols - 2;
  const sumRow = (label, val, st) => {
    const style = st || 'sumLbl';
    const cells = [{ v: label, s: style }];
    for (let i = 0; i < sumLabelSpan - 1; i++) {cells.push({ s: style });}
    cells.push({ v: Math.round(val), s: style === 'totalLbl' ? 'totalNum' : 'sumNum' });
    if (totalCols > sumLabelSpan + 1) {
      for (let i = 0; i < totalCols - (sumLabelSpan + 1); i++) {cells.push({ s: style });}
    }
    ws.row(cells, { h: 22 });
  };

  sumRow('Costo Materiales', totalMats);
  sumRow('Costo Mano de Obra', totalLabor);
  sumRow('Costo Directo (Subtotal)', subtotal);
  if (ivaOn) {
    sumRow('IVA Materiales (10%)', ivaMat, 'ivaLbl');
    sumRow('IVA Mano de Obra (5%)', ivaLab, 'ivaLbl');
    sumRow('Total IVA', ivaTotal);
  }
  if ((adenda.profitPct || 0) > 0)
    {sumRow('Honorarios Profesionales (' + adenda.profitPct + '%)', profitAmt);}
  sumRow('TOTAL GENERAL' + (ivaOn ? ' (IVA incluido)' : ''), total, 'totalLbl');

  // ── NOTAS ──
  if ((adenda.notes || '').trim()) {
    ws.row([], { h: 8 });
    const noteHdr = [{ v: 'NOTAS / CONDICIONES', s: 'catRow' }];
    for (let i = 1; i < totalCols; i++) {noteHdr.push({ s: 'catRow' });}
    ws.row(noteHdr, { h: 22 });
    const noteCells = [{ v: adenda.notes, s: 'd' }];
    for (let i = 1; i < totalCols; i++) {noteCells.push({ s: 'd' });}
    ws.row(noteCells, { h: 40 });
  }

  // ── HOJA 2: Cómputo de Materiales ──
  const mats = calcMaterials();
  const ws2 = wb.addSheet('Computo Materiales', { cols: [250, 100, 80, 100] });
  ws2.row([
    { v: 'MATERIAL', s: 'hdr' }, { v: 'CANTIDAD', s: 'hdrR' },
    { v: 'UNIDAD', s: 'hdrC' }, { v: 'BOLSAS 50kg', s: 'hdrC' }
  ], { h: 24 });
  for (const m of mats) {
    const isCem = m.name.toLowerCase().includes("cemento");
    ws2.row([
      { v: m.name, s: 'd' },
      { v: parseFloat(fmtD(m.qty, 3)), s: 'num' },
      { v: m.unit, s: 'dc' },
      isCem ? { v: Math.ceil(m.qty / 50), s: 'numC' } : { s: 'd' }
    ]);
  }

  // ── HOJA 3: Costo por m² ──
  if (p.m2Area && p.m2Area > 0) {
    const ws3 = wb.addSheet('Costo x m2', { cols: [200, 150] });
    ws3.row([{ v: 'CONCEPTO', s: 'hdr' }, { v: 'VALOR', s: 'hdrR' }], { h: 24 });
    ws3.row([{ v: 'Superficie (m²)', s: 'd' }, { v: p.m2Area, s: 'numC' }]);
    ws3.row([{ v: 'Costo Total (Gs.)', s: 'd' }, { v: Math.round(total), s: 'numTotal' }]);
    ws3.row([{ v: 'COSTO POR m² (Gs.)', s: 'totalLbl' }, { v: Math.round(total / p.m2Area), s: 'totalNum' }], { h: 24 });
  }

  const blob = wb.toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (xlClient || p.name || 'Proyecto').replace(/\s+/g, '_');
  a.href = url;
  a.download = `Presupuesto_${safe}_${formatDatePY(new Date()).replace(/\//g, '-')}.xlsx`;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  toast("✓ Excel generado. Subilo a Google Sheets para editarlo");
}

// ── PDF ────────────────────────────────────────────────────────────────
function pdfTxt(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[₲]/g, "Gs.").replace(/[—–]/g, "-").replace(/[""]/g, '"').replace(/['']/g, "'");
}

/**
 * Dibuja el logo de Puntero (sello con casco + llana) directamente en el PDF
 * usando primitivas de jsPDF. No requiere imagen externa.
 *
 * @param {jsPDF} doc      Instancia del documento
 * @param {number} cx      Centro X en mm
 * @param {number} cy      Centro Y en mm
 * @param {number} r       Radio del sello en mm (recomendado: 9-10)
 */
function drawPunteroLogo(doc, cx, cy, r) {
  // Círculo de fondo oscuro
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.circle(cx, cy, r, "F");
  // Anillo naranja
  doc.setDrawColor(245, 158, 11); // #f59e0b
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r - 0.7, "S");

  // Llana inclinada (rectángulo trapezoidal naranja, simulado con líneas)
  // Centro del logo, escalado al radio
  const s = r / 9; // factor de escala (radio 9 = tamaño base)
  doc.setFillColor(245, 158, 11);
  // Cuerpo de la llana — un trapecio inclinado -30°
  // Aproximación: dos triángulos que forman el trapecio rotado
  const cos30 = Math.cos(-Math.PI / 6);
  const sin30 = Math.sin(-Math.PI / 6);
  const rotate = (px, py) => [
    cx + (px * cos30 - py * sin30) * s,
    cy + (px * sin30 + py * cos30) * s
  ];
  // Trapecio: (-5, -0.5) (5, -0.5) (4, 3) (-4, 3)
  const p1 = rotate(-5, -0.5);
  const p2 = rotate(5, -0.5);
  const p3 = rotate(4, 3);
  const p4 = rotate(-4, 3);
  doc.triangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], "F");
  doc.triangle(p1[0], p1[1], p3[0], p3[1], p4[0], p4[1], "F");

  // Casco blanco al frente
  doc.setFillColor(255, 255, 255);
  // Visera (elipse achatada)
  doc.ellipse(cx, cy + 1.5 * s, 4.5 * s, 0.7 * s, "F");
  // Cuerpo del casco (semicírculo aproximado con triángulos)
  // Dibujo el cuerpo como un sector circular
  doc.setFillColor(255, 255, 255);
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    const a1 = Math.PI + (i / segments) * Math.PI;
    const a2 = Math.PI + ((i + 1) / segments) * Math.PI;
    const ax = cx + Math.cos(a1) * 4 * s;
    const ay = cy + 1.5 * s + Math.sin(a1) * 3 * s;
    const bx = cx + Math.cos(a2) * 4 * s;
    const by = cy + 1.5 * s + Math.sin(a2) * 3 * s;
    doc.triangle(cx, cy + 1.5 * s, ax, ay, bx, by, "F");
  }
  // Borde sutil del casco
  doc.setDrawColor(203, 213, 225); // #cbd5e1
  doc.setLineWidth(0.15);
  doc.ellipse(cx, cy + 1.5 * s, 4.5 * s, 0.7 * s, "S");

  // Reset
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
}

function generarPDF() {
  const adenda = getActiveAdenda();
  const proj = getActiveProject();
  if (!adenda || !proj) { toast("Sin proyecto activo", false); return; }
  if (adenda.items.length === 0) { toast("Agrega items primero", false); return; }
  if (typeof window.jspdf === "undefined" && typeof jsPDF === "undefined") { toast("jsPDF cargando, intentá en 2 segundos", false); return; }
  const { jsPDF: JPDF } = window.jspdf || { jsPDF: window.jsPDF };
  const doc = new JPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 14;
  const p = state.profile;
  const ivaEnabled = !!adenda.ivaEnabled;
  const validDays = state.validDays || 30;
  const budgetNum = state.budgetNum || 1;
  const projectName = proj.name || "";
  const cliPdf = resolveBudgetClient(proj, adenda);
  const clientName = cliPdf ? cliPdf.name : (proj.client || "");
  const clientAddress = (cliPdf && cliPdf.address) || proj.address || "";
  const clientPhone = (cliPdf && cliPdf.phone) || proj.phone || "";
  const clientRuc = (cliPdf && cliPdf.ruc) || "";
  const notes = adenda.notes || "";
  const { subtotal, ivaMat, ivaLab, total } = getTotals();
  const grouped = getGrouped();
  const today = new Date().toLocaleDateString("es-PY", { year: "numeric", month: "long", day: "numeric" });
  const PALETTES = {
    corporate: { hdrBg: [30, 58, 138], hdrTx: [255, 255, 255], accentBg: [30, 64, 175], accentTx: [255, 255, 255], catBg: [238, 242, 255], catTx: [30, 64, 175], bodyTx: [15, 23, 42], mutedTx: [71, 85, 105], borderC: [226, 232, 240], altRow: [248, 250, 252], totalBg: [30, 58, 138], totalTx: [255, 255, 255] },
    construction: { hdrBg: [124, 45, 18], hdrTx: [255, 251, 245], accentBg: [194, 65, 12], accentTx: [255, 255, 255], catBg: [255, 237, 213], catTx: [154, 52, 18], bodyTx: [28, 20, 10], mutedTx: [120, 80, 40], borderC: [253, 186, 116], altRow: [255, 247, 237], totalBg: [124, 45, 18], totalTx: [255, 251, 245] },
    minimal: { hdrBg: [17, 17, 17], hdrTx: [255, 255, 255], accentBg: [17, 17, 17], accentTx: [255, 255, 255], catBg: [245, 245, 245], catTx: [50, 50, 50], bodyTx: [30, 30, 30], mutedTx: [100, 100, 100], borderC: [210, 210, 210], altRow: [250, 250, 250], totalBg: [17, 17, 17], totalTx: [255, 255, 255] },
    emerald: { hdrBg: [6, 78, 59], hdrTx: [240, 253, 244], accentBg: [5, 150, 105], accentTx: [255, 255, 255], catBg: [236, 253, 245], catTx: [6, 78, 59], bodyTx: [6, 28, 21], mutedTx: [52, 105, 79], borderC: [167, 243, 208], altRow: [240, 253, 244], totalBg: [6, 78, 59], totalTx: [240, 253, 244] },
    bordeaux: { hdrBg: [76, 5, 25], hdrTx: [255, 241, 242], accentBg: [159, 18, 57], accentTx: [255, 255, 255], catBg: [255, 228, 230], catTx: [136, 19, 55], bodyTx: [30, 5, 12], mutedTx: [100, 40, 55], borderC: [252, 165, 180], altRow: [255, 241, 242], totalBg: [76, 5, 25], totalTx: [255, 241, 242] },
    slate: { hdrBg: [30, 41, 59], hdrTx: [248, 250, 252], accentBg: [71, 85, 105], accentTx: [255, 255, 255], catBg: [241, 245, 249], catTx: [51, 65, 85], bodyTx: [15, 23, 42], mutedTx: [100, 116, 139], borderC: [203, 213, 225], altRow: [248, 250, 252], totalBg: [30, 41, 59], totalTx: [248, 250, 252] },
  };
  const C = PALETTES[state.pdfTheme] || PALETTES.corporate;
  // Derivar hdrTx2 = versión más tenue del color del header (70% opacidad simulada al mezclar con hdrBg)
  C.hdrTx2 = C.hdrTx2 || [
    Math.round(C.hdrTx[0] * 0.75 + C.hdrBg[0] * 0.25),
    Math.round(C.hdrTx[1] * 0.75 + C.hdrBg[1] * 0.25),
    Math.round(C.hdrTx[2] * 0.75 + C.hdrBg[2] * 0.25),
  ];
  let y = 0;
  // ── TOP ACCENT BAR ──
  doc.setFillColor(...C.accentBg); doc.rect(0, 0, W, 1.5, "F");
  // ── HEADER ──
  doc.setFillColor(...C.hdrBg); doc.rect(0, 3, W, 36, "F");
  if (state.logoDataUrl) {
    try { doc.addImage(state.logoDataUrl, "PNG", M, 9, 24, 16); } catch (e) {
      drawPunteroLogo(doc, M + 10, 19, 9);
    }
  } else {
    drawPunteroLogo(doc, M + 10, 19, 9);
  }
  // Separación entre el logo y los datos de la empresa: con logo personalizado
  // el dibujo ocupa 24mm desde el margen, así que el texto se corrió 8mm para
  // que no quede pegado. Sin logo (puntero dibujado, ~19mm) alcanza el offset
  // original de 24.
  const tX = M + 24 + (state.logoDataUrl ? 8 : 0);
  doc.setTextColor(...C.hdrTx);
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text(pdfTxt(p.company || p.professional || "Puntero"), tX, 14);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.hdrTx2);
  const lines = [];
  if (p.professional) {lines.push(pdfTxt(p.professional + (p.matricula ? " - " + p.matricula : "")));}
  if (p.ruc) {lines.push("RUC: " + pdfTxt(p.ruc));}
  if (p.phone || p.email) {lines.push([p.phone, p.email].filter(Boolean).join("  |  "));}
  if (p.address) {lines.push(pdfTxt(p.address));}
  const social = [p.instagram, p.whatsapp, p.website].filter(Boolean).join("  |  ");
  if (social) {lines.push(pdfTxt(social));}
  lines.forEach((l, i) => doc.text(l, tX, 20 + i * 4.2));
  // Right side: document type + number
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentTx);
  doc.setFillColor(...C.accentBg);
  const labelW = 42;
  doc.roundedRect(W - M - labelW, 7, labelW, 5, 1, 1, "F");
  doc.text("PRESUPUESTO", W - M, 10.5, { align: "right" });
  doc.setTextColor(...C.hdrTx);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("N\u00BA " + String(budgetNum).padStart(4, "0"), W - M, 22, { align: "right" });
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.hdrTx2);
  doc.text(today, W - M, 28, { align: "right" });
  doc.setTextColor(...C.bodyTx);
  y = 45;
  // ── CLIENT & PROJECT CARDS ──
  const colW = (W - M * 2 - 6) / 2;
  const cardH = 27;
  // Client card
  doc.setFillColor(...C.altRow); doc.roundedRect(M, y, colW, cardH, 3, 3, "F");
  doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.roundedRect(M, y, colW, cardH, 3, 3, "S");
  doc.setFillColor(...C.accentBg); doc.roundedRect(M, y, 2, cardH, 1, 0, "F");
  doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentBg);
  doc.text("CLIENTE", M + 6, y + 6);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.bodyTx); doc.setFontSize(9);
  doc.text(pdfTxt(clientName) || "-", M + 8, y + 12, { maxWidth: colW - 14 });
  doc.setFontSize(7); doc.setTextColor(...C.mutedTx);
  const clientExtra = [];
  if (clientAddress) {clientExtra.push(clientAddress);}
  if (clientPhone) {clientExtra.push("Tel: " + clientPhone);}
  if (clientRuc) {clientExtra.push("RUC: " + clientRuc);}
  clientExtra.forEach((txt, i) => doc.text(txt, M + 8, y + 17 + i * 3.6, { maxWidth: colW - 14 }));
  // Project card
  const c2 = M + colW + 6;
  doc.setFillColor(...C.altRow); doc.roundedRect(c2, y, colW, cardH, 3, 3, "F");
  doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.roundedRect(c2, y, colW, cardH, 3, 3, "S");
  doc.setFillColor(...C.totalBg); doc.roundedRect(c2, y, 2, cardH, 1, 0, "F");
  doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentBg);
  doc.text("PROYECTO / OBRA", c2 + 6, y + 6);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.bodyTx); doc.setFontSize(9);
  doc.text(pdfTxt(projectName) || "-", c2 + 8, y + 12, { maxWidth: colW - 14 });
  doc.setFontSize(7); doc.setTextColor(...C.mutedTx);
  doc.text("Validez: " + validDays + " dias desde emision", c2 + 8, y + 17, { maxWidth: colW - 14 });
  doc.text("Adenda: " + (adenda.name || "-"), c2 + 8, y + 20.6, { maxWidth: colW - 14 });
  y += cardH + 6;
  // ── INFO STRIP ──
  const stripMsg = ivaEnabled
    ? "Precios unitarios incluyen materiales y mano de obra  |  IVA incluido (10% mat / 5% MO)  |  Valores en Guaran\u00EDes (Gs.)"
    : "Precios unitarios incluyen materiales y mano de obra  |  Valores en Guaran\u00EDes (Gs.)";
  doc.setFillColor(...C.catBg); doc.roundedRect(M, y, W - M * 2, 5, 1.5, 1.5, "F");
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.catTx);
  doc.text("  " + stripMsg, M + 3, y + 4.4);
  y += 9;
  // ── ITEMS TABLE ──
  const rows = []; let catNum = 0;
  const renderPdfCat = (cat, ci) => {
    catNum++;
    rows.push([{ content: pdfTxt(cat), colSpan: 6, styles: { fillColor: C.catBg, textColor: C.catTx, fontStyle: "bold", fontSize: 7.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 4 } } }]);
    let catSubtotal = 0; let itemNum = 0;
    for (const item of ci) {
      itemNum++;
      const { ivaTotal: ivaItem } = calcIVA(Number(item.matCost) || 0, Number(item.laborCost) || 0, Number(item.qty) || 0);
      const ep = effPrice(item);
      const totalItem = ep * (Number(item.qty) || 0) + (ivaEnabled ? ivaItem : 0);
      catSubtotal += totalItem;
      rows.push([
        { content: catNum + "." + itemNum, styles: { halign: "center", fontSize: 7.5, textColor: C.mutedTx } },
        { content: pdfTxt(item.name), styles: { fontSize: 8 } },
        { content: pdfTxt(item.unit), styles: { halign: "center", fontSize: 8 } },
        { content: String(item.qty), styles: { halign: "center", fontSize: 8 } },
        { content: "Gs. " + fmt(ep + (ivaEnabled && item.qty ? Math.round(ivaItem / item.qty) : 0)), styles: { halign: "right", fontSize: 7.5 } },
        { content: "Gs. " + fmt(totalItem), styles: { halign: "right", fontStyle: "bold", fontSize: 7.5 } },
      ]);
    }
    rows.push([
      { content: "Subtotal " + pdfTxt(cat), colSpan: 5, styles: { halign: "right", fontStyle: "bold", fontSize: 8, fillColor: C.accentBg, textColor: C.accentTx, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } } },
      { content: "Gs. " + fmt(catSubtotal), styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: C.accentBg, textColor: C.accentTx, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } } },
    ]);
    return catSubtotal;
  };
  const pdfLayout = getPhaseLayout(adenda);
  if (pdfLayout) {
    for (const phase of pdfLayout) {
      rows.push([{ content: "FASE — " + pdfTxt(phase.name), colSpan: 6, _type: "phase", styles: { fillColor: C.accentBg, textColor: C.accentTx, fontStyle: "bold", fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 5, right: 4 } } }]);
      const pcat = {};
      for (const i of phase.items) { if (!pcat[i.cat]) {pcat[i.cat] = [];} pcat[i.cat].push(i); }
      let phaseSum = 0;
      for (const [cat, ci] of Object.entries(pcat)) {phaseSum += renderPdfCat(cat, ci);}
      rows.push([
        { content: "Subtotal " + pdfTxt(phase.name), colSpan: 5, _type: "phasesub", styles: { halign: "right", fontStyle: "bold", fontSize: 8, fillColor: C.hdrBg, textColor: C.hdrTx, cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 } } },
        { content: "Gs. " + fmt(phaseSum), styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: C.hdrBg, textColor: C.hdrTx, cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 } } },
      ]);
    }
  } else {
    for (const [cat, ci] of Object.entries(grouped)) {renderPdfCat(cat, ci);}
  }
  doc.autoTable({
    startY: y,
    head: [[{ content: "#", styles: { halign: "center" } }, { content: "DESCRIPCI\u00D3N / RUBRO" }, { content: "UNID.", styles: { halign: "center" } }, { content: "CANT.", styles: { halign: "center" } }, { content: "PRECIO UNIT.", styles: { halign: "right" } }, { content: "TOTAL", styles: { halign: "right" } }]],
    body: rows, theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, lineColor: C.borderC, lineWidth: 0.2, textColor: C.bodyTx },
    headStyles: { fillColor: C.hdrBg, textColor: C.hdrTx, fontStyle: "bold", fontSize: 7, cellPadding: { top: 4.5, bottom: 4.5, left: 3, right: 3 } },
    alternateRowStyles: { fillColor: C.altRow },
    columnStyles: { 0: { cellWidth: 13, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 18, halign: "center" }, 4: { cellWidth: 35, halign: "right" }, 5: { cellWidth: 42, halign: "right" } },
    margin: { left: M, right: M },
    tableWidth: "wrap",
    didParseCell: data => {
      const raw0 = data.row.raw?.[0];
      if (raw0?._type === "phase") { data.cell.styles.fillColor = C.accentBg; data.cell.styles.textColor = C.accentTx; data.cell.styles.fontStyle = "bold"; }
      else if (raw0?._type === "phasesub") { data.cell.styles.fillColor = C.hdrBg; data.cell.styles.textColor = C.hdrTx; data.cell.styles.fontStyle = "bold"; }
      else if (raw0?.colSpan === 6) { data.cell.styles.fillColor = C.catBg; data.cell.styles.textColor = C.catTx; data.cell.styles.fontStyle = "bold"; }
      else if (raw0?.colSpan === 5) { data.cell.styles.fillColor = C.accentBg; data.cell.styles.textColor = C.accentTx; data.cell.styles.fontStyle = "bold"; }
    },
  });
  y = doc.lastAutoTable.finalY + 10;
  // ── TOTALS ──
  const totW = 120; const totX = W - M - totW;
  if (y + 50 > 275) { doc.addPage(); y = M + 10; }
  // Totals background card
  doc.setFillColor(...C.altRow); doc.roundedRect(totX - 4, y - 2, totW + 8, 38, 3, 3, "F");
  doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.roundedRect(totX - 4, y - 2, totW + 8, 38, 3, 3, "S");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
  doc.text("Subtotal materiales y mano de obra:", totX, y + 4);
  doc.setTextColor(...C.bodyTx); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(subtotal), W - M, y + 4, { align: "right" }); y += 7;
  if (ivaEnabled) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.text("IVA 10% sobre materiales:", totX, y + 4); doc.setTextColor(79, 70, 229); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(ivaMat), W - M, y + 4, { align: "right" }); y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.text("IVA 5% sobre mano de obra:", totX, y + 4); doc.setTextColor(79, 70, 229); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(ivaLab), W - M, y + 4, { align: "right" }); y += 6;
  }
  // Total separator
  doc.setDrawColor(...C.accentBg); doc.setLineWidth(0.3); doc.line(totX, y, W - M, y); y += 3;
  doc.setFillColor(...C.totalBg); doc.roundedRect(totX, y, totW, 14, 2, 2, "F");
  doc.setTextColor(...C.totalTx); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("TOTAL" + (ivaEnabled ? " (IVA inc.)" : "") + ":", totX + 5, y + 8.5);
  doc.setFontSize(11); doc.text("Gs. " + fmt(total), W - M - 3, y + 8.5, { align: "right" }); y += 22;
  // ── NOTES ──
  if (notes && notes.trim()) {
    if (y + 20 > 275) { doc.addPage(); y = M; }
    doc.setFillColor(...C.altRow); doc.roundedRect(M, y, W - M * 2, 1, 1, 1, "F");
    y += 4;
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentBg); doc.text("NOTAS Y CONDICIONES", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    const nl2 = doc.splitTextToSize(pdfTxt(notes), W - M * 2); doc.text(nl2, M, y);
    y += nl2.length * 4 + 4;
  }
  // ── SIGNATURE ──
  if (state.signDataUrl) {
    if (y + 30 > 275) { doc.addPage(); y = M + 10; }
    doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 4;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.text("Firma profesional:", M, y + 4);
    try { doc.addImage(state.signDataUrl, "PNG", M, y + 6, 50, 14); } catch (e) { }
    doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.line(M, y + 22, M + 60, y + 22);
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.bodyTx);
    doc.text(pdfTxt(p.professional || p.company || ""), M, y + 26);
    y += 30;
  }
  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.line(M, 287, W - M, 287);
    doc.text((p.company || "Puntero") + (p.ruc ? " - RUC: " + p.ruc : ""), M, 292);
    doc.text("Pagina " + i + " de " + pages, W - M, 292, { align: "right" });
  }
  const fn = "Presupuesto_" + String(budgetNum).padStart(4, "0") + "_" + (clientName || projectName || "Proyecto").replace(/\s+/g, "_") + ".pdf";
  doc.save(fn);
  // Copiar a carpeta del proyecto si está vinculada
  copyExportToFolder(doc.output('blob'), fn);
  toast("PDF generado ✓");
}

// ── MODALS ────────────────────────────────────────────────────────────
function pickClientForProject(clientId, prefix) {
  var c = getClients().find(function (x) { return x.id === clientId; });
  var nameEl = document.getElementById(prefix + "-client");
  var phoneEl = document.getElementById(prefix + "-phone");
  var addrEl = document.getElementById(prefix + "-addr");
  if (!nameEl) {return;}
  nameEl.value = c ? c.name : "";
  if (phoneEl) {phoneEl.value = c ? (c.phone || "") : "";}
  if (addrEl) {addrEl.value = c ? (c.address || "") : "";}
}

// Muestra/oculta el formulario "crear cliente nuevo" dentro del modal de proyecto.
function toggleNewClient(prefix) {
  var wrap = document.getElementById(prefix + "-nc-wrap");
  var selWrap = document.getElementById(prefix + "-client-id-wrap");
  var btn = document.getElementById(prefix + "-nc-btn");
  if (!wrap) {return;}
  var active = wrap.style.display !== "none";
  wrap.style.display = active ? "none" : "block";
  if (selWrap) {selWrap.style.display = active ? "" : "none";}
  if (btn) {btn.textContent = active ? "＋ Crear cliente nuevo" : "✕ Volver a la base";}
  if (active) {
    pickClientForProject("", prefix);
  } else {
    var f = document.getElementById(prefix + "-nc-name");
    if (f) {f.focus();}
  }
}

// Crea (o actualiza) un cliente nuevo desde el formulario y lo asigna al proyecto.
function applyNewClientToProject(p, prefix) {
  var clients = getClients();
  var read = function (id) {
    var el = document.getElementById(prefix + "-nc-" + id);
    return el ? el.value.trim() : "";
  };
  var name = read("name");
  var existing = clients.find(function (c) { return String(c.name || "").trim().toLowerCase() === name.toLowerCase(); });
  var c = existing;
  if (!c) {
    c = { id: "cli_" + Date.now().toString(36), name: name, createdAt: Date.now() };
    clients.push(c);
  }
  c.phone = read("phone");
  c.email = read("email");
  c.ruc = read("ruc");
  c.address = read("addr");
  p.clientId = c.id;
  p.client = c.name;
  p.phone = c.phone;
  p.email = c.email;
  p.address = c.address;
  p.ruc = c.ruc;
  return c;
}

function createProject() {
    const name = document.getElementById("np-name").value.trim();
    if (!name) {return toast("El nombre es obligatorio", false);}

    const newP = {
        id: 'p_' + Date.now(),
        name: name,
        client: document.getElementById("np-client").value,
        phone: document.getElementById("np-phone").value,
        address: document.getElementById("np-addr").value,
        m2Area: parseFloat(document.getElementById("np-m2").value) || 0,
        date: formatDatePY(new Date()),
        status: 'active',
        archived: false,
        activeAdendaId: 'main',
        budgets: [
            {
                id: 'main',
                name: 'Presupuesto Principal',
                items: [],
                profitPct: 0,
                ivaEnabled: false,
                notes: ""
            }
        ],
        execution: {
            schedules: {},
            dailyLogs: [],
            materialOrders: [],
            finances: { income: [], expenses: [] },
            documents: [],
            aftercare: [],
            projectStartDate: "",
            projectEndDate: "",
            folderHandle: _pendingFolderHandle || null,
            folderPath: _pendingFolderName || '',
            folderCategories: DEFAULT_FOLDER_CATEGORIES
        }
    };

    // Cliente: existente de la base de datos o nuevo creado desde el formulario.
    var ncWrap = document.getElementById("np-nc-wrap");
    var ncActive = ncWrap && ncWrap.style.display !== "none";
    var ncName = ncActive ? String(document.getElementById("np-nc-name").value || "").trim() : "";
    if (ncActive && ncName) {
      applyNewClientToProject(newP, "np");
    } else {
      var dirId = document.getElementById("np-client-id").value;
      if (dirId) {
        var dc = getClients().find(function (x) { return x.id === dirId; });
        if (dc) {
          newP.clientId = dc.id;
          newP.client = dc.name;
          newP.phone = newP.phone || dc.phone || "";
          newP.email = dc.email || "";
          newP.address = newP.address || dc.address || "";
          newP.ruc = dc.ruc || "";
        }
      }
    }

    var folderPromise = Promise.resolve();
    if (newP.execution.folderHandle) {
        folderPromise = ensureSubfolders(newP.execution.folderHandle).then(function() {
            var metadata = {
                app: "Puntero",
                version: "3.0",
                project: name,
                client: newP.client || "",
                created: new Date().toISOString(),
                categories: DEFAULT_FOLDER_CATEGORIES.map(function(c) { return c.name; })
            };
            return writeFileToFolder(newP.execution.folderHandle, 'otros', '_metadata.json', JSON.stringify(metadata, null, 2), 'application/json');
        });
    }

    folderPromise.then(function() {
state.projects.push(newP);
    state.activeProjectId = newP.id;
    state.activeAdendaId = 'main';
    _pendingFolderHandle = null;
    _pendingFolderName = '';
    if (typeof ensureClients === "function") {syncProjectClient(newP, {
      name: newP.client || "",
      phone: newP.phone || "",
      email: newP.email || "",
      address: newP.address || "",
      ruc: newP.ruc || ""
    });}
    save();
        closeModal();
        setSection('budget');
        toast(newP.execution.folderHandle ? "Proyecto creado con carpeta vinculada ✓" : "Proyecto creado ✓");
    });
}

var _pendingFolderHandle = null;
var _pendingFolderName = '';

async function selectNewProjectFolder() {
    if (!supportsFileSystemAccess()) {return;}
    try {
        var dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        _pendingFolderHandle = dirHandle;
        _pendingFolderName = dirHandle.name;
        var nameEl = document.getElementById("np-folder-name");
        var btnEl = document.getElementById("np-folder-btn");
        if (nameEl) {nameEl.innerHTML = '✅ <strong>' + escapeHtml(dirHandle.name) + '</strong>';}
        if (btnEl) {btnEl.textContent = '🔄 Cambiar carpeta';}
    } catch (e) {
        if (e.name !== 'AbortError') {
            toast("Error: " + e.message, false);
        }
    }
}

function saveEditProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) {return;}
    const name = document.getElementById("ep-name").value.trim();
    if (!name) {return toast("El nombre es obligatorio", false);}
    p.name = name;
    var ncWrap = document.getElementById("ep-nc-wrap");
    var ncActive = ncWrap && ncWrap.style.display !== "none";
    var ncName = ncActive ? String(document.getElementById("ep-nc-name").value || "").trim() : "";
    if (ncActive && ncName) {
      applyNewClientToProject(p, "ep");
    } else {
      var dirId = document.getElementById("ep-client-id").value;
      if (dirId) {
        var dc = getClients().find(function (x) { return x.id === dirId; });
        if (dc) { p.clientId = dc.id; p.client = dc.name; p.email = dc.email || ""; p.ruc = dc.ruc || ""; }
      }
      p.phone = document.getElementById("ep-phone").value;
      p.address = document.getElementById("ep-addr").value;
    }
    if (typeof ensureClients === "function") {syncProjectClient(p, {
      name: p.client || "",
      phone: p.phone || "",
      email: p.email || "",
      address: p.address || "",
      ruc: p.ruc || ""
    });}
    p.m2Area = parseFloat(document.getElementById("ep-m2").value) || 0;
    save(); closeModal(); renderProjects();
    toast("Proyecto actualizado ✓");
}

function archiveProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) {return;}
    p.archived = true;
    if (state.activeProjectId === id) {
        const next = state.projects.find(x => x.id !== id && !x.archived);
        state.activeProjectId = next ? next.id : null;
    }
    save(); renderProjects();
    toast("Proyecto archivado 📦");
}

function unarchiveProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) {return;}
    p.archived = false;
    save(); renderProjects();
    toast("Proyecto restaurado ✓");
}

function deleteProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) {return;}
    if (!confirm(`¿Eliminar el proyecto "${p.name}" permanentemente?\n\nSe borrarán todos los presupuestos, cronogramas, bitácoras, finanzas y documentos asociados.\n\nEsta acción no se puede deshacer.`)) {return;}
    if (confirm("¿Hacer una copia de seguridad antes de eliminar?")) {
        exportSingleProject(id);
    }
    state.projects = state.projects.filter(x => x.id !== id);
    if (state.activeProjectId === id) {
        const next = state.projects.find(x => !x.archived);
        state.activeProjectId = next ? next.id : null;
    }
    save(); renderProjects();
    toast("Proyecto eliminado ✕");
}

function exportSingleProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) {return;}
    const assignedConIds = new Set(
        Object.values(p.execution.schedules || {})
            .map(s => s && s.contractorId)
            .filter(Boolean)
    );
    const contractors = (state.contractors || []).filter(c => assignedConIds.has(c.id));
    const data = { project: JSON.parse(JSON.stringify(p)), contractors, profile: state.profile, exportDate: new Date().toISOString(), app: "Puntero", version: "7.0" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Backup_${(p.name || "proyecto").replace(/\s+/g, '_')}.ppy`;
    a.click();
    URL.revokeObjectURL(url);
}

function showModal(type, arg) {
  const el = document.getElementById("modal-area");
  if (!el) {return;}

  if (window.modals && typeof window.modals[type] === 'function') {
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${window.modals[type](arg)}</div></div>`;
    return;
  }

  if (type === "new_project") {
      el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px">
      <div class="modal-title">Crear Nuevo Proyecto<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="grid2">
        <div class="fullcol"><label class="stat-lbl">Nombre de la Obra</label><input id="np-name" placeholder="Ej: Residencia Martinez"></div>
        <div id="np-client-id-wrap"><label class="stat-lbl">Cliente (base de datos)</label><select id="np-client-id" onchange="pickClientForProject(this.value,'np')"><option value="">— Buscar en la base —</option>${clientOptionsHtml("")}</select></div>
        <div><label class="stat-lbl">Nombre del cliente</label><input id="np-client" placeholder="Nombre completo"></div>
        <div><label class="stat-lbl">Teléfono</label><input id="np-phone" placeholder="WhatsApp"></div>
        <div class="fullcol"><label class="stat-lbl">Ubicación / Dirección</label><input id="np-addr" placeholder="Ciudad, Barrio..."></div>
        <div><label class="stat-lbl">Superficie (m²)</label><input id="np-m2" type="number" placeholder="0"></div>
        <div class="fullcol"><button class="btn sm" id="np-nc-btn" type="button" onclick="toggleNewClient('np')">＋ Crear cliente nuevo</button></div>
        <div id="np-nc-wrap" style="display:none" class="fullcol">
          <label class="stat-lbl">Nuevo cliente</label>
          <div class="grid2" style="margin-top:4px">
            <div class="fullcol"><input id="np-nc-name" placeholder="Nombre / Razón social *"></div>
            <div><input id="np-nc-phone" placeholder="Teléfono / WhatsApp"></div>
            <div><input id="np-nc-email" placeholder="Email"></div>
            <div><input id="np-nc-ruc" placeholder="RUC / CI"></div>
            <div class="fullcol"><input id="np-nc-addr" placeholder="Dirección"></div>
          </div>
        </div>
      </div>
      <!-- [OCULTO] Selector de Carpeta del Proyecto deshabilitado temporalmente -->
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="createProject()">Crear e Iniciar 🚀</button>
      </div></div></div>`;
  }

  else if (type === "edit_project") {
      const pid = arg;
      const p = state.projects.find(x => x.id === pid);
      if (!p) {return;}
      el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px">
      <div class="modal-title">Modificar Proyecto<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="grid2">
        <div class="fullcol"><label class="stat-lbl">Nombre de la Obra</label><input id="ep-name" value="${p.name.replace(/"/g, '&quot;')}"></div>
        <div id="ep-client-id-wrap"><label class="stat-lbl">Cliente (base de datos)</label><select id="ep-client-id" onchange="pickClientForProject(this.value,'ep')">${clientOptionsHtml((resolveClient(p) || {}).id)}</select></div>
        <div><label class="stat-lbl">Nombre del cliente</label><input id="ep-client" value="${escapeHtml(p.client || '')}"></div>
        <div><label class="stat-lbl">Teléfono</label><input id="ep-phone" value="${escapeHtml(p.phone || '')}"></div>
        <div class="fullcol"><label class="stat-lbl">Ubicación / Dirección</label><input id="ep-addr" value="${escapeHtml(p.address || '')}"></div>
        <div><label class="stat-lbl">Superficie (m²)</label><input id="ep-m2" type="number" value="${p.m2Area || 0}"></div>
        <div class="fullcol"><button class="btn sm" id="ep-nc-btn" type="button" onclick="toggleNewClient('ep')">＋ Crear cliente nuevo</button></div>
        <div id="ep-nc-wrap" style="display:none" class="fullcol">
          <label class="stat-lbl">Nuevo cliente</label>
          <div class="grid2" style="margin-top:4px">
            <div class="fullcol"><input id="ep-nc-name" placeholder="Nombre / Razón social *"></div>
            <div><input id="ep-nc-phone" placeholder="Teléfono / WhatsApp"></div>
            <div><input id="ep-nc-email" placeholder="Email"></div>
            <div><input id="ep-nc-ruc" placeholder="RUC / CI"></div>
            <div class="fullcol"><input id="ep-nc-addr" placeholder="Dirección"></div>
          </div>
        </div>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveEditProject('${pid}')">Guardar Cambios 💾</button>
      </div></div></div>`;
  }

  else if (type === "load_version") {
    const p = getActiveProject();
    const versions = (p && p.versions) || [];
    const rows = versions.map(v => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--bor)">
            <div>
                <div style="font-weight:700">${v.name}</div>
                <div style="font-size:0.75rem; color:var(--tx3)">${formatDatePY(v.date)} - ${v.items?.length || 0} ítems</div>
            </div>
            <div style="display:flex; gap:5px">
                <button class="btn sm" onclick="loadVersion('${v.id}')">📂 Cargar</button>
                <button class="btn sm danger" onclick="deleteVersion('${v.id}'); showModal('load_version')">✕</button>
            </div>
        </div>
    `).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
            <div class="modal-title">Historial de Versiones<button class="delbtn" onclick="closeModal()">✕</button></div>
            <div style="max-height:400px; overflow-y:auto">
                ${rows || '<p style="text-align:center; padding:20px; color:var(--tx3)">No hay versiones guardadas.</p>'}
            </div>
        </div></div>`;
    return;
  }

  if (type === "export") {
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:480px">
      <div class="modal-title">Exportar Presupuesto<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="export-options">
        <button type="button" class="export-card" onclick="exportXLS()" style="width:100%;font-family:inherit;font-size:inherit;color:inherit"><div class="export-icon">📊</div><div class="export-name">Excel / CSV</div><div class="export-desc">Abre con doble clic en Excel o LibreOffice</div></button>
        <button type="button" class="export-card" onclick="exportToGoogleSheets()" style="width:100%;font-family:inherit;font-size:inherit;color:inherit"><div class="export-icon">📋</div><div class="export-name">Google Sheets</div><div class="export-desc">Archivo → Abrir → Subir en Google Sheets</div></button>
      </div>
      <p style="font-size:.95rem;color:var(--tx3);text-align:center;font-style:italic">Incluye ítems, desglose mat/MO, cómputo de materiales y notas.</p>
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn success" onclick="exportXLS()">Descargar</button></div>
    </div></div>`;
  }

  else if (type === "export_project") {
    const proj = getActiveProject();
    const projName = proj ? proj.name : "el proyecto activo";
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:440px">
      <div class="modal-title">🚀 Enviar Proyecto a un Colega<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div style="text-align:center; padding:10px 0">
        <div style="font-size:3rem; margin-bottom:10px">📦</div>
        <p style="font-size:1rem; color:var(--tx2); margin-bottom:14px">Se generará un archivo <strong>.ppy</strong> con toda la información de <strong>${projName}</strong>.</p>
        <div style="background:rgba(var(--acc-rgb), 0.05); padding:12px; border-radius:var(--rad); text-align:left; font-size:0.875rem; color:var(--tx2); margin-bottom:16px">
          <strong>¿Qué incluye este archivo?</strong><br>
          ✅ Presupuesto completo y todas las adendas<br>
          ✅ Cronograma y estados de obra<br>
          ✅ Bitácora, finanzas y materiales<br>
          ✅ Contratistas asignados a este proyecto<br>
          ✅ Notas, honorarios e IVA
        </div>
        <p style="font-size:0.875rem; color:var(--tx3)">Tu colega solo tiene que arrastrar este archivo a su instancia de Puntero para ver todo.</p>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn sm" onclick="importProject()">📥 Importar Proyecto</button>
        <button class="btn primary" onclick="exportProject()">Exportar y Enviar 📤</button>
      </div>
    </div></div>`;
  }

  else if (type === "computo") {
    const mats = calcMaterials();
    const cards = mats.length === 0 ? `<p style="font-size:1rem;color:var(--tx3)">Agregá ítems al presupuesto.</p>` : `<div class="mat-grid">` +
      mats.map(m => {
        const isCem = m.name.toLowerCase().includes("cemento");
        const bolsas = isCem ? Math.ceil(m.qty / 50) : null;
        const qty = Number.isInteger(m.qty) ? m.qty : fmtD(m.qty, 2);
        return `<div class="mat-card"><div class="mat-name">${m.name}</div><div class="mat-qty"><strong>${qty}</strong> ${m.unit}</div>${bolsas ? `<div class="mat-bags">≈ ${bolsas} bolsa${bolsas !== 1 ? "s" : ""} de 50kg</div>` : ""}</div>`;
      }).join("") + `</div>`;
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:740px">
      <div class="modal-title">🧱 Cómputo de Materiales<button class="delbtn" onclick="closeModal()">✕</button></div>
      <p class="mat-note">Cantidades totales agrupadas por material. Uso interno — no aparece en el PDF del cliente.</p>
      ${cards}
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cerrar</button></div>
    </div></div>`;
  }

  else if (type === "breakdown") {
    const bkAdenda = getActiveAdenda();
    const bkIva = bkAdenda && bkAdenda.ivaEnabled;
    const bkProfit = bkAdenda ? (bkAdenda.profitPct || 0) : 0;
    const bk = getBreakdown(); const { totalMats, totalLabor, subtotal, ivaTotal, profitAmt, total } = getTotals();
    const rows = bk.map(r => `<tr class="bk-row"><td>${r.cat}</td><td style="color:var(--mat);font-weight:600">₲ ${fmt(r.matCost)}</td><td style="color:var(--lab);font-weight:600">₲ ${fmt(r.laborCost)}</td><td class="bk-subtotal">₲ ${fmt(r.total)}</td></tr>`).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
      <div class="modal-title">📊 Desglose Mat / MO<button class="delbtn" onclick="closeModal()">✕</button></div>
      <table class="bk-tbl"><thead><tr><th>Categoría</th><th>Materiales</th><th>Mano de Obra</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="bk-footer">
        <div class="tot-row"><span class="tot-lbl" style="color:var(--mat);font-weight:600">Total Materiales</span><span class="tot-val tot-mat">₲ ${fmt(totalMats)}</span></div>
        <div class="tot-row"><span class="tot-lbl" style="color:var(--lab);font-weight:600">Total Mano de Obra</span><span class="tot-val tot-lab">₲ ${fmt(totalLabor)}</span></div>
        <div class="tot-row" style="padding-top:6px;margin-top:4px;border-top:1px solid var(--bor)"><span class="tot-lbl">Costo directo</span><span class="tot-val">₲ ${fmt(subtotal)}</span></div>
        ${bkIva ? `<div class="tot-row"><span class="tot-lbl" style="color:var(--iva)">IVA mat (10%) + MO (5%)</span><span class="tot-val tot-iva">₲ ${fmt(ivaTotal)}</span></div>` : ""}
        ${bkProfit > 0 ? `<div class="tot-row"><span class="tot-lbl" style="color:var(--ok)">Honorarios (${bkProfit}%)</span><span class="tot-val" style="color:var(--ok)">₲ ${fmt(profitAmt)}</span></div>` : ""}
        <div class="tot-row tot-main"><span class="tot-lbl">TOTAL${bkIva ? " (IVA inc.)" : ""}</span><span class="tot-val">₲ ${fmt(total)}</span></div>
        ${subtotal > 0 ? `<div style="display:flex;gap:14px;padding-top:7px;border-top:1px solid var(--bor);margin-top:7px">
          <span style="font-size:.95rem;color:var(--tx3)">Mat: <strong style="color:var(--mat)">${Math.round(totalMats / subtotal * 100)}%</strong></span>
          <span style="font-size:.95rem;color:var(--tx3)">MO: <strong style="color:var(--lab)">${Math.round(totalLabor / subtotal * 100)}%</strong></span>
          ${bkIva && total > 0 ? `<span style="font-size:.95rem;color:var(--tx3)">IVA: <strong style="color:var(--iva)">${Math.round(ivaTotal / total * 100)}%</strong></span>` : ""}
        </div>` : ""}
      </div>
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cerrar</button></div>
    </div></div>`;
  }

  else if (type === "save") {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
      <div class="modal-title">Guardar Presupuesto</div>
      <p style="font-size:1rem;color:var(--tx2);margin-bottom:12px"><strong>${p.name}</strong><br>Adenda: <strong>${adenda.name}</strong> — ${adenda.items.length} ítems — Total: <strong style="color:var(--acc)">${fmt(getTotals().total)}</strong></p>
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="closeModal();saveVersion()">Guardar</button></div>
    </div></div>`;
  }

  else if (type === "load") {
    const p = getActiveProject();
    const versions = (p && p.versions) || [];
    const rows = versions.length === 0
      ? `<p style="font-size:1rem;color:var(--tx3)">No hay versiones guardadas. Usá "Guardar" arriba para crear una.</p>`
      : versions.map(v => `<div class="modal-row"><div style="flex:1"><div class="modal-name">${v.name}</div><div class="modal-meta">${formatDatePY(v.date)} · ${v.items?.length || 0} ítems</div></div><button class="btn sm" onclick="loadVersion('${v.id}')">📂 Cargar</button><button class="btn sm danger" onclick="deleteVersion('${v.id}');showModal('load')">✕</button></div>`).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
      <div class="modal-title">Historial de Versiones<button class="delbtn" onclick="closeModal()">✕</button></div>
      ${rows}<div class="modal-acts"><button class="btn" onclick="closeModal()">Cerrar</button></div>
    </div></div>`;
  }

  else if (type === "signature") {
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:420px">
      <div class="modal-title">Firma Digital<button class="delbtn" onclick="closeModal()">✕</button></div>
      <p style="font-size:.875rem;color:var(--tx3);margin-bottom:10px">Dibujá tu firma. Aparecerá en el PDF al pie del presupuesto.</p>
      <canvas id="sign-canvas" class="sign-canvas" width="500" height="120"></canvas>
      <div class="sign-actions">
        <button class="btn sm danger" onclick="clearSignature()">Borrar</button>
        <button class="btn sm primary" onclick="saveSignature()">Guardar firma</button>
      </div>
      ${state.signDataUrl ? `<div style="margin-top:10px"><div style="font-size:.875rem;color:var(--tx3);margin-bottom:4px">Firma guardada:</div><img src="${state.signDataUrl}" style="border:1px solid var(--bor);border-radius:var(--rad);background:#fff;padding:4px;max-width:100%;height:50px;object-fit:contain"></div>` : ''}
    </div></div>`;
    initSignatureCanvas();
  }

  else if (type === "profile") {
    const p = state.profile;
    const pdfThemes = [
      { id: "corporate", name: "Corporativo", desc: "Azul profesional", bg: "#1e3a5f", sur: "#ffffff", acc: "#1e40af", row: "#eef2ff" },
      { id: "construction", name: "Construcción", desc: "Tierra y naranja", bg: "#7c2d12", sur: "#fffbf5", acc: "#c2410c", row: "#fef3e8" },
      { id: "minimal", name: "Minimalista", desc: "Blanco y negro", bg: "#111111", sur: "#ffffff", acc: "#111111", row: "#f5f5f5" },
      { id: "emerald", name: "Esmeralda", desc: "Verde ejecutivo", bg: "#064e3b", sur: "#f0fdf4", acc: "#059669", row: "#ecfdf5" },
      { id: "bordeaux", name: "Burdeos", desc: "Vino elegante", bg: "#4c0519", sur: "#fff1f2", acc: "#9f1239", row: "#ffe4e6" },
      { id: "slate", name: "Pizarra", desc: "Gris moderno", bg: "#1e293b", sur: "#f8fafc", acc: "#475569", row: "#f1f5f9" },
    ];
    const pdfCards = pdfThemes.map(t => {
      const isA = state.pdfTheme === t.id;
      return `<button type="button" class="pdf-theme-card${isA ? " active" : ""}" onclick="state.pdfTheme='${t.id}';save();this.closest('.modal').querySelectorAll('.pdf-theme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')" style="background:${t.sur};border-color:${isA ? "var(--acc)" : "var(--bor)"};width:100%;text-align:left;font-family:inherit;color:inherit">
        <div class="pdf-preview" style="background:${t.bg}">
          <div class="pdf-preview-hdr" style="background:${t.sur}20"></div>
          <div class="pdf-preview-row" style="background:${t.sur}40"></div>
          <div class="pdf-preview-row short" style="background:${t.sur}30"></div>
          <div class="pdf-preview-accent" style="background:${t.acc}"></div>
        </div>
        <div class="pdf-theme-lbl" style="background:${t.sur};color:${t.acc}">
          <div><div style="font-weight:700">${t.name}</div><div style="font-size:1rem;opacity:.7">${t.desc}</div></div>
          <div style="width:13px;height:13px;border-radius:50%;border:2px solid ${t.acc};background:${isA ? t.acc : "transparent"};display:flex;align-items:center;justify-content:center;font-size:.875rem;color:#fff">${isA ? "✓" : ""}</div>
        </div>
      </button>`;
    }).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px">
      <div class="modal-title">Perfil del Profesional<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="two-col">
        <div><div class="slbl">Empresa / Estudio</div><input id="p-company" value="${(p.company || "").replace(/"/g, '&quot;')}" placeholder="Nombre empresa" class="mb7"></div>
        <div><div class="slbl">Profesional</div><input id="p-prof" value="${(p.professional || "").replace(/"/g, '&quot;')}" placeholder="Arq. / Ing. Nombre Apellido" class="mb7"></div>
      </div>
      <div class="two-col">
        <div><div class="slbl">Matrícula</div><input id="p-mat" value="${(p.matricula || "").replace(/"/g, '&quot;')}" placeholder="CAP Nº 0000" class="mb7"></div>
        <div><div class="slbl">RUC</div><input id="p-ruc" value="${(p.ruc || "").replace(/"/g, '&quot;')}" placeholder="00000000-0" class="mb7"></div>
      </div>
      <div class="two-col">
        <div><div class="slbl">Teléfono</div><div style="display:flex;gap:4px"><input id="p-phone" value="${(p.phone || "").replace(/"/g, '&quot;')}" placeholder="Teléfono" class="mb7" style="flex:1">${p.phone ? `<button class="btn sm" onclick="window.open(waLink('${p.phone.replace(/'/g, "\\'")}'), '_blank')" style="padding:0 8px;background:#25D366;color:white;border:none;margin-bottom:7px" title="WhatsApp">💬</button>` : ''}</div></div>
        <div><div class="slbl">Email</div><input id="p-email" value="${(p.email || "").replace(/"/g, '&quot;')}" placeholder="Email" class="mb7"></div>
      </div>
      <div class="slbl">Dirección del estudio</div>
      <input id="p-address" value="${(p.address || "").replace(/"/g, '&quot;')}" placeholder="Dirección del estudio" class="mb7">
      <div class="slbl">Redes Sociales</div>
      <div class="two-col">
        <div><div class="slbl" style="margin-top:0">Instagram</div><input id="p-ig" value="${(p.instagram || "").replace(/"/g, '&quot;')}" placeholder="@usuario" class="mb7"></div>
        <div><div class="slbl" style="margin-top:0">WhatsApp</div><div style="display:flex;gap:4px"><input id="p-wa" value="${(p.whatsapp || "").replace(/"/g, '&quot;')}" placeholder="+595 9XX XXXXXX" class="mb7" style="flex:1">${p.whatsapp ? `<button class="btn sm" onclick="window.open(waLink('${p.whatsapp.replace(/'/g, "\\'")}'), '_blank')" style="padding:0 8px;background:#25D366;color:white;border:none;margin-bottom:7px" title="Probar link">💬</button>` : ''}</div></div>
      </div>
      <div class="slbl">Sitio web</div>
      <input id="p-web" value="${(p.website || "").replace(/"/g, '&quot;')}" placeholder="www.tuestudio.com.py" class="mb7">
      <div class="slbl">Logo del Estudio (aparece en el PDF)</div>
      <button type="button" class="logo-upload-area" onclick="document.getElementById('logo-file-input').click()" style="width:100%;font-family:inherit;font-size:inherit;color:inherit">
        ${state.logoDataUrl ? `<img src="${state.logoDataUrl}" class="logo-preview" alt="Logo">` : '<div class="logo-placeholder">📷 Hacé clic para subir tu logo<br><span style="font-size:.75rem">PNG, JPG — recomendado 300x100px</span></div>'}
      </button>
      <input type="file" id="logo-file-input" accept="image/*" style="display:none" onchange="uploadLogo(this)">
      ${state.logoDataUrl ? `<button class="btn sm danger" onclick="state.logoDataUrl='';save();showModal('profile')" style="margin-bottom:12px">✕ Quitar logo</button>` : ''}
      <div class="slbl">Tema del PDF</div>
      <div class="pdf-theme-grid">${pdfCards}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--bor)">
        <button class="btn sm" onclick="showModal('signature')">✍️ Firma digital</button>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="doSaveProfile()">Guardar Perfil</button>
      </div>
    </div></div>`;
  }

  // Activar gestos de swipe-to-close en mobile (después de render)
  setTimeout(attachModalSwipeGestures, 0);
  // Bloquear scroll del body cuando hay modal
  document.body.style.overflow = 'hidden';
}

function closeModal() { document.getElementById("modal-area").innerHTML = ""; document.body.style.overflow = ''; }

// ── Gesture: deslizar modal hacia abajo para cerrar (mobile) ───────────────
let _modalDragStart = 0;
let _modalDragCurrent = 0;
let _modalElement = null;
function attachModalSwipeGestures() {
  const modal = document.querySelector('#modal-area .modal');
  if (!modal || window.innerWidth > 768) {return;}

  modal.addEventListener('touchstart', e => {
    // Solo iniciar swipe si toca el área superior (los primeros 60px = la "agarradera")
    const rect = modal.getBoundingClientRect();
    const y = e.touches[0].clientY;
    if (y - rect.top > 60) {return;}
    _modalDragStart = y;
    _modalDragCurrent = y;
    _modalElement = modal;
    modal.style.transition = 'none';
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    if (!_modalElement) {return;}
    _modalDragCurrent = e.touches[0].clientY;
    const delta = _modalDragCurrent - _modalDragStart;
    if (delta > 0) {
      _modalElement.style.transform = `translateY(${delta}px)`;
    }
  }, { passive: true });

  modal.addEventListener('touchend', () => {
    if (!_modalElement) {return;}
    const delta = _modalDragCurrent - _modalDragStart;
    _modalElement.style.transition = 'transform 0.25s ease';
    if (delta > 100) {
      // Cerrar
      _modalElement.style.transform = 'translateY(100%)';
      setTimeout(closeModal, 220);
    } else {
      _modalElement.style.transform = '';
    }
    _modalElement = null;
    _modalDragStart = 0;
    _modalDragCurrent = 0;
  });
}
function exportDB() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "puntero_db.json"; a.click(); URL.revokeObjectURL(url);
  toast("DB exportada ✓");
}

function exportProject() {
  const proj = getActiveProject();
  if (!proj) {return toast("Sin proyecto activo", false);}

  // Solo incluir contratistas asignados a este proyecto
  const assignedConIds = new Set(
    Object.values(proj.execution.schedules || {})
      .map(s => s && s.contractorId)
      .filter(Boolean)
  );
  const contractors = (state.contractors || []).filter(c => assignedConIds.has(c.id));

  const project = {
    project: proj,                  // estructura completa del proyecto (budgets, execution, etc.)
    contractors,
    profile: state.profile,
    exportDate: new Date().toISOString(),
    app: "Puntero",
    version: "7.0"
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Proyecto_${(proj.name || "proyecto").replace(/\s+/g, '_')}.ppy`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Proyecto exportado (.ppy) ✓");
  closeModal();
}

function importProject() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".ppy,.json";
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) {return;}
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const validApps = ["Puntero", "PresupuestadorPY"]; // retrocompatibilidad con .ppy viejos
        if (!validApps.includes(data.app) && !confirm("El archivo no parece ser un proyecto oficial. ¿Intentar importar de todos modos?")) {return;}

        // Soporte para formato nuevo (v7) y legacy (v5)
        let newProject;
        if (data.project && data.project.budgets) {
          // Formato v7
          newProject = JSON.parse(JSON.stringify(data.project));
          newProject.id = 'p_' + Date.now(); // evitar colisión
          newProject.name = newProject.name + ' (importado)';
        } else {
          // Formato legacy v5: convertir items planos en proyecto
          newProject = {
            id: 'p_' + Date.now(),
            name: (data.projectName || "Proyecto Importado") + ' (importado)',
            client: data.clientName || "",
            phone: data.clientPhone || "",
            address: data.clientAddress || "",
            date: formatDatePY(new Date()),
            status: 'active',
            activeAdendaId: 'main',
            budgets: [{
              id: 'main',
              name: 'Presupuesto Principal',
              items: data.items || [],
              profitPct: data.profitPct || 0,
              ivaEnabled: !!data.ivaEnabled,
              notes: data.notes || ""
            }],
            execution: {
              schedules: data.schedules || {},
              dailyLogs: [],
              materialOrders: [],
              finances: { income: [], expenses: [] },
              documents: [],
              aftercare: [],
              projectStartDate: "",
              projectEndDate: ""
            }
          };
        }

        state.projects.push(newProject);
        state.activeProjectId = newProject.id;
        state.activeAdendaId = newProject.budgets[0].id;

        // Combinar contratistas sin duplicar
        if (data.contractors && Array.isArray(data.contractors)) {
          data.contractors.forEach(c => {
            if (!state.contractors.find(ex => ex.id === c.id)) {state.contractors.push(c);}
          });
        }

        save();
        closeModal();
        setSection('budget');
        toast("Proyecto importado con éxito ✓");
      } catch (err) {
        toast("Error al importar proyecto: " + err.message, false);
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function importDB() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json";
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) {return;}
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (typeof d !== "object" || !Object.values(d)[0]) {throw new Error("Formato inválido");}
        DB = d; save(); renderPrices && renderPrices(); closeModal(); toast("DB importada ✓");
      } catch (err) { toast("Error al importar: " + err.message, false); }
    };
    reader.readAsText(file);
  };
  inp.click();
}
// Legacy functions — removed, functionality replaced by saveVersion/loadVersion
function doSaveProfile() {
  state.profile = { company: document.getElementById("p-company").value, professional: document.getElementById("p-prof").value, matricula: document.getElementById("p-mat").value, ruc: document.getElementById("p-ruc").value, phone: document.getElementById("p-phone").value, email: document.getElementById("p-email").value, address: document.getElementById("p-address").value, instagram: document.getElementById("p-ig").value, whatsapp: document.getElementById("p-wa").value, website: document.getElementById("p-web").value };
  save(); closeModal(); toast("Perfil guardado ✓");
}

// ── Update DB badge ──
function updateBadge() {
  const el = document.getElementById("db-badge-hdr");
  if (el) {el.textContent = "Precios base mercado PY" + (state.adjustPct ? ` +${state.adjustPct}%` : "");}
}

// ── GLOBAL STATS (FORMERLY DASHBOARD) ─────────────────────────────────────────
const _TEMPLATES_DATA = [
  { icon: "🏠", name: "Casa económica 60m²", desc: "Fundaciones, mampostería 0.15m, techo teja española, revoque, piso calcáreo, pintura cal.", meta: "~₲ 126.000.000", items: [
    ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 13.5], ["MAMPOSTERÍA", "Elevación 0.15m ladrillo común", 120],
    ["MAMPOSTERÍA", "Nivelación 0.30m ladrillo común", 12.5], ["AISLACIÓN", "Horizontal 0.15m con asfalto", 43],
    ["TECHOS", "Teja española s/ tejuelón c/ madera", 94], ["CONTRAPISOS", "Contrapiso 10cm cascotes", 65],
    ["REVOQUES", "Revoque 1 capa sin hidrófugo", 226], ["PISOS", "Baldosa calcárea 20x20cm", 61.5],
    ["PINTURAS", "Pintura a la cal", 226], ["DESAGÜE CLOACAL", "Pozo ciego Ø1.50m h=3.00m", 1],
  ]},
  { icon: "🏢", name: "Dúplex 120m²", desc: "H°A° losa, mampostería cerámica, teja francesa, revoque hidrófugo, porcelanato, látex.", meta: "~₲ 280.000.000", items: [
    ["ESTRUCTURAS", "Zapata fck=18 MPa", 1], ["ESTRUCTURAS", "Columna fck=21 MPa", 0.5],
    ["ESTRUCTURAS", "Losa Rap h=17cm (12+5)", 35], ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 17.6],
    ["MAMPOSTERÍA", "Elevación 0.15m ladrillo cerámico 6 tubos", 240], ["TECHOS", "Teja francesa s/ machimbre", 93],
    ["CONTRAPISOS", "Contrapiso 10cm cascotes", 101], ["REVOQUES", "Revoque 1 capa hidrófugo 1.5cm", 381],
    ["PISOS", "Porcelanato 60x60cm", 19], ["PISOS", "Cerámica esmaltada Cecafi 32x57cm", 62],
    ["PINTURAS", "Látex interior con enduido", 381],
  ]},
  { icon: "🏪", name: "Local comercial 100m²", desc: "Estructura H°A°, losa, mampostería hueca, chapa termoacústica, piso hormigón pulido.", meta: "~₲ 220.000.000", items: [
    ["ESTRUCTURAS", "Zapata fck=18 MPa", 1.5], ["ESTRUCTURAS", "Columna fck=21 MPa", 0.8],
    ["ESTRUCTURAS", "Losa fck=21MPa", 12.4], ["FUNDACIONES", "Cimiento PBC sin cal (1:12)", 21.8],
    ["MAMPOSTERÍA", "Elevación 0.20m ladrillo cerámico hueco", 200], ["TECHOS", "Techo metálico chapa trapezoidal", 120],
    ["CONTRAPISOS", "Contrapiso 10cm cascotes", 107], ["REVOQUES", "Revoque 1 capa hidrófugo 1.5cm", 480],
    ["PISOS", "Mosaico granítico gris 30x30cm", 42], ["PINTURAS", "Látex exterior con enduido", 480],
  ]},
  { icon: "🏗️", name: "Ampliación 30m²", desc: "Cimiento, mampostería, techo chapa, revoque, piso calcáreo. Sin instalaciones.", meta: "~₲ 45.000.000", items: [
    ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 4], ["MAMPOSTERÍA", "Elevación 0.15m ladrillo común", 55],
    ["TECHOS", "Chapa Nº28 s/ caños metálicos", 35], ["CONTRAPISOS", "Contrapiso 7cm cascotes", 30],
    ["REVOQUES", "Revoque 1 capa sin hidrófugo", 110], ["PISOS", "Baldosa calcárea 20x20cm", 30],
    ["PINTURAS", "Pintura a la cal", 110],
  ]},
];
window._TEMPLATES = _TEMPLATES_DATA;
function applyTemplate(idx) {
  const adenda = getActiveAdenda();
  const proj = getActiveProject();
  if (!adenda || !proj) {return toast("Sin proyecto activo", false);}

  const t = window._TEMPLATES[idx];
  if (!confirm('¿Cargar plantilla "' + t.name + '" al presupuesto actual? Se agregarán los ítems.')) {return;}
  let added = 0;
  for (const [cat, name, qty] of t.items) {
    if (DB[cat] && DB[cat][name]) {
      const data = DB[cat][name];
      adenda.items.push({ cat, name, unit: data.unit, unitPrice: data.total, matCost: data.matCost, laborCost: data.laborCost, mats: data.mats || [], qty, id: Date.now() + Math.random() + added, disc: 0, note: "" });
      added++;
    }
  }
  proj.m2Area = t.name.includes("60m²") ? 60 : t.name.includes("120m²") ? 120 : t.name.includes("100m²") ? 100 : 30;
  setSection("budget"); save(); renderBudget();
  toast('Plantilla "' + t.name + '" cargada — ' + added + ' ítems ✓');
}

// ── MOBILE FAB ──────────────────────────────────────────────────────────────────────────
let _fabOpen = false;
function toggleFab() {
  _fabOpen = !_fabOpen;
  document.getElementById("fab-items").className = "mobile-fab-items" + (_fabOpen ? "" : " closed");
  document.getElementById("fab-btn").textContent = _fabOpen ? "✕" : "⚡";
}
function closeFab() { _fabOpen = false; document.getElementById("fab-items").className = "mobile-fab-items closed"; document.getElementById("fab-btn").textContent = "⚡"; }

// ── MOBILE DRAWER (sidebar como cajón deslizable) ─────────────────────────
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('drawer-overlay');
  if (!sb || !ov) {return;}
  const isOpen = sb.classList.contains('open');
  if (isOpen) {
    sb.classList.remove('open');
    ov.classList.remove('show');
    document.body.style.overflow = '';
  } else {
    sb.classList.add('open');
    ov.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}
function closeSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('drawer-overlay');
  if (sb) {sb.classList.remove('open');}
  if (ov) {ov.classList.remove('show');}
  document.body.style.overflow = '';
}

// ── LOGO UPLOAD ───────────────────────────────────────────────────────────────────────
function uploadLogo(input) {
  const file = input.files[0]; if (!file) {return;}
  if (file.size > 500000) { toast("Logo muy grande. Maximo 500KB", false); return; }
  const reader = new FileReader();
  reader.onload = e => {
    state.logoDataUrl = e.target.result;
    save(); showModal("profile");
    toast("Logo guardado ✓");
  };
  reader.readAsDataURL(file);
}

// ── FIRMA DIGITAL ───────────────────────────────────────────────────────────────────────
let _signDraw = false, _signCtx = null, _signCanvas = null;
function initSignatureCanvas() {
  _signCanvas = document.getElementById("sign-canvas");
  if (!_signCanvas) {return;}
  _signCtx = _signCanvas.getContext("2d");
  _signCtx.strokeStyle = "#1a1a1a"; _signCtx.lineWidth = 2; _signCtx.lineCap = "round"; _signCtx.lineJoin = "round";
  const rect = _signCanvas.getBoundingClientRect();
  _signCanvas.width = rect.width * window.devicePixelRatio || 500;
  _signCanvas.height = 120 * window.devicePixelRatio || 120;
  _signCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  _signCtx.strokeStyle = "#1a1a1a"; _signCtx.lineWidth = 2; _signCtx.lineCap = "round";
  _signCanvas.addEventListener("mousedown", e => { _signDraw = true; _signCtx.beginPath(); const r = _signCanvas.getBoundingClientRect(); _signCtx.moveTo(e.clientX - r.left, e.clientY - r.top); });
  _signCanvas.addEventListener("mousemove", e => { if (!_signDraw) {return;} const r = _signCanvas.getBoundingClientRect(); _signCtx.lineTo(e.clientX - r.left, e.clientY - r.top); _signCtx.stroke(); });
  _signCanvas.addEventListener("mouseup", () => _signDraw = false);
  _signCanvas.addEventListener("mouseleave", () => _signDraw = false);
  _signCanvas.addEventListener("touchstart", e => { e.preventDefault(); _signDraw = true; _signCtx.beginPath(); const r = _signCanvas.getBoundingClientRect(); const t = e.touches[0]; _signCtx.moveTo(t.clientX - r.left, t.clientY - r.top); }, { passive: false });
  _signCanvas.addEventListener("touchmove", e => { e.preventDefault(); if (!_signDraw) {return;} const r = _signCanvas.getBoundingClientRect(); const t = e.touches[0]; _signCtx.lineTo(t.clientX - r.left, t.clientY - r.top); _signCtx.stroke(); }, { passive: false });
  _signCanvas.addEventListener("touchend", () => _signDraw = false);
}
function clearSignature() { if (_signCtx && _signCanvas) { _signCtx.clearRect(0, 0, _signCanvas.width, _signCanvas.height); } }
function saveSignature() {
  if (!_signCanvas) {return;}
  state.signDataUrl = _signCanvas.toDataURL("image/png");
  save(); closeModal(); toast("Firma guardada ✓");
}

// ── INIT ──────────────────────────────────────────────────────────────
function loadDemoProject() {
  // Crear directamente en el modelo nuevo (multi-proyecto)
  const demoProj = {
    id: 'p_demo_' + Date.now(),
    name: "Residencia Demo - San Bernardino",
    client: "Juan Pérez",
    phone: "0981 555 000",
    address: "San Bernardino, Cordillera",
    m2Area: 120,
    date: formatDatePY(new Date()),
    status: 'active',
    activeAdendaId: 'main',
    budgets: [{
      id: 'main',
      name: 'Presupuesto Principal',
      profitPct: 0,
      ivaEnabled: false,
      notes: "",
      items: [
        { id: 101, cat: "ESTRUCTURAS", name: "Zapata fck=18 MPa", unit: "m3", qty: 4, unitPrice: 2554380, matCost: 1851000, laborCost: 703380, mats: [], disc: 0, note: "" },
        { id: 102, cat: "MAMPOSTERÍA", name: "Elevación 0.15m ladrillo común", unit: "m2", qty: 120, unitPrice: 125000, matCost: 91838, laborCost: 33162, mats: [], disc: 0, note: "" }
      ]
    }],
    execution: {
      schedules: {
        "101": { status: "done", start: "2026-04-01", end: "2026-04-10", contractorId: "con_demo_1" },
        "102": { status: "progress", start: "2026-04-12", end: "2026-04-30", contractorId: "con_demo_1" }
      },
      dailyLogs: [],
      materialOrders: [],
      finances: { income: [], expenses: [] },
      documents: [],
      aftercare: [],
      projectStartDate: "2026-04-01",
      projectEndDate: ""
    }
  };

  state.projects = [demoProj];
  state.activeProjectId = demoProj.id;
  state.activeAdendaId = 'main';
  state.migratedV6 = true; // ya está en formato nuevo

  state.contractors = [
    { id: "con_demo_1", name: "Maestro Pintos", phone: "0981 000 111", specialty: "Albañilería y Estructura", email: "pintos_obras@gmail.com", notes: "Excelente para cimientos y mampostería. Muy puntual.", payments: [{amount: 2000000, date: "2026-04-20", note: "Anticipo inicio obra"}], staff: [] },
    { id: "con_demo_2", name: "Juan 'Chapuza' González", phone: "0971 222 333", specialty: "Instalaciones", ratingAvg: 1.5, ratingCount: 2, ratings: {}, notes: "Malas terminaciones y deja la obra a medias.", payments: [], staff: [] }
  ];
}

function renderCurrencyArea() {
    const el = document.getElementById("currency-area");
    if (!el) {return;}
    el.innerHTML = `
        <select id="global-currency" style="width:100px; font-weight:700; background:var(--sur); border:1px solid var(--bor); border-radius:var(--rad); padding:4px" onchange="state.currency=this.value; save(); renderCurrencyArea(); setSection(state.section)">
            <option value="PYG" ${state.currency === 'PYG' ? 'selected' : ''}>₲ PYG</option>
            <option value="USD" ${state.currency === 'USD' ? 'selected' : ''}>$ USD</option>
        </select>
        ${state.currency === 'USD' ? `<input id="global-exrate" type="number" value="${state.exchangeRate}" style="width:80px; padding:4px; border-radius:var(--rad); border:1px solid var(--bor)" title="Cotización 1 USD" onblur="state.exchangeRate=parseFloat(this.value)||7500; save(); renderCurrencyArea(); setSection(state.section)">` : ''}
    `;
}

// ── FIREBASE AUTH ──────────────────────────────────────────────────────────
window._currentUser = null;

// Bloquea toda la app si no hay cuenta iniciada (se puede desactivar con state._requireAccount=false)
// Pasan: cuentas maestras (isMaster), demos (isGuest) y cualquier cuenta creada por
// el administrador en el panel de cuentas (aunque no confirme el correo). El registro
// público está bloqueado, así que la verificación por email ya no es requisito:
// cualquier usuario de Firebase que inicie sesión fue creado por el admin (o es la
// identidad técnica de sincronización) y entra sin confirmar.
// Detecta una cuenta de pago emitida por el admin (PRO / Usuario / Demo).
// Estas cuentas viven en el registro local y no requieren Firebase Auth,
// así que se marcan al iniciar sesión para que la app se desbloquee.
function isAdminAccount(email) {
  if (!email) {return false;}
  var n = String(email).trim().toLowerCase();
  return getAccounts().some(function (a) {
    var t = a.type === "permanente" ? TIERS.USUARIO : a.type === "vip" ? TIERS.PRO : a.type;
    return (t === TIERS.PRO || t === TIERS.USUARIO || t === TIERS.DEMO) &&
      String(a.username || "").trim().toLowerCase() === n;
  });
}

// Detecta una cuenta de Firebase real (no maestra, no demo) iniciada en este dispositivo.
function isFirebaseAccount(u) {
  return !!u && u.isMaster !== true && u.isGuest !== true &&
    !!u.uid && !!u.email && !!window._AUTH &&
    !!window._AUTH.currentUser && window._AUTH.currentUser.uid === u.uid;
}

function masteredOrVerified(u) {
  return !!u && (u.isMaster === true || u.isGuest === true || u.isPaidAccount === true || u.emailVerified === true || isAdminAccount(u.email) || isFirebaseAccount(u));
}

// ══════════════════════════════════════════════════════════════════════
// MODELO DE LICENCIAS / TIERS
// ══════════════════════════════════════════════════════════════════════
//
//  maestra  → dueño. Vitalicia, gratuita, todo desbloqueado.
//  pro      → suscripción mensual: nube + backup + actualización de precios.
//  usuario  → compró el programa una vez. Todo funciona, pero SOLO local:
//             sin nube, sin backup remoto, sin actualización de precios.
//  demo     → 72h funcionalidad completa. Al vencer se bloquea y se borra.
//             Un correo solo puede tener una demo.
//
// Todo el resto de la app pregunta por estas funciones, no por isMaster/flag
// sueltos — así el estado que se muestra y lo que se permite nunca discrepan.
var TIERS = {
  MAESTRA: "maestra",
  PRO: "pro",
  USUARIO: "usuario",
  DEMO: "demo"
};

// Busca en el registro del admin la cuenta que corresponde a esta sesión.
function findAccountByUser(u) {
  if (!u) {return null;}
  var list = getAccounts();
  if (u.uid) {
    var byUid = list.find(function (a) { return a.uid && a.uid === u.uid; });
    if (byUid) {return byUid;}
  }
  if (u.email) {
    var mail = String(u.email).trim().toLowerCase();
    var byMail = list.find(function (a) { return String(a.username || "").trim().toLowerCase() === mail; });
    if (byMail) {return byMail;}
  }
  return null;
}

function tierOfUser(u) {
  if (!u) {return null;}
  if (u.isMaster === true) {return TIERS.MAESTRA;}
  if (u.isGuest === true) {return TIERS.DEMO;}
  var acc = findAccountByUser(u);
  if (acc && acc.active === false) {return null;} // cuenta desactivada por el admin
  if (acc && acc.type) {
    // Compatibilidad: los tipos viejos mapean a los nuevos
    if (acc.type === "permanente" || acc.type === "vip") {return acc.type === "vip" ? TIERS.PRO : TIERS.USUARIO;}
    return acc.type;
  }
  // Cuenta de Firebase que no está en el registro: trato más conservador,
  // solo local. El admin la "asciende" a pro cuando corresponde.
  return TIERS.USUARIO;
}

function currentTier() {
  return tierOfUser(window._currentUser);
}

// ¿La suscripción PRO está vigente? La maestra lo está siempre.
function isProActive() {
  var u = window._currentUser;
  if (!u) {return false;}
  if (u.isMaster === true) {return true;}
  var acc = findAccountByUser(u);
  if (!acc || acc.type !== "pro") {return false;}
  if (acc.active === false) {return false;}
  return (acc.proUntil || 0) > Date.now();
}

// Días restantes de suscripción PRO (maestra: null = "no vence").
function proDaysLeft() {
  var u = window._currentUser;
  if (u && u.isMaster === true) {return null;}
  var acc = findAccountByUser(u);
  if (!acc || !acc.proUntil) {return null;}
  return Math.ceil((acc.proUntil - Date.now()) / 86400000);
}

// ¿Puede recibir actualizaciones de la base de precios?
function canUpdatePrices() { return isProActive(); }

// ¿Puede usar nube y backup remoto?
// FUENTE ÚNICA de verdad: la usan firestoreSync, loadFromFirestore, el flush de
// beforeunload y el indicador de estado, para que lo que se muestra no mienta.
//
// Exige DOS cosas:
//   1) plan PRO con suscripción vigente, y
//   2) una sesión REAL de Firebase.
// Lo segundo no es opcional: las reglas de Firestore validan request.auth.uid
// contra el documento, así que sin sesión autenticada la escritura se rechaza
// y el sync fallaría en silencio. Mejor no intentarlo y avisar.
function isCloudUser() {
  if (!isProActive()) {return false;}
  return !!cloudIdentity();
}

// uid de la sesión Firebase autenticada (la que usan las reglas). null si no hay.
function cloudIdentity() {
  var f = window._AUTH && window._AUTH.currentUser;
  return f && f.uid ? f.uid : null;
}

// Descripción legible del tier, para mostrar en la interfaz.
function tierLabel(tier) {
  return tier === TIERS.MAESTRA ? "👑 Maestra"
    : tier === TIERS.PRO ? "⭐ PRO"
    : tier === TIERS.USUARIO ? "👤 Usuario"
    : tier === TIERS.DEMO ? "🎭 Demo"
    : "—";
}


function applyAppLock() {
  var lock = document.getElementById("app-lock");
  if (!lock) {return;}
  var locked = state._requireAccount !== false && !masteredOrVerified(window._currentUser);
  // Botón de administrador: visible solo para la cuenta maestra
  var btnAcc = document.getElementById("btn-accounts");
  if (btnAcc) {btnAcc.style.display = (window._currentUser && window._currentUser.isMaster) ? "" : "none";}
  lock.style.display = locked ? "flex" : "none";
  document.body.style.overflow = locked ? "hidden" : "";
  if (!locked) {return;}
  var u = window._currentUser;
  var unverified = !!u && !masteredOrVerified(u);
  var authBox = document.getElementById("app-lock-auth");
  var verifyBox = document.getElementById("app-lock-verify");
  if (authBox) {authBox.style.display = unverified ? "none" : "block";}
  if (verifyBox) {verifyBox.style.display = unverified ? "block" : "none";}
  if (unverified) {
    var ve = document.getElementById("verify-email");
    if (ve) {ve.textContent = u.email || "tu correo";}
  }
}

function initFirebaseAuth() {
  if (!window._AUTH) {
    // Sin conexión / Firebase no cargó: solo sesión local (maestro, cuenta de
    // pago emitida por el admin, o invitado).
    window._currentUser = localStorage.getItem("pte_master_session") === "1"
      ? { uid: "master", email: "martin@puntero.local", isMaster: true }
      : restorePaidSession() || guestUser();
    applyAppLock();
    scheduleGuestExpiry();
    return;
  }
  window._AUTH.onAuthStateChanged(function (user) {
    // Sesión ANTIGUA de sincronización (admin.sync): su contraseña estaba en el
    // código fuente público, así que ya no sirve y las reglas la rechazan. Se
    // cierra sola y se pide volver a entrar con la contraseña del dueño.
    if (user && String(user.email || "").toLowerCase() === "admin.sync@puntero.local") {
      try { window._AUTH.signOut(); } catch (e) {}
      if (localStorage.getItem("pte_master_session") === "1") {
        user = { uid: "master", email: "martin@puntero.local", isMaster: true };
        setTimeout(function () {
          toast("Sincronización actualizada: volvé a entrar con tu contraseña para volver a publicar el registro.", false);
        }, 900);
      } else {
        user = null;
      }
    }
    // Sesión real del DUEÑO en Firebase: es la que abre el panel maestro y la
    // única con permiso para escribir el registro. La bandera local dice "esta
    // máquina es del admin"; la sesión dice que quien la abrió sabe la
    // contraseña — hacen falta las dos cosas.
    if (user && String(user.uid) === MASTER_UID) {
      pullAccounts();
      if (localStorage.getItem("pte_master_session") === "1") {
        // Se marca como maestra PERO conservando el uid real de Firebase: es
        // el que Firestore verifica al escribir el registro (borrar/editar
        // cuentas). Antes se pisaba con un "master" sintético y, tras un
        // reload, el panel se veía pero todo lo que escribía fallaba.
        user.isMaster = true;
      }
    } else if (!user && localStorage.getItem("pte_master_session") === "1") {
      // La bandera quedó de una sesión anterior (p. ej. sin Firebase cargado):
      // la UI maestra se restaura, pero sin sesión no se escribe el registro.
      user = { uid: "master", email: "martin@puntero.local", isMaster: true };
    } else if (!user) {
      // Cuenta de pago emitida por el admin: se restaura si Firebase no trae una
      // sesión propia. Si la trae (mismo correo), gana la de Firebase porque es
      // la que tiene la sesión real que las reglas de Firestore verifican.
      var p = restorePaidSession();
      if (p && (!user || (user.email && user.email === p.email))) {user = p;}
    }
    if (!user) {
      // Cuenta invitado/demo local: no usa Firebase
      user = guestUser();
    }
    window._currentUser = user;
    var btn = document.getElementById("auth-btn");
    if (btn) {
      btn.textContent = user ? "👤 " + user.email : "🔐 Iniciar Sesión";
    }
    applyAppLock();
    if (user && user.isMaster !== true && user.isGuest !== true && masteredOrVerified(user)) {
      loadFromFirestore().then(function () {
        if (state._workspaceId) {startWorkspaceListener(state._workspaceId);}
      });
    } else if (!user) {
      stopWorkspaceListener();
      delete state._workspaceId;
      delete state._workspaceCode;
      delete window._workspaceRef;
    }
    scheduleGuestExpiry();
  });
}

async function loadFromFirestore() {
  if (!isCloudUser()) {return;}
  try {
    var cloudUid = cloudIdentity();
    var ref = window._FIRESTORE.collection("users").doc(cloudUid);
    var doc = await ref.get();
    if (!doc.exists || !doc.data().appState) {
      if (state.projects && state.projects.length > 0) {
        await ref.set({
          appState: JSON.parse(JSON.stringify(state)),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        toast("Datos locales subidos a la nube ✓");
      }
      return;
    }

    // Last-writer-wins: si este dispositivo YA sincronizó antes y ahora tiene
    // cambios locales MÁS recientes que la nube, no los pisamos — subimos lo
    // local. Evita perder trabajo hecho offline en este dispositivo.
    //
    // El guard exige _lastCloudSync (sync previo) para no subir el proyecto
    // demo de un dispositivo recién instalado por encima de datos reales.
    var updatedAtRaw = doc.data().updatedAt;
    var cloudTs = 0;
    if (updatedAtRaw && typeof updatedAtRaw.toMillis === "function") {
      cloudTs = updatedAtRaw.toMillis();
    } else if (updatedAtRaw instanceof Date) {
      cloudTs = updatedAtRaw.getTime();
    }
    var localTs = state._localModifiedAt || 0;
    var syncedBefore = !!state._lastCloudSync;
    if (syncedBefore && localTs > cloudTs && state.projects && state.projects.length > 0) {
      await ref.set({
        appState: JSON.parse(JSON.stringify(state)),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      state._lastCloudSync = new Date().toISOString();
      toast("Tus cambios locales eran más recientes: se subieron a la nube ✓");
      return;
    }

    var prevSection = state.section;
    Object.assign(state, doc.data().appState);
    state._localModifiedAt = Math.max(cloudTs, state._localModifiedAt || 0);
    state._lastCloudSync = new Date().toISOString();
    localStorage.setItem("ppy_v5", JSON.stringify(state));
    toast("Datos sincronizados desde la nube ✓");
    if (typeof setSection === "function") {setSection(state.section || prevSection || "global_dashboard");}
  } catch (e) { console.warn("Firestore load error:", e); }
}

function showAuthModal() {
  if (window._currentUser) {
    var el = document.getElementById("modal-area");
    var guestNote = "";
    if (window._currentUser.isGuest) {
      var h = Math.floor(guestRemainingMs() / 3600000);
      var m = Math.floor((guestRemainingMs() % 3600000) / 60000);
      guestNote = '<div style="margin-top:6px;font-size:0.8rem;color:var(--tx3)">🎭 Cuenta de invitado · expira en ' + h + 'h ' + m + 'm</div>';
    }
    var isMasterAcc = window._currentUser.isMaster === true;
    var acts = isMasterAcc
      ? '<div class="modal-acts" style="flex-direction:column">' +
        '<button class="btn primary full" onclick="setSection(\'accounts\')">🗝️ Gestionar Cuentas</button>' +
        '<button class="btn danger full" onclick="logout()">Cerrar Sesión</button></div>'
      : '<div class="modal-acts"><button class="btn danger full" onclick="logout()">Cerrar Sesión</button></div>';
    el.innerHTML = '<div class="overlay" style="z-index:600" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:350px">' +
      '<div class="modal-title">Mi Cuenta<button class="delbtn" onclick="closeModal()">✕</button></div>' +
      '<div style="text-align:center;padding:20px">' +
      '<div style="font-size:2rem;margin-bottom:10px">' + (window._currentUser.isGuest ? '🎭' : '👤') + '</div>' +
      '<div style="font-weight:700;margin-bottom:4px">' + window._currentUser.email + '</div>' +
      '<div style="color:var(--tx3);font-size:0.85rem">' + window._currentUser.uid.slice(0, 8) + '...</div>' +
      guestNote +
      '<div style="margin-top:15px;font-size:0.8rem;color:var(--tx3)">' + (isMasterAcc ? '🔐 Acceso de administrador' : 'Cuenta activa. La sincronización en la nube está desactivada.') + '</div>' +
      '</div>' + acts + '</div></div>';
    return;
  }
  var el = document.getElementById("modal-area");
  el.innerHTML = '<div class="overlay" style="z-index:600" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:350px">' +
    '<div class="modal-title">Iniciar Sesión<button class="delbtn" onclick="closeModal()">✕</button></div>' +
    '<div id="auth-error" style="color:var(--err);font-size:0.85rem;margin-bottom:10px;display:none"></div>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<input id="auth-email" type="email" placeholder="Correo electrónico o usuario" style="width:100%">' +
    '<input id="auth-pass" type="password" placeholder="Contraseña" style="width:100%">' +
    '</div>' +
    '<div class="modal-acts" style="flex-direction:column">' +
    '<button class="btn primary full" onclick="login()">Iniciar Sesión</button>' +
    '<button class="btn full" style="background:transparent;border-color:var(--bor);color:var(--tx3)" onclick="forgotPassword()">🔑 ¿Olvidaste tu contraseña?</button>' +
    '</div></div></div>';
}

async function login() {
  var email = document.getElementById("auth-email").value.trim();
  var pass = document.getElementById("auth-pass").value;
  if (!email || !pass) {return toast("Completá todos los campos", false);}
  // ── Cuenta maestra (dueño) ─────────────────────────────────────────────
  // La contraseña NO está escrita en este archivo: se verifica contra
  // Firebase Auth, que contesta con el hash que guarda Google. Leer el código
  // (Ctrl+U) o el historial de git no sirve para entrar: sin la contraseña
  // real, Firebase devuelve credenciales inválidas y no hay sesión.
  // "martin" queda como alias del correo del dueño (misma costumbre de siempre).
  if (email.toLowerCase() === MASTER_ALIAS || email.toLowerCase() === MASTER_EMAIL) {
    if (!window._AUTH || !window._AUTH.signInWithEmailAndPassword) {
      return toast("Sin conexión con Firebase no puedo verificar la contraseña. Reintentá con internet.", false);
    }
    try {
      await window._AUTH.signInWithEmailAndPassword(MASTER_EMAIL, pass);
    } catch (e) {
      console.warn("Login maestra rechazado:", (e && e.code) || (e && e.message) || e);
      var errM = document.getElementById("auth-error");
      if (errM) { errM.textContent = "Usuario o contraseña incorrectos"; errM.style.display = ""; }
      return toast("Usuario o contraseña incorrectos", false);
    }
    localStorage.setItem("pte_master_session", "1");
    deleteGuestSession();
    // Se conserva el uid REAL de Firebase (no un "master" sintético): es el
    // que verifican las reglas de Firestore para escribir el registro de
    // cuentas. Sin él, tras cualquier recarga el panel se veía pero no se
    // podía escribir ni borrar cuentas en la nube.
    var duenoReal = window._AUTH.currentUser;
    window._currentUser = { uid: (duenoReal && duenoReal.uid) || "master", email: "martin@puntero.local", isMaster: true };
    applyAppLock();
    closeModal();
    toast("Sesión maestra iniciada ✓");
    ensureAdminSync();
    return;
  }
  // Refrescar el registro de cuentas del admin (best-effort) para que las cuentas
  // demo/permanentes/VIP funcionen en cualquier dispositivo, no solo en el del admin.
  try { await pullAccounts(); } catch (e) {}
  // Cuentas demo (72h): creadas por el admin, usuario + contraseña propias
  var demoAcc = findDemoAccountByUsername(email);
  if (demoAcc) {
    if (demoAcc.expiresAt <= Date.now()) {
      removeAccountLocal(demoAcc.id);
      // Empuja si hay sesión del dueño (pushAccountsSync decide; si no la hay,
      // la baja queda local y viaja en la próxima sincronización).
      pushAccountsSync();
      var errD = document.getElementById("auth-error");
      if (errD) { errD.textContent = "La cuenta demo venció (72h). Pedile una nueva al administrador."; errD.style.display = ""; }
      return;
    }
    var okDemo = await verifyAccountPassword(demoAcc, pass);
    if (!okDemo) {
      var errD2 = document.getElementById("auth-error");
      if (errD2) { errD2.textContent = "Usuario o contraseña incorrectos"; errD2.style.display = ""; }
      return;
    }
    startDemoSession(demoAcc);
    return;
  }
  // ── Cuentas de pago emitidas por el admin (PRO / Usuario) ──────────────
  // Se validan contra el registro local, igual que las demos. Esto es lo que
  // hace que el panel funcione de verdad: crear una cuenta NO depende de que
  // Firebase responda ni de que el cliente confirme un correo. El mismo
  // registro se réplica a la nube para que la cuenta sirva en otros equipos.
  var mailLower = String(email).trim().toLowerCase();
  var paidAcc = getAccounts().find(function (a) {
    var t = a.type === "permanente" ? TIERS.USUARIO : a.type === "vip" ? TIERS.PRO : a.type;
    return (t === TIERS.PRO || t === TIERS.USUARIO) &&
      String(a.username || "").trim().toLowerCase() === mailLower;
  });
  if (paidAcc) {
    var errBox = document.getElementById("auth-error");
    if (paidAcc.active === false) {
      if (errBox) { errBox.textContent = "Esta cuenta está desactivada. Contactá al administrador."; errBox.style.display = ""; }
      return;
    }
    var okPaid = await verifyAccountPassword(paidAcc, pass);
    if (!okPaid && !paidAcc.passwordHash && !paidAcc.password && paidAcc.firebase) {
      // Registro sin con qué verificar (vino sanitizado de la nube). La cuenta
      // está vinculada a Firebase, así que la contraseña la puede validar él.
      try {
        await window._AUTH.signInWithEmailAndPassword(paidAcc.username, pass);
        okPaid = true;
      } catch (e) { okPaid = false; }
    }
    if (!okPaid) {
      if (errBox) { errBox.textContent = "Usuario o contraseña incorrectos"; errBox.style.display = ""; }
      return;
    }
    startPaidSession(paidAcc, pass);
    return;
  }
  if (!window._AUTH) {return toast("Sin conexión. Usá el modo invitado.", false);}
  try {
    var cred = await window._AUTH.signInWithEmailAndPassword(email, pass);
    if (!cred.user) {return;}
    deleteGuestSession();
    closeModal();
    // El registro público está bloqueado: toda cuenta de Firebase fue creada por
    // el admin, así que entra sin necesidad de confirmar el correo.
    toast("Sesión iniciada ✓");
    try { await pullAccounts(); } catch (e) {}
  } catch (e) {
    var errEl = document.getElementById("auth-error");
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ""; }
  }
}

async function register() {
  if (!window._currentUser || window._currentUser.isMaster !== true) {
    return toast("La creación de cuentas está reservada al administrador 🔒", false);
  }
  var email = document.getElementById("auth-email").value.trim();
  var pass = document.getElementById("auth-pass").value;
  if (!email || !pass) {return toast("Completá todos los campos", false);}
  if (pass.length < 6) {return toast("La contraseña debe tener al menos 6 caracteres", false);}
  if (!window._AUTH) {return toast("Sin conexión. Usá el modo invitado.", false);}
  try {
    // Instancia secundaria para no pisar la sesión del dueño (ver _authSecundaria)
    var cred = await (_authSecundaria() || window._AUTH).createUserWithEmailAndPassword(email, pass);
    deleteGuestSession();
    if (cred.user && cred.user.sendEmailVerification) {
      await cred.user.sendEmailVerification();
    }
    closeModal();
    toast("Cuenta creada. Revisá tu correo y confirmá 📧");
  } catch (e) {
    var errEl = document.getElementById("auth-error");
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ""; }
  }
}

function resendVerification() {
  if (!window._AUTH) {return toast("Sin conexión", false);}
  var u = window._AUTH.currentUser;
  if (!u) {return toast("No hay sesión activa", false);}
  u.sendEmailVerification().then(function () {
    toast("Link de verificación reenviado 📧");
  }).catch(function (e) { toast(e.message || "Error al enviar", false); });
}

async function recheckVerification() {
  if (!window._AUTH) {return toast("Sin conexión", false);}
  var u = window._AUTH.currentUser;
  if (!u) {return;}
  try {
    await u.reload();
    if (u.emailVerified) {
      window._currentUser = u;
      applyAppLock();
      toast("Cuenta confirmada ✓");
      loadFromFirestore();
    } else {
      applyAppLock();
      toast("Todavía no está confirmada. Revisá tu correo.", false);
    }
  } catch (e) { toast("Error al verificar", false); }
}

async function forgotPassword() {
  if (!window._AUTH) {return toast("Sin conexión", false);}
  var email = document.getElementById("auth-email").value.trim();
  if (!email) {return toast("Ingresá tu correo primero", false);}
  try {
    await window._AUTH.sendPasswordResetEmail(email);
    closeModal();
    toast("Te enviamos un link para cambiar tu contraseña 📧");
  } catch (e) {
    toast("No se pudo enviar. Revisá que el correo esté registrado.", false);
  }
}

async function logout() {
  stopWorkspaceListener();
  stopGuestExpiry();
  delete state._workspaceId;
  delete state._workspaceCode;
  delete window._workspaceRef;
  if (window._currentUser && window._currentUser.isMaster) {
    localStorage.removeItem("pte_master_session");
    window._currentUser = null;
    window._lastAccountSync = 0;
    // Cerrar también la sesión Firebase del dueño: sin ella no se escribe el
    // registro de cuentas (es la credencial real, no una bandera local).
    try { if (window._AUTH && window._AUTH.currentUser) {await window._AUTH.signOut();} } catch (e) {}
    applyAppLock();
    closeModal();
    toast("Sesión cerrada ✓");
    return;
  }
  if (window._currentUser && window._currentUser.isGuest) {
    deleteGuestSession();
    window._currentUser = null;
    applyAppLock();
    closeModal();
    toast("Sesión de invitado cerrada ✓");
    return;
  }
  // Cuenta de pago emitida por el admin: se borra la sesión guardada.
  if (window._currentUser && window._currentUser.isPaidAccount) {
    clearPaidSession();
    window._currentUser = null;
    applyAppLock();
    closeModal();
    toast("Sesión cerrada ✓");
    return;
  }
  try {
    await window._AUTH.signOut();
    closeModal();
    toast("Sesión cerrada ✓");
  } catch (e) { toast("Error al cerrar sesión", false); }
}

// ── CUENTAS DEMO / INVITADO ────────────────────────────────────────────────
// Las demos son cuentas locales (sin Firebase) que duran 72h y se borran al
// vencer aunque no haya internet (usa el reloj del dispositivo).
var GUEST_TTL_MS = 72 * 60 * 60 * 1000;
var _guestTimer = null, _guestTimerDeadline = null;

function guestSession() {
  try { var raw = localStorage.getItem("pte_guest_session"); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}

function guestRemainingMs() {
  var g = guestSession();
  return g ? Math.max(0, g.expiresAt - Date.now()) : 0;
}

function guestUser() {
  var g = guestSession();
  if (!g || g.expiresAt <= Date.now()) {return null;}
  return { uid: g.uid, email: g.email, isGuest: true };
}

function accUserNameSlug(u) {
  return String(u || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function startDemoSession(acc) {
  // Si hay una sesión Firebase activa (ej: cuenta permanente del mismo dispositivo),
  // cerrarla para que onAuthStateChanged no pise la sesión demo.
  try {
    if (window._AUTH && window._AUTH.currentUser) {window._AUTH.signOut();}
  } catch (e) {}
  var slug = accUserNameSlug(acc.username);
  localStorage.setItem("pte_guest_session", JSON.stringify({
    uid: "guest-" + slug,
    email: slug + "@puntero.local",
    created: acc.created,
    expiresAt: acc.expiresAt
  }));
  window._currentUser = guestUser();
  applyAppLock();
  closeModal();
  scheduleGuestExpiry();
  var remaining = Math.max(0, acc.expiresAt - Date.now());
  var h = Math.floor(remaining / 3600000);
  toast("Sesión demo activa · " + (h < 1 ? "menos de 1 hora" : h + "h") + " restantes ✓");
}

function deleteGuestSession() {
  localStorage.removeItem("pte_guest_session");
  window._guestWarned = false;
}

// Inicia sesión de una cuenta de pago emitida por el admin.
// El uid se toma del registro (acc.id): es estable entre dispositivos porque
// el registro se réplica, y es la clave con la que se guarda en la nube.
function startPaidSession(acc, pass) {
  // Cerrar cualquier sesión de invitado para que no la pise después
  deleteGuestSession();
  try {
    if (window._AUTH && window._AUTH.currentUser) {window._AUTH.signOut();}
  } catch (e) {}

  // Se guarda la sesión para que sobreviva la recarga: la cuenta de pago no
  // depende de Firebase Auth, así que no hay evento onAuthStateChanged que la
  // restaure.
  localStorage.setItem("pte_paid_session", JSON.stringify({ accountId: acc.id }));

  window._currentUser = {
    uid: acc.uid || ("acc-" + acc.id),
    email: acc.username,
    accountId: acc.id,
    isPaidAccount: true
  };
  applyAppLock();
  closeModal();

  // Sesión real en Firebase si la cuenta está vinculada allí. Es lo que habilita
  // la nube (las reglas verifican request.auth.uid). Si Firebase está caído o la
  // cuenta nunca se vinculó, la app sigue funcionando en local sin problemas.
  if (pass && window._AUTH && acc.firebase) {
    window._AUTH.signInWithEmailAndPassword(acc.username, pass).catch(function (e) {
      console.warn("Sin sesión de nube (funciona en local):", e.code || e.message);
    });
  }

  // La nube y el backup solo son para PRO con suscripción vigente.
  if (isProActive()) {
    loadFromFirestore().then(function () {
      if (state._workspaceId) {startWorkspaceListener(state._workspaceId);}
    });
  }

  var tier = tierOfUser(window._currentUser);
  if (tier === TIERS.PRO) {
    var d = proDaysLeft();
    var sinNube = !isCloudUser();
    toast("Bienvenido ⭐ PRO" + (d === null ? "" : " · " + d + " día" + (d === 1 ? "" : "s") + " de suscripción") +
      (sinNube ? " · sin conexión a la nube" : "") + " ✓");
  } else {
    toast("Bienvenido 👤 · tus datos se guardan en este dispositivo ✓");
  }
}

// Restaura la sesión de una cuenta de pago tras recargar la página.
// Devuelve null si no hay sesión guardada o si la cuenta ya no existe.
function restorePaidSession() {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem("pte_paid_session") || "null"); } catch (e) { raw = null; }
  if (!raw || !raw.accountId) {return null;}
  var acc = getAccounts().find(function (a) { return a.id === raw.accountId; });
  if (!acc) {localStorage.removeItem("pte_paid_session"); return null;}
  if (acc.active === false) {return null;} // desactivada: que vuelva a iniciar sesión
  return {
    uid: acc.uid || ("acc-" + acc.id),
    email: acc.username,
    accountId: acc.id,
    isPaidAccount: true
  };
}

function clearPaidSession() {
  localStorage.removeItem("pte_paid_session");
}

function scheduleGuestExpiry() {
  stopGuestExpiry();
  var g = guestSession();
  if (!g || !window._currentUser || !window._currentUser.isGuest) {return;}
  var rest = guestRemainingMs();
  if (rest <= 0) {return expireGuestSession();}
  _guestTimer = setInterval(function () {
    var r = guestRemainingMs();
    if (r <= 0) {return expireGuestSession();}
    if (r <= 60 * 60 * 1000 && !window._guestWarned) {
      window._guestWarned = true;
      toast("Tu cuenta demo expira en menos de 1 hora ⏳", false);
    }
  }, 30000);
  _guestTimerDeadline = setTimeout(function () { expireGuestSession(); }, rest + 2000);
}

function stopGuestExpiry() {
  if (_guestTimer) { clearInterval(_guestTimer); _guestTimer = null; }
  if (_guestTimerDeadline) { clearTimeout(_guestTimerDeadline); _guestTimerDeadline = null; }
}

function expireGuestSession() {
  // Al vencer, la cuenta demo se borra (además de desloguear)
  var g = guestSession();
  if (g) {
    var slug = g.email ? g.email.split("@")[0] : "";
    setAccounts(getAccounts().filter(function (a) { return !(a.type === "demo" && accUserNameSlug(a.username) === slug); }));
  }
  deleteGuestSession();
  if (window._currentUser && window._currentUser.isGuest) {
    window._currentUser = null;
    applyAppLock();
    toast("La cuenta demo venció (72h). Pedile una nueva al administrador.", false);
  }
}

function initGuestSession() {
  var g = guestSession();
  if (!g) {return;}
  if (g.expiresAt <= Date.now()) {
    setAccounts(getAccounts().filter(function (a) { return !(a.type === "demo" && accUserNameSlug(a.username) === g.email.split("@")[0]); }));
    deleteGuestSession();
    return;
  }
  if (!window._currentUser) {window._currentUser = guestUser();}
  scheduleGuestExpiry();
}

// ── REGISTRO DE CUENTAS (ADMIN) ────────────────────────────────────────────
// pte_accounts: lista local de cuentas creadas por el admin (permanentes,
// VIP y demo). Las demo expiran a las 72h; permanentes/VIP son de pago.
var ACCOUNTS_KEY = "pte_accounts";

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); }
  catch (e) { return []; }
}
function setAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function isMasterAcc() {
  return !!(window._currentUser && window._currentUser.isMaster === true);
}

function findDemoAccountByUsername(username) {
  var nu = String(username || "").trim().toLowerCase();
  return getAccounts().find(function (a) { return a.type === "demo" && String(a.username).trim().toLowerCase() === nu; });
}

var DEMOS_BASE = [
  { id: "demo-invitado01", username: "invitado01", password: "invitado01" },
  { id: "demo-invitadoclara", username: "invitado clara", password: "invitado clara" }
];

// Demos que el DUEÑO borró a propósito. Sin esto no se puede eliminar una demo:
// seedDemoAccounts() la vuelve a crear apenas se borra (se llama en cada render
// del panel y en cada pull del registro) y el borrado no servía de nada. Es una
// decisión del dueño, así que vive solo en SU equipo; los clientes no la tienen
// y siguen recibiendo las demos del registro tal cual.
var DEMOS_BORRADAS_KEY = "pte_demos_borradas";
function _demoBorrada(slug) {
  try { return JSON.parse(localStorage.getItem(DEMOS_BORRADAS_KEY) || "[]").indexOf(slug) !== -1; }
  catch (e) { return false; }
}
function _marcarDemoBorrada(username) {
  var slug = accUserNameSlug(username);
  var lista = [];
  try { lista = JSON.parse(localStorage.getItem(DEMOS_BORRADAS_KEY) || "[]"); } catch (e) {}
  if (lista.indexOf(slug) === -1) {lista.push(slug);}
  localStorage.setItem(DEMOS_BORRADAS_KEY, JSON.stringify(lista));
}

function seedDemoAccounts() {
  // Cuentas base de invitado: se aseguran en cada carga. Si no existen se
  // agregan, y si vencieron se renuevan por otras 72h. Así siempre funcionan,
  // sin importar el estado previo de la lista de cuentas.
  // Excepción: las que el dueño borró no se re-crean (DEMOS_BORRADAS_KEY).
  var defaults = DEMOS_BASE;
  var list = getAccounts();
  var changed = false;
  defaults.forEach(function (d) {
    var slug = accUserNameSlug(d.username);
    if (_demoBorrada(slug)) {return;}
    var existing = list.find(function (a) { return a.type === "demo" && accUserNameSlug(a.username) === slug; });
    if (!existing) {
      list.push({ id: d.id, username: d.username, password: d.password, type: "demo", created: Date.now(), expiresAt: Date.now() + GUEST_TTL_MS, firebase: false });
      changed = true;
    } else if (!existing.expiresAt || existing.expiresAt <= Date.now()) {
      existing.created = Date.now();
      existing.expiresAt = Date.now() + GUEST_TTL_MS;
      if (!existing.password) {existing.password = d.password;}
      changed = true;
    }
  });
  if (changed) {setAccounts(list);}
}

// ══════════════════════════════════════════════════════════════════════
// PANEL DE CONTROL DEL ADMINISTRADOR
// ══════════════════════════════════════════════════════════════════════
// Panel de gestión completo: crear, editar tiers, manejar suscripciones PRO,
// resetear contraseñas, activar/desactivar y borrar. Diseñado para funcionar
// SIEMPRE, incluso sin conexión: el registro local manda y la nube es solo
// réplica. Si Firebase no responde, el panel sigue operando y lo dice.

function _accTypeNorm(a) {
  if (!a) {return null;}
  if (a.type === "permanente") {return TIERS.USUARIO;}
  if (a.type === "vip") {return TIERS.PRO;}
  return a.type;
}

function accIsActive(a) {
  return a && a.active !== false && (!a.proUntil || a.proUntil > Date.now());
}

function accEstado(a) {
  var t = _accTypeNorm(a);
  if (a.active === false) {return { txt: "⛔ Desactivada", color: "var(--err)" };}
  if (t === TIERS.DEMO) {
    var h = Math.max(0, Math.ceil((a.expiresAt - Date.now()) / 3600000));
    return { txt: "⏳ expira en " + h + "h", color: h <= 12 ? "var(--warn)" : "var(--tx3)" };
  }
  if (t === TIERS.PRO) {
    if (!a.proUntil) {return { txt: "⭐ PRO sin fecha", color: "var(--warn)" };}
    var d = Math.ceil((a.proUntil - Date.now()) / 86400000);
    if (d <= 0) {return { txt: "⚠️ VENCIDA hace " + Math.abs(d) + "d", color: "var(--err)" };}
    return { txt: "⭐ " + d + "d restantes", color: d <= 7 ? "var(--warn)" : "var(--ok)" };
  }
  return { txt: "✅ Compra única · local", color: "var(--tx3)" };
}

// Un correo solo puede tener UNA demo.
function demoEmailTaken(email, exceptId) {
  var m = String(email || "").trim().toLowerCase();
  if (!m) {return false;}
  return getAccounts().some(function (a) {
    return a.type === "demo" && a.id !== exceptId && String(a.username || "").trim().toLowerCase() === m;
  });
}

function renderAccountsSettings() {
  var el = document.getElementById("section-accounts");
  if (!el) {return;}
  if (!isMasterAcc()) {
    el.innerHTML = "<div class='empty'>🔒 El registro de cuentas lo gestiona el administrador.<br>" +
      "Si necesitás una cuenta nueva, pedile una al que administra Puntero: él la crea y te pasa usuario y contraseña.</div>";
    return;
  }
  pullAccounts();
  seedDemoAccounts();
  // Podar demos vencidas (se borran solas)
  setAccounts(getAccounts().filter(function (a) { return _accTypeNorm(a) !== TIERS.DEMO || (a.expiresAt || 0) > Date.now(); }));

  var list = getAccounts();
  var filtro = window._accFilter || "todos";
  var q = (window._accSearch || "").trim().toLowerCase();
  var shown = list.filter(function (a) {
    if (filtro !== "todos" && _accTypeNorm(a) !== filtro) {return false;}
    if (q && String(a.username || "").toLowerCase().indexOf(q) === -1) {return false;}
    return true;
  }).sort(function (x, y) { return (y.updatedAt || y.created || 0) - (x.updatedAt || x.created || 0); });

  var nPro = list.filter(function (a) { return _accTypeNorm(a) === TIERS.PRO; }).length;
  var nUsu = list.filter(function (a) { return _accTypeNorm(a) === TIERS.USUARIO; }).length;
  var nDemo = list.filter(function (a) { return _accTypeNorm(a) === TIERS.DEMO; }).length;
  var nVencidas = list.filter(function (a) { return a.active !== false && a.proUntil && a.proUntil <= Date.now(); }).length;

  var rows = shown.map(function (a) {
    var t = _accTypeNorm(a);
    var badge = t === TIERS.PRO ? "⭐ PRO" : t === TIERS.USUARIO ? "👤 Usuario" : "🎭 Demo";
    var est = accEstado(a);
    var acts = [];

    if (t !== TIERS.DEMO) {
      acts.push('<button class="btn sm" onclick="adminExtendPro(\'' + a.id + '\',1)" title="Sumar 1 mes de suscripción">+1 mes</button>');
    } else {
      acts.push('<button class="btn sm" onclick="adminExtendPro(\'' + a.id + '\',0)" title="Extender 72h más">+72h</button>');
    }
    acts.push('<button class="btn sm" onclick="adminEditAccount(\'' + a.id + '\')" title="Editar">✏️</button>');
    if (t !== TIERS.DEMO) {
      acts.push('<button class="btn sm" onclick="adminResetPassword(\'' + a.id + '\')" title="Nueva contraseña">🔑</button>');
      acts.push('<button class="btn sm" onclick="adminToggleActive(\'' + a.id + '\')" title="' + (a.active === false ? "Activar" : "Desactivar") + '">' + (a.active === false ? "▶️" : "⏸") + '</button>');
      if (!a.firebase) {
        acts.push('<button class="btn sm" onclick="adminLinkFirebase(\'' + a.id + '\')" title="Crear la cuenta en Firebase para habilitar la nube">☁️</button>');
      }
    }
    acts.push('<button class="btn sm" onclick="adminCopyAccount(\'' + a.id + '\')" title="Copiar credenciales">📋</button>');
    acts.push('<button class="btn sm danger" onclick="adminDeleteAccount(\'' + a.id + '\')" title="Eliminar">🗑️</button>');

    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bor);flex-wrap:wrap">' +
      '<div style="flex:1;min-width:180px">' +
      '<div style="font-weight:700">' + escapeHtml(a.username) + '</div>' +
      '<div style="font-size:0.8rem;color:var(--tx3)">' + badge + ' · <span style="color:' + est.color + '">' + est.txt + '</span>' +
      (a.note ? ' · 📝 ' + escapeHtml(a.note) : '') +
      (t === TIERS.DEMO ? '' : (a.firebase ? ' · ☁️' : ' · 💻 solo local')) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + acts.join("") + '</div>' +
      '</div>';
  }).join("");

  var fbtn = function (v, l) {
    return '<button class="btn sm ' + (filtro === v ? "primary" : "") + '" onclick="setAccFilter(\'' + v + '\')">' + l + '</button>';
  };

  el.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px">' +
    '<div><h2 style="font-family:var(--font-display);font-weight:800;margin:0 0 4px">🗝️ PANEL DE CONTROL</h2>' +
    '<p style="color:var(--tx3);font-size:0.9rem">Cuentas, suscripciones y demos. Solo visible para vos.</p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:0.85rem">' +
    '<span class="btn sm">⭐ PRO: ' + nPro + '</span>' +
    '<span class="btn sm">👤 Usuarios: ' + nUsu + '</span>' +
    '<span class="btn sm">🎭 Demos: ' + nDemo + '</span>' +
    (nVencidas ? '<span class="btn sm danger">⚠️ Vencidas: ' + nVencidas + '</span>' : '') +
    '</div></div>' +

    '<div class="card" style="margin-bottom:18px;padding:16px">' +
    '<h3 class="sec-lbl">➕ Crear cuenta</h3>' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button type="button" class="btn sm acc-type-btn" id="acc-type-pro" onclick="setAccType(\'pro\')" style="background:var(--ok);color:#fff">⭐ PRO (mensual)</button>' +
    '<button type="button" class="btn sm acc-type-btn" id="acc-type-usuario" onclick="setAccType(\'usuario\')">👤 Usuario (compra única)</button>' +
    '<button type="button" class="btn sm acc-type-btn" id="acc-type-demo" onclick="setAccType(\'demo\')">🎭 Demo (72h)</button>' +
    '</div>' +
    '<input id="acc-user" style="flex:1;min-width:180px" placeholder="Correo del cliente">' +
    '<div style="display:flex;gap:6px"><input id="acc-pass" style="width:150px" placeholder="Contraseña"><button class="btn sm" onclick="genAccPass()" title="Generar">🎲</button></div>' +
    '<div id="acc-months-wrap" style="display:flex;gap:6px;align-items:center"><input id="acc-months" type="number" min="1" max="36" value="1" style="width:64px" title="Meses de suscripción"><span style="font-size:0.8rem;color:var(--tx3)">mes/es</span></div>' +
    '<button class="btn primary" onclick="adminCreateAccount()">Crear</button>' +
    '</div>' +
    '<div style="font-size:0.8rem;color:var(--tx3);margin-top:8px">⭐ PRO: nube, backup y actualización de precios mientras pague. 👤 Usuario: compró una vez, todo funciona pero SOLO en su dispositivo. 🎭 Demo: 72h completas y después se bloquea y se borra; un correo solo puede tener una.</div>' +
    '</div>' +

    '<div class="card" style="padding:16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">' +
    '<h3 class="sec-lbl" style="margin:0">Cuentas (' + shown.length + ' de ' + list.length + ')</h3>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
    fbtn("todos", "Todos") + fbtn("pro", "⭐ PRO") + fbtn("usuario", "👤 Usuario") + fbtn("demo", "🎭 Demo") +
    '<input id="acc-search" placeholder="🔍 Buscar correo" style="width:150px" value="' + escapeHtml(window._accSearch || "") + '" oninput="setAccSearch(this.value)">' +
    '</div></div>' +
    (rows || "<div class='empty'>No hay cuentas con ese filtro.</div>") +
    '</div>';
}

function setAccType(type) {
  window._accTypeSel = type;
  document.querySelectorAll(".acc-type-btn").forEach(function (b) {
    b.style.background = "";
    b.style.color = "";
  });
  var active = document.getElementById("acc-type-" + type);
  if (active) { active.style.background = "var(--ok)"; active.style.color = "#fff"; }
  // El campo de meses solo aplica a PRO
  var w = document.getElementById("acc-months-wrap");
  if (w) { w.style.display = type === "pro" ? "" : "none"; }
}

function setAccFilter(f) {
  window._accFilter = f;
  renderAccountsSettings();
}

function setAccSearch(v) {
  window._accSearch = v;
  renderAccountsSettings();
  var inp = document.getElementById("acc-search");
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

// ── CREAR CUENTA ─────────────────────────────────────────────────────────
// Funciona SIEMPRE: el registro local manda y la nube es réplica. No depende
// de Firebase para que la cuenta quede operativa en el dispositivo del admin.
// Publica el registro de cuentas en la nube SIN pull previo. El pull antes de
// escribir es un error de diseño: trae la nube todavía sin el cambio y el merge
// puede pisar lo recién creado/edited en local (pasó: una cuenta creada desde
// el panel nunca llegó al ledger y el cliente no pudo entrar).
// Devuelve true si quedó escrito; false si no (sin sesión del dueño o error).
async function _publicarRegistro() {
  if (!window._FIRESTORE) {return false;}
  if (!_esSesionDuenio()) {
    console.warn("Ledger: sin sesión del dueño, no se escribe el registro");
    window._ledgerPushSinSesion = true;
    return false;
  }
  window._ledgerPushSinSesion = false;
  try {
    var now = Date.now();
    var local = getAccounts().map(function (a) { return Object.assign({}, a, { updatedAt: a.updatedAt || now }); });
    setAccounts(local);
    var sanitized = [];
    for (var i = 0; i < local.length; i++) {
      sanitized.push(await _sanitizeAccountForLedger(local[i]));
    }
    sanitized = _pruneExpiredDemos(sanitized);
    await window._FIRESTORE.collection("accounts").doc("ledger").set({ list: sanitized, updatedAt: now });
    return true;
  } catch (e) {
    console.warn("push cuentas:", e.code || e.message);
    return false;
  }
}

// Comentario del panel: una cuenta que no llegó a la nube no sirve en otros
// equipos, así que hace falta decirlo (antes el push era a ciegas).
function _avisoRegistroLocal() {
  toast("⚠️ La cuenta quedó guardada en ESTE equipo pero no se pudo publicar en la nube: no va a funcionar en otros dispositivos. Reintentá estando en línea.", false);
}

async function adminCreateAccount() {
  if (!isMasterAcc()) {return toast("El registro de cuentas lo administra el dueño 🔒", false);}
  var type = window._accTypeSel || TIERS.PRO;
  var user = document.getElementById("acc-user").value.trim();
  var pass = document.getElementById("acc-pass").value;
  if (!user || !pass) {return toast("Completá correo y contraseña", false);}
  if (pass.length < 6) {return toast("Contraseña mínima de 6 caracteres", false);}
  if (type !== "demo" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user)) {
    return toast("Ingresá un correo válido", false);
  }

  var lower = user.toLowerCase();
  var dupMail = getAccounts().some(function (a) { return String(a.username || "").trim().toLowerCase() === lower; });
  if (dupMail) {return toast("Ya existe una cuenta con ese correo", false);}
  if (type === "demo" && demoEmailTaken(user)) {
    return toast("Ese correo ya tuvo su demo. Un correo = una demo.", false);
  }

  var salt = accSalt();
  var hash = await hashAccountPassword(pass, salt);
  var now = Date.now();
  var acc = {
    id: "acc-" + now.toString(36),
    username: user,
    type: type,
    salt: salt,
    passwordHash: hash,
    created: now,
    updatedAt: now,
    active: true,
    note: ""
  };
  if (type === TIERS.DEMO) {
    acc.expiresAt = now + GUEST_TTL_MS;
  } else if (type === TIERS.PRO) {
    var months = Math.max(1, Math.min(36, parseInt(document.getElementById("acc-months").value, 10) || 1));
    acc.proUntil = now + months * 30 * 86400000;
  }

  var list = getAccounts();
  list.push(acc);
  setAccounts(list);

  // Se publica YA y se espera el resultado. Si la nube no la recibe, la cuenta
  // solo existe en este equipo y el cliente no va a poder entrar: hace falta
  // avisar, no dejar el push corriendo a ciegas.
  var publicada = await _publicarRegistro();
  if (!publicada) {_avisoRegistroLocal();}

  document.getElementById("acc-user").value = "";
  document.getElementById("acc-pass").value = "";
  toast((type === TIERS.PRO ? "⭐ PRO creado" : type === TIERS.DEMO ? "🎭 Demo creada · 72h" : "👤 Usuario creado") + " ✓");
  renderAccountsSettings();
}

function adminCopyAccount(id) {
  var a = getAccounts().find(function (x) { return x.id === id; });
  if (!a) {return;}
  var t = _accTypeNorm(a);
  var txt = "Puntero — Gestión de Obra\nUsuario: " + a.username +
    "\nContraseña: " + (a.password || "(pedí una nueva con el botón 🔑)") +
    "\nPlan: " + (t === TIERS.PRO ? "PRO (mensual)" : t === TIERS.USUARIO ? "Compra única" : "Demo 72h");
  if (navigator.clipboard) {navigator.clipboard.writeText(txt).then(function () { toast("Credenciales copiadas ✓"); });}
  else {toast(txt, false);}
}

// ── EXTENDER SUSCRIPCIÓN ────────────────────────────────────────────────
// PRO: suma meses desde HOY (no desde el vencimiento), así no se acumula deuda.
// Demo: suma 72h.
async function adminExtendPro(id, months) {
  if (!isMasterAcc()) {return;}
  var list = getAccounts();
  var a = list.find(function (x) { return x.id === id; });
  if (!a) {return;}
  var t = _accTypeNorm(a);
  var now = Date.now();
  if (t === TIERS.DEMO) {
    a.expiresAt = Math.max(now, a.expiresAt || now) + GUEST_TTL_MS;
    toast("Demo extendida 72h ✓");
  } else {
    var base = Math.max(now, a.proUntil || now);
    a.proUntil = base + (months || 1) * 30 * 86400000;
    if (a.type === "vip" || a.type === "permanente") {a.type = TIERS.PRO;} // asciende tipos viejos
    a.active = true;
    toast("Suscripción PRO extendida ✓ · vence " + formatDatePY(a.proUntil));
  }
  a.updatedAt = now;
  setAccounts(list);
  var _pub = await _publicarRegistro(); if (!_pub) {_avisoRegistroLocal();}
  renderAccountsSettings();
}

// ── RESET DE CONTRASEÑA ─────────────────────────────────────────────────
async function adminResetPassword(id) {
  if (!isMasterAcc()) {return;}
  var a = getAccounts().find(function (x) { return x.id === id; });
  if (!a) {return;}
  var nueva = prompt("Nueva contraseña para " + a.username + " (mínimo 6 caracteres):", "");
  if (nueva === null) {return;}
  nueva = nueva.trim();
  if (nueva.length < 6) {return toast("Mínimo 6 caracteres", false);}
  a.salt = accSalt();
  a.passwordHash = await hashAccountPassword(nueva, a.salt);
  a.updatedAt = Date.now();
  setAccounts(getAccounts());
  var _pub = await _publicarRegistro(); if (!_pub) {_avisoRegistroLocal();}
  toast("Contraseña actualizada ✓ · " + nueva);
  renderAccountsSettings();
}

// ── EDITAR CUENTA ───────────────────────────────────────────────────────
function adminEditAccount(id) {
  if (!isMasterAcc()) {return;}
  var a = getAccounts().find(function (x) { return x.id === id; });
  if (!a) {return;}
  var t = _accTypeNorm(a);

  var tierOpts = [
    { v: TIERS.PRO, l: "⭐ PRO — nube + precios + backup" },
    { v: TIERS.USUARIO, l: "👤 Usuario — compra única, solo local" },
    { v: TIERS.DEMO, l: "🎭 Demo — 72h y se borra" },
  ].map(function (o) {
    return '<option value="' + o.v + '"' + (t === o.v ? " selected" : "") + ">" + o.l + "</option>";
  }).join("");

  var mes = a.proUntil ? new Date(a.proUntil).toISOString().slice(0, 7) : "";

  document.getElementById("modal-area").innerHTML =
    '<div class="overlay" style="z-index:610" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:420px">' +
    '<div class="modal-title">✏️ Editar cuenta<button class="delbtn" onclick="closeModal()">✕</button></div>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<div><label class="stat-lbl">Correo / usuario</label><input id="ed-acc-user" style="width:100%" value="' + escapeHtml(a.username) + '"></div>' +
    '<div><label class="stat-lbl">Plan</label><select id="ed-acc-type" style="width:100%">' + tierOpts + '</select></div>' +
    '<div id="ed-acc-pro-wrap"><label class="stat-lbl">Suscripción PRO vigente hasta (mes)</label><input id="ed-acc-pro" type="month" style="width:100%" value="' + mes + '"></div>' +
    '<div><label class="stat-lbl">Nota interna (ej. "pagó por transferencia 12/10")</label><input id="ed-acc-note" style="width:100%" value="' + escapeHtml(a.note || "") + '"></div>' +
    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
    '<input type="checkbox" id="ed-acc-active" ' + (a.active !== false ? "checked" : "") + '><span>Cuenta activa</span></label>' +
    '</div>' +
    '<div class="modal-acts">' +
    '<button class="btn" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn primary" onclick="adminSaveAccountEdit(\'' + a.id + '\')">Guardar</button>' +
    '</div></div></div>';

  var syncPro = function () {
    var w = document.getElementById("ed-acc-pro-wrap");
    if (w) { w.style.display = document.getElementById("ed-acc-type").value === TIERS.PRO ? "" : "none"; }
  };
  document.getElementById("ed-acc-type").onchange = syncPro;
  syncPro();
}

async function adminSaveAccountEdit(id) {
  if (!isMasterAcc()) {return;}
  var list = getAccounts();
  var a = list.find(function (x) { return x.id === id; });
  if (!a) {return;}

  var user = document.getElementById("ed-acc-user").value.trim();
  if (!user) {return toast("El correo no puede quedar vacío", false);}
  var lower = user.toLowerCase();
  var dup = getAccounts().some(function (x) {
    return x.id !== id && String(x.username || "").trim().toLowerCase() === lower;
  });
  if (dup) {return toast("Ya existe otra cuenta con ese correo", false);}

  var newType = document.getElementById("ed-acc-type").value;
  var oldType = _accTypeNorm(a);

  a.username = user;
  a.note = document.getElementById("ed-acc-note").value.trim();
  a.active = document.getElementById("ed-acc-active").checked;
  a.updatedAt = Date.now();

  if (newType === TIERS.DEMO) {
    a.type = TIERS.DEMO;
    if (!a.expiresAt) {a.expiresAt = Date.now() + GUEST_TTL_MS;}
  } else {
    a.type = newType;
    if (newType === TIERS.PRO) {
      var m = document.getElementById("ed-acc-pro").value; // "YYYY-MM"
      if (m) {
        var p = m.split("-");
        // fin de ese mes, 23:59 local
        a.proUntil = new Date(Number(p[0]), Number(p[1]), 0, 23, 59, 59).getTime();
      } else {
        a.proUntil = Math.max(Date.now(), a.proUntil || 0) + 30 * 86400000;
      }
    } else {
      a.proUntil = null; // usuario de compra única: no vence
    }
  }

  setAccounts(list);
  var _pub = await _publicarRegistro(); if (!_pub) {_avisoRegistroLocal();}
  closeModal();
  renderAccountsSettings();
  var label = newType === TIERS.PRO ? "⭐ PRO" : newType === TIERS.USUARIO ? "👤 Usuario" : "🎭 Demo";
  toast("Cuenta actualizada ✓ · " + label + (oldType !== newType ? " (antes: " + oldType + ")" : ""));
}

// ── VINCULAR CUENTA A FIREBASE ─────────────────────────────────────────
// Una cuenta creada sin conexión queda operativa en local pero sin identidad en
// la nube. Con conexión, esto la crea en Firebase Auth para que el plan PRO
// pueda sincronizar de verdad.
// Instancia SECUNDARIA de Firebase Auth para el admin. Mismo proyecto, otro
// "app": así crear o vincular cuentas de clientes no interrumpe la sesión del
// dueño en la instancia principal (que es la que autoriza escribir el registro).
function _authSecundaria() {
  if (window._AUTH2) {return window._AUTH2;}
  if (!window._FB_CONFIG || typeof firebase === "undefined") {return null;}
  try {
    window._AUTH2 = firebase.initializeApp(window._FB_CONFIG, "puntero-admin-sec").auth();
  } catch (e) {
    try {
      window._AUTH2 = firebase.app("puntero-admin-sec").auth();
    } catch (e2) { console.warn("Auth secundaria:", e2); return null; }
  }
  return window._AUTH2;
}

async function adminLinkFirebase(id) {
  if (!isMasterAcc()) {return;}
  var enc = getAccounts().find(function (x) { return x.id === id; });
  if (!enc) {return;}
  if (!window._AUTH) {return toast("Sin conexión con Firebase. Probá cuando tengas internet.", false);}
  // Vincular crea una cuenta real en Auth: lo pide la sesión del dueño, que es
  // la única credencial que este cliente no tiene escrita.
  if (!_esSesionDuenio()) {
    return toast("Para vincular necesitás tu sesión de dueño: salí y volvé a entrar.", false);
  }
  if (enc.firebase) {return toast("Esta cuenta ya está vinculada a la nube", false);}

  var pass = prompt("Contraseña de la cuenta " + enc.username + "\n(la misma con la que va a entrar el cliente):", "");
  if (pass === null) {return;}
  pass = pass.trim();
  if (pass.length < 6) {return toast("Mínimo 6 caracteres", false);}
  // Tiene que ser LA contraseña de la cuenta. Si el admin teclea otra, el
  // cliente entraría en local pero Firebase rechazaría el ingreso y quedaría
  // sin nube y sin entender por qué.
  var coincide = await verifyAccountPassword(enc, pass);
  if (!coincide) {
    return toast("Esa no es la contraseña de " + enc.username + ". Usá la del panel (o reseteala con 🔑).", false);
  }

  toast("Creando la cuenta en la nube...", true);
  // Se crea en una INSTANCIA SECUNDARIA de Auth: createUserWithEmailAndPassword
  // deja iniciada la cuenta recién creada, y en la instancia principal eso
  // habría robado la sesión del dueño (habría que volver a teclear la
  // contraseña para poder sincronizar el registro después).
  var auth2 = _authSecundaria();
  if (!auth2) {
    return toast("No se pudo preparar la creación de cuentas (instancia secundaria de Firebase).", false);
  }
  try {
    var cred = await auth2.createUserWithEmailAndPassword(enc.username, pass);
    var list = getAccounts();
    var a = list.find(function (x) { return x.id === id; });
    a.firebase = true;
    a.uid = cred.user.uid;
    setAccounts(list);
    // La sesión del dueño sigue viva en la instancia principal: con ella se
    // publica el registro en el acto.
    applyAppLock();
    var _pub = await _publicarRegistro(); if (!_pub) {_avisoRegistroLocal();}
    renderAccountsSettings();
    toast("☁️ Cuenta vinculada · ya puede sincronizar ✓");
  } catch (e) {
    var code = (e && e.code) || "";
    if (/email-already-in-use/i.test(code)) {
      // Ya existía en Firebase: la adoptamos (la contraseña es la que ella tenga).
      var list2 = getAccounts();
      var a2 = list2.find(function (x) { return x.id === id; });
      a2.firebase = true;
      setAccounts(list2);
      var _pub = await _publicarRegistro(); if (!_pub) {_avisoRegistroLocal();}
      renderAccountsSettings();
      toast("El correo ya existía en la nube: cuenta vinculada ✓", false);
    } else if (/operation-not-allowed|admin-restricted-operation/i.test(code)) {
      toast("Habilitá Email/Password en Firebase → Authentication → Acceso", false);
    } else {
      toast((e && e.message) || "No se pudo vincular", false);
    }
  }
}

async function adminToggleActive(id) {
  if (!isMasterAcc()) {return;}
  var list = getAccounts();
  var a = list.find(function (x) { return x.id === id; });
  if (!a) {return;}
  a.active = a.active === false;
  a.updatedAt = Date.now();
  setAccounts(list);
  var _pub = await _publicarRegistro(); if (!_pub) {_avisoRegistroLocal();}
  toast(a.active ? "Cuenta activada ✓" : "Cuenta desactivada ⛔");
  renderAccountsSettings();
}

async function adminDeleteAccount(id) {
  var a = getAccounts().find(function (x) { return x.id === id; });
  if (!a) {return;}
  if (!confirm("¿Eliminar la cuenta " + a.username + "?\n\nEl cliente pierde el acceso en todos los dispositivos.")) {return;}
  // Primero se empuja el registro SIN la cuenta, y recién entonces se borra
  // localmente. Antes el push era fire-and-forget: la UI avisaba "eliminada"
  // mientras la nube seguía con la cuenta, y un reload (o un pull posterior)
  // la resucitaba — el borrado nunca había llegado a Firestore.
  var sinLaCuenta = getAccounts().filter(function (x) { return x.id !== id; });
  if (window._FIRESTORE) {
    var synced = false;
    if (_esSesionDuenio()) {
      try {
        var now = Date.now();
        var local = sinLaCuenta.map(function (x) { return Object.assign({}, x, { updatedAt: x.updatedAt || now }); });
        var sanitized = [];
        for (var i = 0; i < local.length; i++) {sanitized.push(await _sanitizeAccountForLedger(local[i]));}
        sanitized = _pruneExpiredDemos(sanitized);
        await window._FIRESTORE.collection("accounts").doc("ledger").set({ list: sanitized, updatedAt: now });
        synced = true;
      } catch (e) {
        console.warn("push cuentas (borrado):", e.code || e.message);
      }
    }
    if (!synced) {
      // Sin la escritura confirmada el borrado no es real: la cuenta volvería
      // en el próximo pull. No se toca nada y se avisa, para poder reintentar.
      toast("⚠️ No se pudo sincronizar el borrado con la nube. Reintentá estando en línea.", false);
      return;
    }
  }
  removeAccountLocal(id);
  // Las demos base se re-crean solas en cada render/pull: si el dueño la borró
  // a propósito, hay que recordarlo para que no vuelva en el próximo ciclo.
  if (a.type === "demo") {_marcarDemoBorrada(a.username);}
  renderAccountsSettings();
  toast("Cuenta eliminada ✓");
}

// ── SINCRONIZACIÓN DEL REGISTRO DE CUENTAS (ADMIN) ─────────────────────────
// El ledger vive en Firestore (accounts/ledger) para que las cuentas creadas
// por el admin funcionen en CUALQUIER dispositivo: el cliente lee el ledger y
// valida su contraseña contra el hash. No hace falta una cuenta de Auth por
// cliente, así que crear cuentas no depende de que Firebase responda.
// Las contraseñas NUNCA viajan en claro: cada cuenta guarda salt + SHA-256.
// Identidad del DUEÑO de la app. Su contraseña se guarda (con hash) solo en
// Firebase Auth: acá no aparece nunca, por eso leer este archivo no habilita
// el panel maestro. El uid es el que autoriza la escritura del registro en las
// reglas de Firestore — es estable aunque cambie el correo.
//
// Antes existía una "identidad de transporte" (admin.sync) con su contraseña
// escrita acá: cualquiera que leyera el código — el repo es público — podía
// firmar como esa identidad y escribir cuentas PRO en el registro. Se retiró:
// ahora ESCRIBE en el registro solo quien tiene sesión Firebase del dueño, y
// esa contraseña no está ni acá ni en git.
var MASTER_EMAIL = "martinhuberf@gmail.com";
var MASTER_UID = "6tF1PCIYwCZEhhf7lsDP7p5Ny6j1";
var MASTER_ALIAS = "martin"; // como el dueño siempre tecleó, sin repetir el correo

window._lastAccountSync = 0;

function _accountsMaxUpdatedAt(list) {
  return (list || []).reduce(function (m, a) { return Math.max(m, a.updatedAt || 0); }, 0);
}

// SHA-256 hex de una contraseña, con salt por cuenta.
// Sin salt el hash es vulnerable a tablas rainbow; con salt, cada cuenta
// necesita su propio ataque. Sigue siendo verificación local, no un sistema
// criptográfico de servidor — y está bien para este caso.
function hashAccountPassword(pass, salt) {
  if (!pass) {return Promise.resolve("");}
  if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) {return Promise.resolve("");}
  var data = new TextEncoder().encode(String(salt || "") + String(pass));
  return crypto.subtle.digest("SHA-256", data).then(function (buf) {
    var bytes = new Uint8Array(buf);
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {hex += ("0" + bytes[i].toString(16)).slice(-2);}
    return hex;
  });
}

function accSalt() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Verifica una contraseña contra una cuenta. Soporta el formato viejo
// (hash sin salt) para no romper las cuentas ya creadas.
function verifyAccountPassword(acc, pass) {
  if (!acc) {return Promise.resolve(false);}
  var p = String(pass || "").trim();
  if (acc.passwordHash) {
    if (acc.salt) {
      return hashAccountPassword(p, acc.salt).then(function (h) { return h === acc.passwordHash; });
    }
    return hashAccountPassword(p).then(function (h) { return h === acc.passwordHash; });
  }
  return Promise.resolve(p !== "" && p === acc.password);
}

// Quita una cuenta de la lista local (sin dialogo)
function removeAccountLocal(id) {
  if (!id) {return;}
  // Tombstone: sin esto, un pull de la nube que corra justo después puede
  // resucitar la cuenta porque el merge la ve como "local faltante" y la
  // re-agrega. Dura poco: es solo para cubrir la ventana de la escritura.
  _cuentasBorradas[id] = Date.now();
  setAccounts(getAccounts().filter(function (a) { return a.id !== id; }));
}

// ids borrados recientemente, para que el merge con la nube no los traiga de
// vuelta. Se limpian solos a los 10 minutos.
var _cuentasBorradas = {};
function _esBorradaReciente(id) {
  var ts = _cuentasBorradas[id];
  if (!ts) {return false;}
  if (Date.now() - ts > 10 * 60000) {delete _cuentasBorradas[id]; return false;}
  return true;
}

// Versión del ledger apta para Firestore: sin contraseña en claro.
//
// El registro es de LECTURA PÚBLICA (así un dispositivo nuevo descubre la
// licencia), por eso no se publica el hash de las cuentas que pueden validar
// la contraseña ellas mismas en Firebase: exponerlo habilita un ataque offline
// sobre contraseñas débiles. Solo llevan hash las que NO tienen identidad en
// la nube (creadas sin conexión) y las demos, que son efímeras.
async function _sanitizeAccountForLedger(a) {
  var copy = {};
  Object.keys(a).forEach(function (k) { if (k !== "password") {copy[k] = a[k];} });
  if (copy.firebase) {
    delete copy.passwordHash;
    delete copy.salt;
  } else if (a.type === "demo" && !copy.passwordHash) {
    copy.salt = a.salt || accSalt();
    copy.passwordHash = await hashAccountPassword(a.password || "", copy.salt);
  }
  return copy;
}

function _pruneExpiredDemos(list) {
  return (list || []).filter(function (a) { return a.type !== "demo" || (a.expiresAt || 0) > Date.now(); });
}

// Mezcla remoto + local sin perder datos:
// - remoto gana (base del resultado), conservando el password en claro local
//   cuando corresponde (el admin nunca "descarga" secretos).
// - cuentas locales que NO están en remoto solo sobreviven si fueron tocadas
//   DESPUÉS de la última escritura remota (cambios offline del admin);
//   si no, son eliminaciones que ya se propagaron.
function _mergeRemoteAccounts(remote, local, remoteTs) {
  var byLocal = {};
  (local || []).forEach(function (a) { byLocal[a.id] = a; });
  // Además del tombstone de sesión, se respetan las demos que el dueño borró:
  // el registro de la nube las sigue trayendo, y sin esto reaparecerían.
  var merged = (remote || []).filter(function (r) {
    return !_esBorradaReciente(r.id) && !(r.type === "demo" && _demoBorrada(accUserNameSlug(r.username)));
  }).map(function (r) {
    var l = byLocal[r.id];
    if (l && l.password && !r.password) {r = Object.assign({}, r, { password: l.password });}
    return r;
  });
  var mergedIds = {};
  merged.forEach(function (m) { mergedIds[m.id] = true; });
  (local || []).forEach(function (l) {
    if (!mergedIds[l.id] && (l.updatedAt || 0) > (remoteTs || 0)) {merged.push(l);}
  });
  return merged;
}

// Refresca el registro de cuentas. La LECTURA del ledger es pública en
// Firestore, así que esto no necesita sesión: sirve en cualquier dispositivo.
// (Antes firmaba acá con una identidad de transporte cuya contraseña estaba
// escrita en el cliente — es decir, no era secreta. Se retiró; escribir el
// registro exige sesión del dueño, ver pushAccountsSync.)
async function ensureAdminSync() {
  if (!window._FIRESTORE) {return;}
  if (navigator && navigator.onLine === false) {return;}
  return pullAccounts();
}

// Trae el ledger a CUALQUIER dispositivo (lectura pública). Con merge inteligente.
async function pullAccounts() {
  if (!window._FIRESTORE) {return;}
  var now = Date.now();
  if (now - window._lastAccountSync < 15000) {return;}
  window._lastAccountSync = now;
  try {
    var ref = window._FIRESTORE.collection("accounts").doc("ledger");
    var snap = await ref.get();
    var data = snap.exists ? snap.data() : null;
    var remote = (data && Array.isArray(data.list)) ? _pruneExpiredDemos(data.list) : null;
    var local = getAccounts();
    var remoteTs = data ? (data.updatedAt || 0) : 0;
    if (remote && remote.length && remoteTs >= _accountsMaxUpdatedAt(local)) {
      setAccounts(_pruneExpiredDemos(_mergeRemoteAccounts(remote, getAccounts(), remoteTs)));
      // El admin auto-repara el ledger (borra demos vencidas)
      if (_esSesionDuenio()) {pushAccountsSync();}
    } else if ((!remote || !remote.length) && local.length && _esSesionDuenio()) {
      await pushAccountsSync();
    }
    // Reasegurar las demos base por si el remoto no las traía
    seedDemoAccounts();
    var el = document.getElementById("section-accounts");
    if (el && el.style.display !== "none") {renderAccountsSettings();}
  } catch (e) { console.warn("pull cuentas:", e.code || e.message); }
}

// ¿Hay sesión Firebase del DUEÑO? Es la única identidad con permiso para
// escribir el registro: la regla de Firestore compara el uid, y la contraseña
// que produce esa sesión no está en el cliente ni en git. Se consulta en vivo
// (no un flag cacheado) para que un signOut se refleje al toque.
function _esSesionDuenio() {
  var u = window._AUTH && window._AUTH.currentUser;
  return !!(u && String(u.uid) === MASTER_UID);
}

// El registro se LEE en abierto (cualquier dispositivo valida su contraseña
// contra él) pero se ESCRIBE solo con sesión del dueño. Sin esa sesión no se
// escribe nada: por eso leer el código fuente no alcanza para darse una cuenta
// PRO — hace falta la contraseña real del dueño, que solo vive en Firebase.
async function pushAccountsSync() {
  if (!_esSesionDuenio() || !window._FIRESTORE) {
    if (window._FIRESTORE && !_esSesionDuenio()) {
      console.warn("Ledger: sin sesión del dueño, no se escribe el registro");
      window._ledgerPushSinSesion = true;
    }
    return;
  }
  window._ledgerPushSinSesion = false;
  try {
    var now = Date.now();
    var local = getAccounts().map(function (a) { return Object.assign({}, a, { updatedAt: a.updatedAt || now }); });
    setAccounts(local);
    var sanitized = [];
    for (var i = 0; i < local.length; i++) {
      sanitized.push(await _sanitizeAccountForLedger(local[i]));
    }
    sanitized = _pruneExpiredDemos(sanitized);
    await window._FIRESTORE.collection("accounts").doc("ledger").set({ list: sanitized, updatedAt: now });
  } catch (e) { console.warn("push cuentas:", e.code || e.message); }
}

// Generador de contraseñas para el panel del admin.
function randomPass() {
  var c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  var s = "";
  for (var i = 0; i < 12; i++) {s += c.charAt(Math.floor(Math.random() * c.length));}
  return s;
}

function genAccPass() {
  var inp = document.getElementById("acc-pass");
  if (inp) {inp.value = randomPass();}
}

// ── CLOUD SETTINGS ─────────────────────────────────────────────────────────
function renderCloudSettings() {
  var el = document.getElementById("section-cloud");
  if (!el) {return;}
  var user = window._currentUser;
  var cloud = isCloudUser();
  var syncEnabled = state._cloudSyncEnabled !== false;
  var dataSize = new Blob([JSON.stringify(state)]).size;
  var dataSizeStr = dataSize > 1024 ? (dataSize / 1024).toFixed(1) + " KB" : dataSize + " B";
  var lastSync = state._lastCloudSync || null;
  var syncLabel = lastSync ? formatDatePY(lastSync) + " " + (lastSync.split("T")[1] || "").slice(0, 5) : "—";
  var wsId = state._workspaceId;
  var wsCode = state._workspaceCode;

  el.innerHTML =
    '<div class="prices-wrap">' +
    '<div style="margin-bottom:20px"><h2 class="sec-lbl" style="margin-bottom:4px">☁️ Cloud</h2><p style="color:var(--tx3);font-size:0.9rem">Sincronización, backup y colaboración en vivo.</p></div>' +

    '<div class="card"><h3 class="sec-lbl">Estado</h3><div style="margin-top:12px">' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Cuenta</span><span style="font-weight:600">' + (user ? user.email : "Sin sesión") + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Sincronización</span><span style="font-weight:600;color:' + (cloud ? "var(--ok)" : "var(--tx3)") + '">' + (cloud ? "🟢 Conectado a la nube" : "⚪ Solo este dispositivo") + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Conexión</span><span style="font-weight:600;color:' + (isOnline() ? "var(--ok)" : "var(--warn)") + '">' + (isOnline() ? "🟢 En línea" : "🟡 Sin conexión") + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Última sincronización</span><span style="font-weight:600">' + syncLabel + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0"><span>Tamaño de datos</span><span style="font-weight:600">' + dataSizeStr + '</span></div>' +
    (cloud ? '' : '<p style="font-size:0.8rem;color:var(--tx3);margin-top:10px">La cuenta maestra y las sesiones demo trabajan solo en este dispositivo. Para sincronizar entre equipos, iniciá sesión con una cuenta registrada.</p>') +
    '</div></div>' +

    // ── WORKSPACE ──────────────────────────────────────────────────
    '<div class="card" style="margin-top:16px">' +
    '<h3 class="sec-lbl">👥 Colaboración en Vivo</h3>' +
    '<div style="margin-top:12px">' +
    (wsId ? (
      '<div style="background:var(--sur2);padding:14px;border-radius:var(--rad);margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><span style="font-weight:700;font-size:1rem">Workspace Activo</span>' +
      '<div style="font-size:0.85rem;color:var(--acc);font-weight:700;margin-top:4px">Código: <strong>' + wsCode + '</strong></div></div>' +
      '<span class="iva-badge" style="background:var(--ok);color:white">🟢 EN VIVO</span></div>' +
      '<p style="font-size:0.8rem;color:var(--tx3);margin-top:8px">Los cambios se sincronizan en tiempo real con los miembros del workspace. Cuando otro usuario modifica datos, ves los cambios automáticamente.</p>' +
      '<button class="btn sm danger" style="margin-top:10px" onclick="leaveWorkspace()">Salir del Workspace</button>' +
      '</div>'
    ) : (
      '<div style="background:var(--sur2);padding:14px;border-radius:var(--rad);margin-bottom:12px">' +
      '<p style="font-size:0.85rem;color:var(--tx3);margin-bottom:10px">Trabajá en tiempo real con otro usuario. Los proyectos, contratistas, proveedores, jornaleros y contratos se comparten al instante.</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn primary full" onclick="createWorkspace()">➕ Crear Workspace</button>' +
      '<div style="display:flex;gap:8px">' +
      '<input id="ws-join-code" placeholder="Código (ej: PUN-X7K2)" style="flex:1;text-transform:uppercase;font-weight:700">' +
      '<button class="btn full" onclick="joinWorkspace()">Unirse</button></div></div></div>'
    )) +
    '</div></div>' +

    '<div class="card" style="margin-top:16px"><h3 class="sec-lbl">Sincronización</h3><div style="margin-top:12px">' +
    '<label style="display:flex;align-items:center;gap:12px;cursor:pointer">' +
    '<input type="checkbox" ' + (syncEnabled ? "checked" : "") + ' onchange="state._cloudSyncEnabled=this.checked;save();toast(this.checked?\'Cloud activado\':\'Cloud desactivado\')">' +
    '<span style="font-weight:600">Sincronización automática a la nube</span></label>' +
    '<p style="color:var(--tx3);font-size:0.8rem;margin-top:6px">Cada cambio se sube automáticamente a Firestore cuando hay sesión iniciada.</p>' +
    '</div></div>' +

    '<div class="card" style="margin-top:16px"><h3 class="sec-lbl">Backup y Datos</h3>' +
    '<div id="backup-status" style="font-size:.8rem;color:var(--tx3);margin-top:8px;line-height:1.5">…</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">' +
    '<button class="btn full" onclick="elegirCarpetaBackupUI()">📁 Backup automático a una carpeta…</button>' +
    '<button class="btn full" onclick="exportBackup()">📥 Descargar backup ahora</button>' +
    '<button class="btn full" onclick="importBackup()">📤 Restaurar desde archivo…</button>' +
    '<button class="btn full" onclick="toggleCopiasLocales()">🕘 Copias automáticas locales</button>' +
    '<button class="btn full" id="btn-deshacer-restore" style="display:none" onclick="deshacerRestoreUI()">↩️ Deshacer la última restauración</button>' +
    (cloud ? '<button class="btn full danger" onclick="clearCloudData()">🗑️ Borrar datos de la nube</button>' : "") +
    '</div>' +
    '<div id="backup-copias" style="margin-top:8px"></div>' +
    '</div>' +

    '<div class="card" style="margin-top:16px;background:var(--sur2)">' +
    '<h3 class="sec-lbl" style="font-size:0.85rem">📋 Firebase Spark Plan (Gratis)</h3>' +
    '<p style="font-size:0.8rem;color:var(--tx3);margin-top:8px">Firestore: 1 GB almacenados · 50k lecturas/día · 20k escrituras/día<br>Authentication: 10k usuarios/mes<br>Hosting: 10 GB storage · 360 MB/día ancho de banda</p>' +
    '<p style="font-size:0.8rem;color:var(--tx3);margin-top:8px">Con uso normal no vas a tener costos. Cada guardado escribe ~2-5 KB en Firestore (~100-200 operaciones/día con uso intensivo).</p>' +
    '</div></div>';

  updateConnStatus();
  renderBackupStatus();
}

// ── BACKUP Y RESTAURACIÓN ───────────────────────────────────────────────────
//
// Tres capas, de menos a más resistente:
//   1. localStorage          — la copia de trabajo (se pierde con "borrar datos
//                              del sitio", actualizaciones o un disco lleno)
//   2. IndexedDB (Dexie)     — historial automático, se recupera solo
//   3. Carpeta en disco      — lo único que sobrevive a todo lo anterior
//
// Un backup que no se puede restaurar no es un backup, así que la restauración
// valida el archivo, muestra qué va a reemplazar y deja una copia de seguridad
// de lo actual para poder deshacer un restore equivocado.

var BACKUP_SCHEMA = 2;              // v1 = { state, db } sin marca de esquema
var MAX_COPIAS_LOCALES = 5;         // historial en IndexedDB
var INTERVALO_BACKUP_MS = 24 * 60 * 60 * 1000;

// Preferencias del dispositivo que NO viajan en el backup: cada equipo tiene la
// suya (tema, sección abierta, si quiere sync) y pisarlas al restaurar confunde.
var BACKUP_PRESERVA = ["section", "theme", "_cloudSyncEnabled"];

// ── Conteo de lo que contiene un backup (para poder mostrarlo) ──────────────
function resumenDatos(st, db) {
  var s = st || {};
  var proyectos = Array.isArray(s.projects) ? s.projects : [];
  var presupuestos = 0;
  var items = 0;
  proyectos.forEach(function (p) {
    (p.budgets || []).forEach(function (b) {
      presupuestos++;
      items += (b.items || []).length;
    });
  });
  var cats = db && typeof db === "object" ? Object.keys(db) : [];
  var rubros = 0;
  cats.forEach(function (c) { rubros += Object.keys(db[c] || {}).length; });
  return {
    proyectos: proyectos.length,
    presupuestos: presupuestos,
    items: items,
    clientes: (s.clients || []).length,
    contratistas: (s.contractors || []).length,
    jornaleros: (s.jornaleros || []).length,
    proveedores: (s.suppliers || []).length,
    categoriasPrecios: cats.length,
    rubrosPrecios: rubros
  };
}

// Texto legible del resumen, para confirmaciones y avisos.
function resumenTexto(r) {
  if (!r) {return "sin datos";}
  return r.proyectos + " proyecto" + (r.proyectos === 1 ? "" : "s") +
    " · " + r.presupuestos + " presupuesto" + (r.presupuestos === 1 ? "" : "s") +
    " · " + r.items + " ítem" + (r.items === 1 ? "" : "s") +
    " · " + r.clientes + " cliente" + (r.clientes === 1 ? "" : "s") +
    " · " + r.contratistas + " contratista" + (r.contratistas === 1 ? "" : "s");
}

// ── Serialización ──────────────────────────────────────────────────────────

// La base de precios vive en localStorage con tres claves de metadata que la
// describen (versión, mes y origen). Sin ellas, restaurar una copia con precios
// de la suscripción quedaría marcada como "compilada" y el arranque la pisaría.
function metaPrecios() {
  var m = { version: DB_VERSION, mes: (typeof DB_MES !== "undefined" ? DB_MES : null), source: null };
  try {
    m.version = localStorage.getItem("ppy_db_version") || m.version;
    m.mes = localStorage.getItem("ppy_db_mes") || m.mes;
    m.source = localStorage.getItem("ppy_db_source") || null;
  } catch (e) {}
  return m;
}

function aplicarMetaPrecios(meta) {
  var m = meta || {};
  try {
    localStorage.setItem("ppy_db_version", String(m.version || DB_VERSION));
    if (m.mes) {localStorage.setItem("ppy_db_mes", String(m.mes));}
    else {localStorage.removeItem("ppy_db_mes");}
    // Solo "remoto" mantiene viva la suscripción; cualquier otra cosa vuelve al
    // canal normal para que el arranque migre a la compilada si corresponde.
    if (m.source === "remoto") {localStorage.setItem("ppy_db_source", "remoto");}
    else {localStorage.removeItem("ppy_db_source");}
  } catch (e) {}
}

function serializarBackup() {
  var meta = metaPrecios();
  return {
    app: "Puntero",
    schema: BACKUP_SCHEMA,
    version: meta.version,
    mes: meta.mes,
    meta: meta,
    exportedAt: new Date().toISOString(),
    resumen: resumenDatos(state, DB),
    state: JSON.parse(JSON.stringify(state)),
    db: JSON.parse(JSON.stringify(DB))
  };
}

// ── Validación ─────────────────────────────────────────────────────────────
// Un archivo equivocado (una imagen renombrada, un JSON de otra cosa) no debe
// poder reemplazar los datos del trabajo de una obra entera.
function validarBackup(obj) {
  var errores = [];
  var advertencias = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, errores: ["el archivo no contiene un backup"], advertencias: advertencias };
  }
  // Retrocompatibilidad: los .json viejos eran { state, db, exportedAt } sin marca
  if (obj.app && obj.app !== "Puntero") {
    errores.push("no es un backup de Puntero (app: " + obj.app + ")");
  }
  if (!obj.state || typeof obj.state !== "object" || Array.isArray(obj.state)) {
    errores.push("falta la sección 'state'");
  } else if (!Array.isArray(obj.state.projects)) {
    errores.push("falta la lista de proyectos");
  }
  if (!obj.db || typeof obj.db !== "object" || Array.isArray(obj.db)) {
    errores.push("falta la base de precios");
  } else if (Object.keys(obj.db).length === 0) {
    errores.push("la base de precios está vacía");
  }
  if (obj.schema != null && Number(obj.schema) > BACKUP_SCHEMA) {
    advertencias.push("fue creado por una versión más nueva de Puntero");
  }
  if (obj.version && obj.version !== DB_VERSION) {
    advertencias.push("precios de otra versión (" + obj.version + ")");
  }
  return { ok: errores.length === 0, errores: errores, advertencias: advertencias };
}

// ── Aplicar un backup (restauración segura) ────────────────────────────────
function aplicarBackup(obj) {
  var v = validarBackup(obj);
  if (!v.ok) {return { ok: false, error: v.errores.join("; ")};}
  // Copia de seguridad de lo actual ANTES de tocar nada: si el restore era un
  // error (backup viejo, archivo equivocado), se puede deshacer.
  guardarCopiaLocal("antes-de-restaurar");
  window._backupParaDeshacer = {
    fecha: Date.now(),
    state: JSON.parse(JSON.stringify(state)),
    db: JSON.parse(JSON.stringify(DB))
  };
  // Preferencias del dispositivo se conservan
  var preserva = {};
  BACKUP_PRESERVA.forEach(function (k) { if (state[k] !== undefined) {preserva[k] = state[k];} });
  // Reemplazo COMPLETO (no merge): un backup es una foto, mezclarla con lo
  // actual deja estados imposibles de explicarle a un cliente.
  Object.keys(state).forEach(function (k) { delete state[k]; });
  Object.assign(state, obj.state, preserva);
  DB = obj.db;
  // Metadata de precios del backup (versión/mes/origen)
  aplicarMetaPrecios(obj.meta || (obj.version ? { version: obj.version, mes: obj.mes, source: null } : null));
  // Migraciones SOLO si el backup es de una versión anterior (migratedV6 ausente).
  // Un backup moderno se restaura tal cual: correr migrateToV7() sobre una copia
  // sin obras le "inventaría" una obra fantasma y ya no sería una foto exacta.
  if (obj.state && obj.state.migratedV6 !== true) {
    try {
      if (typeof migrateToMultiProject === "function") {migrateToMultiProject();}
      if (typeof migrateToV7 === "function") {migrateToV7();}
      if (typeof migrateToV9 === "function") {migrateToV9();}
      if (typeof migrateToV10 === "function") {migrateToV10();}
    } catch (e) { console.warn("[Backup] Migración:", e); }
  }
  state._localModifiedAt = Date.now();
  save();
  dexieSave();
  return { ok: true, resumen: resumenDatos(state, DB), advertencias: v.advertencias };
}

// Deshace la última restauración con la copia que aplicarBackup dejó lista.
function deshacerRestore() {
  var b = window._backupParaDeshacer;
  if (!b) {return false;}
  Object.keys(state).forEach(function (k) { delete state[k]; });
  Object.assign(state, b.state);
  DB = b.db;
  delete window._backupParaDeshacer;
  state._localModifiedAt = Date.now();
  save();
  dexieSave();
  return true;
}

// ── Historial automático en IndexedDB ──────────────────────────────────────
// Es la capa que no pide nada al usuario y cubre el caso más común: alguien
// borra "los datos del sitio" del navegador y se queda sin nada.
function guardarCopiaLocal(tipo) {
  if (!_DEXIE) {return Promise.resolve(false);}
  var copia = {
    ts: Date.now(),
    tipo: tipo || "auto",
    resumen: resumenDatos(state, DB),
    meta: metaPrecios(),
    state: JSON.parse(JSON.stringify(state)),
    db: JSON.parse(JSON.stringify(DB))
  };
  return _DEXIE.copias.put(copia).then(function () {
    // Se conservan solo las últimas N, más cualquier copia de seguridad explícita
    return _DEXIE.copias.orderBy("ts").reverse().toArray();
  }).then(function (todas) {
    var auto = todas.filter(function (c) { return c.tipo !== "antes-de-restaurar"; });
    var sobran = auto.slice(MAX_COPIAS_LOCALES);
    return Promise.all(sobran.map(function (c) { return _DEXIE.copias.delete(c.ts); }));
  }).catch(function (e) { console.warn("[Backup] Copia local:", e); return false; });
}

function listarCopiasLocales() {
  if (!_DEXIE) {return Promise.resolve([]);}
  return _DEXIE.copias.orderBy("ts").reverse().toArray()
    .catch(function () { return []; });
}

function restaurarCopiaLocal(ts) {
  if (!_DEXIE) {return Promise.resolve({ ok: false, error: "sin historial local" });}
  return _DEXIE.copias.get(ts).then(function (c) {
    if (!c) {return { ok: false, error: "copia no encontrada" };}
    return aplicarBackup({
      app: "Puntero", schema: BACKUP_SCHEMA, meta: c.meta,
      version: (c.meta && c.meta.version) || DB_VERSION, state: c.state, db: c.db
    });
  });
}

// ── Backup automático a una carpeta del dispositivo ────────────────────────
// El único formato que sobrevive a borrar los datos del sitio, formatear el
// navegador o que el disco se llene. Se elige la carpeta UNA vez.
async function elegirCarpetaBackup() {
  if (!supportsFileSystemAccess()) {
    return { ok: false, error: "Tu navegador no soporta escribir en carpetas. Usá Chrome o Edge." };
  }
  try {
    var dir = await window.showDirectoryPicker({ mode: "readwrite" });
    // El handle no es JSON: se guarda en IndexedDB, no en localStorage
    if (_DEXIE) {await _DEXIE.state.put({ id: "backupFolder", data: dir });}
    var escrito = await backupACarpeta(dir);
    return { ok: escrito, carpeta: dir.name, error: escrito ? null : "sin permiso de escritura" };
  } catch (e) {
    if (e && e.name === "AbortError") {return { ok: false, cancelado: true };}
    return { ok: false, error: (e && e.message) || "no se pudo usar la carpeta" };
  }
}

function carpetaBackup() {
  if (!_DEXIE) {return Promise.resolve(null);}
  return _DEXIE.state.get("backupFolder").then(function (d) { return (d && d.data) || null; })
    .catch(function () { return null; });
}

async function backupACarpeta(dir) {
  var handle = dir || await carpetaBackup();
  if (!handle) {return false;}
  if (!(await verifyFolderPermission(handle, true))) {return false;}
  var f = await handle.getFileHandle("puntero_backup_" + fechaCorta() + ".json", { create: true });
  var w = await f.createWritable();
  await w.write(JSON.stringify(serializarBackup()));
  await w.close();
  localStorage.setItem("ppy_last_backup", String(Date.now()));
  return true;
}

function fechaCorta() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + dia;
}

// Corre en cada arranque y de vez en cuando mientras la app esté abierta.
// Nunca pide permisos ni descarga nada sin que el usuario lo haya autorizado.
function backupAutomatico() {
  guardarCopiaLocal("auto");
  var ult = Number(localStorage.getItem("ppy_last_backup") || 0);
  if (Date.now() - ult < INTERVALO_BACKUP_MS) {return;}
  carpetaBackup().then(function (dir) {
    if (!dir) {return;}
    backupACarpeta(dir).then(function (ok) {
      if (ok) {toast("💾 Backup guardado en " + dir.name + " ✓");}
    }).catch(function () { /* sin permiso ahora: se reintenta en el próximo arranque */ });
  });
}

function ultimoBackupTexto() {
  var ts = Number(localStorage.getItem("ppy_last_backup") || 0);
  if (!ts) {return "nunca";}
  var dias = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (dias === 0) {return "hoy";}
  if (dias === 1) {return "ayer";}
  return "hace " + dias + " días";
}

// ── Descarga manual (fallback donde no hay FileSystemAccess) ───────────────
function exportBackup() {
  var data = serializarBackup();
  var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "puntero_backup_" + fechaCorta() + ".json";
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem("ppy_last_backup", String(Date.now()));
  toast("Backup descargado ✓ · " + resumenTexto(data.resumen));
}

// Restaurar desde un archivo, con validación y confirmación explícita.
function importBackup() {
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json";
  inp.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) {return;}
    var reader = new FileReader();
    reader.onload = function (ev) {
      var obj = null;
      try { obj = JSON.parse(ev.target.result); } catch (err) {
        return toast("No es un archivo JSON válido: " + err.message, false);
      }
      var v = validarBackup(obj);
      if (!v.ok) {return toast("Archivo inválido: " + v.errores.join("; "), false);}
      var r = resumenDatos(obj.state, obj.db);
      var ahora = resumenDatos(state, DB);
      var aviso = v.advertencias.length ? "\n\n⚠️ " + v.advertencias.join("; ") + "." : "";
      var ok = confirm(
        "¿Reemplazar los datos actuales por este backup?" +
        "\n\n📦 Backup (" + (obj.exportedAt ? new Date(obj.exportedAt).toLocaleString("es-PY") : "sin fecha") + "):" +
        "\n   " + resumenTexto(r) +
        "\n\n💾 Ahora mismo tenés:" +
        "\n   " + resumenTexto(ahora) +
        "\n\nSe reemplaza TODO. Podés deshacerlo desde Cloud > Backup." + aviso
      );
      if (!ok) {return;}
      var res = aplicarBackup(obj);
      if (!res.ok) {return toast("No se pudo restaurar: " + res.error, false);}
      toast("Backup restaurado ✓ · " + resumenTexto(res.resumen));
      setSection(state.section || "cloud");
      renderCloudSettings();
    };
    reader.readAsText(file);
  };
  inp.click();
}

// ── UI de backup ─────────────────────────────────────────────────────────────

// Texto relativo para fechas de las copias ("hace 3 horas").
function haceTexto(ts) {
  if (!ts) {return "sin fecha";}
  var seg = Math.floor((Date.now() - ts) / 1000);
  if (seg < 60) {return "recién";}
  if (seg < 3600) {return "hace " + Math.floor(seg / 60) + " min";}
  if (seg < 86400) {return "hace " + Math.floor(seg / 3600) + " h";}
  var d = Math.floor(seg / 86400);
  return d === 1 ? "ayer" : "hace " + d + " días";
}

// Estado del panel de backup: carpeta vinculada, última copia, historial.
async function renderBackupStatus() {
  var btnUndo = document.getElementById("btn-deshacer-restore");
  if (btnUndo) {btnUndo.style.display = window._backupParaDeshacer ? "" : "none";}
  var el = document.getElementById("backup-status");
  if (!el) {return;}
  var carpeta = await carpetaBackup();
  var copias = await listarCopiasLocales();
  var lineas = [];
  if (carpeta) {
    lineas.push("📁 Backup automático a <b>" + escapeHtml(carpeta.name) + "</b> · último archivo: " + ultimoBackupTexto());
  } else {
    lineas.push("⚠️ Sin backup automático en disco. Elegí una carpeta y Puntero guarda una copia cada 24 h, sin que tengas que acordarte.");
  }
  lineas.push("🕘 " + copias.length + " copia(s) automática(s) local(es)" +
    (copias.length ? ", la última " + haceTexto(copias[0].ts) : "") +
    ". Se guardan solas si borrás los datos del navegador.");
  el.innerHTML = lineas.join("<br>");
}

// Pide la carpeta y confirma que el primer archivo se pudo escribir.
async function elegirCarpetaBackupUI() {
  toast("Elegí la carpeta donde querés las copias (una vez)…");
  var r = await elegirCarpetaBackup();
  if (r.cancelado) {return;}
  if (r.ok) {toast("✓ Copia de prueba escrita en «" + r.carpeta + "». Se repetirá cada 24 h.");}
  else {toast("No se pudo usar la carpeta: " + r.error, false);}
  renderBackupStatus();
}

// Lista el historial local para restaurar una copia puntual.
async function toggleCopiasLocales() {
  var box = document.getElementById("backup-copias");
  if (!box) {return;}
  if (box.innerHTML) {box.innerHTML = ""; return;}
  var copias = await listarCopiasLocales();
  if (!copias.length) {box.innerHTML = '<p style="font-size:.8rem;color:var(--tx3)">Todavía no hay copias locales. Se crean solas en cada arranque.</p>'; return;}
  box.innerHTML = copias.map(function (c) {
    var d = new Date(c.ts);
    var label = (c.tipo === "antes-de-restaurar" ? "🛡️ " : "🕘 ") +
      d.toLocaleDateString("es-PY") + " " + d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) +
      " · " + (c.tipo === "antes-de-restaurar" ? "antes de restaurar" : c.tipo) +
      " · " + resumenTexto(c.resumen);
    return '<div style="display:flex;gap:8px;align-items:center;font-size:.75rem;color:var(--tx3);border-top:1px solid var(--bd);padding:6px 0">' +
      '<span style="flex:1">' + escapeHtml(label) + '</span>' +
      '<button class="btn" style="padding:4px 10px;font-size:.7rem" onclick="restaurarCopiaLocalUI(' + c.ts + ')">Restaurar</button>' +
      '</div>';
  }).join("");
}

// Restaura una copia del historial, con la misma confirmación que un archivo.
async function restaurarCopiaLocalUI(ts) {
  var copias = await listarCopiasLocales();
  var c = copias.find(function (x) { return x.ts === ts; });
  if (!c) {return toast("Esa copia ya no existe", false);}
  var ahora = resumenDatos(state, DB);
  var ok = confirm(
    "¿Reemplazar los datos actuales por esta copia?" +
    "\n\n🕘 Copia del " + new Date(c.ts).toLocaleString("es-PY") + ":" +
    "\n   " + resumenTexto(c.resumen) +
    "\n\n💾 Ahora mismo tenés:" +
    "\n   " + resumenTexto(ahora) +
    "\n\nSe reemplaza TODO. Podés deshacerlo desde este mismo panel."
  );
  if (!ok) {return;}
  var r = await restaurarCopiaLocal(ts);
  if (!r.ok) {return toast("No se pudo restaurar: " + r.error, false);}
  toast("Copia restaurada ✓ · " + resumenTexto(r.resumen));
  renderCloudSettings();
}

// Deshace la última restauración (la copia que se guardó antes de aplicar).
function deshacerRestoreUI() {
  if (!window._backupParaDeshacer) {return toast("No hay ninguna restauración para deshacer", false);}
  var ok = confirm("¿Deshacer la última restauración?\n\nVolvés a tener exactamente los datos que había antes de restaurar.");
  if (!ok) {return;}
  if (deshacerRestore()) {toast("Restauración deshecha ✓");}
  renderCloudSettings();
}

async function clearCloudData() {
  if (!window._currentUser) {return toast("No hay sesión activa", false);}
  if (!confirm("¿Borrar todos los datos de la nube?\n\nLos datos locales NO se borran. Esta acción no se puede deshacer.")) {return;}
  try {
    await window._FIRESTORE.collection("users").doc(window._currentUser.uid).delete();
    toast("Datos de la nube borrados ✓");
    renderCloudSettings();
  } catch (e) { toast("Error: " + e.message, false); }
}

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────
window.onerror = function (msg, url, line, col, err) {
  console.error("[Puntero]", msg, "at", url + ":" + line);
  var el = document.getElementById("toast-el");
  if (el && el.style.display === "none") {
    toast("Error inesperado. Revisá la consola.", false);
  }
};
window.addEventListener("unhandledrejection", function (e) {
  console.warn("[Puntero] Promise rechazada:", e.reason);
});

// ── AUTO EXCHANGE RATE ─────────────────────────────────────────────────────
function fetchExchangeRate() {
  var cached = state._exchangeRateCache;
  if (cached && Date.now() - cached.ts < 86400000) {return;}
  fetch("https://open.er-api.com/v6/latest/USD").then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.rates && d.rates.PYG) {
      state.exchangeRate = d.rates.PYG;
      state._exchangeRateCache = { rate: d.rates.PYG, ts: Date.now() };
      save();
    }
  }).catch(function () {});
}

// ── BASE64 TO STORAGE MIGRATION ────────────────────────────────────────────
function migrateBase64ToStorage() {
  if (!window._STORAGE || !window._currentUser) {return;}
  if (state._base64Migrated) {return;}
  var found = 0;
  // Scan materialOrders for base64 delivery photos
  (state.projects || []).forEach(function (p) {
    (p.execution?.materialOrders || []).forEach(function (o) {
      if (o.deliveryPhoto && o.deliveryPhoto.startsWith("data:")) {
        found++;
        var byteString = atob(o.deliveryPhoto.split(",")[1]);
        var mime = o.deliveryPhoto.split(",")[0].match(/:(.*?);/)[1];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {ia[i] = byteString.charCodeAt(i);}
        var blob = new Blob([ab], { type: mime });
        var ref = window._STORAGE.ref("users/" + window._currentUser.uid + "/migrated/" + o.id + ".jpg");
        ref.put(blob).then(function (snap) { return snap.ref.getDownloadURL(); }).then(function (url) {
          o.deliveryPhoto = url;
          save();
        }).catch(function () {});
      }
    });
  });
  if (found > 0) {toast("Migrando " + found + " fotos a la nube...");}
  state._base64Migrated = true;
  save();
}

// ── INIT ───────────────────────────────────────────────────────────────────
window.onload = () => {
  if (!state.finances) {state.finances = { income: [], expenses: [] };}
  if (!state.materialOrders) {state.materialOrders = [];}
  if (!state.contractors) {state.contractors = [];}
  if (!state.jornaleros) {state.jornaleros = [];}
  if (!state.jornalConfig) {state.jornalConfig = { ayudante: 80000, oficial: 110000, puntero: 140000 };}
  
  migrateToV7();
  migrateToV9();
  migrateToV10();
  renderCurrencyArea();
  seedDemoAccounts();
  initGuestSession();
  initFirebaseAuth();
  if (localStorage.getItem("pte_master_session") === "1") { setTimeout(ensureAdminSync, 500); }
  fetchExchangeRate();
  applyAppLock();
  
  // Mobile-first: daily log como landing en celular
  var isMobile = window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // Shortcuts del manifest (?section=logs, materials, contractors...).
  // Sin esto los accesos directos del PWA abrían la app siempre en la misma
  // sección y el parámetro se ignoraba en silencio.
  var deepLink = sectionFromUrl(window.location.search);

  if (deepLink) {state.section = deepLink;}
  else if (isMobile && state.section !== "logs") {state.section = "logs";}
  setSection(state.section || (isMobile ? "logs" : "global_dashboard"));

  updateBadge();
  checkBackupReminder();
  updateConnStatus();
  preciosUpdateSilencioso();
  
  // [CLOUD OFF] migración de fotos a Storage desactivada: reactivar quitando el comentario
  // setTimeout(migrateBase64ToStorage, 3000);
};

/**
 * GEOLOCALIZACIÓN Y MAPAS
 */
function showProjectLocationModal() {
    const p = getActiveProject();
    if (!p) {return;}
    const loc = p.location || { lat: -25.26, lng: -57.57, address: "" };

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:600px">
        <div class="modal-title">Ubicación de la Obra<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div class="info-box" style="margin-bottom:15px">Hacé click en el mapa para marcar la ubicación exacta de la obra.</div>
        <div id="project-map" class="map-container">
            <div class="map-placeholder">Cargando mapa...</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px">
            <input id="loc-address" placeholder="Dirección o Referencia (ej: Calle 4 y Avda. Mariscal)" value="${loc.address || ''}">
            <div class="grid2">
                <input id="loc-lat" type="number" step="any" placeholder="Latitud" value="${loc.lat || ''}" readonly>
                <input id="loc-lng" type="number" step="any" placeholder="Longitud" value="${loc.lng || ''}" readonly>
            </div>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cerrar</button>
            <button class="btn ok-btn" onclick="shareProjectLocation()">📤 Compartir Ubicación</button>
            <button class="btn primary" onclick="saveProjectLocation()">Guardar Ubicación 📍</button>
        </div>
    </div></div>`;

    setTimeout(() => initProjectMap(loc), 300);
}

let _map, _marker;
function initProjectMap(loc) {
    const center = loc.lat && loc.lng ? [loc.lat, loc.lng] : [-25.2637, -57.5759]; // Asunción por defecto
    
    _map = L.map('project-map').setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(_map);

    if (loc.lat && loc.lng) {
        _marker = L.marker(center, { draggable: true }).addTo(_map);
    }

    _map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        if (_marker) {
            _marker.setLatLng(e.latlng);
        } else {
            _marker = L.marker(e.latlng, { draggable: true }).addTo(_map);
        }
        document.getElementById('loc-lat').value = lat.toFixed(6);
        document.getElementById('loc-lng').value = lng.toFixed(6);
    });
}

function saveProjectLocation() {
    const p = getActiveProject();
    if (!p) {return;}
    const lat = parseFloat(document.getElementById('loc-lat').value);
    const lng = parseFloat(document.getElementById('loc-lng').value);
    const address = document.getElementById('loc-address').value;

    if (!lat || !lng) {return toast("Marcá la ubicación en el mapa", false);}

    p.location = { lat, lng, address };
    save();
    closeModal();
    renderDashboard();
    renderProjects();
    toast("Ubicación guardada ✓");
}

function shareProjectLocation() {
    const p = getActiveProject();
    const lat = document.getElementById('loc-lat').value || (p.location && p.location.lat);
    const lng = document.getElementById('loc-lng').value || (p.location && p.location.lng);
    const address = document.getElementById('loc-address').value || (p.location && p.location.address);

    if (!lat || !lng) {return toast("No hay ubicación guardada", false);}

    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const text = `📍 *Ubicación de Obra: ${p.name}*\nDirección: ${address || 'Ver mapa'}\n\nLink: ${googleMapsUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank');
}
