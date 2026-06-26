/**
 * areas.js — Gestión de Áreas/Zonas de Obra
 * Dibujo vectorial sobre planos + asignación a fotografías
 */

const AREA_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16'];

function getAreas() {
  const p = getActiveProject();
  if (!p) return [];
  if (!state.areas) state.areas = {};
  if (!state.areas[p.id]) state.areas[p.id] = [];
  return state.areas[p.id];
}

function saveAreas() {
  save();
}

function renderAreas() {
  const el = document.getElementById("section-areas");
  if (!el) return;
  const p = getActiveProject();
  if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para gestionar áreas.</div>"; return; }

  const areas = getAreas();
  const planUrl = state._planImage?.[p.id];

  let h = `<div class="prices-wrap">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px">
      <div>
        <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">ÁREAS / ZONAS</h2>
        <p style="color:var(--tx3); font-size:0.9rem">Dibujá áreas sobre el plano y asigná fotos para documentar el progreso</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="btn sm" onclick="showUploadPlanModal()">📐 Cargar Plano</button>
        <button class="btn primary" onclick="showNewAreaModal()">➕ Agregar Área</button>
      </div>
    </div>`;

  // Resumen
  h += `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; margin-bottom:18px">
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem">${areas.length}</div><div class="dash-lbl">Áreas Definidas</div></div>
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem">${planUrl ? '✅' : '❌'}</div><div class="dash-lbl">Plano Cargado</div></div>
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem">${areas.filter(a => a.fotoCount).reduce((s, a) => s + (a.fotoCount || 0), 0)}</div><div class="dash-lbl">Fotos Taggeadas</div></div>
  </div>`;

  // Plano con áreas dibujadas
  if (planUrl) {
    h += `<div class="card" style="margin-bottom:18px; padding:15px">
      <h3 class="sec-lbl" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center">
        Plano de Obra
        <button class="delbtn" onclick="deletePlanImage()" title="Borrar plano">✕</button>
      </h3>
      <div style="position:relative; display:inline-block; max-width:100%; border:2px solid var(--bor); border-radius:var(--rad); overflow:hidden">
        ${isPdfDataUrl(planUrl)
          ? `<embed id="plan-canvas-img" src="${planUrl}" type="application/pdf" style="max-width:100%; display:block; min-height:400px">`
          : `<img id="plan-canvas-img" src="${planUrl}" style="max-width:100%; display:block" crossorigin="anonymous">`
        }
        <canvas id="area-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair"></canvas>
        <div id="area-tooltip" style="position:absolute; display:none; background:rgba(0,0,0,0.8); color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem; pointer-events:none; z-index:10"></div>
      </div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; font-size:0.8rem; color:var(--tx3)">
        <span>🖱️ Hacé clic en "➕ Agregar Área" y dibujá un rectángulo sobre el plano</span>
      </div>
    </div>`;

    // Leyenda de áreas
    if (areas.length > 0) {
      h += `<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px">`;
      areas.forEach(a => {
        h += `<div style="display:flex; align-items:center; gap:6px; padding:4px 10px; background:var(--sur2); border-radius:20px; border-left:4px solid ${a.color}">
          <span style="font-size:0.8rem; font-weight:600">${escapeHtml(a.name)}</span>
          <span style="font-size:0.65rem; color:var(--tx3)">${a.fotoCount || 0} fotos</span>
        </div>`;
      });
      h += `</div>`;
    }
  } else {
    h += `<div class="card" style="margin-bottom:18px; padding:30px; text-align:center">
      <p style="font-size:2rem; margin-bottom:10px">📐</p>
      <p style="color:var(--tx3)">Cargá el plano de la obra para empezar a dibujar áreas.</p>
      <button class="btn primary" style="margin-top:10px" onclick="showUploadPlanModal()">📐 Cargar Plano</button>
    </div>`;
  }

  // Lista de áreas
  if (areas.length > 0) {
    h += `<div class="card"><h3 class="sec-lbl">Áreas Definidas</h3>
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; margin-top:12px">`;
    areas.forEach((a, idx) => {
      h += `<div style="background:var(--sur2); border-radius:var(--rad); padding:12px; border-left:4px solid ${a.color}">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <div style="font-weight:700; font-size:0.9rem">${escapeHtml(a.name)}</div>
          <div style="display:flex; gap:4px">
            <button class="delbtn sm" onclick="editAreaName('${a.id}')" title="Renombrar">✏️</button>
            <button class="delbtn sm" onclick="deleteArea('${a.id}')" title="Eliminar">✕</button>
          </div>
        </div>
        <div style="font-size:0.75rem; color:var(--tx3); margin-top:4px">
          ${a.rect ? `📍 ${Math.round(a.rect.w * 100)}×${Math.round(a.rect.h * 100)}% del plano` : 'Sin rectángulo'}
        </div>
        <div style="font-size:0.75rem; color:var(--tx3)">📷 ${a.fotoCount || 0} fotos asociadas</div>
      </div>`;
    });
    h += `</div></div>`;
  }

  h += `</div>`;
  el.innerHTML = h;

  // Dibujar áreas en canvas después de renderizar
  if (planUrl) {
    if (isPdfDataUrl(planUrl)) {
      setTimeout(function() { drawAreaRects(); initAreaCanvas(); }, 500);
    } else {
      const img = document.getElementById("plan-canvas-img");
      function onReady() { drawAreaRects(); initAreaCanvas(); }
      if (img) {
        img.onload = onReady;
        if (img.complete) onReady();
      }
    }
  }
}

// ── CANVAS DRAWING ────────────────────────────────────────────────────
let _drawingMode = false;
let _drawStart = null;
let _currentRect = null;
let _drawingAreaId = null;

function initAreaCanvas() {
  const canvas = document.getElementById("area-overlay");
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  canvas.onmousedown = function(e) {
    if (!_drawingMode) return;
    const r = canvas.getBoundingClientRect();
    _drawStart = { x: (e.clientX - r.left) / canvas.width, y: (e.clientY - r.top) / canvas.height };
    _currentRect = { x: _drawStart.x, y: _drawStart.y, w: 0, h: 0 };
  };

  canvas.onmousemove = function(e) {
    if (!_drawingMode || !_drawStart) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) / canvas.width;
    const my = (e.clientY - r.top) / canvas.height;
    _currentRect = {
      x: Math.min(_drawStart.x, mx),
      y: Math.min(_drawStart.y, my),
      w: Math.abs(mx - _drawStart.x),
      h: Math.abs(my - _drawStart.y)
    };
    drawAreaRects();
    // Dibujar rectángulo actual
    const ctx = canvas.getContext('2d');
    if (ctx && _currentRect.w > 0.01 && _currentRect.h > 0.01) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(_currentRect.x * canvas.width, _currentRect.y * canvas.height, _currentRect.w * canvas.width, _currentRect.h * canvas.height);
      ctx.setLineDash([]);
      // tooltip
      const tooltip = document.getElementById("area-tooltip");
      if (tooltip) {
        tooltip.style.display = "block";
        tooltip.style.left = (e.clientX - canvas.getBoundingClientRect().left + 10) + "px";
        tooltip.style.top = (e.clientY - canvas.getBoundingClientRect().top - 30) + "px";
        tooltip.textContent = Math.round(_currentRect.w * 100) + "% × " + Math.round(_currentRect.h * 100) + "%";
      }
    }
  };

  canvas.onmouseup = function(e) {
    if (!_drawingMode || !_drawStart || !_currentRect) return;
    _drawingMode = false;
    canvas.style.cursor = 'crosshair';
    document.getElementById("area-tooltip").style.display = "none";
    if (_currentRect.w < 0.02 || _currentRect.h < 0.02) {
      _drawStart = null; _currentRect = null;
      return;
    }
    // Prompt para nombrar el área
    const name = prompt("Nombre del área (ej: Sala de estar, Cocina, Baño principal):");
    if (name && name.trim()) {
      const areas = getAreas();
      const color = AREA_COLORS[areas.length % AREA_COLORS.length];
      const newArea = {
        id: 'area_' + Date.now(),
        name: name.trim(),
        color: color,
        rect: { x: _currentRect.x, y: _currentRect.y, w: _currentRect.w, h: _currentRect.h },
        fotoCount: 0
      };
      areas.push(newArea);
      saveAreas();
      renderAreas();
      toast("Área «" + name.trim() + "» agregada ✓");
    } else {
      drawAreaRects();
    }
    _drawStart = null; _currentRect = null;
  };

  canvas.onmouseleave = function() {
    document.getElementById("area-tooltip").style.display = "none";
  };
}

function drawAreaRects() {
  const canvas = document.getElementById("area-overlay");
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const areas = getAreas();
  areas.forEach(a => {
    if (!a.rect) return;
    const x = a.rect.x * canvas.width;
    const y = a.rect.y * canvas.height;
    const w = a.rect.w * canvas.width;
    const h = a.rect.h * canvas.height;
    ctx.fillStyle = a.color + '30';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = a.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(a.name, x + 4, y + 14);
  });
}

