import { spawn } from "node:child_process";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { credencialesDueno, FALTA_CREDENCIAL } from "./helpers/dueno.mjs";

// Verificación end-to-end de la nube REAL:
//   A) el panel crea una cuenta PRO, la vincula a Firebase y la replica al ledger
//   B) un dispositivo limpio lee el ledger SIN sesión y encuentra la cuenta
//   C) el cliente PRO inicia sesión y su obra llega a la nube

const PUERTO = 4605;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-nube-${Date.now()}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CORREO = `nube.qa.${Date.now()}@puntero.test`;
const PASS_CLIENTE = "Obra2026!xyz";

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
  // El registro se ESCRIBE solo con sesión del dueño: sin estas credenciales
  // ningún push llegaría a la nube y el smoke lo detectaría (mejor avisarlo ya).
  const creds = credencialesDueno();
  if (!creds) { console.log("FAIL  " + FALTA_CREDENCIAL); process.exit(1); }
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  let browser;
  try {
    await serverListo();
    browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });

    // ── A. Dispositivo del administrador ──────────────────────────────────
    const page = await browser.newPage();
    page.setCacheEnabled(false);
    // adminLinkFirebase pide la contraseña con prompt(); en headless se acepta
    // con el valor que devuelve este handler. Se cambia para probar el rechazo.
    let passPrompt = PASS_CLIENTE;
    page.on("dialog", (d) => d.accept(passPrompt));
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => localStorage.setItem("pte_master_session", "1"));
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(1500);

    // ── Sesión REAL del dueño ─────────────────────────────────────────────
    // Antes el panel "se identificaba" con una identidad de transporte cuya
    // clave estaba escrita en el cliente (es decir, no era secreta). Ahora la
    // única identidad que escribe el registro es la del dueño, verificada por
    // Firebase Auth: sin contraseña real no hay sesión y sin sesión no hay push.
    const sesionDueno = await page.evaluate(async ({ email, pass }) => {
      await window._AUTH.signInWithEmailAndPassword(email, pass);
      await new Promise((r) => setTimeout(r, 1200));
      await ensureAdminSync();
      await new Promise((r) => setTimeout(r, 1500));
      return {
        uid: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.uid) || null,
        email: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.email) || null,
        tier: currentTier(),
        esMaster: !!(window._currentUser && window._currentUser.isMaster),
      };
    }, { email: creds.email, pass: creds.pass });
    chk("el panel trabaja con la sesión real del dueño (nada embebido en el cliente)",
      !!sesionDueno.uid && sesionDueno.email === creds.email, sesionDueno.email || "sin sesión");
    chk("la sesión maestra sigue siendo maestra",
      sesionDueno.tier === "maestra" && sesionDueno.esMaster, "tier=" + sesionDueno.tier + " master=" + sesionDueno.esMaster);

    const creada = await page.evaluate(async ({ correo, pass }) => {
      setSection("accounts");
      await new Promise((r) => setTimeout(r, 400));
      window._accTypeSel = "pro";
      document.getElementById("acc-user").value = correo;
      document.getElementById("acc-pass").value = pass;
      document.getElementById("acc-months").value = "3";
      await adminCreateAccount();
      await new Promise((r) => setTimeout(r, 2500));
      const acc = getAccounts().find((a) => a.username === correo);
      return acc ? { id: acc.id, type: acc.type, proUntil: acc.proUntil, firebase: !!acc.firebase } : null;
    }, { correo: CORREO, pass: PASS_CLIENTE });
    chk("cuenta PRO creada desde el panel", !!creada && creada.type === "pro", JSON.stringify(creada));

    // Vincular con la contraseña EQUIVOCADA debe rechazarse: si no, el cliente
    // entraría en local y quedaría sin nube sin entender por qué.
    passPrompt = "ContraseñaErrada1";
    const rechazada = await page.evaluate(async ({ id }) => {
      await adminLinkFirebase(id);
      await new Promise((r) => setTimeout(r, 1500));
      const a = getAccounts().find((x) => x.id === id);
      return { firebase: !!a.firebase };
    }, { id: creada && creada.id });
    chk("rechaza vincular con una contraseña que no es la de la cuenta",
      rechazada && rechazada.firebase === false, JSON.stringify(rechazada));
    passPrompt = PASS_CLIENTE;

    const vinculada = await page.evaluate(async ({ id }) => {
      if (!id) { return null; }
      await adminLinkFirebase(id);   // pide la contraseña con prompt()
      await new Promise((r) => setTimeout(r, 3000));
      const a = getAccounts().find((x) => x.id === id);
      return { firebase: !!a.firebase, uid: a.uid || null, sesion: !!window._AUTH };
    }, { id: creada && creada.id });
    chk("cuenta vinculada a Firebase Auth", vinculada && vinculada.firebase === true, JSON.stringify(vinculada));

    const ledgerSubido = await page.evaluate(async () => {
      await pushAccountsSync();
      await new Promise((r) => setTimeout(r, 3000));
      return true;
    });
    chk("ledger replicado a la nube", ledgerSubido === true);

    // ── B. Dispositivo limpio: lee el ledger SIN sesión ───────────────────
    const ctx = await browser.createBrowserContext();
    const fresh = await ctx.newPage();
    fresh.setCacheEnabled(false);
    await fresh.goto(URL, { waitUntil: "networkidle2" });
    await fresh.evaluate(() => localStorage.clear());
    await fresh.reload({ waitUntil: "networkidle2" });
    await esperar(2000);

    const ledger = await fresh.evaluate(async ({ correo }) => {
      const doc = await window._FIRESTORE.collection("accounts").doc("ledger").get();
      if (!doc.exists) { return { existe: false }; }
      const list = doc.data().list || [];
      const a = list.find((x) => String(x.username).toLowerCase() === correo);
      return {
        existe: true,
        total: list.length,
        cuenta: a ? {
          type: a.type,
          firebase: !!a.firebase,
          // sanitizado: no debe llevar contraseñas ni hashes
          tieneHash: !!(a.passwordHash || a.hash),
          tieneClave: !!(a.password || a.pass),
        } : null,
      };
    }, { correo: CORREO });
    chk("dispositivo nuevo lee el ledger sin iniciar sesión", ledger.existe === true, JSON.stringify(ledger).slice(0, 160));
    chk("encuentra la cuenta PRO en el ledger", !!ledger.cuenta, JSON.stringify(ledger.cuenta));
    chk("el ledger va sanitizado (sin clave en claro)", !!ledger.cuenta && !ledger.cuenta.tieneClave, JSON.stringify(ledger.cuenta));
    chk("y sin publicar el hash de una cuenta que valida en la nube",
      !!ledger.cuenta && !ledger.cuenta.tieneHash, JSON.stringify(ledger.cuenta));

    // ── B2. Las reglas de Firestore: quién puede escribir el registro ──────
    // Este es el corazón de la protección de licencias: si cualquiera pudiera
    // escribir el registro, cualquiera podría darse una cuenta PRO leyendo el
    // código fuente (que es público). Se prueba en un documento distinto al
    // ledger para que, en el peor caso, un fallo no borre cuentas reales.
    const rechazoSinSesion = await fresh.evaluate(async () => {
      try {
        await window._FIRESTORE.collection("accounts").doc("_reglas_qa").set({ prueba: true });
        return { escrito: true };
      } catch (e) { return { escrito: false, code: e.code || String(e.message).slice(0, 90) }; }
    });
    chk("la nube rechaza escribir el registro SIN sesión del dueño",
      rechazoSinSesion.escrito === false, JSON.stringify(rechazoSinSesion));

    const siPuedeElDueno = await page.evaluate(async () => {
      try {
        const ref = window._FIRESTORE.collection("accounts").doc("_reglas_qa");
        await ref.set({ prueba: Date.now() });
        await ref.delete();
        return true;
      } catch (e) { console.warn("reglas qa:", e.code || e.message); return false; }
    });
    chk("y con la sesión del dueño sí escribe (no nos quedamos afuera)",
      siPuedeElDueno === true, siPuedeElDueno);

    // ── C. El cliente PRO inicia sesión en el dispositivo nuevo ───────────
    const cliente = await fresh.evaluate(async ({ correo, pass }) => {
      showAuthModal();
      await new Promise((r) => setTimeout(r, 500));
      document.getElementById("auth-email").value = correo;
      document.getElementById("auth-pass").value = pass;
      await login();
      await new Promise((r) => setTimeout(r, 3000));
      return {
        user: window._currentUser && window._currentUser.email,
        tier: currentTier(),
        dias: proDaysLeft(),
        nube: isCloudUser(),
        sesionFb: !!(window._AUTH && window._AUTH.currentUser),
        uidNube: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.uid) || null,
        locked: document.getElementById("app-lock").style.display !== "none",
      };
    }, { correo: CORREO, pass: PASS_CLIENTE });
    chk("el cliente PRO entra en el dispositivo nuevo", cliente.user === CORREO, cliente.user);
    chk("su plan es PRO con suscripción vigente", cliente.tier === "pro" && cliente.dias > 80, "tier=" + cliente.tier + " dias=" + cliente.dias);
    chk("abre sesión real de nube con su propia cuenta", cliente.sesionFb === true && !!cliente.uidNube, JSON.stringify({ sesionFb: cliente.sesionFb, uidNube: cliente.uidNube }));
    chk("tiene nube habilitada", cliente.nube === true, cliente.nube);
    chk("y la app queda desbloqueada", cliente.locked === false, cliente.locked);

    // ── D. Su obra llega a la nube ────────────────────────────────────────
    const subida = await fresh.evaluate(async ({ uidNube }) => {
      if (!uidNube) { return { enNube: false, motivo: "sin uid de nube" }; }
      state.projects = state.projects || [];
      state.projects.push({ id: "obra-nube-qa", name: "Obra Nube QA", budgets: [] });
      save();
      await new Promise((r) => setTimeout(r, 2500));
      const doc = await window._FIRESTORE.collection("users").doc(uidNube).get();
      if (!doc.exists) { return { enNube: false }; }
      const apps = doc.data().appState || {};
      return {
        enNube: true,
        obra: (apps.projects || []).some((p) => p.id === "obra-nube-qa"),
      };
    }, { uidNube: cliente.uidNube });
    chk("su obra quedó en la nube", subida.enNube === true && subida.obra === true, JSON.stringify(subida));

    // ── Limpieza: no dejar la cuenta de QA en el registro real ────────────
    await fresh.evaluate(async () => { try { await logout(); } catch (e) {} });
    await page.evaluate(async ({ id }) => {
      if (!id) { return; }
      // adminDeleteAccount espera a que el registro quede escrito en la nube:
      // recién después borra en local y avisa.
      await adminDeleteAccount(id);
      await new Promise((r) => setTimeout(r, 2500));
    }, { id: creada && creada.id });
    const limpio = await page.evaluate(({ id }) => !getAccounts().some((x) => x.id === id), { id: creada && creada.id });
    chk("la cuenta de QA se eliminó del registro", limpio === true, limpio);

    await ctx.close();
  } finally {
    if (browser) { await browser.close(); }
    server.kill();
  }

  report.forEach((l) => console.log(l));
  const pass = report.filter((l) => l.startsWith("PASS")).length;
  console.log(`\nTOTAL: ${pass}/${report.length}`);
  process.exit(pass === report.length ? 0 : 1);
};

main();
