/**
 * schedule.js — Cronograma de Obra profesional con tabla detallada y Gantt
 */

function renderSchedule() {
    var el = document.getElementById("section-schedule");
    if (!el) return;
    var p = getActiveProject();
    var adenda = getActiveAdenda();
    if (!p || !adenda || !adenda.items || adenda.items.length === 0) {
        el.innerHTML = '<div class="empty" style="padding:40px">' +
            '<div class="empty-ico">📅</div><h3>Cronograma Vacío</h3>' +
            '<p>Agregá rubros en la sección de <strong>Presupuesto</strong> para comenzar.</p>' +
            '<button class="btn primary" onclick="setSection(\'budget\')" style="margin-top:12px">Ir a Presupuesto</button></div>';
        return;
    }

    var progress = calcOverallProgress();
    var totalProgress = progress.totalProgress || 0;
    var schedules = p.execution.schedules || {};

    // ── Cabecera ──────────────────────────────────────────────────────────
    var h = '<div class="prices-wrap">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">' +
        '<div><h2 style="font-family:var(--font-display);font-weight:800;margin-bottom:2px">📅 CRONOGRAMA DE OBRA</h2>' +
        '<p style="color:var(--tx3);font-size:0.85rem">Proyecto: <strong>' + escapeHtml(p.name) + '</strong></p></div>' +
        '<div style="text-align:right"><div style="font-size:1.3rem;font-weight:800;color:var(--ok)">' + totalProgress + '%</div>' +
        '<div style="font-size:0.7rem;color:var(--tx3);text-transform:uppercase">Avance General</div></div></div>';

    // ── Barra de control ──────────────────────────────────────────────────
    h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px 16px;background:var(--sur2);border-radius:var(--rad);flex-wrap:wrap">' +
        '<span style="font-weight:600;font-size:0.85rem;white-space:nowrap">📅 Inicio:</span>' +
        dateInputPY("proj-start-date", p.execution.projectStartDate || "", "setProjectStartDate(this.value)", "width:150px") +
        '<span style="font-size:0.8rem;color:var(--tx3);flex:1;min-width:120px">' + (adenda.items.length) + ' rubros · ' +
        Object.keys(schedules).filter(function (k) { return schedules[k].status === "done"; }).length + ' completados</span>' +
        '<button class="btn sm" onclick="recalculateScheduleDates()">🔄 Recalcular</button>' +
        '<button class="btn sm primary" onclick="exportScheduleCSV()">📊 Exportar CSV</button></div>';

    // ── Gantt Chart ──────────────────────────────────────────────────────
    h += '<div style="margin-bottom:20px;overflow-x:auto;border:1px solid var(--bor);border-radius:var(--rad);background:var(--sur);padding:4px">' +
        renderGanttChart() + '</div>';

    // ── Tabla detallada ───────────────────────────────────────────────────
    h += '<div style="overflow-x:auto;border:1px solid var(--bor);border-radius:var(--rad)">' +
        '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:900px">';

    // Cabecera
    var cols = [
        { label: "#", width: "36px", align: "center" },
        { label: "Rubro / Actividad", width: "auto", align: "left" },
        { label: "Cantidad", width: "80px", align: "center" },
        { label: "Inicio", width: "110px", align: "center" },
        { label: "Fin", width: "110px", align: "center" },
        { label: "Duración", width: "70px", align: "center" },
        { label: "Estado", width: "120px", align: "center" },
        { label: "Ejecución", width: "160px", align: "left" },
    ];

    h += '<thead><tr style="background:var(--sur2)">';
    for (var ci = 0; ci < cols.length; ci++) {
        h += '<th style="padding:10px 8px;border:1px solid var(--bor);text-align:' + cols[ci].align + ';font-weight:700;color:var(--tx2);text-transform:uppercase;font-size:0.7rem;' +
            (cols[ci].width !== "auto" ? "width:" + cols[ci].width + ";" : "") + '">' + cols[ci].label + '</th>';
    }
    h += '</tr></thead><tbody>';

    for (var idx = 0; idx < adenda.items.length; idx++) {
        var item = adenda.items[idx];
        var sch = schedules[item.id] || { status: "pending", start: "", end: "", contractorId: null, executionMode: "contractor", assignedStaff: [] };

        var startDate = sch.start ? parseDate(sch.start) : null;
        var endDate = sch.end ? parseDate(sch.end) : null;
        var duration = (startDate && endDate) ? Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1 : "-";

        var statusColors = { pending: "var(--tx3)", progress: "var(--blue)", blocked: "var(--err)", done: "var(--ok)" };
        var statusBg = { pending: "rgba(148,163,184,0.15)", progress: "rgba(56,132,255,0.15)", blocked: "rgba(239,68,68,0.15)", done: "rgba(34,197,94,0.15)" };
        var statusLabels = { pending: "⏳ Pendiente", progress: "🏗️ En Ejecución", blocked: "⚠️ Bloqueado", done: "✅ Finalizado" };
        var st = sch.status || "pending";

        var durationDays = duration !== "-" ? parseInt(duration) : 0;

        h += '<tr style="border-bottom:1px solid var(--bor)">' +
            // #
            '<td style="padding:8px 6px;border:1px solid var(--bor);text-align:center;vertical-align:middle;color:var(--tx3);font-size:0.75rem">' + (idx + 1) + '</td>' +
            // Rubro
            '<td style="padding:8px 10px;border:1px solid var(--bor);vertical-align:middle">' +
            '<div style="font-weight:600;font-size:0.85rem">' + escapeHtml(item.name) + '</div>' +
            '<div style="font-size:0.7rem;color:var(--tx3)">' + escapeHtml(item.unit) + '</div></td>' +
            // Cantidad
            '<td style="padding:8px 6px;border:1px solid var(--bor);text-align:center;vertical-align:middle;font-weight:600;font-size:0.8rem">' + fmtD(item.qty) + '</td>' +
            // Inicio
            '<td style="padding:6px 8px;border:1px solid var(--bor);text-align:center;vertical-align:middle">' +
            dateInputPY("sch-start-" + item.id, sch.start || "", "updateSchedule('" + item.id + "', 'start', this.value)", "width:100%") + '</td>' +
            // Fin
            '<td style="padding:6px 8px;border:1px solid var(--bor);text-align:center;vertical-align:middle">' +
            dateInputPY("sch-end-" + item.id, sch.end || "", "updateSchedule('" + item.id + "', 'end', this.value)", "width:100%") + '</td>' +
            // Duración
            '<td style="padding:8px 6px;border:1px solid var(--bor);text-align:center;vertical-align:middle;font-weight:700;font-size:0.85rem">' +
            '<span style="background:var(--sur2);padding:2px 8px;border-radius:4px">' + durationDays + 'd</span></td>' +
            // Estado
            '<td style="padding:8px 6px;border:1px solid var(--bor);text-align:center;vertical-align:middle">' +
            '<select style="padding:4px 6px;border:1px solid var(--bor);border-radius:4px;background:' + statusBg[st] + ';color:' + statusColors[st] + ';font-weight:600;font-size:0.78rem;cursor:pointer" ' +
            'onchange="updateSchedule(\'' + item.id + "', 'status', this.value)\">" +
            '<option value="pending"' + (st === "pending" ? " selected" : "") + '>⏳ Pendiente</option>' +
            '<option value="progress"' + (st === "progress" ? " selected" : "") + '>🏗️ En Ejecución</option>' +
            '<option value="blocked"' + (st === "blocked" ? " selected" : "") + '>⚠️ Bloqueado</option>' +
            '<option value="done"' + (st === "done" ? " selected" : "") + '>✅ Finalizado</option></select></td>' +
            // Ejecución
            '<td style="padding:6px 8px;border:1px solid var(--bor);vertical-align:middle">' +
            renderExecutionCell(item.id, sch) + '</td></tr>';

        // Fila de avance (barra de progreso debajo de cada rubro)
        h += '<tr style="border-bottom:1px solid var(--bor)">' +
            '<td colspan="2" style="padding:2px 10px 6px;border:1px solid var(--bor);font-size:0.7rem;color:var(--tx3)">Avance</td>' +
            '<td colspan="6" style="padding:2px 10px 6px;border:1px solid var(--bor)">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<div style="flex:1;height:6px;background:var(--bor);border-radius:3px;overflow:hidden">' +
            '<div style="width:' + (st === "done" ? 100 : st === "progress" ? 50 : 0) + '%;height:100%;background:' + statusColors[st] + ';border-radius:3px;transition:width .3s"></div></div>' +
            '<span style="font-weight:700;font-size:0.75rem;color:var(--tx2);min-width:30px;text-align:right">' + (st === "done" ? "100%" : st === "progress" ? "50%" : "0%") + '</span></div></td></tr>';
    }

    h += '</tbody></table></div></div>';
    el.innerHTML = h;
    datePYRefreshAll();
}

