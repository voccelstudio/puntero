var _otCache = null;

function buildOTData() {
    if (_otCache) return _otCache;
    const adenda = getActiveAdenda();
    if (!adenda) return null;
    const grouped = {};
    for (const i of adenda.items) {
        (grouped[i.cat] || (grouped[i.cat] = [])).push(i);
    }
    _otCache = {
        date: formatDatePY(new Date()),
        number: String(Date.now()).slice(-6),
        budget: adenda.name,
        total: adenda.items.length,
        groups: grouped
    };
    return _otCache;
}

function renderOT() {
    const el = document.getElementById("section-ot");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
    const adenda = getActiveAdenda();
    if (!adenda || adenda.items.length === 0) {
        el.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><div>No hay rubros en el presupuesto. Primero creá un presupuesto.</div><button class="btn primary" onclick="setSection(\'budget\')" style="margin-top:12px">Ir al Presupuesto</button></div>';
        return;
    }

    _otCache = null;
    const ot = buildOTData();
    el.innerHTML = `
    <div class="prices-wrap">
        <div class="ot-head">
            <div>
                <h2 class="sec-lbl" style="margin:0">ORDEN DE TRABAJO N° ${ot.number}</h2>
                <p class="ot-proj">Proyecto: <strong>${escapeHtml(p.name)}</strong> | Cliente: ${escapeHtml(p.client || '—')}</p>
            </div>
            <div class="ot-acts">
                <button class="btn sm" onclick="setSection('budget')">← Volver al Presupuesto</button>
                <button class="btn sm primary" onclick="printOT()">🖨️ Imprimir / PDF</button>
            </div>
        </div>

        <div class="card ot-card">
            <div class="ot-meta">
                <div><strong>OT N°:</strong> ${ot.number}</div>
                <div><strong>Fecha:</strong> ${ot.date}</div>
                <div><strong>Presupuesto:</strong> ${escapeHtml(ot.budget)}</div>
                <div><strong>Rubros:</strong> ${ot.total}</div>
            </div>

            <table class="tbl ot-tbl" id="ot-table">
                <thead><tr><th style="width:50px">N°</th><th>Rubro / Subrubro</th></tr></thead>
                <tbody id="ot-body"></tbody>
            </table>

            <div class="ot-sign">
                <div class="ot-sign-box"><div class="ot-sign-line"></div><strong>Encargado</strong></div>
                <div class="ot-sign-box"><div class="ot-sign-line"></div><strong>Contratista</strong></div>
                <div class="ot-sign-box"><div class="ot-sign-line"></div><strong>Supervisor</strong></div>
            </div>
        </div>
    </div>`;

    renderOTBody();
}

function renderOTBody() {
    const tbody = document.getElementById("ot-body");
    if (!tbody) return;
    const ot = buildOTData();
    if (!ot) { tbody.innerHTML = '<tr><td colspan="2" class="empty">Sin rubros</td></tr>'; return; }

    let itemCounter = 0;
    const fragments = [];
    for (const [cat, items] of Object.entries(ot.groups)) {
        fragments.push('<tr class="tbl-cat cat-row"><td colspan="2"><strong>', escapeHtml(cat), '</strong></td></tr>');
        for (const item of items) {
            itemCounter++;
            const mats = item.mats || [];
            const rs = mats.length > 0 ? mats.length + 1 : 1;
            fragments.push('<tr class="ot-item-row"><td class="ot-num" rowspan="', rs, '">', itemCounter, '</td><td class="ot-name">', escapeHtml(item.name), '</td></tr>');
            for (let si = 0; si < mats.length; si++) {
                fragments.push('<tr class="ot-sub-row"><td class="ot-sub-num">', itemCounter, '.', si + 1, '</td><td class="ot-sub-name">', escapeHtml(mats[si].n || ''), '</td></tr>');
            }
        }
    }
    tbody.innerHTML = fragments.join('');
}

