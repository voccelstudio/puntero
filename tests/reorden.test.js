// Reordenar ítems y categorías del presupuesto (arrastrando o con ↑↓).
// El orden del array adenda.items es el que ven la tabla, el PDF y el CSV
// (todo agrupa por categoría preservando el orden relativo), así que estas
// tres funciones son el contrato que usa la UI de drag & drop.
import { describe, it, expect, beforeEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

let api;

function mkItem(id, cat, extra) {
  return Object.assign({
    id, cat, name: "Ítem " + id, unit: "m2",
    unitPrice: 1000, matCost: 600, laborCost: 400,
    mats: [], qty: 1, disc: 0, note: "",
  }, extra || {});
}

describe("Reordenar ítems", () => {
  beforeEach(() => {
    api = loadApp();
    api.resetState();
    // Sin #table-area en jsdom, renderTable sale temprano: el reordenamiento
    // debe funcionar igual y solo persistir.
  });

  it("mueve un ítem dentro de su categoría y conserva la categoría", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS"), mkItem("a2", "PISOS")] });
    api.moveItemTo("a1", "a2", "after");
    expect(p.budgets[0].items.map(x => x.id)).toEqual(["b1", "a2", "a1"]);
    expect(p.budgets[0].items.find(x => x.id === "a1").cat).toBe("PISOS");
    // En la tabla (agrupada por cat) PISOS queda [a2, a1]: el orden relativo cambió.
    const pisos = p.budgets[0].items.filter(x => x.cat === "PISOS").map(x => x.id);
    expect(pisos).toEqual(["a2", "a1"]);
  });

  it("soltar sobre otra categoría reasigna la categoría y respeta la posición", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS"), mkItem("b2", "ESTRUCTURAS")] });
    api.moveItemTo("a1", "b1", "before");
    expect(p.budgets[0].items.map(x => x.id)).toEqual(["a1", "b1", "b2"]);
    expect(p.budgets[0].items.find(x => x.id === "a1").cat).toBe("ESTRUCTURAS");
  });

  it("soltar sobre el encabezado de otra categoría lo coloca al inicio del grupo", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS"), mkItem("b2", "ESTRUCTURAS")] });
    api.moveItemToCat("a1", "ESTRUCTURAS", "");
    expect(p.budgets[0].items.map(x => x.id)).toEqual(["a1", "b1", "b2"]);
    expect(p.budgets[0].items.find(x => x.id === "a1").cat).toBe("ESTRUCTURAS");
  });

  it("un ítem único en su grupo no se mueve al soltar sobre su propio encabezado", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS")] });
    api.moveItemToCat("a1", "PISOS", "");
    expect(p.budgets[0].items.map(x => x.id)).toEqual(["a1", "b1"]);
  });

  it("mueve el bloque completo de una categoría (antes y después)", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS"), mkItem("a2", "PISOS"), mkItem("c1", "PINTURA")] });
    api.moveCatGroup("PISOS", "", "PINTURA", "", "before");
    // PISOS pasa a arrancar donde está PINTURA: primer aspecto de PISOS después del de ESTRUCTURAS.
    expect(p.budgets[0].items.map(x => x.id)).toEqual(["b1", "a1", "a2", "c1"]);

    const q = api.makeProject({ id: "p2", items: [mkItem("x1", "PISOS"), mkItem("y1", "ESTRUCTURAS")] });
    api.moveCatGroup("PISOS", "", "ESTRUCTURAS", "", "after");
    expect(q.budgets[0].items.map(x => x.id)).toEqual(["y1", "x1"]);
  });

  it("mover el bloque a la misma categoría/fase no hace nada", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS")] });
    api.moveCatGroup("PISOS", "", "PISOS", "", "before");
    expect(p.budgets[0].items.map(x => x.id)).toEqual(["a1", "b1"]);
  });

  it("al cruzar de categoría hereda la fase del ítem destino", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS"), mkItem("b1", "ESTRUCTURAS", { phase: "f2" })] });
    p.budgets[0].phases = [{ id: "f1", name: "Instalación básica" }, { id: "f2", name: "Terminaciones" }];
    api.moveItemTo("a1", "b1", "after");
    const a1 = p.budgets[0].items.find(x => x.id === "a1");
    expect(a1.phase).toBe("f2");
    expect(a1.cat).toBe("ESTRUCTURAS");

    // Al mover un bloque entre fases, todos sus ítems pasan a la fase destino.
    const q = api.makeProject({ id: "p2", items: [mkItem("z1", "PISOS", { phase: "f1" }), mkItem("w1", "PINTURA", { phase: "f2" })] });
    q.budgets[0].phases = [{ id: "f1", name: "Instalación básica" }, { id: "f2", name: "Terminaciones" }];
    api.moveCatGroup("PISOS", "f1", "PINTURA", "f2", "before");
    const z1 = q.budgets[0].items.find(x => x.id === "z1");
    expect(z1.phase).toBe("f2");
    expect(z1.cat).toBe("PINTURA");
  });

  it("una fase vieja que ya no está en la config se trata como sin fase", () => {
    const p = api.makeProject({ items: [mkItem("a1", "PISOS", { phase: "borrada" }), mkItem("b1", "ESTRUCTURAS")] });
    p.budgets[0].phases = [{ id: "f1", name: "Instalación básica" }];
    api.moveItemTo("a1", "b1", "after");
    const a1 = p.budgets[0].items.find(x => x.id === "a1");
    expect(a1.phase).toBeUndefined(); // join del destino "sin fase" sin arrastrar la fase vieja
  });
});
