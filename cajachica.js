/**
 * cajachica.js — Caja Chica: planilla numerada de compras + pagos + exportación PDF
 * Datos guardados en p.execution.finances.pettyCash:
 *   { fundAmount, planilla: [{ id, fecha, descripcion, cantidad, unidad, precio, factura }], pagos: [{ id, fecha, concepto, metodo, monto }] }
 */

var CC_UNITS = ["u", "pza", "kg", "m", "m2", "m3", "l", "gl", "bolsa", "docena", "par", "set", "otros"];
var CC_PAY_METHODS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"];

function ccGetPettyCash() {
    var p = getActiveProject();
    if (!p.execution) p.execution = {};
    if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
    if (!p.execution.finances.pettyCash) p.execution.finances.pettyCash = { fundAmount: 0, transactions: [], planilla: [], pagos: [] };
    var pc = p.execution.finances.pettyCash;
    if (!Array.isArray(pc.planilla)) pc.planilla = [];
    if (!Array.isArray(pc.pagos)) pc.pagos = [];
    if (Array.isArray(pc.transactions) && pc.transactions.length > 0 && pc.planilla.length === 0) {
        pc.planilla = pc.transactions.map(function(t) {
            return {
                id: t.id || Date.now(),
                fecha: t.date || todayISO(),
                descripcion: t.description || t.concept || "",
                cantidad: 1,
                unidad: "u",
                precio: t.amount || 0,
                factura: t.invoiceNum || ""
            };
        });
        pc.transactions = [];
        save();
    }
    return pc;
}

function ccSortByDateAsc(list) {
    return (list || []).slice().sort(function(a, b) { return (parseDate(a.fecha) || 0) - (parseDate(b.fecha) || 0); });
}

