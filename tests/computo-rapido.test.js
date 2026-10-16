// Cómputo Rápido — presupuestos sueltos sin cliente, convertibles en proyecto.
//
// Cubre lo crítico del modo:
//  1. el borrador vive en state.quickBudgets y NO toca state.projects;
//  2. mientras se edita, getActiveProject()/getActiveAdenda() devuelven el
//     borrador (override) y al cerrar vuelve el proyecto real;
//  3. los ítems agregados al rápido no contaminan el proyecto activo;
//  4. getTotals acepta un borrador sin depender del override;
//  5. la conversión crea proyecto + cliente y saca el borrador de la lista.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

let api;

// clients.js no entra en el loader (solo db_precios + app): las funciones que
// app.js toma de ahí se colocan como globales para que renderBudget y la
// conversión funcionen dentro de los tests.
function stubClientsJs() {
  globalThis.getClients = () => {
    if (!Array.isArray(api.state.clients)) {api.state.clients = [];}
    return api.state.clients;
  };
  globalThis.clientOptionsHtml = () => '<option value="">— Seleccioná un cliente —</option>';
  globalThis.resolveBudgetClient = () => null;
  globalThis.resolveClient = () => null;
}

function unstubClientsJs() {
  delete globalThis.getClients;
  delete globalThis.clientOptionsHtml;
  delete globalThis.resolveBudgetClient;
  delete globalThis.resolveClient;
}

function item(id) {
  return {
    cat: "PISOS", name: "Baldosa calcárea 20x20cm", unit: "m2",
    unitPrice: 10000, matCost: 6000, laborCost: 4000, mats: [],
    qty: 2, id: id || "i1", disc: 0, note: ""
  };
}

