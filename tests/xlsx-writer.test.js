import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../xlsx-writer.js"), "utf8");
(0, eval)(src);
const X = globalThis.XLSXWriter;

function buildWorkbook() {
  const wb = X.createWorkbook();
  const ws = wb.addSheet("Presupuesto", { cols: [160, 280, 50] });
  ws.row([{ v: "PRESUPUESTO DE OBRA", s: "title" }, { v: "Adenda", s: "titleVal" }]);
  ws.row([{ v: "Proyecto", s: "lbl" }, { v: "Obra & <Prueba>", s: "val" }]);
  ws.row([{ v: "Hormigón H-21", s: "dBold" }, { v: 12.5, s: "numC" }, { v: "m3", s: "dc" }]);

  const ws2 = wb.addSheet("Computo Materiales", { cols: [250, 100] });
  ws2.row([{ v: "MATERIAL", s: "hdr" }, { v: "CANTIDAD", s: "hdrR" }]);
  ws2.row([{ v: "Cemento", s: "d" }, { v: 125, s: "num" }]);
  return wb;
}

describe("xlsx-writer", () => {
  it("genera un zip válido con las partes OOXML", () => {
    const buf = new Uint8Array(buildWorkbook().toArrayBuffer());
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf[2]).toBe(0x03); // local file header
    const text = Buffer.from(buf).toString("latin1");
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("xl/styles.xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("xl/worksheets/sheet2.xml");
  });

  it("escribe celdas de texto y números correctamente", () => {
    const buf = new Uint8Array(buildWorkbook().toArrayBuffer());
    const text = Buffer.from(buf).toString("utf8");
    expect(text).toContain("Hormigón H-21");
    expect(text).toContain("Obra &amp; &lt;Prueba&gt;");
    expect(text).toContain("<v>12.5</v>");
    expect(text).toContain('t="inlineStr"');
  });

  it("produce un Blob de tipo xlsx", () => {
    const blob = buildWorkbook().toBlob();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(1000);
  });
});