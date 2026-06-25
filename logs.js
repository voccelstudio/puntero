/**
 * logs.js — Gestión del Libro de Obra con asistencia, fotos, geolocalización e inspección
 */

var _inspectionChecklist = [
  { id: "seguridad", label: "🪖 Equipos de seguridad (casco, arnés)", done: false },
  { id: "limpieza", label: "🧹 Orden y limpieza del frente", done: false },
  { id: "materiales", label: "🧱 Materiales en obra (llegada/stock)", done: false },
  { id: "estructura", label: "🏗️ Estructuras y encofrados", done: false },
  { id: "instalaciones", label: "🔌 Instalaciones (eléctrica, agua)", done: false },
  { id: "cierros", label: "🚧 Cierros perimetrales y portones", done: false },
  { id: "avance", label: "📐 Avance contra cronograma", done: false },
];

function renderLogs() {
    var el = document.getElementById("section-logs");
    if (!el) return;
    var p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver su bitácora.</div>"; return; }
    var dailyLogs = p.execution.dailyLogs || [];
    var isMobile = window.innerWidth < 768;

    var h = '<div class="prices-wrap">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;' + (isMobile ? 'flex-direction:column;gap:10px' : '') + '">' +
        '<div><h2 style="font-family:var(--font-display);font-weight:800;margin-bottom:4px">📔 LIBRO DE OBRA</h2>' +
        '<p style="color:var(--tx3);font-size:0.9rem">Seguimiento diario: <strong>' + escapeHtml(p.name) + '</strong></p></div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="btn primary" onclick="showDailyLogModal()">+ Nueva Entrada</button>' +
        '<button class="btn" onclick="showWalkthroughModal()">📸 Recorrido</button>' +
        '</div></div>';

    // Si es móvil, mostrar un acceso rápido a "Nuevo recorrido"
    if (isMobile) {
        h += '<div style="background:var(--acc);border-radius:var(--rad);padding:15px;margin-bottom:18px;text-align:center;cursor:pointer" onclick="showWalkthroughModal()">' +
            '<div style="font-size:1.5rem">📸</div>' +
            '<div style="font-weight:700;color:white;margin-top:6px">Iniciar Recorrido de Obra</div>' +
            '<div style="font-size:0.8rem;color:rgba(255,255,255,0.7)">Fotos + checklist + ubicación</div>' +
            '</div>';
    }

    h += '<div class="log-timeline">';

    if (dailyLogs.length === 0) {
        h += '<div class="empty" style="padding:60px">📔 Aún no hay registros en el libro de obra.</div>';
    }

    var sorted = dailyLogs.slice().sort(function (a, b) { return parseDate(b.date) - parseDate(a.date); });
    for (var li = 0; li < sorted.length; li++) {
        var log = sorted[li];
        var weatherIco = { sunny: "☀️", cloudy: "☁️", rainy: "🌧️", windy: "💨", storm: "⛈️" }[log.weather] || "🌡️";
        var fotoCount = (log.photos || []).length;
        var inspOk = (log.inspection || []).filter(function (x) { return x.done; }).length;
        var inspTotal = (log.inspection || []).length;

        h += '<div class="sch-card" style="margin-bottom:20px;padding:20px">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:15px">' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--acc)">' + formatDatePY(log.date) + " " + weatherIco + '</div>' +
            '<div style="display:flex;gap:6px">' +
            '<button class="btn sm" onclick="exportDailyPDF(\'' + log.id + '\')">📄 PDF</button>' +
            '<button class="btn sm danger" onclick="deleteLog(\'' + log.id + '\')">✕</button></div></div>';

        // Fotos
        if (fotoCount > 0) {
            h += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px">';
            for (var fi = 0; fi < log.photos.length; fi++) {
                var ph = log.photos[fi];
                var photoUrl = typeof ph === 'string' ? ph : (ph.url || '');
                var areaId = typeof ph === 'object' ? (ph.areaId || '') : '';
                var areaName = '';
                var areaColor = '';
                if (areaId && typeof getAreaName === 'function') { areaName = getAreaName(areaId); areaColor = getAreaColor(areaId); }
                var escapedUrl = photoUrl.replace(/'/g, "\\'");
                h += '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">' +
                    '<div onclick="previewImage(\'' + escapedUrl + '\')" style="min-width:72px;height:72px;border-radius:6px;background:url(' + escapedUrl + ') center/cover;border:1px solid var(--bor);cursor:pointer"></div>' +
                    (areaName ? '<span style="font-size:0.6rem;padding:1px 6px;border-radius:8px;background:' + areaColor + '30;color:' + areaColor + ';font-weight:600;white-space:nowrap">' + escapeHtml(areaName) + '</span>' : '') +
                '</div>';
            }
            h += '</div>';
        }

        // Ubicación
        if (log.location) {
            h += '<div style="font-size:0.75rem;color:var(--tx3);margin-bottom:8px">📍 ' +
                escapeHtml(log.location.address || (log.location.lat + ", " + log.location.lng)) + '</div>';
        }

        h += '<div class="grid2">' +
            '<div><h4 class="stat-lbl">Trabajos Realizados</h4>' +
            '<p style="font-size:0.9rem;line-height:1.5">' + escapeHtml(log.workDone || "Sin descripción") + "</p></div>" +
            '<div><h4 class="stat-lbl">Asistencia (' + (log.attendance || []).filter(function (a) { return a.present; }).length + ")</h4>" +
            '<div style="font-size:0.8rem">';

        for (var ai = 0; ai < (log.attendance || []).length; ai++) {
            var a = log.attendance[ai];
            h += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--bor)">' +
                "<span>" + escapeHtml(a.name) + ' <small style="color:var(--tx3)">(' + escapeHtml(a.origin) + ")</small></span>" +
                '<span style="font-weight:700;color:' + (a.present ? "var(--ok)" : "var(--err)") + '">' + (a.present ? "PRESENTE" : "AUSENTE") + "</span></div>";
        }
        h += "</div></div></div>";

        // Checklist de inspección
        if (inspTotal > 0) {
            h += '<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--bor)">' +
                '<div style="font-size:0.8rem;font-weight:700;margin-bottom:6px">🔍 Inspección (' + inspOk + "/" + inspTotal + ")</div>";
            for (var ii = 0; ii < log.inspection.length; ii++) {
                var item = log.inspection[ii];
                h += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:0.85rem">' +
                    '<span style="color:' + (item.done ? "var(--ok)" : "var(--tx3)") + '">' + (item.done ? "✅" : "⬜") + "</span>" +
                    "<span>" + escapeHtml(item.label) + "</span></div>";
            }
            h += "</div>";
        }

        h += "</div>";
    }

    h += "</div></div>";
    el.innerHTML = h;
}