describe("Cómputo rápido", () => {
  beforeEach(() => {
    api = loadApp();
    api.resetState();
    api.state.clients = [];
    stubClientsJs();
    // confirm() de jsdom no está implementado: los tests lo resuelven solos.
    globalThis.confirm = () => true;
    document.body.innerHTML =
      '<div id="section-computo_rapido"></div>' +
      '<div id="budget-main-area"></div>' +
      '<div id="modal-area"></div>' +
      '<input id="qk-client-id">' +
      '<input id="qk-new-client">';
  });

  afterEach(() => {
    unstubClientsJs();
    delete globalThis.confirm;
    document.body.innerHTML = "";
  });

  it("crea un borrador sin tocar la lista de proyectos", () => {
    api.makeProject({ items: [item()] });
    const proyectosAntes = api.state.projects.length;

    api.nuevoComputoRapido();

    expect(api.state.quickBudgets.length).toBe(1);
    expect(api.state.projects.length).toBe(proyectosAntes);
    expect(api.state.quickEditingId).toBe(api.state.quickBudgets[0].id);
    expect(api.state.quickBudgets[0].items).toEqual([]);
  });

  it("mientras se edita, la maquinaria del presupuesto opera sobre el borrador", () => {
    const p = api.makeProject({ items: [item("real1")] });
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];

    expect(api.getActiveProject().quick).toBe(true);
    expect(api.getActiveAdenda()).toBe(d);
    // el proyecto real sigue seleccionado en el state (el wrapper no lo pisa)
    expect(api.state.activeProjectId).toBe(p.id);
    expect(api.state.activeAdendaId).toBe("main");
  });

  it("agregar un ítem al rápido no contamina el proyecto real", () => {
    const p = api.makeProject({ items: [] });
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];

    const DB = api.getDB();
    const cat = Object.keys(DB)[0];
    const nombre = Object.keys(DB[cat])[0];
    api.addItem(cat, nombre);

    expect(d.items.length).toBe(1);
    expect(p.budgets[0].items.length).toBe(0);

    api.cerrarComputoRapido();

    expect(api.state.quickEditingId).toBe(null);
    expect(api.getActiveAdenda()).toBe(p.budgets[0]);
    expect(d.items.length).toBe(1); // el borrador conserva lo suyo
  });

  it("los schedules del ítem caen en el borrador y viajan al convertir", () => {
    api.makeProject({ items: [] });
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];

    d.items.push(item("s1"));
    d.schedules["s1"] = { id: "s1", status: "pending" };

    api.volverAListaQuick();

    expect(api.state.quickEditingId).toBe(null);
    expect(api.state.quickBudgets[0].schedules["s1"].status).toBe("pending");
  });

  it("getTotals calcula sobre un borrador aunque no esté en edición", () => {
    const d = {
      id: "qk_x", name: "Sin abrir", items: [item()],
      profitPct: 10, ivaEnabled: false, schedules: {}
    };
    api.state.quickBudgets.push(d);

    const t = api.getTotals(d);

    expect(t.subtotal).toBe(20000);      // 2 ítems x 10.000
    expect(t.profitAmt).toBe(2000);      // 10% de honorarios
    expect(t.total).toBe(22000);
    expect(t.ivaTotal).toBe(0);
  });

  it("duplica un borrador con sus ítems y ids distintos", () => {
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];
    d.items.push(item());

    api.duplicarComputoRapido(d.id);

    expect(api.state.quickBudgets.length).toBe(2);
    const copia = api.state.quickBudgets.find(q => q.id !== d.id);
    expect(copia.id).not.toBe(d.id);
    expect(copia.items.length).toBe(1);
    expect(copia.name).toContain("copia");
    // el original queda igual
    expect(api.findQuickBudget(d.id).items.length).toBe(1);
  });

  it("borrar un borrador lo saca de la lista y desactiva el modo", () => {
    const p = api.makeProject({ items: [] });
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];

    api.borrarComputoRapido(d.id);

    expect(api.state.quickBudgets.length).toBe(0);
    expect(api.state.quickEditingId).toBe(null);
    expect(api.getActiveProject()).toBe(p);   // vuelve al proyecto real
  });

  it("convierte el borrador en proyecto con cliente nuevo y lo saca de la lista", () => {
    api.makeProject({ items: [] });   // proyecto preexistente (queda intacto)
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];
    d.items.push(item());
    d.schedules["i1"] = { id: "i1", status: "pending" };
    d.profitPct = 15;
    d.ivaEnabled = true;

    document.getElementById("qk-new-client").value = "Constructora Delta";
    document.getElementById("qk-client-id").value = "";

    const nuevo = api.convertirQuickAProyecto(d.id);

    expect(api.state.projects.length).toBe(2);           // preexistente + nuevo
    expect(api.state.quickBudgets.length).toBe(0);
    expect(nuevo.client).toBe("Constructora Delta");
    expect(nuevo.clientId).toBeTruthy();
    expect(api.state.clients.some(c => c.name === "Constructora Delta")).toBe(true);

    expect(nuevo.budgets[0].items.length).toBe(1);
    expect(nuevo.budgets[0].profitPct).toBe(15);
    expect(nuevo.budgets[0].ivaEnabled).toBe(true);
    expect(nuevo.execution.schedules.i1.status).toBe("pending");

    // queda activo y sin rastro del modo rápido
    expect(api.state.activeProjectId).toBe(nuevo.id);
    expect(api.state.quickEditingId).toBe(null);
    expect(api.getActiveProject().quick).toBeUndefined();
    expect(api.getActiveAdenda().id).toBe("main");
  });

  it("convierte eligiendo un cliente existente de la base", () => {
    api.state.clients.push({ id: "cli_1", name: "Clara", phone: "0981", address: "", ruc: "", note: "", createdAt: 1 });
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];
    d.items.push(item());

    document.getElementById("qk-client-id").value = "cli_1";
    document.getElementById("qk-new-client").value = "";

    const nuevo = api.convertirQuickAProyecto(d.id);

    expect(nuevo.clientId).toBe("cli_1");
    expect(nuevo.client).toBe("Clara");
    expect(nuevo.phone).toBe("0981");
    expect(api.state.clients.length).toBe(1); // no duplica clientes
  });

  it("no convierte un borrador sin ítems", () => {
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];

    const r = api.convertirQuickAProyecto(d.id);

    expect(r).toBeUndefined();
    expect(api.state.projects.length).toBe(0);
    expect(api.state.quickBudgets.length).toBe(1);
  });

  it("navegar a otra sección desactiva el modo rápido", () => {
    api.makeProject({ items: [] });
    api.nuevoComputoRapido();
    expect(api.state.quickEditingId).toBeTruthy();

    api.setSection("budget");

    expect(api.state.quickEditingId).toBe(null);
    expect(api.getActiveProject().quick).toBeUndefined();
    // el contenedor del editor queda vacío (evita ids duplicados con Presupuesto)
    expect(document.getElementById("section-computo_rapido").innerHTML).toBe("");
  });

  it("al volver a la sección se pinta la lista con el borrador", () => {
    api.nuevoComputoRapido();
    const d = api.state.quickBudgets[0];
    d.items.push(item());
    d.name = "Reforma baños";

    api.volverAListaQuick();   // cierra el modo y vuelve a la lista

    let html = document.getElementById("section-computo_rapido").innerHTML;
    expect(html).toContain("Reforma baños");
    expect(html).toContain("Convertir en proyecto");
    expect(html).toContain("Nuevo cómputo rápido");

    // con el modo activo, entrar a la sección reabre el editor (no la lista)
    api.abrirComputoRapido(d.id);
    api.setSection("computo_rapido");
    html = document.getElementById("section-computo_rapido").innerHTML;
    expect(html).toContain("BORRADOR");
    expect(html).toContain("← Volver");
  });

  it("ir a Cómputo de Materiales conserva el borrador; Presupuesto lo apaga", () => {
    api.makeProject({ items: [] });
    api.nuevoComputoRapido();

    api.setSection("computo");
    expect(api.state.quickEditingId).toBeTruthy();
    expect(api.getActiveProject().quick).toBe(true);

    api.setSection("budget");
    expect(api.state.quickEditingId).toBe(null);
    expect(api.getActiveProject().quick).toBeUndefined();
  });
});
