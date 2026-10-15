// Muestra el registro de cuentas (ledger) tal como lo ve CUALQUIER dispositivo,
// es decir sin iniciar sesión. Sirve para verificar qué cuentas están activas en
// la nube y si el panel las está replicando bien.
//
//   node tools/ver_ledger.mjs
//
// No usa credenciales: la regla de Firestore permite leer ese documento en
// claro (por eso lleva solo datos sanitizados, sin contraseñas ni hashes).

import { spawn } from "node:child_process";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const PUERTO = 4691;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-ver-ledger-${Date.now()}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const serverListo = () => new Promise((resolve) => {
  const t = setInterval(() => {
    const req = http.get(URL, (res) => { res.resume(); clearInterval(t); resolve(); });
    req.on("error", () => {});
  }, 400);
});

const main = async () => {
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  let browser;
  try {
    await serverListo();
    browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle2" });
    await esperar(2000);
    const r = await page.evaluate(async () => {
      const d = await window._FIRESTORE.collection("accounts").doc("ledger").get();
      if (!d.exists) { return { existe: false }; }
      return { existe: true, list: d.data().list || [], actualizado: d.data().updatedAt || null };
    });
    if (!r.existe) {
      console.log("El ledger todavía no existe en la nube (nadie empujó el registro todavía).");
    } else {
      console.log(`Registro en la nube · ${r.list.length} cuenta(s)\n`);
      for (const a of r.list) {
        const plan = a.type === "pro" ? "⭐ PRO" : a.type === "usuario" ? "👤 Usuario" : a.type === "demo" ? "🎭 Demo" : a.type;
        const vence = a.type === "pro" && a.proUntil
          ? ` · vence ${new Date(a.proUntil).toLocaleDateString("es-PY")}`
          : "";
        const nube = a.firebase ? " · ☁️" : " · 💻 solo local";
        const off = a.active === false ? " · ⏸ desactivada" : "";
        console.log(`  ${String(a.username).padEnd(34)} ${plan}${vence}${nube}${off}`);
      }
    }
    await browser.close();
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    server.kill();
  }
};
main();
