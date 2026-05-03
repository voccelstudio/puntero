/**
 * logs.js — Gestión del Libro de Obra (Bitácora Diaria)
 */

function renderLogs() {
    const el = document.getElementById("section-logs");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para ver su bitácora.</div>"; return; }
    const dailyLogs = p.execution.dailyLogs || [];

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">LIBRO DE OBRA</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Seguimiento diario: <strong>${p.name}</strong></p>
            </div>
            <div style="display:flex; gap:8px">
                <button class="btn primary" onclick="showDailyLogModal()">+ Nueva Entrada Diaria</button>
            </div>
        </div>

        <div class="log-timeline">`;

    if (dailyLogs.length === 0) {
        h += `<div style="text-align:center; padding:60px; background:var(--sur); border-radius:var(--rad); border:1px dashed var(--bor)">
            <div style="font-size:3rem; margin-bottom:10px">📔</div>
            <p style="color:var(--tx3)">Aún no hay registros en el libro de obra.<br>Comenzá registrando el avance de hoy.</p>
        </div>`;
    }

    const sortedLogs = [...dailyLogs].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedLogs.forEach(log => {
        const weatherIco = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', windy: '💨', storm: '⛈️' }[log.weather] || '🌡️';
        
        h += `<div class="sch-card" style="margin-bottom:20px; padding:20px">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--bor); padding-bottom:10px; margin-bottom:15px">
                <div>
                    <span style="font-size:1.2rem; font-weight:800; color:var(--acc)">${log.date}</span>
                    <span style="margin-left:10px; font-size:1.2rem">${weatherIco}</span>
                </div>
                <div style="display:flex; gap:6px">
                    <button class="btn sm" onclick="exportDailyPDF('${log.id}')">📄 PDF</button>
                    <button class="btn sm danger" onclick="deleteLog('${log.id}')">✕</button>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px">
                <div>
                    <h4 style="font-size:0.75rem; text-transform:uppercase; color:var(--tx3); margin-bottom:8px">Trabajos Realizados</h4>
                    <p style="font-size:0.95rem; line-height:1.5; color:var(--tx2); background:rgba(var(--tx-rgb), 0.03); padding:10px; border-radius:var(--rad)">${log.workDone || 'Sin descripción'}</p>
                </div>
                <div>
                    <h4 style="font-size:0.75rem; text-transform:uppercase; color:var(--tx3); margin-bottom:8px">Asistencia de Personal</h4>
                    <div style="font-size:0.85rem">
                        ${(log.attendance || []).map(a => `
                            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(var(--tx-rgb), 0.05)">
                                <span>${a.name}</span>
                                <span style="font-weight:700; color:${a.present ? 'var(--ok)' : 'var(--err)'}">${a.present ? 'PRESENTE' : 'AUSENTE'}</span>
                            </div>
                        `).join("") || '<p style="color:var(--tx3)">No se registró asistencia.</p>'}
                    </div>
                </div>
            </div>

            ${log.photos && log.photos.length > 0 ? `
                <div style="margin-top:15px">
                    <h4 style="font-size:0.75rem; text-transform:uppercase; color:var(--tx3); margin-bottom:8px">Fotografías de Avance</h4>
                    <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px">
                        ${log.photos.map(p => `<img src="${p}" style="height:120px; border-radius:4px; border:1px solid var(--bor)">`).join("")}
                    </div>
                </div>
            ` : ''}
        </div>`;
    });

    h += `</div>
        <div style="margin-top:20px; padding:20px; background:var(--sur); border-radius:var(--rad); border:1px solid var(--bor)">
            <h3 style="font-size:1rem; margin-bottom:10px">Generar Reportes Maestros</h3>
            <div style="display:flex; gap:10px">
                <button class="btn" onclick="exportWeeklyReport()">📅 Generar Informe Semanal (Compilado)</button>
                <button class="btn" onclick="exportMonthlyReport()">🏢 Generar Informe Mensual</button>
            </div>
        </div>
    </div>`;

    el.innerHTML = h;
}

function showDailyLogModal() {
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById("modal-area");
    const proj = getActiveProject();

    // Recolectar personal de los contratistas asignados a este proyecto
    let allStaff = [];
    if (proj && proj.execution.schedules) {
        const assignedConIds = new Set(
            Object.values(proj.execution.schedules).map(s => s && s.contractorId).filter(Boolean)
        );
        (state.contractors || []).forEach(con => {
            if (assignedConIds.has(con.id)) {
                (con.staff || []).forEach(s => {
                    allStaff.push({
                        name: s.name || '',
                        surname: s.surname || '',
                        idNumber: s.idNumber || '',
                        contractor: con.name
                    });
                });
            }
        });
    }

    let attendanceHtml = allStaff.map(s => `
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--bor)">
            <input type="checkbox" class="log-att" data-name="${s.surname}, ${s.name}" checked>
            <div style="flex:1">
                <div style="font-size:0.875rem; font-weight:600">${s.surname}, ${s.name}</div>
                <div style="font-size:0.7rem; color:var(--tx3)">C.I.: ${s.idNumber || 'S/D'} | ${s.contractor}</div>
            </div>
        </div>
    `).join("");

    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:600px">
        <div class="modal-title">Nueva Entrada de Bitácora<button class="delbtn" onclick="closeModal()">✕</button></div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px">
            <div>
                <label class="stat-lbl">Fecha</label>
                <div style="display:flex; gap:5px">
                    <input id="log-date" type="date" value="${today}" style="flex:1" onchange="autoFetchWeather(this.value)">
                    <button class="btn sm" onclick="autoFetchWeather(document.getElementById('log-date').value)" title="Consultar clima histórico">🔄</button>
                </div>
            </div>
            <div>
                <label class="stat-lbl">Clima</label>
                <select id="log-weather" style="width:100%">
                    <option value="sunny">☀️ Soleado</option>
                    <option value="cloudy">☁️ Nublado</option>
                    <option value="rainy">🌧️ Lluvia</option>
                    <option value="windy">💨 Ventoso</option>
                    <option value="storm">⛈️ Tormenta</option>
                </select>
            </div>
        </div>

        <div style="margin-bottom:15px">
            <label class="stat-lbl">Trabajos Realizados / Avance</label>
            <textarea id="log-work" placeholder="Describe qué se hizo hoy, problemas encontrados..." rows="4" style="width:100%"></textarea>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px">
             <div>
                <label class="stat-lbl">Asistencia de Personal</label>
                <div style="max-height:150px; overflow-y:auto; border:1px solid var(--bor); border-radius:4px; padding:10px">
                    ${attendanceHtml || '<p style="color:var(--tx3); font-size:0.75rem">No hay personal registrado.</p>'}
                </div>
            </div>
            <div>
                <label class="stat-lbl">Fotos del avance</label>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px">
                    <button type="button" class="btn sm" onclick="document.getElementById('log-photos-cam').click()" style="flex:1">📸 Tomar foto</button>
                    <button type="button" class="btn sm" onclick="document.getElementById('log-photos-gal').click()" style="flex:1">🖼️ De galería</button>
                </div>
                <input type="file" id="log-photos-cam" accept="image/*" capture="environment" multiple style="display:none">
                <input type="file" id="log-photos-gal" accept="image/*" multiple style="display:none">
                <input type="file" id="log-photos" multiple accept="image/*" style="display:none">
                <div id="photo-preview" style="display:flex; gap:5px; margin-top:5px; flex-wrap:wrap"></div>
            </div>
        </div>

        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="saveDailyLog()">Guardar Entrada 📔</button>
        </div>
    </div></div>`;

    // Acumulador de fotos (cámara + galería)
    window._logPhotosBuffer = [];
    const handlePhotoInput = function(e) {
        const preview = document.getElementById('photo-preview');
        Array.from(this.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => {
                window._logPhotosBuffer.push(ev.target.result);
                const wrap = document.createElement('div');
                wrap.style.position = 'relative';
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.style.width = '50px'; img.style.height = '50px'; img.style.objectFit = 'cover'; img.style.borderRadius = '4px'; img.style.border = '1px solid var(--bor)';
                const idx = window._logPhotosBuffer.length - 1;
                const del = document.createElement('button');
                del.textContent = '✕';
                del.style.cssText = 'position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:var(--err);color:white;border:none;font-size:10px;cursor:pointer;line-height:1;padding:0';
                del.onclick = () => { window._logPhotosBuffer[idx] = null; wrap.remove(); };
                wrap.appendChild(img); wrap.appendChild(del);
                preview.appendChild(wrap);
            };
            reader.readAsDataURL(file);
        });
        // Reset input para poder agregar más sin pisar
        this.value = '';
    };
    document.getElementById('log-photos-cam').onchange = handlePhotoInput;
    document.getElementById('log-photos-gal').onchange = handlePhotoInput;
    document.getElementById('log-photos').onchange = handlePhotoInput;
}

async function saveDailyLog() {
    const p = getActiveProject();
    if (!p) return toast("Sin proyecto activo", false);
    const date = document.getElementById("log-date").value;
    const weather = document.getElementById("log-weather").value;
    const workDone = document.getElementById("log-work").value;

    const attendance = [];
    document.querySelectorAll(".log-att").forEach(ck => {
        attendance.push({ name: ck.dataset.name, present: ck.checked });
    });

    // Tomar fotos del buffer (filtra null = borrados por el usuario)
    const photos = (window._logPhotosBuffer || []).filter(p => p !== null);

    const newLog = {
        id: 'log_' + Date.now(),
        date, weather, workDone, attendance, photos
    };

    if (!p.execution.dailyLogs) p.execution.dailyLogs = [];
    p.execution.dailyLogs.push(newLog);
    window._logPhotosBuffer = []; // limpiar buffer
    save();
    closeModal();
    renderLogs();
    toast("Entrada de bitácora registrada ✓");
}

function deleteLog(id) {
    const p = getActiveProject();
    if(!confirm("¿Eliminar esta entrada permanentemente?")) return;
    p.execution.dailyLogs = p.execution.dailyLogs.filter(l => l.id !== id);
    save();
    renderLogs();
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function autoFetchWeather(date) {
    const weatherSelect = document.getElementById("log-weather");
    if (!weatherSelect) return;
    toast("Consultando clima...");
    try {
        const lat = -25.26; const lon = -57.57;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data.daily && data.daily.weathercode) {
            const code = data.daily.weathercode[0];
            let val = "sunny";
            if (code >= 1 && code <= 3) val = "cloudy";
            if (code >= 51 && code <= 67) val = "rainy";
            if (code >= 95) val = "storm";
            weatherSelect.value = val;
            toast("Clima actualizado ✓");
        }
    } catch (e) { toast("No se pudo obtener el clima", false); }
}