// ── MODALES ───────────────────────────────────────────────────────────
function showUploadPlanModal() {
  const el = document.getElementById("modal-area");
  el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px">
    <div class="modal-title">📐 Cargar Plano de Obra<button class="delbtn" onclick="closeModal()">✕</button></div>
    <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:14px">Subí una imagen o PDF del plano (planta, corte, fachada) para dibujar áreas sobre él.</p>
    <div style="display:flex; flex-direction:column; gap:12px; align-items:center">
      <div style="width:100%; height:200px; border:2px dashed var(--bor); border-radius:var(--rad); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; background:var(--sur2); overflow:hidden" onclick="document.getElementById('plan-upload-input').click()">
        <div id="plan-upload-placeholder" style="text-align:center; padding:20px">
          <div style="font-size:2rem; margin-bottom:8px">📐</div>
          <div style="font-size:0.85rem; color:var(--tx3)">Hacé clic para seleccionar un plano</div>
          <div style="font-size:0.7rem; color:var(--tx3); margin-top:4px">PNG, JPG, WebP o PDF</div>
        </div>
        <img id="plan-preview" style="max-width:100%; max-height:200px; display:none">
        <embed id="plan-preview-embed" style="max-width:100%; max-height:200px; display:none" type="application/pdf">
      </div>
      <input type="file" id="plan-upload-input" accept="image/*,application/pdf" style="display:none" onchange="previewPlanImage(this)">
      <div style="font-size:0.8rem; color:var(--tx3)" id="plan-file-info"></div>
    </div>
    <div class="modal-acts">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="savePlanImage()">Confirmar Plano ✅</button>
    </div>
  </div></div>`;
}

let _tempPlanDataUrl = null;

function isPdfDataUrl(url) {
  return url && url.startsWith('data:application/pdf');
}

function previewPlanImage(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  document.getElementById("plan-file-info").textContent = file.name + " (" + Math.round(file.size / 1024) + " KB)" + (isPdf ? ' 📄 PDF' : '');
  const reader = new FileReader();
  reader.onload = function(e) {
    _tempPlanDataUrl = e.target.result;
    document.getElementById("plan-upload-placeholder").style.display = "none";
    if (isPdf) {
      const embed = document.getElementById("plan-preview-embed");
      embed.src = _tempPlanDataUrl;
      embed.style.display = "block";
      document.getElementById("plan-preview").style.display = "none";
    } else {
      const img = document.getElementById("plan-preview");
      img.src = _tempPlanDataUrl;
      img.style.display = "block";
      document.getElementById("plan-preview-embed").style.display = "none";
    }
  };
  reader.readAsDataURL(file);
}

function savePlanImage() {
  const p = getActiveProject();
  if (!p || !_tempPlanDataUrl) return toast("Seleccioná un plano primero", false);
  if (!state._planImage) state._planImage = {};
  state._planImage[p.id] = _tempPlanDataUrl;
  state._planIsPdf = state._planIsPdf || {};
  state._planIsPdf[p.id] = isPdfDataUrl(_tempPlanDataUrl);
  _tempPlanDataUrl = null;
  saveAreas();
  closeModal();
  renderAreas();
  toast("Plano cargado ✅ — Ahora dibujá áreas sobre él");
}

function deletePlanImage() {
  if (!confirm("¿Borrar el plano y todas las áreas dibujadas?")) return;
  const p = getActiveProject();
  if (!p) return;
  if (state._planImage) delete state._planImage[p.id];
  if (state._planIsPdf) delete state._planIsPdf[p.id];
  if (state.areas && state.areas[p.id]) { state.areas[p.id] = []; }
  saveAreas();
  renderAreas();
  toast("Plano eliminado");
}

function showNewAreaModal() {
  const p = getActiveProject();
  if (!p) return toast("Seleccioná un proyecto", false);
  const planUrl = state._planImage?.[p.id];
  if (!planUrl) { toast("Primero cargá el plano 📐", false); showUploadPlanModal(); return; }

  const el = document.getElementById("modal-area");
  el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px">
    <div class="modal-title">➕ Agregar Área<button class="delbtn" onclick="closeModal()">✕</button></div>
    <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:10px">Dibujá un rectángulo sobre el plano haciendo clic, arrastrando y soltando.</p>
    <div style="position:relative; border:2px solid var(--bor); border-radius:var(--rad)">
      ${isPdfDataUrl(planUrl)
        ? `<embed id="area-draw-img" src="${planUrl}" type="application/pdf" style="max-width:100%; display:block; min-height:300px">`
        : `<img id="area-draw-img" src="${planUrl}" style="max-width:100%; display:block">`
      }
      <canvas id="area-draw-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair"></canvas>
    </div>
    <div id="area-draw-status" style="font-size:0.85rem; color:var(--tx3); margin-top:8px; text-align:center">Hacé clic y arrastrá sobre el plano para dibujar el área</div>
    <div class="modal-acts">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="closeModal(); renderAreas()">Listo ✓</button>
    </div>
  </div></div>`;

  // Inicializar canvas de dibujo en el modal
  setTimeout(function() {
    const canvas = document.getElementById("area-draw-canvas");
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Dibujar áreas existentes
    const areas = getAreas();
    const ctx = canvas.getContext('2d');

    function redraw(excludeId) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      areas.filter(a => a.id !== excludeId).forEach(a => {
        if (!a.rect) return;
        const x = a.rect.x * canvas.width, y = a.rect.y * canvas.height;
        const w = a.rect.w * canvas.width, h = a.rect.h * canvas.height;
        ctx.fillStyle = a.color + '30';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = a.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(a.name, x + 4, y + 14);
      });
    }
    redraw();

    let start = null, current = null, drawing = false;

    canvas.onmousedown = function(e) {
      drawing = true;
      const r = canvas.getBoundingClientRect();
      start = { x: (e.clientX - r.left) / canvas.width, y: (e.clientY - r.top) / canvas.height };
    };

    canvas.onmousemove = function(e) {
      if (!drawing || !start) return;
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) / canvas.width;
      const my = (e.clientY - r.top) / canvas.height;
      current = { x: Math.min(start.x, mx), y: Math.min(start.y, my), w: Math.abs(mx - start.x), h: Math.abs(my - start.y) };
      redraw();
      if (current.w > 0.01 && current.h > 0.01) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(current.x * canvas.width, current.y * canvas.height, current.w * canvas.width, current.h * canvas.height);
        ctx.setLineDash([]);
      }
    };

    canvas.onmouseup = function(e) {
      if (!drawing || !start || !current) { drawing = false; return; }
      drawing = false;
      if (current.w < 0.02 || current.h < 0.02) { start = null; current = null; return; }

      const name = prompt("Nombre del área:");
      if (name && name.trim()) {
        const color = AREA_COLORS[areas.length % AREA_COLORS.length];
        areas.push({ id: 'area_' + Date.now(), name: name.trim(), color: color, rect: { x: current.x, y: current.y, w: current.w, h: current.h }, fotoCount: 0 });
        saveAreas();
        redraw();
        document.getElementById("area-draw-status").textContent = "✅ Área «" + name.trim() + "» agregada — seguí dibujando o hacé clic en Listo";
      } else {
        redraw();
      }
      start = null; current = null;
    };
  }, 100);
}