function printOT() {
    const el = document.getElementById("section-ot");
    if (!el) return toast("No hay contenido para imprimir", false);

    const ot = buildOTData();
    if (!ot) return toast("No hay orden de trabajo generada", false);

    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda) return toast("Sin proyecto activo", false);

    const rows = renderOTPrintRows(ot);

    const win = window.open("", "_blank");
    if (!win) { toast("Permití ventanas emergentes para imprimir", false); return; }

    win.document.write('<!DOCTYPE html><html><head><title>OT N° ' + ot.number + '</title>');
    win.document.write('<style>');
    win.document.write('@page{size:A4;margin:15mm}');
    win.document.write('*{box-sizing:border-box}');
    win.document.write('body{font-family:"Barlow","Segoe UI",sans-serif;color:#1e293b;padding:0;margin:0;background:#fff}');
    win.document.write('.ot-print{max-width:1000px;margin:0 auto;padding:20px}');
    win.document.write('.ot-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:3px solid #1e293b;padding-bottom:12px}');
    win.document.write('.ot-hdr h1{font-size:1.5rem;font-weight:800;text-transform:uppercase;margin:0;letter-spacing:.03em}');
    win.document.write('.ot-hdr .ot-num{font-size:1.1rem;font-weight:700;color:#475569}');
    win.document.write('.ot-info{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;margin-bottom:20px;font-size:.9rem;color:#475569;padding:12px 16px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}');
    win.document.write('table{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:30px}');
    win.document.write('th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left}');
    win.document.write('th{background:#f1f5f9;font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}');
    win.document.write('.cat-row td{background:#e2e8f0;font-weight:800;text-transform:uppercase;font-size:.8rem;padding:6px 10px}');
    win.document.write('.ot-item-row td{font-weight:600}');
    win.document.write('.ot-sub-row td{padding-left:28px!important;color:#475569}');
    win.document.write('.ot-num{text-align:center;font-weight:700;width:50px;vertical-align:middle}');
    win.document.write('.ot-sub-num{text-align:center;font-weight:600;color:#64748b;width:50px}');
    win.document.write('.ot-sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:40px;padding-top:24px;border-top:2px dashed #94a3b8}');
    win.document.write('.ot-sign-box{text-align:center}');
    win.document.write('.ot-sign-line{margin-bottom:48px;border-bottom:1px solid #1e293b}');
    win.document.write('.ot-sign-box strong{font-size:.85rem;text-transform:uppercase;letter-spacing:.04em}');
    win.document.write('.ot-foot{text-align:center;margin-top:30px;font-size:.75rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}');
    win.document.write('@media print{body{padding:0}.ot-print{padding:0}}');
    win.document.write('</style></head><body>');
    win.document.write('<div class="ot-print">');
    win.document.write('<div class="ot-hdr"><h1>Orden de Trabajo</h1><span class="ot-num">N° ' + ot.number + '</span></div>');
    win.document.write('<div class="ot-info"><div><strong>Proyecto:</strong> ' + escapeHtml(p.name) + '</div><div><strong>Cliente:</strong> ' + escapeHtml(p.client || '—') + '</div><div><strong>Presupuesto:</strong> ' + escapeHtml(ot.budget) + '</div><div><strong>Fecha Emisión:</strong> ' + ot.date + '</div></div>');
    win.document.write('<table><thead><tr><th style="width:50px">N°</th><th>Rubro / Subrubro</th></tr></thead><tbody>' + rows + '</tbody></table>');
    win.document.write('<div class="ot-sign"><div class="ot-sign-box"><div class="ot-sign-line"></div><strong>Encargado</strong></div><div class="ot-sign-box"><div class="ot-sign-line"></div><strong>Contratista</strong></div><div class="ot-sign-box"><div class="ot-sign-line"></div><strong>Supervisor</strong></div></div>');
    win.document.write('<div class="ot-foot">Documento generado por Puntero — ' + ot.date + '</div>');
    win.document.write('</div>');
    win.document.write('<script>window.onload=function(){setTimeout(function(){window.print();window.close()},300)}<\/script>');
    win.document.write('</body></html>');
    win.document.close();
}

function renderOTPrintRows(ot) {
    let itemCounter = 0;
    const frag = [];
    for (const [cat, items] of Object.entries(ot.groups)) {
        frag.push('<tr class="cat-row"><td colspan="2">', escapeHtml(cat), '</td></tr>');
        for (const item of items) {
            itemCounter++;
            const mats = item.mats || [];
            const rs = mats.length > 0 ? mats.length + 1 : 1;
            frag.push('<tr class="ot-item-row"><td class="ot-num" rowspan="', rs, '">', itemCounter, '</td><td>', escapeHtml(item.name), '</td></tr>');
            for (let si = 0; si < mats.length; si++) {
                frag.push('<tr class="ot-sub-row"><td class="ot-sub-num">', itemCounter, '.', si + 1, '</td><td>', escapeHtml(mats[si].n || ''), '</td></tr>');
            }
        }
    }
    return frag.join('');
}
