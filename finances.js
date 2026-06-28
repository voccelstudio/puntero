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
var FINANCE_CHART_COLORS = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#14b8a6","#6366f1","#84cc16"];

function renderFinances() {
    var el = document.getElementById("section-finances");
    if (!el) return;
    var p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver sus finanzas.</div>"; return; }
    if (!p.execution) p.execution = {};
    if (!p.execution.finances) p.execution.finances = { income: [], expenses: [], pettyCash: { fundAmount: 0, transactions: [] } };

    var finances = p.execution.finances;
    if (!finances.pettyCash) finances.pettyCash = { fundAmount: 0, transactions: [] };
    var pc = finances.pettyCash;
    var pcTotalExpenses = (pc.transactions || []).reduce(function(s, t) { return s + t.amount; }, 0);
    var pcBalance = pc.fundAmount - pcTotalExpenses;
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
                <button class="btn sm" onclick="exportFinancePDF()">📄 PDF</button>
                <button class="btn sm" onclick="showModal('petty_cash_fund')">💵 Caja Chica</button>
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
            ${catSummary.length > 1 ? '<div style="display:flex; flex-wrap:wrap; gap:24px; margin-top:16px; align-items:flex-start"><div><canvas id="fin-chart-pie" width="200" height="200" style="width:200px;height:200px"></canvas></div><div style="flex:1;min-width:160px"><div style="font-size:0.8rem;font-weight:700;color:var(--tx3);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Distribución</div>' + catSummary.map(function(c,i) { return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.85rem"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + FINANCE_CHART_COLORS[i % FINANCE_CHART_COLORS.length] + '"></span>' + escapeHtml(c[0]) + ': <strong>' + fmt(c[1]) + '</strong></div>'; }).join("") + '</div></div>' : ""}
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">Caja Chica</h3>
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px">
                <div style="flex:1; min-width:140px; padding:15px; background:var(--sur2); border-radius:var(--rad)">
                    <div style="font-size:0.75rem; color:var(--tx3)">FONDO ASIGNADO</div>
                    <div style="font-size:1.3rem; font-weight:800">${fmt(pc.fundAmount)}</div>
                </div>
                <div style="flex:1; min-width:140px; padding:15px; background:var(--sur2); border-radius:var(--rad)">
                    <div style="font-size:0.75rem; color:var(--tx3)">GASTADO</div>
                    <div style="font-size:1.3rem; font-weight:800; color:var(--err)">${fmt(pcTotalExpenses)}</div>
                </div>
                <div style="flex:1; min-width:140px; padding:15px; background:var(--sur2); border-radius:var(--rad)">
                    <div style="font-size:0.75rem; color:var(--tx3)">SALDO DISPONIBLE</div>
                    <div style="font-size:1.3rem; font-weight:800; color:${pcBalance >= 0 ? 'var(--ok)' : 'var(--err)'}">${fmt(pcBalance)}</div>
                </div>
            </div>
            ${pc.fundAmount > 0 ? '<div style="margin-top:8px;height:8px;border-radius:4px;background:var(--bor);overflow:hidden"><div style="height:100%;width:' + Math.min(Math.round(pcTotalExpenses / pc.fundAmount * 100), 100) + '%;border-radius:4px;background:' + (pcTotalExpenses > pc.fundAmount ? 'var(--err)' : 'var(--ok)') + ';transition:width .3s"></div></div><div style="font-size:0.75rem;color:var(--tx3);margin-top:4px">' + Math.min(Math.round(pcTotalExpenses / pc.fundAmount * 100), 100) + '% utilizado</div>' : ''}
            <div style="display:flex; gap:8px; margin-top:12px">
                <button class="btn sm primary" onclick="showModal('petty_cash_fund')">Ajustar Fondo</button>
                <button class="btn sm danger" onclick="showModal('petty_cash_expense')">Gasto Caja Chica</button>
            </div>
            <table class="tbl sm" style="margin-top:12px">
                <thead><tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Monto</th><th>Nota</th><th style="text-align:center">Acción</th></tr></thead>
                <tbody>
                    ${pc.transactions.length === 0 ? '<tr><td colspan="5" class="empty">Sin movimientos de caja chica.</td></tr>' :
                    pc.transactions.slice(0, 10).map(function(t) { return `
                        <tr>
                            <td>${formatDatePY(t.date)}</td>
                            <td>${escapeHtml(t.concept)}</td>
                            <td style="text-align:right;font-weight:700;color:var(--err)">- ${fmt(t.amount)}</td>
                            <td style="font-size:0.85rem;color:var(--tx3)">${escapeHtml(t.note || '')}</td>
                            <td style="text-align:center"><button class="btn sm danger" onclick="deletePettyCashTransaction(${t.id})">🗑️</button></td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
            ${pc.transactions.length > 10 ? '<div style="margin-top:8px;font-size:0.8rem;color:var(--tx3)">Mostrando últimos 10 de ' + pc.transactions.length + ' movimientos</div>' : ''}
        </div>

                <div class="card" style="margin-top:20px"><h3 class="sec-lbl">Flujo Mensual</h3><div style="display:flex;gap:12px;overflow-x:auto;padding:12px 0">${getMonthlyCashFlow().map(function(m) { var bal = m.income - m.expenses; var months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; var parts = m.month.split("-"); var label = months[parseInt(parts[1],10)-1]; return '<div style="min-width:100px;padding:12px;background:var(--sur2);border-radius:var(--rad);text-align:center;border-left:3px solid ' + (bal >= 0 ? 'var(--ok)' : 'var(--err)') + '"><div style="font-size:0.7rem;color:var(--tx3);font-weight:700;text-transform:uppercase">' + label + '</div><div style="font-size:0.8rem;color:var(--ok);margin-top:4px">+' + fmt(m.income) + '</div><div style="font-size:0.8rem;color:var(--err)">-' + fmt(m.expenses) + '</div><div style="font-size:0.75rem;font-weight:700;color:' + (bal >= 0 ? 'var(--ok)' : 'var(--err)') + ';margin-top:4px;border-top:1px solid var(--bor);padding-top:4px">' + (bal >= 0 ? '+' : '') + fmt(bal) + '</div></div>'; }).join("") || '<div style="color:var(--tx3);padding:12px">Sin movimientos mensuales</div>'}</div></div>

            ${(incomeTotal > 0 || total > 0) ? '<div class="card" style="margin-top:20px"><h3 class="sec-lbl">Presupuesto vs Real</h3><div class="grid3" style="margin-top:12px"><div style="padding:15px;background:var(--sur2);border-radius:var(--rad)"><div style="font-size:0.75rem;color:var(--tx3)">PRESUPUESTO META</div><div style="font-size:1.3rem;font-weight:800">' + fmt(total) + '</div></div><div style="padding:15px;background:var(--sur2);border-radius:var(--rad)"><div style="font-size:0.75rem;color:var(--tx3)">TOTAL GASTADO</div><div style="font-size:1.3rem;font-weight:800;color:var(--err)">' + fmt(totalSpent) + '</div></div><div style="padding:15px;background:var(--sur2);border-radius:var(--rad)"><div style="font-size:0.75rem;color:var(--tx3)">EJECUCIÓN</div><div style="font-size:1.3rem;font-weight:800;color:' + (totalSpent > total ? 'var(--err)' : 'var(--ok)') + '">' + (total > 0 ? Math.round(totalSpent / total * 100) : 0) + '%</div></div></div>' + (total > 0 ? '<div style="margin-top:8px;height:8px;border-radius:4px;background:var(--bor);overflow:hidden"><div style="height:100%;width:' + Math.min(Math.round(totalSpent / total * 100), 100) + '%;border-radius:4px;background:' + (totalSpent > total ? 'var(--err)' : 'var(--ok)') + ';transition:width .3s"></div></div>' : '') + '</div>' : ''}

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
  setTimeout(drawFinanceChart, 50);
}

// ── Draw expense pie chart on canvas ──
function drawFinanceChart() {
  var canvas = document.getElementById("fin-chart-pie");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var p = getActiveProject();
  if (!p || !p.execution || !p.execution.finances) return;
  var expenses = p.execution.finances.expenses || [];
  var catTotals = {};
  expenses.forEach(function(e) { var c = e.category || "Varios"; catTotals[c] = (catTotals[c] || 0) + e.amount; });
  var entries = Object.entries(catTotals).sort(function(a,b) { return b[1] - a[1]; });
  if (entries.length === 0) return;
  var total = entries.reduce(function(s, e) { return s + e[1]; }, 0);
  var cx = 100, cy = 100, r = 80, ir = 50;
  var startAngle = -Math.PI / 2;
  ctx.clearRect(0, 0, 200, 200);
  entries.forEach(function(entry, i) {
    var sliceAngle = (entry[1] / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, ir, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = FINANCE_CHART_COLORS[i % FINANCE_CHART_COLORS.length];
    ctx.fill();
    startAngle += sliceAngle;
  });
  // Center text
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--tx").trim() || "#1e293b";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fmt(total), cx, cy);
  ctx.font = "10px sans-serif";
  ctx.fillText("total", cx, cy + 14);
}

// ── Cash flow by month (mini aggregation) ──
function getMonthlyCashFlow() {
  var p = getActiveProject();
  if (!p || !p.execution || !p.execution.finances) return [];
  var all = [];
  (p.execution.finances.income || []).forEach(function(i) { all.push({ date: i.date, amount: i.amount, t: "in" }); });
  (p.execution.finances.expenses || []).forEach(function(e) { all.push({ date: e.date, amount: -e.amount, t: "ex" }); });
  var monthly = {};
  all.forEach(function(m) {
    if (!m.date) return;
    var parts = m.date.split("-");
    if (parts.length < 2) return;
    var key = parts[0] + "-" + parts[1];
    if (!monthly[key]) monthly[key] = { income: 0, expenses: 0 };
    if (m.t === "in") monthly[key].income += m.amount;
    else monthly[key].expenses += Math.abs(m.amount);
  });
  return Object.entries(monthly).sort().map(function(e) { return { month: e[0], income: e[1].income, expenses: e[1].expenses }; });
}

// ── Export Finance PDF ──
function exportFinancePDF() {
  var p = getActiveProject();
  if (!p || !p.execution || !p.execution.finances) return toast("Sin datos financieros", false);
  if (typeof window.jspdf === "undefined" && typeof jsPDF === "undefined") { toast("jsPDF cargando, intentá en 2 segundos", false); return; }
  var JPDF = (window.jspdf || {}).jsPDF || window.jsPDF;
  var doc = new JPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var W = 210, M = 14;
  var profile = state.profile || {};
  var finances = p.execution.finances;
  var incomeTotal = (finances.income || []).reduce(function(s, i) { return s + i.amount; }, 0);
  var expensesTotal = (finances.expenses || []).reduce(function(s, e) { return s + e.amount; }, 0);
  var monthly = getMonthlyCashFlow();
  var today = new Date().toLocaleDateString("es-PY", { year: "numeric", month: "long", day: "numeric" });

  // Header
  doc.setFillColor(30, 58, 138); doc.rect(0, 0, W, 2, "F");
  doc.setFillColor(248, 250, 252); doc.rect(0, 2, W, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text("ESTADO FINANCIERO", M, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(p.name + " | " + today, M, 20);
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(M, 27, W - M, 27);
  var y = 34;

  // Summary cards
  doc.setFillColor(248, 250, 252); doc.roundedRect(M, y, (W - M * 2 - 6) / 3, 20, 2, 2, "F");
  doc.setTextColor(34, 197, 94); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("INGRESOS", M + 5, y + 6);
  doc.setTextColor(15, 23, 42); doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text("Gs. " + fmt(incomeTotal), M + 5, y + 16);
  var col2 = M + (W - M * 2 - 6) / 3 + 3;
  doc.setFillColor(248, 250, 252); doc.roundedRect(col2, y, (W - M * 2 - 6) / 3, 20, 2, 2, "F");
  doc.setTextColor(239, 68, 68); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("EGRESOS", col2 + 5, y + 6);
  doc.setTextColor(15, 23, 42); doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text("Gs. " + fmt(expensesTotal), col2 + 5, y + 16);
  var col3 = M + 2 * (W - M * 2 - 6) / 3 + 6;
  doc.setFillColor(248, 250, 252); doc.roundedRect(col3, y, (W - M * 2 - 6) / 3, 20, 2, 2, "F");
  doc.setTextColor(71, 85, 105); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("SALDO", col3 + 5, y + 6);
  var balance = incomeTotal - expensesTotal;
  doc.setTextColor(balance >= 0 ? 34 : 239, balance >= 0 ? 197 : 68, balance >= 0 ? 94 : 68);
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text("Gs. " + fmt(balance), col3 + 5, y + 16);
  y += 28;

  // Monthly breakdown table
  if (monthly.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 138);
    doc.text("FLUJO MENSUAL", M, y); y += 6;
    var rows = [["Mes", "Ingresos", "Egresos", "Balance"]];
    monthly.forEach(function(m) {
      var months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      var parts = m.month.split("-");
      var label = months[parseInt(parts[1], 10) - 1] + " " + parts[0];
      rows.push([label, "Gs. " + fmt(m.income), "Gs. " + fmt(m.expenses), "Gs. " + fmt(m.income - m.expenses)]);
    });
    doc.autoTable({
      startY: y, head: [rows[0]], body: rows.slice(1), theme: "plain",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 7, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, lineColor: [226, 232, 240], lineWidth: 0.2 },
      margin: { left: M, right: M },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 44, halign: "right" }, 2: { cellWidth: 44, halign: "right" }, 3: { cellWidth: 44, halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Expense breakdown table
  var expensesByCat = {};
  (finances.expenses || []).forEach(function(e) { var c = e.category || "Varios"; if (!expensesByCat[c]) expensesByCat[c] = 0; expensesByCat[c] += e.amount; });
  var catEntries = Object.entries(expensesByCat).sort(function(a,b) { return b[1] - a[1]; });
  if (catEntries.length > 0) {
    if (y + 30 > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 58, 138);
    doc.text("DETALLE DE EGRESOS POR CATEGORÍA", M, y); y += 6;
    var catRows = [["Categoría", "Total", "%"]];
    var grandTotal = catEntries.reduce(function(s, e) { return s + e[1]; }, 0);
    catEntries.forEach(function(e) {
      catRows.push([e[0], "Gs. " + fmt(e[1]), Math.round(e[1] / grandTotal * 100) + "%"]);
    });
    doc.autoTable({
      startY: y, head: [catRows[0]], body: catRows.slice(1), theme: "plain",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 7, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, lineColor: [226, 232, 240], lineWidth: 0.2 },
      margin: { left: M, right: M },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 50, halign: "right" }, 2: { cellWidth: 30, halign: "center" } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Footer
  var pages = doc.internal.getNumberOfPages();
  for (var i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(M, 287, W - M, 287);
    doc.text(profile.company || "Puntero" + (profile.ruc ? " - RUC: " + profile.ruc : ""), M, 292);
    doc.text("Pagina " + i + " de " + pages, W - M, 292, { align: "right" });
  }
  doc.save("estado_financiero_" + p.name.replace(/\s+/g, "_") + ".pdf");
  toast("PDF generado ✓");
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

// ── Petty Cash (Caja Chica) ──
window.modals.petty_cash_fund = function(arg) {
  var p = getActiveProject();
  var pc = (p.execution && p.execution.finances && p.execution.finances.pettyCash) || { fundAmount: 0, transactions: [] };
  return '<div class="modal-title">Ajustar Fondo de Caja Chica<button class="delbtn" onclick="closeModal()">✕</button></div>' +
    '<div style="display:flex; flex-direction:column; gap:12px">' +
      '<div><label class="stat-lbl">Monto del Fondo (Gs.)</label><input id="pc-fund-amount" type="number" class="inp" value="' + pc.fundAmount + '" placeholder="0"></div>' +
    '</div>' +
    '<div class="modal-acts">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn primary" onclick="savePettyCashFund()">Guardar Fondo 💾</button>' +
    '</div>';
};

window.modals.petty_cash_expense = function(arg) {
  return '<div class="modal-title">Registrar Gasto de Caja Chica<button class="delbtn" onclick="closeModal()">✕</button></div>' +
    '<div style="display:flex; flex-direction:column; gap:12px">' +
      '<div class="grid2">' +
        '<div><label class="stat-lbl">Fecha</label>' + dateInputPY("pc-exp-date", todayISO(), '', 'width:100%') + '</div>' +
        '<div><label class="stat-lbl">Monto (Gs.)</label><input id="pc-exp-amount" type="number" class="inp" placeholder="0"></div>' +
        '<div class="fullcol"><label class="stat-lbl">Concepto</label><input id="pc-exp-concept" class="inp" placeholder="Ej: Caf\u00e9, vi\u00e1tico"></div>' +
        '<div class="fullcol"><label class="stat-lbl">Nota (opcional)</label><input id="pc-exp-note" class="inp" placeholder="Detalle adicional"></div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-acts">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn primary" onclick="savePettyCashExpense()">Registrar Gasto \u2713</button>' +
    '</div>';
};

function savePettyCashFund() {
  var p = getActiveProject();
  if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
  if (!p.execution.finances.pettyCash) p.execution.finances.pettyCash = { fundAmount: 0, transactions: [] };
  var amount = parseFloat(document.getElementById("pc-fund-amount").value);
  if (isNaN(amount) || amount < 0) return toast("Monto inv\u00e1lido", false);
  p.execution.finances.pettyCash.fundAmount = amount;
  toast("Fondo de caja chica actualizado \u2713");
  save(); closeModal(); renderFinances();
}

function savePettyCashExpense() {
  var p = getActiveProject();
  if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
  if (!p.execution.finances.pettyCash) p.execution.finances.pettyCash = { fundAmount: 0, transactions: [] };
  var date = document.getElementById("pc-exp-date").value;
  var amount = parseFloat(document.getElementById("pc-exp-amount").value);
  var concept = document.getElementById("pc-exp-concept").value.trim();
  var note = document.getElementById("pc-exp-note").value.trim();
  if (!date) return toast("Fecha requerida", false);
  if (!amount || amount <= 0) return toast("Monto inv\u00e1lido", false);
  if (!concept) return toast("Concepto requerido", false);
  var pc = p.execution.finances.pettyCash;
  pc.transactions.push({
    id: Date.now(),
    date: date,
    concept: concept,
    amount: amount,
    note: note
  });
  pc.transactions.sort(function(a,b) { return parseDate(b.date) - parseDate(a.date); });
  toast("Gasto de caja chica registrado \u2713");
  save(); closeModal(); renderFinances();
}

function deletePettyCashTransaction(id) {
  if (!confirm("\u00bfEliminar este gasto de caja chica?")) return;
  var p = getActiveProject();
  if (!p.execution || !p.execution.finances || !p.execution.finances.pettyCash) return;
  var pc = p.execution.finances.pettyCash;
  var idx = pc.transactions.findIndex(function(t) { return t.id === id; });
  if (idx >= 0) pc.transactions.splice(idx, 1);
  save(); renderFinances();
  toast("Gasto eliminado \u2713");
}
