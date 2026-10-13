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
  window._currentUser = { uid: "u1" };
});

afterEach(() => {
  vi.useRealTimers();
  delete window._FIRESTORE;
  delete window._currentUser;
});

// ── loadFromFirestore ──────────────────────────────────────────────────
describe("loadFromFirestore()", () => {
  it("nube vacía + datos locales → sube lo local", async () => {
    app.state.projects = [localProject("local1")];
    const setCalls = mockFirestore({ exists: false });

    await app.loadFromFirestore();

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].data.appState.projects[0].id).toBe("local1");
    expect(setCalls[0].opts.merge).toBe(true);
  });

  it("dispositivo nuevo (nunca sincronizó) → la nube gana aunque lo local sea más nuevo", async () => {
    // Simula el proyecto demo de un recién instalado: recién guardado
    // (localModifiedAt alto) pero SIN historial de sync.
    app.state.projects = [localProject("demo")];
    app.state._localModifiedAt = Date.now();
    // sin _lastCloudSync
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
  it("no escribe para cuenta maestra (es local por diseño)", () => {
    vi.useFakeTimers();
    window._currentUser = { uid: "master", isMaster: true };
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    vi.advanceTimersByTime(300);

    expect(setCalls.length).toBe(0);
  });

  it("no escribe si el sync está desactivado en settings", () => {
    vi.useFakeTimers();
    window._currentUser = { uid: "u1" };
    app.state._cloudSyncEnabled = false;
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    vi.advanceTimersByTime(300);

    expect(setCalls.length).toBe(0);
  });

  it("escribe tras el debounce (100ms) para usuario cloud normal", () => {
    vi.useFakeTimers();
    window._currentUser = { uid: "u1" };
    app.state.projects = [localProject("obra-x")];
    const setCalls = mockFirestore({ exists: false });

    app.firestoreSync();
    expect(setCalls.length).toBe(0); // aún pendiente (debounce)
    vi.advanceTimersByTime(150);

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].data.appState.projects[0].id).toBe("obra-x");
  });
});
