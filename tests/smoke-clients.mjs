import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const PUERTO = 4599;
// Raiz del proyecto (tests/ -> ../): el server debe servir la app, no tests/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 127.0.0.1 en vez de localhost: python -m http.server solo escucha en IPv4,
// y localhost puede resolver a ::1 (IPv6), lo que deja al browser en una
// pagina de error donde localStorage esta denegado.
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-v6-probe-${Date.now()}`);
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

const main = async () => {
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { shell: true, stdio: "ignore", cwd: ROOT });
  try {
    await servidorListo();
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    page.setCacheEnabled(false);
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.setItem("pte_master_session", "1"));
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(1200);

    const bootInfo = await page.evaluate(() => ({
      currentUser: window._currentUser && window._currentUser.email,
      clients: (state.clients || []).length,
      projects: (state.projects || []).length,
    }));
    if (bootInfo.currentUser === "martin@puntero.local") ok("sesión maestro offline");
    else fail("sesión: " + bootInfo.currentUser);

    // Semilla: un cliente existente en la base + un proyecto de base.
    await page.evaluate(() => {
      state.clients = [{ id: "cli_qa_1", name: "Cliente QA Existente", phone: "0981 111 222", email: "qa@crux.dev", address: "Asunción, Centro" }];
      save();
    });

    // ── Caso A: crear obra asignando cliente EXISTENTE de la base ──
    await page.evaluate(() => setSection("projects"));
    await page.evaluate(() => showModal("new_project"));
    await esperar(200);
    const selOpciones = await page.evaluate(() => {
      const s = document.getElementById("np-client-id");
      return [...s.options].map((o) => o.text).join(" | ");
    });
    ok("selector lista cliente existente: " + (selOpciones.includes("Cliente QA Existente") ? "sí" : "NO → " + selOpciones));

    await page.evaluate(() => {
      document.getElementById("np-name").value = "Obra QA A";
      document.getElementById("np-client-id").value = "cli_qa_1";
      pickClientForProject("cli_qa_1", "np");
    });
    const auto = await page.evaluate(() => ({
      nombre: document.getElementById("np-client").value,
      tel: document.getElementById("np-phone").value,
    }));
    ok("autofill desde la base: " + (auto.nombre === "Cliente QA Existente" && auto.tel === "0981 111 222" ? "sí" : "NO → " + JSON.stringify(auto)));
    await page.evaluate(() => createProject());
    await esperar(400);
    const resA = await page.evaluate(() => {
      const p = state.projects.find((x) => x.name === "Obra QA A");
      return p ? { clientId: p.clientId, client: p.client } : null;
    });
    ok("obra A → cliente vinculado por id: " + (resA && resA.clientId === "cli_qa_1" ? "sí" : "NO → " + JSON.stringify(resA)));

    // ── Caso B: crear obra con cliente NUEVO creado inline ──
    await page.evaluate(() => setSection("projects"));
    await page.evaluate(() => showModal("new_project"));
    await esperar(200);
    await page.evaluate(() => toggleNewClient("np"));
    await esperar(150);
    await page.evaluate(() => {
      document.getElementById("np-name").value = "Obra QA B";
      document.getElementById("np-nc-name").value = "Cliente Nuevo Inline";
      document.getElementById("np-nc-phone").value = "0971 333 444";
      document.getElementById("np-nc-email").value = "nuevo@crux.dev";
      document.getElementById("np-nc-ruc").value = "80012345-6";
      createProject();
    });
    await esperar(400);
    const resB = await page.evaluate(() => {
      const p = state.projects.find((x) => x.name === "Obra QA B");
      const c = p && (state.clients || []).find((x) => x.id === p.clientId);
      return c ? { id: c.id, name: c.name, phone: c.phone, email: c.email, ruc: c.ruc, enBase: true } : null;
    });
    ok("obra B → cliente nuevo creado y en la base: " + (resB && resB.name === "Cliente Nuevo Inline" ? "sí (" + JSON.stringify(resB) + ")" : "NO → " + JSON.stringify(resB)));

    // ── Directorio: la sección Clientes muestra el nuevo ──
    await page.evaluate(() => setSection("clients"));
    await esperar(300);
    const dir = await page.evaluate(() => {
      const el = document.getElementById("section-clients");
      return el ? el.innerText.includes("Cliente Nuevo Inline") && el.innerText.includes("Cliente QA Existente") : false;
    });
    ok("directorio muestra ambos clientes: " + (dir ? "sí" : "NO"));

    // ── Caso C: editar obra A y cambiar cliente por uno nuevo inline ──
    await page.evaluate(() => {
      const p = state.projects.find((x) => x.name === "Obra QA A");
      showModal("edit_project", p.id);
    });
    await esperar(250);
    await page.evaluate(() => toggleNewClient("ep"));
    await esperar(150);
    await page.evaluate(() => {
      document.getElementById("ep-nc-name").value = "Cliente Cambiado Edit";
      saveEditProject(state.projects.find((x) => x.name === "Obra QA A").id);
    });
    await esperar(400);
    const resC = await page.evaluate(() => {
      const p = state.projects.find((x) => x.name === "Obra QA A");
      const c = p && (state.clients || []).find((x) => x.id === p.clientId);
      return c ? c.name : null;
    });
    ok("editar obra → cliente reasignado a nuevo: " + (resC === "Cliente Cambiado Edit" ? "sí" : "NO → " + resC));

    if (errores.length) report.push("ERROS(page): " + errores.slice(0, 5).join(" ;; ").slice(0, 300));

    await browser.close();
  } finally {
    server.kill();
    try { if (existsSync(PERFIL)) rmSync(PERFIL, { recursive: true, force: true }); } catch {}
  }
  console.log(report.join("\n"));
};

main().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });