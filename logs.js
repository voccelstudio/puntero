/**
 * logs.js — Gestión del Libro de Obra (Bitácora Diaria)
 */

function renderLogs() {
    const el = document.getElementById("section-logs");
    if (!el) return;

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">LIBRO DE OBRA</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Seguimiento diario y bitácora de campo</p>
            </div>
            <div style="display:flex; gap:8px">
                <button class="btn" onclick="showStaffModal()">👥 Gestionar Personal</button>
                <button class="btn primary" onclick="showDailyLogModal()">+ Nueva Entrada Diaria</button>
            </div>
        </div>

        <div class="log-timeline">`;

    if (state.dailyLogs.length === 0) {
        h += `<div style="text-align:center; padding:60px; background:var(--sur); border-radius:var(--rad); border:1px dashed var(--bor)">
            <div style="font-size:3rem; margin-bottom:10px">📔</div>
            <p style="color:var(--tx3)">Aún no hay registros en el libro de obra.<br>Comenzá registrando el avance de hoy.</p>
        </div>`;
    }

    // Ordenar por fecha descendente
    const sortedLogs = [...state.dailyLogs].sort((a,b) => new Date(b.date) - new Date(a.date));

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
    
    // Preparar lista de asistencia basada en el personal actual
    let attendanceHtml = state.staff.map(s => `
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--bor)">
            <input type="checkbox" class="log-att" data-name="${s.name} ${s.last}" checked>
            <div style="flex:1">
                <div style="font-size:0.875rem; font-weight:600">${s.last}, ${s.name}</div>
                <div style="font-size:0.7rem; color:var(--tx3)">C.I.: ${s.cedula} | ${s.role}</div>
            </div>
        </div>
    `).join("");

    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:600px">
        <div class="modal-title">Nueva Entrada de Bitácora<button class="delbtn" onclick="closeModal()">✕</button></div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px">
            <div>
                <label class="stat-lbl">Fecha</label>
                <input id="log-date" type="date" value="${today}" style="width:100%">
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
            <textarea id="log-work" placeholder="Describe qué se hizo hoy, problemas encontrados, materiales recibidos..." rows="4" style="width:100%"></textarea>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px">
             <div>
                <label class="stat-lbl">Asistencia de Personal</label>
                <div style="max-height:150px; overflow-y:auto; border:1px solid var(--bor); border-radius:4px; padding:10px">
                    ${attendanceHtml || '<p style="color:var(--tx3); font-size:0.75rem">No hay personal registrado.</p>'}
                </div>
            </div>
            <div>
                <label class="stat-lbl">Fotos (Cargar múltiples)</label>
                <input type="file" id="log-photos" multiple accept="image/*" style="font-size:0.8rem">
                <div id="photo-preview" style="display:flex; gap:5px; margin-top:5px; flex-wrap:wrap"></div>
            </div>
        </div>

        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="saveDailyLog()">Guardar Entrada 📔</button>
        </div>
    </div></div>`;

    // Preview de fotos
    document.getElementById('log-photos').onchange = function(e) {
        const preview = document.getElementById('photo-preview');
        preview.innerHTML = '';
        Array.from(this.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.style.width = '40px';
                img.style.height = '40px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '4px';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    };
}

async function saveDailyLog() {
    const date = document.getElementById("log-date").value;
    const weather = document.getElementById("log-weather").value;
    const workDone = document.getElementById("log-work").value;
    const photoFiles = document.getElementById("log-photos").files;
    
    // Procesar asistencia
    const attendance = [];
    document.querySelectorAll(".log-att").forEach(ck => {
        attendance.push({ name: ck.dataset.name, present: ck.checked });
    });

    // Procesar fotos a Base64
    const photos = [];
    for (let f of photoFiles) {
        const b64 = await toBase64(f);
        photos.push(b64);
    }

    const newLog = {
        id: 'log_' + Date.now(),
        date,
        weather,
        workDone,
        attendance,
        photos
    };

    state.dailyLogs.push(newLog);
    save();
    closeModal();
    renderLogs();
    toast("Entrada de bitácora registrada ✓");
}

function showStaffModal() {
    let staffHtml = state.staff.map((s, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--bor)">
            <div>
                <strong>${s.last}, ${s.name}</strong> 
                <div style="color:var(--tx3); font-size:0.75rem">C.I.: ${s.cedula} | ${s.role} ${s.phone ? `| 📱 ${s.phone}` : ''} ${s.phone ? `<button class="btn sm" onclick="window.open(waLink('${s.phone.replace(/'/g, "\\'")}'), '_blank')" style="padding:0 5px;background:#25D366;color:white;border:none;margin-left:5px" title="WhatsApp">💬</button>` : ''}</div>
            </div>
            <button class="delbtn" onclick="deleteStaff(${idx})">✕</button>
        </div>
    `).join("");

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
        <div class="modal-title">Gestionar Personal de Obra<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="max-height:200px; overflow-y:auto; margin-bottom:15px">
            ${staffHtml || '<p style="color:var(--tx3); text-align:center">No hay personal registrado.</p>'}
        </div>
        <div style="background:rgba(var(--acc-rgb), 0.05); padding:12px; border-radius:var(--rad); display:flex; flex-direction:column; gap:8px">
            <strong>Agregar Personal</strong>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
                <input id="st-name" placeholder="Nombres">
                <input id="st-last" placeholder="Apellidos">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
                <input id="st-cedula" placeholder="N° Cédula">
                <input id="st-role" placeholder="Rubro (ej. Oficial Albañil)">
            </div>
            <input id="st-phone" placeholder="Teléfono / WhatsApp">
            <button class="btn primary" onclick="addStaff()">Agregar 👤</button>
        </div>
    </div></div>`;
}

function addStaff() {
    const name = document.getElementById("st-name").value.trim();
    const last = document.getElementById("st-last").value.trim();
    const cedula = document.getElementById("st-cedula").value.trim();
    const role = document.getElementById("st-role").value.trim();
    const phone = document.getElementById("st-phone").value.trim();
    
    if (!name || !last || !cedula || !role) return toast("Todos los campos son obligatorios", false);
    
    state.staff.push({ name, last, cedula, role, phone });
    save();
    showStaffModal();
    toast("Personal añadido ✓");
}

function deleteStaff(idx) {
    state.staff.splice(idx, 1);
    save();
    showStaffModal();
}

function deleteLog(id) {
    if(!confirm("¿Eliminar esta entrada permanentemente?")) return;
    state.dailyLogs = state.dailyLogs.filter(l => l.id !== id);
    save();
    renderLogs();
}

// Helper para convertir archivos a Base64
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
