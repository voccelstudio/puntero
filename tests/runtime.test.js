import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

// Tests de utilidades del runtime sobre el código REAL de app.js.
const app = loadApp();

describe("sectionFromUrl() — deep links de los shortcuts del manifest", () => {
  it("acepta una sección válida del manifest", () => {
    expect(app.sectionFromUrl("?section=logs")).toBe("logs");
    expect(app.sectionFromUrl("?section=materials")).toBe("materials");
    expect(app.sectionFromUrl("?section=contractors")).toBe("contractors");
    expect(app.sectionFromUrl("?section=global_dashboard")).toBe("global_dashboard");
  });

  it("devuelve null si no viene el parámetro", () => {
    expect(app.sectionFromUrl("")).toBeNull();
    expect(app.sectionFromUrl("?otra=cosa")).toBeNull();
  });

  it("rechaza secciones inexistentes (no inyecta valores del exterior)", () => {
    expect(app.sectionFromUrl("?section=documents_ocultas")).toBeNull();
    expect(app.sectionFromUrl("?section=../../etc/passwd")).toBeNull();
    expect(app.sectionFromUrl("?section=")).toBeNull();
  });

  it("tolera basura en el query sin romper", () => {
    expect(app.sectionFromUrl("%%%")).toBeNull();
    expect(app.sectionFromUrl(null)).toBeNull();
  });
});

describe("isCloudUser() / tiers — quién sincroniza con la nube", () => {
  beforeEach(() => { delete window._AUTH; });
  afterEach(() => { delete window._AUTH; });
  function sesionFirebase() { window._AUTH = { currentUser: { uid: "fb-1" } }; }

  function setLedger(list) {
    localStorage.setItem("pte_accounts", JSON.stringify(list));
  }

  it("cuenta maestra: tier maestra; con sesión de Firebase también nube", () => {
    window._currentUser = { uid: "master", email: "martin@puntero.local", isMaster: true };
    sesionFirebase();
    expect(app.currentTier()).toBe("maestra");
    expect(app.isCloudUser()).toBe(true);
  });

  it("PRO con suscripción vigente y sesión: sí sincroniza", () => {
    setLedger([{ id: "a1", uid: "u1", username: "pro@x.com", type: "pro", active: true, proUntil: Date.now() + 10 * 86400000 }]);
    window._currentUser = { uid: "u1", email: "pro@x.com" };
    sesionFirebase();
    expect(app.currentTier()).toBe("pro");
    expect(app.isCloudUser()).toBe(true);
  });

  it("PRO vigente pero SIN sesión de Firebase: no sincroniza", () => {
    setLedger([{ id: "a1", uid: "u1", username: "pro@x.com", type: "pro", active: true, proUntil: Date.now() + 10 * 86400000 }]);
    window._currentUser = { uid: "u1", email: "pro@x.com" };
    expect(app.currentTier()).toBe("pro"); // el plan sigue siendo PRO
    expect(app.isCloudUser()).toBe(false); // pero no puede usar la nube
  });

  it("PRO con suscripción VENCIDA: no sincroniza ni actualiza precios", () => {
    setLedger([{ id: "a1", uid: "u1", username: "pro@x.com", type: "pro", active: true, proUntil: Date.now() - 86400000 }]);
    window._currentUser = { uid: "u1", email: "pro@x.com" };
    sesionFirebase();
    expect(app.currentTier()).toBe("pro"); // sigue entrando, sigue trabajando
    expect(app.isCloudUser()).toBe(false);
    expect(app.canUpdatePrices()).toBe(false);
  });

  it("usuario de compra única: NO sincroniza (todo local)", () => {
    setLedger([{ id: "a1", uid: "u1", username: "cli@x.com", type: "usuario", active: true }]);
    window._currentUser = { uid: "u1", email: "cli@x.com" };
    sesionFirebase();
    expect(app.currentTier()).toBe("usuario");
    expect(app.isCloudUser()).toBe(false);
  });

  it("cuenta desactivada por el admin: sin tier", () => {
    setLedger([{ id: "a1", uid: "u1", username: "cli@x.com", type: "usuario", active: false }]);
    window._currentUser = { uid: "u1", email: "cli@x.com" };
    expect(app.currentTier()).toBeNull();
  });

  it("cuenta de Firebase fuera del registro: cae a usuario local", () => {
    setLedger([]);
    window._currentUser = { uid: "x9", email: "fuera@x.com" };
    expect(app.currentTier()).toBe("usuario");
    expect(app.isCloudUser()).toBe(false);
  });

  it("sin sesión: nada habilitado", () => {
    window._currentUser = null;
    expect(app.isCloudUser()).toBe(false);
    expect(app.currentTier()).toBeNull();
  });
});

