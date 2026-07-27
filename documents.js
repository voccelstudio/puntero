/**
 * CARPETA DEL PROYECTO — Puntero ERP
 * Gestión documental centralizada via File System Access API.
 * Lee archivos directo del disco del usuario, no guarda en el navegador.
 */

// Estado local de la sección carpeta
var _folderFiles = [];
var _folderLoading = false;
var _folderFilter = 'todos';
var _folderSearch = '';
var _folderView = 'grid'; // 'grid' | 'list'

// ── RENDER PRINCIPAL: CARPETA DEL PROYECTO ─────────────────────────────
function renderFolder() {
    var el = document.getElementById("section-folder");
    if (!el) return;
    var p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }

    var status = getProjectFolderStatus(p);

    if (status === 'unsupported') {
        el.innerHTML = renderFolderUnsupported();
        return;
    }

    if (status === 'none') {
        el.innerHTML = renderFolderUnlinked(p);
        return;
    }

    // Linked — renderizar la carpeta completa
    el.innerHTML = renderFolderLinked(p);
    // Escanear archivos en background
    refreshFolderFiles(p);
}

function renderFolderUnsupported() {
    return '<div class="prices-wrap">' +
        '<div style="text-align:center;padding:60px 20px">' +
        '<div style="font-size:4rem;margin-bottom:16px">🌐</div>' +
        '<h2 style="font-family:var(--font-display);font-weight:800;margin-bottom:8px">Navegador No Soportado</h2>' +
        '<p style="color:var(--tx3);max-width:400px;margin:0 auto">Tu navegador no soporta la API de Acceso al Sistema de Archivos. Para usar carpetas en disco, abrí la app en <strong>Chrome, Edge o Brave</strong>.</p>' +
        '<p style="color:var(--tx3);font-size:0.85rem;margin-top:12px">Mientras tanto, los archivos se guardan en el navegador (base64).</p>' +
        '</div></div>';
}

function renderFolderUnlinked(p) {
    return '<div class="prices-wrap">' +
        '<div style="text-align:center;padding:60px 20px">' +
        '<div style="font-size:4rem;margin-bottom:16px">📂</div>' +
        '<h2 style="font-family:var(--font-display);font-weight:800;margin-bottom:8px">Sin Carpeta Vinculada</h2>' +
        '<p style="color:var(--tx3);max-width:450px;margin:0 auto 20px">Vinculá una carpeta en tu PC para que <strong>' + escapeHtml(p.name) + '</strong> tenga su propio repositorio de archivos: fotos, planos, PDFs, contratos y más.</p>' +
        '<button class="btn primary" onclick="linkProjectFolder()" style="font-size:1rem;padding:12px 24px">📂 Vincular Carpeta</button>' +
        '</div></div>';
}

function renderFolderLinked(p) {
    var cats = p.execution.folderCategories || DEFAULT_FOLDER_CATEGORIES;
    var totalFiles = _folderFiles.length;
    var totalSize = _folderFiles.reduce(function(s, f) { return s + (f.size || 0); }, 0);

    // Contar archivos por categoría
    var catCounts = {};
    cats.forEach(function(c) { catCounts[c.id] = 0; });
    _folderFiles.forEach(function(f) { if (catCounts[f.category] !== undefined) catCounts[f.category]++; });

    var activeFilter = _folderFilter;
    var filtered = activeFilter === 'todos' ? _folderFiles : _folderFiles.filter(function(f) { return f.category === activeFilter; });

    // Búsqueda
    if (_folderSearch) {
        var q = _folderSearch.toLowerCase();
        filtered = filtered.filter(function(f) { return f.name.toLowerCase().indexOf(q) !== -1; });
    }

    var h = '<div class="prices-wrap">' +
        // Header
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">' +
        '<div>' +
        '<h2 class="sec-lbl" style="margin:0">📂 CARPETA DEL PROYECTO</h2>' +
        '<p style="color:var(--tx3);font-size:0.85rem">' + escapeHtml(p.name) + ' · ' + p.execution.folderPath + '</p>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:0.8rem;color:var(--tx3)">' + totalFiles + ' archivos · ' + formatFileSize(totalSize) + '</span>' +
        '<button class="btn sm" onclick="refreshFolderScan()">🔄 Actualizar</button>' +
        '<button class="btn sm" onclick="unlinkProjectFolder()">.Desvincular</button>' +
        '</div></div>' +

        // Toolbar: búsqueda + subir + cámara
        '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
        '<div class="srch" style="flex:1;min-width:200px;margin:0"><span class="srch-ico">🔍</span><input placeholder="Buscar archivo..." value="' + escapeHtml(_folderSearch) + '" oninput="_folderSearch=this.value;renderFolderFiles()"></div>' +
        '<button class="btn sm" onclick="folderUploadFile()">📁 Subir Archivo</button>' +
        '<button class="btn sm primary" onclick="folderTakePhoto()">📸 Tomar Foto</button>' +
        '<input type="file" id="folder-file-input" style="display:none" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.rvt,.skp,.csv,.txt" onchange="handleFolderUpload(this)">' +
        '<input type="file" id="folder-cam-input" style="display:none" accept="image/*" capture="environment" onchange="handleFolderUpload(this)">' +
        '</div>' +

        // Sidebar + Grid
        '<div class="folder-layout">' +

        // Sidebar de categorías
        '<div class="folder-sidebar">' +
        '<div class="folder-cat-item' + (activeFilter === 'todos' ? ' active' : '') + '" onclick="_folderFilter=\'todos\';renderFolderFiles()">' +
        '<span class="folder-cat-icon">📋</span><span class="folder-cat-name">Todos</span>' +
        '<span class="folder-cat-count">' + totalFiles + '</span></div>';

    cats.forEach(function(cat) {
        var count = catCounts[cat.id] || 0;
        h += '<div class="folder-cat-item' + (activeFilter === cat.id ? ' active' : '') + '" onclick="_folderFilter=\'' + cat.id + '\';renderFolderFiles()">' +
            '<span class="folder-cat-icon">' + cat.icon + '</span><span class="folder-cat-name">' + cat.name + '</span>' +
            '<span class="folder-cat-count">' + count + '</span></div>';
    });

    h += '</div>' + // fin sidebar

        // Grid de archivos
        '<div class="folder-grid-area">' +
        '<div id="folder-files-container">';

    if (_folderLoading) {
        h += '<div style="text-align:center;padding:40px;color:var(--tx3)"><div style="font-size:2rem;margin-bottom:10px">⏳</div>Escaneando carpeta...</div>';
    } else if (filtered.length === 0) {
        h += '<div style="text-align:center;padding:60px 20px;color:var(--tx3)">' +
            '<div style="font-size:3rem;margin-bottom:12px">📁</div>' +
            '<p>No hay archivos' + (activeFilter !== 'todos' ? ' en esta categoría' : '') + '.</p>' +
            '<p style="font-size:0.85rem">Subí archivos con los botones de arriba o colocá archivos directamente en la carpeta de tu PC.</p>' +
            '</div>';
    } else {
        h += '<div class="folder-grid">';
        filtered.forEach(function(file) {
            h += renderFolderFileCard(file);
        });
        h += '</div>';
    }

    h += '</div></div></div>' + // fin grid-area + folder-layout
        '</div>'; // fin prices-wrap

    // Drag & drop overlay
    h += '<div id="folder-drop-overlay" class="folder-drop-overlay" style="display:none">' +
        '<div class="folder-drop-msg">📂 Soltá los archivos aquí</div></div>';

    return h;
}

