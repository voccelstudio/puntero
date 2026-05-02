/**
 * PLANOS Y GALERÍA - Puntero ERP
 * Repositorio de documentos y fotos de obra con control de versiones y sectores.
 */

function renderDocuments() {
    const el = document.getElementById("section-documents");
    if (!el) return;
    const proj = getActiveProject();
    if (!proj) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
    if (!proj.execution.documents) proj.execution.documents = [];
    const dailyLogs = proj.execution.dailyLogs || [];

    // Combinar fotos de la bitácora
    const logPhotos = dailyLogs.flatMap(l => (l.photos || []).map(p => ({
        id: 'log-' + l.id,
        type: 'photo',
        category: 'Bitácora',
        sector: 'General',
        name: `Foto ${l.date}`,
        date: l.date,
        url: p,
        versions: [{ id: Date.now(), url: p, date: l.date }]
    })));

    const allDocs = [...proj.execution.documents, ...logPhotos];
    
    const categories = ['Todos', 'Planos', 'Fotos', 'Contratos', 'Facturas', 'Bitácora'];
    const currentCat = state._docFilter || 'Todos';
    const currentSector = state._sectorFilter || 'Todos';

    const sectors = ['Todos', ...(proj.execution.sectors || ["Cocina", "Estar", "Baños", "Dormitorios", "Fachada", "Jardín"])];

    let filtered = currentCat === 'Todos' ? allDocs : allDocs.filter(d => d.category === currentCat || (currentCat === 'Fotos' && d.type === 'photo'));
    
    if (currentSector !== 'Todos') {
        filtered = filtered.filter(d => d.sector === currentSector);
    }

    filtered.sort((a, b) => new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-')));

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <div>
                <h2 class="sec-lbl" style="margin:0">Documentación y Galería</h2>
                <p style="color:var(--tx3); font-size:0.85rem">Gestión de versiones y sectores de obra</p>
            </div>
            <div style="display:flex; gap:10px">
                <button class="btn" onclick="showModal('manage_sectors')">⚙️ Sectores</button>
                <button class="btn primary" onclick="document.getElementById('doc-upload').click()">+ Subir Archivo</button>
            </div>
            <input type="file" id="doc-upload" style="display:none" onchange="handleUpload(this)" multiple>
        </div>

        <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px; background:var(--sur2); padding:15px; border-radius:var(--rad); border:1px solid var(--bor)">
            <div style="display:flex; align-items:center; gap:15px">
                <span style="font-size:0.75rem; color:var(--tx3); font-weight:800; text-transform:uppercase; min-width:80px">Categoría:</span>
                <div style="display:flex; gap:8px; overflow-x:auto">
                    ${categories.map(c => `
                        <button class="nbtn sm ${currentCat === c ? 'on' : ''}" onclick="filterDocs('${c}')">${c}</button>
                    `).join("")}
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:15px">
                <span style="font-size:0.75rem; color:var(--tx3); font-weight:800; text-transform:uppercase; min-width:80px">Sector:</span>
                <div style="display:flex; gap:8px; overflow-x:auto">
                    ${sectors.map(s => `
                        <button class="nbtn sm ${currentSector === s ? 'on' : ''}" onclick="filterSector('${s}')">${s}</button>
                    `).join("")}
                </div>
            </div>
        </div>

        <div class="doc-grid">
            ${filtered.map(d => {
                const latestVersion = d.versions ? d.versions[d.versions.length - 1] : { url: d.url };
                const versionCount = d.versions ? d.versions.length : 1;
                return `
                <div class="card doc-card" onclick="viewDocument('${d.id}')">
                    <div class="doc-preview" style="background: ${latestVersion.url ? `url(${latestVersion.url}) center/cover` : 'var(--sur2)'}">
                        ${!latestVersion.url ? `<span style="font-size:2rem">${d.category === 'Planos' ? '📐' : '📄'}</span>` : ''}
                        ${versionCount > 1 ? `<div class="ver-tag">v${versionCount}</div>` : ''}
                    </div>
                    <div class="doc-info">
                        <div class="doc-name">${d.name}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px">
                            <span class="sector-tag">${d.sector || 'General'}</span>
                            <span style="font-size:0.7rem; color:var(--tx3)">${d.date}</span>
                        </div>
                    </div>
                    <div class="doc-actions">
                        <button class="delbtn sm" onclick="event.stopPropagation(); deleteDocument('${d.id}')">✕</button>
                    </div>
                </div>
            `}).join("") || '<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--tx3)">No hay archivos que coincidan con los filtros.</div>'}
        </div>
    </div>

    <style>
        .doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
        .doc-card { padding: 0; overflow: hidden; cursor: pointer; position: relative; transition: transform 0.2s; border: 1px solid var(--bor); background: var(--sur); }
        .doc-card:hover { transform: translateY(-4px); border-color: var(--acc); box-shadow: var(--sha-lg); }
        .doc-preview { height: 150px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--bor); position: relative; background: var(--sur2); }
        .ver-tag { position: absolute; top: 8px; left: 8px; background: var(--acc); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; }
        .doc-info { padding: 12px; }
        .doc-name { font-weight: 700; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--tx); }
        .sector-tag { font-size: 0.65rem; background: var(--sur2); color: var(--tx3); padding: 2px 6px; border-radius: 99px; font-weight: 700; text-transform: uppercase; }
        .doc-actions { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity 0.2s; }
        .doc-card:hover .doc-actions { opacity: 1; }
    </style>
    `;
}

function filterDocs(cat) { state._docFilter = cat; renderDocuments(); }
function filterSector(sec) { state._sectorFilter = sec; renderDocuments(); }

let _tempFiles = [];
function handleUpload(input) {
    _tempFiles = Array.from(input.files);
    if (_tempFiles.length === 0) return;
    
    const proj = getActiveProject();
    const sectors = proj.execution.sectors || ["Cocina", "Estar", "Baños", "Dormitorios", "Fachada", "Jardín"];
    
    showModal('upload_config', { count: _tempFiles.length, sectors });
}

window.modals.upload_config = ({ count, sectors }) => `
    <div class="modal-title">Configurar Subida de Archivos<button class="delbtn" onclick="closeModal()">✕</button></div>
    <p style="font-size:0.9rem; color:var(--tx2); margin-bottom:15px">Estás por subir <strong>${count}</strong> archivo(s).</p>
    
    <div style="margin-bottom:15px">
        <label class="stat-lbl">Categoría General</label>
        <select id="up-cat">
            <option value="Fotos">Fotos de Obra</option>
            <option value="Planos">Planos / Planillas</option>
            <option value="Contratos">Contratos</option>
            <option value="Facturas">Facturas / Recibos</option>
        </select>
    </div>

    <div id="sector-wrap" style="margin-bottom:20px">
        <label class="stat-lbl">Sector de la Obra (solo para fotos)</label>
        <select id="up-sector">
            ${sectors.map(s => `<option value="${s}">${s}</option>`).join("")}
            <option value="General">General / Otros</option>
        </select>
    </div>

    <div class="info-box" style="margin-bottom:20px">
        <p style="font-size:0.8rem">Si un archivo tiene el mismo nombre que uno existente, se guardará como una <strong>nueva versión</strong> automáticamente.</p>
    </div>

    <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="processUpload()">Completar Subida ✓</button>
    </div>
