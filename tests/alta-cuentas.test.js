import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

const app = loadApp();

// Regresión real: al crear una cuenta el panel hacía
//   ensureAdminSync().then(pushAccountsSync)
// es decir, el PULL de la nube corriendo en paralelo al PUSH del cambio. Con
// el ledger todavía sin la cuenta (o vacío), el merge pisaba lo recién creado:
// la cuenta quedaba solo en el navegador del dueño, el cliente no podía entrar
// y el panel dejaba de mostrarla al re-sincronizar.
describe("crear una cuenta: se espera la publicación real en la nube", () => {
  let escrituras;
  let avisos;

  function firestoreQue(setea) {
    return {
      collection: () => ({
        doc: () => ({
          set: async (data) => {
            escrituras.push(data);
            if (!setea) {
              const e = new Error("unavailable");
              e.code = "unavailable";
              throw e;
            }
          },
        }),
      }),
    };
  }

  function llenarForm() {
    document.getElementById("acc-user").value = "cliente@obra.com";
    document.getElementById("acc-pass").value = "secreta123";
    document.getElementById("acc-months").value = "3";
  }

  function cuentaCreada() {
    return app.getAccounts().find((a) => a.username === "cliente@obra.com");
  }

  beforeEach(() => {
    escrituras = [];
    avisos = [];
    ["acc-user", "acc-pass", "acc-months"].forEach((id) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("input");
        el.id = id;
        document.body.appendChild(el);
      }
    });
    localStorage.removeItem("pte_accounts");
    localStorage.removeItem("pte_demos_borradas");
    window._currentUser = { isMaster: true };
    window._accTypeSel = "pro";
    window.toast = (msg, ok) => { avisos.push({ msg: String(msg), ok: ok !== false }); };
    window._lastAccountSync = Date.now(); // throttlea cualquier pull concurrente
  });

  afterEach(() => {
    delete window._FIRESTORE;
    delete window._AUTH;
    delete window.toast;
    delete window._currentUser;
    delete window._accTypeSel;
    localStorage.removeItem("pte_accounts");
  });



  it("espera el push: la cuenta queda escrita en el ledger ANTES del toast", async () => {
    let resolvio = false;
    window._FIRESTORE = {
      collection: () => ({
        doc: () => ({
          set: async (data) => {
            escrituras.push(data);
            await new Promise((r) => setTimeout(r, 30));
            resolvio = true;
          },
        }),
      }),
    };
    window._AUTH = { get currentUser() { return { uid: app.MASTER_UID }; } };

    llenarForm();
    const p = window.adminCreateAccount();
    await new Promise((r) => setTimeout(r, 5));
    // El alta NO se da por hecha hasta que la nube confirme
    expect(resolvio).toBe(false);
    expect(avisos.some((t) => /creado/i.test(t.msg))).toBe(false);

    await p;
    expect(resolvio).toBe(true);
    expect(escrituras).toHaveLength(1);
    const ledger = escrituras[0].list;
    expect(ledger.some((x) => x.username === "cliente@obra.com")).toBe(true);
    expect(ledger.some((x) => x.passwordHash)).toBe(true);
    expect(avisos.some((t) => /PRO creado/i.test(t.msg))).toBe(true);
  });

  it("NO hay pull previo al push (el merge no puede pisar lo recién creado)", async () => {
    let getLlamado = 0;
    window._FIRESTORE = {
      collection: () => ({
        doc: () => ({
          get: async () => { getLlamado++; return { exists: false, data: () => null }; },
          set: async () => {},
        }),
      }),
    };
    window._AUTH = { get currentUser() { return { uid: app.MASTER_UID }; } };

    llenarForm();
    await window.adminCreateAccount();

    // Cero lecturas del ledger: el registro se escribe desde el estado local,
    // que es el que tiene la cuenta recién creada.
    expect(getLlamado).toBe(0);
    expect(escrituras).toHaveLength(0); // la set del mock no registra, pero sí no hubo get
  });

  it("si la publicación falla, se avisa que la cuenta es solo local", async () => {
    window._FIRESTORE = firestoreQue(false);
    window._AUTH = { get currentUser() { return { uid: app.MASTER_UID }; } };

    llenarForm();
    await window.adminCreateAccount();

    // La cuenta existe localmente (el panel funcionó) pero la nube no la
    // recibió: el cliente no podría entrar, así que hace falta el aviso.
    expect(cuentaCreada()).toBeTruthy();
    expect(avisos.some((t) => t.ok === false && /nube/i.test(t.msg))).toBe(true);
  });

  it("sin sesión del dueño no escribe (la regla lo rechazaría) y avisa", async () => {
    window._FIRESTORE = firestoreQue(true);
    window._AUTH = { get currentUser() { return { uid: "otro-uid" }; } };

    llenarForm();
    await window.adminCreateAccount();

    expect(escrituras).toHaveLength(0);
    expect(cuentaCreada()).toBeTruthy();
    expect(avisos.some((t) => t.ok === false && /nube/i.test(t.msg))).toBe(true);
  });

  it("extender y activar/desactivar también esperan la publicación", async () => {
    window._FIRESTORE = firestoreQue(true);
    window._AUTH = { get currentUser() { return { uid: app.MASTER_UID }; } };
    app.setAccounts([
      { id: "acc-1", username: "cliente@obra.com", type: "pro", active: true, updatedAt: Date.now(), proUntil: Date.now() + 86400000 },
    ]);

    await window.adminExtendPro("acc-1", 1);
    await window.adminToggleActive("acc-1");

    // Dos escrituras confirmadas (extensión + toggles), sin pull de por medio
    expect(escrituras).toHaveLength(2);
    const ledgerFinal = escrituras[1].list;
    expect(ledgerFinal.find((x) => x.id === "acc-1").active).toBe(false);
  });
});
