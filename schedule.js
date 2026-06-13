/**
 * schedule.js — Gestión del Cronograma de Obra y Modos de Ejecución
 */

function renderSchedule() {
    const el = document.getElementById("section-schedule");
    if (!el) return;
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda || adenda.items.length === 0) {
        el.innerHTML = `<div class="empty" style="padding:40px">
            <div class="empty-ico">📅</div>
            <h3>Cronograma Vacío</h3>
            <p>Agregá rubros en la sección de <strong>Presupuesto</strong> para comenzar el seguimiento de obra.</p>
            <button class="btn primary" onclick="setSection('budget')" style="margin-top:12px">Ir a Presupuesto</button>
        </div>`;
        return;
    }

    const { totalProgress } = calcOverallProgress();
    const schedules = p.execution.schedules || {};

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">CRONOGRAMA DE EJECUCIÓN</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Proyecto: <strong>${p.name}</strong></p>
            </div>
            <div style="text-align:right">
                <div style="font-size:1.2rem; font-weight:800; color:var(--ok)">${totalProgress}%</div>
                <div style="font-size:0.75rem; color:var(--tx3); text-transform:uppercase">Progreso Total</div>
            </div>
        </div>

        <div class="card" style="margin-bottom:24px; padding:15px; display:flex; align-items:center; gap:15px; background:var(--sur2)">
            ${dateInputPY('proj-start-date', p.execution.projectStartDate || '', "setProjectStartDate(this.value)", "width:160px")}
            <div style="flex:1">
                <div style="font-weight:700; font-size:0.875rem; color:var(--tx2)">Inicio del Proyecto</div>
                <div style="font-size:0.75rem; color:var(--tx3)">Recalcular fechas secuenciales.</div>
            </div>
            <button class="btn sm" onclick="recalculateScheduleDates()">🔄 Recalcular Todo</button>
        </div>

        <div class="card" style="margin-bottom:24px; padding:0; overflow:hidden">
            <div style="padding:15px; overflow-x:auto; background:var(--sur)">
                ${renderGanttChart()}
            </div>
        </div>

        <div class="sch-card" style="border:none">
            <div class="sch-row hdr" style="grid-template-columns: 1.5fr 1fr 1fr 1fr 1.5fr">
                <div>Rubro</div>
                <div>Estado</div>
                <div>Inicio</div>
                <div>Fin</div>
                <div>Ejecución / Responsable</div>
            </div>`;

    adenda.items.forEach(item => {
        const sch = schedules[item.id] || { status: 'pending', start: '', end: '', contractorId: null, executionMode: 'contractor' };
        const statusClass = `st-${sch.status}`;
        
        let execSelect = `<select class="sch-contractor" onchange="updateSchedule('${item.id}', 'executionMode', this.value)">
            <option value="contractor" ${sch.executionMode === 'contractor' ? 'selected' : ''}>👷 Contratista</option>
            <option value="own_team" ${sch.executionMode === 'own_team' ? 'selected' : ''}>🏗️ Equipo Propio</option>
            <option value="day_workers" ${sch.executionMode === 'day_workers' ? 'selected' : ''}>👤 Jornaleros</option>
        </select>`;

        let assignedTo = '';
        if (sch.executionMode === 'contractor') {
            assignedTo = `<select class="sch-contractor" style="margin-top:4px" onchange="updateSchedule('${item.id}', 'contractorId', this.value)">
                <option value="">-- Sin Contratista --</option>
                ${(state.contractors || []).map(c => `<option value="${c.id}" ${sch.contractorId === c.id ? 'selected' : ''}>${c.name}</option>`).join("")}
            </select>`;
        } else {
            assignedTo = `<button class="btn sm full" style="margin-top:4px" onclick="showAssignPersonnelModal('${item.id}')">👥 Asignar Personal</button>`;
        }

        h += `<div class="sch-row" style="grid-template-columns: 1.5fr 1fr 1fr 1fr 1.5fr">
            <div>
                <div style="font-weight:700; font-size:0.9rem">${item.name}</div>
                <div style="font-size:0.75rem; color:var(--tx3)">${item.qty} ${item.unit}</div>
            </div>
            <div>
                <select class="st-badge ${statusClass}" onchange="updateSchedule('${item.id}', 'status', this.value)">
                    <option value="pending" ${sch.status === 'pending' ? 'selected' : ''}>⏳ Pendiente</option>
                    <option value="progress" ${sch.status === 'progress' ? 'selected' : ''}>🏗️ Iniciado</option>
                    <option value="blocked" ${sch.status === 'blocked' ? 'selected' : ''}>⚠️ Bloqueado</option>
                    <option value="done" ${sch.status === 'done' ? 'selected' : ''}>✅ Completado</option>
                </select>
            </div>
            <div>${dateInputPY('sch-start-' + item.id, sch.start || '', "updateSchedule('" + item.id + "', 'start', this.value)", "width:100%")}</div>
            <div>${dateInputPY('sch-end-' + item.id, sch.end || '', "updateSchedule('" + item.id + "', 'end', this.value)", "width:100%")}</div>
            <div>
                ${execSelect}
                ${assignedTo}
            </div>
        </div>`;
    });

    h += `</div></div>`;
    el.innerHTML = h;
}

function updateSchedule(itemId, field, value) {
    const p = getActiveProject();
    if (!p) return;
    if (!p.execution.schedules) p.execution.schedules = {};
    if (!p.execution.schedules[itemId]) p.execution.schedules[itemId] = { status: 'pending', start: '', end: '', contractorId: null, executionMode: 'contractor' };
    p.execution.schedules[itemId][field] = value;
    save();
    if (field === 'status' || field === 'executionMode') renderSchedule();
}

function showAssignPersonnelModal(itemId) {
    const p = getActiveProject();
    if (!p || !p.execution.schedules) { toast("Cronograma no disponible", false); return; }
    const sch = p.execution.schedules[itemId] || { executionMode: 'contractor', assignedStaff: [] };
    const isOwn = sch.executionMode === 'own_team';
    const list = isOwn ? state.ownTeam : p.execution.dayWorkers;
    if (!sch.assignedStaff) sch.assignedStaff = [];

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
        <div class="modal-title">Asignar ${isOwn ? 'Equipo Propio' : 'Jornaleros'}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="max-height:300px; overflow-y:auto; margin-bottom:15px">
            ${list.map(m => `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--bor)">
                    <input type="checkbox" ${sch.assignedStaff.includes(m.id) ? 'checked' : ''} onchange="toggleStaffAssignment('${itemId}', '${m.id}', this.checked)">
                    <div style="flex:1">
                        <div style="font-size:0.9rem; font-weight:600">${m.name} ${m.surname}</div>
                        <div style="font-size:0.75rem; color:var(--tx3)">${m.role} | Jornal: ${fmt(m.dailyRate)}</div>
                    </div>
                </div>
            `).join("") || '<div class="empty">No hay personal registrado en esta categoría.</div>'}
        </div>
        <div class="modal-acts"><button class="btn primary full" onclick="closeModal()">Listo ✓</button></div>
    </div></div>`;
}