function renderExecutionCell(itemId, sch) {
    var mode = sch.executionMode || "contractor";
    var modeIcons = { contractor: "👷", own_team: "🏗️", day_workers: "👤" };
    var modeLabels = { contractor: "Contratista", own_team: "Equipo Propio", day_workers: "Jornaleros" };

    var h = '<select style="width:100%;padding:4px;border:1px solid var(--bor);border-radius:4px;background:var(--bg);color:var(--tx);font-size:0.78rem" ' +
        'onchange="updateSchedule(\'' + itemId + "', 'executionMode', this.value);renderSchedule()\">" +
        '<option value="contractor"' + (mode === "contractor" ? " selected" : "") + '>👷 Contratista</option>' +
        '<option value="own_team"' + (mode === "own_team" ? " selected" : "") + '>🏗️ Equipo Propio</option>' +
        '<option value="day_workers"' + (mode === "day_workers" ? " selected" : "") + '>👤 Jornaleros</option></select>';

    if (mode === "contractor") {
        h += '<select style="width:100%;padding:3px 4px;border:1px solid var(--bor);border-radius:4px;background:var(--bg);color:var(--tx);font-size:0.75rem;margin-top:4px" ' +
            'onchange="updateSchedule(\'' + itemId + "', 'contractorId', this.value)\">" +
            '<option value="">— Sin contratista —</option>' +
            (state.contractors || []).map(function (c) {
                return '<option value="' + c.id + '"' + (sch.contractorId === c.id ? " selected" : "") + ">" + escapeHtml(c.name) + "</option>";
            }).join("") + '</select>';
    } else {
        var assigned = sch.assignedStaff || [];
        var listName = mode === "own_team" ? "Equipo Propio" : "Jornaleros";
        var count = assigned.length;
        h += '<div style="margin-top:4px;display:flex;gap:4px">' +
            '<span style="font-size:0.7rem;color:var(--tx3);flex:1;line-height:1.6">' + count + ' personas asignadas</span>' +
            '<button class="btn sm" style="padding:2px 6px;font-size:0.7rem" onclick="showAssignPersonnelModal(\'' + itemId + '\')">👥</button></div>';
    }
    return h;
}

