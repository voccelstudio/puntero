/**
 * contractors.js — Gestión de Contratistas, Pagos y Contratos
 */

function renderContractors() {
    const el = document.getElementById("section-contractors");
    if (!el) return;

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">GESTIÓN DE CONTRATISTAS</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Directorio y Control de Pagos</p>
            </div>
            <button class="btn primary" onclick="showAddContractorModal()">+ Nuevo Contratista</button>
        </div>

        <div class="con-grid">`;

    if (state.contractors.length === 0) {
        h += `<div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--sur); border-radius:var(--rad); border:1px dashed var(--bor)">
            <p style="color:var(--tx3)">No hay contratistas registrados todavía.</p>
        </div>`;
    }

    state.contractors.forEach(con => {
        const assignedItems = state.items.filter(item => state.schedules[item.id]?.contractorId === con.id);
        const totalMO = assignedItems.reduce((s, i) => s + (i.laborCost * i.qty), 0);
        const totalPaid = (con.payments || []).reduce((s, p) => s + p.amount, 0);
        const balance = totalMO - totalPaid;

        h += `<div class="con-card ${con.isBlacklisted ? 'blacklist' : ''}">
            <div class="con-name">${con.name}</div>
            <div class="con-meta">
                <span>📱 ${con.phone || 'Sin teléfono'} ${con.phone ? `<button class="btn sm" onclick="window.open(waLink('${con.phone.replace(/'/g, "\\'")}'), '_blank')" style="padding:0 5px;background:#25D366;color:white;border:none;margin-left:5px" title="WhatsApp">💬</button>` : ''}</span>
                <span>🔨 ${con.specialty || 'General'}</span>
            </div>
            ${con.notes ? `<div style="font-size:0.75rem; background:rgba(var(--acc-rgb), 0.05); padding:6px; border-radius:4px; margin-bottom:10px; color:var(--tx2)">📝 ${con.notes}</div>` : ''}
            <div class="con-stats">
                <div class="stat-box">
                    <div class="stat-lbl">Mano de Obra</div>
                    <div class="stat-val">₲ ${fmt(totalMO)}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-lbl">Saldo Pendiente</div>
                    <div class="stat-val" style="color:${balance > 0 ? 'var(--err)' : 'var(--ok)'}">₲ ${fmt(balance)}</div>
                </div>
            </div>
            <div style="margin-top:14px; display:flex; gap:6px">
                <button class="btn sm" style="flex:1" onclick="showPaymentModal('${con.id}')">💸 Pagos</button>
                <button class="btn sm" style="flex:1" onclick="showAssignItemsModal('${con.id}')">🔗 Asignar</button>
                <button class="btn sm" onclick="toggleBlacklist('${con.id}')" title="${con.isBlacklisted ? 'Quitar de lista negra' : 'Marcar como conflictivo'}">${con.isBlacklisted ? '🔓' : '🚫'}</button>
                <button class="btn sm danger" onclick="deleteContractor('${con.id}')">✕</button>
            </div>
        </div>`;
    });

    h += `</div></div>`;
    el.innerHTML = h;
}

function showAddContractorModal() {
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
        <div class="modal-title">Nuevo Contratista<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:flex; flex-direction:column; gap:10px">
            <input id="cn-name" placeholder="Nombre completo / Empresa">
            <input id="cn-phone" placeholder="Teléfono">
            <input id="cn-spec" placeholder="Especialidad (ej. Albañilería)">
            <textarea id="cn-notes" placeholder="Notas internas sobre calidad, puntualidad, etc." rows="3"></textarea>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.875rem; color:var(--err); cursor:pointer">
                <input type="checkbox" id="cn-black"> 🚨 Marcar en Lista Negra (Conflictivo)
            </label>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="addContractor()">Guardar</button>
        </div>
    </div></div>`;
}

function addContractor() {
    const name = document.getElementById("cn-name").value.trim();
    if (!name) return toast("El nombre es requerido", false);
    
    const newCon = {
        id: 'con_' + Date.now(),
        name,
        phone: document.getElementById("cn-phone").value,
        specialty: document.getElementById("cn-spec").value,
        notes: document.getElementById("cn-notes").value,
        isBlacklisted: document.getElementById("cn-black").checked,
        payments: []
    };
    
    state.contractors.push(newCon);
    save();
    closeModal();
    renderContractors();
    toast("Contratista registrado ✓");
}