function renderFolderFileCard(file) {
    var isImg = file.type && file.type.startsWith('image/');
    var isPdf = file.type === 'application/pdf';
    var isVideo = file.type && file.type.startsWith('video/');
    var preview = '';
    var iconFile = '📄';

    if (isPdf) iconFile = '📕';
    else if (file.type && (file.type.includes('word') || file.type.includes('document'))) iconFile = '📝';
    else if (file.type && (file.type.includes('sheet') || file.type.includes('excel'))) iconFile = '📊';
    else if (file.type && file.type.includes('dwg')) iconFile = '📐';
    else if (file.type && file.type.includes('skp')) iconFile = '🏗️';

    if (isImg) {
        preview = '<div class="folder-file-thumb" data-file-cat="' + file.category + '" data-file-name="' + escapeHtml(file.name) + '"></div>';
    } else if (isVideo) {
        preview = '<div class="folder-file-preview"><span style="font-size:2.5rem">🎬</span></div>';
    } else if (isPdf) {
        preview = '<div class="folder-file-preview" style="background:rgba(239,68,68,0.08)"><span style="font-size:2.5rem">' + iconFile + '</span></div>';
    } else {
        preview = '<div class="folder-file-preview"><span style="font-size:2.5rem">' + iconFile + '</span></div>';
    }

    var catDef = (getActiveProject().execution.folderCategories || DEFAULT_FOLDER_CATEGORIES).find(function(c) { return c.id === file.category; });
    var catLabel = catDef ? catDef.name : file.category;
    var catIcon = catDef ? catDef.icon : '📁';

    return '<div class="folder-file-card" onclick="openFolderFile(\'' + escapeHtml(file.category) + '\',\'' + escapeHtml(file.name).replace(/'/g, "\\'") + '\')">' +
        '<div class="folder-file-actions">' +
        '<button class="delbtn sm" onclick="event.stopPropagation();deleteFolderFile(\'' + escapeHtml(file.category) + '\',\'' + escapeHtml(file.name).replace(/'/g, "\\'") + '\')" title="Eliminar">✕</button>' +
        '</div>' +
        preview +
        '<div class="folder-file-info">' +
        '<div class="folder-file-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>' +
        '<div class="folder-file-meta">' +
        '<span class="folder-file-cat">' + catIcon + ' ' + catLabel + '</span>' +
        '<span>' + formatFileSize(file.size) + '</span>' +
        '</div></div></div>';
}

function renderFolderFiles() {
    var p = getActiveProject();
    if (!p) return;
    var el = document.getElementById("section-folder");
    if (!el) return;
    el.innerHTML = renderFolderLinked(p);
    loadFolderThumbnails();
    setupFolderDragDrop();
}

async function refreshFolderFiles(p) {
    if (!p || !p.execution || !p.execution.folderHandle) return;
    _folderLoading = true;
    renderFolderFiles();

    var ok = await verifyFolderPermission(p.execution.folderHandle, false);
    if (!ok) {
        _folderLoading = false;
        _folderFiles = [];
        renderFolderFiles();
        return;
    }

    _folderFiles = await scanFolder(p.execution.folderHandle);
    _folderLoading = false;
    renderFolderFiles();
    loadFolderThumbnails();
    setupFolderDragDrop();
}

async function refreshFolderScan() {
    var p = getActiveProject();
    if (!p) return;
    _folderLoading = true;
    renderFolderFiles();
    _folderFiles = await scanFolder(p.execution.folderHandle);
    _folderLoading = false;
    renderFolderFiles();
    loadFolderThumbnails();
    setupFolderDragDrop();
    toast("Carpeta actualizada ✓");
}

function loadFolderThumbnails() {
    var p = getActiveProject();
    if (!p || !p.execution || !p.execution.folderHandle) return;
    var thumbs = document.querySelectorAll('.folder-file-thumb[data-file-cat]');
    thumbs.forEach(function(thumb) {
        var catName = thumb.dataset.fileCat;
        var fileName = thumb.dataset.fileName;
        // Buscar en _folderFiles el handle
        var file = _folderFiles.find(function(f) { return f.category === catName && f.name === fileName; });
        if (file && file.handle) {
            file.handle.getFile().then(function(blob) {
                var url = URL.createObjectURL(blob);
                thumb.style.backgroundImage = 'url(' + url + ')';
            });
        }
    });
}

// ── ACCIONES DE ARCHIVOS ───────────────────────────────────────────────

function folderUploadFile() {
    document.getElementById('folder-file-input').click();
}

function folderTakePhoto() {
    document.getElementById('folder-cam-input').click();
}

async function handleFolderUpload(input) {
    var p = getActiveProject();
    if (!p || !p.execution || !p.execution.folderHandle) return toast("Sin carpeta vinculada", false);
    var files = Array.from(input.files);
    if (!files.length) return;

    var ok = await verifyFolderPermission(p.execution.folderHandle, true);
    if (!ok) return toast("Sin permiso de escritura", false);

    var catName = _folderFilter !== 'todos'
        ? (p.execution.folderCategories || DEFAULT_FOLDER_CATEGORIES).find(function(c) { return c.id === _folderFilter; })?.name || 'Otros'
        : 'Otros';

    // Para fotos, van a "Fotos de Avance" por defecto
    var saved = 0;
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var isImg = file.type && file.type.startsWith('image/');
        var targetCat = isImg ? 'Fotos de Avance' : catName;
        var ok2 = await writeFileToFolder(p.execution.folderHandle, targetCat, file.name, file, file.type);
        if (ok2) saved++;
    }

    input.value = '';
    toast(saved + ' archivo(s) guardado(s) en disco ✓');
    refreshFolderScan();
}

async function openFolderFile(catId, fileName) {
    var p = getActiveProject();
    if (!p || !p.execution || !p.execution.folderHandle) return;
    var file = _folderFiles.find(function(f) { return f.category === catId && f.name === fileName; });
    if (!file || !file.handle) return;

    var blob = await file.handle.getFile();
    var url = URL.createObjectURL(blob);
    var isImg = blob.type.startsWith('image/');
    var isPdf = blob.type === 'application/pdf';
    var isVideo = blob.type.startsWith('video/');

    var el = document.getElementById("modal-area");
    var content = '';

    if (isImg) {
        content = '<img src="' + url + '" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;touch-action:pinch-zoom" ondblclick="this.style.maxWidth=this.style.maxWidth===\'200%\'?\'100%\':\'200%\'">';
    } else if (isVideo) {
        content = '<video src="' + url + '" controls style="max-width:100%;max-height:70vh;display:block;margin:0 auto"></video>';
    } else if (isPdf) {
        content = '<iframe src="' + url + '" style="width:100%;height:70vh;border:none;border-radius:var(--rad)"></iframe>';
    } else {
        content = '<div style="text-align:center;padding:60px 20px;color:#fff"><div style="font-size:4rem">📄</div><p style="margin-top:12px">' + escapeHtml(fileName) + '</p><p style="font-size:0.85rem;color:var(--tx3)">Vista previa no disponible para este tipo de archivo.</p></div>';
    }

    el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:900px">' +
        '<div class="modal-title">' + escapeHtml(fileName) + '<button class="delbtn" onclick="closeModal()">✕</button></div>' +
        '<div style="background:#000;border-radius:var(--rad);overflow:hidden;margin-bottom:15px;display:flex;align-items:center;justify-content:center;min-height:300px;max-height:70vh">' +
        content + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div style="font-size:0.85rem;color:var(--tx3)">Categoría: <strong>' + catId + '</strong> · Tamaño: ' + formatFileSize(file.size) + '</div>' +
        '<div style="display:flex;gap:6px">' +
        '<button class="btn" onclick="downloadFolderFile(\'' + escapeHtml(catId) + '\',\'' + escapeHtml(fileName).replace(/'/g, "\\'") + '\')">💾 Descargar</button>' +
        '<button class="btn" onclick="closeModal()">Cerrar</button>' +
        '</div></div></div></div>';
}

async function downloadFolderFile(catId, fileName) {
    var file = _folderFiles.find(function(f) { return f.category === catId && f.name === fileName; });
    if (!file || !file.handle) return;
    var blob = await file.handle.getFile();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function deleteFolderFile(catId, fileName) {
    if (!confirm('¿Eliminar "' + fileName + '" de la carpeta del proyecto?')) return;
    var p = getActiveProject();
    if (!p || !p.execution || !p.execution.folderHandle) return;
    var file = _folderFiles.find(function(f) { return f.category === catId && f.name === fileName; });
    if (!file || !file.handle) return;
    var ok = await deleteFileFromFolder(file.handle);
    if (ok) {
        toast("Archivo eliminado ✓");
        refreshFolderScan();
    } else {
        toast("No se pudo eliminar", false);
    }
}

// ── VINCULAR / DESVINCULAR CARPETA ─────────────────────────────────────

async function linkProjectFolder() {
    var p = getActiveProject();
    if (!p) return;
    var ok = await initProjectFolder(p);
    if (ok) {
        renderFolder();
    }
}

function unlinkProjectFolder() {
    if (!confirm("¿Desvincular la carpeta del proyecto?\n\nLos archivos NO se borran del disco. Solo se desconecta la referencia de la app.")) return;
    var p = getActiveProject();
    if (!p) return;
    p.execution.folderHandle = null;
    p.execution.folderPath = '';
    _folderFiles = [];
    save();
    renderFolder();
    toast("Carpeta desvinculada");
}

// ── DRAG & DROP ────────────────────────────────────────────────────────

function setupFolderDragDrop() {
    var container = document.getElementById('section-folder');
    if (!container) return;
    var overlay = document.getElementById('folder-drop-overlay');
    var dragCounter = 0;

    container.addEventListener('dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (overlay) overlay.style.display = 'flex';
    });

    container.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (overlay) overlay.style.display = 'none';
        }
    });

    container.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    container.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        if (overlay) overlay.style.display = 'none';

        var p = getActiveProject();
        if (!p || !p.execution || !p.execution.folderHandle) return toast("Sin carpeta vinculada", false);

        var ok = await verifyFolderPermission(p.execution.folderHandle, true);
        if (!ok) return toast("Sin permiso de escritura", false);

        var files = Array.from(e.dataTransfer.files);
        if (!files.length) return;

        var saved = 0;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var isImg = file.type && file.type.startsWith('image/');
            var targetCat = isImg ? 'Fotos de Avance' : 'Otros';
            var ok2 = await writeFileToFolder(p.execution.folderHandle, targetCat, file.name, file, file.type);
            if (ok2) saved++;
        }
        toast(saved + ' archivo(s) guardado(s) ✓');
        refreshFolderScan();
    });
}