function showDailyLogModal() {
    var today = todayISO();
    var el = document.getElementById("modal-area");
    var p = getActiveProject();
    if (!p) return;

    var allStaff = [];
    var assignedConIds = new Set(Object.values(p.execution.schedules || {}).map(function (s) { return s.contractorId; }).filter(Boolean));
    (state.contractors || []).forEach(function (con) {
        if (assignedConIds.has(con.id)) {
            (con.staff || []).forEach(function (s) { allStaff.push({ id: s.id, name: s.name + " " + s.surname, origin: "Contratista: " + con.name }); });
        }
    });
    var ownIds = new Set(Object.values(p.execution.schedules || {}).filter(function (s) { return s.executionMode === "own_team"; }).flatMap(function (s) { return s.assignedStaff || []; }));
    (state.ownTeam || []).forEach(function (m) { if (ownIds.has(m.id)) allStaff.push({ id: m.id, name: m.name + " " + m.surname, origin: "Equipo Propio" }); });
    var dayIds = new Set(Object.values(p.execution.schedules || {}).filter(function (s) { return s.executionMode === "day_workers"; }).flatMap(function (s) { return s.assignedStaff || []; }));
    (p.execution.dayWorkers || []).forEach(function (m) { if (dayIds.has(m.id)) allStaff.push({ id: m.id, name: m.name + " " + m.surname, origin: "Jornalero" }); });
    // Integración: agregar jornaleros globales a la lista de asistencia
    (state.jornaleros || []).filter(function (j) { return j.isActive !== false; }).forEach(function (j) {
        allStaff.push({ id: j.id, name: (j.name || '') + " " + (j.surname || ''), origin: "Jornalero Global" });
    });

    var attendanceHtml = allStaff.map(function (s) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bor)">' +
            '<input type="checkbox" class="log-att" data-name="' + escapeHtml(s.name) + '" data-origin="' + escapeHtml(s.origin) + '" checked>' +
            '<div style="flex:1"><div style="font-size:0.875rem;font-weight:600">' + escapeHtml(s.name) + '</div><div style="font-size:0.7rem;color:var(--tx3)">' + escapeHtml(s.origin) + "</div></div></div>";
    }).join("");

    el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:600px">' +
        '<div class="modal-title">📔 Bitácora de Obra<button class="delbtn" onclick="closeModal()">✕</button></div>' +
        '<div class="grid2">' +
        '<div><label class="stat-lbl">Fecha y Clima</label><div style="display:flex;gap:5px">' +
        dateInputPY("log-date", today, "autoFetchWeather(this.value)", "flex:1") +
        '<select id="log-weather" style="width:100px"><option value="sunny">☀️ Sol</option><option value="cloudy">☁️ Nub</option><option value="rainy">🌧️ Lluv</option></select></div></div>' +
        '<div><label class="stat-lbl">Asistencia (' + allStaff.length + ")</label>" +
        '<div style="max-height:100px;overflow-y:auto;border:1px solid var(--bor);padding:5px;border-radius:4px">' + (attendanceHtml || "Sin personal asignado.") + "</div></div></div>" +
        '<div style="margin-top:15px"><label class="stat-lbl">Trabajos y Avance</label><textarea id="log-work" placeholder="¿Qué se hizo hoy?" rows="3" style="width:100%"></textarea></div>' +
        '<div class="modal-acts"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveDailyLog()">Guardar 📔</button></div></div></div>';
}