describe("isOnline()", () => {
  it("refleja navigator.onLine", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "onLine");
    try {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      expect(app.isOnline()).toBe(false);
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      expect(app.isOnline()).toBe(true);
    } finally {
      if (original) {Object.defineProperty(navigator, "onLine", original);}
    }
  });
});

describe("updateConnStatus() — indicador de estado", () => {
  beforeEach(() => {
    delete window._AUTH;
  });
  afterEach(() => {
    delete window._AUTH;
  });

  it("no rompe si no existen los elementos del DOM", () => {
    // En jsdom los ids conn-banner / sync-chip no están: debe ser no-op.
    expect(() => app.updateConnStatus()).not.toThrow();
  });

  it("muestra 'guardado local' cuando el usuario no sincroniza", () => {
    localStorage.setItem("pte_accounts", JSON.stringify([{ id: "a1", uid: "u1", username: "c@x.com", type: "usuario", active: true }]));
    window._currentUser = { uid: "u1", email: "c@x.com" };
    app.state._cloudSyncEnabled = true;
    var chip = document.createElement("div");
    chip.id = "sync-chip";
    document.body.appendChild(chip);
    try {
      app.updateConnStatus();
      expect(chip.textContent).toContain("dispositivo");
    } finally {
      chip.remove();
    }
  });

  it("avisa 'sin conexión' cuando navigator.onLine es false", () => {
    localStorage.setItem("pte_accounts", JSON.stringify([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() + 30 * 86400000 }]));
    window._currentUser = { uid: "u1", email: "p@x.com" };
    window._AUTH = { currentUser: { uid: "fb-1" } };
    app.state._cloudSyncEnabled = true;
    var original = Object.getOwnPropertyDescriptor(navigator, "onLine");
    var banner = document.createElement("div");
    banner.id = "conn-banner";
    document.body.appendChild(banner);
    try {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      app.updateConnStatus();
      expect(banner.style.display).toBe("flex");
    } finally {
      if (original) {Object.defineProperty(navigator, "onLine", original);}
      banner.remove();
      window._currentUser = null;
    }
  });

  it("muestra la hora de la última sincronización para usuario PRO", () => {
    localStorage.setItem("pte_accounts", JSON.stringify([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() + 30 * 86400000 }]));
    window._currentUser = { uid: "u1", email: "p@x.com" };
    window._AUTH = { currentUser: { uid: "fb-1" } };
    app.state._cloudSyncEnabled = true;
    app.state._lastCloudSync = "2026-06-13T14:35:00.000Z";
    var chip = document.createElement("div");
    chip.id = "sync-chip";
    document.body.appendChild(chip);
    try {
      app.updateConnStatus();
      expect(chip.textContent).toContain("14:35");
      expect(chip.className).toContain("online");
    } finally {
      chip.remove();
      window._currentUser = null;
      delete app.state._lastCloudSync;
    }
  });

  it("PRO sin sesión de Firebase: no muestra estado de sincronizado", () => {
    // La nube exige sesión real; sin ella el indicador debe decir local.
    localStorage.setItem("pte_accounts", JSON.stringify([{ id: "a1", uid: "u1", username: "p@x.com", type: "pro", active: true, proUntil: Date.now() + 30 * 86400000 }]));
    window._currentUser = { uid: "u1", email: "p@x.com" };
    window._AUTH = null;
    app.state._cloudSyncEnabled = true;
    var chip = document.createElement("div");
    chip.id = "sync-chip";
    document.body.appendChild(chip);
    try {
      app.updateConnStatus();
      expect(chip.textContent).toContain("dispositivo");
      expect(chip.className).not.toContain("online");
    } finally {
      chip.remove();
      window._currentUser = null;
    }
  });
});