`;

function processUpload() {
    const proj = getActiveProject();
    if (!proj) return;
    const category = document.getElementById("up-cat").value;
    const sector = document.getElementById("up-sector").value;
    
    if (!proj.execution.documents) proj.execution.documents = [];
    
    let loaded = 0;
    _tempFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const isImg = file.type.startsWith('image/');
            const url = isImg ? e.target.result : null;
            const today = new Date().toLocaleDateString('es-PY');

            // Buscar si ya existe un documento con el mismo nombre y categoría/sector
            const existing = proj.execution.documents.find(d => d.name === file.name && d.category === category && (category !== 'Fotos' || d.sector === sector));

            if (existing) {
                // Agregar versión
                if (!existing.versions) existing.versions = [{ id: Date.now() - 1000, url: existing.url, date: existing.date }];
                existing.versions.push({ id: Date.now(), url: url, date: today });
                existing.date = today;
                existing.url = url; // Mantener compatible
            } else {
                // Crear nuevo
                proj.execution.documents.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: isImg ? 'photo' : 'file',
                    category: category,
                    sector: category === 'Fotos' ? sector : 'General',
                    date: today,
                    url: url,
                    versions: [{ id: Date.now(), url: url, date: today }]
                });
            }

            loaded++;
            if (loaded === _tempFiles.length) {
                save();
                renderDocuments();
                closeModal();
                toast(`${loaded} archivo(s) procesado(s) ✓`);
            }
        };

        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file.slice(0, 100));
        }
    });
}

function deleteDocument(id) {
    const proj = getActiveProject();
    if (!proj) return;
    if (typeof id === 'string' && id.startsWith('log-')) {
        toast("Las fotos de bitácora deben borrarse desde el Libro de Obra", false);
        return;
    }
    if (!confirm("¿Eliminar este documento y todas sus versiones?")) return;
    proj.execution.documents = (proj.execution.documents || []).filter(d => d.id != id);
    save();
    renderDocuments();
}

function viewDocument(id) {
    const proj = getActiveProject();
    if (!proj) return;
    const dailyLogs = proj.execution.dailyLogs || [];
    const docs = proj.execution.documents || [];
    
    // Buscar en documentos subidos o en logs
    let doc = docs.find(d => d.id == id);
    if (!doc) {
        doc = dailyLogs.flatMap(l => (l.photos || []).map(p => ({
            id: 'log-' + l.id,
            url: p,
            name: `Foto ${l.date}`,
            category: 'Bitácora',
            sector: 'General',
            date: l.date,
            versions: [{ id: Date.now(), url: p, date: l.date }]
        }))).find(d => d.id == id);
    }

    if (!doc) return;
    showModal('viewer', doc);
}

window.modals.viewer = (doc) => {
    const currentVersion = doc.versions ? doc.versions[doc.versions.length - 1] : { url: doc.url, date: doc.date };
    const historyHtml = (doc.versions && doc.versions.length > 1) ? `
        <div style="margin-top:20px; border-top:1px solid var(--bor); padding-top:15px">
            <h4 style="font-size:0.8rem; text-transform:uppercase; color:var(--tx3); margin-bottom:10px">Historial de Versiones</h4>
            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px">
                ${doc.versions.map((v, i) => `
                    <div class="ver-item" onclick="updateViewerImage('${v.url}', '${v.date}', ${i+1})" style="min-width:80px; cursor:pointer">
                        <div style="width:80px; height:60px; background:url(${v.url}) center/cover; border-radius:4px; border:2px solid var(--bor)"></div>
                        <div style="font-size:0.65rem; text-align:center; margin-top:4px; font-weight:700">v${i+1}</div>
                        <div style="font-size:0.6rem; text-align:center; color:var(--tx3)">${v.date}</div>
                    </div>
                `).join("")}
            </div>
        </div>
    ` : "";

    return `
    <div class="modal-title" style="display:flex; justify-content:space-between; align-items:center">
        <div>
            <div id="view-name">${doc.name}</div>
            <div style="font-size:0.7rem; color:var(--tx3); font-weight:normal">Sector: ${doc.sector || 'General'} · <span id="view-ver">Versión Actual</span></div>
        </div>
        <button class="delbtn" onclick="closeModal()">✕</button>
    </div>
    <div style="text-align:center; background:#000; border-radius:var(--rad); overflow:hidden; margin-bottom:15px; display:flex; align-items:center; justify-content:center; min-height:350px">
        ${currentVersion.url ? `<img id="main-view-img" src="${currentVersion.url}" style="max-width:100%; max-height:65vh; display:block; margin:0 auto">` : `<div style="padding:100px; color:#fff"><div style="font-size:4rem">📄</div><div>Archivo: ${doc.category}</div></div>`}
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center">
        <div style="font-size:0.85rem; color:var(--tx3)">Subido el: <strong id="view-date">${currentVersion.date}</strong></div>
        <div style="display:flex; gap:10px">
            ${currentVersion.url ? `<a href="${currentVersion.url}" download="${doc.name}" class="btn sm">⬇️ Descargar</a>` : ''}
            <button class="btn primary sm" onclick="closeModal()">Cerrar</button>
        </div>
    </div>
    ${historyHtml}
    `;
};

function updateViewerImage(url, date, ver) {
    const img = document.getElementById("main-view-img");
    const dateEl = document.getElementById("view-date");
    const verEl = document.getElementById("view-ver");
    if (img) img.src = url;
    if (dateEl) dateEl.textContent = date;
    if (verEl) verEl.textContent = "Versión " + ver;
}

window.modals.manage_sectors = () => {
    const proj = getActiveProject();
    const sectors = proj.execution.sectors || ["Cocina", "Estar", "Baños", "Dormitorios", "Fachada", "Jardín"];
    return `
        <div class="modal-title">Gestionar Sectores del Proyecto<button class="delbtn" onclick="closeModal()">✕</button></div>
        <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:15px">Definí los ambientes o sectores específicos de esta obra para organizar las fotos.</p>
        
        <div style="display:flex; gap:8px; margin-bottom:20px">
            <input id="new-sector-name" placeholder="Nuevo sector (ej: Quincho)" style="flex:1">
            <button class="btn primary" onclick="addSector()">+ Agregar</button>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; max-height:200px; overflow-y:auto; padding:5px">
            ${sectors.map(s => `
                <div class="sector-badge-edit" style="display:flex; align-items:center; gap:8px; background:var(--sur2); padding:5px 12px; border-radius:99px; border:1px solid var(--bor)">
                    <span style="font-size:0.85rem; font-weight:600">${s}</span>
                    <span style="cursor:pointer; color:var(--err); font-weight:800" onclick="removeSector('${s}')">✕</span>
                </div>
            `).join("")}
        </div>

        <div class="modal-acts">
            <button class="btn primary full" onclick="closeModal()">Listo ✓</button>
        </div>
    `;
};

function addSector() {
    const name = document.getElementById("new-sector-name").value.trim();
    if (!name) return;
    const proj = getActiveProject();
    if (!proj.execution.sectors) proj.execution.sectors = ["Cocina", "Estar", "Baños", "Dormitorios", "Fachada", "Jardín"];
    if (proj.execution.sectors.includes(name)) return toast("El sector ya existe", false);
    proj.execution.sectors.push(name);
    save();
    showModal('manage_sectors');
    renderDocuments();
}

function removeSector(name) {
    const proj = getActiveProject();
    proj.execution.sectors = proj.execution.sectors.filter(s => s !== name);
    save();
    showModal('manage_sectors');
    renderDocuments();
}
