import { describe, it, expect, beforeEach } from "vitest";

// Re-implement the pure functions here to test them in isolation

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "0";
  var val = n;
  var symbol = "";
  var dec = 0;
  if (globalThis.state.currency === "USD") {
    val = n / (globalThis.state.exchangeRate || 7500);
    dec = 2;
    symbol = "U$S ";
  }
  return symbol + new Intl.NumberFormat("es-PY", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatDatePY(input) {
  if (!input) return "";
  var d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "number") {
    d = new Date(input);
  } else if (typeof input === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return input;
    var pyLegacyMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (pyLegacyMatch) {
      var day = pyLegacyMatch[1], month = pyLegacyMatch[2], year = pyLegacyMatch[3];
      return day.padStart(2, "0") + "/" + month.padStart(2, "0") + "/" + year;
    }
    var isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return isoMatch[3] + "/" + isoMatch[2] + "/" + isoMatch[1];
    }
    d = new Date(input);
  }
  if (!d || isNaN(d.getTime())) return "";
  var day = String(d.getDate()).padStart(2, "0");
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var year = d.getFullYear();
  return day + "/" + month + "/" + year;
}

function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    var pyMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (pyMatch) {
      return new Date(parseInt(pyMatch[3]), parseInt(pyMatch[2]) - 1, parseInt(pyMatch[1]));
    }
    var isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
  }
  var d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  var map = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };
  return str.replace(/[&"'<>]/g, function (m) { return map[m]; });
}

function calcIVA(matCost, laborCost, qty) {
  var IVA_MAT = 0.05;
  var IVA_LAB = 0.1;
  var ivaMat = Math.round((matCost || 0) * qty * IVA_MAT);
  var ivaLab = Math.round((laborCost || 0) * qty * IVA_LAB);
  return { ivaMat: ivaMat, ivaLab: ivaLab, ivaTotal: ivaMat + ivaLab };
}

// ── TESTS ──────────────────────────────────────────────────────────────

describe("fmt()", function () {
  it("formats PYG by default", function () {
    globalThis.state.currency = "PYG";
    expect(fmt(1000000)).toBe("1.000.000");
  });

  it("formats USD with 2 decimals", function () {
    globalThis.state.currency = "USD";
    globalThis.state.exchangeRate = 7500;
    expect(fmt(7500)).toBe("U$S 1,00");
  });

  it("returns 0 for null/undefined/NaN", function () {
    expect(fmt(null)).toBe("0");
    expect(fmt(undefined)).toBe("0");
    expect(fmt(NaN)).toBe("0");
  });
});

describe("formatDatePY()", function () {
  it("formats ISO to dd/mm/yyyy", function () {
    expect(formatDatePY("2026-06-13")).toBe("13/06/2026");
  });

  it("passes through dd/mm/yyyy", function () {
    expect(formatDatePY("13/06/2026")).toBe("13/06/2026");
  });

  it("normalizes d/m/yyyy legacy format", function () {
    expect(formatDatePY("1/6/2026")).toBe("01/06/2026");
  });

  it("returns empty for falsy input", function () {
    expect(formatDatePY("")).toBe("");
    expect(formatDatePY(null)).toBe("");
  });
});

describe("parseDate()", function () {
  it("parses dd/mm/yyyy", function () {
    var d = parseDate("13/06/2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(13);
  });

  it("parses ISO yyyy-mm-dd", function () {
    var d = parseDate("2026-06-13");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(13);
  });

  it("returns null for invalid input", function () {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe("escapeHtml()", function () {
  it("escapes & < > \" '", function () {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("returns empty string for non-strings", function () {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("calcIVA()", function () {
  it("calculates IVA for material and labor", function () {
    var result = calcIVA(100000, 50000, 10);
    expect(result.ivaMat).toBe(50000);
    expect(result.ivaLab).toBe(50000);
    expect(result.ivaTotal).toBe(100000);
  });

  it("handles zero costs", function () {
    var result = calcIVA(0, 0, 0);
    expect(result.ivaTotal).toBe(0);
  });
});

describe("todayISO()", function () {
  it("returns today in yyyy-mm-dd format", function () {
    var today = new Date();
    var expected = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    expect(todayISO()).toBe(expected);
  });
});
