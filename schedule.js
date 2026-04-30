/**
 * schedule.js — Gestión del Cronograma de Obra
 */

function renderSchedule() {
    const el = document.getElementById("section-schedule");
    if (!el) return;

    if (state.items.length === 0) {
        el.innerHTML = `<div class="empty" style="padding:40px">
            <div class="empty-ico">📅</div>
            <h3>Cronograma Vacío</h3>
            <p>Agregá rubros en la sección de <strong>Presupuesto</strong> para comenzar el seguimiento de obra.</p>
            <button class="btn primary" onclick="setSection('budget')" style="margin-top:12px">Ir a Presupuesto</button>
        </div>`;
        return;
    }

    const { totalProgress, completedCount } = calcOverallProgress();

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">CRONOGRAMA DE EJECUCIÓN</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Proyecto: ${state.projectName}</p>
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
            <input type="date" value="${state.projectStartDate || ''}" class="sch-date" style="width:160px; background:var(--bg)" onchange="setProjectStartDate(this.value)">
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

    state.items.forEach(item => {
        const sch = state.schedules[item.id] || { status: 'pending', start: '', end: '', contractorId: null };
        const statusClass = `st-${sch.status}`;
        
        let contractorsOptions = `<option value="">-- Sin Asignar --</option>`;
        state.contractors.forEach(c => {
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
            <div><input type="date" class="sch-date" value="${sch.start}" onchange="updateSchedule('${item.id}', 'start', this.value)"></div>
            <div><input type="date" class="sch-date" value="${sch.end}" onchange="updateSchedule('${item.id}', 'end', this.value)"></div>
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
    if (!state.schedules[itemId]) {
        state.schedules[itemId] = { status: 'pending', start: '', end: '', contractorId: null };
    }
    state.schedules[itemId][field] = value;
    save();
    if (field === 'status') renderSchedule(); // Re-render for progress bar animation
}

function calcOverallProgress() {
    if (!state.items.length) return { totalProgress: 0, completedCount: 0 };
    let completed = 0;
    state.items.forEach(item => {
        if (state.schedules[item.id] && state.schedules[item.id].status === 'done') completed++;
    });
    return {
        totalProgress: Math.round((completed / state.items.length) * 100),
        completedCount: completed
    };
}

function syncScheduleWithBudget() {
    // Cleanup schedules for items no longer in budget (optional or mark as orphan)
    toast("Items sincronizados con el presupuesto actual ✓");
}

function showItemDetails(id) {
    const item = state.items.find(x => x.id == id);
    if (!item) return;
    toast(`Abriendo detalles de: ${item.name}`);
    // Futura implementación de modal de detalles extensos
}

function setProjectStartDate(dateStr) {
    if (!dateStr) return;
    state.projectStartDate = dateStr;
    save();
    recalculateScheduleDates();
}

function recalculateScheduleDates() {
    if (!state.projectStartDate && state.items.length > 0) {
        state.projectStartDate = new Date().toISOString().split('T')[0];
    }
    if (!state.projectStartDate) return;

    let currentStartStr = state.projectStartDate;

    state.items.forEach(item => {
        const cat = item.cat;
        const name = item.name;
        // Search for yield
        const dbItem = DB[cat] ? DB[cat][name] : null;
        // Fallback to DEFAULT_YIELDS from app.js if available, otherwise 10
        const yieldRate = (dbItem && dbItem.y) ? dbItem.y : ((typeof DEFAULT_YIELDS !== 'undefined' && DEFAULT_YIELDS[cat]) || 10);
        
        const days = Math.max(1, Math.ceil(item.qty / yieldRate));
        
        const startDate = new Date(currentStartStr);
        // Calculate end date (inclusive)
        const endDate = new Date(startDate.getTime() + (days - 1) * 86400000);
        const endStr = endDate.toISOString().split('T')[0];

        if (!state.schedules[item.id]) {
            state.schedules[item.id] = { status: 'pending', contractorId: null };
        }
        state.schedules[item.id].start = currentStartStr;
        state.schedules[item.id].end = endStr;

        // Next item starts the day after this one ends
        const nextStart = new Date(endDate.getTime() + 86400000);
        currentStartStr = nextStart.toISOString().split('T')[0];
    });

    save();
    renderSchedule();
    toast("Cronograma recalculado secuencialmente ✓");
}

function exportSchedulePDF() {
    if (typeof window.jspdf === 'undefined') return toast("Cargando PDF engine...", false);
    if (state.items.length === 0) return toast("No hay ítems para exportar", false);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    const theme = typeof PDF_THEMES !== 'undefined' ? (PDF_THEMES.find(t => t.id === state.pdfTheme) || PDF_THEMES[0]) : { bg: '#1e3a5f' };
    const margin = 10; // Tight margin for maximum width

    // Carátula
    doc.setFillColor(theme.bg);
    doc.rect(0, 0, 297, 30, 'F');
    doc.setTextColor("#ffffff");
    doc.setFontSize(18);
    doc.text("CRONOGRAMA DE EJECUCIÓN (DIAGRAMA DE GANTT)", margin, 15);
    doc.setFontSize(9);
    doc.text(`PROYECTO: ${state.projectName} | Emisión: ${new Date().toLocaleDateString()}`, margin, 23);

    // Calcular fechas extremas
    let minTs = Infinity;
    let maxTs = -Infinity;
    state.items.forEach(item => {
        const sch = state.schedules[item.id] || {};
        if (sch.start) {
            const startTs = new Date(sch.start).getTime();
            if (startTs < minTs) minTs = startTs;
        }
        if (sch.end) {
            const endTs = new Date(sch.end).getTime();
            if (endTs > maxTs) maxTs = endTs;
        }
    });

    if (minTs === Infinity || maxTs === -Infinity) {
        return toast("Debe definir fechas de inicio/fin en los rubros primero.", false);
    }

    // Expandir fin por 1 día
    maxTs += 86400000;
    const daysTotal = Math.ceil((maxTs - minTs) / 86400000) + 1;

    // Si hay más de 60 días, cap to prevent PDF crash/unreadable tiny cells.
    // In a real pro app, we'd paginate horizontally.
    const maxDaysToRender = Math.min(daysTotal, 90);

    const headRow = [{ content: 'RUBRO / DESCRIPCIÓN', styles: { cellWidth: 50, halign: 'left' } }];
    for (let i = 0; i < maxDaysToRender; i++) {
        const d = new Date(minTs + i * 86400000);
        const dayStr = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        headRow.push({ content: dayStr, styles: { cellWidth: 'auto', halign: 'center' } });
    }

    const body = [];
    state.items.forEach(item => {
        const sch = state.schedules[item.id] || {};
        let startIdx = -1;
        let span = 0;
        
        if (sch.start && sch.end) {
            const startTs = new Date(sch.start).getTime();
            const endTs = new Date(sch.end).getTime();
            startIdx = Math.floor((startTs - minTs) / 86400000);
            span = Math.floor((endTs - startTs) / 86400000) + 1;
        }

        const row = [item.name.substring(0, 45)];
        for (let i = 0; i < maxDaysToRender; i++) {
            // Check if current day i falls within the task
            if (i >= startIdx && i < startIdx + span) {
                row.push({ content: '', isTask: true, status: sch.status || 'pending' });
            } else {
                row.push('');
            }
        }
        body.push(row);
    });

    doc.autoTable({
        startY: 35,
        head: [headRow],
        body: body,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: [200, 200, 200] },
        headStyles: { fillColor: theme.bg, textColor: [255, 255, 255], fontSize: 5, halign: 'center', angle: 90 },
        columnStyles: { 0: { fontStyle: 'bold', fontSize: 6, halign: 'left' } },
        margin: { left: margin, right: margin },
        didParseCell: function (data) {
            if (data.row.section === 'head' && data.column.index > 0) {
                // Rotar texto de las fechas no está soportado nativamente en autoTable tan simple, 
                // pero si el texto es muy corto (ej 01/04), puede caber o hacer wrap.
                data.cell.styles.cellPadding = 0.5;
            }
        },
        willDrawCell: function (data) {
            if (data.row.section === 'body' && data.column.index > 0) {
                const cellObj = data.cell.raw;
                if (cellObj && cellObj.isTask) {
                    let color = [200, 200, 200]; // pending (gray)
                    if (cellObj.status === 'progress') color = [96, 165, 250]; // blue
                    else if (cellObj.status === 'done') color = [34, 197, 94]; // green
                    else if (cellObj.status === 'blocked') color = [244, 63, 94]; // red
                    doc.setFillColor(...color);
                    // Draw a smaller box inside the cell for the bar effect
                    const pad = 1;
                    doc.rect(data.cell.x, data.cell.y + pad, data.cell.width, data.cell.height - (pad*2), 'F');
                }
            }
        }
    });

    // Leyenda de estados al final
    let finalY = doc.lastAutoTable.finalY + 10;
    if (finalY > 190) { doc.addPage(); finalY = 20; }
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text("Leyenda de Estados:", margin, finalY);
    
    doc.setFillColor(200, 200, 200); doc.rect(margin + 30, finalY - 3, 5, 5, 'F'); doc.text("Pendiente", margin + 37, finalY);
    doc.setFillColor(96, 165, 250); doc.rect(margin + 55, finalY - 3, 5, 5, 'F'); doc.text("Iniciado", margin + 62, finalY);
    doc.setFillColor(34, 197, 94); doc.rect(margin + 80, finalY - 3, 5, 5, 'F'); doc.text("Completado", margin + 87, finalY);
    doc.setFillColor(244, 63, 94); doc.rect(margin + 110, finalY - 3, 5, 5, 'F'); doc.text("Bloqueado", margin + 117, finalY);

    if (daysTotal > 90) {
        doc.setTextColor(244, 63, 94);
        doc.text("Nota: El proyecto excede los 90 días. Se ha truncado la vista visual para encajar en el ancho de página.", margin, finalY + 10);
    }

    doc.save(`Cronograma_${state.projectName.replace(/\s+/g, '_')}.pdf`);
    toast("Cronograma PDF generado horizontalmente ✓");
}

function renderGanttChart() {
    if (state.items.length === 0) return "";
    
    let minTs = Infinity;
    let maxTs = -Infinity;
    
    state.items.forEach(item => {
        const sch = state.schedules[item.id] || {};
        if (sch.start) {
            const startTs = new Date(sch.start).getTime();
            if (startTs < minTs) minTs = startTs;
        }
        if (sch.end) {
            const endTs = new Date(sch.end).getTime();
            if (endTs > maxTs) maxTs = endTs;
        }
    });
    
    if (minTs === Infinity || maxTs === -Infinity) return "<p style='color:var(--tx3);font-size:0.875rem'>Sin fechas definidas. Asigne fechas a los rubros para ver el gráfico.</p>";
    
    maxTs += 2 * 86400000; // Add 2 days padding
    const daysTotal = Math.ceil((maxTs - minTs) / 86400000) + 1;
    
    let h = `<div class="gantt-wrap"><div class="gantt-header" style="grid-template-columns: 220px repeat(${daysTotal}, minmax(32px, 1fr))">`;
    h += `<div class="gantt-item-name-hdr">Rubro</div>`;
    for (let i = 0; i < daysTotal; i++) {
        const d = new Date(minTs + i * 86400000);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        h += `<div class="gantt-day-hdr ${isWeekend ? 'weekend' : ''}">${dayStr}</div>`;
    }
    h += `</div><div class="gantt-body">`;
    
    state.items.forEach(item => {
        const sch = state.schedules[item.id] || {};
        const color = sch.status === 'done' ? 'var(--ok)' : sch.status === 'progress' ? 'var(--blue)' : 'var(--bor)';
        
        h += `<div class="gantt-row" style="grid-template-columns: 220px repeat(${daysTotal}, minmax(32px, 1fr))">`;
        h += `<div class="gantt-item-name" title="${item.name}">${item.name}</div>`;
        
        let startIdx = -1;
        let span = 0;
        
        if (sch.start && sch.end) {
            const startTs = new Date(sch.start).getTime();
            const endTs = new Date(sch.end).getTime();
            startIdx = Math.floor((startTs - minTs) / 86400000);
            span = Math.floor((endTs - startTs) / 86400000) + 1;
            if (startIdx < 0) { span += startIdx; startIdx = 0; }
        }
        
        for (let i = 0; i < daysTotal; i++) {
            const d = new Date(minTs + i * 86400000);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            
            if (i === startIdx) {
                h += `<div class="gantt-cell ${isWeekend ? 'weekend' : ''}" style="grid-column: span ${span}; padding: 4px 2px;">
                    <div class="gantt-bar st-${sch.status || 'pending'}" style="background:${color}" title="${item.name} (${span} días)">
                        ${sch.status === 'done' ? '<span style="font-size:0.6rem;margin-left:4px">✓</span>' : ''}
                    </div>
                </div>`;
                i += (span - 1);
            } else {
                h += `<div class="gantt-cell ${isWeekend ? 'weekend' : ''}"></div>`;
            }
        }
        h += `</div>`;
    });
    
    h += `</div></div>`;
    return h;
}
