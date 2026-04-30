/**
 * PLANOS Y GALERÍA - Puntero ERP
 * Repositorio de documentos y fotos de obra.
 */

function renderDocuments() {
    const el = document.getElementById("section-documents");
    if (!el) return;

    if (!state.documents) state.documents = [];

    // Combinar fotos de la bitácora con los documentos subidos
    const logPhotos = state.dailyLogs.flatMap(l => (l.photos || []).map(p => ({
        id: 'log-' + l.id,
        type: 'photo',
        category: 'Bitácora',
        name: `Foto ${l.date}`,
        date: l.date,
        url: p
    })));

    const allDocs = [...state.documents, ...logPhotos].sort((a, b) => new Date(b.date) - new Date(a.date));

    const categories = ['Todos', 'Planos', 'Fotos', 'Contratos', 'Facturas', 'Bitácora'];
    const currentCat = state._docFilter || 'Todos';

    const filtered = currentCat === 'Todos' ? allDocs : allDocs.filter(d => d.category === currentCat || (currentCat === 'Fotos' && d.type === 'photo'));

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <h2 class="sec-lbl" style="margin:0">Planos y Galería de Obra</h2>
            <button class="btn primary" onclick="document.getElementById('doc-upload').click()">+ Subir Documento / Foto</button>
            <input type="file" id="doc-upload" style="display:none" onchange="uploadDocument(this)" multiple>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:20px; overflow-x:auto; padding-bottom:5px">
            ${categories.map(c => `
                <button class="nbtn ${currentCat === c ? 'on' : ''}" onclick="filterDocs('${c}')">${c}</button>
            `).join("")}
        </div>

        <div class="doc-grid">
            ${filtered.map(d => `
                <div class="card doc-card" onclick="viewDocument('${d.id}')">
                    <div class="doc-preview" style="background: ${d.url ? `url(${d.url}) center/cover` : 'var(--sur2)'}">
                        ${!d.url ? `<span style="font-size:2rem">${d.category === 'Planos' ? '📐' : '📄'}</span>` : ''}
                    </div>
                    <div class="doc-info">
                        <div class="doc-name">${d.name}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px">
                            <span class="iva-badge" style="font-size:0.7rem">${d.category}</span>
                            <span style="font-size:0.7rem; color:var(--tx3)">${d.date}</span>
                        </div>
                    </div>
                    <div class="doc-actions">
                        <button class="delbtn sm" onclick="event.stopPropagation(); deleteDocument('${d.id}')">✕</button>
                    </div>
                </div>
            `).join("") || '<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--tx3)">No hay documentos en esta categoría.</div>'}
        </div>
    </div>

    <style>
        .doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
        .doc-card { padding: 0; overflow: hidden; cursor: pointer; position: relative; transition: transform 0.2s; }
        .doc-card:hover { transform: translateY(-4px); border-color: var(--acc); }
        .doc-preview { height: 140px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--bor); }
        .doc-info { padding: 10px; }
        .doc-name { font-weight: 700; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--tx); }
        .doc-actions { position: absolute; top: 5px; right: 5px; opacity: 0; transition: opacity 0.2s; }
        .doc-card:hover .doc-actions { opacity: 1; }
    </style>
    `;
}

function filterDocs(cat) {
    state._docFilter = cat;
    renderDocuments();
}

function uploadDocument(input) {
    const files = Array.from(input.files);
    if (!files.length) return;

    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const isImg = file.type.startsWith('image/');
            const category = isImg ? 'Fotos' : 'Planos';
            
            state.documents.push({
                id: Date.now() + Math.random(),
                name: file.name,
                type: isImg ? 'photo' : 'file',
                category: category,
                date: new Date().toLocaleDateString('es-PY'),
                url: isImg ? e.target.result : null // Guardar dataURL solo si es imagen para no saturar Storage
            });
            
            loaded++;
            if (loaded === files.length) {
                save();
                renderDocuments();
                toast(`${loaded} archivo(s) subido(s) ✓`);
            }
        };
        
        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            // Para PDFs u otros, por ahora solo guardamos el nombre (o podríamos usar un icono)
            reader.readAsText(file.slice(0, 100)); // Just to trigger onload
        }
    });
}

function deleteDocument(id) {
    if (id.startsWith('log-')) {
        toast("Las fotos de bitácora deben borrarse desde el Libro de Obra", false);
        return;
    }
    if (!confirm("¿Eliminar este documento?")) return;
    state.documents = state.documents.filter(d => d.id != id);
    save();
    renderDocuments();
}

function viewDocument(id) {
    const doc = [...state.documents, ...state.dailyLogs.flatMap(l => (l.photos || []).map(p => ({ id: 'log-' + l.id, url: p, name: `Foto ${l.date}`, category: 'Bitácora' })))].find(d => d.id == id);
    
    if (!doc) return;

    showModal('viewer', doc);
}

// Agregar modal de visor
window.modals = window.modals || {};
window.modals.viewer = (doc) => {
    return `
    <div class="modal-hdr">${doc.name}</div>
    <div style="text-align:center; background:#000; border-radius:var(--rad); overflow:hidden; margin-bottom:15px; display:flex; align-items:center; justify-content:center; min-height:300px">
        ${doc.url ? `<img src="${doc.url}" style="max-width:100%; max-height:70vh; display:block; margin:0 auto">` : `<div style="padding:100px; color:#fff"><div style="font-size:4rem">📄</div><div>Documento: ${doc.category}</div></div>`}
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center">
        <div style="font-size:0.85rem; color:var(--tx3)">Categoría: <strong>${doc.category}</strong></div>
        <button class="btn" onclick="closeModal()">Cerrar</button>
    </div>
    `;
};

// Necesitamos actualizar showModal en app.js para pasar el argumento 'doc' si existe.