// ── LEGACY: renderDocuments (sección documentos antigua) ────────────────

function renderDocuments() {
    var el = document.getElementById("section-documents");
    if (!el) return;
    var proj = getActiveProject();
    if (!proj) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
    if (!proj.execution.documents) proj.execution.documents = [];
    var dailyLogs = proj.execution.dailyLogs || [];

    var logPhotos = dailyLogs.flatMap(function(l) { return (l.photos || []).map(function(p) {
        return {
            id: 'log-' + l.id + '-' + Math.random(),
            type: 'photo',
            category: 'Bitácora',
            name: 'Foto ' + formatDatePY(l.date),
            date: l.date,
            url: typeof p === 'string' ? p : (p.url || ''),
            areaId: typeof p === 'object' ? (p.areaId || '') : ''
        };
    }); });

    var allDocs = proj.execution.documents.concat(logPhotos).sort(function(a, b) { return parseDate(b.date) - parseDate(a.date); });

    var redirectMsg = getProjectFolderStatus(proj) === 'linked'
        ? '<div class="info-box" style="margin-bottom:15px"><p>📁 Usá la <strong><a href="#" onclick="setSection(\'folder\');return false" style="color:var(--acc)">Carpeta del Proyecto</a></strong> para gestionar archivos en disco.</p></div>'
        : '';

    var categories = ['Todos', 'Planos', 'Fotos', 'Contratos', 'Facturas', 'Bitácora'];
    var currentCat = state._docFilter || 'Todos';
    var filtered = currentCat === 'Todos' ? allDocs : allDocs.filter(function(d) { return d.category === currentCat || (currentCat === 'Fotos' && d.type === 'photo'); });

    el.innerHTML = '<div class="prices-wrap">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">' +
        '<h2 class="sec-lbl" style="margin:0">Planos y Galería de Obra</h2>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn primary" onclick="document.getElementById(\'doc-upload-cam\').click()">📸 Tomar foto</button>' +
        '<button class="btn" onclick="document.getElementById(\'doc-upload\').click()">📁 Subir archivo</button>' +
        '</div>' +
        '<input type="file" id="doc-upload-cam" accept="image/*" capture="environment" style="display:none" onchange="uploadDocument(this)">' +
        '<input type="file" id="doc-upload" style="display:none" onchange="uploadDocument(this)" multiple>' +
        '</div>' +
        redirectMsg +
        '<div style="display:flex;gap:10px;margin-bottom:20px;overflow-x:auto;padding-bottom:5px">' +
        categories.map(function(c) { return '<button class="nbtn ' + (currentCat === c ? 'on' : '') + '" onclick="filterDocs(\'' + c + '\')">' + c + '</button>'; }).join("") +
        '</div>' +
        '<div class="doc-grid">' +
        filtered.map(function(d) {
            return '<div class="card doc-card" onclick="viewDocument(\'' + d.id + '\')">' +
                '<div class="doc-preview" style="background:' + (d.url ? 'url(' + d.url + ') center/cover' : 'var(--sur2)') + '">' +
                (!d.url ? '<span style="font-size:2rem">' + (d.category === 'Planos' ? '📐' : '📄') + '</span>' : '') +
                '</div>' +
                '<div class="doc-info"><div class="doc-name">' + d.name + '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;flex-wrap:wrap;gap:2px">' +
                '<span class="iva-badge" style="font-size:0.7rem">' + d.category + '</span>' +
                '<span style="font-size:0.7rem;color:var(--tx3)">' + formatDatePY(d.date) + '</span></div></div>' +
                '<div class="doc-actions"><button class="delbtn sm" onclick="event.stopPropagation();deleteDocument(\'' + d.id + '\')">✕</button></div></div>';
        }).join("") || '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--tx3)">No hay documentos en esta categoría.</div>' +
        '</div></div>' +
        '<style>' +
        '.doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px}' +
        '.doc-card{padding:0;overflow:hidden;cursor:pointer;position:relative;transition:transform 0.2s}' +
        '.doc-card:hover{transform:translateY(-4px);border-color:var(--acc)}' +
        '.doc-preview{height:140px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--bor)}' +
        '.doc-info{padding:10px}' +
        '.doc-name{font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tx)}' +
        '.doc-actions{position:absolute;top:5px;right:5px;opacity:0;transition:opacity 0.2s}' +
        '.doc-card:hover .doc-actions{opacity:1}' +
        '</style>';
}

