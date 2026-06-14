/**
 * jornaleros.js — Gestión de Jornaleros y Jornales
 * Roles: Ayudante, Oficial, Puntero
 */

const DEFAULT_JORNAL = { ayudante: 80000, oficial: 110000, puntero: 140000 };

function renderJornaleros() {
    try {
    const el = document.getElementById("section-jornaleros");
    if (!el) return;
    if (!state.jornaleros || !Array.isArray(state.jornaleros)) state.jornaleros = [];
    if (!state.jornalConfig || typeof state.jornalConfig !== 'object') state.jornalConfig = { ...DEFAULT_JORNAL };

    const p = getActiveProject();
    const projName = p ? p.name : 'Sin proyecto activo';

    let h = `<div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px">
            <div>
                <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">JORNALEROS</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Registro y control de jornales · <strong>${projName}</strong></p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
                <button class="btn sm" onclick="showJornalConfigModal()">⚙️ Jornales</button>
                <button class="btn sm" onclick="exportJornalerosCSV()">📥 CSV</button>
                <button class="btn primary" onclick="showAddJornaleroModal()">+ Nuevo Jornalero</button>
            </div>
        </div>`;

    // Filtros y resumen
    const totalWorkers = state.jornaleros.length;
    const activeWorkers = state.jornaleros.filter(j => j.isActive !== false).length;
    const totalJornadas = state.jornaleros.reduce((s, j) => s + (j.jornadas || []).length, 0);
    const totalPagado = state.jornaleros.reduce((s, j) => s + (j.jornadas || []).reduce((ss, jd) => ss + (jd.monto || 0), 0), 0);

    h += `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-bottom:18px">
        <div class="dash-card" style="padding:12px">
            <div class="dash-num" style="font-size:1.2rem">${totalWorkers}</div>
            <div class="dash-lbl">Registrados</div>
        </div>
        <div class="dash-card" style="padding:12px">
            <div class="dash-num" style="font-size:1.2rem">${activeWorkers}</div>
            <div class="dash-lbl">Activos</div>
        </div>
        <div class="dash-card" style="padding:12px">
            <div class="dash-num" style="font-size:1.2rem">${totalJornadas}</div>
            <div class="dash-lbl">Jornadas</div>
        </div>
        <div class="dash-card" style="padding:12px">
            <div class="dash-num" style="font-size:1.2rem">${fmt(totalPagado)}</div>
            <div class="dash-lbl">Total Pagado</div>
        </div>
    </div>`;

    const filterRole = document.getElementById("jor-filter-role")?.value || "all";
    const filterText = document.getElementById("jor-filter-text")?.value.toLowerCase() || "";

    h += `<div class="card" style="margin-bottom:18px; padding:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <span style="font-size:0.85rem; font-weight:700; color:var(--tx3)">Filtros:</span>
        <input id="jor-filter-text" placeholder="Buscar por nombre o cédula..." style="width:200px; font-size:0.85rem" oninput="renderJornaleros()">
        <select id="jor-filter-role" style="width:130px; font-size:0.85rem" onchange="renderJornaleros()">
            <option value="all">Todos los roles</option>
            <option value="ayudante">Ayudante</option>
            <option value="oficial">Oficial</option>
            <option value="puntero">Puntero</option>
        </select>
        <span style="font-size:0.85rem; color:var(--tx3); margin-left:auto">
            Jornal base: Ayud. ${fmt(state.jornalConfig.ayudante)} · Ofc. ${fmt(state.jornalConfig.oficial)} · Punt. ${fmt(state.jornalConfig.puntero)}
        </span>
    </div>`;

    const filtered = state.jornaleros.filter(j => {
        const jName = (j.name || '').toLowerCase();
        const jSurname = (j.surname || '').toLowerCase();
        const matchesText = !filterText || jName.includes(filterText) || jSurname.includes(filterText) || (j.idNumber || '').includes(filterText);
        const matchesRole = filterRole === "all" || j.role === filterRole;
        return matchesText && matchesRole;
    });

    if (filtered.length === 0) {
        h += `<div style="text-align:center; padding:40px; background:var(--sur); border-radius:var(--rad); border:1px dashed var(--bor)">
            <p style="color:var(--tx3)">No se encontraron jornaleros. <button class="btn sm primary" onclick="showAddJornaleroModal()">+ Crear primero</button></p>
        </div>`;
    }

    h += `<div class="con-grid">`;
    filtered.forEach(j => {
        const dw = j.dailyWage || state.jornalConfig[j.role] || 0;
        const jornadas = j.jornadas || [];
        const diasTrabajados = jornadas.length;
        const totalDevengado = jornadas.reduce((s, jd) => s + (jd.monto || 0), 0);
        const roleLabel = j.role ? j.role.charAt(0).toUpperCase() + j.role.slice(1) : 'Sin rol';

        h += `<div class="con-card" style="${j.isActive === false ? 'opacity:0.6;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                    <div class="con-name">${(j.name || '') + ' ' + (j.surname || '')}</div>
                    <div class="con-meta">
                        <span>🆔 ${j.idNumber || 'S/C'}</span>
                        <span>🔧 ${roleLabel}</span>
                        <span>📱 ${j.phone || 'S/T'}</span>
                    </div>
                </div>
                <span class="iva-badge" style="background:${j.isActive === false ? 'var(--bor)' : 'var(--matbg)'}; color:${j.isActive === false ? 'var(--tx3)' : 'var(--ok)'}">${j.isActive === false ? 'INACTIVO' : 'ACTIVO'}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--bor)">
                <div class="stat-box">
                    <div class="stat-lbl">Jornal diario</div>
                    <div class="stat-val">${fmt(dw)}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-lbl">Días trabajados</div>
                    <div class="stat-val">${diasTrabajados}</div>
                </div>
                <div class="stat-box" style="grid-column:1/-1">
                    <div class="stat-lbl">Total devengado</div>
                    <div class="stat-val" style="color:var(--acc); font-size:1.1rem">${fmt(totalDevengado)}</div>
                </div>
            </div>
            <div style="margin-top:14px; display:flex; gap:6px; flex-wrap:wrap">
                <button class="btn sm" style="flex:1; background:rgba(var(--acc-rgb),0.1); border-color:rgba(var(--acc-rgb),0.3)" onclick="showJornadaModal('${j.id}')">📋 Jornada</button>
                <button class="btn sm" style="flex:1" onclick="showEditJornaleroModal('${j.id}')">✏️ Editar</button>
                <button class="btn sm danger" onclick="deleteJornalero('${j.id}')">✕</button>
            </div>
            ${jornadas.length > 0 ? `<div style="margin-top:10px; max-height:100px; overflow-y:auto; font-size:0.75rem; color:var(--tx3)">
                ${jornadas.slice(-5).reverse().map(jd => `<div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid var(--bor)">
                    <span>${formatDatePY(jd.date)}${jd.projectId ? ' 📋' : ''}</span>
                    <span style="font-weight:600; color:var(--tx2)">${fmt(jd.monto)}</span>
                </div>`).join("")}
            </div>` : ''}
        </div>`;
    });
    h += `</div></div>`;

    el.innerHTML = h;
    } catch (e) {
        console.error("[Jornaleros]", e);
        document.getElementById("section-jornaleros") && (document.getElementById("section-jornaleros").innerHTML = `<div class="empty" style="padding:40px"><strong>Error al cargar Jornaleros</strong><br><span style="color:var(--tx3);font-size:0.85rem">${e.message}</span></div>`);
    }
}

