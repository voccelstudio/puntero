import { spawn } from "node:child_process";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

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

    const syncAdmin = await page.evaluate(async () => {
      await ensureAdminSync();
      await esperarInterno(2000);
      return { esSync: !!window._isAdminSyncUser, tier: currentTier() };
      function esperarInterno(ms) { return new Promise((r) => setTimeout(r, ms)); }
    });
    chk("el panel se identifica ante Firebase (admin.sync)", syncAdmin.esSync === true, syncAdmin.esSync);
    chk("la sesión maestra sigue siendo maestra", syncAdmin.tier === "maestra", syncAdmin.tier);

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
    await fresh.evaluate(() => { try { logout(); } catch (e) {} });
    await page.evaluate(async ({ id }) => {
      if (!id) { return; }
      adminDeleteAccount(id);
      await new Promise((r) => setTimeout(r, 1500));
      await pushAccountsSync();
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
