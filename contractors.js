/**
 * contractors.js — Gestión de Contratistas, Pagos y Contratos
 */

function renderContractors() {
    const el = document.getElementById("section-contractors");
    if (!el) return;
    const p = getActiveProject();
    const adenda = getActiveAdenda();

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">GESTIÓN DE CONTRATISTAS</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Directorio y Control de Pagos</p>
            </div>
            <button class="btn primary" onclick="showAddContractorModal()">+ Nuevo Contratista</button>
        </div>

        <div class="card" style="margin-bottom:18px; padding:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap">
            <span style="font-size:0.85rem; font-weight:700; color:var(--tx3)">Filtros:</span>
            <input id="con-filter-text" placeholder="Buscar por nombre o especialidad..." style="width:250px; font-size:0.85rem" oninput="renderContractors()">
            <select id="con-filter-ips" style="width:140px; font-size:0.85rem" onchange="renderContractors()">
                <option value="all">IPS: Todos</option>
                <option value="yes">Con IPS</option>
                <option value="no">Sin IPS</option>
            </select>
            <select id="con-filter-records" style="width:160px; font-size:0.85rem" onchange="renderContractors()">
                <option value="all">Antecedentes: Todos</option>
                <option value="clean">Sin Antecedentes</option>
                <option value="flagged">Con Antecedentes</option>
            </select>
            <select id="con-filter-blacklist" style="width:160px; font-size:0.85rem" onchange="renderContractors()">
                <option value="all">Lista Negra: Todos</option>
                <option value="hide">Ocultar Lista Negra</option>
                <option value="only">Solo Lista Negra</option>
            </select>
        </div>

        <div class="con-grid">`;

    const filterText = document.getElementById("con-filter-text")?.value.toLowerCase() || "";
    const filterIPS = document.getElementById("con-filter-ips")?.value || "all";
    const filterRecords = document.getElementById("con-filter-records")?.value || "all";
    const filterBlacklist = document.getElementById("con-filter-blacklist")?.value || "all";

    const filteredContractors = (state.contractors || []).filter(con => {
        const matchesText = con.name.toLowerCase().includes(filterText) || (con.specialty || "").toLowerCase().includes(filterText);
        const staff = con.staff || [];
        const hasStaffWithIPS = staff.some(s => s.hasIPS);
        const hasStaffWithRecords = staff.some(s => s.hasCriminalRecords);

        const matchesIPS = filterIPS === "all" || (filterIPS === "yes" && hasStaffWithIPS) || (filterIPS === "no" && !hasStaffWithIPS);
        const matchesRecords = filterRecords === "all" || (filterRecords === "clean" && !hasStaffWithRecords) || (filterRecords === "flagged" && hasStaffWithRecords);
        const matchesBlacklist = filterBlacklist === "all"
            || (filterBlacklist === "hide" && !con.isBlacklisted)
            || (filterBlacklist === "only" && con.isBlacklisted);

        return matchesText && matchesIPS && matchesRecords && matchesBlacklist;
    });

    if (filteredContractors.length === 0) {
        h += `<div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--sur); border-radius:var(--rad); border:1px dashed var(--bor)">
            <p style="color:var(--tx3)">No se encontraron contratistas.</p>
        </div>`;
    }

    filteredContractors.forEach(con => {
        let totalMO = 0;
        if (p && adenda) {
            const assignedItems = adenda.items.filter(item => p.execution.schedules[item.id]?.contractorId === con.id);
            totalMO = assignedItems.reduce((s, i) => s + (i.laborCost * i.qty), 0);
        }
        
        const totalPaid = (con.payments || []).reduce((s, pay) => s + pay.amount, 0);
        const balance = totalMO - totalPaid;

        const phoneClean = (con.phone || '').replace(/[^\d+]/g, '');
        h += `<div class="con-card ${con.isBlacklisted ? 'blacklist' : ''}" ${con.isBlacklisted ? 'style="border-left:4px solid var(--err); background:rgba(248,113,113,0.05)"' : ''}>
            ${con.isBlacklisted ? '<div style="font-size:0.7rem; font-weight:800; color:var(--err); text-transform:uppercase; margin-bottom:4px">🚨 Lista Negra</div>' : ''}
            <div class="con-name">${con.name}</div>
            <div class="con-meta">
                <span>📱 ${con.phone || 'S/T'}</span>
                <span>🔨 ${con.specialty || 'Gral'}</span>
            </div>
            ${con.phone ? `<div style="display:flex; gap:6px; margin-top:8px">
                <a href="tel:${phoneClean}" class="btn sm" style="flex:1; background:var(--blue); color:white; border:none; text-decoration:none; text-align:center">📞 Llamar</a>
                <a href="${waLink(con.phone)}" target="_blank" class="btn sm" style="flex:1; background:#25D366; color:white; border:none; text-decoration:none; text-align:center">💬 WhatsApp</a>
            </div>` : ''}
            <div class="con-stats" style="margin-top:10px">
                <div class="stat-box">
                    <div class="stat-lbl">Mano de Obra</div>
                    <div class="stat-val">${fmt(totalMO)}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-lbl">Saldo</div>
                    <div class="stat-val" style="color:${balance > 0 ? 'var(--err)' : 'var(--ok)'}">${fmt(balance)}</div>
                </div>
            </div>
            <div style="margin-top:14px; display:flex; gap:6px; flex-wrap:wrap">
                <button class="btn sm" style="flex:1" onclick="showPaymentModal('${con.id}')">💸 Pagos</button>
                <button class="btn sm" style="flex:1" onclick="showAssignItemsModal('${con.id}')">🔗 Asignar</button>
                <button class="btn sm" style="flex:1" onclick="showStaffModal('${con.id}')">👥 (${(con.staff || []).length})</button>
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
            <input id="cn-name" placeholder="Nombre completo">
            <input id="cn-phone" placeholder="Teléfono">
            <input id="cn-spec" placeholder="Especialidad">
            <textarea id="cn-notes" placeholder="Notas..."></textarea>
            <label><input type="checkbox" id="cn-black"> 🚨 Lista Negra</label>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="addContractor()">Guardar</button>
        </div>
    </div></div>`;
}

function addContractor() {
    const name = document.getElementById("cn-name").value.trim();
    if (!name) return toast("Nombre requerido", false);
    const newCon = {
        id: 'con_' + Date.now(),
        name,
        phone: document.getElementById("cn-phone").value,
        specialty: document.getElementById("cn-spec").value,
        notes: document.getElementById("cn-notes").value,
        isBlacklisted: document.getElementById("cn-black").checked,
        payments: [], staff: []
    };
    if (!state.contractors) state.contractors = [];
    state.contractors.push(newCon);
    save(); closeModal(); renderContractors();
    toast("Contratista registrado ✓");
}

function deleteContractor(id) {
    if (!confirm("¿Eliminar este contratista?")) return;
    state.contractors = state.contractors.filter(c => c.id !== id);
    (state.projects || []).forEach(function (p) {
        if (p.execution && p.execution.schedules) {
            Object.keys(p.execution.schedules).forEach(function (k) {
                if (p.execution.schedules[k].contractorId === id) {
                    delete p.execution.schedules[k].contractorId;
                }
            });
        }
    });
    save(); renderContractors();
}

function showPaymentModal(conId) {
    const con = state.contractors.find(c => c.id === conId);
    if (!con) return;
    let payRows = (con.payments || []).map((p, idx) => `
        <div style="display:grid; grid-template-columns:1fr 1fr 40px; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid var(--bor)">
            <div>${formatDatePY(p.date)} - ${p.note}</div>
            <div style="font-weight:700; text-align:right">${fmt(p.amount)}</div>
            <button class="delbtn" onclick="deletePayment('${conId}', ${idx})">✕</button>
        </div>`).join("");

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:450px">
        <div class="modal-title">Pagos: ${con.name}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="max-height:200px; overflow-y:auto; margin-bottom:16px">${payRows || 'Sin pagos.'}</div>
        <div style="background:rgba(var(--acc-rgb), 0.05); padding:12px; border-radius:var(--rad)">
            <strong>Registrar Pago</strong>
            <input id="pay-amt" type="number" placeholder="Monto ₲" style="width:100%; margin:8px 0">
            ${dateInputPY('pay-date', todayISO(), '', 'width:100%; margin-bottom:8px')}
            <input id="pay-note" placeholder="Concepto" style="width:100%; margin-bottom:8px">
            <button class="btn primary full" onclick="addPayment('${conId}')">Confirmar Pago 💸</button>
        </div>
    </div></div>`;
}

