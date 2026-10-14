import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

// Smoke del flujo pagado de precios: un suscriptor PRO con una base vieja
// instalada debe ver que hay precios nuevos, aplicarlos y NO perder lo que
// editó a mano. Un usuario de compra única no debe recibir nada (su licencia
// sigue funcionando igual, solo no se actualiza).

const PUERTO = 4603;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = `http://127.0.0.1:${PUERTO}/`;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PERFIL = path.join(tmpdir(), `puntero-precios-probe-${Date.now()}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Versión que publica el servidor real (lo que el admin subió con build_precios).
const MANIFIESTO = JSON.parse(fs.readFileSync(path.join(ROOT, "precios", "manifest.json"), "utf8"));
const CAT = "ESTRUCTURAS";
const RUBRO = Object.keys(MANIFIESTO.db[CAT])[0];
const PRECIO_MARCADO = 999999; // edición "del usuario" que debe sobrevivir

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
  // Sin `shell: true`: así server.kill() le pega a python.exe directamente.
  // Con shell, node mata el cmd.exe intermedio y el server queda huérfano
  // ocupando el puerto en la siguiente corrida.
  const server = spawn("python", ["-m", "http.server", String(PUERTO)], { stdio: "ignore", cwd: ROOT });
  try {
    await serverListo();
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", userDataDir: PERFIL, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    page.setCacheEnabled(false);

    await page.goto(URL, { waitUntil: "networkidle2" });
    await esperar(800);

    // ── 1. Instalar una base VIEJA y entrar como PRO ──────────────────────
    await page.evaluate(({ cat, rubro, precio }) => {
      localStorage.setItem("pte_accounts", JSON.stringify([{
        id: "acc-pro-qa", uid: "acc-pro-qa", username: "pro.precios@puntero.test",
        type: "pro", active: true, proUntil: Date.now() + 30 * 86400000,
      }]));
      // Instalado: una versión anterior a la que publica el servidor
      localStorage.setItem("ppy_db_version", "2026-01");
      localStorage.setItem("ppy_db_mes", "2026-01");
      window._currentUser = { uid: "acc-pro-qa", email: "pro.precios@puntero.test", accountId: "acc-pro-qa", isPaidAccount: true };
      applyAppLock();
      setSection("prices");
      // El usuario corrigió un precio a mano: no lo debe perder al actualizar
      DB[cat][rubro].total = precio;
      save();
    }, { cat: CAT, rubro: RUBRO, precio: PRECIO_MARCADO });

    const instalado = await page.evaluate(() => ({
      version: localStorage.getItem("ppy_db_version"),
      mes: localStorage.getItem("ppy_db_mes"),
      fecha: preciosFechaLabel(preciosInstalados().fecha),
    }));
    chk("base instalada es la vieja (2026-01)", instalado.version === "2026-01", instalado.version);
    chk("la app muestra la fecha de lo instalado", instalado.fecha === "enero 2026", instalado.fecha);

    // ── 2. Chequear actualización: debe ofrecer los precios del servidor ───
    await page.evaluate(() => chequearPrecios());
    await esperar(600);
    const aviso = await page.evaluate(() => {
      const el = document.getElementById("precios-aviso");
      return el ? el.innerHTML : "";
    });
    chk("ofrece precios nuevos", /Hay precios nuevos/i.test(aviso), aviso.slice(0, 120));

    // ── 3. Aplicar: cambia la versión y conserva la edición manual ─────────
    await page.evaluate(() => aplicarPreciosDesdeAviso());
    await esperar(400);
    const aplicado = await page.evaluate(({ cat, rubro }) => ({
      version: localStorage.getItem("ppy_db_version"),
      mes: localStorage.getItem("ppy_db_mes"),
      precioEditado: DB[cat][rubro].total,
      categorias: Object.keys(DB).length,
      rubros: Object.values(DB).reduce((n, items) => n + Object.keys(items).length, 0),
      pendiente: !!state._preciosPendientes,
    }), { cat: CAT, rubro: RUBRO });
    chk("versión instalada pasa a la del servidor",
      aplicado.version === MANIFIESTO.version, aplicado.version + " vs " + MANIFIESTO.version);
    chk("mes de referencia actualizado", aplicado.mes === (MANIFIESTO.mes || null), aplicado.mes);
    chk("conserva el precio editado a mano", aplicado.precioEditado === PRECIO_MARCADO, aplicado.precioEditado);
    chk("aplica la base completa del servidor",
      aplicado.categorias === MANIFIESTO.categorias && aplicado.rubros === MANIFIESTO.rubros,
      aplicado.categorias + " cats / " + aplicado.rubros + " rubros");
    chk("no queda nada pendiente", aplicado.pendiente === false, aplicado.pendiente);

    // ── 4. Segunda pasada: ya está al día ─────────────────────────────────
    await page.evaluate(() => chequearPrecios());
    await esperar(600);
    const alDia = await page.evaluate(() => document.getElementById("precios-aviso").innerHTML);
    chk("segunda pasada dice 'ya está al día'", /al día/i.test(alDia), alDia.slice(0, 120));

    // ── 5. Recargar: los precios remotos deben sobrevivir al arranque ─────
    // Sin la marca de origen, el arranque migraría la base a la compilada y
    // el suscriptor perdería lo que acababa de recibir.
    await page.evaluate(() => {
      localStorage.setItem("pte_paid_session", JSON.stringify({ accountId: "acc-pro-qa" }));
      localStorage.removeItem("pte_guest_session");
    });
    await page.reload({ waitUntil: "networkidle2" });
    await esperar(1200);
    const trasRecarga = await page.evaluate(({ cat, rubro, precio }) => ({
      user: window._currentUser && window._currentUser.email,
      version: localStorage.getItem("ppy_db_version"),
      precioEditado: DB[cat][rubro].total,
      categorias: Object.keys(DB).length,
      rubros: Object.values(DB).reduce((n, items) => n + Object.keys(items).length, 0),
    }), { cat: CAT, rubro: RUBRO, precio: PRECIO_MARCADO });
    chk("tras recargar sigue con la sesión PRO", trasRecarga.user === "pro.precios@puntero.test", trasRecarga.user);
    chk("tras recargar conserva la versión de la suscripción",
      trasRecarga.version === MANIFIESTO.version, trasRecarga.version);
    chk("tras recargar no baja a la base compilada",
      trasRecarga.categorias === MANIFIESTO.categorias && trasRecarga.rubros === MANIFIESTO.rubros,
      trasRecarga.categorias + " cats / " + trasRecarga.rubros + " rubros");
    chk("tras recargar mantiene el precio editado a mano",
      trasRecarga.precioEditado === PRECIO_MARCADO, trasRecarga.precioEditado);

    // ── 6. Usuario de compra única: no recibe nada ────────────────────────
    const gate = await page.evaluate(async ({ versionVieja }) => {
      localStorage.setItem("pte_accounts", JSON.stringify([{
        id: "acc-user-qa", uid: "acc-user-qa", username: "user.precios@puntero.test",
        type: "usuario", active: true,
      }]));
      window._currentUser = { uid: "acc-user-qa", email: "user.precios@puntero.test", accountId: "acc-user-qa", isPaidAccount: true };
      // Vuelve a una base vieja para que la tentación de actualizar exista
      localStorage.setItem("ppy_db_version", versionVieja);
      localStorage.setItem("ppy_db_mes", versionVieja);

      var fetchLlamado = false;
      var fetchOriginal = window.fetch;
      window.fetch = function () { fetchLlamado = true; return fetchOriginal.apply(window, arguments); };

      chequearPrecios();
      await new Promise((r) => setTimeout(r, 600));
      window.fetch = fetchOriginal;

      return {
        fetchLlamado,
        aviso: (document.getElementById("precios-aviso") || {}).innerHTML || "",
        version: localStorage.getItem("ppy_db_version"),
        tier: currentTier(),
      };
    }, { versionVieja: "2026-01" });
    chk("usuario de compra única: no consulta precios remotos", gate.fetchLlamado === false, gate.fetchLlamado);
    chk("avisa que es beneficio del plan PRO", /PRO/i.test(gate.aviso), gate.aviso.slice(0, 120));
    chk("su base no cambia", gate.version === "2026-01", gate.version);
    chk("su licencia sigue siendo 'usuario'", gate.tier === "usuario", gate.tier);

    await browser.close();
  } finally {
    server.kill();
  }

  report.forEach((l) => console.log(l));
  const pass = report.filter((l) => l.startsWith("PASS")).length;
  console.log(`\nTOTAL: ${pass}/${report.length}`);
  process.exit(pass === report.length ? 0 : 1);
};

main();
