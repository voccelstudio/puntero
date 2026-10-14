import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

// Tests de la sincronización Firestore sobre el código REAL de app.js.
// Es la parte más riesgosa (puede pisar datos), así que cubrimos los 4
// escenarios de conflicto local-vs-nube del guard last-writer-wins.

const app = loadApp();

// Stub mínimo de la SDK de Firebase (no está cargada en jsdom).
globalThis.firebase = {
  firestore: { FieldValue: { serverTimestamp: () => ({ __srv: true }) } },
};

/**
 * Instala un Firestore falso en window y devuelve el arreglo de llamadas a set().
 * cloudMillis se expone como updatedAt.toMillis() de la nube.
 */
function mockFirestore({ exists, appState, cloudMillis }) {
  const setCalls = [];
  const ref = {
    get: async () => ({
      exists,
      data: () => ({
        appState,
        updatedAt: cloudMillis != null ? { toMillis: () => cloudMillis } : undefined,
      }),
    }),
    set: async (data, opts) => { setCalls.push({ data, opts }); },
  };
  window._FIRESTORE = { collection: () => ({ doc: () => ref }) };
  return setCalls;
}

// El uid que usan las reglas de Firestore es el de la sesión AUTHENTICADA, no el
// de la cuenta. Sin sesión real, la escritura se rechazaría: por eso el sync se
// apaga en lugar de fallar en silencio.
const FB_UID = "fb-uid-1";

function conSesionFirebase() {
  window._AUTH = { currentUser: { uid: FB_UID, email: "u1@puntero.test" } };
}
function sinSesionFirebase() {
  window._AUTH = null;
}

// Registro local de cuentas del admin (lo lee getAccounts() desde localStorage).
function account(uid, type, extra) {
  return Object.assign({
    id: "acc-" + uid,
    uid,
    username: uid + "@puntero.test",
    type,
    active: true,
    firebase: true,
    proUntil: type === "pro" ? Date.now() + 30 * 86400000 : null,
  }, extra || {});
}
// Usuario PRO: tiene plan y sesión real → sincroniza.
function proUser(uid) {
  localStorage.setItem("pte_accounts", JSON.stringify([account(uid, "pro")]));
  window._currentUser = { uid, email: uid + "@puntero.test" };
  conSesionFirebase();
}
// Usuario que compró una vez: todo local, sin nube.
function basicUser(uid) {
  localStorage.setItem("pte_accounts", JSON.stringify([account(uid, "usuario")]));
  window._currentUser = { uid, email: uid + "@puntero.test" };
  conSesionFirebase();
}
function localProject(id) {
  return {
    id,
    name: "Local " + id,
    budgets: [{ id: "main", name: "P", profitPct: 0, ivaEnabled: false, items: [] }],
    execution: { schedules: {}, dailyLogs: [] },
  };
}

beforeEach(() => {
  app.resetState();
  delete app.state._lastCloudSync;
  delete app.state._localModifiedAt;
  delete app.state._cloudSyncEnabled;
  window._currentUser = null;
  sinSesionFirebase();
});

afterEach(() => {
  vi.useRealTimers();
  delete window._FIRESTORE;
  delete window._currentUser;
  delete window._AUTH;
  localStorage.removeItem("pte_accounts");
});

