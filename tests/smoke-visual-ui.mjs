import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

// Smoke visual de UI (Tanda 4): modal de Perfil con labels visibles y footer
// pegajoso, y los controles convertidos de <div onclick> a <button> nativos
// (tarjetas de tema, export, logo, plantillas, badge de calificación, fila del
// gantt). Verifica markup, estilos computados y toma capturas para revisión.
// Requiere Edge y python en PATH. Capturas: %TEMP%/puntero-ui-shots.

const PUERTO = 4607;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-ui-probe-${Date.now()}`);
const SHOTS = path.join(tmpdir(), "puntero-ui-shots");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const errores = [];

function servidorListo() {
  return new Promise((resolve) => {
    const t = setInterval(() => {
      const req = http.get(URL, (res) => { res.resume(); clearInterval(t); resolve(); });
      req.on("error", () => {});
    }, 400);
  });
}

const report = [];
const ok = (m) => report.push("PASS  " + m);
const fail = (m) => report.push("FAIL  " + m);
const info = (m) => report.push("INFO  " + m);
const chk = (label, cond, extra) => (cond ? ok(label + ": sí") : fail(label + (extra !== undefined ? " → " + extra : " → NO")));

let shotN = 0;
async function shot(page, name) {
  shotN++;
  const file = path.join(SHOTS, `${String(shotN).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  report.push("SHOT  " + path.basename(file));
}

