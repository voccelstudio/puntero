import { describe, it, expect, beforeEach } from "vitest";
import { loadApp } from "./helpers/app-loader.js";

// Tests de helpers sobre el CÓDIGO REAL (app.js), no sobre copias.
// Antes este archivo re-implementaba las funciones a mano; eso causó que un
// calcIVA con las tasas de IVA al revés pasara sin alertar. Ahora se carga el
// fuente real vía app-loader.js.
//
// Nota: calcIVA ya se cubre en business.test.js (depende de getActiveAdenda).

const app = loadApp();

beforeEach(() => {
  app.resetState();
});

describe("fmt()", () => {
  it("formatea PYG sin decimales", () => {
    app.state.currency = "PYG";
    expect(app.fmt(1000000)).toBe("1.000.000");
  });

  it("formatea USD con 2 decimales usando exchangeRate", () => {
    app.state.currency = "USD";
    app.state.exchangeRate = 7500;
    expect(app.fmt(7500)).toBe("U$S 1,00");
  });

  it("devuelve 0 para null/undefined/NaN", () => {
    expect(app.fmt(null)).toBe("0");
    expect(app.fmt(undefined)).toBe("0");
    expect(app.fmt(NaN)).toBe("0");
  });
});

describe("formatDatePY()", () => {
  it("convierte ISO yyyy-mm-dd a dd/mm/yyyy", () => {
    expect(app.formatDatePY("2026-06-13")).toBe("13/06/2026");
  });

  it("deja pasar dd/mm/yyyy tal cual", () => {
    expect(app.formatDatePY("13/06/2026")).toBe("13/06/2026");
  });

  it("normaliza el formato legacy d/m/yyyy", () => {
    expect(app.formatDatePY("1/6/2026")).toBe("01/06/2026");
  });

  it("devuelve vacío para entrada falsy", () => {
    expect(app.formatDatePY("")).toBe("");
    expect(app.formatDatePY(null)).toBe("");
  });
});

describe("parseDate()", () => {
  it("parsea dd/mm/yyyy", () => {
    const d = app.parseDate("13/06/2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // junio = 5
    expect(d.getDate()).toBe(13);
  });

  it("parsea ISO yyyy-mm-dd", () => {
    const d = app.parseDate("2026-06-13");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(13);
  });

  it("devuelve null para entrada inválida", () => {
    expect(app.parseDate("")).toBeNull();
    expect(app.parseDate(null)).toBeNull();
  });
});

describe("escapeHtml()", () => {
  it("escapa & < > \" '", () => {
    expect(app.escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("devuelve vacío para no-strings", () => {
    expect(app.escapeHtml(null)).toBe("");
    expect(app.escapeHtml(undefined)).toBe("");
  });
});

describe("todayISO()", () => {
  it("devuelve hoy en formato yyyy-mm-dd", () => {
    const today = new Date();
    const expected =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    expect(app.todayISO()).toBe(expected);
  });
});