// ── loadFromFirestore ──────────────────────────────────────────────────
describe("loadFromFirestore()", () => {
  it("nube vacía + datos locales → sube lo local", async () => {
    app.state.projects = [localProject("local1")];
    proUser("u1");
    const setCalls = mockFirestore({ exists: false });

    await app.loadFromFirestore();

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].data.appState.projects[0].id).toBe("local1");
    expect(setCalls[0].opts.merge).toBe(true);
  });

  it("usuario de compra única (sin nube) → no toca Firestore", async () => {
    app.state.projects = [localProject("local1")];
    basicUser("u1");
    const setCalls = mockFirestore({ exists: true, appState: { projects: [localProject("nube")] }, cloudMillis: Date.now() });

    await app.loadFromFirestore();

    // Corre solo en su dispositivo: ni sube ni baja nada.
    expect(setCalls.length).toBe(0);
    expect(app.state.projects[0].id).toBe("local1");
  });

  it("PRO sin sesión real de Firebase → NO sincroniza (las reglas lo rechazarían)", async () => {
    app.state.projects = [localProject("local1")];
    // Plan PRO vigente pero sin sesión autenticada → Firestore rechazaría.
    localStorage.setItem("pte_accounts", JSON.stringify([account("u1", "pro")]));
    window._currentUser = { uid: "u1", email: "u1@puntero.test" };
    sinSesionFirebase();
    const setCalls = mockFirestore({ exists: false });

    await app.loadFromFirestore();

    expect(setCalls.length).toBe(0);
  });

  it("dispositivo nuevo (nunca sincronizó) → la nube gana aunque lo local sea más nuevo", async () => {
    // Simula el proyecto demo de un recién instalado: recién guardado
    // (localModifiedAt alto) pero SIN historial de sync.
    app.state.projects = [localProject("demo")];
    app.state._localModifiedAt = Date.now();
    // sin _lastCloudSync
    proUser("u1");
    const setCalls = mockFirestore({
      exists: true,
      appState: { projects: [localProject("cloud-real")], section: "budget" },
      cloudMillis: 1000,
    });

    await app.loadFromFirestore();

    // NO sube el demo: protege los datos reales de la nube.
    expect(setCalls.length).toBe(0);
    expect(app.state.projects[0].id).toBe("cloud-real");
  });

  it("ya sincronizó + cambio local más nuevo → sube lo local sin pisarlo", async () => {
    app.state.projects = [localProject("cambios-locales")];
    app.state._lastCloudSync = "2026-06-13T10:00:00.000Z";
    app.state._localModifiedAt = 9_999_999_999_999; // más nuevo que la nube
    proUser("u1");
    const setCalls = mockFirestore({
      exists: true,
      appState: { projects: [localProject("nube-vieja")] },
      cloudMillis: 1000,
    });

    await app.loadFromFirestore();

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].data.appState.projects[0].id).toBe("cambios-locales");
    // El estado local NO fue reemplazado por el de la nube.
    expect(app.state.projects[0].id).toBe("cambios-locales");
  });

  it("ya sincronizó + la nube más nueva → trae la nube", async () => {
    app.state.projects = [localProject("local-viejo")];
    app.state._lastCloudSync = "2026-06-13T10:00:00.000Z";
    app.state._localModifiedAt = 500; // más viejo que cloudMillis=1000
    proUser("u1");
    const setCalls = mockFirestore({
      exists: true,
      appState: { projects: [localProject("nube-nueva")], section: "budget" },
      cloudMillis: 1000,
    });

    await app.loadFromFirestore();

    expect(setCalls.length).toBe(0);
    expect(app.state.projects[0].id).toBe("nube-nueva");
    // Tras traer la nube, marca que este dispositivo quedó al día.
    expect(app.state._lastCloudSync).toBeTruthy();
  });
});

// ── firestoreSync ──────────────────────────────────────────────────────
describe("firestoreSync()", () => {
  it("cuenta maestra CON sesión de Firebase: SÍ sincroniza (VIP vitalicia)", () => {
    vi.useFakeTimers();
    window._currentUser = { uid: "master", email: "martin@puntero.local", isMaster: true };
    window._AUTH = { currentUser: { uid: "fb-master" } };
    app.state.projects = [localProject("obra-maestra")];
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    vi.advanceTimersByTime(300);

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].data.appState.projects[0].id).toBe("obra-maestra");
  });

  it("cuenta maestra SIN sesión de Firebase: no sincroniza", () => {
    // La sesión maestra es puramente local: para tener su propia nube hay que
    // vincularla (el panel lo indica).
    vi.useFakeTimers();
    window._currentUser = { uid: "master", email: "martin@puntero.local", isMaster: true };
    sinSesionFirebase();
    app.state.projects = [localProject("obra-maestra")];
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    vi.advanceTimersByTime(300);

    expect(setCalls.length).toBe(0);
  });

  it("no escribe para un usuario de compra única (todo local)", () => {
    vi.useFakeTimers();
    basicUser("u1");
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    vi.advanceTimersByTime(300);

    expect(setCalls.length).toBe(0);
  });

  it("no escribe si el sync está desactivado en settings", () => {
    vi.useFakeTimers();
    proUser("u1");
    app.state._cloudSyncEnabled = false;
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    vi.advanceTimersByTime(300);

    expect(setCalls.length).toBe(0);
  });

  it("escribe tras el debounce (100ms) para usuario PRO", () => {
    vi.useFakeTimers();
    proUser("u1");
    app.state.projects = [localProject("obra-x")];
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    expect(setCalls.length).toBe(0); // aún pendiente (debounce)
    vi.advanceTimersByTime(150);

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].data.appState.projects[0].id).toBe("obra-x");
  });
});
