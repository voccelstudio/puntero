import { describe, it, expect, beforeEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

// Tests de negocio sobre el CÓDIGO REAL de la app (no copias).
// Cubren: totales del presupuesto, IVA, descuentos, profit, cómputo de
// materiales y aislamiento multi-proyecto.

const app = loadApp();

beforeEach(() => {
  app.resetState();
});

// ── getTotals ──────────────────────────────────────────────────────────
describe("getTotals()", () => {
  it("suma materiales, mano de obra y subtotal por cantidad", () => {
    app.makeProject({
      items: [
        { id: 1, cat: "ESTRUCTURAS", name: "Zapata", unit: "m3", qty: 2, unitPrice: 100, matCost: 60, laborCost: 40, mats: [], disc: 0 },
        { id: 2, cat: "ESTRUCTURAS", name: "Columna", unit: "m3", qty: 3, unitPrice: 200, matCost: 120, laborCost: 80, mats: [], disc: 0 },
      ],
    });
    const t = app.getTotals();
    // totalMats = 60*2 + 120*3 = 480
    expect(t.totalMats).toBe(480);
    // totalLabor = 40*2 + 80*3 = 320
    expect(t.totalLabor).toBe(320);
    // subtotal = 100*2 + 200*3 = 800
    expect(t.subtotal).toBe(800);
    expect(t.total).toBe(800); // sin IVA ni profit
  });

  it("aplica descuento por ítem sobre mats, labor y subtotal", () => {
    app.makeProject({
      items: [
        { id: 1, cat: "X", name: "A", unit: "u", qty: 2, unitPrice: 100, matCost: 60, laborCost: 40, mats: [], disc: 10 },
      ],
    });
    const t = app.getTotals();
    // 10% off: unitPrice 100*0.9*2 = 180
    expect(t.subtotal).toBe(180);
    expect(t.totalMats).toBe(108); // 60*0.9*2
    expect(t.totalLabor).toBe(72); // 40*0.9*2
  });

  it("calcula profit sobre (subtotal + IVA)", () => {
    app.makeProject({
      profitPct: 5,
      items: [
        { id: 1, cat: "X", name: "A", unit: "u", qty: 1, unitPrice: 100, matCost: 60, laborCost: 40, mats: [], disc: 0 },
      ],
    });
    const t = app.getTotals();
    // profit = subtotal(100) * 5% = 5 ; total = 100 + 5 = 105
    expect(t.profitAmt).toBe(5);
    expect(t.total).toBe(105);
  });

  it("devuelve todo en cero si no hay adenda activa", () => {
    // makeProject sin items -> adenda existe pero vacía; probamos sin proyecto
    const t = app.getTotals();
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
    expect(t.ivaTotal).toBe(0);
  });
});

// ── IVA ────────────────────────────────────────────────────────────────
describe("calcIVA() y getTotals() con IVA", () => {
  it("usa las tasas reales IVA_MAT=10% e IVA_LAB=5%", () => {
    expect(app.IVA_MAT).toBe(0.1);
    expect(app.IVA_LAB).toBe(0.05);
  });

  it("devuelve cero cuando ivaEnabled está apagado", () => {
    app.makeProject({ ivaEnabled: false, items: [{ id: 1, cat: "X", name: "A", unit: "u", qty: 1, unitPrice: 100, matCost: 60, laborCost: 40, mats: [], disc: 0 }] });
    const r = app.calcIVA(100000, 50000, 10);
    expect(r).toEqual({ ivaMat: 0, ivaLab: 0, ivaTotal: 0 });
  });

  it("calcula 10% sobre materiales y 5% sobre mano de obra", () => {
    app.makeProject({ ivaEnabled: true, items: [] });
    // ivaMat = round(100000*10*0.10) = 100000
    // ivaLab = round(50000*10*0.05) = 25000
    const r = app.calcIVA(100000, 50000, 10);
    expect(r.ivaMat).toBe(100000);
    expect(r.ivaLab).toBe(25000);
    expect(r.ivaTotal).toBe(125000);
  });

  it("getTotals suma el IVA al total cuando ivaEnabled", () => {
    app.makeProject({
      ivaEnabled: true,
      items: [{ id: 1, cat: "X", name: "A", unit: "u", qty: 10, unitPrice: 1000, matCost: 600, laborCost: 400, mats: [], disc: 0 }],
    });
    const t = app.getTotals();
    // subtotal = 1000*10 = 10000
    expect(t.subtotal).toBe(10000);
    // ivaMat = round(600*10*0.10) = 600 ; ivaLab = round(400*10*0.05) = 200
    expect(t.ivaMat).toBe(600);
    expect(t.ivaLab).toBe(200);
    expect(t.ivaTotal).toBe(800);
    expect(t.total).toBe(10800);
  });
});

// ── Cómputo de materiales ──────────────────────────────────────────────
describe("calcItemMaterials()", () => {
  it("expande el formato compacto {n,q,u} multiplicando por qty del ítem", () => {
    const out = app.calcItemMaterials({ qty: 3, mats: [{ n: "Cemento", q: 2, u: "kg" }] });
    expect(out).toEqual([{ name: "Cemento", unit: "kg", qty: 6 }]);
  });

  it("expande el formato extendido {name,qty,unit}", () => {
    const out = app.calcItemMaterials({ qty: 2, mats: [{ name: "Arena", qty: 5, unit: "m3" }] });
    expect(out).toEqual([{ name: "Arena", unit: "m3", qty: 10 }]);
  });

  it("devuelve vacío si el ítem no tiene mats", () => {
    expect(app.calcItemMaterials({ qty: 1 })).toEqual([]);
    expect(app.calcItemMaterials(null)).toEqual([]);
  });
});

describe("calcMaterials()", () => {
  it("agrupa materiales repetidos por nombre+unidad y ordena alfabéticamente", () => {
    app.makeProject({
      items: [
        { id: 1, cat: "E", name: "Zapata", unit: "m3", qty: 2, unitPrice: 1, matCost: 1, laborCost: 1, mats: [{ n: "Cemento", q: 4, u: "kg" }], disc: 0 },
        { id: 2, cat: "E", name: "Columna", unit: "m3", qty: 3, unitPrice: 1, matCost: 1, laborCost: 1, mats: [{ n: "Cemento", q: 4, u: "kg" }], disc: 0 },
        { id: 3, cat: "M", name: "Muro", unit: "m2", qty: 1, unitPrice: 1, matCost: 1, laborCost: 1, mats: [{ n: "Ladrillo", q: 10, u: "un" }], disc: 0 },
      ],
    });
    const mats = app.calcMaterials();
    // Cemento: 4*2 + 4*3 = 20 ; Ladrillo: 10*1 = 10
    expect(mats).toEqual([
      { name: "Cemento", unit: "kg", qty: 20 },
      { name: "Ladrillo", unit: "un", qty: 10 },
    ]);
  });

  it("devuelve vacío si no hay proyecto activo", () => {
    expect(app.calcMaterials()).toEqual([]);
  });
});

// ── Selección de proyecto/adenda ───────────────────────────────────────
describe("getActiveProject() / getActiveAdenda()", () => {
  it("cae al primer proyecto si no hay activeProjectId", () => {
    app.makeProject({ id: "pa", name: "A" });
    app.state.activeProjectId = null;
    expect(app.getActiveProject().id).toBe("pa");
  });

  it("getActiveAdenda devuelve null si el proyecto no tiene budgets", () => {
    app.state.projects.push({ id: "pz", name: "Vacío", budgets: [], execution: {} });
    app.state.activeProjectId = "pz";
    app.state.activeAdendaId = null;
    expect(app.getActiveAdenda()).toBeNull();
  });
});

// ── Aislamiento multi-proyecto ─────────────────────────────────────────
describe("aislamiento entre proyectos", () => {
  it("cambiar de proyecto aísla los items y totales", () => {
    app.makeProject({
      id: "p1",
      items: [{ id: 1, cat: "X", name: "A", unit: "u", qty: 1, unitPrice: 100, matCost: 60, laborCost: 40, mats: [], disc: 0 }],
    });
    // Segundo proyecto
    app.state.projects.push({
      id: "p2", name: "Obra 2",
      budgets: [{ id: "main", name: "P", profitPct: 0, ivaEnabled: false, items: [{ id: 9, cat: "X", name: "Y", unit: "u", qty: 1, unitPrice: 10, matCost: 6, laborCost: 4, mats: [], disc: 0 }] }],
      execution: { schedules: {}, dailyLogs: [] },
    });

    app.state.activeProjectId = "p2";
    app.state.activeAdendaId = "main";
    expect(app.getTotals().subtotal).toBe(10);

    app.state.activeProjectId = "p1";
    app.state.activeAdendaId = "main";
    expect(app.getTotals().subtotal).toBe(100);
  });
});