function addPayment(conId) {
    const amt = parseFloat(document.getElementById("pay-amt").value);
    const date = document.getElementById("pay-date").value;
    const note = document.getElementById("pay-note").value || "Pago a cuenta";
    if (!amt) return toast("Monto inválido", false);
    const con = state.contractors.find(c => c.id === conId);
    if (con) {
        if (!con.payments) con.payments = [];
        con.payments.push({ amount: amt, date, note, id: Date.now() });
        // Integración Contratistas → Finanzas: registrar como egreso automático
        const proj = getActiveProject();
        if (proj && proj.execution) {
            if (!proj.execution.finances) proj.execution.finances = { income: [], expenses: [] };
            proj.execution.finances.expenses.push({
                id: Date.now() + 1,
                amount: amt,
                date: date,
                note: "Pago a contratista: " + con.name + " - " + note
            });
        }
        save(); showPaymentModal(conId); renderContractors();
        toast("Pago registrado ✓");
    }
}

function deletePayment(conId, idx) {
    const con = state.contractors.find(c => c.id === conId);
    if (con) {
        const removed = con.payments.splice(idx, 1)[0];
        if (removed) {
            const proj = getActiveProject();
            if (proj && proj.execution && proj.execution.finances) {
                proj.execution.finances.expenses = proj.execution.finances.expenses.filter(function (e) {
                    return !(e.amount === removed.amount && e.date === removed.date && e.note && e.note.indexOf("Pago a contratista: " + con.name) === 0);
                });
            }
        }
        save(); showPaymentModal(conId); renderContractors();
    }
}

