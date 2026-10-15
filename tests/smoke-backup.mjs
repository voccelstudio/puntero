import { spawn } from "node:child_process";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

// ── PRUEBA DE RECUPERACIÓN ──────────────────────────────────────────────────
// "Un backup que no se puede restaurar no es un backup." Se simula lo que le
// pasa a un cliente de verdad, en orden:
//
//   1. Trabaja: crea obra, cliente y contratista
//   2. Borra "los datos del sitio"  → lo recupera SOLO, de IndexedDB
//   3. Borra también IndexedDB      → pierde todo, solo queda el archivo
//   4. Restaura desde el archivo   → vuelve con todo
//   5. Un archivo equivocado NO toca los datos
//   6. Una restauración equivocada se puede DESHACER
//   7. El historial local se respeta y respeta su tope

const PUERTO = 4609;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-backup-${Date.now()}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const OBRA = "OBRA-BACKUP-QA";

const serverListo = () => new Promise((resolve) => {
  const t = setInterval(() => {
    const req = http.get(URL, (res) => { res.resume(); clearInterval(t); resolve(); });
    req.on("error", () => {});
  }, 400);
});

const report = [];
const ok = (m) => report.push("PASS  " + m);
const fail = (m) => report.push("FAIL  " + m);
const chk = (label, cond, extra) => (cond ? ok(label + ": sí") : fail(label + (extra !== undefined ? " → " + extra : " → NO")));

