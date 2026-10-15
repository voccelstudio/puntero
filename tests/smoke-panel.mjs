import { spawn } from "node:child_process";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { credencialesDueno, FALTA_CREDENCIAL } from "./helpers/dueno.mjs";

// Smoke test del Panel de Control del administrador.
// Verifica el circuito completo: crear cuentas (PRO / Usuario / Demo), la regla
// de "un correo = una demo", extender suscripción, y que esas cuentas puedan
// INICIAR SESIÓN con la app bloqueándose/desbloqueándose según el plan.

const PUERTO = 4601;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-panel-probe-${Date.now()}`);
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
// Aserción honesta: imprime PASS solo si se cumple.
const chk = (label, cond, extra) => (cond ? ok(label + ": sí") : fail(label + (extra !== undefined ? " → " + extra : " → NO")));

const main = async () => {
  // El registro de cuentas se ESCRIBE solo con sesión del dueño (las reglas de
  // Firestore comparan su uid), así que este smoke necesita esas credenciales.
  const creds = credencialesDueno();
  if (!creds) { console.log("FAIL  " + FALTA_CREDENCIAL); process.exit(1); }
  // Sin `shell: true`: así server.kill() le pega a python.exe directamente.
  // Con shell, node mata el cmd.exe intermedio y el server queda huérfano
  // ocupando el puerto en la siguiente corrida.
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  try {
    await servidorListo();
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    page.setCacheEnabled(false);
    page.on("pageerror", (e) => errores.push(e.stack || e.message));
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

    // ── 1. Entrar como administrador ─────────────────────────────────────
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => localStorage.setItem("pte_master_session", "1"));
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(1200);

    // Sesión REAL del dueño: es la única con permiso para escribir el registro
    // de cuentas (la regla de Firestore compara el uid). Sin esto, los pushes
    // del panel no llegarían a la nube y el smoke lo detectaría al final.
    const sesionDueno = await page.evaluate(async ({ email, pass }) => {
      await window._AUTH.signInWithEmailAndPassword(email, pass);
      await new Promise((r) => setTimeout(r, 1200));
      return {
        uid: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.uid) || null,
        email: (window._AUTH && window._AUTH.currentUser && window._AUTH.currentUser.email) || null,
      };
    }, { email: creds.email, pass: creds.pass });
    chk("sesión real del dueño activa (la única que escribe el registro)",
      !!sesionDueno.uid && sesionDueno.email === creds.email, sesionDueno.email || "sin sesión");

    const master = await page.evaluate(() => ({
      user: window._currentUser && window._currentUser.email,
      tier: typeof currentTier === "function" ? currentTier() : null,
      cloud: typeof isCloudUser === "function" ? isCloudUser() : null,
      precios: typeof canUpdatePrices === "function" ? canUpdatePrices() : null,
      sesionFb: !!(window._AUTH && window._AUTH.currentUser),
    }));
    ok("maestro entra: " + (master.user === "martin@puntero.local" ? "sí" : master.user));
    ok("maestro es tier maestra: " + (master.tier === "maestra" ? "sí" : master.tier));
    ok("maestra es VIP vitalicia (precios): " + (master.precios === true ? "sí" : String(master.precios)));
    // La nube exige una sesión REAL de Firebase (las reglas verifican
    // request.auth.uid). Si Firebase está caído o sin configurar, la app lo
    // reporta honestamente en vez de fallar en silencio.
    chk("maestro: estado de nube coherente con la sesión", master.cloud === master.sesionFb,
      "nube=" + master.cloud + " sesion=" + master.sesionFb);

    // Con sesión simulada, el gate debe abrir para la maestra. Se guarda y
    // restaura la instancia real: pisarla (antes quedaba en null) dejaba al
    // resto del smoke sin Firebase y los pushes no hubieran llegado a la nube.
    const masterCloud = await page.evaluate(() => {
      const authReal = window._AUTH;
      window._AUTH = { currentUser: { uid: "fb-master-test" } };
      var c = isCloudUser();
      window._AUTH = authReal;
      return c;
    });
    ok("con sesión de Firebase la maestra sí tendría nube: " + (masterCloud === true ? "sí" : String(masterCloud)));

    // Limpiar el registro para un test determinista
    await page.evaluate(() => {
      setAccounts([]);
      window._accFilter = "todos";
      window._accSearch = "";
      window._accTypeSel = "pro";
    });

    // ── 2. Crear cuenta PRO ──────────────────────────────────────────────
    // (hay que estar en la sección para que exista el formulario)
    await page.evaluate(() => setSection("accounts"));
    await esperar(500);
    await page.evaluate(() => {
      setAccType("pro");
      document.getElementById("acc-user").value = "pro.qa@puntero.test";
      document.getElementById("acc-pass").value = "Clave12345";
      document.getElementById("acc-months").value = "2";
      adminCreateAccount();
    });
    await esperar(400);
    let lista = await page.evaluate(() => getAccounts().map((a) => ({ u: a.username, t: a.type, pro: !!a.proUntil })));
    const proCreada = lista.find((a) => a.u === "pro.qa@puntero.test");
    chk("PRO creado en el registro", !!(proCreada && proCreada.t === "pro"), JSON.stringify(lista));

    // ── 3. Crear cuenta Usuario (compra única) ───────────────────────────
    await page.evaluate(() => {
      setAccType("usuario");
      document.getElementById("acc-user").value = "cliente.qa@puntero.test";
      document.getElementById("acc-pass").value = "Clave12345";
      adminCreateAccount();
    });
    await esperar(400);
    lista = await page.evaluate(() => getAccounts().map((a) => ({ u: a.username, t: a.type })));
    chk("Usuario creado", lista.some((a) => a.u === "cliente.qa@puntero.test" && a.t === "usuario"), JSON.stringify(lista));

    // ── 4. Crear demo y verificar "un correo = una demo" ─────────────────
    await page.evaluate(() => {
      setAccType("demo");
      document.getElementById("acc-user").value = "demo.qa@puntero.test";
      document.getElementById("acc-pass").value = "Clave12345";
      adminCreateAccount();
    });
    await esperar(300);
    const demoDup = await page.evaluate(() => {
      setAccType("demo");
      document.getElementById("acc-user").value = "demo.qa@puntero.test";
      document.getElementById("acc-pass").value = "Clave12345";
      adminCreateAccount();
      return new Promise((r) => setTimeout(() => r(getAccounts().filter((a) => a.username === "demo.qa@puntero.test").length), 200));
    });
    chk("un correo = una sola demo", demoDup === 1, demoDup + " demos");

    // ── 5. Extender suscripción PRO ──────────────────────────────────────
    const ext = await page.evaluate(async () => {
      const antes = getAccounts().find((a) => a.username === "pro.qa@puntero.test").proUntil;
      const acc = getAccounts().find((a) => a.username === "pro.qa@puntero.test");
      await adminExtendPro(acc.id, 1);
      const despues = getAccounts().find((a) => a.username === "pro.qa@puntero.test").proUntil;
      return Math.round((despues - antes) / 86400000);
    });
    chk("+1 mes suma ~30 días", ext >= 29 && ext <= 31, ext + "d");

    // ── 6. Resetear contraseña ───────────────────────────────────────────
    // (prompt() no es utilizable en headless: probamos el helper de hash)
    const hashOk = await page.evaluate(async () => {
      const salt = accSalt();
      const h = await hashAccountPassword("ClaveNueva99", salt);
      const buena = await verifyAccountPassword({ passwordHash: h, salt }, "ClaveNueva99");
      const mala = await verifyAccountPassword({ passwordHash: h, salt }, "ClaveMala99");
      return { h: h.length === 64, buena, mala: !mala };
    });
    chk("hash+verificación con salt", hashOk.h && hashOk.buena && hashOk.mala, JSON.stringify(hashOk));

    // ── 7. El panel lista las cuentas ────────────────────────────────────
    await page.evaluate(() => setSection("accounts"));
    await esperar(500);
    const panelHtml = await page.evaluate(() => document.getElementById("section-accounts").innerHTML);
    chk("panel muestra las 3 cuentas", ["pro.qa@puntero.test", "cliente.qa@puntero.test", "demo.qa@puntero.test"].every((x) => panelHtml.includes(x)), "faltan algunas");
    chk("panel muestra badges de tier", /⭐ PRO/.test(panelHtml) && /👤 Usuario/.test(panelHtml) && /🎭 Demo/.test(panelHtml));

    // ── 7b. Editar una cuenta ────────────────────────────────────────────
    await page.evaluate(() => setSection("accounts"));
    await esperar(400);
    const editOk = await page.evaluate(() => {
      const acc = getAccounts().find((a) => a.username === "cliente.qa@puntero.test");
      adminEditAccount(acc.id);
      const sel = document.getElementById("ed-acc-type");
      const tieneOpciones = sel && sel.options.length === 3;
      if (sel) { sel.value = "pro"; }
      const mes = document.getElementById("ed-acc-pro");
      if (mes) { mes.value = "2027-06"; }
      return { tieneOpciones, tipo: sel ? sel.value : null };
    });
    chk("modal de edición con los 3 planes", editOk.tieneOpciones, editOk.tipo);
    const ascenso = await page.evaluate(() => {
      const acc = getAccounts().find((a) => a.username === "cliente.qa@puntero.test");
      adminSaveAccountEdit(acc.id);
      const d = getAccounts().find((a) => a.username === "cliente.qa@puntero.test");
      return { type: d.type, pro: !!d.proUntil };
    });
    await esperar(300);
    chk("asceder usuario → PRO desde el panel", ascenso.type === "pro" && ascenso.pro, JSON.stringify(ascenso));

    // ── 7c. Desactivar cuenta ───────────────────────────────────────────
    const toggleR = await page.evaluate(() => {
      const acc = getAccounts().find((a) => a.username === "cliente.qa@puntero.test");
      adminToggleActive(acc.id);
      return getAccounts().find((a) => a.username === "cliente.qa@puntero.test").active;
    });
    chk("desactivar cuenta desde el panel", toggleR === false, toggleR);
    await page.evaluate(() => {
      const acc = getAccounts().find((a) => a.username === "cliente.qa@puntero.test");
      adminToggleActive(acc.id);
    });

    // Volver la cuenta a "usuario" (la habíamos ascendido a PRO para probar el
    // editor) para que el login de más abajo pruebe el plan de compra única.
    await page.evaluate(() => {
      const acc = getAccounts().find((a) => a.username === "cliente.qa@puntero.test");
      adminEditAccount(acc.id);
      document.getElementById("ed-acc-type").value = "usuario";
      adminSaveAccountEdit(acc.id);
    });
    await esperar(300);

    // ── 8. Iniciar sesión como el USUARIO (compra única) ─────────────────
    // logout() es asincrónico (cierra la sesión de Firebase y recién después
    // cierra el modal): hay que esperarlo, si no showAuthModal() se lo cierra.
    await page.evaluate(async () => {
      await logout();
      showAuthModal();
    });
    await esperar(700);
    const lockUsuario = await page.evaluate(() => document.getElementById("app-lock").style.display !== "none");
    chk("al cerrar sesión la app se bloquea", lockUsuario, lockUsuario);

    await page.evaluate(async () => {
      document.getElementById("auth-email").value = "cliente.qa@puntero.test";
      document.getElementById("auth-pass").value = "Clave12345";
      await login();
    });
    await esperar(1000);
    const sesionUsuario = await page.evaluate(() => ({
      user: window._currentUser && window._currentUser.email,
      tier: currentTier ? currentTier() : "n/a",
      cloud: isCloudUser ? isCloudUser() : "n/a",
      locked: document.getElementById("app-lock").style.display === "none" ? false : true,
    }));
    chk("usuario de compra única inicia sesión", sesionUsuario.user === "cliente.qa@puntero.test", sesionUsuario.user);
    chk("usuario es tier 'usuario'", sesionUsuario.tier === "usuario", sesionUsuario.tier);
    chk("usuario NO tiene nube (todo local)", sesionUsuario.cloud === false, sesionUsuario.cloud);
    chk("usuario desbloquea la app", sesionUsuario.locked === false, sesionUsuario.locked);

    // ── 9. Cerrar y entrar como PRO ──────────────────────────────────────
    // logout() es asincrónico (cierra la sesión de Firebase y recién después
    // cierra el modal): hay que esperarlo, si no showAuthModal() se lo cierra.
    await page.evaluate(async () => {
      await logout();
      showAuthModal();
    });
    await esperar(700);
    await page.evaluate(async () => {
      document.getElementById("auth-email").value = "pro.qa@puntero.test";
      document.getElementById("auth-pass").value = "Clave12345";
      await login();
    });
    await esperar(1200);
    const sesionPro = await page.evaluate(() => ({
      user: window._currentUser && window._currentUser.email,
      tier: currentTier ? currentTier() : "n/a",
      cloud: isCloudUser ? isCloudUser() : "n/a",
      precios: typeof canUpdatePrices === "function" ? canUpdatePrices() : null,
      sesionFb: !!(window._AUTH && window._AUTH.currentUser),
      locked: document.getElementById("app-lock").style.display === "none" ? false : true,
    }));
    chk("PRO inicia sesión", sesionPro.user === "pro.qa@puntero.test", sesionPro.user);
    chk("PRO es tier 'pro'", sesionPro.tier === "pro", sesionPro.tier);
    chk("PRO tiene derecho a precios (suscripción vigente)", sesionPro.precios === true, sesionPro.precios);
    chk("PRO: estado de nube coherente con la sesión", sesionPro.cloud === sesionPro.sesionFb,
      "nube=" + sesionPro.cloud + " sesion=" + sesionPro.sesionFb);
    chk("PRO desbloquea la app", sesionPro.locked === false, sesionPro.locked);

    // ── 10. Contraseña incorrecta no entra ───────────────────────────────
    // logout() es asincrónico (cierra la sesión de Firebase y recién después
    // cierra el modal): hay que esperarlo, si no showAuthModal() se lo cierra.
    await page.evaluate(async () => {
      await logout();
      showAuthModal();
    });
    await esperar(700);
    await page.evaluate(async () => {
      document.getElementById("auth-email").value = "pro.qa@puntero.test";
      document.getElementById("auth-pass").value = "ClaveErrada1";
      await login();
    });
    await esperar(900);
    const rechazo = await page.evaluate(() => ({
      user: window._currentUser && window._currentUser.email,
      locked: document.getElementById("app-lock").style.display !== "none",
      err: (document.getElementById("auth-error") || {}).textContent || "",
    }));
    chk("contraseña errada → sigue bloqueado", rechazo.locked === true, rechazo.user);
    chk("muestra mensaje de error", !!rechazo.err, rechazo.err);

    // ── Limpieza: no dejar cuentas de QA en el registro real del admin ────
    await page.evaluate(async () => {
      try { await logout(); } catch (e) {}
      localStorage.setItem("pte_master_session", "1");
      window._currentUser = { uid: "master", email: "martin@puntero.local", isMaster: true };
      applyAppLock();
    });
    await esperar(600);
    const limpias = await page.evaluate(async ({ email, pass }) => {
      const creadas = getAccounts()
        .filter((a) => /@puntero\.test$/.test(String(a.username || "")))
        .map((a) => a.id);
      for (const id of creadas) { removeAccountLocal(id); }
      // Este bloque corre después de un logout: el registro solo se escribe
      // con sesión del dueño, así que hay que volver a entrar (tan estricto es).
      try { await window._AUTH.signInWithEmailAndPassword(email, pass); } catch (e) {}
      await ensureAdminSync();
      await pushAccountsSync();
      await new Promise((r) => setTimeout(r, 3000));
      return creadas.length;
    }, { email: creds.email, pass: creds.pass });
    // Se verifica en la NUBE, no solo local: borrar en el panel sin que el
    // borrado llegue deja la cuenta viva en otros dispositivos.
    const ledgerLimpio = await page.evaluate(async () => {
      try {
        const d = await window._FIRESTORE.collection("accounts").doc("ledger").get();
        if (!d.exists) { return true; }
        return !(d.data().list || []).some((a) => /@puntero\.test$/.test(String(a.username || "")));
      } catch (e) { return null; }
    });
    chk("cuentas de QA retiradas del registro local (" + limpias + ")", limpias >= 0, limpias);
    chk("y también de la nube", ledgerLimpio === true, ledgerLimpio);

    const pass = report.filter((l) => l.startsWith("PASS")).length;
    console.log(`\nTOTAL: ${pass}/${report.length}`);
    await browser.close();
  } catch (e) {
    fail("excepción: " + e.message);
  } finally {
    try { server.kill(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
    report.push("ERROS(page): " + (errores.length ? [...new Set(errores)].slice(0, 3).join(" | ") : "ninguno"));
    console.log(report.join("\n"));
    process.exit(report.some((r) => r.startsWith("FAIL")) ? 1 : 0);
  }
};

main();