function editAreaName(id) {
  const areas = getAreas();
  const a = areas.find(x => x.id === id);
  if (!a) return;
  const name = prompt("Nuevo nombre para el área:", a.name);
  if (name && name.trim()) { a.name = name.trim(); saveAreas(); renderAreas(); }
}

function deleteArea(id) {
  if (!confirm("¿Eliminar esta área? Las fotos taggeadas no se perderán pero quedarán sin área.")) return;
  const areas = getAreas();
  const idx = areas.findIndex(a => a.id === id);
  if (idx > -1) { areas.splice(idx, 1); saveAreas(); renderAreas(); }
}

// ── HELPERS PARA FOTOS ───────────────────────────────────────────────
function getAreaSelectorHtml(selectedId) {
  const areas = getAreas();
  if (areas.length === 0) return '';
  let opts = areas.map(a => `<option value="${a.id}"${a.id === selectedId ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  return `<select class="area-selector" style="font-size:0.75rem; width:100%; margin-top:2px">
    <option value="">Sin área</option>
    ${opts}
  </select>`;
}

function getAreaName(id) {
  if (!id) return '';
  const areas = getAreas();
  const a = areas.find(x => x.id === id);
  return a ? a.name : '';
}

function getAreaColor(id) {
  if (!id) return '#888';
  const areas = getAreas();
  const a = areas.find(x => x.id === id);
  return a ? a.color : '#888';
}

function getPhotoUrl(photo) {
  return typeof photo === 'string' ? photo : (photo.url || '');
}

function getPhotoAreaId(photo) {
  return typeof photo === 'object' ? (photo.areaId || '') : '';
}

function updateAreaFotoCounts() {
  const p = getActiveProject();
  if (!p) return;
  const areas = getAreas();
  const logs = p.execution.dailyLogs || [];
  areas.forEach(a => { a.fotoCount = 0; });
  logs.forEach(log => {
    (log.photos || []).forEach(ph => {
      const areaId = getPhotoAreaId(ph);
      if (areaId) {
        const a = areas.find(x => x.id === areaId);
        if (a) a.fotoCount = (a.fotoCount || 0) + 1;
      }
    });
  });
}
