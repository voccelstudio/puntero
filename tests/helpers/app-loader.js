// Carga el código fuente REAL de la app (db_precios.js + app.js) dentro de
// jsdom y expone las funciones de negocio para testearlas.
//
// Motivo: la app es vanilla sin módulos (todo son globales). Para testear la
// lógica de negocio REAL (y no copias que se desincronizan — pasó con calcIVA,
// donde el test usaba las tasas de IVA al revés) cargamos el fuente tal cual.
//
// Los let/const del fuente no cuelgan de globalThis, así que un epílogo dentro
// del mismo eval los exporta a un namespace cacheado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const NAMESPACE = "__PUNTERO_TEST__";

function bootstrap() {
  const dbSrc = fs.readFileSync(path.join(ROOT, "db_precios.js"), "utf8");
  const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

  const EXPORTS = `;
;globalThis.${NAMESPACE} = {
  state: state,
  getTotals: getTotals,
  calcIVA: calcIVA,
  calcMaterials: calcMaterials,
  calcItemMaterials: calcItemMaterials,
  getActiveAdenda: getActiveAdenda,
  getActiveProject: getActiveProject,
  escapeHtml: escapeHtml,
  fmt: fmt,
  fmtD: fmtD,
  formatDatePY: formatDatePY,
  parseDate: parseDate,
  todayISO: todayISO,
  buildDB: buildDB,
  IVA_MAT: IVA_MAT,
  IVA_LAB: IVA_LAB,
  loadFromFirestore: loadFromFirestore,
  firestoreSync: firestoreSync,
  sectionFromUrl: sectionFromUrl,
  isCloudUser: isCloudUser,
  isOnline: isOnline,
  updateConnStatus: updateConnStatus,
  getDB: function () { return DB; },
  setDB: function (v) { DB = v; },
  currentTier: currentTier,
  tierOfUser: tierOfUser,
  isProActive: isProActive,
  canUpdatePrices: canUpdatePrices,
  proDaysLeft: proDaysLeft,
  tierLabel: tierLabel,
  getAccounts: getAccounts,
  setAccounts: setAccounts,
  mergePriceDBs: mergePriceDBs,
  preciosFechaLabel: preciosFechaLabel,
  preciosVersionInstalada: preciosVersionInstalada,
  preciosInstalados: preciosInstalados,
  aplicarPreciosRemotos: aplicarPreciosRemotos,
  restaurarPreciosLocales: restaurarPreciosLocales,
  checkPreciosUpdate: checkPreciosUpdate,
  BACKUP_SCHEMA: BACKUP_SCHEMA,
  MAX_COPIAS_LOCALES: MAX_COPIAS_LOCALES,
  BACKUP_PRESERVA: BACKUP_PRESERVA,
  login: login,
  MASTER_EMAIL: MASTER_EMAIL,
  MASTER_ALIAS: MASTER_ALIAS,
  MASTER_UID: MASTER_UID,
  resumenDatos: resumenDatos,
  resumenTexto: resumenTexto,
  serializarBackup: serializarBackup,
  validarBackup: validarBackup,
  aplicarBackup: aplicarBackup,
  deshacerRestore: deshacerRestore,
  metaPrecios: metaPrecios,
  aplicarMetaPrecios: aplicarMetaPrecios,
  haceTexto: haceTexto,
  guardarCopiaLocal: guardarCopiaLocal,
  accUserNameSlug: accUserNameSlug,
  seedDemoAccounts: seedDemoAccounts,
  _mergeRemoteAccounts: _mergeRemoteAccounts,
  _pruneExpiredDemos: _pruneExpiredDemos,
  removeAccountLocal: removeAccountLocal,
  adminDeleteAccount: adminDeleteAccount,
  _marcarDemoBorrada: _marcarDemoBorrada,
  _demoBorrada: _demoBorrada,
  _esBorradaReciente: _esBorradaReciente,
  adminCreateAccount: adminCreateAccount,
  _publicarRegistro: _publicarRegistro,
  adminToggleActive: adminToggleActive,
  adminExtendPro: adminExtendPro
};
`;

  // Un solo eval para que las declaraciones compartan scope.
  // eslint-disable-next-line no-eval
  (0, eval)(dbSrc + "\n" + appSrc + EXPORTS);
}

/**
 * Devuelve el namespace con las funciones de negocio reales.
 * Idempotente: si ya se cargó en este contexto de test, reutiliza el cache.
 */
export function loadApp() {
  if (!globalThis[NAMESPACE]) {bootstrap();}
  const api = globalThis[NAMESPACE];

  // Estado limpio y determinístico por test (antes de cada caso).
  api.resetState = function () {
    api.state.projects = [];
    api.state.activeProjectId = null;
    api.state.activeAdendaId = null;
    api.state.currency = "PYG";
    api.state.exchangeRate = 7500;
  };

  /** Crea un proyecto con una sola adenda y devuelve la referencia viva. */
  api.makeProject = function (opts) {
    const o = opts || {};
    const adenda = {
      id: o.adendaId || "main",
      name: "Principal",
      profitPct: o.profitPct != null ? o.profitPct : 0,
      ivaEnabled: !!o.ivaEnabled,
      notes: "",
      items: o.items || [],
    };
    const project = {
      id: o.id || "p1",
      name: o.name || "Obra Test",
      budgets: [adenda],
      execution: { schedules: {}, dailyLogs: [] },
    };
    api.state.projects.push(project);
    api.state.activeProjectId = project.id;
    api.state.activeAdendaId = adenda.id;
    return project;
  };

  return api;
}