function showWalkthroughModal() {
    var p = getActiveProject();
    if (!p) { toast("Seleccioná un proyecto primero", false); return; }
    var el = document.getElementById("modal-area");
    var today = todayISO();

    var checklistHtml = _inspectionChecklist.map(function (item) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bor)">' +
            '<input type="checkbox" class="insp-chk" data-id="' + item.id + '" checked>' +
            '<span style="font-size:0.9rem">' + item.label + "</span></div>";
    }).join("");

    el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px">' +
        '<div class="modal-title">📸 Recorrido de Obra<button class="delbtn" onclick="closeModal()">✕</button></div>' +
        '<p style="font-size:0.85rem;color:var(--tx3);margin-bottom:12px">Registrá el estado de la obra con fotos y checklist.</p>' +
        '<div class="grid2">' +
        '<div><label class="stat-lbl">Fecha</label>' + dateInputPY("walk-date", today, "", "width:100%") + "</div>" +
        '<div><label class="stat-lbl">Clima</label><select id="walk-weather" style="width:100%"><option value="sunny">☀️ Sol</option><option value="cloudy">☁️ Nublado</option><option value="rainy">🌧️ Lluvia</option></select></div></div>' +

        '<div style="margin-top:12px"><label class="stat-lbl">📸 Fotos del Recorrido</label>' +
        '<div style="display:flex;gap:8px;margin-top:6px">' +
        '<button class="btn sm" style="flex:1" onclick="document.getElementById(\'walk-photo-cam\').click()">📸 Tomar Foto</button>' +
        '<button class="btn sm" style="flex:1" onclick="document.getElementById(\'walk-photo-gal\').click()">🖼️ Galería</button></div>' +
        '<input type="file" id="walk-photo-cam" accept="image/*" capture="environment" style="display:none" onchange="addWalkthroughPhoto(this)">' +
        '<input type="file" id="walk-photo-gal" accept="image/*" style="display:none" onchange="addWalkthroughPhoto(this)">' +
        '<div id="walk-photos-preview" style="display:flex;gap:8px;overflow-x:auto;margin-top:8px;min-height:80px;padding:8px;border:1px dashed var(--bor);border-radius:var(--rad)"></div></div>' +

        '<div style="margin-top:12px"><label class="stat-lbl">📍 Ubicación</label>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<span id="walk-location" style="font-size:0.8rem;color:var(--tx3);flex:1">Presioná "Obtener ubicación"</span>' +
        '<button class="btn sm" onclick="getWalkthroughLocation()">📍 Obtener</button></div></div>' +

        '<div style="margin-top:12px"><label class="stat-lbl">🔍 Checklist de Inspección</label>' +
        '<div style="max-height:200px;overflow-y:auto;border:1px solid var(--bor);padding:8px;border-radius:var(--rad);margin-top:4px">' + checklistHtml + "</div></div>" +

        '<div style="margin-top:12px"><label class="stat-lbl">Observaciones</label><textarea id="walk-notes" placeholder="Novedades, pendientes, observaciones..." rows="2" style="width:100%"></textarea></div>' +

        '<div class="modal-acts"><button class="btn" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn primary" onclick="saveWalkthrough()">Finalizar Recorrido ✅</button></div></div></div>';
}