function showAddJornaleroModal(editId) {
    const j = editId ? state.jornaleros.find(x => x.id === editId) : null;
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:450px">
        <div class="modal-title">${j ? 'Editar' : 'Nuevo'} Jornalero<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:flex; flex-direction:column; gap:10px">
            <div class="two-col">
                <input id="jor-name" placeholder="Nombre" value="${j ? j.name : ''}">
                <input id="jor-surname" placeholder="Apellido" value="${j ? j.surname : ''}">
            </div>
            <input id="jor-id" placeholder="Cédula de Identidad" value="${j ? (j.idNumber || '') : ''}">
            <input id="jor-phone" placeholder="Teléfono" value="${j ? (j.phone || '') : ''}">
            <label style="font-size:0.85rem; font-weight:600; color:var(--tx3)">Rol / Categoría</label>
            <select id="jor-role">
                <option value="ayudante" ${j && j.role === 'ayudante' ? 'selected' : ''}>Ayudante</option>
                <option value="oficial" ${j && j.role === 'oficial' ? 'selected' : ''}>Oficial</option>
                <option value="puntero" ${j && j.role === 'puntero' ? 'selected' : ''}>Puntero</option>
            </select>
            <label style="font-size:0.85rem; font-weight:600; color:var(--tx3)">Jornal diario personalizado <span style="font-weight:400; color:var(--tx3)">(dejá vacío para usar el valor por defecto del rol)</span></label>
            <input id="jor-wage" type="number" placeholder="Ej: 120000" value="${j && j.dailyWage ? j.dailyWage : ''}">
            <label><input type="checkbox" id="jor-ips" ${j && j.hasIPS ? 'checked' : ''}> Aporta IPS</label>
            <label><input type="checkbox" id="jor-active" ${!j || j.isActive !== false ? 'checked' : ''}> Activo</label>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="${j ? `saveEditJornalero('${editId}')` : 'addJornalero()'}">${j ? 'Guardar Cambios' : 'Registrar'}</button>
        </div>
    </div></div>`;
}

function showEditJornaleroModal(id) {
    showAddJornaleroModal(id);
}

function addJornalero() {
    const name = document.getElementById("jor-name").value.trim();
    const surname = document.getElementById("jor-surname").value.trim();
    if (!name || !surname) return toast("Nombre y apellido requeridos", false);
    const newJ = {
        id: 'jor_' + Date.now(),
        name,
        surname,
        idNumber: document.getElementById("jor-id").value.trim(),
        phone: document.getElementById("jor-phone").value.trim(),
        role: document.getElementById("jor-role").value,
        dailyWage: parseFloat(document.getElementById("jor-wage").value) || null,
        hasIPS: document.getElementById("jor-ips").checked,
        isActive: document.getElementById("jor-active").checked,
        jornadas: []
    };
    if (!state.jornaleros) state.jornaleros = [];
    state.jornaleros.push(newJ);
    save(); closeModal(); renderJornaleros();
    toast("Jornalero registrado ✓");
}

function saveEditJornalero(id) {
    const j = state.jornaleros.find(x => x.id === id);
    if (!j) return;
    j.name = document.getElementById("jor-name").value.trim();
    j.surname = document.getElementById("jor-surname").value.trim();
    j.idNumber = document.getElementById("jor-id").value.trim();
    j.phone = document.getElementById("jor-phone").value.trim();
    j.role = document.getElementById("jor-role").value;
    j.dailyWage = parseFloat(document.getElementById("jor-wage").value) || null;
    j.hasIPS = document.getElementById("jor-ips").checked;
    j.isActive = document.getElementById("jor-active").checked;
    save(); closeModal(); renderJornaleros();
    toast("Jornalero actualizado ✓");
}

function deleteJornalero(id) {
    if (!confirm("¿Eliminar este jornalero? Se perderán sus jornadas registradas.")) return;
    state.jornaleros = state.jornaleros.filter(j => j.id !== id);
    save(); renderJornaleros();
}

function showJornalConfigModal() {
    if (!state.jornalConfig) state.jornalConfig = { ...DEFAULT_JORNAL };
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
        <div class="modal-title">Configurar Jornales por Rol<button class="delbtn" onclick="closeModal()">✕</button></div>
        <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:14px">Estos son los valores por defecto. Cada jornalero puede tener un jornal personalizado.</p>
        <div style="display:flex; flex-direction:column; gap:12px">
            <div>
                <label style="font-size:0.85rem; font-weight:600; color:var(--tx2)">👷 Ayudante</label>
                <input id="jor-cfg-ayudante" type="number" value="${state.jornalConfig.ayudante}" style="margin-top:4px">
            </div>
            <div>
                <label style="font-size:0.85rem; font-weight:600; color:var(--tx2)">🔧 Oficial</label>
                <input id="jor-cfg-oficial" type="number" value="${state.jornalConfig.oficial}" style="margin-top:4px">
            </div>
            <div>
                <label style="font-size:0.85rem; font-weight:600; color:var(--tx2)">🎯 Puntero</label>
                <input id="jor-cfg-puntero" type="number" value="${state.jornalConfig.puntero}" style="margin-top:4px">
            </div>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="saveJornalConfig()">Guardar</button>
        </div>
    </div></div>`;
}

