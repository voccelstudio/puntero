function renderOT() {
    const el = document.getElementById("section-ot");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
    const adenda = getActiveAdenda();
    if (!adenda || adenda.items.length === 0) {
        el.innerHTML = `<div class="empty"><div class="empty-ico">📋</div><div>No hay rubros en el presupuesto. Primero creá un presupuesto.</div><button class="btn primary" onclick="setSection('budget')" style="margin-top:12px">Ir al Presupuesto</button></div>`;
        return;
    }

    const grouped = {};
    for (const i of adenda.items) {
        if (!grouped[i.cat]) grouped[i.cat] = [];
        grouped[i.cat].push(i);
    }

    const otNum = String(Date.now()).slice(-6);
    let itemCounter = 0;
    let rows = "";
    for (const [cat, items] of Object.entries(grouped)) {
        rows += `<tr class="tbl-cat cat-row"><td colspan="2"><strong>${cat}</strong></td></tr>`;
        for (const item of items) {
            itemCounter++;
            const hasMats = item.mats && item.mats.length > 0;
            const rowspan = hasMats ? item.mats.length + 1 : 1;
            rows += `<tr class="ot-item-row">
                <td class="ot-num" rowspan="${rowspan}">${itemCounter}</td>
                <td class="ot-name">${item.name}</td>
            </tr>`;
            if (hasMats) {
                let subCounter = 0;
                for (const mat of item.mats) {
                    subCounter++;
                    rows += `<tr class="ot-sub-row">
                        <td class="ot-sub-num">${itemCounter}.${subCounter}</td>
                        <td class="ot-sub-name">${mat.n}</td>
                    </tr>`;
                }
            }
        }
    }

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px">
            <div>
                <h2 class="sec-lbl" style="margin:0">ORDEN DE TRABAJO N° ${otNum}</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Proyecto: <strong>${p.name}</strong> | Cliente: ${p.client || '—'}</p>
            </div>
            <div style="display:flex; gap:8px">
                <button class="btn sm" onclick="setSection('budget')">← Volver al Presupuesto</button>
                <button class="btn sm primary" onclick="printOT()">🖨️ Imprimir / PDF</button>
            </div>
        </div>

        <div class="card" style="padding:20px">
            <div class="grid2" style="margin-bottom:20px; font-size:0.9rem; color:var(--tx3)">
                <div><strong>OT N°:</strong> ${otNum}</div>
                <div><strong>Fecha:</strong> ${formatDatePY(new Date())}</div>
                <div><strong>Presupuesto:</strong> ${adenda.name}</div>
                <div><strong>Rubros:</strong> ${adenda.items.length}</div>
            </div>

            <table class="tbl ot-tbl">
                <thead>
                    <tr><th style="width:50px">N°</th><th>Rubro / Subrubro</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="2" class="empty">Sin rubros</td></tr>'}</tbody>
            </table>

            <div style="margin-top:30px; padding-top:20px; border-top:2px dashed var(--bor); display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; font-size:0.85rem; color:var(--tx3)">
                <div style="text-align:center">
                    <div style="margin-bottom:40px">________________________</div>
                    <div><strong>Encargado</strong></div>
                </div>
                <div style="text-align:center">
                    <div style="margin-bottom:40px">________________________</div>
                    <div><strong>Contratista</strong></div>
                </div>
                <div style="text-align:center">
                    <div style="margin-bottom:40px">________________________</div>
                    <div><strong>Supervisor</strong></div>
                </div>
            </div>
        </div>
    </div>`;
}

function printOT() {
    const content = document.getElementById("section-ot")?.querySelector(".card");
    if (!content) return toast("No hay contenido para imprimir", false);
    const win = window.open("", "_blank");
    if (!win) { toast("Permití ventanas emergentes para imprimir", false); return; }
    const styles = document.querySelector("link[href='styles.css']")?.outerHTML || "";
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Orden de Trabajo</title>${styles}
        <style>
            body { background: #fff; color: #1e293b; padding: 40px; font-family: 'Barlow', sans-serif; }
            .card { max-width: 900px; margin: 0 auto; }
            .tbl { width:100%; border-collapse: collapse; }
            .tbl th, .tbl td { border:1px solid #cbd5e1; padding:8px 10px; text-align:left; }
            .tbl th { background:#f1f5f9; font-weight:700; }
            .cat-row td { background:#e2e8f0; font-weight:800; text-transform:uppercase; font-size:0.85rem; }
            .ot-item-row td { font-weight:600; }
            .ot-sub-row td { padding-left:30px !important; color:#475569; }
            .ot-num { text-align:center; font-weight:700; width:50px; }
            .ot-sub-num { text-align:center; font-weight:600; color:#64748b; width:50px; }
            .sec-lbl { font-size:1.4rem; font-weight:800; text-transform:uppercase; }
            .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            @media print { body { padding:20px; } }
        </style>
        </head>
        <body>
            ${content.outerHTML}
            <script>window.onload = function() { window.print(); window.close(); } <\/script>
        </body>
        </html>
    `);
    win.document.close();
}