function updateSchedule(itemId, field, value) {
    var p = getActiveProject();
    if (!p) return;
    if (!p.execution.schedules) p.execution.schedules = {};
    if (!p.execution.schedules[itemId]) p.execution.schedules[itemId] = { status: "pending", start: "", end: "", contractorId: null, executionMode: "contractor" };
    p.execution.schedules[itemId][field] = value;
    save();
    if (field === "executionMode" || field === "status") renderSchedule();
}

function showAssignPersonnelModal(itemId) {
    var p = getActiveProject();
    if (!p || !p.execution.schedules) { toast("Cronograma no disponible", false); return; }
    var sch = p.execution.schedules[itemId] || { executionMode: "contractor", assignedStaff: [] };
    var isOwn = sch.executionMode === "own_team";
    var list = isOwn ? state.ownTeam : (p.execution.dayWorkers || []);
    if (!sch.assignedStaff) sch.assignedStaff = [];

    var el = document.getElementById("modal-area");
    el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">' +
        '<div class="modal-title">Asignar ' + (isOwn ? "Equipo Propio" : "Jornaleros") + '<button class="delbtn" onclick="closeModal()">✕</button></div>' +
        '<div style="max-height:300px;overflow-y:auto;margin-bottom:15px">' +
        (list.map(function (m) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bor)">' +
                '<input type="checkbox"' + (sch.assignedStaff.indexOf(m.id) !== -1 ? " checked" : "") + ' onchange="toggleStaffAssignment(\'' + itemId + "','" + m.id + "',this.checked)\">" +
                '<div style="flex:1"><div style="font-size:0.9rem;font-weight:600">' + escapeHtml(m.name) + " " + escapeHtml(m.surname) +
                '</div><div style="font-size:0.75rem;color:var(--tx3)">' + escapeHtml(m.role || "") + " | Jornal: " + fmt(m.dailyRate) + "</div></div></div>";
        }).join("") || '<div class="empty">No hay personal registrado.</div>') +
        '</div><div class="modal-acts"><button class="btn primary full" onclick="closeModal()">Listo ✓</button></div></div></div>';
}