const main = async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  try {
    await servidorListo();
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.setCacheEnabled(false);
    page.on("pageerror", (e) => errores.push(e.stack || e.message));
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => localStorage.setItem("pte_master_session", "1"));
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(1200);

    // ── Datos mínimos en memoria (sin save(): perfil fresco por corrida) ──
    await page.evaluate(() => {
      const item = (id) => ({
        cat: "PISOS", name: "Baldosa calcárea 20x20cm", unit: "m2",
        unitPrice: 10000, matCost: 6000, laborCost: 4000, mats: [],
        qty: 2, id: id, disc: 0, note: "",
      });
      state.projects.push({
        id: "p_qa", name: "Casa prueba QA", client: "Cliente QA", phone: "0981000111",
        address: "Asunción", m2Area: 80, date: "01/10/2026", status: "active",
        archived: false, activeAdendaId: "main",
        budgets: [{ id: "main", name: "Presupuesto Principal", items: [item("i1"), item("i2")], profitPct: 10, ivaEnabled: false, notes: "" }],
        execution: {
          schedules: { i1: { start: "2026-10-05", end: "2026-10-12" } },
          dailyLogs: [], materialOrders: [], finances: { income: [], expenses: [] },
          documents: [], aftercare: [], projectStartDate: "2026-10-05", projectEndDate: "",
          folderHandle: null, folderPath: "", folderCategories: DEFAULT_FOLDER_CATEGORIES,
        },
      });
      state.activeProjectId = "p_qa";
      state.contractors.push({ id: "c_qa", name: "Maestros Unidos", phone: "0981654321", specialty: "Albañilería", staff: [], payments: [] });
      state.suppliers.push({ id: "s_qa", name: "Ferretería Central QA", phone: "0981111222", category: "Ferretería", address: "Asunción", rating: 4 });
    });

    // ── 1. Presupuesto: cfg-hdr como <button> y barra de totales ─────────
    await page.evaluate(() => setSection("budget"));
    await esperar(800);
    const cfg = await page.evaluate(() => {
      const h = document.querySelector(".cfg-hdr");
      const before = document.querySelector(".cfg-card") ? document.querySelector(".cfg-card").className : "";
      if (h) { h.click(); }
      const after = document.querySelector(".cfg-card") ? document.querySelector(".cfg-card").className : "";
      if (h) { h.click(); }
      const tb = document.getElementById("total-bar");
      return {
        tag: h ? h.tagName : null, toggled: before !== after,
        tb: tb ? { disp: getComputedStyle(tb).display, txt: tb.textContent.replace(/\s+/g, " ").trim().slice(0, 70) } : null,
      };
    });
    chk("cfg-hdr es <button>", cfg.tag === "BUTTON", cfg.tag);
    chk("click en cfg-hdr colapsa la config", cfg.toggled);
    chk("barra sticky de totales visible", cfg.tb && cfg.tb.disp !== "none" && /₲/.test(cfg.tb.txt), JSON.stringify(cfg.tb));

    // ── 1b. Reordenar arrastrando: ítem 1 por debajo del 2 ────────────────
    await page.evaluate(() => { const r = document.querySelector('tr[data-item-id="i1"]'); if (r) { r.scrollIntoView({ block: "center" }); } });
    await esperar(300);
    const h1 = await page.$('tr[data-item-id="i1"] .drag-handle');
    const row2 = await page.$('tr[data-item-id="i2"]');
    if (h1 && row2) {
      const b1 = await h1.boundingBox();
      const b2 = await row2.boundingBox();
      await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
      await page.mouse.down();
      await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height * 0.75, { steps: 8 });
      await esperar(250);
      const guia = await page.evaluate(() => !!document.querySelector("#table-area tr.drop-before,#table-area tr.drop-after,#table-area tr.drop-cat"));
      chk("guía de inserción visible durante el arrastre", guia);
      await shot(page, "drag-indicador");
      await page.mouse.up();
      await esperar(180);
      const flash = await page.evaluate(() => !!document.querySelector("#table-area tr.row-moved"));
      chk("feedback tras soltar: destello en la fila movida", flash);
      await shot(page, "movido-feedback");
      await esperar(420);
      const orden = await page.evaluate(() => getActiveAdenda().items.map((x) => x.id).join(","));
      chk("soltar debajo reordena (i1 → después de i2)", orden === "i2,i1", orden);
      // Teclado: con foco en el asa, ↑↓ reordenan (vuelve a i1,i2).
      await page.evaluate(() => { const h = document.querySelector('tr[data-item-id="i2"] .drag-handle'); if (h) { h.focus(); } });
      await page.keyboard.press("ArrowDown");
      await esperar(180);
      const flash2 = await page.evaluate(() => !!document.querySelector("#table-area tr.row-moved"));
      chk("feedback también al reordenar con ↑↓", flash2);
      await esperar(420);
      const orden2 = await page.evaluate(() => getActiveAdenda().items.map((x) => x.id).join(","));
      chk("flechas ↑↓ con el foco en el asa reordenan", orden2 === "i1,i2", orden2);
    } else {
      chk("asas de arrastre presentes en la tabla", false, "no encontró .drag-handle");
    }
    await shot(page, "presupuesto");

    // ── 2. Modal de Perfil: labels + footer pegajoso ──────────────────────
    await page.evaluate(() => showModal("profile"));
    await esperar(500);
    const prof = await page.evaluate(() => {
      const modal = document.querySelector(".modal");
      const lbls = [...modal.querySelectorAll(".slbl")].map((e) => e.textContent.trim());
      const logo = modal.querySelector(".logo-upload-area");
      const acts = modal.querySelector(".modal-acts");
      return {
        lbls,
        logo: logo ? logo.tagName : null,
        sticky: acts ? getComputedStyle(acts).position : null,
        saves: acts ? [...acts.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
        maxScroll: modal.scrollHeight - modal.clientHeight,
      };
    });
    const labelsOk = ["Teléfono", "Email", "Dirección del estudio", "Instagram", "WhatsApp", "Sitio web"].every((t) => prof.lbls.includes(t));
    chk("labels visibles en Teléfono/Email/Dirección/Redes/Web", labelsOk, JSON.stringify(prof.lbls));
    chk("zona de subir logo es <button>", prof.logo === "BUTTON", prof.logo);
    chk("footer de acciones con position:sticky", prof.sticky === "sticky", prof.sticky);
    chk("footer contiene Guardar", prof.saves.some((t) => /Guardar/i.test(t)), JSON.stringify(prof.saves));
    const bannerModal = await page.evaluate(() => {
      const b = document.getElementById("backup-banner");
      return b ? getComputedStyle(b).display : "sin-banner";
    });
    chk("banner de backup oculto mientras hay modal abierto", bannerModal === "none" || bannerModal === "sin-banner", bannerModal);
    if (prof.maxScroll > 60) {
      // Con el modal arriba, el contenido sigue por debajo: el footer debe
      // quedar clavado sobre él. (Al llegar al final del scroll vuelve a su
      // posición natural, ~24px sobre el padding: es el comportamiento esperado.)
      const stick = await page.evaluate(() => {
        const modal = document.querySelector(".modal");
        modal.scrollTop = 0;
        const m = modal.getBoundingClientRect();
        const a = modal.querySelector(".modal-acts").getBoundingClientRect();
        return Math.round(a.bottom - m.bottom);
      });
      chk(`footer pegado al fondo sobre el contenido (Δ=${stick}px)`, Math.abs(stick) <= 4, stick + "px");
    } else {
      info("modal de perfil sin scroll en este viewport (footer en posición natural)");
    }
    await shot(page, "perfil-modal");
    await page.evaluate(() => closeModal());
    await esperar(300);

    // ── 3. Temas: tarjetas de tema como <button> ──────────────────────────
    await page.evaluate(() => setSection("themes"));
    await esperar(600);
    const th = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("button.theme-card")];
      const pdf = [...document.querySelectorAll("button.pdf-theme-card")];
      const bodyFont = getComputedStyle(document.body).fontFamily;
      const c0 = cards[0];
      return {
        n: cards.length, pdf: pdf.length, bodyFont,
        font: c0 ? getComputedStyle(c0).fontFamily : null,
        w: c0 ? Math.round(c0.getBoundingClientRect().width) : 0,
        bg: c0 ? getComputedStyle(c0).backgroundColor : null,
      };
    });
    chk("tarjetas de tema son <button>", th.n > 0, th.n);
    chk("tarjetas de tema PDF son <button>", th.pdf > 0, th.pdf);
    chk("fuente heredada (no la por defecto del browser)", th.font === th.bodyFont, th.font + " ≠ " + th.bodyFont);
    chk("tarjeta ocupa su columna (no shrink-wrap)", th.w > 150, th.w + "px");
    await shot(page, "temas");

    // ── 4. Modal de exportación: export-cards como <button> ───────────────
    await page.evaluate(() => showModal("export"));
    await esperar(400);
    const ex = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".export-card")];
      return {
        n: cards.length,
        tags: cards.map((c) => c.tagName),
        align: cards.map((c) => getComputedStyle(c).textAlign),
        w: cards.map((c) => Math.round(c.getBoundingClientRect().width)),
      };
    });
    chk("export-cards son <button>", ex.n === 2 && ex.tags.every((t) => t === "BUTTON"), JSON.stringify(ex));
    chk("export-cards conservan texto centrado", ex.align.every((a) => a === "center"), JSON.stringify(ex.align));
    chk("export-cards ocupan su columna", ex.w.every((w) => w > 150), JSON.stringify(ex.w));
    await shot(page, "export-modal");
    await page.evaluate(() => closeModal());
    await esperar(300);

    // ── 5. Cronograma: fila del gantt como <button> en grid ───────────────
    await page.evaluate(() => setSection("schedule"));
    await esperar(700);
    const g = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".gantt-row")];
      const html = document.getElementById("section-schedule").innerHTML;
      return {
        n: rows.length,
        tags: [...new Set(rows.map((r) => r.tagName))],
        disp: rows[0] ? getComputedStyle(rows[0]).display : null,
        bal: (html.match(/<button/g) || []).length - (html.match(/<\/button>/g) || []).length,
      };
    });
    chk("hay filas en el gantt (proyecto de prueba con fechas)", g.n > 0, g.n);
    chk("filas del gantt son <button>", g.n > 0 && g.tags.length === 1 && g.tags[0] === "BUTTON", JSON.stringify(g.tags));
    chk("fila del gantt conserva display:grid", g.disp === "grid", g.disp);
    chk("botones balanceados en la sección", g.bal === 0, g.bal);
    await page.evaluate(() => { const r = document.querySelector(".gantt-row"); if (r) { r.scrollIntoView({ block: "center" }); } });
    await shot(page, "gantt");

    // ── 6. Contratistas: badge de calificación como <button> ──────────────
    await page.evaluate(() => setSection("contractors"));
    await esperar(600);
    const co = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button.con-rating-badge")];
      return { n: b.length, disp: b[0] ? getComputedStyle(b[0]).display : null };
    });
    chk("badge de calificación es <button>", co.n > 0, co.n);
    chk("badge conserva display:flex", co.disp === "flex", co.disp);
    await shot(page, "contratistas");

    // ── 7. Proveedores: tarjeta con role=button + Enter de teclado ────────
    await page.evaluate(() => setSection("suppliers"));
    await esperar(600);
    const su = await page.evaluate(() => {
      const c = document.querySelector("#section-suppliers .con-card");
      return c ? { role: c.getAttribute("role"), tab: c.getAttribute("tabindex") } : null;
    });
    chk("tarjeta de proveedor con role=button + tabindex", su && su.role === "button" && su.tab === "0", JSON.stringify(su));
    await shot(page, "proveedores");
    await page.evaluate(() => { const c = document.querySelector("#section-suppliers .con-card"); if (c) { c.focus(); } });
    await page.keyboard.press("Enter");
    await esperar(500);
    const supModal = await page.evaluate(() => { const m = document.querySelector(".modal"); return m ? m.textContent.replace(/\s+/g, " ").trim().slice(0, 50) : null; });
    chk("Enter abre la ficha del proveedor", !!supModal, supModal);
    await page.evaluate(() => closeModal());
    await esperar(300);

    // ── 8. Recursos: plantillas como <button> ─────────────────────────────
    await page.evaluate(() => setSection("resources"));
    await esperar(600);
    const re = await page.evaluate(() => {
      const t = [...document.querySelectorAll("button.tmpl-card")];
      const bodyFont = getComputedStyle(document.body).fontFamily;
      return {
        n: t.length,
        font: t[0] ? getComputedStyle(t[0]).fontFamily : null,
        bodyFont,
        w: t[0] ? Math.round(t[0].getBoundingClientRect().width) : 0,
      };
    });
    chk("plantillas (tmpl-card) son <button>", re.n > 0, re.n);
    chk("tmpl: fuente heredada", re.font === re.bodyFont, re.font + " ≠ " + re.bodyFont);
    chk("tmpl: ancho de columna", re.w > 150, re.w + "px");
    await shot(page, "recursos");

    // ── 9. Dashboard: tarjeta de proyecto con role=button ─────────────────
    await page.evaluate(() => setSection("global_dashboard"));
    await esperar(700);
    const dash = await page.evaluate(() => {
      const c = document.querySelector(".proj-dash-card");
      return c ? { role: c.getAttribute("role"), tab: c.getAttribute("tabindex") } : null;
    });
    chk("tarjeta del dashboard con role=button + tabindex", dash && dash.role === "button" && dash.tab === "0", JSON.stringify(dash));
    await shot(page, "dashboard");

    // ── 10. Móvil: CTA del recorrido como <button> + perfil ───────────────
    await page.setViewport({ width: 392, height: 844 });
    await page.evaluate(() => setSection("logs"));
    await esperar(700);
    const lg = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Iniciar Recorrido"));
      return b ? { w: Math.round(b.getBoundingClientRect().width), bg: getComputedStyle(b).backgroundColor } : null;
    });
    chk("CTA móvil de recorrido es <button> al ancho del contenedor", !!lg && lg.w > 200, JSON.stringify(lg));
    await shot(page, "logs-mobile");
    await page.evaluate(() => showModal("profile"));
    await esperar(500);
    const mob = await page.evaluate(() => {
      const acts = document.querySelector(".modal-acts");
      const b = acts ? acts.querySelector(".btn") : null;
      return acts && b ? { sticky: getComputedStyle(acts).position, w: Math.round(b.getBoundingClientRect().width), modalW: Math.round(document.querySelector(".modal").getBoundingClientRect().width) } : null;
    });
    chk("perfil móvil: footer sticky con botón al ancho", mob && mob.sticky === "sticky" && mob.w > mob.modalW - 60, JSON.stringify(mob));
    await shot(page, "perfil-mobile");
    await page.evaluate(() => closeModal());

    const pass = report.filter((l) => l.startsWith("PASS")).length;
    const total = report.filter((l) => l.startsWith("PASS") || l.startsWith("FAIL")).length;
    console.log(`\nTOTAL: ${pass}/${total}`);
    await browser.close();
  } catch (e) {
    fail("excepción: " + e.message);
  } finally {
    try { server.kill(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
    report.push("ERROS(page): " + (errores.length ? [...new Set(errores)].slice(0, 3).join(" | ") : "ninguno"));
    console.log(report.join("\n"));
    console.log("SHOTS en: " + SHOTS);
    process.exit(report.some((r) => r.startsWith("FAIL")) ? 1 : 0);
  }
};

main();
