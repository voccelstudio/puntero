import { describe, it, expect } from "vitest";
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

describe("isCloudUser() — qué sesiones sincronizan con la nube", () => {
  it("usuario de Firebase normal: sí sincroniza", () => {
    window._currentUser = { uid: "u1", email: "a@b.com" };
    expect(app.isCloudUser()).toBe(true);
  });

  it("cuenta maestra: NO sincroniza (es local por diseño)", () => {
    window._currentUser = { uid: "master", email: "martin@puntero.local", isMaster: true };
    expect(app.isCloudUser()).toBe(false);
  });

  it("sesión demo/invitado: NO sincroniza", () => {
    window._currentUser = { uid: "guest-x", email: "x@puntero.local", isGuest: true };
    expect(app.isCloudUser()).toBe(false);
  });

  it("sin sesión: NO sincroniza", () => {
    window._currentUser = null;
    expect(app.isCloudUser()).toBe(false);
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
  it("no rompe si no existen los elementos del DOM", () => {
    // En jsdom los ids conn-banner / sync-chip no están: debe ser no-op.
    expect(() => app.updateConnStatus()).not.toThrow();
  });

  it("muestra 'guardado local' cuando el usuario no sincroniza", () => {
    window._currentUser = null;
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

  it("avisa 'sin conexión' cuando navigator.onLine es false, aunque sincronice", () => {
    window._currentUser = { uid: "u1", email: "a@b.com" };
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

  it("muestra la hora de la última sincronización para usuario cloud", () => {
    window._currentUser = { uid: "u1", email: "a@b.com" };
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
});
