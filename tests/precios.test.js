import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

// Tests de la entrega remota de precios (el beneficio del plan PRO).
// Se prueba sobre el código REAL: el merge debe respetar las ediciones del
// usuario, y el gate debe cerrarse para quien no paga la suscripción.

const app = loadApp();

function setLedger(list) {
  localStorage.setItem("pte_accounts", JSON.stringify(list));
}

/** Manifest falso servido por fetch. */
function mockManifest(man) {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => man,
  });
}

beforeEach(() => {
  localStorage.removeItem("pte_accounts");
  localStorage.removeItem("ppy_db_version");
  localStorage.removeItem("ppy_db_mes");
  localStorage.removeItem("ppy_db_source");
  window._currentUser = null;
  delete window._AUTH;
});

afterEach(() => {
  delete globalThis.fetch;
});

describe("mergePriceDBs() — la DB nueva manda, pero ganan tus ediciones", () => {
  it("toma los precios nuevos de la base oficial", () => {
    const fresh = { ESTRUCTURAS: { "Zapata": { unit: "m3", unitPrice: 100 } } };
    const user = {};
    const out = app.mergePriceDBs(fresh, user);
    expect(out.ESTRUCTURAS["Zapata"].unitPrice).toBe(100);
  });

  it("respeta el precio que el usuario corrigió a mano", () => {
    const fresh = { ESTRUCTURAS: { "Zapata": { unit: "m3", unitPrice: 100 } } };
    const user = { ESTRUCTURAS: { "Zapata": { unit: "m3", unitPrice: 135 } } };
    const out = app.mergePriceDBs(fresh, user);
    expect(out.ESTRUCTURAS["Zapata"].unitPrice).toBe(135);
  });

  it("conserva los ítems propios del usuario que ya no están en la base", () => {
    const fresh = { ESTRUCTURAS: { "Zapata": { unitPrice: 100 } } };
    const user = { ESTRUCTURAS: { "Mi rubro propio": { unitPrice: 77 } } };
    const out = app.mergePriceDBs(fresh, user);
    expect(out.ESTRUCTURAS["Mi rubro propio"].unitPrice).toBe(77);
  });

  it("conserva las categorías propias del usuario", () => {
    const fresh = { ESTRUCTURAS: {} };
    const user = { MIS_RUBROS: { "Algo": { unitPrice: 5 } } };
    const out = app.mergePriceDBs(fresh, user);
    expect(out.MIS_RUBROS["Algo"].unitPrice).toBe(5);
  });

  it("trae los campos nuevos de la base (ej: yield corregido)", () => {
    const fresh = { ESTRUCTURAS: { "Zapata": { unitPrice: 100, y: 12 } } };
    const user = { ESTRUCTURAS: { "Zapata": { unitPrice: 135 } } }; // editó solo el precio
    const out = app.mergePriceDBs(fresh, user);
    expect(out.ESTRUCTURAS["Zapata"].y).toBe(12); // dato nuevo de la base
    expect(out.ESTRUCTURAS["Zapata"].unitPrice).toBe(135); // y su edición
  });
});

describe("preciosFechaLabel()", () => {
  it("convierte YYYY-MM a texto", () => {
    expect(app.preciosFechaLabel("2026-10")).toBe("octubre 2026");
    expect(app.preciosFechaLabel("2026-01")).toBe("enero 2026");
  });
  it("tolora valores vacíos", () => {
    expect(app.preciosFechaLabel(null)).toBe("sin fecha");
    expect(app.preciosFechaLabel("")).toBe("sin fecha");
  });
});