var _walkPhotos = [];

function addWalkthroughPhoto(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var preview = document.getElementById("walk-photos-preview");
    if (!preview) return;
    var idx = _walkPhotos.length;
    var areaOpts = getAreaSelectorHtml('');

    var photoEntry = { url: '', areaId: '', uploading: true };

    if (window._STORAGE && window._currentUser) {
        var ref = window._STORAGE.ref("users/" + window._currentUser.uid + "/walkthrough/" + Date.now() + "_" + file.name);
        ref.put(file).then(function (s) { return s.ref.getDownloadURL(); }).then(function (url) {
            photoEntry.url = url;
            photoEntry.uploading = false;
            updateWalkthroughPreview();
            toast("Foto agregada ✓");
        }).catch(function () {
            fallbackWalkthroughPhoto(file, idx);
        });
    } else {
        fallbackWalkthroughPhoto(file, idx);
    }

    _walkPhotos.push(photoEntry);
    updateWalkthroughPreview();

    function updateWalkthroughPreview() {
        preview.innerHTML = _walkPhotos.map(function (p, i) {
            var imgHtml = p.url ? '<div style="min-width:72px;height:72px;border-radius:6px;background:url(' + p.url + ') center/cover;border:1px solid var(--bor);flex-shrink:0"></div>' : '<div style="min-width:72px;height:72px;border-radius:6px;background:var(--sur2);border:1px dashed var(--bor);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--tx3)">Subiendo...</div>';
            return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;position:relative">' +
                imgHtml +
                '<select class="walk-area-sel" data-idx="' + i + '" style="width:80px;font-size:0.6rem;padding:1px 2px;border:1px solid var(--bor);border-radius:3px;background:var(--sur);color:var(--tx2)">' +
                '<option value="">Sin área</option>' +
                (typeof getAreas === 'function' ? (getAreas() || []).map(function(a) {
                    return '<option value="' + a.id + '"' + (p.areaId === a.id ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
                }).join("") : '') +
                '</select>' +
                '<button class="delbtn sm" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;font-size:0.6rem" onclick="removeWalkthroughPhoto(' + i + ')">✕</button>' +
                '</div>';
        }).join("");
    }

    input.value = "";
}

function fallbackWalkthroughPhoto(file, idx) {
    var reader = new FileReader();
    reader.onload = function (e) {
        if (_walkPhotos[idx]) {
            _walkPhotos[idx].url = e.target.result;
            _walkPhotos[idx].uploading = false;
            updateWalkthroughPreviewUI();
        }
    };
    reader.readAsDataURL(file);
}

function removeWalkthroughPhoto(idx) {
    _walkPhotos.splice(idx, 1);
    updateWalkthroughPreviewUI();
}

function updateWalkthroughPreviewUI() {
    var preview = document.getElementById("walk-photos-preview");
    if (!preview) return;
    preview.innerHTML = _walkPhotos.map(function (p, i) {
        var imgHtml = p.url ? '<div style="min-width:72px;height:72px;border-radius:6px;background:url(' + p.url + ') center/cover;border:1px solid var(--bor);flex-shrink:0"></div>' : '<div style="min-width:72px;height:72px;border-radius:6px;background:var(--sur2);border:1px dashed var(--bor);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--tx3)">Subiendo...</div>';
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;position:relative">' +
            imgHtml +
            '<select class="walk-area-sel" data-idx="' + i + '" style="width:80px;font-size:0.6rem;padding:1px 2px;border:1px solid var(--bor);border-radius:3px;background:var(--sur);color:var(--tx2)">' +
            '<option value="">Sin área</option>' +
            (typeof getAreas === 'function' ? (getAreas() || []).map(function(a) {
                return '<option value="' + a.id + '"' + (p.areaId === a.id ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
            }).join("") : '') +
            '</select>' +
            '<button class="delbtn sm" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;font-size:0.6rem" onclick="removeWalkthroughPhoto(' + i + ')">✕</button>' +
            '</div>';
    }).join("");
}

function getWalkthroughLocation() {
    if (!navigator.geolocation) { document.getElementById("walk-location").textContent = "GPS no disponible"; return; }
    document.getElementById("walk-location").textContent = "Obteniendo ubicación...";
    navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude.toFixed(6);
        var lng = pos.coords.longitude.toFixed(6);
        document.getElementById("walk-location").innerHTML = lat + ", " + lng + ' <small style="color:var(--tx3)">(precisión: ' + pos.coords.accuracy.toFixed(0) + "m)</small>";
        document.getElementById("walk-location").dataset.lat = lat;
        document.getElementById("walk-location").dataset.lng = lng;
        toast("Ubicación obtenida 📍");
    }, function () {
        document.getElementById("walk-location").textContent = "Error al obtener ubicación";
    }, { enableHighAccuracy: true });
}

