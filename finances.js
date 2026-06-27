/**
 * finances.js — Gestión financiera integral (Ingresos, Egresos y jornales)
 */

var EXPENSE_CATEGORIES = [
  "Materiales", "Mano de obra", "Equipamiento", "Transporte",
  "Servicios", "Impuestos", "Honorarios", "Combustible",
  "Herramientas", "Imprevistos", "Varios"
];
var INCOME_SOURCES = ["Cliente", "Anticipo", "Pago parcial", "Pago final", "Otros"];
var PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"];

function renderFinances() {
    var el = document.getElementById("section-finances");
    if (!el) return;
    var p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver sus finanzas.</div>"; return; }
    if (!p.execution) p.execution = {};
    if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };

    var finances = p.execution.finances;
    var filterType = (window._finFilterType || "all");
    var filterCat = (window._finFilterCat || "");
    
    var allIncome = (finances.income || []).map(function(i) { i._t = "in"; return i; });
    var allExpenses = (finances.expenses || []).map(function(e) { e._t = "ex"; return e; });
    var all = allIncome.concat(allExpenses).sort(function(a,b) { return (parseDate(b.date) || 0) - (parseDate(a.date) || 0); });
    
    var filtered = all;
    if (filterType === "in") filtered = allIncome;
    else if (filterType === "ex") filtered = allExpenses;
    
    if (filterCat) filtered = filtered.filter(function(m) { return m.category === filterCat; });

    var incomeTotal = allIncome.reduce(function(s, i) { return s + i.amount; }, 0);
    var expensesTotal = allExpenses.reduce(function(s, e) { return s + e.amount; }, 0);

    // 1. Pagos a Contratistas
    var assignedConIds = new Set(Object.values(p.execution.schedules || {}).map(function(s) { return s.contractorId; }).filter(Boolean));
    var contractorPayments = (state.contractors || []).filter(function(c) { return assignedConIds.has(c.id); }).reduce(function(s, c) { return s + (c.payments || []).reduce(function(sp, py) { return sp + (py.amount || 0); }, 0); }, 0);

    // 2. Costo de Jornales (Basado en Asistencia en Bitácora)
    var laborCostTotal = 0;
    (p.execution.dailyLogs || []).forEach(function(log) {
        (log.attendance || []).forEach(function(att) {
            if (att.present) {
                var rate = 0;
                if (att.origin === 'Equipo Propio') {
                    var m = (state.ownTeam || []).find(function(o) { return o.name + " " + o.surname === att.name; });
                    if (m) rate = m.dailyRate;
                } else if (att.origin === 'Jornalero') {
                    var m = (p.execution.dayWorkers || []).find(function(d) { return d.name + " " + d.surname === att.name; });
                    if (m) rate = m.dailyRate;
                }
                laborCostTotal += rate;
            }
        });
    });

    var totalSpent = expensesTotal + contractorPayments + laborCostTotal;
    var balance = incomeTotal - totalSpent;

    // Totals by category (for pie preview)
    var catTotals = {};
    allExpenses.forEach(function(e) { var c = e.category || "Varios"; catTotals[c] = (catTotals[c] || 0) + e.amount; });
    var catSummary = Object.entries(catTotals).sort(function(a,b) { return b[1] - a[1]; });

    var filterOpts = "<option value='all'>Todos</option><option value='in'" + (filterType==='in'?" selected":"") + ">Ingresos</option><option value='ex'" + (filterType==='ex'?" selected":"") + ">Gastos</option>";
    var catFilterOpts = "<option value=''>Todas las categorías</option>" + EXPENSE_CATEGORIES.map(function(c) { return "<option value='" + c + "'" + (filterCat===c?" selected":"") + ">" + c + "</option>"; }).join("");

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px">
            <h2 class="sec-lbl" style="margin:0">FLUJO DE CAJA: ${escapeHtml(p.name)}</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
                <button class="btn sm primary" onclick="showModal('finance_entry',{type:'in'})">+ Ingreso</button>
                <button class="btn sm danger" onclick="showModal('finance_entry',{type:'ex'})">+ Gasto</button>
                <button class="btn sm" onclick="exportFinancesCSV()">📥 CSV</button>
            </div>
        </div>

        <div class="dash-grid">
            <div class="dash-card"><div class="dash-num" style="color:var(--ok)">${fmt(incomeTotal)}</div><div class="dash-lbl">Ingresos</div></div>
            <div class="dash-card"><div class="dash-num" style="color:var(--err)">${fmt(totalSpent)}</div><div class="dash-lbl">Egresos Reales</div></div>
            <div class="dash-card"><div class="dash-num" style="color:${balance >= 0 ? 'var(--ok)' : 'var(--err)'}">${fmt(balance)}</div><div class="dash-lbl">Saldo en Caja</div></div>
            <div class="dash-card"><div class="dash-num">${fmt(contractorPayments+laborCostTotal)}</div><div class="dash-lbl">MO Ext+Jornales</div></div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">Resumen de Egresos por Categoría</h3>
            <div class="grid3" style="margin-top:15px">
                <div style="padding:15px; background:var(--sur2); border-radius:var(--rad)">
                    <div style="font-size:0.75rem; color:var(--tx3)">CONTRATISTAS (EXT)</div>
                    <div style="font-size:1.1rem; font-weight:800">${fmt(contractorPayments)}</div>
                </div>
                <div style="padding:15px; background:var(--sur2); border-radius:var(--rad)">
                    <div style="font-size:0.75rem; color:var(--tx3)">JORNALES (DIRECTO)</div>
                    <div style="font-size:1.1rem; font-weight:800">${fmt(laborCostTotal)}</div>
                </div>
                <div style="padding:15px; background:var(--sur2); border-radius:var(--rad)">
                    <div style="font-size:0.75rem; color:var(--tx3)">GASTOS GENERALES</div>
                    <div style="font-size:1.1rem; font-weight:800">${fmt(expensesTotal)}</div>
                </div>
            </div>
            ${catSummary.length > 1 ? '<div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">' + catSummary.map(function(c) { return '<span class="ichip" style="background:var(--sur2)">' + escapeHtml(c[0]) + ': <strong>' + fmt(c[1]) + '</strong></span>'; }).join("") + '</div>' : ""}
        </div>

        <div class="card" style="margin-top:20px">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
                <h3 class="sec-lbl" style="margin:0">Todos los Movimientos</h3>
                <div style="display:flex; gap:6px; flex-wrap:wrap">
                    <select class="inp sm" onchange="window._finFilterType=this.value;renderFinances()" style="width:auto">${filterOpts}</select>
                    <select class="inp sm" onchange="window._finFilterCat=this.value;renderFinances()" style="width:auto">${catFilterOpts}</select>
                </div>
            </div>
            <table class="tbl sm" style="margin-top:12px">
                <thead><tr>
                    <th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th>Método</th><th style="text-align:right">Monto</th><th style="text-align:center">Acciones</th>
                </tr></thead>
                <tbody>
                    ${filtered.length === 0 ? '<tr><td colspan="7" class="empty">Sin movimientos registrados.</td></tr>' :
                    filtered.map(function(m, idx) { return `
                        <tr>
                            <td>${formatDatePY(m.date)}</td>
                            <td><span class="iva-badge" style="background:${m._t==='in'?'var(--ok)':'var(--bor)'}; color:white">${m._t==='in'?'Ingreso':'Gasto'}</span></td>
                            <td style="color:var(--tx3); font-size:0.85rem">${escapeHtml(m.category || '-')}</td>
                            <td>${escapeHtml(m.note || m.concept || '')}</td>
                            <td style="font-size:0.85rem">${escapeHtml(m.method || '-')}</td>
                            <td style="text-align:right; font-weight:700; color:${m._t==='in'?'var(--ok)':'var(--err)'}">${m._t==='in'?'+':'-'} ${fmt(m.amount)}</td>
                            <td style="text-align:center">
                                <button class="btn sm" onclick="showModal('finance_entry',{id:${m.id},type:'${m._t}'})">✏️</button>
                                <button class="btn sm danger" onclick="deleteFinanceEntry(${m.id},'${m._t}')">🗑️</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
            <div style="margin-top:8px; font-size:0.8rem; color:var(--tx3)">${filtered.length} movimiento(s)</div>
        </div>
    </div>`;
}

// ── Modal: Add/Edit Finance Entry ──
window.modals = window.modals || {};
window.modals.finance_entry = function(arg) {
  var isEdit = !!arg.id;
  var entry = null;
  if (isEdit) {
    var finances = getActiveProject().execution.finances;
    var list = arg.type === 'in' ? finances.income : finances.expenses;
    entry = list.find(function(e) { return e.id === arg.id; });
    if (!entry) { closeModal(); toast("Movimiento no encontrado", false); return ""; }
  }
  var title = isEdit ? (arg.type === 'in' ? "Editar Ingreso" : "Editar Gasto") : (arg.type === 'in' ? "Nuevo Ingreso" : "Nuevo Gasto");
  var cats = arg.type === 'in' ? INCOME_SOURCES : EXPENSE_CATEGORIES;
  
  return '<div class="modal-title">' + title + '<button class="delbtn" onclick="closeModal()">✕</button></div>' +
    '<div style="display:flex; flex-direction:column; gap:12px">' +
      '<div class="grid2">' +
        '<div><label class="stat-lbl">Fecha</label>' + dateInputPY("fin-date", entry ? entry.date : todayISO(), '', 'width:100%') + '</div>' +
        '<div><label class="stat-lbl">Monto (Gs.)</label><input id="fin-amount" type="number" class="inp" value="' + (entry ? entry.amount : '') + '" placeholder="0"></div>' +
        '<div class="fullcol"><label class="stat-lbl">' + (arg.type === 'in' ? 'Fuente / Cliente' : 'Categoría') + '</label><select id="fin-category" class="inp">' +
          cats.map(function(c) { return '<option value="' + c + '"' + ((entry && entry.category === c) ? ' selected' : '') + '>' + c + '</option>'; }).join("") +
        '</select></div>' +
        '<div class="fullcol"><label class="stat-lbl">Método de Pago</label><select id="fin-method" class="inp">' +
          PAYMENT_METHODS.map(function(m) { return '<option value="' + m + '"' + ((entry && entry.method === m) ? ' selected' : '') + '>' + m + '</option>'; }).join("") +
        '</select></div>' +
        '<div class="fullcol"><label class="stat-lbl">Concepto / Descripción</label><input id="fin-note" class="inp" value="' + (entry ? escapeHtml(entry.note || entry.concept || '') : '') + '" placeholder="Ej: Pago factura N° 001"></div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-acts">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<input type="hidden" id="fin-type" value="' + arg.type + '">' +
      '<input type="hidden" id="fin-id" value="' + (entry ? entry.id : '') + '">' +
      '<button class="btn primary" onclick="saveFinanceEntry()">' + (isEdit ? 'Guardar Cambios 💾' : 'Agregar ✓') + '</button>' +
    '</div>';
};

function saveFinanceEntry() {
  var p = getActiveProject();
  if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
  var finances = p.execution.finances;
  var type = document.getElementById("fin-type").value;
  var id = parseInt(document.getElementById("fin-id").value, 10) || Date.now();
  var list = type === 'in' ? finances.income : finances.expenses;
  
  var date = document.getElementById("fin-date").value;
  var amount = parseFloat(document.getElementById("fin-amount").value);
  var category = document.getElementById("fin-category").value;
  var method = document.getElementById("fin-method").value;
  var note = document.getElementById("fin-note").value.trim();
  
  if (!date) return toast("Fecha requerida", false);
  if (!amount || amount <= 0) return toast("Monto inválido", false);
  
  var existing = list.findIndex(function(e) { return e.id === id; });
  var entry = { id: id, date: date, amount: amount, category: category, method: method, note: note };
  
  if (existing >= 0) {
    list[existing] = entry;
    toast("Movimiento actualizado ✓");
  } else {
    list.push(entry);
    toast("Movimiento registrado ✓");
  }
  save(); closeModal(); renderFinances();
}

function deleteFinanceEntry(id, type) {
  if (!confirm("¿Eliminar este movimiento?")) return;
  var p = getActiveProject();
  if (!p.execution.finances) return;
  var list = type === 'in' ? p.execution.finances.income : p.execution.finances.expenses;
  var idx = list.findIndex(function(e) { return e.id === id; });
  if (idx >= 0) list.splice(idx, 1);
  save(); renderFinances();
  toast("Movimiento eliminado ✓");
}

function exportFinancesCSV() {
  var p = getActiveProject();
  if (!p || !p.execution.finances) return toast("Sin datos financieros", false);
  var rows = [["Fecha","Tipo","Categoría","Concepto","Método de pago","Monto"]];
  (p.execution.finances.income || []).forEach(function(i) {
    rows.push([i.date,"Ingreso",i.category||"",i.note||"",i.method||"",i.amount]);
  });
  (p.execution.finances.expenses || []).forEach(function(e) {
    rows.push([e.date,"Gasto",e.category||"",e.note||"",e.method||"",-Math.abs(e.amount)]);
  });
  var csv = rows.map(function(r) { return r.map(function(v) { return typeof v === 'string' ? '"' + v.replace(/"/g,'""') + '"' : v; }).join(","); }).join("\n");
  var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "finanzas_" + p.name.replace(/\s+/g,"_") + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV exportado ✓");
}