function deleteContractor(id) {
    if (!confirm("¿Eliminar este contratista? Se perderá su historial de pagos.")) return;
    state.contractors = state.contractors.filter(c => c.id !== id);
    save();
    renderContractors();
}

function toggleBlacklist(id) {
    const con = state.contractors.find(c => c.id === id);
    if (con) {
        con.isBlacklisted = !con.isBlacklisted;
        save();
        renderContractors();
    }
}

function showPaymentModal(conId) {
    const con = state.contractors.find(c => c.id === conId);
    if (!con) return;

    let payRows = (con.payments || []).map((p, idx) => `
        <div style="display:grid; grid-template-columns:1fr 1fr 40px; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid var(--bor)">
            <div style="font-size:0.85rem">${p.date} - ${p.note}</div>
            <div style="font-weight:700; text-align:right">₲ ${fmt(p.amount)}</div>
            <button class="delbtn" onclick="deletePayment('${conId}', ${idx})">✕</button>
        </div>
    `).join("");

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:450px">
        <div class="modal-title">Pagos: ${con.name}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="max-height:200px; overflow-y:auto; margin-bottom:16px">
            ${payRows || '<p style="color:var(--tx3); text-align:center">Sin pagos registrados.</p>'}
        </div>
        <div style="background:rgba(var(--acc-rgb), 0.05); padding:12px; border-radius:var(--rad); display:flex; flex-direction:column; gap:8px">
            <strong>Registrar Nuevo Pago</strong>
            <div style="display:flex; gap:8px">
                <input id="pay-amt" type="number" placeholder="Monto ₲" style="flex:1">
                <input id="pay-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:130px">
            </div>
            <input id="pay-note" placeholder="Concepto (ej. Adelanto, Certificación 1)">
            <button class="btn primary" onclick="addPayment('${conId}')">Confirmar Pago 💸</button>
        </div>
    </div></div>`;
}

function addPayment(conId) {
    const amt = parseFloat(document.getElementById("pay-amt").value);
    const date = document.getElementById("pay-date").value;
    const note = document.getElementById("pay-note").value || "Pago a cuenta";
    
    if (!amt || isNaN(amt)) return toast("Monto inválido", false);
    
    const con = state.contractors.find(c => c.id === conId);
    if (con) {
        if (!con.payments) con.payments = [];
        con.payments.push({ amount: amt, date, note, id: Date.now() });
        save();
        showPaymentModal(conId);
        renderContractors();
        toast("Pago registrado ✓");
    }
}

function deletePayment(conId, idx) {
    const con = state.contractors.find(c => c.id === conId);
    if (con && con.payments) {
        con.payments.splice(idx, 1);
        save();
        showPaymentModal(conId);
        renderContractors();
    }
}

function showAssignItemsModal(conId) {
    const con = state.contractors.find(c => c.id === conId);
    if (!con) return;

    let itemsHtml = state.items.map(item => {
        const isAssigned = state.schedules[item.id]?.contractorId === conId;
        const otherCon = state.contractors.find(c => c.id === state.schedules[item.id]?.contractorId);
        
        return `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--bor)">
            <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="assignItemToContractor('${item.id}', this.checked ? '${conId}' : null)">
            <div style="flex:1">
                <div style="font-size:0.9rem; font-weight:600">${item.name}</div>
                <div style="font-size:0.75rem; color:var(--tx3)">MO: ₲ ${fmt(item.laborCost * item.qty)} ${otherCon && !isAssigned ? `(Asignado a: ${otherCon.name})` : ''}</div>
            </div>
        </div>`;
    }).join("");

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px">
        <div class="modal-title">Asignar Rubros a ${con.name}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="max-height:400px; overflow-y:auto">
            ${itemsHtml}
        </div>
        <div class="modal-acts">
            <button class="btn primary" onclick="closeModal(); renderContractors()">Listo ✓</button>
        </div>
    </div></div>`;
}

function assignItemToContractor(itemId, conId) {
    if (!state.schedules[itemId]) {
        state.schedules[itemId] = { status: 'pending', start: '', end: '', contractorId: null };
    }
    state.schedules[itemId].contractorId = conId;
    save();
}