function saveWalkthrough() {
    var p = getActiveProject();
    if (!p) return;
    var inspection = [];
    document.querySelectorAll(".insp-chk").forEach(function (ck) {
        var item = _inspectionChecklist.find(function (i) { return i.id === ck.dataset.id; });
        if (item) inspection.push({ id: item.id, label: item.label, done: ck.checked });
    });
    var locationEl = document.getElementById("walk-location");
    var location = locationEl && locationEl.dataset.lat ? { lat: parseFloat(locationEl.dataset.lat), lng: parseFloat(locationEl.dataset.lng) } : null;

    // Leer áreas seleccionadas de cada foto
    document.querySelectorAll(".walk-area-sel").forEach(function(sel) {
        var idx = parseInt(sel.dataset.idx);
        if (_walkPhotos[idx]) _walkPhotos[idx].areaId = sel.value;
    });

    var newLog = {
        id: "log_" + Date.now(),
        date: document.getElementById("walk-date")?.value || todayISO(),
        weather: document.getElementById("walk-weather")?.value || "sunny",
        workDone: document.getElementById("walk-notes")?.value || "Recorrido de obra - inspección visual",
        attendance: [], photos: _walkPhotos.slice(), location: location,
        inspection: inspection, isWalkthrough: true
    };
    if (!p.execution.dailyLogs) p.execution.dailyLogs = [];
    p.execution.dailyLogs.push(newLog);
    _walkPhotos = [];

    // Actualizar contadores de fotos por área
    if (typeof updateAreaFotoCounts === 'function') updateAreaFotoCounts();

    save();
    closeModal();
    renderLogs();
    toast("Recorrido guardado ✅");
}

function saveDailyLog() {
    var p = getActiveProject();
    var attendance = [];
    document.querySelectorAll(".log-att").forEach(function (ck) { attendance.push({ name: ck.dataset.name, origin: ck.dataset.origin, present: ck.checked }); });
    var newLog = {
        id: "log_" + Date.now(),
        date: document.getElementById("log-date")?.value || todayISO(),
        weather: document.getElementById("log-weather")?.value || "sunny",
        workDone: document.getElementById("log-work")?.value || "",
        attendance: attendance, photos: []
    };
    if (!p.execution.dailyLogs) p.execution.dailyLogs = [];
    p.execution.dailyLogs.push(newLog);
    save();
    closeModal();
    renderLogs();
    toast("Bitácora actualizada ✓");
}

function deleteLog(id) {
    var p = getActiveProject();
    if (!confirm("¿Eliminar entrada?")) return;
    p.execution.dailyLogs = p.execution.dailyLogs.filter(function (l) { return l.id !== id; });
    save();
    renderLogs();
}

async function autoFetchWeather(date) {
    try {
        var resp = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-25.26&longitude=-57.57&daily=weathercode&timezone=auto&start_date=" + date + "&end_date=" + date);
        var data = await resp.json();
        if (data && data.daily && data.daily.weathercode) {
            var c = data.daily.weathercode[0];
            var el = document.getElementById("log-weather");
            if (el) el.value = (c >= 51 && c <= 67) ? "rainy" : (c >= 1 && c <= 3) ? "cloudy" : "sunny";
        }
    } catch (e) {}
}