function filterDocs(cat) {
    state._docFilter = cat;
    renderDocuments();
}

function uploadDocument(input) {
    var proj = getActiveProject();
    if (!proj) return toast("Sin proyecto activo", false);
    if (!proj.execution.documents) proj.execution.documents = [];
    var files = Array.from(input.files);
    if (!files.length) return;
    var loaded = 0;
    files.forEach(function(file) {
        var reader = new FileReader();
        var fileType = file.type || '';
        reader.onload = function(e) {
            var isImg = fileType.startsWith('image/');
            proj.execution.documents.push({
                id: Date.now() + Math.random(),
                name: file.name,
                type: isImg ? 'photo' : 'file',
                category: isImg ? 'Fotos' : 'Planos',
                date: formatDatePY(new Date()),
                url: isImg ? e.target.result : null
            });
            loaded++;
            if (loaded === files.length) {
                save();
                renderDocuments();
                toast(loaded + ' archivo(s) subido(s) ✓');
            }
        };
        if (fileType.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file.slice(0, 100));
        }
    });
}

function deleteDocument(id) {
    var proj = getActiveProject();
    if (!proj) return;
    if (typeof id === 'string' && id.indexOf('log-') === 0) {
        toast("Las fotos de bitácora deben borrarse desde el Libro de Obra", false);
        return;
    }
    if (!confirm("¿Eliminar este documento?")) return;
    proj.execution.documents = (proj.execution.documents || []).filter(function(d) { return d.id != id; });
    save();
    renderDocuments();
}