function toggleStaffAssignment(itemId, staffId, checked) {
    var p = getActiveProject();
    var sch = p.execution.schedules[itemId];
    if (!sch) return;
    if (!sch.assignedStaff) sch.assignedStaff = [];
    if (checked) {
        if (sch.assignedStaff.indexOf(staffId) === -1) sch.assignedStaff.push(staffId);
    } else {
        sch.assignedStaff = sch.assignedStaff.filter(function (id) { return id !== staffId; });
    }
    save();
}

function setProjectStartDate(dateStr) {
    var p = getActiveProject();
    if (!p || !dateStr) return;
    p.execution.projectStartDate = dateStr;
    save();
    recalculateScheduleDates();
}

function recalculateScheduleDates() {
    var p = getActiveProject();
    var adenda = getActiveAdenda();
    if (!p || !adenda) return;
    if (!p.execution.projectStartDate && adenda.items.length > 0) p.execution.projectStartDate = todayISO();
    if (!p.execution.projectStartDate) return;
    var currentStartStr = p.execution.projectStartDate;
    if (!p.execution.schedules) p.execution.schedules = {};
    adenda.items.forEach(function (item) {
        var days = 5;
        var startDate = new Date(currentStartStr);
        var endDate = new Date(startDate.getTime() + (days - 1) * 86400000);
        var endStr = endDate.toISOString().split("T")[0];
        if (!p.execution.schedules[item.id]) p.execution.schedules[item.id] = { status: "pending" };
        p.execution.schedules[item.id].start = currentStartStr;
        p.execution.schedules[item.id].end = endStr;
        currentStartStr = new Date(endDate.getTime() + 86400000).toISOString().split("T")[0];
    });
    save();
    renderSchedule();
    toast("Cronograma recalculado ✓");
}

