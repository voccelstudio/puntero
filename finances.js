/**
 * finances.js — Gestión financiera integral (Ingresos, Egresos y jornales)
 */

function renderFinances() {
    const el = document.getElementById("section-finances");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver sus finanzas.</div>"; return; }
    if (!p.execution) p.execution = {};
    if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };

    const finances = p.execution.finances;
    const { total } = getTotals(); // Presupuesto meta
    
    const incomeTotal = (finances.income || []).reduce((s, i) => s + i.amount, 0);
    const expensesTotal = (finances.expenses || []).reduce((s, e) => s + e.amount, 0);

    // 1. Pagos a Contratistas
    const assignedConIds = new Set(Object.values(p.execution.schedules || {}).map(s => s.contractorId).filter(Boolean));
    const contractorPayments = (state.contractors || []).filter(c => assignedConIds.has(c.id)).reduce((s, c) => s + (c.payments || []).reduce((sp, py) => sp + (py.amount || 0), 0), 0);

    // 2. Costo de Jornales (Basado en Asistencia en Bitácora)
    let laborCostTotal = 0;
    (p.execution.dailyLogs || []).forEach(log => {
        (log.attendance || []).forEach(att => {
            if (att.present) {
                // Buscar el jornal correspondiente
                let rate = 0;
                if (att.origin === 'Equipo Propio') {
                    const m = (state.ownTeam || []).find(o => `${o.name} ${o.surname}` === att.name);
                    if (m) rate = m.dailyRate;
                } else if (att.origin === 'Jornalero') {
                    const m = (p.execution.dayWorkers || []).find(d => `${d.name} ${d.surname}` === att.name);
                    if (m) rate = m.dailyRate;
                }
                laborCostTotal += rate;
            }
        });
    });

    const totalSpent = expensesTotal + contractorPayments + laborCostTotal;
    const balance = incomeTotal - totalSpent;

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <h2 class="sec-lbl" style="margin:0">FLUJO DE CAJA: ${p.name}</h2>
            <div style="display:flex; gap:10px">
                <button class="btn sm" onclick="exportFinancesCSV()">📥 CSV</button>
            </div>
        </div>

        <div class="dash-grid">
            <div class="dash-card"><div class="dash-num" style="color:var(--ok)">${fmt(incomeTotal)}</div><div class="dash-lbl">Ingresos</div></div>
            <div class="dash-card"><div class="dash-num" style="color:var(--err)">${fmt(totalSpent)}</div><div class="dash-lbl">Egresos Reales</div></div>
            <div class="dash-card"><div class="dash-num" style="color:${balance >= 0 ? 'var(--ok)' : 'var(--err)'}">${fmt(balance)}</div><div class="dash-lbl">Saldo en Caja</div></div>
            <div class="dash-card"><div class="dash-num">${fmt(total)}</div><div class="dash-lbl">Presupuesto Meta</div></div>
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
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">Últimos Movimientos</h3>
            <table class="tbl sm">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th style="text-align:right">Monto</th></tr></thead>
                <tbody>
                    ${[...(finances.income || []).map(i => ({...i, t: 'in', c: 'Ingreso'})), ...(finances.expenses || []).map(e => ({...e, t: 'ex', c: 'Gasto'}))]
                        .sort((a,b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0)).slice(0, 10).map(m => `
                        <tr>
                            <td>${formatDatePY(m.date)}</td>
                            <td><span class="iva-badge" style="background:${m.t==='in'?'var(--ok)':'var(--bor)'}; color:white">${m.c}</span></td>
                            <td>${m.note}</td>
                            <td style="text-align:right; font-weight:700; color:${m.t==='in'?'var(--ok)':'var(--err)'}">${m.t==='in'?'+':'-'} ${fmt(m.amount)}</td>
                        </tr>
                    `).join("") || '<tr><td colspan="4" class="empty">Sin movimientos registrados.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>`;
}