function viewDocument(id) {
    var proj = getActiveProject();
    if (!proj) return;
    var dailyLogs = proj.execution.dailyLogs || [];
    var docs = proj.execution.documents || [];
    var allDocs = docs.concat(dailyLogs.flatMap(function(l) {
        return (l.photos || []).map(function(p, pi) {
            return { id: 'log-' + l.id + '-' + pi, url: typeof p === 'string' ? p : (p.url || ''), name: 'Foto ' + formatDatePY(l.date), category: 'Bitácora' };
        });
    }));
    var doc = allDocs.find(function(d) { return d.id == id; });
    if (!doc) return;
    showModal('viewer', doc);
}

window.modals = window.modals || {};
window.modals.viewer = function(doc) {
    return '<div class="modal-title">' + doc.name + '<button class="delbtn" onclick="closeModal()">✕</button></div>' +
        '<div style="text-align:center;background:#000;border-radius:var(--rad);overflow:auto;-webkit-overflow-scrolling:touch;margin-bottom:15px;display:flex;align-items:center;justify-content:center;min-height:300px;max-height:70vh">' +
        (doc.url ? '<img src="' + doc.url + '" style="max-width:100%;max-height:70vh;display:block;touch-action:pinch-zoom" ondblclick="this.style.maxWidth=this.style.maxWidth===\'200%\'?\'100%\':\'200%\'">' : '<div style="padding:80px 20px;color:#fff"><div style="font-size:4rem">📄</div><div style="margin-top:10px">Documento: ' + doc.category + '</div></div>') +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div style="font-size:0.85rem;color:var(--tx3)">Categoría: <strong>' + doc.category + '</strong></div>' +
        '<button class="btn" onclick="closeModal()">Cerrar</button></div>';
};
