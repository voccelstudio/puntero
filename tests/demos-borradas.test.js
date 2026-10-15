import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

const app = loadApp();

// Las demos base (invitado01 / invitado clara) se re-crean solas en cada
// render del panel y en cada pull del registro. Regresión real: el dueño las
// borraba, el panel avisaba "eliminada" y seguían estando porque
// seedDemoAccounts() las volvía a sembrar en el mismo ciclo.
describe("borrar una demo base: no vuelve a re-sembrarse sola", () => {
  const SLUG_CLARA = app.accUserNameSlug("invitado clara");

  function meterDemos() {
    app.setAccounts([
      { id: "demo-invitado01", username: "invitado01", password: "invitado01", type: "demo", created: Date.now(), expiresAt: Date.now() + 72 * 3600000, firebase: false },
      { id: "demo-invitadoclara", username: "invitado clara", password: "invitado clara", type: "demo", created: Date.now(), expiresAt: Date.now() + 72 * 3600000, firebase: false },
      { id: "acc-real", username: "cliente@obra.com", type: "pro", active: true, updatedAt: Date.now() },
    ]);
  }

  beforeEach(() => {
    localStorage.removeItem("pte_demos_borradas");
    window.confirm = () => true;
    window.toast = () => {};
    window._currentUser = { isMaster: true };
    meterDemos();
  });

  afterEach(() => {
    delete window.confirm;
    delete window.toast;
    delete window._currentUser;
    delete window._FIRESTORE;
    delete window._AUTH;
    localStorage.removeItem("pte_demos_borradas");
    localStorage.removeItem("pte_accounts");
  });

  it("seedDemoAccounts la vuelve a crear si el dueño NO la borró", () => {
    app.setAccounts(app.getAccounts().filter((a) => a.id !== "demo-invitadoclara"));
    app.seedDemoAccounts();
    expect(app.getAccounts().some((a) => a.id === "demo-invitadoclara")).toBe(true);
  });

  it("tras borrarla, seedDemoAccounts NO la re-crea", () => {
    app.removeAccountLocal("demo-invitadoclara");
    app._marcarDemoBorrada("invitado clara");
    app.seedDemoAccounts();
    expect(app.getAccounts().some((a) => a.id === "demo-invitadoclara")).toBe(false);
    // La otra demo (no borrada) sigue intacta: el veto es por cuenta
    expect(app.getAccounts().some((a) => a.id === "demo-invitado01")).toBe(true);
  });

  it("el veto sobrevive a un reload (queda en localStorage)", () => {
    app.removeAccountLocal("demo-invitadoclara");
    app._marcarDemoBorrada("invitado clara");
    // Simula la recarga: la lista se pierde pero el veto persiste en el equipo
    expect(localStorage.getItem("pte_demos_borradas")).toContain(SLUG_CLARA);
    app.seedDemoAccounts();
    expect(app.getAccounts().some((a) => a.id === "demo-invitadoclara")).toBe(false);
  });

  it("adminDeleteAccount de una demo la marca y ya no vuelve", async () => {
    await app.adminDeleteAccount("demo-invitadoclara");
    expect(app.getAccounts().some((a) => a.id === "demo-invitadoclara")).toBe(false);
    expect(app._demoBorrada(SLUG_CLARA)).toBe(true);
    // Lo que pasa en cada render del panel:
    app.seedDemoAccounts();
    expect(app.getAccounts().some((a) => a.id === "demo-invitadoclara")).toBe(false);
    // Y el pull de la nube tampoco la trae de vuelta
    const trayadas = app._mergeRemoteAccounts(
      [{ id: "demo-invitadoclara", username: "invitado clara", type: "demo", expiresAt: Date.now() + 72 * 3600000 }],
      app.getAccounts(),
      Date.now(),
    );
    expect(trayadas.some((a) => a.id === "demo-invitadoclara")).toBe(false);
  });

  it("borrar una demo de cliente (no base) no toca las bases", () => {
    app.setAccounts(app.getAccounts().concat([
      { id: "acc-demo-cliente", username: "otra@obra.com", type: "demo", created: Date.now(), expiresAt: Date.now() + 72 * 3600000, firebase: false },
    ]));
    app.removeAccountLocal("acc-demo-cliente");
    app.seedDemoAccounts();
    expect(app.getAccounts().some((a) => a.id === "acc-demo-cliente")).toBe(false);
    expect(app.getAccounts().some((a) => a.id === "demo-invitado01")).toBe(true);
  });
});