describe("checkPreciosUpdate() — gate por suscripción", () => {
  it("sin suscripción PRO: no consulta nada (ni siquiera fetch)", async () => {
    // Usuario de compra única: su licencia funciona, pero sin precios nuevos.
    setLedger([{ id: "a1", uid: "u1", username: "c@x.com", type: "usuario", active: true }]);
    window._currentUser = { uid: "u1", email: "c@x.com" };

    var fetchado = false;
    globalThis.fetch = async () => { fetchado = true; return { ok: true, json: async () => ({}) }; };

    const r = await app.checkPreciosUpdate();
    expect(r).toBeNull();
    expect(fetchado).toBe(false);
  });

  it("PRO vencido: tampoco recibe actualizaciones", async () => {
    setLedger([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() - 1000 }]);
    window._currentUser = { uid: "u1", email: "p@x.com" };

    var fetchado = false;
    globalThis.fetch = async () => { fetchado = true; return { ok: true, json: async () => ({}) }; };

    const r = await app.checkPreciosUpdate();
    expect(r).toBeNull();
    expect(fetchado).toBe(false);
  });

  it("PRO vigente: detecta una versión más nueva que la instalada", async () => {
    setLedger([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() + 30 * 86400000 }]);
    window._currentUser = { uid: "u1", email: "p@x.com" };
    localStorage.setItem("ppy_db_version", "2026-09");

    mockManifest({
      version: "2026-11",
      mes: "2026-11",
      db: { ESTRUCTURAS: { "Zapata": { unitPrice: 200 } } },
    });

    const r = await app.checkPreciosUpdate();
    expect(r).not.toBeNull();
    expect(r.version).toBe("2026-11");
    expect(r.fecha).toBe("2026-11");
  });

  it("si la versión remota es la instalada, no ofrece nada", async () => {
    setLedger([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() + 30 * 86400000 }]);
    window._currentUser = { uid: "u1", email: "p@x.com" };
    localStorage.setItem("ppy_db_version", "2026-11");

    mockManifest({ version: "2026-11", mes: "2026-11", db: { ESTRUCTURAS: {} } });

    expect(await app.checkPreciosUpdate()).toBeNull();
  });

  it("si el fetch falla (offline), devuelve null sin romper", async () => {
    setLedger([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() + 30 * 86400000 }]);
    window._currentUser = { uid: "u1", email: "p@x.com" };
    localStorage.setItem("ppy_db_version", "2026-09");

    globalThis.fetch = async () => { throw new Error("offline"); };

    expect(await app.checkPreciosUpdate()).toBeNull();
  });
});

describe("aplicarPreciosRemotos()", () => {
  it("aplica la base nueva conservando las ediciones del usuario", () => {
    // DB actual: Zapata a 135 (editada por el usuario) + un rubro propio
    app.setDB({ ESTRUCTURAS: { "Zapata": { unitPrice: 135 }, "Mi rubro": { unitPrice: 9 } } });

    const ok = app.aplicarPreciosRemotos(
      { ESTRUCTURAS: { "Zapata": { unitPrice: 200 }, "Columna": { unitPrice: 300 } } },
      "2026-11",
      "2026-11"
    );

    expect(ok).toBe(true);
    const db = app.getDB();
    expect(db.ESTRUCTURAS["Columna"].unitPrice).toBe(300); // vino de la base nueva
    expect(db.ESTRUCTURAS["Zapata"].unitPrice).toBe(135);  // su edición se conservó
    expect(db.ESTRUCTURAS["Mi rubro"].unitPrice).toBe(9);  // su rubro propio sigue
    expect(localStorage.getItem("ppy_db_version")).toBe("2026-11");
    expect(localStorage.getItem("ppy_db_mes")).toBe("2026-11");
  });

  it("sin datos nuevos, no hace nada", () => {
    app.setDB({ ESTRUCTURAS: {} });
    expect(app.aplicarPreciosRemotos(null, "x", "x")).toBe(false);
  });

  it("marca la base instalada como 'remoto' (para no pisarla en el arranque)", () => {
    app.setDB({ ESTRUCTURAS: {} });
    app.aplicarPreciosRemotos({ ESTRUCTURAS: { "Zapata": { unitPrice: 200 } } }, "2026-11", "2026-11");
    expect(localStorage.getItem("ppy_db_source")).toBe("remoto");
  });
});

describe("origen de la base — que el arranque no baje los precios recibidos", () => {
  it("restaurarPreciosLocales vuelve a la base compilada y limpia la marca", () => {
    app.setDB({ ESTRUCTURAS: { "Zapata": { unitPrice: 200 } } });
    localStorage.setItem("ppy_db_source", "remoto");
    localStorage.setItem("ppy_db_mes", "2026-11");

    app.restaurarPreciosLocales();

    expect(localStorage.getItem("ppy_db_source")).toBeNull();
    expect(localStorage.getItem("ppy_db_mes")).toBeNull();
    // Vuelve a lo que trae compilada la app (no a la copia del suscriptor)
    expect(Object.keys(app.getDB()).length).toBeGreaterThan(0);
    expect(localStorage.getItem("ppy_db_version")).not.toBe("2026-11");
  });

  it("preciosVersionInstalada: manda lo instalado, no la constante compilada", () => {
    localStorage.setItem("ppy_db_version", "2026-01");
    expect(app.preciosVersionInstalada()).toBe("2026-01");

    // Sin instalación previa, cae a la que trae la app
    localStorage.removeItem("ppy_db_version");
    expect(app.preciosVersionInstalada()).toBe(app.preciosInstalados().version);
  });
});
