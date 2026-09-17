/**
 * xlsx-writer.js — Generador de archivos .xlsx (Open XML) sin dependencias.
 * Produce un ZIP válido (método "store"), compatible con Excel, LibreOffice
 * y Google Sheets. Mantiene estilos: tipografía, colores, bordes y formatos
 * de números.
 *
 * Uso:
 *   const wb = XLSXWriter.createWorkbook();
 *   const ws = wb.addSheet('Presupuesto', { cols: [160, 280, 50] });
 *   ws.row([{ v: 'TÍTULO', s: 'title' }, { v: 1234, s: 'num' }], { h: 28 });
 *   ...
 *   const blob = wb.toBlob(); // → descargar como .xlsx
 */
(function (global) {
  'use strict';

  if (global.XLSXWriter) return;

  // ── Utilidades de escape ──────────────────────────────────────────────
  function escXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function colLetter(n) {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // ── CRC32 ─────────────────────────────────────────────────────────────
  const crcTable = (function () {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ── ZIP (solo store, sin compresión) ──────────────────────────────────
  function zipStore(files) {
    const enc = new TextEncoder();
    const DOS_TIME = 0;
    const DOS_DATE = 0x4A21; // 2018-01-01
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach(function (f) {
      const nameBytes = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);

      const lh = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 flags
      lv.setUint16(8, 0, true);
      lv.setUint16(10, DOS_TIME, true);
      lv.setUint16(12, DOS_DATE, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);
      localParts.push(lh, data);

      const ch = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, DOS_TIME, true);
      cv.setUint16(14, DOS_DATE, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);
      centralParts.push(ch);

      offset += lh.length + data.length;
    });

    const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const all = localParts.concat(centralParts, [eocd]);
    const total = all.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    all.forEach(p => { out.set(p, pos); pos += p.length; });
    return out;
  }

  // ── Paleta de estilos (mapeada a styles.xml) ──────────────────────────
  const FONTS = [
    '<font><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>',                       // 0 default
    '<font><sz val="14"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',                  // 1 title
    '<font><sz val="12"/><b/><color rgb="FFF59E0B"/><name val="Calibri"/></font>',                  // 2 titleVal
    '<font><sz val="10"/><b/><color rgb="FF475569"/><name val="Calibri"/></font>',                  // 3 lbl
    '<font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>',                      // 4 val
    '<font><sz val="9"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',                   // 5 hdr
    '<font><sz val="10"/><b/><color rgb="FF0F172A"/><name val="Calibri"/></font>',                  // 6 bold dark
    '<font><sz val="10"/><color rgb="FF334155"/><name val="Calibri"/></font>',                      // 7 d
    '<font><sz val="9"/><i/><color rgb="FF94A3B8"/><name val="Calibri"/></font>',                   // 8 dNote
    '<font><sz val="10"/><color rgb="FF059669"/><name val="Calibri"/></font>',                      // 9 numIva
    '<font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',                  // 10 total
    '<font><sz val="10"/><b/><color rgb="FF334155"/><name val="Calibri"/></font>'                   // 11 sumLbl
  ];

  const FILLS = [
    '<fill><patternFill patternType="none"/></fill>',                                                // 0
    '<fill><patternFill patternType="gray125"/></fill>',                                            // 1
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>', // 2
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>', // 3
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>', // 4
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>', // 5
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>', // 6
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/><bgColor indexed="64"/></patternFill></fill>', // 7
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD97706"/><bgColor indexed="64"/></patternFill></fill>'  // 8
  ];

  const noBorder = '<left/><right/><top/><bottom/><diagonal/>';
  function borderXml(color, style) {
    const s = ` style="${style}"`;
    const c = `<color rgb="${color}"/>`;
    return `<left${s}>${c}</left><right${s}>${c}</right><top${s}>${c}</top><bottom${s}>${c}</bottom><diagonal/>`;
  }
  const BORDERS = [
    `<border>${noBorder}</border>`,                                              // 0
    `<border>${borderXml('FFCBD5E1', 'thin')}</border>`,                         // 1 all thin
    `<border>${borderXml('FF1E293B', 'medium')}</border>`,                       // 2 thick
    `<border>${borderXml('FFD97706', 'medium')}</border>`                        // 3 accent
  ];

  const NUMFMT = '<numFmt numFmtId="3" formatCode="#,##0"/>';

  // (name, fontId, fillId, borderId, numFmt, align)
  const CELLXFS = [
    ['default', 0, 0, 0, null, null],
    ['title', 1, 2, 2, null, 'vc'],
    ['titleVal', 2, 2, 2, null, 'vc'],
    ['lbl', 3, 3, 1, null, 'vc'],
    ['val', 4, 3, 1, null, 'vc'],
    ['hdr', 5, 4, 2, null, 'lcw'],
    ['hdrC', 5, 4, 2, null, 'ccw'],
    ['hdrR', 5, 4, 2, null, 'rcw'],
    ['catRow', 6, 5, 1, null, 'vc'],
    ['d', 7, 0, 1, null, 'vc'],
    ['dBold', 6, 0, 1, null, 'vc'],
    ['dc', 7, 0, 1, null, 'c'],
    ['dNote', 8, 0, 1, null, 'vc'],
    ['num', 7, 0, 1, true, 'rc'],
    ['numC', 7, 0, 1, true, 'cc'],
    ['numIva', 9, 0, 1, true, 'rc'],
    ['numTotal', 6, 0, 1, true, 'rc'],
    ['sumLbl', 11, 6, 1, null, 'vc'],
    ['sumNum', 6, 6, 1, true, 'rc'],
    ['ivaLbl', 9, 7, 1, null, 'vc'],
    ['totalLbl', 10, 8, 3, null, 'vc'],
    ['totalNum', 10, 8, 3, true, 'rc']
  ];

  const STYLE_INDEX = {};
  CELLXFS.forEach((s, i) => { STYLE_INDEX[s[0]] = i; });

  function alignmentXml(a) {
    // a: combos de h/v/wrap. 'c'=center v=vertical-center w=wrap
    const horiz = a.indexOf('l') !== -1 ? 'Left' : a.indexOf('r') !== -1 ? 'Right' : a.indexOf('c') !== -1 ? 'Center' : 'General';
    const vert = a.indexOf('v') !== -1 ? 'Center' : 'Bottom';
    const wrap = a.indexOf('w') !== -1;
    const attrs = `horizontal="${horiz}" vertical="${vert}"${wrap ? ' wrapText="1"' : ''}`;
    return `<alignment ${attrs}/>`;
  }

  function stylesXml() {
    let xfs = '';
    CELLXFS.forEach(c => {
      const [, f, fi, bi, num, align] = c;
      const p = [];
      p.push(`numFmtId="${num ? 3 : 0}"`);
      p.push(`fontId="${f}"`);
      p.push(`fillId="${fi}"`);
      p.push(`borderId="${bi}"`);
      p.push(`xfId="0"`);
      if (num) p.push(`applyNumberFormat="1"`);
      p.push('applyFont="1"');
      if (fi) p.push('applyFill="1"');
      if (bi) p.push('applyBorder="1"');
      if (align) p.push(`applyAlignment="1"`);
      xfs += `<xf ${p.join(' ')}>${align ? alignmentXml(align) : ''}</xf>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${FONTS.length}">${FONTS.join('')}</fonts>
<fills count="${FILLS.length}">${FILLS.join('')}</fills>
<borders count="${BORDERS.length}">${BORDERS.join('')}</borders>
${NUMFMT}
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${CELLXFS.length}">${xfs}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  // ── Hoja de cálculo ───────────────────────────────────────────────────
  function makeSheet(name, opts) {
    return {
      name: name,
      cols: (opts && opts.cols) || [],
      rows: []
    };
  }

  function addRow(sheet, cells, opts) {
    sheet.rows.push({
      cells: (cells || []).map(c => {
        if (typeof c === 'number' || typeof c === 'string') return { v: c };
        return { v: c && c.v !== undefined ? c.v : null, s: c && c.s != null ? STYLE_INDEX[c.s] : null };
      }),
      ht: opts && opts.h
    });
    return sheet;
  }

  function sheetXml(sheet) {
    let cols = '';
    if (sheet.cols.length) {
      cols = '<cols>' + sheet.cols.map((w, i) => {
        const chars = Math.round((w / 7) * 10) / 10;
        return `<col min="${i + 1}" max="${i + 1}" width="${chars}" customWidth="1"/>`;
      }).join('') + '</cols>';
    }

    const rowsXml = sheet.rows.map((row, ri) => {
      const r = ri + 1;
      const ht = row.ht ? ` ht="${row.ht}" customHeight="1"` : '';
      let cells = '';
      row.cells.forEach((c, ci) => {
        const ref = colLetter(ci + 1) + r;
        const s = c.s != null ? ` s="${c.s}"` : '';
        if (c.v == null) {
          cells += `<c r="${ref}"${s}/>`;
        } else if (typeof c.v === 'number' && isFinite(c.v)) {
          cells += `<c r="${ref}"${s}><v>${c.v}</v></c>`;
        } else {
          cells += `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(c.v)}</t></is></c>`;
        }
      });
      return `<row r="${r}"${ht}>${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols}
<sheetData>${rowsXml}</sheetData>
<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
  }

  // ── Empaquetado del workbook ──────────────────────────────────────────
  function buildFiles(wb) {
    const enc = new TextEncoder();
    const files = [];

    const n = wb.sheets.length;
    let overrides = '';
    let sheetEls = '';
    let rels = '';
    for (let i = 0; i < n; i++) {
      const num = i + 1;
      overrides += `<Override PartName="/xl/worksheets/sheet${num}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
      sheetEls += `<sheet name="${escXml(wb.sheets[i].name)}" sheetId="${num}" r:id="rId${num}"/>`;
      rels += `<Relationship Id="rId${num}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${num}.xml"/>`;
    }
    const relStylesId = n + 1;
    rels += `<Relationship Id="rId${relStylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;

    files.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${overrides}
</Types>`]);

    files.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`]);

    files.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetEls}</sheets>
</workbook>`]);

    files.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`]);

    files.push(['xl/styles.xml', stylesXml()]);

    wb.sheets.forEach((s, i) => {
      files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]);
    });

    return files.map(f => ({ name: f[0], data: enc.encode(f[1]) }));
  }

  // ── API pública ───────────────────────────────────────────────────────
  const XLSXWriter = {
    createWorkbook() {
      return {
        sheets: [],
        addSheet(name, opts) {
          const s = makeSheet(name, opts);
          this.sheets.push(s);
          return {
            row: (cells, ro) => addRow(s, cells, ro)
          };
        },
        toBlob() {
          const files = buildFiles(this);
          const bytes = zipStore(files);
          return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        },
        toArrayBuffer() {
          const files = buildFiles(this);
          const bytes = zipStore(files);
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
      };
    }
  };

  global.XLSXWriter = XLSXWriter;
})(typeof window !== 'undefined' ? window : globalThis);