import { describe, it, expect, beforeEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

// Tests del backup y la restauración.
// Lo que acá se protege no es un detalle de formato: es la única forma que tiene
// un cliente sin nube (plan Usuario) de no perder una obra entera. Se prueba la
// implementación REAL (mismo código que corre en el navegador), incluida la
// compatibilidad con los backups viejos que ya tienen los clientes.

const app = loadApp();

const CLAVE_SECCION = app.BACKUP_PRESERVA; // ["section", "theme", "_cloudSyncEnabled"]

function estadoConObra() {
  app.state.projects = [{
    id: "p1", name: "Casa López", client: "López",
    budgets: [{ id: "main", name: "Principal", items: [
      { id: 1, name: "Zapata" }, { id: 2, name: "Ladrillo" }
    ] }]
  }];
  app.state.clients = [{ id: "c1", name: "López" }];
  app.state.contractors = [{ id: "k1", name: "Ramón" }];
  limpiarLegado();
}

function estadoVacio() {
  app.state.projects = [];
  app.state.clients = [];
  app.state.contractors = [];
  limpiarLegado();
}

// jsdom comparte UNA sola instancia de la app entre todos los tests, así que
// quedan claves de versiones viejas (state.budgets, jornaleros, flags). Sin esto,
// restaurar dispara migrateToMultiProject() y el test ve una obra que nadie puso.
function limpiarLegado() {
  delete app.state.budgets;
  delete app.state.jornaleros;
  delete app.state.adjustPct;
  app.state.migratedV6 = true;
  delete window._backupParaDeshacer;
}

beforeEach(() => {
  estadoVacio();
  app.state.section = "budget";
  app.state.theme = "dark";
  localStorage.removeItem("ppy_db_version");
  localStorage.removeItem("ppy_db_mes");
  localStorage.removeItem("ppy_db_source");
  delete window._backupParaDeshacer;
});

describe("resumenDatos() — lo que el usuario ve antes de confirmar", () => {
  it("cuenta obras, presupuestos, ítems y gente", () => {
    estadoConObra();
    const r = app.resumenDatos(app.state, app.getDB());
    expect(r.proyectos).toBe(1);
    expect(r.presupuestos).toBe(1);
    expect(r.items).toBe(2);
    expect(r.clientes).toBe(1);
    expect(r.contratistas).toBe(1);
    expect(r.categoriasPrecios).toBeGreaterThan(0);
    expect(r.rubrosPrecios).toBeGreaterThan(0);
  });

  it("cuenta vacío sin romperse", () => {
    const r = app.resumenDatos(app.state, {});
    expect(r).toEqual({
      proyectos: 0, presupuestos: 0, items: 0, clientes: 0,
      contratistas: 0, jornaleros: 0, proveedores: 0,
      categoriasPrecios: 0, rubrosPrecios: 0
    });
    expect(app.resumenTexto(r)).toBe("0 proyectos · 0 presupuestos · 0 ítems · 0 clientes · 0 contratistas");
  });

  it("con una sola obra no escribe el plural de más", () => {
    estadoConObra();
    const t = app.resumenTexto(app.resumenDatos(app.state, app.getDB()));
    expect(t).toContain("1 proyecto ");
    expect(t).toContain("1 presupuesto ");
    expect(t).toContain("2 ítems");
  });
});

describe("serializarBackup() — qué viaja en el archivo", () => {
  it("es una foto con marca de app, esquema y versión de precios", () => {
    estadoConObra();
    const b = app.serializarBackup();
    expect(b.app).toBe("Puntero");
    expect(b.schema).toBe(app.BACKUP_SCHEMA);
    expect(typeof b.exportedAt).toBe("string");
    expect(b.version).toBeTruthy();
    expect(b.meta).toBeTruthy();
    expect(b.resumen.proyectos).toBe(1);
    expect(b.state.projects).toHaveLength(1);
    expect(Object.keys(b.db).length).toBeGreaterThan(0);
  });

  it("es una copia profunda: editar después no toca el backup", () => {
    estadoConObra();
    const b = app.serializarBackup();
    app.state.projects[0].name = "Editado después";
    app.state.clients.push({ id: "c2", name: "Otro" });
    expect(b.state.projects[0].name).toBe("Casa López");
    expect(b.state.clients).toHaveLength(1);
  });

  it("guarda la metadata de precios instalada (versión, mes y origen)", () => {
    localStorage.setItem("ppy_db_version", "2026-10-saneamiento-mo-r2-rubros");
    localStorage.setItem("ppy_db_mes", "2026-10");
    localStorage.setItem("ppy_db_source", "remoto");
    const b = app.serializarBackup();
    expect(b.meta.version).toBe("2026-10-saneamiento-mo-r2-rubros");
    expect(b.meta.mes).toBe("2026-10");
    expect(b.meta.source).toBe("remoto");
  });
});

describe("validarBackup() — un archivo ajeno no puede reemplazar una obra", () => {
  const db = { ESTRUCTURAS: { Zapata: { unit: "m3" } } };

  it("acepta un backup propio", () => {
    estadoConObra();
    expect(app.validarBackup(app.serializarBackup()).ok).toBe(true);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["texto plano", "hola"],
    ["número", 42],
    ["array", [{ state: {} }]],
    ["objeto vacío", {}],
    ["de otra app", { app: "OtraApp", state: { projects: [] }, db }],
    ["sin state", { app: "Puntero", db }],
    ["state que no es objeto", { app: "Puntero", state: "x", db }],
    ["sin lista de proyectos", { app: "Puntero", state: {}, db }],
    ["proyectos que no es lista", { app: "Puntero", state: { projects: {} }, db }],
    ["sin base de precios", { app: "Puntero", state: { projects: [] }, db: {} }],
    ["base que no es objeto", { app: "Puntero", state: { projects: [] }, db: [] }]
  ])("rechaza %s", (_caso, entrada) => {
    const v = app.validarBackup(entrada);
    expect(v.ok).toBe(false);
    expect(v.errores.length).toBeGreaterThan(0);
  });

  it("acepta los backups viejos (v1, sin marca de esquema)", () => {
    const v = app.validarBackup({
      state: { projects: [] },
      db,
      exportedAt: "2025-01-01T00:00:00.000Z"
    });
    expect(v.ok).toBe(true);
  });

  it("avisa pero no bloquea si fue hecho por una versión más nueva", () => {
    const v = app.validarBackup({
      app: "Puntero", schema: app.BACKUP_SCHEMA + 5, version: "futura",
      state: { projects: [] }, db
    });
    expect(v.ok).toBe(true);
    expect(v.advertencias.join(" ")).toMatch(/más nueva/);
  });
});

describe("aplicarBackup() — restaurar sin perder el dispositivo", () => {
  it("rechaza un archivo inválido sin tocar los datos", () => {
    estadoConObra();
    const r = app.aplicarBackup({ app: "Puntero", state: {}, db: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(app.state.projects).toHaveLength(1);
  });

  it("restaura obra por obra, cliente por cliente", () => {
    estadoConObra();
    const b = app.serializarBackup();   // foto con Casa López
    estadoVacio();                       // se perdió todo
    const r = app.aplicarBackup(b);
    expect(r.ok).toBe(true);
    expect(app.state.projects[0].name).toBe("Casa López");
    expect(app.state.projects[0].budgets[0].items).toHaveLength(2);
    expect(app.state.clients).toHaveLength(1);
    expect(app.state.contractors).toHaveLength(1);
    expect(r.resumen.proyectos).toBe(1);
  });

  it("conserva las preferencias del dispositivo (tema, sección, sync)", () => {
    const b = app.serializarBackup();
    app.state.section = "logs";
    app.state.theme = "light";
    app.state._cloudSyncEnabled = true;
    b.state.section = "budget";
    b.state.theme = "dark";
    b.state._cloudSyncEnabled = false;
    app.aplicarBackup(b);
    expect(app.state.section).toBe("logs");
    expect(app.state.theme).toBe("light");
    expect(app.state._cloudSyncEnabled).toBe(true);
  });

  it("solo conserva las claves declaradas", () => {
    expect(CLAVE_SECCION).toEqual(["section", "theme", "_cloudSyncEnabled"]);
  });

  it("marca el estado como modificado para que la nube lo vea", () => {
    const b = app.serializarBackup();
    app.state._localModifiedAt = 0;
    app.aplicarBackup(b);
    expect(app.state._localModifiedAt).toBeGreaterThan(0);
  });

  it("restaura la metadata de precios del backup, no la compilada", () => {
    const b = app.serializarBackup();
    b.meta = { version: "precios-del-suscriptor", mes: "2026-08", source: "remoto" };
    b.version = "precios-del-suscriptor";
    app.aplicarBackup(b);
    expect(localStorage.getItem("ppy_db_version")).toBe("precios-del-suscriptor");
    expect(localStorage.getItem("ppy_db_mes")).toBe("2026-08");
    expect(localStorage.getItem("ppy_db_source")).toBe("remoto");
  });

  it("un backup normal limpia el origen remoto para poder migrar después", () => {
    localStorage.setItem("ppy_db_source", "remoto");
    const b = app.serializarBackup();
    b.meta = { version: "vieja", mes: null, source: null };
    app.aplicarBackup(b);
    expect(localStorage.getItem("ppy_db_source")).toBe(null);
  });

  it("el reemplazo es completo, no un merge a medias", () => {
    const b = app.serializarBackup();
    b.state.projects = [];
    app.state.projects.push({ id: "p_no_pertenece", name: "Debería irse" });
    app.aplicarBackup(b);
    expect(app.state.projects).toHaveLength(0);
  });
});

describe("deshacerRestore() — un restore equivocado tiene vuelta atrás", () => {
  it("no hay nada que deshacer si no se restauró", () => {
    expect(app.deshacerRestore()).toBe(false);
  });

  it("devuelve exactamente lo que había antes de restaurar", () => {
    estadoConObra();
    const b = app.serializarBackup();            // foto: Casa López
    app.state.projects[0].name = "Casa López (editada)";
    app.state.clients.push({ id: "c2", name: "Nuevo cliente" });
    const antes = JSON.parse(JSON.stringify(app.state));

    app.aplicarBackup(b);                        // restaura la foto vieja
    expect(app.state.projects[0].name).toBe("Casa López");
    expect(app.state.clients).toHaveLength(1);

    expect(app.deshacerRestore()).toBe(true);
    expect(app.state.projects[0].name).toBe("Casa López (editada)");
    expect(app.state.clients).toHaveLength(2);
    // _localModifiedAt se refresca (hubo un cambio real): se ignora para comparar
    // el contenido, que es lo que importa.
    const copia = JSON.parse(JSON.stringify(app.state));
    delete copia._localModifiedAt;
    const original = JSON.parse(JSON.stringify(antes));
    delete original._localModifiedAt;
    expect(copia).toEqual(original);
  });

  it("consume la copia de seguridad (solo sirve una vez)", () => {
    const b = app.serializarBackup();
    app.aplicarBackup(b);
    expect(app.deshacerRestore()).toBe(true);
    expect(app.deshacerRestore()).toBe(false);
    expect(window._backupParaDeshacer).toBe(undefined);
  });
});

describe("metaPrecios() — de dónde salió la base instalada", () => {
  it("lee lo que hay en localStorage", () => {
    localStorage.setItem("ppy_db_version", "v-test");
    localStorage.setItem("ppy_db_mes", "2026-03");
    localStorage.setItem("ppy_db_source", "remoto");
    expect(app.metaPrecios()).toEqual({ version: "v-test", mes: "2026-03", source: "remoto" });
  });

  it("sin nada instalado, cae a la versión compilada", () => {
    const m = app.metaPrecios();
    expect(m.version).toBeTruthy();
    expect(m.source).toBe(null);
  });

  it("aplicarMetaPrecios escribe y limpia de forma simétrica", () => {
    app.aplicarMetaPrecios({ version: "v1", mes: "2026-01", source: "remoto" });
    expect(app.metaPrecios()).toEqual({ version: "v1", mes: "2026-01", source: "remoto" });
    app.aplicarMetaPrecios(null);
    // Se limpiaron las claves: sin mes instalado, metaPrecios() cae a la
    // compilada (DB_MES) — que es exactamente lo que debe pasar en el arranque.
    expect(localStorage.getItem("ppy_db_mes")).toBe(null);
    expect(localStorage.getItem("ppy_db_source")).toBe(null);
    expect(app.metaPrecios().version).toBeTruthy();
  });
});

describe("haceTexto() — fechas legibles en el historial", () => {
  it("recién para lo que acaba de pasar", () => {
    expect(app.haceTexto(Date.now() - 5000)).toBe("recién");
    expect(app.haceTexto(Date.now() - 10 * 60000)).toBe("hace 10 min");
    expect(app.haceTexto(Date.now() - 3 * 3600000)).toBe("hace 3 h");
    expect(app.haceTexto(Date.now() - 2 * 86400000)).toBe("hace 2 días");
    expect(app.haceTexto(Date.now() - 86400000)).toBe("ayer");
    expect(app.haceTexto(null)).toBe("sin fecha");
  });
});

describe("guardarCopiaLocal() — historial", () => {
  it("sin IndexedDB no promete nada (devuelve false)", async () => {
    expect(app.state.projects).toBeDefined();
    await expect(app.guardarCopiaLocal("auto")).resolves.toBe(false);
  });
});
