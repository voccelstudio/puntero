/**
 * finances.js — Gestión de ingresos y egresos (Cashflow)
 */

function renderFinances() {
    const el = document.getElementById("section-finances");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver sus finanzas.</div>"; return; }
    if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
    if (!p.execution.finances.income) p.execution.finances.income = [];
    if (!p.execution.finances.expenses) p.execution.finances.expenses = [];

    const finances = p.execution.finances;

    const { total } = getTotals();
    const incomeTotal = finances.income.reduce((s, i) => s + i.amount, 0);
    const expensesTotal = finances.expenses.reduce((s, e) => s + e.amount, 0);

    // Pagos a contratistas filtrados por proyecto (solo los asignados a este proyecto)
    const assignedConIds = new Set(
        Object.values(p.execution.schedules || {})
            .map(s => s && s.contractorId)
            .filter(Boolean)
    );
    const projectContractors = (state.contractors || []).filter(c => assignedConIds.has(c.id));
    const contractorPayments = projectContractors.reduce((s, c) => s + (c.payments || []).reduce((sp, py) => sp + (py.amount || 0), 0), 0);

    const totalSpent = expensesTotal + contractorPayments;
    const balance = incomeTotal - totalSpent;

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <div>
                <h2 class="sec-lbl" style="margin:0">FLUJO DE CAJA</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Proyecto: <strong>${p.name}</strong></p>
            </div>
            <div style="display:flex; gap:10px">
                <button class="btn" onclick="showModal('add_income')">+ Registrar Cobro</button>
                <button class="btn primary" onclick="showModal('add_expense')">+ Registrar Gasto</button>
            </div>
        </div>

        <div class="dash-grid">
            <div class="dash-card">
                <div class="dash-num" style="color:var(--ok)">${fmt(incomeTotal)}</div>
                <div class="dash-lbl">Ingresos Totales</div>
            </div>
            <div class="dash-card">
                <div class="dash-num" style="color:var(--err)">${fmt(totalSpent)}</div>
                <div class="dash-lbl">Egresos Reales</div>
            </div>
            <div class="dash-card">
                <div class="dash-num" style="color:${balance >= 0 ? 'var(--ok)' : 'var(--err)'}">${fmt(balance)}</div>
                <div class="dash-lbl">Saldo en Caja</div>
            </div>
            <div class="dash-card">
                <div class="dash-num">${fmt(total)}</div>
                <div class="dash-lbl">Presupuesto (Meta)</div>
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">Libro Diario (Movimientos de Caja)</h3>
            <p style="font-size:0.8rem; color:var(--tx3); margin-bottom:10px">Listado unificado de todos los cobros y pagos del proyecto.</p>
            
            <div class="scroll-area" style="max-height:500px">
                <table class="tbl">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Categoría</th>
                            <th>Concepto / Referencia</th>
                            <th style="text-align:right">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(() => {
                            const income = finances.income.map(i => ({ ...i, type: 'income', cat: 'Cobro Cliente' }));
                            const expenses = finances.expenses.map(e => ({ ...e, type: 'expense', cat: 'Gasto General' }));
                            const payments = projectContractors.flatMap(c => (c.payments || []).map(pay => ({ ...pay, type: 'expense', cat: 'Mano de Obra', note: `${c.name}: ${pay.note}` })));

                            const all = [...income, ...expenses, ...payments].sort((a, b) => parseDate(b.date) - parseDate(a.date));

                            return all.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px">No hay movimientos registrados.</td></tr>' : all.map(t => `
                                <tr>
                                    <td>${formatDatePY(t.date)}</td>
                                    <td><span class="iva-badge" style="background:${t.type === 'income' ? 'var(--matbg)' : 'var(--labbg)'}; color:${t.type === 'income' ? 'var(--ok)' : 'var(--lab)'}">${t.cat}</span></td>
                                    <td>${t.note}</td>
                                    <td style="text-align:right; font-weight:700; color:${t.type === 'income' ? 'var(--ok)' : 'var(--err)'}">
                                        ${t.type === 'income' ? '+' : '-'} ${fmt(t.amount)}
                                    </td>
                                </tr>
                            `).join("");
                        })()}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

// Modals
window.modals = window.modals || {};
window.modals.add_income = () => `
    <div class="modal-title">Registrar Ingreso (Cobro)</div>
    <div class="grid2">
        <input id="fi-amount" type="number" placeholder="Monto (₲)">
        <input id="fi-date" type="date" value="${todayISO()}">
        <input id="fi-note" class="fullcol" placeholder="Concepto del cobro (ej: Entrega inicial)">
    </div>
    <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveFinance('income')">Guardar Cobro</button>
    </div>`;

window.modals.add_expense = () => `
    <div class="modal-title">Registrar Egreso (Gasto)</div>
    <div class="grid2">
        <input id="fe-amount" type="number" placeholder="Monto (₲)">
        <input id="fe-date" type="date" value="${todayISO()}">
        <input id="fe-note" class="fullcol" placeholder="Concepto del gasto (ej: Viáticos, Combustible)">
    </div>
    <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveFinance('expense')">Guardar Gasto</button>
    </div>`;

function saveFinance(type) {
    const p = getActiveProject();
    if (!p) return;
    if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
    if (!p.execution.finances.income) p.execution.finances.income = [];
    if (!p.execution.finances.expenses) p.execution.finances.expenses = [];

    const pre = type === 'income' ? 'fi' : 'fe';
    const amount = parseFloat(document.getElementById(`${pre}-amount`).value);
    const date = document.getElementById(`${pre}-date`).value;
    const note = document.getElementById(`${pre}-note`).value;

    if (!amount || !note) return toast("Monto y concepto obligatorios", false);

    const list = type === 'income' ? p.execution.finances.income : p.execution.finances.expenses;
    list.push({ id: Date.now(), amount, date, note });
    save();
    closeModal();
    renderFinances();
    toast("Movimiento registrado ✓");
}
