import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApp } from "./helpers/app-loader.js";

// El ingreso del panel maestro se verifica contra Firebase Auth. Estos tests
// usan un _AUTH simulado (sin red) para el camino lógico, y leen el fuente
// REAL de app.js para garantizar que no haya ninguna contraseña escrita en él.
const app = loadApp();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function llenarLogin(user, pass) {
  document.getElementById("auth-email").value = user;
  document.getElementById("auth-pass").value = pass;
}

// El setup de vitest no carga index.html: se crean solo los elementos que la
// ruta del login toca (toast/applyAppLock toleran ausencias; closeModal no).
function asegurarDOM() {
  [["auth-email", "input"], ["auth-pass", "input"], ["auth-error", "div"], ["modal-area", "div"]]
    .forEach(([id, tag]) => {
      if (!document.getElementById(id)) {
        const el = document.createElement(tag);
        el.id = id;
        document.body.appendChild(el);
      }
    });
}

describe("login() — la maestra se valida en Firebase Auth, no con un texto del código", () => {
  let llamadas;
  let sesionActiva;

  beforeEach(() => {
    llamadas = [];
    sesionActiva = null;
    localStorage.removeItem("pte_master_session");
    delete window._currentUser;
    asegurarDOM();
    document.getElementById("auth-error").textContent = "";
    document.getElementById("auth-error").style.display = "none";
    // Firebase simulado: guarda la sesión como hace el SDK (currentUser)
    window._AUTH = {
      get currentUser() { return sesionActiva; },
      signInWithEmailAndPassword: async (email, pass) => {
        llamadas.push({ email, pass });
        if (email !== app.MASTER_EMAIL || pass !== "clave-del-dueño") {
          const e = new Error("INVALID_LOGIN_CREDENTIALS");
          e.code = "auth/invalid-credential";
          throw e;
        }
        sesionActiva = { uid: "fb-owner", email };
        return { user: sesionActiva };
      },
    };
  });

  afterEach(() => {
    delete window._AUTH;
    delete window._currentUser;
    localStorage.removeItem("pte_master_session");
  });

  it("contraseña correcta → sesión maestra", async () => {
    llenarLogin("martin", "clave-del-dueño");
    await app.login();
    expect(localStorage.getItem("pte_master_session")).toBe("1");
    expect(window._currentUser.isMaster).toBe(true);
    // Se verificó contra el correo del dueño, con lo que se tecleó
    expect(llamadas).toEqual([{ email: app.MASTER_EMAIL, pass: "clave-del-dueño" }]);
  });

  it("acepta el correo del dueño como usuario (alias 'martin' o correo)", async () => {
    llenarLogin(app.MASTER_EMAIL, "clave-del-dueño");
    await app.login();
    expect(localStorage.getItem("pte_master_session")).toBe("1");
    expect(window._currentUser.isMaster).toBe(true);
  });

  it("contraseña incorrecta → NO hay sesión maestra", async () => {
    llenarLogin("martin", "cualquier-cosa");
    await app.login();
    expect(localStorage.getItem("pte_master_session")).toBe(null);
    expect(window._currentUser && window._currentUser.isMaster).toBeFalsy();
    expect(document.getElementById("auth-error").textContent).toMatch(/incorrectos/i);
    expect(llamadas).toHaveLength(1); // igual se consultó a Firebase
  });

  it("sin SDK de Firebase no abre: exige poder verificar la contraseña", async () => {
    delete window._AUTH;
    llenarLogin("martin", "clave-del-dueño");
    await app.login();
    expect(localStorage.getItem("pte_master_session")).toBe(null);
    expect(window._currentUser && window._currentUser.isMaster).toBeFalsy();
  });

  it("un usuario que no es del dueño nunca consulta Firebase como maestro", async () => {
    llenarLogin("cliente@x.com", "clave-del-dueño");
    await app.login();
    // Puede pasar por el ingreso genérico de cuentas, pero jamás por el del dueño
    expect(llamadas.filter((c) => c.email === app.MASTER_EMAIL)).toHaveLength(0);
    expect(localStorage.getItem("pte_master_session")).toBe(null);
    expect(window._currentUser && window._currentUser.isMaster).toBeFalsy();
  });
});

describe("el fuente que se publica no contiene secretos de la maestra", () => {
  const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

  it("no hay contraseña escrita en app.js", () => {
    // Ni la maestra ni ninguna otra: ninguna contraseña puede compararse contra
    // un texto del código (el repo y el sitio publican este archivo).
    expect(src).not.toMatch(/pass\s*===\s*["']/);
    expect(src).not.toMatch(/pass\s*!==\s*["']/);
    // Tampoco en la rama maestra del login, que es la que abre el panel.
    const ramaMaestra = src.slice(src.indexOf("async function login()"), src.indexOf("function logout"));
    expect(ramaMaestra).not.toMatch(/pass\s*===\s*["']/);
  });

  it("la maestra siempre pasa por Firebase Auth (no hay atajo local)", () => {
    expect(src).toMatch(/signInWithEmailAndPassword\(MASTER_EMAIL, pass\)/);
    // El alias no puede entrar sin verificar: solo habilita elegir la rama.
    expect(src).not.toMatch(/MASTER_ALIAS\s*&&\s*pass\s*===/);
  });
});

describe("el registro de cuentas: sin secretos en el cliente ni en las reglas", () => {
  const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

  it("ya no existe la identidad de transporte con clave embebida (admin.sync)", () => {
    // Su contraseña vivía en este archivo — y el repo es público —, así que
    // cualquiera podía firmar como esa identidad y escribir cuentas PRO.
    expect(src).not.toMatch(/ADMIN_SYNC_PASS/);
    expect(src).not.toMatch(/signInWithEmailAndPassword\(\s*["']/);
    // Firmar ahora depende de una variable (MASTER_EMAIL): sin contraseña real,
    // Firebase rechaza.
    expect(src).toMatch(/signInWithEmailAndPassword\(MASTER_EMAIL, pass\)/);
  });

  it("las reglas solo permiten escribir el registro con el uid del dueño", () => {
    const reglas = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
    const desdeAccounts = reglas.slice(reglas.indexOf("match /accounts/"));
    expect(desdeAccounts).toContain(app.MASTER_UID);
    expect(desdeAccounts).not.toMatch(/admin\.sync@puntero\.local/);
    // Y la lectura sigue siendo pública (cualquier dispositivo valida su
    // contraseña contra el ledger sin iniciar sesión).
    expect(desdeAccounts).toMatch(/allow read: if true;/);
  });

  it("escribir el registro exige la sesión del dueño en el código", () => {
    expect(src).toMatch(/function _esSesionDuenio/);
    expect(src).toMatch(/if \(!_esSesionDuenio\(\) \|\| !window\._FIRESTORE\)/);
    // Vincular cuentas también: crea usuarios reales en Auth.
    expect(src).toMatch(/if \(!_esSesionDuenio\(\)\) \{\s*return toast\("Para vincular/);
  });
});