function renderCajaChica() {
    var el = document.getElementById("section-cajachica");
    if (!el) return;
    var p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver su caja chica.</div>"; return; }
    var pc = ccGetPettyCash();
    var planilla = ccSortByDateAsc(pc.planilla);
    var pagos = ccSortByDateAsc(pc.pagos);

    var totalCompras = planilla.reduce(function(s, it) { return s + (it.cantidad || 1) * (it.precio || 0); }, 0);
    var totalPagos = pagos.reduce(function(s, pg) { return s + (pg.monto || 0); }, 0);
    var disponible = (pc.fundAmount || 0) - totalPagos;

    var h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">CAJA CHICA</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Planilla de compras y pagos · <strong>${escapeHtml(p.name)}</strong></p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
                <button class="btn sm" onclick="ccShowFundModal()">💵 Fondo</button>
                <button class="btn sm" onclick="ccShowCompraModal()">+ Compra</button>
                <button class="btn sm primary" onclick="ccShowPagoModal()">💰 Cargar Pago</button>
                <button class="btn sm" onclick="exportCajaChicaPDF()">📄 PDF</button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-bottom:18px">
            <div class="dash-card" style="padding:12px"><div class="dash-num">${fmt(pc.fundAmount)}</div><div class="dash-lbl">Fondo Asignado</div></div>
            <div class="dash-card" style="padding:12px"><div class="dash-num" style="color:var(--err)">${fmt(totalCompras)}</div><div class="dash-lbl">Total Compras</div></div>
            <div class="dash-card" style="padding:12px"><div class="dash-num" style="color:var(--acc)">${fmt(totalPagos)}</div><div class="dash-lbl">Total Pagado</div></div>
            <div class="dash-card" style="padding:12px"><div class="dash-num" style="color:${disponible >= 0 ? 'var(--ok)' : 'var(--err)'}">${fmt(disponible)}</div><div class="dash-lbl">Disponible</div></div>
        </div>

        <div class="card" style="margin-bottom:18px">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
                <h3 class="sec-lbl" style="margin:0">📋 Planilla de Compras</h3>
                <button class="btn sm primary" onclick="ccShowCompraModal()">+ Nueva Compra</button>
            </div>
            <table class="tbl sm" style="margin-top:12px">
                <thead><tr>
                    <th style="width:46px">N°</th><th>Fecha</th><th>Descripción</th><th style="width:60px">Cant.</th><th style="width:70px">Unid.</th><th style="text-align:right">Precio</th><th>Factura</th><th style="text-align:right">Subtotal</th><th style="text-align:center;width:70px">Acción</th>
                </tr></thead>
                <tbody>
                    ${planilla.length === 0 ? '<tr><td colspan="9" class="empty">Sin compras registradas.</td></tr>' :
                    planilla.map(function(it, i) {
                        var sub = (it.cantidad || 1) * (it.precio || 0);
                        return `<tr>
                            <td style="font-weight:700; color:var(--tx3)">${i + 1}</td>
                            <td>${formatDatePY(it.fecha)}</td>
                            <td>${escapeHtml(it.descripcion || '')}</td>
                            <td>${it.cantidad || 1}</td>
                            <td style="font-size:0.85rem; color:var(--tx3)">${escapeHtml(it.unidad || 'u')}</td>
                            <td style="text-align:right">${fmt(it.precio)}</td>
                            <td style="font-size:0.85rem; color:var(--tx3)">${escapeHtml(it.factura || '—')}</td>
                            <td style="text-align:right; font-weight:700">${fmt(sub)}</td>
                            <td style="text-align:center">
                                <button class="btn sm" onclick="ccShowCompraModal('${it.id}')">✏️</button>
                                <button class="btn sm danger" onclick="ccDeleteCompra('${it.id}')">🗑️</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
                ${planilla.length > 0 ? '<tfoot><tr><td colspan="7" style="text-align:right; font-weight:700">TOTAL COMPRAS</td><td style="text-align:right; font-weight:800; color:var(--err)">' + fmt(totalCompras) + '</td><td></td></tr></tfoot>' : ''}
            </table>
        </div>

        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
                <h3 class="sec-lbl" style="margin:0">💰 Pagos Registrados</h3>
                <button class="btn sm primary" onclick="ccShowPagoModal()">+ Cargar Pago</button>
            </div>
            <table class="tbl sm" style="margin-top:12px">
                <thead><tr>
                    <th style="width:46px">N°</th><th>Fecha</th><th>Concepto</th><th>Método</th><th style="text-align:right">Monto</th><th style="text-align:center;width:70px">Acción</th>
                </tr></thead>
                <tbody>
                    ${pagos.length === 0 ? '<tr><td colspan="6" class="empty">Sin pagos registrados.</td></tr>' :
                    pagos.map(function(pg, i) {
                        return `<tr>
                            <td style="font-weight:700; color:var(--tx3)">${i + 1}</td>
                            <td>${formatDatePY(pg.fecha)}</td>
                            <td>${escapeHtml(pg.concepto || '')}</td>
                            <td style="font-size:0.85rem; color:var(--tx3)">${escapeHtml(pg.metodo || 'Efectivo')}</td>
                            <td style="text-align:right; font-weight:700; color:var(--acc)">${fmt(pg.monto)}</td>
                            <td style="text-align:center">
                                <button class="btn sm" onclick="ccShowPagoModal('${pg.id}')">✏️</button>
                                <button class="btn sm danger" onclick="ccDeletePago('${pg.id}')">🗑️</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
                ${pagos.length > 0 ? '<tfoot><tr><td colspan="4" style="text-align:right; font-weight:700">TOTAL PAGADO</td><td style="text-align:right; font-weight:800; color:var(--acc)">' + fmt(totalPagos) + '</td><td></td></tr></tfoot>' : ''}
            </table>
        </div>
    </div>`;
    el.innerHTML = h;
}

// ── Fondo ──
function ccShowFundModal() {
    var pc = ccGetPettyCash();
    var el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
        <div class="modal-title">💵 Fondo de Caja Chica<button class="delbtn" onclick="closeModal()">✕</button></div>
        <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:12px">Monto asignado para gastos menores de la obra. Los pagos se descuentan de este fondo.</p>
        <label style="font-size:0.85rem; font-weight:600; color:var(--tx2)">Monto del Fondo (Gs.)</label>
        <input id="cc-fund-amount" type="number" class="inp" value="${pc.fundAmount || 0}" style="margin-top:6px">
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="ccSaveFund()">Guardar Fondo 💾</button>
        </div>
    </div></div>`;
}

function ccSaveFund() {
    var monto = parseFloat(document.getElementById("cc-fund-amount").value);
    if (isNaN(monto) || monto < 0) return toast("Monto inválido", false);
    var pc = ccGetPettyCash();
    pc.fundAmount = monto;
    toast("Fondo actualizado ✓");
    save(); closeModal(); renderCajaChica();
}

// ── Compra (planilla) ──
function ccShowCompraModal(editId) {
    var item = null;
    if (editId) {
        var pc = ccGetPettyCash();
        item = pc.planilla.find(function(x) { return String(x.id) === String(editId); });
        if (!item) { toast("Compra no encontrada", false); return; }
    }
    var units = CC_UNITS.map(function(u) { return '<option value="' + u + '"' + (item && item.unidad === u ? ' selected' : '') + '>' + u + '</option>'; }).join("");
    var el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:480px">
        <div class="modal-title">${item ? '✏️ Editar Compra' : '➕ Nueva Compra'}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
            <div><label class="stat-lbl">Fecha</label>${dateInputPY('cc-comp-fecha', item ? item.fecha : todayISO(), '', 'width:100%')}</div>
            <div><label class="stat-lbl">Cantidad</label><input id="cc-comp-cant" type="number" min="0.1" step="any" class="inp" value="${item ? (item.cantidad || 1) : 1}"></div>
            <div><label class="stat-lbl">Unidad</label><select id="cc-comp-unidad" class="inp">${units}</select></div>
            <div><label class="stat-lbl">Precio unitario (Gs.)</label><input id="cc-comp-precio" type="number" min="0" class="inp" value="${item ? item.precio : ''}" placeholder="0"></div>
            <div class="fullcol"><label class="stat-lbl">Descripción de la compra</label><input id="cc-comp-desc" class="inp" value="${item ? escapeHtml(item.descripcion || '') : ''}" placeholder="Ej: Cemento portland 50kg"></div>
            <div class="fullcol"><label class="stat-lbl">Número de Factura</label><input id="cc-comp-factura" class="inp" value="${item ? escapeHtml(item.factura || '') : ''}" placeholder="Ej: 001-001-0001234"></div>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="ccSaveCompra()">${item ? 'Guardar Cambios 💾' : 'Registrar Compra ✓'}</button>
        </div>
    </div></div>`;
}

function ccSaveCompra() {
    var fecha = document.getElementById("cc-comp-fecha").value;
    var cantidad = parseFloat(document.getElementById("cc-comp-cant").value);
    var unidad = document.getElementById("cc-comp-unidad").value;
    var precio = parseFloat(document.getElementById("cc-comp-precio").value);
    var descripcion = document.getElementById("cc-comp-desc").value.trim();
    var factura = document.getElementById("cc-comp-factura").value.trim();
    if (!fecha) return toast("Fecha requerida", false);
    if (isNaN(cantidad) || cantidad <= 0) return toast("Cantidad inválida", false);
    if (isNaN(precio) || precio < 0) return toast("Precio inválido", false);
    if (!descripcion) return toast("Descripción requerida", false);

    var pc = ccGetPettyCash();
    var data = { id: ccNextId(pc.planilla), fecha, descripcion, cantidad, unidad, precio, factura };
    var idx = pc.planilla.findIndex(function(x) { return String(x.id) === String(data.id); });
    if (idx >= 0) pc.planilla[idx] = data; else pc.planilla.push(data);
    toast("Compra registrada ✓");
    save(); closeModal(); renderCajaChica();
}

function ccDeleteCompra(id) {
    if (!confirm("¿Eliminar esta compra de la planilla?")) return;
    var pc = ccGetPettyCash();
    pc.planilla = pc.planilla.filter(function(x) { return String(x.id) !== String(id); });
    toast("Compra eliminada ✓");
    save(); renderCajaChica();
}

// ── Pago ──
function ccShowPagoModal(editId) {
    var pago = null;
    if (editId) {
        var pc = ccGetPettyCash();
        pago = pc.pagos.find(function(x) { return String(x.id) === String(editId); });
        if (!pago) { toast("Pago no encontrado", false); return; }
    }
    var methods = CC_PAY_METHODS.map(function(m) { return '<option value="' + m + '"' + (pago && pago.metodo === m ? ' selected' : '') + '>' + m + '</option>'; }).join("");
    var el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:480px">
        <div class="modal-title">${pago ? '✏️ Editar Pago' : '💰 Cargar Pago'}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
            <div><label class="stat-lbl">Fecha</label>${dateInputPY('cc-pago-fecha', pago ? pago.fecha : todayISO(), '', 'width:100%')}</div>
            <div><label class="stat-lbl">Monto (Gs.)</label><input id="cc-pago-monto" type="number" min="0" class="inp" value="${pago ? pago.monto : ''}" placeholder="0"></div>
            <div class="fullcol"><label class="stat-lbl">Concepto</label><input id="cc-pago-concepto" class="inp" value="${pago ? escapeHtml(pago.concepto || '') : ''}" placeholder="Ej: Pago factura N° 0001234"></div>
            <div class="fullcol"><label class="stat-lbl">Método de Pago</label><select id="cc-pago-metodo" class="inp">${methods}</select></div>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="ccSavePago()">${pago ? 'Guardar Cambios 💾' : 'Cargar Pago ✓'}</button>
        </div>
    </div></div>`;
}

function ccSavePago() {
    var fecha = document.getElementById("cc-pago-fecha").value;
    var monto = parseFloat(document.getElementById("cc-pago-monto").value);
    var concepto = document.getElementById("cc-pago-concepto").value.trim();
    var metodo = document.getElementById("cc-pago-metodo").value;
    if (!fecha) return toast("Fecha requerida", false);
    if (isNaN(monto) || monto <= 0) return toast("Monto inválido", false);
    if (!concepto) return toast("Concepto requerido", false);

    var pc = ccGetPettyCash();
    var data = { id: ccNextId(pc.pagos), fecha, concepto, metodo, monto };
    var idx = pc.pagos.findIndex(function(x) { return String(x.id) === String(data.id); });
    if (idx >= 0) pc.pagos[idx] = data; else pc.pagos.push(data);
    toast("Pago cargado ✓");
    save(); closeModal(); renderCajaChica();
}

function ccDeletePago(id) {
    if (!confirm("¿Eliminar este pago?")) return;
    var pc = ccGetPettyCash();
    pc.pagos = pc.pagos.filter(function(x) { return String(x.id) !== String(id); });
    toast("Pago eliminado ✓");
    save(); renderCajaChica();
}

function ccNextId(list) {
    var ts = Date.now();
    while (list.some(function(x) { return String(x.id) === String(ts); })) ts++;
    return ts;
}

// ── Export PDF ──
function exportCajaChicaPDF() {
    var p = getActiveProject();
    if (!p) return toast("Sin proyecto activo", false);
    if (typeof window.jspdf === "undefined" && typeof jsPDF === "undefined") { toast("jsPDF cargando, intentá en 2 segundos", false); return; }
    var pc = ccGetPettyCash();
    var planilla = ccSortByDateAsc(pc.planilla);
    var pagos = ccSortByDateAsc(pc.pagos);
    var totalCompras = planilla.reduce(function(s, it) { return s + (it.cantidad || 1) * (it.precio || 0); }, 0);
    var totalPagos = pagos.reduce(function(s, pg) { return s + (pg.monto || 0); }, 0);
    var disponible = (pc.fundAmount || 0) - totalPagos;

    var JPDF = (window.jspdf || {}).jsPDF || window.jsPDF;
    var doc = new JPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var W = 210, M = 14;
    var profile = state.profile || {};
    var today = new Date().toLocaleDateString("es-PY", { year: "numeric", month: "long", day: "numeric" });

    doc.setFillColor(30, 58, 138); doc.rect(0, 0, W, 2, "F");
    doc.setFillColor(248, 250, 252); doc.rect(0, 2, W, 24, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("CAJA CHICA - PLANILLA DE COMPRAS Y PAGOS", M, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(p.name + " | " + today, M, 20);
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(M, 27, W - M, 27);
    var y = 34;

    doc.setFillColor(248, 250, 252); doc.roundedRect(M, y, (W - M * 2 - 6) / 3, 18, 2, 2, "F");
    doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text("FONDO ASIGNADO", M + 5, y + 5);
    doc.setTextColor(15, 23, 42); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Gs. " + fmt(pc.fundAmount || 0), M + 5, y + 14);
    var col2 = M + (W - M * 2 - 6) / 3 + 3;
    doc.setFillColor(248, 250, 252); doc.roundedRect(col2, y, (W - M * 2 - 6) / 3, 18, 2, 2, "F");
    doc.setTextColor(239, 68, 68); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text("TOTAL COMPRAS", col2 + 5, y + 5);
    doc.setTextColor(15, 23, 42); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Gs. " + fmt(totalCompras), col2 + 5, y + 14);
    var col3 = M + 2 * (W - M * 2 - 6) / 3 + 6;
    doc.setFillColor(248, 250, 252); doc.roundedRect(col3, y, (W - M * 2 - 6) / 3, 18, 2, 2, "F");
    doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text("TOTAL PAGADO", col3 + 5, y + 5);
    doc.setTextColor(15, 23, 42); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Gs. " + fmt(totalPagos), col3 + 5, y + 14);
    var col4 = M + (W - M * 2 - 6) + 9;
    doc.setFillColor(248, 250, 252); doc.roundedRect(col4, y, 58, 18, 2, 2, "F");
    doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text("DISPONIBLE", col4 + 5, y + 5);
    var dispColor = disponible >= 0 ? 34 : 239;
    doc.setTextColor(dispColor, disponible >= 0 ? 197 : 68, disponible >= 0 ? 94 : 68);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Gs. " + fmt(disponible), col4 + 5, y + 14);
    y += 26;

    if (planilla.length > 0) {
        if (y + 24 > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 138);
        doc.text("PLANILLA DE COMPRAS", M, y); y += 1;
        var pRows = [["N°", "Fecha", "Descripción", "Cant.", "Unid.", "Precio", "Factura", "Subtotal"]];
        planilla.forEach(function(it, i) {
            pRows.push([String(i + 1), it.fecha, it.descripcion || "", String(it.cantidad || 1), it.unidad || "u", fmt(it.precio), it.factura || "", fmt((it.cantidad || 1) * (it.precio || 0))]);
        });
        pRows.push(["", "", "TOTAL COMPRAS", "", "", "", "", fmt(totalCompras)]);
        doc.autoTable({
            startY: y + 5, head: [pRows[0]], body: pRows.slice(1), theme: "plain",
            headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
            styles: { fontSize: 7, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, lineColor: [226, 232, 240], lineWidth: 0.2 },
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 7 },
            margin: { left: M, right: M },
            columnStyles: {
                0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 22 }, 2: { cellWidth: "auto" },
                3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 14, halign: "center" },
                5: { cellWidth: 24, halign: "right" }, 6: { cellWidth: 26 }, 7: { cellWidth: 24, halign: "right" }
            }
        });
        y = doc.lastAutoTable.finalY + 12;
    }

    if (pagos.length > 0) {
        if (y + 24 > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 138);
        doc.text("PAGOS REGISTRADOS", M, y); y += 1;
        var gRows = [["N°", "Fecha", "Concepto", "Método", "Monto"]];
        pagos.forEach(function(pg, i) {
            gRows.push([String(i + 1), pg.fecha, pg.concepto || "", pg.metodo || "Efectivo", fmt(pg.monto)]);
        });
        gRows.push(["", "", "TOTAL PAGADO", "", fmt(totalPagos)]);
        doc.autoTable({
            startY: y + 5, head: [gRows[0]], body: gRows.slice(1), theme: "plain",
            headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
            styles: { fontSize: 7, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, lineColor: [226, 232, 240], lineWidth: 0.2 },
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 7 },
            margin: { left: M, right: M },
            columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 24 }, 2: { cellWidth: "auto" }, 3: { cellWidth: 30 }, 4: { cellWidth: 32, halign: "right" } }
        });
        y = doc.lastAutoTable.finalY + 12;
    }

    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(M, 287, W - M, 287);
        doc.text((profile.company || "Puntero") + (profile.ruc ? " - RUC: " + profile.ruc : ""), M, 292);
        doc.text("Pagina " + i + " de " + pages, W - M, 292, { align: "right" });
    }
    doc.save("caja_chica_" + p.name.replace(/\s+/g, "_") + ".pdf");
    toast("PDF generado ✓");
}