function toggleStaffAssignment(itemId, staffId, checked) {
    const p = getActiveProject();
    const sch = p.execution.schedules[itemId];
    if (!sch.assignedStaff) sch.assignedStaff = [];
    if (checked) {
        if (!sch.assignedStaff.includes(staffId)) sch.assignedStaff.push(staffId);
    } else {
        sch.assignedStaff = sch.assignedStaff.filter(id => id !== staffId);
    }
    save();
}

// ... (Rest of existing Gantt and Helper functions from original schedule.js)
// NOTE: I'll preserve recalculateScheduleDates and renderGanttChart from original file
function setProjectStartDate(dateStr) {
    const p = getActiveProject();
    if (!p || !dateStr) return;
    p.execution.projectStartDate = dateStr;
    save();
    recalculateScheduleDates();
}

function recalculateScheduleDates() {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda) return;
    if (!p.execution.projectStartDate && adenda.items.length > 0) p.execution.projectStartDate = todayISO();
    if (!p.execution.projectStartDate) return;
    let currentStartStr = p.execution.projectStartDate;
    if (!p.execution.schedules) p.execution.schedules = {};
    adenda.items.forEach(item => {
        const days = 5; // Simplified for demo
        const startDate = new Date(currentStartStr);
        const endDate = new Date(startDate.getTime() + (days - 1) * 86400000);
        const endStr = endDate.toISOString().split('T')[0];
        if (!p.execution.schedules[item.id]) p.execution.schedules[item.id] = { status: 'pending' };
        p.execution.schedules[item.id].start = currentStartStr;
        p.execution.schedules[item.id].end = endStr;
        currentStartStr = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0];
    });
    save(); renderSchedule(); toast("Cronograma recalculado ✓");
}

function renderGanttChart() {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda || adenda.items.length === 0) return "";
    let minTs = Infinity; let maxTs = -Infinity;
    const schedules = p.execution.schedules || {};
    adenda.items.forEach(item => {
        const sch = schedules[item.id] || {};
        if (sch.start) minTs = Math.min(minTs, new Date(sch.start).getTime());
        if (sch.end) maxTs = Math.max(maxTs, new Date(sch.end).getTime());
    });
    if (minTs === Infinity || maxTs === -Infinity) return "<p style='color:var(--tx3);font-size:0.875rem'>Sin fechas definidas.</p>";
    maxTs += 2 * 86400000;
    const daysTotal = Math.ceil((maxTs - minTs) / 86400000) + 1;
    let h = `<div class="gantt-wrap"><div class="gantt-header" style="grid-template-columns: 200px repeat(${daysTotal}, minmax(32px, 1fr))"><div>Rubro</div>`;
    for (let i = 0; i < daysTotal; i++) h += `<div>${new Date(minTs + i * 86400000).getDate()}</div>`;
    h += `</div>`;
    adenda.items.forEach(item => {
        const sch = schedules[item.id] || {};
        const color = sch.status === 'done' ? 'var(--ok)' : sch.status === 'progress' ? 'var(--blue)' : 'var(--bor)';
        h += `<div class="gantt-row" style="grid-template-columns: 200px repeat(${daysTotal}, minmax(32px, 1fr))"><div>${item.name}</div>`;
        let startIdx = -1; let span = 0;
        if (sch.start && sch.end) {
            startIdx = Math.floor((new Date(sch.start).getTime() - minTs) / 86400000);
            span = Math.floor((new Date(sch.end).getTime() - new Date(sch.start).getTime()) / 86400000) + 1;
        }
        for (let i = 0; i < daysTotal; i++) {
            if (i === startIdx && span > 0) {
                h += `<div style="grid-column: span ${span}; padding: 4px;"><div style="background:${color}; height:8px; border-radius:4px"></div></div>`;
                i += (span - 1);
            } else h += `<div></div>`;
        }
        h += `</div>`;
    });
    return h + `</div>`;
}
