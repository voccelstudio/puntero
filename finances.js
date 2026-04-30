/**
 * GESTIÓN FINANCIERA - Puntero ERP
 * Seguimiento de ingresos y egresos de la obra.
 */

function renderFinances() {
    const el = document.getElementById("section-finances");
    if (!el) return;

    if (!state.finances) state.finances = { income: [], expenses: [] };
    
    const { total } = getTotals(); // Presupuesto total con honorarios e IVA
    const incomeTotal = state.finances.income.reduce((s, i) => s + i.amount, 0);
    
    // Egresos: Gastos Generales + Pagos a Contratistas
    const generalExpenses = state.finances.expenses.reduce((s, e) => s + e.amount, 0);
    const contractorPayments = state.contractors.reduce((s, c) => s + c.payments.reduce((p, py) => p + py.amount, 0), 0);
    const totalExpenses = generalExpenses + contractorPayments;
    
    const cashBalance = incomeTotal - totalExpenses;
    const projectedProfit = total - totalExpenses;

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <h2 class="sec-lbl" style="margin:0">Caja y Flujo de Fondos</h2>
            <div style="display:flex; gap:10px">
                <button class="btn ok-btn" onclick="showModal('new_income')">+ Registrar Ingreso</button>
                <button class="btn danger" onclick="showModal('new_expense')">+ Registrar Egreso</button>
            </div>
        </div>

        <div class="dash-grid">
            <div class="dash-card">
                <div class="dash-num">₲ ${fmt(incomeTotal)}</div>
                <div class="dash-lbl">Total Cobrado (Cliente)</div>
                <div style="font-size:0.75rem; color:var(--tx3); margin-top:5px">${Math.round((incomeTotal/total)*100)}% del presupuesto</div>
            </div>
            <div class="dash-card">
                <div class="dash-num" style="color:var(--err)">₲ ${fmt(totalExpenses)}</div>
                <div class="dash-lbl">Egresos Totales</div>
                <div style="font-size:0.75rem; color:var(--tx3); margin-top:5px">${fmt(contractorPayments)} MO / ${fmt(generalExpenses)} Otros</div>
            </div>
            <div class="dash-card">
                <div class="dash-num" style="color:${cashBalance >= 0 ? 'var(--ok)' : 'var(--err)'}">₲ ${fmt(cashBalance)}</div>
                <div class="dash-lbl">Saldo en Caja</div>
            </div>
        </div>

        <div class="grid2" style="margin-top:20px">
            <div class="card">
                <h3 class="sec-lbl">Ingresos / Cobros</h3>
                <div class="scroll-area" style="max-height:400px">
                    <table class="tbl">
                        <thead>
                            <tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Monto</th></tr>
                        </thead>
                        <tbody>
                            ${state.finances.income.map(i => `
                                <tr>
                                    <td>${i.date}</td>
                                    <td>${i.note}</td>
                                    <td style="text-align:right; font-weight:700; color:var(--ok)">₲ ${fmt(i.amount)}</td>
                                </tr>
                            `).reverse().join("") || '<tr><td colspan="3" style="text-align:center; padding:20px">Sin ingresos registrados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3 class="sec-lbl">Egresos Generales</h3>
                <p style="font-size:0.8rem; color:var(--tx3); margin-bottom:10px">(No incluye pagos a contratistas)</p>
                <div class="scroll-area" style="max-height:400px">
                    <table class="tbl">
                        <thead>
                            <tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Monto</th></tr>
                        </thead>
                        <tbody>
                            ${state.finances.expenses.map(e => `
                                <tr>
                                    <td>${e.date}</td>
                                    <td>${e.note}</td>
                                    <td style="text-align:right; font-weight:700; color:var(--err)">₲ ${fmt(e.amount)}</td>
                                </tr>
                            `).reverse().join("") || '<tr><td colspan="3" style="text-align:center; padding:20px">Sin egresos registrados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;
}

/**
 * MODALES FINANCIEROS
 */
window.modals.new_income = () => `
    <div class="modal-hdr">Registrar Ingreso (Cobro al Cliente)</div>
    <div style="display:flex; flex-direction:column; gap:15px">
        <div class="grid2">
            <input id="fin-amount" type="number" placeholder="Monto (₲)">
            <input id="fin-date" type="date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <textarea id="fin-note" placeholder="Concepto del cobro (Ej: Certificación 1, Adelanto...)"></textarea>
        <div style="display:flex; gap:10px; justify-content:flex-end">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn ok-btn" onclick="addFinancialRecord('income')">Guardar Ingreso</button>
        </div>
    </div>
`;

window.modals.new_expense = () => `
    <div class="modal-hdr">Registrar Egreso General</div>
    <div style="display:flex; flex-direction:column; gap:15px">
        <div class="grid2">
            <input id="fin-amount" type="number" placeholder="Monto (₲)">
            <input id="fin-date" type="date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <textarea id="fin-note" placeholder="Concepto del gasto (Ej: Combustible, Herramientas, Viáticos...)"></textarea>
        <div style="display:flex; gap:10px; justify-content:flex-end">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn danger" onclick="addFinancialRecord('expenses')">Guardar Egreso</button>
        </div>
    </div>
`;

function addFinancialRecord(type) {
    const amount = parseFloat(document.getElementById("fin-amount").value);
    const date = document.getElementById("fin-date").value;
    const note = document.getElementById("fin-note").value;

    if (!amount || !note) {
        toast("Completá monto y concepto", false);
        return;
    }

    if (!state.finances) state.finances = { income: [], expenses: [] };
    
    state.finances[type].push({
        id: Date.now(),
        amount,
        date,
        note
    });

    save();
    closeModal();
    renderFinances();
    toast("Registro financiero guardado ✓");
}
