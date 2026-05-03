/**
 * schedule.js — Gestión del Cronograma de Obra
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

        <div style="background:rgba(var(--tx-rgb), 0.05); height:8px; border-radius:99px; margin-bottom:15px; overflow:hidden">
            <div style="background:var(--ok); height:100%; width:${totalProgress}%; transition:width 0.5s ease"></div>
        </div>

        <div class="card" style="margin-bottom:24px; padding:15px; display:flex; align-items:center; gap:15px; background:var(--sur2)">
            <div>
                <div style="font-weight:700; font-size:0.875rem; color:var(--tx2)">Fecha de Inicio del Proyecto</div>
                <div style="font-size:0.75rem; color:var(--tx3)">Todas las fechas se recalcularán a partir de esta fecha.</div>
            </div>
            ${dateInputPY('proj-start-date', p.execution.projectStartDate || '', "setProjectStartDate(this.value)", "width:160px")}
            <button class="btn sm" onclick="recalculateScheduleDates()" title="Recalcular todas las fechas secuencialmente a partir del inicio" style="margin-left:auto">🔄 Recalcular Todo</button>
        </div>

        <div class="card" style="margin-bottom:24px; padding:0; overflow:hidden">
            <div style="padding:15px; border-bottom:1px solid var(--bor); background:var(--sur2)">
                <h4 style="font-size:0.875rem; text-transform:uppercase; color:var(--tx); font-weight:700; margin:0">Vista de Gantt (Timeline)</h4>
                <p style="font-size:0.8rem; color:var(--tx3); margin-top:4px">Visualización del cronograma en el tiempo.</p>
            </div>
            <div style="padding:15px; overflow-x:auto; background:var(--sur)">
                ${renderGanttChart()}
            </div>
        </div>

        <div class="sch-card" style="border:none; box-shadow:0 2px 12px rgba(0,0,0,0.05)">
            <div class="sch-row hdr" style="background:var(--sur2); border-bottom:2px solid var(--bor)">
                <div>Descripción del Rubro</div>
                <div>Estado</div>
                <div>Inicio Est.</div>
                <div>Fin Est.</div>
                <div>Contratista</div>
            </div>`;

    adenda.items.forEach(item => {
        const sch = schedules[item.id] || { status: 'pending', start: '', end: '', contractorId: null };
        const statusClass = `st-${sch.status}`;
        
        let contractorsOptions = `<option value="">-- Sin Asignar --</option>`;
        (state.contractors || []).forEach(c => {
            contractorsOptions += `<option value="${c.id}" ${sch.contractorId === c.id ? 'selected' : ''}>${c.name}</option>`;
        });

        h += `<div class="sch-row" style="background:var(--sur); transition:background 0.2s">
            <div>
                <div style="font-weight:700; color:var(--tx); font-size:0.95rem">${item.name}</div>
                <div style="font-size:0.8rem; color:var(--tx3); margin-top:2px">${item.cat} · <span style="color:var(--tx2); font-weight:600">${item.qty} ${item.unit}</span></div>
            </div>
            <div>
                <select class="st-badge ${statusClass}" style="border:1px solid transparent; cursor:pointer; width:100%; outline:none" onchange="updateSchedule('${item.id}', 'status', this.value)">
                    <option value="pending" ${sch.status === 'pending' ? 'selected' : ''}>⏳ Pendiente</option>
                    <option value="progress" ${sch.status === 'progress' ? 'selected' : ''}>🏗️ Iniciado</option>
                    <option value="blocked" ${sch.status === 'blocked' ? 'selected' : ''}>⚠️ Bloqueado</option>
                    <option value="done" ${sch.status === 'done' ? 'selected' : ''}>✅ Completado</option>
                </select>
            </div>
            <div>${dateInputPY('sch-start-' + item.id, sch.start || '', "updateSchedule('" + item.id + "', 'start', this.value)", "width:100%")}</div>
            <div>${dateInputPY('sch-end-' + item.id, sch.end || '', "updateSchedule('" + item.id + "', 'end', this.value)", "width:100%")}</div>
            <div>
                <select class="sch-contractor" onchange="updateSchedule('${item.id}', 'contractorId', this.value)">
                    ${contractorsOptions}
                </select>
            </div>
        </div>`;
    });

    h += `</div>
        <div style="display:flex; gap:10px; margin-top:12px">
            <button class="btn sm" onclick="exportSchedulePDF()">📄 Exportar Cronograma</button>
            <button class="btn sm" onclick="syncScheduleWithBudget()">🔄 Sincronizar Items</button>
        </div>
    </div>`;

    el.innerHTML = h;
}

function updateSchedule(itemId, field, value) {
    const p = getActiveProject();
    if (!p) return;
    if (!p.execution.schedules) p.execution.schedules = {};
    if (!p.execution.schedules[itemId]) {
        p.execution.schedules[itemId] = { status: 'pending', start: '', end: '', contractorId: null };
    }
    p.execution.schedules[itemId][field] = value;
    save();
    if (field === 'status') renderSchedule();
}

function syncScheduleWithBudget() {
    toast("Items sincronizados con el presupuesto actual ✓");
    renderSchedule();
}

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

    if (!p.execution.projectStartDate && adenda.items.length > 0) {
        p.execution.projectStartDate = todayISO();
    }
    if (!p.execution.projectStartDate) return;

    let currentStartStr = p.execution.projectStartDate;
    if (!p.execution.schedules) p.execution.schedules = {};

    adenda.items.forEach(item => {
        const cat = item.cat;
        const name = item.name;
        const dbItem = (typeof DB !== 'undefined' && DB[cat]) ? DB[cat][name] : null;
        const yieldRate = (dbItem && dbItem.y) ? dbItem.y : ((typeof DEFAULT_YIELDS !== 'undefined' && DEFAULT_YIELDS[cat]) || 10);
        
        const days = Math.max(1, Math.ceil(item.qty / yieldRate));
        const startDate = new Date(currentStartStr);
        const endDate = new Date(startDate.getTime() + (days - 1) * 86400000);
        const endStr = endDate.toISOString().split('T')[0];

        if (!p.execution.schedules[item.id]) {
            p.execution.schedules[item.id] = { status: 'pending', contractorId: null };
        }
        p.execution.schedules[item.id].start = currentStartStr;
        p.execution.schedules[item.id].end = endStr;

        const nextStart = new Date(endDate.getTime() + 86400000);
        currentStartStr = nextStart.toISOString().split('T')[0];
    });

    save();
    renderSchedule();
    toast("Cronograma recalculado ✓");
}

function renderGanttChart() {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda || adenda.items.length === 0) return "";
    
    let minTs = Infinity;
    let maxTs = -Infinity;
    const schedules = p.execution.schedules || {};
    
    adenda.items.forEach(item => {
        const sch = schedules[item.id] || {};
        if (sch.start) {
            const startTs = new Date(sch.start).getTime();
            if (startTs < minTs) minTs = startTs;
        }
        if (sch.end) {
            const endTs = new Date(sch.end).getTime();
            if (endTs > maxTs) maxTs = endTs;
        }
    });
    
    if (minTs === Infinity || maxTs === -Infinity) return "<p style='color:var(--tx3);font-size:0.875rem'>Sin fechas definidas.</p>";
    
    maxTs += 2 * 86400000;
    const daysTotal = Math.ceil((maxTs - minTs) / 86400000) + 1;
    
    let h = `<div class="gantt-wrap"><div class="gantt-header" style="grid-template-columns: 220px repeat(${daysTotal}, minmax(32px, 1fr))">`;
    h += `<div class="gantt-item-name-hdr">Rubro</div>`;
    for (let i = 0; i < daysTotal; i++) {
        const d = new Date(minTs + i * 86400000);
        h += `<div class="gantt-day-hdr">${String(d.getDate()).padStart(2, '0')}</div>`;
    }
    h += `</div><div class="gantt-body">`;
    
    adenda.items.forEach(item => {
        const sch = schedules[item.id] || {};
        const color = sch.status === 'done' ? 'var(--ok)' : sch.status === 'progress' ? 'var(--blue)' : 'var(--bor)';
        
        h += `<div class="gantt-row" style="grid-template-columns: 220px repeat(${daysTotal}, minmax(32px, 1fr))">`;
        h += `<div class="gantt-item-name">${item.name}</div>`;
        
        let startIdx = -1; let span = 0;
        if (sch.start && sch.end) {
            const startTs = new Date(sch.start).getTime();
            const endTs = new Date(sch.end).getTime();
            startIdx = Math.floor((startTs - minTs) / 86400000);
            span = Math.floor((endTs - startTs) / 86400000) + 1;
            if (startIdx < 0) { span += startIdx; startIdx = 0; }
            // Sanitización: evitar span <= 0 o que se desborde
            if (span <= 0) { startIdx = -1; span = 0; }
            if (startIdx >= daysTotal) { startIdx = -1; span = 0; }
            if (startIdx >= 0 && startIdx + span > daysTotal) span = daysTotal - startIdx;
        }

        for (let i = 0; i < daysTotal; i++) {
            if (i === startIdx && span > 0) {
                h += `<div class="gantt-cell" style="grid-column: span ${span}; padding: 4px 2px;">
                    <div class="gantt-bar st-${sch.status || 'pending'}" style="background:${color}"></div>
                </div>`;
                i += (span - 1);
            } else {
                h += `<div class="gantt-cell"></div>`;
            }
        }
        h += `</div>`;
    });
    
    return h + `</div></div>`;
}

function exportSchedulePDF() {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda) return toast("Sin proyecto activo", false);
    if (typeof window.jspdf === "undefined") return toast("jsPDF cargando, intentá en 2 segundos", false);

    toast("Generando Cronograma PDF...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CRONOGRAMA DE EJECUCIÓN", margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Proyecto: ${p.name}`, margin, y);
    y += 5;
    if (p.execution.projectStartDate) {
        doc.text(`Inicio: ${formatDatePY(p.execution.projectStartDate)}`, margin, y);
        y += 5;
    }
    const { totalProgress } = calcOverallProgress();
    doc.text(`Progreso global: ${totalProgress}%`, margin, y);
    y += 8;

    // Tabla de cronograma con autoTable
    const schedules = p.execution.schedules || {};
    const rows = adenda.items.map(item => {
        const sch = schedules[item.id] || {};
        const con = sch.contractorId ? (state.contractors || []).find(c => c.id === sch.contractorId) : null;
        const statusLabel = sch.status === 'done' ? 'Completado' : sch.status === 'progress' ? 'En curso' : sch.status === 'blocked' ? 'Bloqueado' : 'Pendiente';
        return [
            item.name,
            `${item.qty} ${item.unit}`,
            statusLabel,
            sch.start ? formatDatePY(sch.start) : '-',
            sch.end ? formatDatePY(sch.end) : '-',
            con ? con.name : '-'
        ];
    });

    if (doc.autoTable) {
        doc.autoTable({
            startY: y,
            head: [['Rubro', 'Cant.', 'Estado', 'Inicio', 'Fin', 'Contratista']],
            body: rows,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 41, 59], textColor: 255 },
            margin: { left: margin, right: margin }
        });
    } else {
        // Fallback simple sin autoTable
        rows.forEach(row => {
            doc.text(row.join(" | "), margin, y);
            y += 5;
            if (y > 280) { doc.addPage(); y = 20; }
        });
    }

    doc.save(`Cronograma_${(p.name || 'proyecto').replace(/\s+/g, '_')}.pdf`);
    toast("Cronograma PDF generado ✓");
}