function showAssignItemsModal(conId) {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda) return toast("Seleccioná un proyecto", false);
    const con = state.contractors.find(c => c.id === conId);

    let itemsHtml = adenda.items.map(item => {
        const isAssigned = p.execution.schedules[item.id]?.contractorId === conId;
        return `<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--bor)">
            <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="assignItemToContractor('${item.id}', this.checked ? '${conId}' : null)">
            <div style="flex:1; min-width:0">
                <div style="font-size:0.9rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(item.name)}</div>
                <div style="font-size:0.75rem; color:var(--tx3)">MO: ${fmt(item.laborCost * item.qty)}</div>
            </div>
        </div>`;
    }).join("");

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px">
        <div class="modal-title">Asignar a ${escapeHtml(con.name)}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="max-height:400px; overflow-y:auto; padding:0">${itemsHtml}</div>
        <div class="modal-acts"><button class="btn primary" onclick="closeModal(); renderContractors()">Listo ✓</button></div>
    </div></div>`;
}

function assignItemToContractor(itemId, conId) {
    const p = getActiveProject();
    if (!p) return;
    if (!p.execution.schedules) p.execution.schedules = {};
    if (!p.execution.schedules[itemId]) p.execution.schedules[itemId] = { status: 'pending', start: '', end: '', contractorId: null };
    p.execution.schedules[itemId].contractorId = conId;
    save();
}

function showStaffModal(conId) {
    const con = state.contractors.find(c => c.id === conId);
    if (!con) return;
    if (!con.staff) con.staff = [];
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:600px">
        <div class="modal-title">Personal de ${con.name}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div id="staff-list-container" style="max-height:300px; overflow-y:auto; margin-bottom:20px">${renderStaffList(conId)}</div>
        <div style="background:var(--sur2); padding:15px; border-radius:var(--rad)">
            <input id="st-name" placeholder="Nombre" style="width:48%; margin-right:2%">
            <input id="st-surname" placeholder="Apellido" style="width:48%"><br>
            <input id="st-id" placeholder="Cédula" style="width:100%; margin:8px 0">
            <label><input type="checkbox" id="st-ips"> IPS</label>
            <label style="margin-left:15px"><input type="checkbox" id="st-records"> Antecedentes</label>
            <button class="btn primary full" style="margin-top:10px" onclick="addStaffMember('${conId}')">Agregar ✓</button>
        </div>
    </div></div>`;
}

function renderStaffList(conId) {
    const con = state.contractors.find(c => c.id === conId);
    if (!con || !con.staff || con.staff.length === 0) return `<p style="text-align:center; padding:20px">Sin personal.</p>`;
    return `<table class="tbl sm">
        <thead><tr><th>Nombre</th><th>Cédula</th><th>IPS</th><th>Ant.</th><th></th></tr></thead>
        <tbody>${con.staff.map((s, idx) => `<tr>
            <td>${s.name} ${s.surname}</td><td>${s.idNumber}</td>
            <td>${s.hasIPS ? '✅' : '❌'}</td><td>${s.hasCriminalRecords ? '⚠️' : '✅'}</td>
            <td><button class="delbtn sm" onclick="deleteStaffMember('${conId}', ${idx})">✕</button></td>
        </tr>`).join("")}</tbody></table>`;
}

function addStaffMember(conId) {
    const name = document.getElementById("st-name").value;
    const surname = document.getElementById("st-surname").value;
    const idNumber = document.getElementById("st-id").value;
    const hasIPS = document.getElementById("st-ips").checked;
    const hasCriminalRecords = document.getElementById("st-records").checked;
    const con = state.contractors.find(c => c.id === conId);
    if (con) {
        con.staff.push({ name, surname, idNumber, hasIPS, hasCriminalRecords });
        save(); document.getElementById("staff-list-container").innerHTML = renderStaffList(conId);
        renderContractors(); toast("Personal agregado ✓");
    }
}

function deleteStaffMember(conId, idx) {
    const con = state.contractors.find(c => c.id === conId);
    if (con) { con.staff.splice(idx, 1); save(); document.getElementById("staff-list-container").innerHTML = renderStaffList(conId); renderContractors(); }
}