const main = async () => {
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  let browser;
  try {
    await serverListo();
    browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    page.setCacheEnabled(false);
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => localStorage.setItem("pte_master_session", "1"));
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(2500);

    // ── 1. Arranque: los datos están y la primera copia se creó sola ─────────
    const arranque = await page.evaluate(async () => ({
      proyectos: state.projects.length,
      clientes: (state.clients || []).length,
      copias: (await listarCopiasLocales()).length
    }));
    chk("arranca con los datos cargados", arranque.proyectos >= 1, arranque.proyectos);
    chk("creó la primera copia local automática (sin que nadie la pida)", arranque.copias >= 1, arranque.copias);

    // ── 2. Trabaja: obra + cliente + contratista, y serializa el backup ──────
    const creado = await page.evaluate((obra) => {
      state.projects.push({
        id: "obra_backup_qa", name: obra, client: "Cliente Backup QA",
        phone: "0971 000 111", status: "active", activeAdendaId: "main",
        budgets: [{
          id: "b_qa", name: "Presupuesto QA", profitPct: 0, ivaEnabled: false, notes: "",
          items: [
            { id: 1, cat: "ESTRUCTURAS", name: "Zapata fck=18 MPa", unit: "m3", qty: 4, unitPrice: 2554380, matCost: 1851000, laborCost: 703380, mats: [], disc: 0, note: "" },
            { id: 2, cat: "MAMPOSTERÍA", name: "Elevación 0.15m ladrillo común", unit: "m2", qty: 120, unitPrice: 125000, matCost: 91838, laborCost: 33162, mats: [], disc: 0, note: "" }
          ]
        }],
        execution: { schedules: {}, dailyLogs: [], materialOrders: [], finances: { income: [], expenses: [] }, documents: [] }
      });
      state.clients = state.clients || [];
      state.clients.push({ id: "cli_backup_qa", name: "Cliente Backup QA", phone: "0971 000 111" });
      state.contractors = state.contractors || [];
      state.contractors.push({ id: "con_backup_qa", name: "Contratista Backup QA", trade: "Albañilería" });
      save();
      return { proyectos: state.projects.length, clientes: state.clients.length, contratistas: state.contractors.length };
    }, OBRA);
    chk("obra, cliente y contratista creados", creado.proyectos >= 2 && creado.clientes >= 1 && creado.contratistas >= 1, JSON.stringify(creado));

    // El backup pasa por JSON igual que cuando el usuario elige el archivo
    const backup = await page.evaluate(() => JSON.parse(JSON.stringify(serializarBackup())));
    const validacion = await page.evaluate((b) => validarBackup(b), backup);
    chk("el backup serializado valida", validacion.ok === true, JSON.stringify(validacion.errores));
    chk("el backup declara de qué app y de qué versión es", backup.app === "Puntero" && !!backup.version && !!backup.meta, JSON.stringify({ app: backup.app, version: backup.version }));

    // ── 3. BORRA "los datos del sitio" (queda IndexedDB) → se recupera solo ──
    await page.evaluate(() => { localStorage.removeItem("ppy_v5"); localStorage.removeItem("ppy_db5"); });
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(2500);
    const espejo = await page.evaluate((obra) => ({
      recuperada: state.projects.some((p) => p.name === obra),
      proyectos: state.projects.length
    }), OBRA);
    chk("borró localStorage y la obra volvió sola desde IndexedDB", espejo.recuperada === true, JSON.stringify(espejo));

    // ── 4. Borra TODO (localStorage + IndexedDB) → pierde todo ───────────────
    const borrado = await page.evaluate(async () => {
      localStorage.clear();
      if (window._DEXIE) { window._DEXIE.close(); }
      await new Promise((res) => {
        const r = indexedDB.deleteDatabase("PunteroDB");
        r.onsuccess = () => res(true);
        r.onerror = () => res(false);
        r.onblocked = () => res(false);
      });
      return true;
    });
    chk("borrado total de los datos del sitio", borrado === true);
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(2500);
    const perdido = await page.evaluate(async (obra) => ({
      recuperada: state.projects.some((p) => p.name === obra),
      historial: (await listarCopiasLocales()).length
    }), OBRA);
    chk("ahora la obra NO está en el dispositivo (está perdida de verdad)", perdido.recuperada === false, JSON.stringify(perdido));

    // ── 5. Un archivo equivocado no puede tocar los datos ────────────────────
    const rechazos = await page.evaluate(() => [
      { caso: "null", r: validarBackup(null) },
      { caso: "objeto vacío", r: validarBackup({}) },
      { caso: "texto plano", r: validarBackup("hola") },
      { caso: "array", r: validarBackup([1, 2, 3]) },
      { caso: "de otra app", r: validarBackup({ app: "OtraApp", state: { projects: [] }, db: { cat: { x: {} } } }) },
      { caso: "sin proyectos", r: validarBackup({ app: "Puntero", state: {}, db: { cat: { x: {} } } }) },
      { caso: "sin base de precios", r: validarBackup({ app: "Puntero", state: { projects: [] }, db: {} }) }
    ]);
    chk("detecta archivos inválidos (7 casos)", rechazos.every((x) => x.r.ok === false), JSON.stringify(rechazos.filter((x) => x.r.ok).map((x) => x.caso)));

    const tocado = await page.evaluate((obra) => {
      const antes = state.projects.map((p) => p.name).join(",");
      const r = aplicarBackup({ app: "Puntero", state: {}, db: {} });
      const despues = state.projects.map((p) => p.name).join(",");
      return { r, sinCambios: antes === despues, tieneObra: state.projects.some((p) => p.name === obra) };
    }, OBRA);
    chk("un archivo inválido no modifica los datos", tocado.r.ok === false && tocado.sinCambios === true, JSON.stringify(tocado));

    // ── 6. Restaura desde el archivo y vuelve TODO ───────────────────────────
    const restaurado = await page.evaluate((b) => {
      const r = aplicarBackup(b);
      return {
        ok: r.ok, resumen: r.resumen,
        proyectos: state.projects.length,
        clientes: (state.clients || []).length,
        contratistas: (state.contractors || []).length,
        items: state.projects.reduce((n, p) => n + (p.budgets || []).reduce((m, bd) => m + (bd.items || []).length, 0), 0),
        version: localStorage.getItem("ppy_db_version"),
        source: localStorage.getItem("ppy_db_source"),
        modificado: !!state._localModifiedAt
      };
    }, backup);
    chk("restaura desde el archivo", restaurado.ok === true, JSON.stringify(restaurado.resumen));
    chk("vuelve la obra y el presupuesto íntegros",
      restaurado.proyectos === backup.resumen.proyectos && restaurado.items === backup.resumen.items,
      `obras ${restaurado.proyectos}/${backup.resumen.proyectos} · ítems ${restaurado.items}/${backup.resumen.items}`);
    chk("vuelven cliente y contratista",
      restaurado.clientes === backup.resumen.clientes && restaurado.contratistas === backup.resumen.contratistas,
      `${restaurado.clientes}/${backup.resumen.clientes} · ${restaurado.contratistas}/${backup.resumen.contratistas}`);
    chk("la metadata de precios viaja con el backup (no queda pisada)",
      restaurado.version === backup.meta.version && restaurado.source === backup.meta.source,
      JSON.stringify({ version: restaurado.version, esperado: backup.meta.version, source: restaurado.source, esperadoSource: backup.meta.source }));
    chk("queda marcado como modificado (para que la nube lo vea)", restaurado.modificado === true);

    // ── 7. Lo restaurado sobrevive a un reinicio ─────────────────────────────
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(2500);
    const persistio = await page.evaluate((obra) => ({
      obra: state.projects.some((p) => p.name === obra),
      clientes: (state.clients || []).filter((c) => c.id === "cli_backup_qa").length
    }), OBRA);
    chk("lo restaurado sigue ahí después de recargar", persistio.obra === true && persistio.clientes === 1, JSON.stringify(persistio));

    // ── 8. Una restauración equivocada se puede deshacer ─────────────────────
    const undo = await page.evaluate((b) => {
      const obraQa = () => state.projects.find((p) => p.id === "obra_backup_qa");
      obraQa().name = "OBRA-CAMBIO-DESPUES-DEL-BACKUP";
      save();
      const r = aplicarBackup(b);
      const nombreTrasRestaurar = obraQa().name;
      const hayCopia = !!window._backupParaDeshacer;
      deshacerRestore();
      return { ok: r.ok, nombreTrasRestaurar, hayCopia, nombreTrasUndo: obraQa().name, quedoSinCopia: !window._backupParaDeshacer };
    }, backup);
    chk("restaurar pone los datos del backup", undo.ok === true && undo.nombreTrasRestaurar === OBRA, undo.nombreTrasRestaurar);
    chk("guarda una copia de lo que había antes", undo.hayCopia === true);
    chk("deshacer devuelve exactamente lo de antes", undo.nombreTrasUndo === "OBRA-CAMBIO-DESPUES-DEL-BACKUP", undo.nombreTrasUndo);
    chk("y consume la copia de seguridad", undo.quedoSinCopia === true);

    // ── 9. Historial local: restaurar una copia vieja y respetar el tope ─────
    const historial = await page.evaluate(async () => {
      const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
      const marcar = async (v) => {
        state._qaMarca = v;
        save();
        await guardarCopiaLocal("auto");
        await esperar(30);
      };
      await marcar("QA-V1");
      const copiaV1 = (await listarCopiasLocales()).find((c) => c.state && c.state._qaMarca === "QA-V1");
      await marcar("QA-V2");
      await marcar("QA-V3");

      // Restaura la copia más vieja de las marcadas
      const r = copiaV1 ? await restaurarCopiaLocal(copiaV1.ts) : { ok: false, error: "sin copia" };
      const marcaTrasRestaurar = state._qaMarca;

      // Sigue guardando hasta superar el tope
      for (let i = 0; i < 4; i++) { await marcar("QA-FILLER-" + i); }
      const todas = await listarCopiasLocales();
      const auto = todas.filter((c) => c.tipo === "auto");
      const especiales = todas.filter((c) => c.tipo === "antes-de-restaurar");
      return {
        encontrada: !!copiaV1, restauro: r.ok, marcaTrasRestaurar,
        auto: auto.length, tope: MAX_COPIAS_LOCALES, especiales: especiales.length
      };
    });
    chk("el historial guarda copias con fecha y contenido", historial.encontrada === true, JSON.stringify(historial));
    chk("permite restaurar una copia vieja del historial", historial.restauro === true, historial.marcaTrasRestaurar);
    chk("restauró el contenido de esa copia", historial.marcaTrasRestaurar === "QA-V1", historial.marcaTrasRestaurar);
    chk("el historial respeta el tope de copias (" + historial.tope + ")", historial.auto <= historial.tope, historial.auto);

    await esperar(300);
  } catch (e) {
    fail("excepción: " + e.message);
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    server.kill();
  }

  report.forEach((l) => console.log(l));
  const pass = report.filter((l) => l.startsWith("PASS")).length;
  console.log(`\nTOTAL: ${pass}/${report.length}`);
  process.exit(pass === report.length ? 0 : 1);
};

main();