function saveJornalConfig() {
    state.jornalConfig = {
        ayudante: parseInt(document.getElementById("jor-cfg-ayudante").value) || DEFAULT_JORNAL.ayudante,
        oficial: parseInt(document.getElementById("jor-cfg-oficial").value) || DEFAULT_JORNAL.oficial,
        puntero: parseInt(document.getElementById("jor-cfg-puntero").value) || DEFAULT_JORNAL.puntero
    };
    save(); closeModal(); renderJornaleros();
    toast("Jornales configurados ✓");
}

function showJornadaModal(jorId) {
    const j = state.jornaleros.find(x => x.id === jorId);
    if (!j) return;
    const dw = j.dailyWage || state.jornalConfig[j.role] || 0;
    const jornadas = j.jornadas || [];

    function projNameFor(projectId) {
        if (!projectId) return '';
        const pp = (state.projects || []).find(pr => pr.id === projectId);
        return pp ? pp.name : '';
    }

    let historial = jornadas.length === 0 ? '<p style="color:var(--tx3); text-align:center; padding:10px">Sin jornadas registradas.</p>'
        : `<div style="max-height:200px; overflow-y:auto">${jornadas.slice().reverse().map((jd, idx) => `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 30px; gap:6px; align-items:center; padding:6px 0; border-bottom:1px solid var(--bor)">
                <span style="font-size:0.85rem">${formatDatePY(jd.date)}</span>
                <span style="font-size:0.85rem; color:var(--tx3)">${jd.horas || 8}h</span>
                <span style="font-weight:700; text-align:right">${fmt(jd.monto)}</span>
                <button class="delbtn sm" style="width:22px;height:22px;font-size:0.7rem" onclick="deleteJornada('${jorId}', ${jornadas.length - 1 - idx})">✕</button>
            </div>
            ${jd.projectId ? `<div style="font-size:0.7rem; color:var(--tx3); margin:-4px 0 4px 0; padding-left:4px">📋 ${projNameFor(jd.projectId) || 'Proyecto eliminado'}</div>` : ''}`).join("")}</div>`;

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px">
        <div class="modal-title">📋 Jornadas: ${j.name} ${j.surname}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; padding:12px; background:var(--sur2); border-radius:var(--rad)">
            <div><span class="stat-lbl">Rol</span><div style="font-weight:600">${j.role}</div></div>
            <div><span class="stat-lbl">Jornal diario</span><div style="font-weight:600; color:var(--acc)">${fmt(dw)}</div></div>
            <div><span class="stat-lbl">Días trabajados</span><div style="font-weight:600">${jornadas.length}</div></div>
            <div><span class="stat-lbl">Total devengado</span><div style="font-weight:600; color:var(--acc)">${fmt(jornadas.reduce((s, jd) => s + (jd.monto || 0), 0))}</div></div>
        </div>
        ${historial}
        <div style="background:rgba(var(--acc-rgb),0.05); padding:12px; border-radius:var(--rad); margin-top:14px">
            <strong>Registrar Jornada</strong>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px">
                ${dateInputPY('jor-jd-date', todayISO(), '', 'width:100%')}
                <input id="jor-jd-horas" type="number" value="8" min="1" max="24" step="0.5" placeholder="Horas">
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-top:8px">
                <span style="font-size:0.85rem; color:var(--tx3)">Monto:</span>
                <input id="jor-jd-monto" type="number" value="${dw}" placeholder="Monto" style="flex:1">
                <button class="btn primary" onclick="registerJornada('${jorId}')">➕ Registrar</button>
            </div>
        </div>
    </div></div>`;
}

function registerJornada(jorId) {
    const j = state.jornaleros.find(x => x.id === jorId);
    if (!j) return;
    const date = document.getElementById("jor-jd-date").value;
    const horas = parseFloat(document.getElementById("jor-jd-horas").value) || 8;
    const monto = parseFloat(document.getElementById("jor-jd-monto").value) || 0;
    if (!date) return toast("Fecha requerida", false);
    if (monto <= 0) return toast("Monto inválido", false);
    if (!j.jornadas) j.jornadas = [];
    const proj = getActiveProject();
    j.jornadas.push({ id: Date.now(), date, horas, monto, projectId: proj ? proj.id : null });
    // Integración Jornaleros → Finanzas: registrar como egreso automático
    if (proj && proj.execution) {
        if (!proj.execution.finances) proj.execution.finances = { income: [], expenses: [] };
        proj.execution.finances.expenses.push({
            id: Date.now() + 1,
            amount: monto,
            date: date,
            note: "Jornal: " + (j.name || '') + " " + (j.surname || '') + " (" + (j.role || '') + ")"
        });
    }
    save(); showJornadaModal(jorId); renderJornaleros();
    toast("Jornada registrada ✓");
}

function deleteJornada(jorId, idx) {
    const j = state.jornaleros.find(x => x.id === jorId);
    if (j && j.jornadas) {
        j.jornadas.splice(idx, 1);
        save(); showJornadaModal(jorId); renderJornaleros();
    }
}