function renderGanttChart() {
    var p = getActiveProject();
    var adenda = getActiveAdenda();
    if (!p || !adenda || adenda.items.length === 0) return "";
    var minTs = Infinity, maxTs = -Infinity;
    var schedules = p.execution.schedules || {};
    adenda.items.forEach(function (item) {
        var sch = schedules[item.id] || {};
        if (sch.start) minTs = Math.min(minTs, new Date(sch.start).getTime());
        if (sch.end) maxTs = Math.max(maxTs, new Date(sch.end).getTime());
    });
    if (minTs === Infinity || maxTs === -Infinity) return '<p style="color:var(--tx3);font-size:0.85rem;padding:16px;text-align:center">Definí las fechas del cronograma para ver el diagrama de Gantt.</p>';
    maxTs += 2 * 86400000;
    var daysTotal = Math.ceil((maxTs - minTs) / 86400000) + 1;
    var weeksTotal = Math.ceil(daysTotal / 7);

    var h = '<div class="gantt-wrap" style="min-width:' + Math.max(600, 200 + daysTotal * 32) + 'px">' +
        // Cabecera con semanas
        '<div class="gantt-header" style="display:grid;grid-template-columns:200px repeat(' + daysTotal + ',minmax(28px,1fr));font-size:0.7rem;font-weight:600;color:var(--tx2);border-bottom:2px solid var(--bor)">' +
        '<div style="padding:6px 8px;font-size:0.75rem;font-weight:700">Rubro</div>';
    for (var i = 0; i < daysTotal; i++) {
        var d = new Date(minTs + i * 86400000);
        var isWeekend = d.getDay() === 0 || d.getDay() === 6;
        h += '<div style="padding:4px 0;text-align:center;background:' + (isWeekend ? "rgba(239,68,68,0.06)" : "transparent") + ';color:' + (isWeekend ? "var(--tx3)" : "var(--tx2)") + '">' + d.getDate() + '</div>';
    }
    h += '</div>';

    adenda.items.forEach(function (item) {
        var sch = schedules[item.id] || {};
        var color = sch.status === "done" ? "var(--ok)" : sch.status === "progress" ? "var(--blue)" : sch.status === "blocked" ? "var(--err)" : "var(--bor)";
        h += '<div class="gantt-row" style="display:grid;grid-template-columns:200px repeat(' + daysTotal + ',minmax(28px,1fr));border-bottom:1px solid var(--bor);font-size:0.75rem">' +
            '<div style="padding:6px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">' + escapeHtml(item.name) + '</div>';
        var startIdx = -1, span = 0;
        if (sch.start && sch.end) {
            startIdx = Math.floor((new Date(sch.start).getTime() - minTs) / 86400000);
            span = Math.floor((new Date(sch.end).getTime() - new Date(sch.start).getTime()) / 86400000) + 1;
        }
        for (var i = 0; i < daysTotal; i++) {
            if (i === startIdx && span > 0) {
                var label = sch.status === "done" ? "✓" : sch.status === "progress" ? "▶" : "";
                h += '<div style="grid-column:span ' + span + ';padding:3px 6px"><div style="background:' + color + ';height:20px;border-radius:4px;display:flex;align-items:center;padding:0 6px;font-size:0.65rem;font-weight:700;color:white;overflow:hidden">' + label + '</div></div>';
                i += (span - 1);
            } else {
                h += '<div></div>';
            }
        }
        h += '</div>';
    });
    return h + '</div>';
}

function exportScheduleCSV() {
    var p = getActiveProject();
    var adenda = getActiveAdenda();
    if (!p || !adenda) return toast("Sin proyecto activo", false);
    var schedules = p.execution.schedules || {};
    var rows = [["#", "Rubro", "Unidad", "Cantidad", "Inicio", "Fin", "Duración (días)", "Estado", "Ejecución"]];
    adenda.items.forEach(function (item, idx) {
        var sch = schedules[item.id] || {};
        var startDate = sch.start ? parseDate(sch.start) : null;
        var endDate = sch.end ? parseDate(sch.end) : null;
        var duration = (startDate && endDate) ? Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1 : "";
        rows.push([
            idx + 1, item.name, item.unit, item.qty,
            sch.start ? formatDatePY(sch.start) : "",
            sch.end ? formatDatePY(sch.end) : "",
            duration,
            sch.status || "pending",
            sch.executionMode || "contractor"
        ].join(","));
    });
    var csv = rows.join("\n");
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "cronograma_" + p.name.replace(/\s+/g, "_") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exportado ✓");
}
