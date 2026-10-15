// Verificación del SITIO PUBLICADO (puntero-46d12.web.app): que el login
// maestro del cliente desplegado se verifique contra Firebase Auth de verdad,
// que el código servido no traiga secretos, y que con la contraseña correcta
// quede la sesión del dueño (la única que puede escribir el registro).
//
// No escribe nada en la nube: solo entra y mira. Requiere tests/.secret.json
// (ver README) o PUNTERO_MASTER_EMAIL / PUNTERO_MASTER_PASS.
import puppeteer from "puppeteer-core";
import { tmpdir } from "node:os";
import path from "node:path";
import { credencialesDueno, FALTA_CREDENCIAL } from "./helpers/dueno.mjs";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = "https://puntero-46d12.web.app/";
const PERFIL = path.join(tmpdir(), `puntero-vivo-${Date.now()}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const report = [];
const ok = (m) => report.push("PASS  " + m);
const fail = (m) => report.push("FAIL  " + m);
const chk = (label, cond, extra) => (cond ? ok(label + ": sí") : fail(label + (extra !== undefined ? " → " + extra : " → NO")));

const main = async () => {
  const creds = credencialesDueno();
  if (!creds) { console.log("FAIL  " + FALTA_CREDENCIAL); process.exit(1); }

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    page.setCacheEnabled(false);
    await page.goto(URL, { waitUntil: "networkidle2" });
    await esperar(2500);

    // ── 1. Lo que el sitio sirve no contiene secretos ─────────────────────
    const fuente = await page.evaluate(async () => {
      const [app, init] = await Promise.all([
        fetch("/app.js", { cache: "no-store" }).then((r) => r.text()),
        fetch("/firebase-init.js", { cache: "no-store" }).then((r) => r.text()),
      ]);
      return {
        comparaClave: /pass\s*===\s*["']/.test(app),
        claveSyncVieja: app.includes("ADMIN_SYNC_PASS"),
        fbConfig: init.includes("_FB_CONFIG = config"),
        validaPorAuth: app.includes("signInWithEmailAndPassword(MASTER_EMAIL, pass)"),
      };
    });
    chk("el app.js publicado no compara contraseñas contra un texto", fuente.comparaClave === false, fuente.comparaClave);
    chk("y no trae la clave de la identidad de transporte vieja", fuente.claveSyncVieja === false, fuente.claveSyncVieja);
    chk("y valida la maestra contra Firebase Auth", fuente.validaPorAuth === true, fuente.validaPorAuth);
    chk("firebase-init expone la config (instancia secundaria)", fuente.fbConfig === true, fuente.fbConfig);

    // ── 2. Contraseña incorrecta → el sitio la rechaza (en la nube) ───────
    await page.evaluate(() => showAuthModal());
    await esperar(700);
    await page.evaluate(() => {
      document.getElementById("auth-email").value = "martin";
      document.getElementById("auth-pass").value = "clave-que-no-es-999";
    });
    await page.evaluate(async () => { await login(); });
    await esperar(3000);
    const rechazo = await page.evaluate(() => ({
      sesion: localStorage.getItem("pte_master_session"),
      err: ((document.getElementById("auth-error") || {}).textContent) || "",
      lockeada: document.getElementById("app-lock").style.display !== "none",
    }));
    chk("contraseña incorrecta: no abre y avisa",
      rechazo.sesion !== "1" && !!rechazo.err && rechazo.lockeada === true, JSON.stringify(rechazo));

    // ── 3. Contraseña correcta → sesión maestra + sesión real del dueño ──
    await page.evaluate((p) => { document.getElementById("auth-pass").value = p; }, creds.pass);
    await page.evaluate(async () => { await login(); });
    await esperar(4000);
    const sesion = await page.evaluate(() => ({
      sesion: localStorage.getItem("pte_master_session"),
      esMaster: !!(window._currentUser && window._currentUser.isMaster),
      uid: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.uid) || null,
      email: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.email) || null,
      puedeEscribirRegistro: typeof _esSesionDuenio === "function" ? _esSesionDuenio() : null,
      botonPanel: (() => { const b = document.getElementById("btn-accounts"); return b ? b.style.display !== "none" : null; })(),
      tier: typeof currentTier === "function" ? currentTier() : null,
    }));
    chk("el sitio publicado abre la sesión maestra",
      sesion.sesion === "1" && sesion.esMaster === true, JSON.stringify(sesion));
    chk("quedó la sesión real del dueño (la que escribe el registro)",
      !!sesion.uid && sesion.email === creds.email && sesion.puedeEscribirRegistro === true, JSON.stringify(sesion));
    chk("el botón 🗝️ del panel queda visible", sesion.botonPanel === true, sesion.botonPanel);
    chk("y el tier sigue siendo maestra", sesion.tier === "maestra", sesion.tier);
  } catch (e) {
    fail("excepción: " + e.message);
  } finally {
    try { await browser.close(); } catch (e) {}
  }

  report.forEach((l) => console.log(l));
  const pass = report.filter((l) => l.startsWith("PASS")).length;
  console.log(`\nTOTAL: ${pass}/${report.length}`);
  process.exit(pass === report.length ? 0 : 1);
};

main();
