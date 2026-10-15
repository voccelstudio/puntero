// Diagnóstico + recuperación del registro de cuentas (ledger).
//
//   node tools/recuperar_ledger.mjs            → solo diagnóstico
//   node tools/recuperar_ledger.mjs --empujar  → empuja las cuentas locales del dueño a la nube
//
// Usa las credenciales del dueño (tests/.secret.json o env). Verifica que el
// push a Firestore funcione CON la sesión real, y muestra qué cuentas quedan
// en el ledger después.

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const PUERTO = 4693;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-rec-ledger-${Date.now()}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const EMPUJAR = process.argv.includes("--empujar");

function credenciales() {
  const env = { email: process.env.PUNTERO_MASTER_EMAIL, pass: process.env.PUNTERO_MASTER_PASS };
  if (env.email && env.pass) { return env; }
  const p = path.join(ROOT, "tests", ".secret.json");
  if (fs.existsSync(p)) {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return { email: j.email || j.user, pass: j.pass || j.password };
  }
  return env;
}

const serverListo = () => new Promise((resolve) => {
  const t = setInterval(() => {
    const req = http.get(URL, (res) => { res.resume(); clearInterval(t); resolve(); });
    req.on("error", () => {});
  }, 400);
});

const main = async () => {
  const creds = credenciales();
  if (!creds.email || !creds.pass) {
    console.error("Faltan credenciales del dueño (PUNTERO_MASTER_EMAIL/PASS o tests/.secret.json).");
    process.exit(1);
  }
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  let browser;
  try {
    await serverListo();
    browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle2" });
    await esperar(2000);

    // ── 1. Estado de la nube (sin sesión) ──────────────────────────────────
    const nube = await page.evaluate(async () => {
      const d = await window._FIRESTORE.collection("accounts").doc("ledger").get();
      if (!d.exists) { return { existe: false, list: [] }; }
      return { existe: true, list: d.data().list || [], updatedAt: d.data().updatedAt || null };
    });
    console.log(`\nNube: ${nube.list.length} cuenta(s) en el ledger ${nube.existe ? "(último push: " + new Date(nube.updatedAt).toLocaleString("es-PY") + ")" : "(sin documento)"}\n`);
    for (const a of nube.list) { console.log(`  [nube] ${a.username} · ${a.type}${a.firebase ? " · ☁️" : " · 💻 local"}`); }

    // ── 2. Sesión del dueño ────────────────────────────────────────────────
    const sesion = await page.evaluate(async ({ email, pass }) => {
      await window._AUTH.signInWithEmailAndPassword(email, pass);
      await new Promise((r) => setTimeout(r, 1500));
      return {
        uid: window._AUTH.currentUser && window._AUTH.currentUser.uid,
        esDuenio: !!(window._AUTH.currentUser && window._AUTH.currentUser.uid === window.MASTER_UID),
      };
    }, creds);
    console.log(`\nSesión del dueño: ${sesion.esDuenio ? "OK (" + sesion.uid + ")" : "FALLÓ (uid=" + sesion.uid + ")"}`);
    if (!sesion.esDuenio) { process.exitCode = 1; throw new Error("No hay sesión del dueño: no se puede escribir el registro."); }

    // ── 3. Prueba de escritura real ────────────────────────────────────────
    const prueba = await page.evaluate(async () => {
      const ref = window._FIRESTORE.collection("accounts").doc("ledger");
      const antes = (await ref.get()).data() || { list: [], updatedAt: 0 };
      try {
        await ref.set({ list: antes.list, updatedAt: antes.updatedAt });
        return { ok: true, listas: (antes.list || []).length };
      } catch (e) { return { ok: false, error: e.code || e.message }; }
    });
    console.log(`Prueba de escritura en accounts/ledger: ${prueba.ok ? "OK (permiso concedido)" : "RECHAZADA → " + prueba.error}`);
    if (!prueba.ok) { process.exitCode = 1; throw new Error("Firestore rechaza la escritura del dueño."); }

    if (!EMPUJAR) {
      console.log("\n(Solo diagnóstico. Ejecutá con --empujar para publicar las cuentas locales del dueño.)\n");
    } else {
      // ── 4. Empujar las cuentas locales del equipo del dueño ──────────────
      const res = await page.evaluate(async () => {
        // La app trae el registro en el arranque; se espera a que termine
        await new Promise((r) => setTimeout(r, 2500));
        const antes = (getAccounts() || []).map((a) => a.username);
        await pushAccountsSync();
        await new Promise((r) => setTimeout(r, 2500));
        const d = await window._FIRESTORE.collection("accounts").doc("ledger").get();
        return { antes, despues: (d.exists ? (d.data().list || []) : []).map((a) => a.username) };
      });
      console.log(`\nCuentas locales del equipo del dueño: ${res.antes.length ? res.antes.join(", ") : "(ninguna)"}`);
      console.log(`Ledger después del push: ${res.despues.length ? res.despues.join(", ") : "(vacío)"}`);
      if (res.antes.length && !res.despues.length) {
        console.log("\n⚠️ El push no quedó reflejado: revisá la consola del navegador.");
        process.exitCode = 1;
      }
    }

    // ── 5. Estado final ────────────────────────────────────────────────────
    const final = await page.evaluate(async () => {
      const d = await window._FIRESTORE.collection("accounts").doc("ledger").get();
      return d.exists ? (d.data().list || []) : [];
    });
    console.log(`\nLedger final (${final.length}):`);
    for (const a of final) {
      const plan = a.type === "pro" ? "⭐ PRO" : a.type === "usuario" ? "👤 Usuario" : a.type === "demo" ? "🎭 Demo" : a.type;
      const nube = a.firebase ? "· ☁️ nube" : "· 💻 solo local";
      const pass = a.firebase ? "· sin hash publicado (valida en Firebase)" : a.passwordHash ? "· con hash local" : "· ⚠️ SIN contraseña registrada";
      console.log(`  ${String(a.username).padEnd(34)} ${plan} ${nube} ${pass}`);
    }
    console.log("");
    await browser.close();
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    server.kill();
  }
};
main().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
