// ── HELPERS ──────────────────────────────────────────────────────────────
const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); } };


const fmt = n => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  let val = n;
  let symbol = state.currency === "USD" ? "U$S " : "";
  let dec = 0;
  if (state.currency === "USD") {
    val = n / (state.exchangeRate || 7500);
    dec = 2;
  }
  return symbol + new Intl.NumberFormat("es-PY", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
};
const fmtRaw = (n, d = 0) => new Intl.NumberFormat("es-PY", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtD = (n, d = 2) => +n.toFixed(d);

// ── HELPERS DE FECHAS (todo PY: dd/mm/yyyy) ──────────────────────────────
/**
 * Formatea cualquier fecha como dd/mm/yyyy (formato paraguayo).
 * Acepta: Date, string ISO (yyyy-mm-dd), string dd/mm/yyyy, string d/m/yyyy (legacy), timestamp.
 * Devuelve "" si la entrada es inválida.
 */
function formatDatePY(input) {
  if (!input) return "";
  let d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "number") {
    d = new Date(input);
  } else if (typeof input === "string") {
    // Formato dd/mm/yyyy con ceros — devolver tal cual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return input;
    // Formato legacy d/m/yyyy o dd/m/yyyy (sin ceros — datos viejos guardados con toLocaleDateString)
    const pyLegacyMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (pyLegacyMatch) {
      const [, day, month, year] = pyLegacyMatch;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    // Formato ISO yyyy-mm-dd
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, day] = isoMatch;
      return `${day}/${m}/${y}`;
    }
    d = new Date(input);
  }
  if (!d || isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Devuelve la fecha de hoy en formato ISO (yyyy-mm-dd) para inputs HTML date.
 * Los <input type="date"> SIEMPRE usan ISO internamente, no se puede cambiar.
 */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Convierte cualquier formato a Date object para hacer cálculos/comparaciones.
 * Soporta dd/mm/yyyy, d/m/yyyy (legacy) y yyyy-mm-dd.
 */
function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    // dd/mm/yyyy o d/m/yyyy (paraguayo, con o sin ceros)
    const pyMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (pyMatch) {
      const [, d, m, y] = pyMatch;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    // yyyy-mm-dd (ISO)
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Genera un input de fecha custom que SIEMPRE muestra dd/mm/yyyy,
 * independiente del idioma del browser.
 *
 * Estrategia: <input type="date"> nativo (mantiene el contrato `this.value = ISO`
 * para todos los onchange existentes) + un overlay visual que muestra dd/mm/yyyy
 * encima de lo que el browser pinta. Cuando el usuario hace click, abre el picker
 * nativo. Cuando cambia el valor, el overlay se actualiza.
 *
 * @param {string} id          ID del input
 * @param {string} value       Valor inicial en formato ISO yyyy-mm-dd
 * @param {string} onchange    JS para onchange (recibe `this.value` en formato ISO)
 * @param {string} style       CSS inline extra
 * @param {string} cls         Clases CSS extra
 * @returns {string} HTML del componente
 */
function dateInputPY(id, value, onchange, style = "", cls = "") {
  const safeId = id || "date-" + Math.random().toString(36).slice(2, 9);
  const displayValue = value ? formatDatePY(value) : "dd/mm/aaaa";
  const wrappedOnchange = (onchange || "") + ";datePYUpdateLabel('" + safeId + "')";
  return `<span class="date-py-wrap ${cls}" style="position:relative; display:inline-block; ${style}">
    <input type="date" id="${safeId}" value="${value || ''}" class="date-py-native"
      onchange="${wrappedOnchange.replace(/"/g, '&quot;')}"
      style="opacity:0; position:absolute; inset:0; width:100%; height:100%; cursor:pointer; z-index:2; padding:0; border:none; margin:0">
    <span class="date-py-label" data-date-label-for="${safeId}"
      style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:8px 12px; border:1px solid var(--bor); border-radius:var(--rad); background:var(--bg); color:var(--tx); min-width:130px; font-size:14px; ${value ? '' : 'color:var(--tx3)'}">
      <span>${displayValue}</span>
      <span style="font-size:1rem">📅</span>
    </span>
  </span>`;
}

/**
 * Actualiza el label visible del componente dateInputPY tras un cambio.
 */
function datePYUpdateLabel(id) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const labels = document.querySelectorAll(`[data-date-label-for="${id}"] > span:first-child`);
  labels.forEach(l => {
    l.textContent = inp.value ? formatDatePY(inp.value) : "dd/mm/aaaa";
  });
  // Color del placeholder vs valor real
  const wraps = document.querySelectorAll(`[data-date-label-for="${id}"]`);
  wraps.forEach(w => {
    w.style.color = inp.value ? "var(--tx)" : "var(--tx3)";
  });
}

/**
 * Refresca todos los labels de todos los date inputs (útil tras render masivo).
 */
function datePYRefreshAll() {
  document.querySelectorAll("input.date-py-native").forEach(inp => {
    datePYUpdateLabel(inp.id);
  });
}

const waLink = p => {
  if (!p) return "";
  let clean = p.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = "595" + clean.substring(1);
  if (!clean.startsWith("595") && (clean.length === 9)) clean = "595" + clean;
  return `https://wa.me/${clean}`;
};

const DEFAULT_YIELDS = {
  "ESTRUCTURAS": 1.5,
  "FUNDACIONES": 2,
  "MAMPOSTERÍA": 15,
  "CONTRAPISOS": 30,
  "REVOQUES": 20,
  "TECHOS": 10,
  "PISOS": 15,
  "AISLACIÓN": 30,
  "PINTURAS": 40,
  "CARPINTERÍA MADERA": 5,
  "CARPINTERÍA METÁLICA": 5,
  "DESAGÜE CLOACAL": 10,
  "AGUA CORRIENTE": 15,
  "ARTEFACTOS SANITARIOS": 4,
  "INSTALACIÓN ELÉCTRICA": 15,
  "VARIOS": 5
};

function buildDB() {
  const db = {};
  for (const [cat, items] of Object.entries(DB_RAW)) {
    db[cat] = {};
    const pct = LABOR_PCT[cat] || 30;
    for (const [name, item] of Object.entries(items)) {
      const lab = Math.round(item.m * pct / 100);
      db[cat][name] = { unit: item.u, matCost: item.m, laborCost: lab, laborPct: pct, total: item.m + lab, mats: item.mats || [], y: item.y || null };
    }
  }
  return db;
}
let DB = buildDB();

// ── STATE ──────────────────────────────────────────────────────────────
let state = {
  section: "budget", expandedCat: "ESTRUCTURAS", search: "", items: [],
  projectName: "Nuevo Proyecto", clientName: "", clientPhone: "", clientAddress: "",
  profitPct: 0, validDays: 30, budgetNum: 1, notes: "", pdfShowBreakdown: false,
  priceEditMode: "total", editPriceKey: null, editField: "total", activeBudgetId: null,
  theme: "slate",
  ivaEnabled: false, ivaEnPDF: false,
  adjustPct: 0,
  profile: { company: "", professional: "", matricula: "", ruc: "", phone: "", email: "", address: "", instagram: "", whatsapp: "", website: "" },
  contractors: [], // Base de datos de contratistas
  ownTeam: [],     // [NUEVO] Personal propio global
  roles: {         // [NUEVO] Valores base de jornales
    "Ayudante": 80000,
    "Oficial": 130000,
    "Puntero": 180000
  },
  schedules: {},   
  projectStartDate: null, 
  dailyLogs: [],   
  staff: [],       
  priceHistory: [
    { name: "Cemento tipo 1 /kg", aug25: 1165, mar26: 1165, unit: "kg" },
    { name: "Arena lavada /m3", aug25: 62000, mar26: 63500, unit: "m3" },
    { name: "Varilla conf. Ø8mm /kg", aug25: 9600, mar26: 9600, unit: "kg" },
    { name: "Ladrillo común /un", aug25: 740, mar26: 740, unit: "un" },
    { name: "Teja española Yoayu /un", aug25: 1850, mar26: 1905, unit: "un" },
    { name: "Piedra triturada IV /tn", aug25: 132500, mar26: 132500, unit: "tn" },
    { name: "Látex interior /lt", aug25: 30000, mar26: 30000, unit: "lt" },
    { name: "Cal triturada /kg", aug25: 1238, mar26: 1238, unit: "kg" },
  ],
  logoDataUrl: "",
  signDataUrl: "",
  isPro: true, 
  suppliers: [],   
  paymentAlarms: [], 
  materialOrders: [], 
  finances: { income: [], expenses: [] }, 
  performance: { goals: [] }, 
  documents: [], 
  currency: "PYG", 
  exchangeRate: 7500, 
  projects: [],      
  activeProjectId: null, 
  activeAdendaId: null,  
  migratedV6: false, 
  migratedV7: false, // [NUEVO] Flag para geoloc y jornaleros
};

// Load state from localStorage
try {
  const s = localStorage.getItem("ppy_v5");
  if (s) {
    Object.assign(state, JSON.parse(s));
  } else {
    // Si no hay datos, cargar proyecto demo inicial
    loadDemoProject();
  }
  // Override Pro status to true
  state.isPro = true;
  migrateToMultiProject();
} catch (e) { }

try {
  const d = localStorage.getItem("ppy_db5");
  const cachedVersion = localStorage.getItem("ppy_db_version");
  if (d) {
    const cachedDB = JSON.parse(d);
    // Si la versión cacheada coincide con la actual, usarla tal cual
    if (cachedVersion === DB_VERSION) {
      DB = cachedDB;
    } else {
      // Si no, hacer merge: arrancar de la DB fresca (con categorías nuevas)
      // y sobrescribir con las ediciones manuales del usuario que existan
      const freshDB = buildDB();
      const mergedDB = JSON.parse(JSON.stringify(freshDB));
      // Aplicar ediciones del usuario sobre items que sigan existiendo
      for (const [cat, items] of Object.entries(cachedDB)) {
        if (mergedDB[cat]) {
          for (const [name, data] of Object.entries(items)) {
            if (mergedDB[cat][name]) {
              // Mantener precios editados por el usuario
              mergedDB[cat][name] = { ...mergedDB[cat][name], ...data };
            } else {
              // Item personalizado del usuario que no está en la nueva DB → conservarlo
              mergedDB[cat][name] = data;
            }
          }
        } else {
          // Categoría que el usuario tenía pero ya no está en la DB → conservarla
          mergedDB[cat] = items;
        }
      }
      DB = mergedDB;
      localStorage.setItem("ppy_db5", JSON.stringify(DB));
      localStorage.setItem("ppy_db_version", DB_VERSION);
      console.log("[DB] Migrada de", cachedVersion || "(sin versión)", "a", DB_VERSION, "— categorías nuevas añadidas, ediciones del usuario preservadas");
    }
  } else {
    localStorage.setItem("ppy_db_version", DB_VERSION);
  }
} catch (e) { console.warn("[DB] Error en merge, usando DB fresca:", e); }

applyTheme(state.theme);

function migrateToMultiProject() {
  if (state.migratedV6) return;
  
  if (state.budgets && state.budgets.length > 0) {
    let target = state.budgets.find(b => b.id === state.activeBudgetId);
    if (!target) target = state.budgets[state.budgets.length - 1];
    
    // Mover datos globales antiguos al proyecto "activo"
    if (target) {
      target.schedules = state.schedules || {};
      target.dailyLogs = state.dailyLogs || [];
      target.projectStartDate = state.projectStartDate || null;
      target.materialOrders = [];
      target.finances = { income: [], expenses: [] };
    }
  }
  
  state.migratedV6 = true;
  migrateToV8(); // Ejecutar nueva migración
  save();
}

function migrateToV8() {
    if (state.migratedV7) return;
    state.projects.forEach(p => {
        if (!p.location) p.location = { lat: null, lng: null, address: "", mapUrl: "" };
        if (!p.execution.dayWorkers) p.execution.dayWorkers = [];
        if (!p.execution.laborPayments) p.execution.laborPayments = [];
    });
    if (!state.ownTeam) state.ownTeam = [];
    if (!state.roles) {
        state.roles = { "Ayudante": 80000, "Oficial": 130000, "Puntero": 180000 };
    }
    state.migratedV7 = true;
}

/**
 * GESTIÓN DE MULTI-PROYECTOS Y ADENDAS
 */
function renderGlobalDashboard() {
    const el = document.getElementById("section-global_dashboard");
    if (!el) return;

    let urgentItems = [];
    const today = new Date();

    state.projects.forEach(p => {
        // 1. Pagos pendientes (Materiales)
        (p.execution.materialOrders || []).forEach(o => {
            if (!o.isPaid) {
                urgentItems.push({ project: p.name, type: '💰 Pago Materiales', desc: `Proveedor: ${o.supplier}`, amount: o.total, date: o.date, color: 'var(--err)' });
            }
        });

        // 2. Retrasos en Cronograma
        Object.entries(p.execution.schedules || {}).forEach(([itemId, sch]) => {
            if (sch.status !== 'done' && sch.end && new Date(sch.end) < today) {
                const adenda = p.budgets.find(b => b.items.find(i => i.id == itemId));
                const item = adenda ? adenda.items.find(i => i.id == itemId) : { name: 'Item desconocido' };
                urgentItems.push({ project: p.name, type: '⚠️ Retraso Obra', desc: item.name, amount: null, date: sch.end, color: 'var(--lab)' });
            }
        });

        // 3. Reclamos de Garantía Abiertos
        (p.execution.aftercare || []).forEach(claim => {
            if (claim.status !== 'resolved') {
                urgentItems.push({ project: p.name, type: '🔧 Garantía', desc: claim.title, amount: null, date: claim.date, color: 'var(--acc)' });
            }
        });
    });

    let h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <div>
                <h2 class="sec-lbl" style="margin:0">PANEL DE CONTROL GENERAL</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Resumen de urgencias en todas las obras</p>
            </div>
            <div class="db-badge" style="background:var(--sur2); color:var(--tx)">Total: ${state.projects.length} Obras</div>
        </div>

        <div class="dash-grid">
            <div class="dash-card" style="border-top:4px solid var(--err)">
                <div class="dash-num">${urgentItems.filter(i => i.type.includes('💰')).length}</div>
                <div class="dash-lbl">Pagos Pendientes</div>
            </div>
            <div class="dash-card" style="border-top:4px solid var(--warn)">
                <div class="dash-num">${urgentItems.filter(i => i.type.includes('⚠️')).length}</div>
                <div class="dash-lbl">Retrasos Detectados</div>
            </div>
            <div class="dash-card" style="border-top:4px solid var(--acc)">
                <div class="dash-num">${urgentItems.filter(i => i.type.includes('🔧')).length}</div>
                <div class="dash-lbl">Garantía / Reclamos</div>
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">📋 Acciones Urgentes / Prioridad</h3>
            <div class="scroll-area" style="max-height:600px">
                <table class="tbl">
                    <thead>
                        <tr>
                            <th>Proyecto</th>
                            <th>Tipo</th>
                            <th>Descripción</th>
                            <th>Fecha Límite / Venc.</th>
                            <th style="text-align:right">Monto</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${urgentItems.sort((a,b) => parseDate(a.date) - parseDate(b.date)).map(item => `
                            <tr>
                                <td style="font-weight:700">${item.project}</td>
                                <td><span class="iva-badge" style="background:${item.color}; color:white">${item.type}</span></td>
                                <td>${item.desc}</td>
                                <td>${formatDatePY(item.date)}</td>
                                <td style="text-align:right; font-weight:700">${item.amount ? fmt(item.amount) : '—'}</td>
                                <td><button class="btn sm" onclick="switchProjectFromName('${item.project.replace(/'/g, "\\'")}')">Ir →</button></td>
                            </tr>
                        `).join("") || '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--tx3)">No hay tareas urgentes detectadas. ¡Todo al día! 🚀</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    el.innerHTML = h;
}

function switchProjectFromName(name) {
    const p = state.projects.find(p => p.name === name);
    if (p) switchProject(p.id);
}

function renderAftercare() {
    const el = document.getElementById("section-aftercare");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }

    if (!p.execution.aftercare) p.execution.aftercare = [];

    let h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
            <div>
                <h2 class="sec-lbl" style="margin:0">GARANTÍA Y AJUSTES (POSTVENTA)</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Seguimiento de reclamos e intervenciones: <strong>${p.name}</strong></p>
            </div>
            <button class="btn primary" onclick="showModal('new_claim')">+ Nuevo Reclamo / Tarea</button>
        </div>

        <div class="con-grid">
            ${p.execution.aftercare.map((c, idx) => `
                <div class="card" style="border-left: 4px solid ${c.status === 'resolved' ? 'var(--ok)' : 'var(--warn)'}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px">
                        <span class="iva-badge" style="background:var(--sur2); color:var(--tx2)">${formatDatePY(c.date)}</span>
                        <span class="iva-badge" style="background:${c.status === 'resolved' ? 'var(--ok)' : 'var(--warn)'}; color:white">${c.status === 'resolved' ? 'RESUELTO' : 'PENDIENTE'}</span>
                    </div>
                    <h3 style="margin:0 0 8px 0; font-size:1.1rem">${c.title}</h3>
                    <p style="font-size:0.875rem; color:var(--tx2); margin-bottom:12px">${c.desc}</p>
                    <div style="display:flex; gap:10px">
                        ${c.status !== 'resolved' ? `<button class="btn sm ok-btn" onclick="updateClaimStatus(${idx}, 'resolved')">Marcar Resuelto</button>` : ''}
                        <button class="btn sm danger" onclick="deleteClaim(${idx})">✕ Eliminar</button>
                    </div>
                </div>
            `).join("") || '<div class="fullcol empty">No hay reclamos registrados.</div>'}
        </div>
    </div>`;

    el.innerHTML = h;
}

function renderComputoSection() {
    const el = document.getElementById("section-computo");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }

    const mats = calcMaterials();
    
    let h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <div>
                <h2 class="sec-lbl" style="margin:0">CÓMPUTO MÉTRICO DE MATERIALES</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Cantidades totales necesarias para la obra: <strong>${p.name}</strong></p>
            </div>
            <button class="btn sm" onclick="setSection('budget')">← Volver al Presupuesto</button>
        </div>

        <div class="info-box" style="margin-bottom:20px">
            <p>Este cómputo suma automáticamente los materiales de <strong>todas las adendas</strong> del proyecto. Ideal para planificación de compras generales.</p>
        </div>

        <div class="mat-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:15px">
            ${mats.map(m => {
                const isCem = m.name.toLowerCase().includes("cemento");
                const bolsas = isCem ? Math.ceil(m.qty / 50) : null;
                const qty = Number.isInteger(m.qty) ? m.qty : fmtD(m.qty, 2);
                return `
                <div class="mat-card" style="background:var(--sur); padding:15px; border-radius:var(--rad); border:1px solid var(--bor)">
                    <div class="mat-name" style="font-weight:700; font-size:1rem; margin-bottom:8px">${m.name}</div>
                    <div class="mat-qty" style="font-size:1.2rem; color:var(--acc)"><strong>${qty}</strong> ${m.unit}</div>
                    ${bolsas ? `<div class="mat-bags" style="font-size:0.8rem; color:var(--tx3); margin-top:5px">≈ ${bolsas} bolsas de 50kg</div>` : ""}
                </div>`;
            }).join("") || '<div class="fullcol empty">No hay materiales calculados. Agregá rubros al presupuesto.</div>'}
        </div>
    </div>`;

    el.innerHTML = h;
}

window.modals = window.modals || {};
window.modals.new_claim = () => `
    <div class="modal-title">Registrar Intervención / Reclamo</div>
    <div style="display:flex; flex-direction:column; gap:12px">
        <input id="cl-title" placeholder="Título (ej: Filtración en baño social)">
        ${dateInputPY('cl-date', todayISO(), '', 'width:100%')}
        <textarea id="cl-desc" placeholder="Descripción del problema y acción a tomar..." rows="4"></textarea>
    </div>
    <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveClaim()">Registrar 🔧</button>
    </div>`;

function saveClaim() {
    const p = getActiveProject();
    const title = document.getElementById("cl-title").value.trim();
    const date = document.getElementById("cl-date").value;
    const desc = document.getElementById("cl-desc").value;
    if (!title) return toast("Título requerido", false);
    if (!p.execution.aftercare) p.execution.aftercare = [];
    p.execution.aftercare.push({ title, date, desc, status: 'pending', id: Date.now() });
    save(); closeModal(); renderAftercare();
    toast("Reclamo registrado ✓");
}

function updateClaimStatus(idx, status) {
    const p = getActiveProject();
    p.execution.aftercare[idx].status = status;
    save(); renderAftercare();
    toast("Estado actualizado ✓");
}

function deleteClaim(idx) {
    if (!confirm("¿Eliminar este registro?")) return;
    const p = getActiveProject();
    p.execution.aftercare.splice(idx, 1);
    save(); renderAftercare();
}

function migrateToV7() {
    if (state.projects && state.projects.length > 0) return;
    
    // Si hay datos actuales, convertirlos en el primer proyecto
    const initialProject = {
        id: 'p_' + Date.now(),
        name: state.projectName || "Proyecto Inicial",
        client: state.clientName,
        phone: state.clientPhone,
        address: state.clientAddress,
        date: formatDatePY(new Date()),
        status: 'active',
        activeAdendaId: 'main',
        budgets: [
            {
                id: 'main',
                name: 'Presupuesto Principal',
                items: state.items || [],
                profitPct: state.profitPct || 0,
                ivaEnabled: state.ivaEnabled || false,
                notes: state.notes || ""
            }
        ],
        execution: {
            schedules: state.schedules || {},
            dailyLogs: state.dailyLogs || [],
            materialOrders: state.materialOrders || [],
            finances: state.finances || { income: [], expenses: [] },
            documents: state.documents || [],
            aftercare: [],
            projectStartDate: state.projectStartDate || "",
            projectEndDate: ""
        }
    };

    state.projects = [initialProject];
    state.activeProjectId = initialProject.id;
    state.activeAdendaId = 'main';
    save();
}

function getActiveProject() {
    if (!state.activeProjectId && state.projects.length > 0) {
        state.activeProjectId = state.projects[0].id;
    }
    return state.projects.find(p => p.id === state.activeProjectId);
}

function getActiveAdenda() {
    const p = getActiveProject();
    if (!p) return null;
    if (!state.activeAdendaId) state.activeAdendaId = p.budgets[0].id;
    return p.budgets.find(b => b.id === state.activeAdendaId);
}

function switchProject(id) {
    state.activeProjectId = id;
    const p = getActiveProject();
    if (!p) return;

    state.activeAdendaId = p.budgets[0].id;
    save();

    // Lógica de redirección inteligente
    const hasStarted = p.execution.projectStartDate || 
                      Object.values(p.execution.schedules || {}).some(s => s.status !== 'pending');
    
    if (hasStarted) {
        setSection('schedule');
    } else {
        setSection('budget');
    }
    
    toast(`Proyecto: ${p.name} ✓`);
}

function renderProjects() {
    const el = document.getElementById("section-projects");
    if (!el) return;

    if (!state.projectSort) state.projectSort = 'name';
    if (!state.projectFilter) state.projectFilter = '';
    if (state.projectShowArchived === undefined) state.projectShowArchived = false;

    let filtered = [...state.projects].filter(p => {
        if (!state.projectShowArchived && p.archived) return false;
        return p.name.toLowerCase().includes(state.projectFilter.toLowerCase()) || 
            (p.client && p.client.toLowerCase().includes(state.projectFilter.toLowerCase()));
    });

    filtered.sort((a, b) => {
        if (state.projectSort === 'name') return a.name.localeCompare(b.name);
        if (state.projectSort === 'client') return (a.client || "").localeCompare(b.client || "");
        if (state.projectSort === 'amount') {
            const getT = (p) => p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
            return getT(b) - getT(a);
        }
        return 0;
    });

    const archivedCount = state.projects.filter(p => p.archived).length;

    let h = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px">
            <div>
                <h2 class="sec-lbl" style="margin:0">Catálogo de Proyectos</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Gestión y clasificación de obras</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap">
                <div class="srch" style="margin:0; min-width:200px">
                    <span class="srch-ico">🔍</span>
                    <input placeholder="Buscar por nombre o cliente..." value="${state.projectFilter}" oninput="state.projectFilter=this.value; renderProjects()">
                </div>
                <button class="btn primary" onclick="showModal('new_project')">+ Nuevo Proyecto</button>
            </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:20px; align-items:center; overflow-x:auto; padding-bottom:5px">
            <span style="font-size:0.8rem; color:var(--tx3); font-weight:700; text-transform:uppercase; white-space:nowrap">Ordenar por:</span>
            <button class="btn sm ${state.projectSort === 'name' ? 'primary' : ''}" onclick="state.projectSort='name'; renderProjects()">🔤 Nombre</button>
            <button class="btn sm ${state.projectSort === 'client' ? 'primary' : ''}" onclick="state.projectSort='client'; renderProjects()">👤 Cliente</button>
            <button class="btn sm ${state.projectSort === 'amount' ? 'primary' : ''}" onclick="state.projectSort='amount'; renderProjects()">💰 Monto</button>
            <span style="width:1px;height:20px;background:var(--bor);margin:0 4px"></span>
            <button class="btn sm ${state.projectShowArchived ? 'primary' : ''}" onclick="state.projectShowArchived=!state.projectShowArchived; renderProjects()">📦 Archivados ${archivedCount > 0 ? `(${archivedCount})` : ''}</button>
        </div>

        <div class="grid3">
            ${filtered.map(p => {
                const isSelected = p.id === state.activeProjectId;
                const total = p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
                
                return `
                <div class="card ${isSelected ? 'active-proj' : ''}" style="border-top: 4px solid ${p.archived ? 'var(--tx3)' : isSelected ? 'var(--acc)' : 'var(--bor)'}; transition: transform 0.2s; ${p.archived ? 'opacity:0.7;' : ''}">
                    <div style="margin-bottom:10px">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start">
                            <div>
                                <div style="font-size:0.7rem; color:var(--acc); font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px">Proyecto</div>
                                <h3 style="margin:0; font-family:var(--font-display); font-weight:800; font-size:1.1rem; line-height:1.2">${p.name}${p.archived ? ' <span style="font-size:0.65rem;color:var(--tx3);font-weight:400">(archivado)</span>' : ''}</h3>
                            </div>
                            ${p.archived ? `<span style="font-size:1.2rem" title="Archivado">📦</span>` : ''}
                        </div>
                    </div>
                    
                    <div style="margin-bottom:10px">
                        <div style="font-size:0.7rem; color:var(--tx3); font-weight:700; text-transform:uppercase; margin-bottom:2px">Cliente</div>
                        <div style="font-size:0.95rem; font-weight:600; color:var(--tx2)">${p.client || '—'}</div>
                    </div>

                    <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); margin-bottom:12px">
                        <div style="font-size:0.7rem; color:var(--tx3); text-transform:uppercase; margin-bottom:2px">Inversión Total</div>
                        <div style="font-weight:800; font-size:1.2rem; color:var(--acc)">${fmt(total)}</div>
                        <div style="font-size:0.75rem; color:var(--tx3); margin-top:4px">${p.budgets.length} Presupuesto(s)</div>
                    </div>

                    <div style="margin-top:12px; display:flex; gap:6px; flex-wrap:wrap">
                        <button class="btn sm" style="flex:1; background:rgba(var(--acc-rgb),0.1); border-color:rgba(var(--acc-rgb),0.3)" onclick="event.stopPropagation(); switchProject('${p.id}')">📋 Abrir</button>
                        <button class="btn sm" style="flex:1" onclick="event.stopPropagation(); showModal('edit_project','${p.id}')">✏️ Editar</button>
                        ${p.archived 
                            ? `<button class="btn sm" style="flex:1" onclick="event.stopPropagation(); unarchiveProject('${p.id}')">♻️ Restaurar</button>` 
                            : `<button class="btn sm" style="flex:1" onclick="event.stopPropagation(); archiveProject('${p.id}')">📦 Archivar</button>`}
                    </div>
                    <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap">
                        <button class="btn sm" style="flex:1" onclick="event.stopPropagation(); shareProjectWhatsApp('${p.id}')">📤 Compartir</button>
                        <button class="btn sm danger" style="flex:1" onclick="event.stopPropagation(); deleteProject('${p.id}')">✕ Eliminar</button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px solid var(--bor)">
                        <div style="display:flex; gap:6px">
                            <span style="font-size:0.7rem; color:var(--tx3)">ID: ${p.id.toString().slice(-6)}</span>
                            ${p.location && p.location.lat ? '<span title="Ubicación registrada" style="cursor:help">📍</span>' : ''}
                        </div>
                        ${isSelected ? '<span style="color:var(--ok); font-size:0.7rem; font-weight:800">ACTIVO</span>' : '<span style="font-size:0.7rem; color:var(--tx3)">Seleccionar →</span>'}
                    </div>
                </div>
                `;
            }).join("") || `<div class="fullcol card empty" style="padding:40px; text-align:center">${state.projectShowArchived ? 'No hay proyectos archivados.' : 'No se encontraron proyectos. <button class="btn sm primary" onclick="showModal(\'new_project\')">+ Crear primero</button>'}</div>`}
        </div>
    </div>`;

    el.innerHTML = h;
}

function shareProjectWhatsApp(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    const total = p.budgets.reduce((s, b) => s + b.items.reduce((ss, i) => ss + (i.unitPrice * i.qty), 0), 0);
    const loc = p.location && p.location.lat ? `📍 ${p.location.address || 'Ver ubicación'}\n` : '';
    const msg = `📋 *${p.name}*\n👤 Cliente: ${p.client || '—'}\n💰 Inversión: ${fmt(total)}\n${loc}📎 Exportado desde Puntero`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    toast("Compartiendo por WhatsApp...");
}

// Recordatorio de Backup (cada 3 días de uso)
function checkBackupReminder() {
  const last = localStorage.getItem("ppy_last_backup") || 0;
  const now = Date.now();
  if (now - last > 3 * 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      if (confirm("🔋 Recordatorio de Seguridad: ¿Deseas realizar un backup de toda tu base de datos? Es recomendable guardarlo fuera de tu computadora.")) {
        exportDB();
        localStorage.setItem("ppy_last_backup", Date.now());
      }
    }, 3000);
  }
}

// ── CORE LOGIC ────────────────────────────────────────────────────────
var _saveTimer = null;

function save() {
  try {
    localStorage.setItem("ppy_v5", JSON.stringify(state));
    localStorage.setItem("ppy_db5", JSON.stringify(DB));
  } catch (e) { }
  firestoreSync();
}

function firestoreSync() {
  if (!window._currentUser) return;
  if (state._cloudSyncEnabled === false) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    try {
      state._lastCloudSync = new Date().toISOString();
      window._FIRESTORE.collection("users").doc(window._currentUser.uid).set({
        appState: JSON.parse(JSON.stringify(state)),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { console.warn("Firestore sync error:", e); }
  }, 500);
}

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t || "slate");
}

let _tt = null;
function toast(msg, ok = true) {
  const t = document.getElementById("toast-el");
  if (!t) return;
  t.textContent = msg;
  t.style.background = ok ? "var(--ok)" : "var(--err)";
  t.style.color = "var(--bg)";
  t.style.display = "";
  clearTimeout(_tt);
  _tt = setTimeout(() => t.style.display = "none", 2500);
}

function setSection(s) {
  state.section = s;
  // Cerrar drawer automáticamente al navegar (UX mobile)
  if (typeof closeSidebar === 'function') closeSidebar();
  const titles = { 
    budget: "Presupuesto de Obra", 
    schedule: "Cronograma de Ejecución", 
    contractors: "Directorio de Contratistas", 
    prices: "Base de Datos de Precios", 
    dashboard: "Panel de Control", 
    themes: "Temas y Apariencia", 
    logs: "Libro de Obra / Bitácora",
    materials: "Gestión de Materiales",
    finances: "Caja y Finanzas",
    performance: "Rendimiento y KPIs",
    documents: "Planos y Galería",
    suppliers: "Directorio de Proveedores",
    jornaleros: "Jornaleros y Jornales",
    resources: "Biblioteca y Recursos",
    projects: "Gestión de Proyectos",
    cloud: "☁️ Cloud"
  };
  const vtitle = document.getElementById("view-title");
  if (vtitle) vtitle.textContent = titles[s] || "Puntero";

  ["global_dashboard", "budget", "schedule", "contractors", "jornaleros", "prices", "dashboard", "themes", "logs", "materials", "finances", "performance", "documents", "suppliers", "resources", "projects", "aftercare", "computo", "cloud"].forEach(x => {
    const el = document.getElementById("section-" + x);
    if (el) el.style.display = s === x ? "" : "none";
    const b = document.getElementById("btn-" + x);
    if (b) b.className = "nbtn" + (s === x ? " on" : "");
  });
  if (s === "global_dashboard") renderGlobalDashboard();
  if (s === "projects") renderProjects();
  if (s === "budget") renderBudget();
  if (s === "computo") renderComputoSection();
  if (s === "aftercare") renderAftercare();
  if (s === "prices") renderPrices();
  if (s === "themes") renderThemes();
  if (s === "dashboard") renderDashboard();
  if (s === "schedule") renderSchedule();
  if (s === "contractors") renderContractors();
  if (s === "jornaleros") renderJornaleros();
  if (s === "logs") renderLogs();
  if (s === "materials") renderMaterials();
  if (s === "finances") renderFinances();
  if (s === "performance") renderPerformance();
  if (s === "documents") renderDocuments();
  if (s === "suppliers") renderSuppliers();
  if (s === "resources") renderResources();
  if (s === "cloud") renderCloudSettings();
}

/**
 * GESTIÓN DE PAGOS Y COBROS (DEPRACTED: Replaced by finances.js)
 */
function renderPayments() {
    setSection('finances');
}

function renderDashboard() {
  const el = document.getElementById("section-dashboard");
  if (!el) return;
  const p = getActiveProject();
  if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
  if (!p.execution) p.execution = { schedules: {}, dailyLogs: [], materialOrders: [], finances: { income: [], expenses: [] }, documents: [], aftercare: [] };
  if (!p.execution.schedules) p.execution.schedules = {};
  if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
  if (!p.execution.finances.income) p.execution.finances.income = [];
  if (!p.execution.finances.expenses) p.execution.finances.expenses = [];

  const { totalProgress } = calcOverallProgress();
  const { total } = getTotals();
  
  // Financiero
  const finances = p.execution.finances || { income: [], expenses: [] };
  const incomeTotal = (finances.income || []).reduce((s, i) => s + i.amount, 0);
  const generalExpenses = (finances.expenses || []).reduce((s, e) => s + e.amount, 0);
  const contractorPayments = (state.contractors || []).reduce((s, c) => s + (c.payments || []).reduce((p, py) => p + py.amount, 0), 0);
  const totalPaid = contractorPayments + generalExpenses;
  const financialProgress = total > 0 ? Math.round((totalPaid / total) * 100) : 0;

  // Materiales
  const orders = p.execution.materialOrders || [];
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

  // Próximos hitos
  const adenda = getActiveAdenda();
  const nextMilestones = (adenda?.items || [])
    .filter(i => (p.execution.schedules[i.id]?.status || 'pending') !== 'done')
    .sort((a, b) => new Date(p.execution.schedules[a.id]?.start || '9999') - new Date(p.execution.schedules[b.id]?.start || '9999'))
    .slice(0, 3);

  el.innerHTML = `<div class="prices-wrap">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
        <div>
            <h2 class="sec-lbl" style="margin:0">Vista General</h2>
            <div style="font-size:0.85rem; color:var(--tx3); margin-top:4px; display:flex; gap:10px; align-items:center; flex-wrap:wrap">
                <span>📅 Inicio:</span>
                ${dateInputPY('proj-overview-start', p.execution.projectStartDate || '', "updateProjectDate('start', this.value)")}
                <span>Fin Est.:</span>
                ${dateInputPY('proj-overview-end', p.execution.projectEndDate || '', "updateProjectDate('end', this.value)")}
                <button class="btn sm" onclick="showProjectLocationModal()" style="margin-left:5px">📍 Ubicación de Obra</button>
            </div>
        </div>
        <div class="db-badge">${p.name}</div>
    </div>
    
    <div class="dash-grid">
        <div class="dash-card">
            <div class="dash-num">${totalProgress}%</div>
            <div class="dash-lbl">Avance Físico</div>
            <div style="background:var(--sur2); height:6px; border-radius:10px; margin-top:10px; overflow:hidden">
                <div style="background:var(--ok); height:100%; width:${totalProgress}%"></div>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-num">${fmt(totalPaid)}</div>
            <div class="dash-lbl">Inversión Realizada</div>
            <div style="font-size:0.8rem; color:var(--tx3); margin-top:5px">Ejecución: ${financialProgress}%</div>
        </div>
        <div class="dash-card">
            <div class="dash-num">${deliveredOrders}/${orders.length}</div>
            <div class="dash-lbl">Logística</div>
            <div style="font-size:0.8rem; color:var(--tx3); margin-top:5px">${orders.length - deliveredOrders} pendientes</div>
        </div>
        <div class="dash-card">
            <div class="dash-num">${fmt(incomeTotal - totalPaid)}</div>
            <div class="dash-lbl">Saldo de Caja</div>
            <div style="font-size:0.8rem; color:${(incomeTotal - totalPaid) >= 0 ? 'var(--ok)' : 'var(--err)'}; margin-top:5px">
                Cobrado: ${fmt(incomeTotal)}
            </div>
        </div>
    </div>

    <div class="grid2">
        <div class="card">
            <h3 class="sec-lbl">Próximos Hitos</h3>
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px">
                ${nextMilestones.map(i => {
                    const s = (p.execution.schedules && p.execution.schedules[i.id]) || {};
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--sur2); border-radius:var(--rad)">
                            <div>
                                <div style="font-weight:700; font-size:0.9rem">${i.name}</div>
                                <div style="font-size:0.75rem; color:var(--tx3)">Inicia: ${formatDatePY(s.start) || 'S/D'}</div>
                            </div>
                            <div class="iva-badge" style="background:var(--sur); color:var(--tx2)">${s.status === 'progress' ? 'EN CURSO' : 'PENDIENTE'}</div>
                        </div>
                    `;
                }).join("") || '<p style="color:var(--tx3); font-size:0.85rem">No hay tareas pendientes.</p>'}
            </div>
        </div>

        <div class="card">
            <h3 class="sec-lbl">Últimas Fotos de Obra</h3>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px">
                ${(p.execution.dailyLogs || []).flatMap(l => l.photos || []).slice(-6).map(ph => `
                    <div style="aspect-ratio:1; background:url(${ph}) center/cover; border-radius:4px; border:1px solid var(--bor)"></div>
                `).join("") || '<div style="grid-column: span 3; text-align:center; padding:20px; color:var(--tx3); font-size:0.85rem">Sin fotos registradas aún.</div>'}
            </div>
            <button class="btn sm full" style="margin-top:15px" onclick="setSection('documents')">Ver Galería Completa</button>
        </div>
    </div>
  </div>`;
}

function updateProjectDate(type, val) {
    const p = getActiveProject();
    if (!p) return;
    if (type === 'start') p.execution.projectStartDate = val;
    else p.execution.projectEndDate = val;
    save();
    toast("Fecha actualizada ✓");
}

function calcOverallProgress() {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda || adenda.items.length === 0) return { totalProgress: 0 };
    if (!p.execution.schedules) p.execution.schedules = {};

    const items = adenda.items;
    let completed = 0;
    items.forEach(i => {
        const s = p.execution.schedules[i.id];
        if (s && s.status === 'done') completed++;
        else if (s && s.status === 'progress') completed += 0.5;
    });
    return { totalProgress: Math.round((completed / items.length) * 100) };
}

/**
 * GENERACIÓN DE REPORTES PDF (ESTILO REPORT AND RUN)
 */
async function exportDailyPDF(logId) {
  const proj = getActiveProject();
  if (!proj) return toast("Sin proyecto activo", false);
  const log = (proj.execution.dailyLogs || []).find(l => l.id === logId);
  if (!log) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const theme = PDF_THEMES.find(t => t.id === state.pdfTheme) || PDF_THEMES[0];
  const margin = 20;
  let y = 20;

  // --- CARÁTULA ---
  doc.setFillColor(theme.bg);
  doc.rect(0, 0, 210, 60, 'F');
  
  if (state.logoDataUrl) {
    doc.addImage(state.logoDataUrl, 'PNG', margin, 15, 30, 30);
  }

  doc.setTextColor("#ffffff");
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME DIARIO DE OBRA", margin + 35, 30);
  doc.setFontSize(10);
  doc.text(`${proj.name} | ${formatDatePY(log.date)}`, margin + 35, 38);

  y = 80;
  doc.setTextColor("#333333");
  doc.setFontSize(14);
  doc.text("Resumen de la Jornada", margin, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${formatDatePY(log.date)}`, margin, y);
  doc.text(`Clima: ${log.weather.toUpperCase()}`, margin + 80, y);
  y += 10;

  doc.setDrawColor(theme.acc);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 190, y);
  y += 10;

  // Trabajos realizados
  doc.setFont("helvetica", "bold");
  doc.text("ACTIVIDADES REALIZADAS:", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const splitWork = doc.splitTextToSize(log.workDone || "Sin descripción", 170);
  doc.text(splitWork, margin, y);
  y += (splitWork.length * 5) + 10;

  // Asistencia
  doc.setFont("helvetica", "bold");
  doc.text("ASISTENCIA DE PERSONAL:", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const present = log.attendance.filter(a => a.present).map(a => a.name).join(", ");
  const absent = log.attendance.filter(a => !a.present).map(a => a.name).join(", ");
  doc.text(`Presentes: ${present || "Ninguno"}`, margin, y);
  y += 5;
  doc.text(`Ausentes: ${absent || "Ninguno"}`, margin, y);
  y += 15;

  // --- FOTOS (Página nueva si es necesario) ---
  if (log.photos && log.photos.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.text("REGISTRO FOTOGRÁFICO", margin, 20);
    let px = margin;
    let py = 30;
    for (let i = 0; i < log.photos.length; i++) {
        doc.addImage(log.photos[i], 'JPEG', px, py, 80, 60);
        px += 90;
        if (px > 150) { px = margin; py += 70; }
        if (py > 250 && i < log.photos.length - 1) { doc.addPage(); px = margin; py = 20; }
    }
  }

  // --- PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor("#999999");
    doc.text(`Generado por Puntero - Página ${i} de ${pageCount}`, margin, 285);
  }

  doc.save(`Reporte_Diario_${formatDatePY(log.date).replace(/\//g, '-')}.pdf`);
  toast("PDF Diario generado ✓");
}

async function exportWeeklyReport() {
  const proj = getActiveProject();
  if (!proj) return toast("Sin proyecto activo", false);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const theme = PDF_THEMES.find(t => t.id === state.pdfTheme) || PDF_THEMES[0];
  const margin = 20;

  // CARÁTULA DE INFORME SEMANAL
  doc.setFillColor(theme.bg);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor("#ffffff");
  doc.setFontSize(30);
  doc.text("INFORME SEMANAL", margin, 100);
  doc.setFontSize(15);
  doc.text("SEGUIMIENTO Y CONTROL DE OBRA", margin, 115);
  doc.setFontSize(12);
  doc.text(`PROYECTO: ${(proj.name || '').toUpperCase()}`, margin, 140);
  doc.text(`CLIENTE: ${proj.client || ''}`, margin, 150);
  doc.text(`FECHA DE EMISIÓN: ${formatDatePY(new Date())}`, margin, 160);

  // ÍNDICE
  doc.addPage();
  doc.setTextColor("#333333");
  doc.setFontSize(16);
  doc.text("ÍNDICE", margin, 30);
  doc.setFontSize(10);
  doc.text("1. Resumen Ejecutivo .................................................................... Pág. 3", margin, 50);
  doc.text("2. Estado del Cronograma ............................................................ Pág. 4", margin, 60);
  doc.text("3. Bitácora Diaria (Compilado) ..................................................... Pág. 5", margin, 70);
  doc.text("4. Memoria Fotográfica ................................................................ Pág. 6", margin, 80);

  // CONTENIDO (RESUMEN)
  doc.addPage();
  doc.setFontSize(14);
  doc.text("1. RESUMEN EJECUTIVO", margin, 30);
  doc.setFontSize(10);
  const { totalProgress } = calcOverallProgress();
  doc.text(`El proyecto presenta un avance global del ${totalProgress}%.`, margin, 45);

  // BITÁCORA COMPILADA
  doc.addPage();
  doc.setFontSize(14);
  doc.text("3. BITÁCORA DIARIA (ÚLTIMOS REGISTROS)", margin, 30);
  let y = 45;
  const lastLogs = (proj.execution.dailyLogs || []).slice(-7);
  lastLogs.forEach(log => {
     doc.setFont("helvetica", "bold");
     doc.text(`${formatDatePY(log.date)} - Clima: ${log.weather}`, margin, y);
     doc.setFont("helvetica", "normal");
     const txt = doc.splitTextToSize(log.workDone || "", 160);
     doc.text(txt, margin + 5, y + 5);
     y += (txt.length * 5) + 15;
     if (y > 270) { doc.addPage(); y = 30; }
  });

  doc.save(`Informe_Semanal_${(proj.name || 'proyecto').replace(/\s+/g,'_')}.pdf`);
  toast("Informe Semanal generado ✓");
}

async function exportMonthlyReport() {
  // Reutiliza la lógica semanal pero filtra logs del mes
  return exportWeeklyReport();
}

// ── IVA CALCULATIONS ──────────────────────────────────────────────────
function calcIVA(matCost, laborCost, qty = 1) {
  const adenda = getActiveAdenda();
  if (!adenda || !adenda.ivaEnabled) return { ivaMat: 0, ivaLab: 0, ivaTotal: 0 };
  const ivaMat = Math.round(matCost * qty * IVA_MAT);
  const ivaLab = Math.round(laborCost * qty * IVA_LAB);
  return { ivaMat, ivaLab, ivaTotal: ivaMat + ivaLab };
}

function calcIVATotals() {
  const adenda = getActiveAdenda();
  if (!adenda) return { ivaMat: 0, ivaLab: 0, ivaTotal: 0 };
  let ivaMat = 0, ivaLab = 0;
  for (const i of adenda.items) {
    ivaMat += Math.round((i.matCost || 0) * i.qty * IVA_MAT);
    ivaLab += Math.round((i.laborCost || 0) * i.qty * IVA_LAB);
  }
  return { ivaMat, ivaLab, ivaTotal: ivaMat + ivaLab };
}

// ── ITEM ACTIONS ──────────────────────────────────────────────────────
function addItem(cat, name) {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda || !p) { toast("Seleccioná un proyecto", false); return; }
  if (!p.execution.schedules) p.execution.schedules = {};

  const data = DB[cat][name];
  const ex = adenda.items.find(i => i.cat === cat && i.name === name && !i.custom);
  if (ex) { ex.qty++; renderTable(); save(); return; }

  const y = data.y || DEFAULT_YIELDS[cat] || 10;
  const days = Math.ceil(1 / y) || 1;

  let startStr = p.execution.projectStartDate || todayISO();
  if (adenda.items.length > 0) {
    let maxEnd = 0;
    Object.values(p.execution.schedules).forEach(s => {
      if (s.end) {
        const endTs = new Date(s.end).getTime();
        if (endTs > maxEnd) maxEnd = endTs;
      }
    });
    if (maxEnd > 0) {
      startStr = new Date(maxEnd + 86400000).toISOString().split('T')[0];
    }
  }

  const startDate = new Date(startStr);
  const endStr = new Date(startDate.getTime() + (days - 1) * 86400000).toISOString().split('T')[0];

  const newItem = { cat, name, unit: data.unit, unitPrice: data.total, matCost: data.matCost, laborCost: data.laborCost, mats: data.mats || [], qty: 1, id: Date.now() + Math.random(), disc: 0, note: "" };
  adenda.items.push(newItem);
  p.execution.schedules[newItem.id] = { status: 'pending', start: startStr, end: endStr, contractorId: null };

  renderTable(); save();
}

function addCustomItem() {
  const adenda = getActiveAdenda();
  const pj = getActiveProject();
  if (!adenda || !pj) { toast("Seleccioná un proyecto", false); return; }
  const n = document.getElementById("ci-name").value.trim();
  const price = parseFloat(document.getElementById("ci-price").value) || 0;
  const u = document.getElementById("ci-unit").value.trim() || "gl";
  if (!n || !price) { toast("Completá nombre y precio", false); return; }
  const mat = Math.round(price * 0.65); const lab = Math.round(price * 0.35);
  const id = Date.now() + Math.random();
  adenda.items.push({ cat: "PERSONALIZADOS", name: n, unit: u, unitPrice: price, matCost: mat, laborCost: lab, mats: [], qty: 1, id, custom: true, disc: 0, note: "" });
  if (!pj.execution.schedules) pj.execution.schedules = {};
  if (!pj.execution.schedules[id]) pj.execution.schedules[id] = { status: 'pending', start: '', end: '', contractorId: null };
  document.getElementById("ci-name").value = ""; document.getElementById("ci-price").value = ""; document.getElementById("ci-unit").value = "";
  renderTable(); save(); toast("Ítem agregado ✓");
}

function updateQty(id, val) {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda || !p) return;
  const i = adenda.items.find(x => x.id == id);
  if (i) {
    i.qty = parseFloat(val) || 0;
    const cat = i.cat; const name = i.name;
    const dbItem = DB[cat] ? DB[cat][name] : null;
    const yieldRate = (dbItem && dbItem.y) ? dbItem.y : (DEFAULT_YIELDS[cat] || 10);
    const days = Math.max(1, Math.ceil(i.qty / yieldRate));
    if (!p.execution.schedules) p.execution.schedules = {};
    const sch = p.execution.schedules[id];
    if (sch && sch.start) {
      const startDate = new Date(sch.start);
      sch.end = new Date(startDate.getTime() + (days - 1) * 86400000).toISOString().split('T')[0];
    }
    renderTotals(); save();
  }
}
function updateDisc(id, v) { const adenda = getActiveAdenda(); if (!adenda) return; const i = adenda.items.find(x => x.id == id); if (i) { i.disc = Math.max(0, Math.min(100, parseFloat(v) || 0)); renderTotals(); save(); } }
function updateNote(id, v) { const adenda = getActiveAdenda(); if (!adenda) return; const i = adenda.items.find(x => x.id == id); if (i) { i.note = v; save(); } }
function removeItem(id) {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda) return;
  adenda.items = adenda.items.filter(i => i.id != id);
  if (p && p.execution.schedules) delete p.execution.schedules[id];
  renderTable(); save();
}

function dupBudget() {
  const proj = getActiveProject();
  const adenda = getActiveAdenda();
  if (!proj || !adenda) return toast("Sin adenda activa", false);
  const nb = JSON.parse(JSON.stringify(adenda));
  nb.id = 'ad_' + Date.now();
  nb.name = adenda.name + " (copia)";
  proj.budgets.push(nb);
  state.activeAdendaId = nb.id;
  save();
  renderBudget();
  toast("Adenda duplicada ✓");
}

function newBudget() {
  const adenda = getActiveAdenda();
  const p = getActiveProject();
  if (!adenda || !p) { toast("No hay proyecto activo", false); return; }
  if (adenda.items.length > 0 && !confirm("¿Limpiar este presupuesto? Se borrarán los ítems.")) return;

  // Borrar schedules de los items de esta adenda
  if (p.execution.schedules) {
    adenda.items.forEach(i => delete p.execution.schedules[i.id]);
  }
  adenda.items = [];
  adenda.profitPct = 0;
  adenda.ivaEnabled = false;
  adenda.notes = "";
  renderBudget(); save(); toast("Presupuesto limpiado ✓");
}

function saveVersion() {
    const adenda = getActiveAdenda();
    const p = getActiveProject();
    if (!adenda || !p) return toast("Sin proyecto activo", false);

    const name = prompt("Nombre de esta versión (ej: v1 - Inicial, v2 - Ajustado):", `v${(p.versions || []).length + 1}`);
    if (!name) return;

    if (!p.versions) p.versions = [];

    const snapshot = {
        id: 'v_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        name: name,
        date: formatDatePY(new Date()),
        adendaId: adenda.id,
        items: JSON.parse(JSON.stringify(adenda.items)),
        m2Area: p.m2Area || 0,
        profitPct: adenda.profitPct,
        ivaEnabled: adenda.ivaEnabled,
        notes: adenda.notes
    };

    p.versions.push(snapshot);
    save();
    toast(`Versión "${name}" guardada ✓`);
}

function loadVersion(id) {
    const p = getActiveProject();
    if (!p || !p.versions) return;
    const v = p.versions.find(b => b.id === id);
    if (!v) return;
    if (!confirm(`¿Cargar la versión "${v.name}"? Esto reemplazará los ítems actuales de la adenda.`)) return;

    const adenda = p.budgets.find(b => b.id === v.adendaId) || getActiveAdenda();
    if (!adenda) return toast("Adenda no encontrada", false);

    adenda.items = JSON.parse(JSON.stringify(v.items));
    p.m2Area = v.m2Area || 0;
    adenda.profitPct = v.profitPct || 0;
    adenda.ivaEnabled = v.ivaEnabled || false;
    adenda.notes = v.notes || "";

    save();
    renderBudget();
    closeModal();
    toast(`Versión "${v.name}" cargada ✓`);
}

function deleteVersion(id) {
    if (!confirm("¿Eliminar esta versión?")) return;
    const p = getActiveProject();
    if (!p || !p.versions) return;
    p.versions = p.versions.filter(b => b.id !== id);
    save();
}

// ── TOTALS ──────────────────────────────────────────────────────────
function effPrice(i) { return i.unitPrice * (1 - (i.disc || 0) / 100); }
function getTotals() {
  const adenda = getActiveAdenda();
  if (!adenda) return { totalMats:0, totalLabor:0, subtotal:0, ivaMat:0, ivaLab:0, ivaTotal:0, profitAmt:0, total:0 };
  
  const totalMats = adenda.items.reduce((s, i) => s + (i.matCost || 0) * (1 - (i.disc || 0) / 100) * i.qty, 0);
  const totalLabor = adenda.items.reduce((s, i) => s + (i.laborCost || 0) * (1 - (i.disc || 0) / 100) * i.qty, 0);
  const subtotal = adenda.items.reduce((s, i) => s + (i.unitPrice * (1 - (i.disc || 0) / 100)) * i.qty, 0);
  
  let ivaMat = 0, ivaLab = 0;
  if (adenda.ivaEnabled) {
      adenda.items.forEach(i => {
          ivaMat += Math.round((i.matCost || 0) * i.qty * 0.10);
          ivaLab += Math.round((i.laborCost || 0) * i.qty * 0.05);
      });
  }
  const ivaTotal = ivaMat + ivaLab;
  const profitAmt = (subtotal + ivaTotal) * (adenda.profitPct / 100);
  const total = subtotal + ivaTotal + profitAmt;
  return { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total };
}

function addAdenda() {
    const p = getActiveProject();
    if (!p) return;
    const name = prompt("Nombre de la Adenda (ej: Adenda 1 - Muro Perimetral):");
    if (!name) return;
    const newA = {
        id: 'ad_' + Date.now(),
        name: name,
        items: [],
        profitPct: 0,
        ivaEnabled: false,
        notes: ""
    };
    p.budgets.push(newA);
    state.activeAdendaId = newA.id;
    save();
    renderBudget();
    toast("Adenda creada ✓");
}

function getGrouped() { 
    const adenda = getActiveAdenda();
    if (!adenda) return {};
    const g = {}; 
    for (const i of adenda.items) { 
        if (!g[i.cat]) g[i.cat] = []; 
        g[i.cat].push(i); 
    } 
    return g; 
}

function getBreakdown() {
  return Object.entries(getGrouped()).map(([cat, ci]) => ({
    cat,
    matCost: ci.reduce((s, i) => s + (i.matCost || 0) * i.qty, 0),
    laborCost: ci.reduce((s, i) => s + (i.laborCost || 0) * i.qty, 0),
    total: ci.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  }));
}

function calcMaterials() {
  const p = getActiveProject();
  if (!p) return [];

  const allItems = p.budgets.flatMap(b => b.items);
  const m = {};
  for (const item of allItems) {
    if (!item.mats) continue;
    for (const mat of item.mats) {
      // Soportar ambos formatos: el compacto {n,q,u} de la DB y el extendido {name,qty,unit}
      const name = mat.name || mat.n;
      const unit = mat.unit || mat.u;
      const qty = mat.qty != null ? mat.qty : mat.q;
      if (!name || qty == null) continue;
      const key = name + "|" + (unit || "");
      if (!m[key]) m[key] = { name, unit: unit || "", qty: 0 };
      m[key].qty += (qty * (item.qty || 0));
    }
  }
  return Object.values(m).sort((a, b) => a.name.localeCompare(b.name));
}

// ── CATALOG ──────────────────────────────────────────────────────────
const debouncedRenderCatalog = debounce(renderCatalog, 150);

function renderCatalog() {
  const adenda = getActiveAdenda();
  const ivaActive = adenda && adenda.ivaEnabled;
  const filtered = Object.entries(DB).reduce((acc, [cat, items]) => {
    const f = Object.entries(items).filter(([n]) => n.toLowerCase().includes(state.search.toLowerCase()) || cat.toLowerCase().includes(state.search.toLowerCase()));
    if (f.length) acc[cat] = Object.fromEntries(f); return acc;
  }, {});
  let h = "";
  for (const [cat, items] of Object.entries(filtered)) {
    const on = state.expandedCat === cat;
    const ec = cat.replace(/'/g, "\\'");
    h += `<button class="cat-hdr${on ? " on" : ""}" onclick="toggleCat('${ec}')">${cat}<span style="opacity:.5;font-size:1rem">${on ? "▲" : "▼"}</span></button>`;
    if (on) for (const [name, data] of Object.entries(items)) {
      const en = name.replace(/'/g, "\\'");
      const { ivaMat, ivaLab } = calcIVA(data.matCost, data.laborCost);
      const totalDisp = data.total + ivaMat + ivaLab;
      h += `<div class="cat-item" onclick="addItem('${ec}','${en}')">
        <span class="iname">${name}</span>
        <div class="pchips">
          <span class="ptot">₲${fmt(totalDisp)}</span>
          <span class="pmat">${fmt(data.matCost)}</span>
          <span class="plab">${fmt(data.laborCost)}</span>
          ${ivaActive ? `<span class="iva-badge">IVA ₲${fmt(ivaMat + ivaLab)}</span>` : ""}
        </div>
        <span class="utag">${data.unit}</span>
        <button class="addbtn" onclick="event.stopPropagation();addItem('${ec}','${en}')">+</button>
      </div>`;
    }
  }
  const el = document.getElementById("catalog"); if (el) el.innerHTML = h;
}
function toggleCat(c) { state.expandedCat = state.expandedCat === c ? null : c; renderCatalog(); }

// ── TOTALS RENDER ────────────────────────────────────────────────────
function renderTotals() {
  const adenda = getActiveAdenda();
  if (!adenda) return;
  const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const el = document.getElementById("totals-area"); if (!el) return;
  let h = `<div class="totals">
    <div class="tot-row"><span class="tot-lbl">Materiales</span><span class="tot-val tot-mat">₲ ${fmt(totalMats)}</span></div>
    <div class="tot-row"><span class="tot-lbl">Mano de obra</span><span class="tot-val tot-lab">₲ ${fmt(totalLabor)}</span></div>
    <div class="tot-row tot-sub"><span class="tot-lbl">Costo directo</span><span class="tot-val">₲ ${fmt(subtotal)}</span></div>`;
  if (adenda.ivaEnabled) {
    h += `<div class="tot-row"><span class="tot-lbl" style="color:var(--iva)">IVA materiales (10%)</span><span class="tot-val tot-iva">₲ ${fmt(ivaMat)}</span></div>
        <div class="tot-row"><span class="tot-lbl" style="color:var(--iva)">IVA mano de obra (5%)</span><span class="tot-val tot-iva">₲ ${fmt(ivaLab)}</span></div>
        <div class="tot-row"><span class="tot-lbl" style="color:var(--iva);font-weight:600">Total IVA</span><span class="tot-val tot-iva">₲ ${fmt(ivaTotal)}</span></div>`;
  }
  if (adenda.profitPct > 0) h += `<div class="tot-row"><span class="tot-lbl">Honorarios (${adenda.profitPct}%)</span><span class="tot-val" style="color:var(--ok)">₲ ${fmt(profitAmt)}</span></div>`;
  h += `<div class="tot-row tot-main"><span class="tot-lbl">TOTAL${adenda.ivaEnabled ? " (IVA inc.)" : ""}</span><span class="tot-val">₲ ${fmt(total)}</span></div>
    <div class="disc">Precios incluyen materiales y mano de obra${adenda.ivaEnabled ? ", con IVA incluido" : ""} — Válido ${state.validDays || 15} días desde la fecha de emisión</div>
  </div>`;
  el.innerHTML = h;
}

// ── TABLE RENDER ─────────────────────────────────────────────────────
function renderTable() {
  const el = document.getElementById("table-area"); if (!el) return;
  const adenda = getActiveAdenda();
  if (!adenda || adenda.items.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-ico">📋</div><div>Seleccioná rubros del catálogo</div></div>`;
    document.getElementById("totals-area").innerHTML = ""; return;
  }
  const grouped = {};
  for (const i of adenda.items) { if (!grouped[i.cat]) grouped[i.cat] = []; grouped[i.cat].push(i); }
  
  // Panel M²
  const m2Area = getActiveProject()?.m2Area || 0;
  const totals = getTotals();
  const m2html = m2Area > 0 ? `<div class="m2-panel">
    <div><div class="m2-val">₲ ${fmt(Math.round(totals.total / m2Area))}/m²</div><div class="m2-lbl">Costo por metro cuadrado</div></div>
    <div class="m2-ref">Sup: <span>${m2Area} m²</span></div>
    <div class="m2-ref">Total: <span>₲ ${fmt(totals.total)}</span></div>
  </div>` : "";

  let h = m2html + `<div class="bud-hdr">
    <span style="font-size:.95rem;color:var(--tx3)">${adenda.items.length} ítem${adenda.items.length !== 1 ? "s" : ""}</span>
    <div style="flex:1"></div>
    <button class="btn sm" onclick="setSection('computo')">🧱 Ver Cómputo</button>
    <button class="btn sm" onclick="showModal('breakdown')">📊 Desglose</button>
  </div>
  <table class="tbl budget-tbl"><thead><tr><th>Descripción</th><th>U.</th><th>Cant.</th><th>Desc.%</th><th>P. Unit.</th>${adenda.ivaEnabled ? "<th style='color:var(--iva)'>IVA</th>" : ""}<th>Total</th><th></th></tr></thead><tbody>`;
  const colSpanFull = adenda.ivaEnabled ? 8 : 7;
  for (const [cat, ci] of Object.entries(grouped)) {
    h += `<tr class="tbl-cat cat-row"><td colspan="${colSpanFull}">${cat}</td></tr>`;
    let catSubtotal = 0;
    for (const item of ci) {
      const mf = item.unitPrice > 0 ? item.matCost / item.unitPrice : 0.5;
      const ep = item.unitPrice * (1 - (item.disc || 0) / 100);
      const iva = adenda.ivaEnabled ? calcIVA(item.matCost, item.laborCost, item.qty).ivaTotal : 0;
      const totalItem = (ep * item.qty) + iva;
      catSubtotal += totalItem;
      h += `<tr>
        <td data-label="Item">
          <input value="${item.name.replace(/"/g, '&quot;')}" style="font-weight:600;color:var(--tx);font-size:.875rem;border:none;background:transparent;width:100%;padding:0;outline:none;" oninput="const i=getActiveAdenda().items.find(x=>x.id==${item.id});if(i){i.name=this.value;save();}">
          <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
            <span class="ichip mat">Mat ₲${fmt(item.matCost)}</span>
            <span class="ichip lab">MO ₲${fmt(item.laborCost)}</span>
            ${item.disc > 0 ? `<span class="disc-badge">-${item.disc}%</span>` : ""}
          </div>
          <textarea class="item-note-input" rows="1" placeholder="Nota interna..." oninput="const i=getActiveAdenda().items.find(x=>x.id==${item.id});if(i){i.note=this.value;save();}">${item.note || ""}</textarea>
        </td>
        <td data-label="Unid."><span class="utag">${item.unit}</span></td>
        <td data-label="Cant."><input class="qty-in" type="number" min="0" step="0.5" value="${item.qty}" oninput="updateQty(${item.id},this.value)"></td>
        <td data-label="Desc.%"><input class="qty-in disc" type="number" min="0" max="100" step="1" value="${item.disc || 0}" oninput="updateDisc(${item.id},this.value)"></td>
        <td data-label="P. Unit." style="font-size:.875rem;color:var(--tx3)">₲${fmt(ep)}</td>
        ${adenda.ivaEnabled ? `<td data-label="IVA" style="font-size:.95rem;color:var(--iva);font-weight:600">₲${fmt(iva)}</td>` : ""}
        <td data-label="Total" style="font-weight:700;color:var(--acc);font-size:1rem">₲${fmt(totalItem)}</td>
        <td data-label=""><button class="delbtn" onclick="removeItem(${item.id})">✕</button></td>
      </tr>`;
    }
    // Banda destacada de subtotal al cierre de la categoría
    h += `<tr class="tbl-subtotal subtotal-row"><td colspan="${colSpanFull - 2}" style="text-align:right">Subtotal ${cat}</td><td style="text-align:right">₲${fmt(catSubtotal)}</td><td></td></tr>`;
  }
  h += `</tbody></table>`;
  el.innerHTML = h; renderTotals();
}

// ── BUDGET SECTION ────────────────────────────────────────────────────
function renderBudget() {
  const el = document.getElementById("budget-main-area");
  if (!el) return;
  const p = getActiveProject();
  if (!p) { el.innerHTML = "Seleccioná un proyecto."; return; }
  const adenda = getActiveAdenda();

  el.innerHTML = `
    <div style="background:var(--sur2); padding:10px; border-radius:var(--rad); margin-bottom:15px; display:flex; align-items:center; gap:10px; border:1px solid var(--bor)">
        <span style="font-weight:700; font-size:0.85rem">Adenda Activa:</span>
        <select style="flex:1" onchange="state.activeAdendaId=this.value; renderBudget()">
            ${p.budgets.map(b => `<option value="${b.id}" ${b.id === adenda.id ? 'selected' : ''}>${b.name}</option>`).join("")}
        </select>
        <button class="btn sm" onclick="addAdenda()">+ Nueva Adenda</button>
    </div>

    <div class="main">
    <div class="card">
      <div class="srch"><span class="srch-ico">🔍</span><input placeholder="Buscar rubro..." value="${state.search.replace(/"/g, '&quot;')}" oninput="state.search=this.value;debouncedRenderCatalog()"></div>
      <div class="cat-scroll" id="catalog"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:11px">
      <div class="card">
        <div class="grid2">
          <div class="fullcol flex gap6">
            <input placeholder="Nombre de este presupuesto" value="${adenda.name.replace(/"/g, '&quot;')}" oninput="getActiveAdenda().name=this.value;save()" style="flex:1">
          </div>
          <div style="font-size:0.85rem; color:var(--tx3)">Proyecto: <strong>${p.name}</strong> | Cliente: ${p.client || '—'}</div>
        </div>
        <div class="prof-row">
          <span style="font-size:.875rem;font-weight:600;white-space:nowrap">Honorarios:</span>
          <input class="sm" type="number" min="0" max="999" value="${adenda.profitPct}" style="width:52px" oninput="getActiveAdenda().profitPct=parseFloat(this.value)||0;renderTotals();save()">
          <span style="font-size:.875rem;color:var(--tx3)">%</span>
          <span style="font-size:.875rem;font-weight:600;white-space:nowrap;margin-left:8px">Superficie:</span>
          <input class="sm" type="number" value="${p.m2Area||0}" style="width:70px" oninput="getActiveProject().m2Area=parseFloat(this.value)||0;renderTable();save()">
          <span style="font-size:.875rem;color:var(--tx3)">m²</span>
        </div>
        <div class="opt-row">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <span class="toggle"><input type="checkbox" ${adenda.ivaEnabled ? "checked" : ""} onchange="getActiveAdenda().ivaEnabled=this.checked;renderTable();save()"><span class="tslider"></span></span>
            <span style="font-size:.875rem;color:var(--iva)">Incluir IVA</span>
          </label>
        </div>
      </div>
      <div class="card">
        <div class="custom-item-row">
          <input id="ci-name" placeholder="Descripción del ítem personalizado..." style="font-size:.875rem">
          <input id="ci-price" type="number" placeholder="₲ precio" class="price sm" min="0">
          <input id="ci-unit" placeholder="und." class="unit sm" value="gl">
          <button class="btn sm primary" onclick="addCustomItem()">+ Agregar</button>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;flex-wrap:wrap">
          <button class="btn sm" onclick="newBudget()" style="margin-left:auto;background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.35);color:var(--blue)">+ Limpiar Presupuesto</button>
        </div>
        <div id="table-area"></div>
        <div id="totals-area"></div>
        <div class="mt7"><textarea placeholder="Notas / condiciones adicionales..." rows="2" style="resize:vertical;font-size:.875rem" oninput="getActiveAdenda().notes=this.value;save()">${adenda.notes || ""}</textarea></div>
      </div>
    </div>
  </div>`;
  renderCatalog(); renderTable(); updateBadge();
}

// ── PRICES SECTION ────────────────────────────────────────────────────
function renderPrices() {
  const el = document.getElementById("section-prices");
  if (!el) return;
  let h = `<div class="prices-wrap">
    <div class="prices-toolbar">
      <span style="font-family:var(--font-display);font-size:1.05rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em">Base de Precios</span>
      <div style="display:flex;gap:6px;margin-left:auto;align-items:center">
        <span style="font-size:.95rem;color:var(--tx3)">Ajuste global:</span>
        <input type="number" class="sm" style="width:60px" value="${state.adjustPct}" placeholder="%" oninput="state.adjustPct=parseFloat(this.value)||0" onkeydown="if(event.key==='Enter')applyGlobalAdjust()">
        <button class="btn sm primary" onclick="applyGlobalAdjust()">Aplicar</button>
        <span style="color:var(--tx3);font-size:.95rem">|</span>
        <span style="font-size:.95rem;color:var(--tx3)">Modo:</span>
        <button class="btn sm${state.priceEditMode === "total" ? " primary" : ""}" onclick="state.priceEditMode='total';renderPrices()">Total</button>
        <button class="btn sm${state.priceEditMode === "breakdown" ? " primary" : ""}" onclick="state.priceEditMode='breakdown';renderPrices()">Mat / MO</button>
        <button class="btn sm danger" onclick="if(confirm('Restaurar todos los precios a la DB original?')){DB=buildDB();save();renderPrices();toast('Precios restaurados');}">Restaurar</button>
      </div>
    </div>
    <div class="info-box"><p>Los precios reflejan el mercado de la construcción en Paraguay. Podés editar cualquier precio haciendo clic sobre él. Usá el ajuste global para aplicar un porcentaje de actualización a toda la base de una sola vez.</p></div>
    <div class="pgrid">`;
  for (const [cat, items] of Object.entries(DB)) {
    h += `<div class="pcard"><span class="pcat-tag">${cat}</span>`;
    for (const [name, data] of Object.entries(items)) {
      const key = cat + "||" + name; const isEdit = state.editPriceKey === key;
      const ek = key.replace(/'/g, "\\'");
      h += `<div class="price-row"><div class="pname">${name} <span style="font-size:.875rem;color:var(--tx3)">${data.unit}</span></div><div class="pfields">`;
      if (state.priceEditMode === "breakdown") {
        if (isEdit && state.editField === "matCost") h += `<input class="pedit" type="number" value="${data.matCost}" autofocus onblur="editPrice('${ek}','matCost',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
        else h += `<span class="pchip mat" onclick="state.editPriceKey='${ek}';state.editField='matCost';renderPrices()">Mat ₲${fmt(data.matCost)}</span>`;
        if (isEdit && state.editField === "laborCost") h += `<input class="pedit" type="number" value="${data.laborCost}" autofocus onblur="editPrice('${ek}','laborCost',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
        else h += `<span class="pchip lab" onclick="state.editPriceKey='${ek}';state.editField='laborCost';renderPrices()">MO ₲${fmt(data.laborCost)}${data.laborPct != null ? `<span class="pctbadge">${data.laborPct}%</span>` : ""}</span>`;
        h += `<span class="pchip tot ro">= ₲${fmt(data.total)}</span>`;
      } else {
        h += `<span class="pct-pill mat">${Math.round(data.matCost / (data.total || 1) * 100)}% mat</span><span class="pct-pill lab">${Math.round(data.laborCost / (data.total || 1) * 100)}% MO</span>`;
        if (isEdit) h += `<input class="pedit" type="number" value="${data.total}" autofocus onblur="editPrice('${ek}','total',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
        else h += `<span class="pchip tot" onclick="state.editPriceKey='${ek}';state.editField='total';renderPrices()">₲${fmt(data.total)}</span>`;
      }
      h += `</div></div>`;
    }
    h += `</div>`;
  }
  el.innerHTML = h + `</div></div>`;
}

function editPrice(key, field, val) {
  const v = parseFloat(val); if (isNaN(v) || v < 0) { state.editPriceKey = null; renderPrices(); return; }
  const sep = key.indexOf("||"); const cat = key.slice(0, sep); const name = key.slice(sep + 2);
  const item = { ...DB[cat][name] };
  if (field === "matCost") { item.matCost = v; if (item.laborPct != null) item.laborCost = Math.round(v * item.laborPct / 100); item.total = item.matCost + item.laborCost; }
  else if (field === "laborCost") { item.laborCost = v; item.laborPct = null; item.total = item.matCost + v; }
  else { const r = v / (item.total || 1); item.matCost = Math.round(item.matCost * r); item.laborCost = Math.round(item.laborCost * r); item.total = v; }
  DB[cat][name] = item; state.editPriceKey = null; save(); renderPrices();
}

function applyGlobalAdjust() {
  const pct = state.adjustPct;
  if (isNaN(pct) || pct === 0) { toast("Ingresá un % de ajuste", false); return; }
  const factor = 1 + pct / 100;
  for (const cat of Object.values(DB))
    for (const item of Object.values(cat)) {
      item.matCost = Math.round(item.matCost * factor);
      item.laborCost = Math.round(item.laborCost * factor);
      item.total = item.matCost + item.laborCost;
    }
  save(); renderPrices(); updateBadge(); toast(`Precios ajustados ${pct > 0 ? "+" : ""}${pct}% ✓`);
}

// ── THEMES SECTION ────────────────────────────────────────────────────
const THEMES = [
  { id: "dark", name: "Constructor Dark", desc: "Oscuro ámbar", prev: { bg: "#0f1117", sur: "#181c26", acc: "#f59e0b", row: "#1e2330" } },
  { id: "light", name: "Obra de Día", desc: "Claro terracota", prev: { bg: "#f4f1eb", sur: "#ffffff", acc: "#c2410c", row: "#f9f7f3" } },
  { id: "blueprint", name: "Plano Técnico", desc: "Azul blueprint", prev: { bg: "#071525", sur: "#0c1f35", acc: "#38bdf8", row: "#102846" } },
  { id: "elegant", name: "Estudio Elegante", desc: "Beige y dorado", prev: { bg: "#faf8f5", sur: "#ffffff", acc: "#8b6914", row: "#f5f2ed" } },
  { id: "neon", name: "Noche Neón", desc: "Dark ultravioleta", prev: { bg: "#050508", sur: "#0d0d14", acc: "#a855f7", row: "#12121c" } },
  { id: "forest", name: "Bosque", desc: "Verde selva oscuro", prev: { bg: "#0d1a12", sur: "#132018", acc: "#4ade80", row: "#192a1f" } },
  { id: "copper", name: "Cobre", desc: "Dark naranja cálido", prev: { bg: "#1a0f0a", sur: "#26160e", acc: "#fb923c", row: "#301c12" } },
  { id: "midnight", name: "Midnight", desc: "GitHub dark", prev: { bg: "#010409", sur: "#0d1117", acc: "#58a6ff", row: "#161b22" } },
  { id: "sand", name: "Arena", desc: "Claro cálido", prev: { bg: "#f7f3ee", sur: "#fffdf9", acc: "#b45309", row: "#f0ebe3" } },
  { id: "crimson", name: "Carmesí", desc: "Dark rojo intenso", prev: { bg: "#0f0508", sur: "#1a0a0f", acc: "#f43f5e", row: "#220e14" } },
  { id: "slate", name: "Pizarra", desc: "Claro minimalista", prev: { bg: "#f8fafc", sur: "#ffffff", acc: "#0f172a", row: "#f1f5f9" } },
  { id: "obsidian", name: "Obsidiana", desc: "Negro puro mono", prev: { bg: "#09090b", sur: "#18181b", acc: "#e4e4e7", row: "#1f1f23" } },
];

const PDF_THEMES = [
  { id: "corporate", name: "Corporativo", desc: "Azul profesional", bg: "#1e3a5f", sur: "#ffffff", acc: "#1e40af", row: "#eef2ff" },
  { id: "construction", name: "Construcción", desc: "Tierra y naranja", bg: "#7c2d12", sur: "#fffbf5", acc: "#c2410c", row: "#fef3e8" },
  { id: "minimal", name: "Minimalista", desc: "Blanco y negro", bg: "#111111", sur: "#ffffff", acc: "#111111", row: "#f5f5f5" },
  { id: "emerald", name: "Esmeralda", desc: "Verde ejecutivo", bg: "#064e3b", sur: "#f0fdf4", acc: "#059669", row: "#ecfdf5" },
  { id: "bordeaux", name: "Burdeos", desc: "Vino elegante", bg: "#4c0519", sur: "#fff1f2", acc: "#9f1239", row: "#ffe4e6" },
  { id: "slate", name: "Pizarra", desc: "Gris moderno", bg: "#1e293b", sur: "#f8fafc", acc: "#475569", row: "#f1f5f9" },
];

function renderThemes() {
  const el = document.getElementById("section-themes");
  if (!el) return;

  let appCards = THEMES.map(t => {
    const p = t.prev; const isActive = state.theme === t.id;
    return `<div class="theme-card${isActive ? " active" : ""}" onclick="selectTheme('${t.id}')" style="background:${p.sur};border-color:${isActive ? "var(--acc)" : "transparent"}">
      <div class="theme-preview" style="background:${p.bg}">
        <div class="theme-preview-hdr" style="background:${p.sur}"></div>
        <div class="theme-preview-body">
          <div class="theme-preview-sidebar" style="background:${p.sur}"></div>
          <div class="theme-preview-content">
            <div class="theme-preview-row" style="background:${p.row}"></div>
            <div class="theme-preview-row" style="background:${p.row}"></div>
            <div class="theme-preview-accent" style="background:${p.acc}"></div>
          </div>
        </div>
      </div>
      <div class="theme-label" style="background:${p.sur};color:${p.acc}">
        <div><div style="font-weight:700;font-size:0.95rem">${t.name}</div><div style="font-size:0.95rem;opacity:0.7;margin-top:1px">${t.desc}</div></div>
        <div class="theme-check" style="border-color:${p.acc};background:${isActive ? p.acc : "transparent"};color:${p.bg}">${isActive ? "✓" : ""}</div>
      </div>
    </div>`;
  }).join("");

  let pdfCards = PDF_THEMES.map(t => {
    const isA = state.pdfTheme === t.id;
    return `<div class="pdf-theme-card${isA ? " active" : ""}" onclick="state.pdfTheme='${t.id}';save();renderThemes();" style="background:${t.sur};border-color:${isA ? "var(--acc)" : "var(--bor)"}; padding: 10px; border-radius: 8px; border: 2px solid transparent; cursor: pointer">
      <div class="pdf-preview" style="background:${t.bg}; height: 60px; border-radius: 4px; position: relative; overflow: hidden; margin-bottom: 8px">
        <div style="background:${t.sur}20; height: 15px; width: 100%"></div>
        <div style="background:${t.sur}40; height: 2px; width: 70%; margin: 6px"></div>
        <div style="background:${t.sur}30; height: 2px; width: 50%; margin: 6px"></div>
        <div style="background:${t.acc}; height: 10px; width: 30%; position: absolute; bottom: 8px; right: 8px; border-radius: 2px"></div>
      </div>
      <div style="font-weight:700; font-size: 0.85rem">${t.name}</div>
      <div style="font-size: 0.75rem; opacity: 0.7">${t.desc}</div>
    </div>`;
  }).join("");

  el.innerHTML = `<div class="theme-wrap">
    <div class="sec-lbl">Interfaz de la Aplicación</div>
    <p style="font-size:.875rem;color:var(--tx3);margin-bottom:18px">Cambiá cómo se ve la herramienta mientras trabajás.</p>
    <div class="theme-grid">${appCards}</div>
    
    <div class="sec-lbl" style="margin-top:40px">Estilo de Documentos PDF</div>
    <p style="font-size:.875rem;color:var(--tx3);margin-bottom:18px">Seleccioná el diseño que verán tus clientes al exportar presupuestos y cronogramas.</p>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px">${pdfCards}</div>
  </div>`;
}
function selectTheme(id) { state.theme = id; applyTheme(id); save(); renderThemes(); toast("Tema aplicado ✓"); }

// ── EXPORT XLS ───────────────────────────────────────────────────────
function exportXLS() {
  const p = getActiveProject();
  const adenda = getActiveAdenda();
  if (!p || !adenda) return;

  const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const grouped = getGrouped();
  const BOM = "\uFEFF", nl = "\r\n", q = v => `"${String(v).replace(/"/g, '""')}"`;
  let csv = BOM;
  csv += q("PRESUPUESTO") + "," + q(adenda.name) + nl;
  csv += q("Proyecto") + "," + q(p.name) + nl;
  csv += q("Cliente") + "," + q(p.client || "-") + nl;
  csv += q("Dirección") + "," + q(p.address || "-") + nl;
  csv += q("Fecha") + "," + q(formatDatePY(new Date())) + nl;
  csv += nl;
  const ivaHeader = adenda.ivaEnabled ? q("IVA mat (₲)") + "," + q("IVA MO (₲)") + "," + q("IVA Total (₲)") + "," : "";
  csv += q("CATEGORÍA") + "," + q("DESCRIPCIÓN") + "," + q("UNIDAD") + "," + q("CANTIDAD") + "," + q("DESC.%") + "," + q("MATERIALES (₲)") + "," + q("MANO DE OBRA (₲)") + "," + q("P. UNITARIO (₲)") + "," + ivaHeader + q("TOTAL (₲)") + "," + q("NOTA INTERNA") + nl;
  for (const [cat, ci] of Object.entries(grouped)) {
    for (const item of ci) {
      const ep = effPrice(item);
      const { ivaMat, ivaLab, ivaTotal } = calcIVA(item.matCost, item.laborCost, item.qty);
      const totalItem = ep * item.qty + ivaTotal;
      const ivaRow = adenda.ivaEnabled ? q(Math.round(ivaMat)) + "," + q(Math.round(ivaLab)) + "," + q(Math.round(ivaTotal)) + "," : "";
      csv += q(cat) + "," + q(item.name) + "," + q(item.unit) + "," + q(item.qty) + "," + q(item.disc || 0) + "," + q(Math.round(item.matCost)) + "," + q(Math.round(item.laborCost)) + "," + q(Math.round(ep)) + "," + ivaRow + q(Math.round(totalItem)) + "," + q(item.note || "") + nl;
    }
  }
  csv += nl;
  csv += q("RESUMEN") + nl;
  csv += q("Materiales") + ",,,,,,," + q(Math.round(totalMats)) + nl;
  csv += q("Mano de Obra") + ",,,,,,," + q(Math.round(totalLabor)) + nl;
  csv += q("Costo Directo") + ",,,,,,," + q(Math.round(subtotal)) + nl;
  if (adenda.ivaEnabled) {
    csv += q("IVA Materiales (10%)") + ",,,,,,," + q(Math.round(ivaMat)) + nl;
    csv += q("IVA Mano de Obra (5%)") + ",,,,,,," + q(Math.round(ivaLab)) + nl;
    csv += q("Total IVA") + ",,,,,,," + q(Math.round(ivaTotal)) + nl;
  }
  if ((adenda.profitPct || 0) > 0) csv += q("Honorarios (" + adenda.profitPct + "%)") + ",,,,,,," + q(Math.round(profitAmt)) + nl;
  csv += q("TOTAL" + (adenda.ivaEnabled ? " (IVA incluido)" : "")) + ",,,,,,," + q(Math.round(total)) + nl;
  const mats = calcMaterials();
  if (mats.length > 0) {
    csv += nl + q("CÓMPUTO DE MATERIALES") + nl;
    csv += q("MATERIAL") + "," + q("CANTIDAD") + "," + q("UNIDAD") + "," + q("BOLSAS 50kg") + nl;
    for (const m of mats) {
      const isCem = m.name.toLowerCase().includes("cemento");
      csv += q(m.name) + "," + q(fmtD(m.qty, 3)) + "," + q(m.unit) + "," + q(isCem ? Math.ceil(m.qty / 50) : "") + nl;
    }
  }
  if ((adenda.notes || "").trim()) csv += nl + q("NOTAS") + nl + q(adenda.notes) + nl;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeClient = (p.client || p.name || "Proyecto").replace(/\s+/g, "_");
  a.href = url; a.download = `Presupuesto_${String(state.budgetNum || 1).padStart(4, "0")}_${safeClient}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast("Archivo exportado ✓"); closeModal();
}

// ── EXPORT GOOGLE SHEETS (.xlsx XML Spreadsheet) ─────────────────────
function exportToGoogleSheets() {
  const p = getActiveProject();
  const adenda = getActiveAdenda();
  if (!p || !adenda) return toast("Sin proyecto activo", false);
  if (!adenda.items.length) return toast("El presupuesto está vacío", false);

  toast("Generando archivo formateado...");

  const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const grouped = getGrouped();
  const ivaOn = adenda.ivaEnabled;

  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Helpers de celdas con estilo
  const cell = (v, type, style) => {
    const st = style ? ` ss:StyleID="${style}"` : '';
    return `<Cell${st}><Data ss:Type="${type}">${type === 'String' ? esc(v) : v}</Data></Cell>`;
  };
  const sC = (v, st) => cell(v, 'String', st || 'd');
  const nC = (v, st) => cell(v, 'Number', st || 'num');

  // ── Borders XML reutilizable ──
  const bAll = `<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders>`;
  const bThick = `<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/></Borders>`;
  const bAccent = `<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D97706"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D97706"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/></Borders>`;
  const numFmt = `<NumberFormat ss:Format="#,##0"/>`;

  // ── Column widths ──
  const colW = ivaOn
    ? [160, 280, 50, 70, 50, 110, 110, 110, 100, 100, 100, 130, 180]
    : [160, 280, 50, 70, 50, 110, 110, 110, 130, 180];
  const colXml = colW.map(w => `<Column ss:Width="${w}"/>`).join('');

  let rows = '';

  // ── HEADER del presupuesto ──
  rows += `<Row ss:Height="28">${sC('PRESUPUESTO DE OBRA','title')}${sC(adenda.name,'titleVal')}</Row>`;
  rows += `<Row ss:Height="20">${sC('Proyecto','lbl')}${sC(p.name,'val')}</Row>`;
  rows += `<Row ss:Height="20">${sC('Cliente','lbl')}${sC(p.client || '-','val')}</Row>`;
  rows += `<Row ss:Height="20">${sC('Dirección','lbl')}${sC(p.address || '-','val')}</Row>`;
  rows += `<Row ss:Height="20">${sC('Superficie','lbl')}${sC((p.m2Area || '-') + ' m²','val')}</Row>`;
  rows += `<Row ss:Height="20">${sC('Fecha','lbl')}${sC(formatDatePY(new Date()),'val')}</Row>`;
  if ((adenda.profitPct || 0) > 0)
    rows += `<Row ss:Height="20">${sC('Honorarios','lbl')}${sC(adenda.profitPct + '%','val')}</Row>`;
  rows += `<Row ss:Height="8"></Row>`;

  // ── ENCABEZADOS de tabla ──
  let hdrCells = `${sC('CATEGORÍA','hdr')}${sC('DESCRIPCIÓN','hdr')}${sC('UND','hdrC')}${sC('CANT.','hdrC')}${sC('DESC.%','hdrC')}${sC('MATERIALES (Gs.)','hdrR')}${sC('MANO OBRA (Gs.)','hdrR')}${sC('P.UNIT (Gs.)','hdrR')}`;
  if (ivaOn) hdrCells += `${sC('IVA Mat (Gs.)','hdrR')}${sC('IVA MO (Gs.)','hdrR')}${sC('IVA Total (Gs.)','hdrR')}`;
  hdrCells += `${sC('TOTAL (Gs.)','hdrR')}${sC('NOTA INTERNA','hdr')}`;
  rows += `<Row ss:Height="24">${hdrCells}</Row>`;

  // ── ITEMS por categoría ──
  let lastCat = '';
  for (const [cat, items] of Object.entries(grouped)) {
    if (cat !== lastCat) {
      const totalCols = ivaOn ? 13 : 10;
      rows += `<Row ss:Height="22">${sC(cat,'catRow')}${'<Cell ss:StyleID="catRow"/>'.repeat(totalCols - 1)}</Row>`;
      lastCat = cat;
    }
    for (const item of items) {
      const ep = effPrice(item);
      const { ivaMat: im, ivaLab: il, ivaTotal: it } = calcIVA(item.matCost, item.laborCost, item.qty);
      const totalItem = ep * item.qty + it;
      let cells = `${sC(cat,'d')}${sC(item.name,'dBold')}${sC(item.unit,'dc')}${nC(item.qty,'numC')}${nC(item.disc || 0,'numC')}${nC(Math.round(item.matCost),'num')}${nC(Math.round(item.laborCost),'num')}${nC(Math.round(ep),'num')}`;
      if (ivaOn) cells += `${nC(Math.round(im),'numIva')}${nC(Math.round(il),'numIva')}${nC(Math.round(it),'numIva')}`;
      cells += `${nC(Math.round(totalItem),'numTotal')}${sC(item.note || '','dNote')}`;
      rows += `<Row ss:Height="20">${cells}</Row>`;
    }
  }

  // ── RESUMEN ──
  rows += `<Row ss:Height="8"></Row>`;
  const totalCols = ivaOn ? 13 : 10;
  const sumLabelSpan = totalCols - 2;

  const sumRow = (label, val, st) => {
    const cells = [sC(label, st || 'sumLbl')];
    for (let i = 0; i < sumLabelSpan - 1; i++) cells.push(`<Cell ss:StyleID="${st || 'sumLbl'}"/>`);
    cells.push(nC(Math.round(val), st === 'totalLbl' ? 'totalNum' : 'sumNum'));
    // Add missing cells for internal notes column
    if (totalCols > (sumLabelSpan + 1)) {
        for (let i = 0; i < (totalCols - (sumLabelSpan + 1)); i++) cells.push(`<Cell ss:StyleID="${st || 'sumLbl'}"/>`);
    }
    return `<Row ss:Height="22">${cells.join('')}</Row>`;
  };

  rows += sumRow('Costo Materiales', totalMats);
  rows += sumRow('Costo Mano de Obra', totalLabor);
  rows += sumRow('Costo Directo (Subtotal)', subtotal);
  if (ivaOn) {
    rows += sumRow('IVA Materiales (10%)', ivaMat, 'ivaLbl');
    rows += sumRow('IVA Mano de Obra (5%)', ivaLab, 'ivaLbl');
    rows += sumRow('Total IVA', ivaTotal);
  }
  if ((adenda.profitPct || 0) > 0)
    rows += sumRow('Honorarios Profesionales (' + adenda.profitPct + '%)', profitAmt);
  rows += sumRow('TOTAL GENERAL' + (ivaOn ? ' (IVA incluido)' : ''), total, 'totalLbl');

  // ── NOTAS ──
  if ((adenda.notes || '').trim()) {
    rows += `<Row ss:Height="8"></Row>`;
    rows += `<Row ss:Height="22">${sC('NOTAS / CONDICIONES','catRow')}${'<Cell ss:StyleID="catRow"/>'.repeat(totalCols - 1)}</Row>`;
    rows += `<Row ss:Height="40">${sC(adenda.notes,'d')}${'<Cell ss:StyleID="d"/>'.repeat(totalCols - 1)}</Row>`;
  }

  // ── HOJA 2: Cómputo de Materiales ──
  const mats = calcMaterials();
  const matColXml = `<Column ss:Width="250"/><Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="100"/>`;
  let matRows = `<Row ss:Height="24">${sC('MATERIAL','hdr')}${sC('CANTIDAD','hdrR')}${sC('UNIDAD','hdrC')}${sC('BOLSAS 50kg','hdrC')}</Row>`;
  for (const m of mats) {
    const isCem = m.name.toLowerCase().includes("cemento");
    matRows += `<Row ss:Height="20">${sC(m.name,'d')}${nC(parseFloat(fmtD(m.qty, 3)),'num')}${sC(m.unit,'dc')}${isCem ? nC(Math.ceil(m.qty / 50),'numC') : '<Cell ss:StyleID="d"/>'}</Row>`;
  }

  // ── HOJA 3: Costo por m² ──
  let m2Sheet = '';
  if (p.m2Area && p.m2Area > 0) {
    const m2ColXml = `<Column ss:Width="200"/><Column ss:Width="150"/>`;
    m2Sheet = `<Worksheet ss:Name="Costo x m2"><Table>${m2ColXml}
<Row ss:Height="24">${sC('CONCEPTO','hdr')}${sC('VALOR','hdrR')}</Row>
<Row ss:Height="20">${sC('Superficie (m²)','d')}${nC(p.m2Area,'numC')}</Row>
<Row ss:Height="20">${sC('Costo Total (Gs.)','d')}${nC(Math.round(total),'numTotal')}</Row>
<Row ss:Height="24">${sC('COSTO POR m² (Gs.)','totalLbl')}${nC(Math.round(total / p.m2Area),'totalNum')}</Row>
</Table></Worksheet>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // STYLES — Formateado profesional con bordes, colores y tipografía
  // ══════════════════════════════════════════════════════════════════════
  const styles = `<Styles>
 <!-- Base -->
 <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>${bAll}</Style>

 <!-- Title row -->
 <Style ss:ID="title"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/>${bThick}<Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="titleVal"><Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#F59E0B"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/>${bThick}<Alignment ss:Vertical="Center"/></Style>

 <!-- Header info labels -->
 <Style ss:ID="lbl"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#475569"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>${bAll}<Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="val"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>${bAll}<Alignment ss:Vertical="Center"/></Style>

 <!-- Table headers -->
 <Style ss:ID="hdr"><Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/>${bThick}<Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/></Style>
 <Style ss:ID="hdrC"><Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/>${bThick}<Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>
 <Style ss:ID="hdrR"><Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/>${bThick}<Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/></Style>

 <!-- Category separator -->
 <Style ss:ID="catRow"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>${bAll}<Alignment ss:Vertical="Center"/></Style>

 <!-- Data cells -->
 <Style ss:ID="d"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>${bAll}<Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="dBold"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>${bAll}<Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="dc"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>${bAll}<Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
 <Style ss:ID="dNote"><Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#94A3B8"/>${bAll}<Alignment ss:Vertical="Center"/></Style>

 <!-- Number cells -->
 <Style ss:ID="num"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>${bAll}<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${numFmt}</Style>
 <Style ss:ID="numC"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>${bAll}<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>${numFmt}</Style>
 <Style ss:ID="numIva"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#059669"/>${bAll}<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${numFmt}</Style>
 <Style ss:ID="numTotal"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>${bAll}<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${numFmt}</Style>

 <!-- Summary rows -->
 <Style ss:ID="sumLbl"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#334155"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>${bAll}<Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="sumNum"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>${bAll}<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${numFmt}</Style>
 <Style ss:ID="ivaLbl"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#059669"/><Interior ss:Color="#F0FDF4" ss:Pattern="Solid"/>${bAll}<Alignment ss:Vertical="Center"/></Style>

 <!-- Grand total -->
 <Style ss:ID="totalLbl"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#D97706" ss:Pattern="Solid"/>${bAccent}<Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="totalNum"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#D97706" ss:Pattern="Solid"/>${bAccent}<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${numFmt}</Style>
</Styles>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${styles}
<Worksheet ss:Name="Presupuesto"><Table ss:DefaultRowHeight="20">${colXml}${rows}</Table></Worksheet>
<Worksheet ss:Name="Computo Materiales"><Table ss:DefaultRowHeight="20">${matColXml}${matRows}</Table></Worksheet>
${m2Sheet}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (p.client || p.name || 'Proyecto').replace(/\s+/g, '_');
  a.href = url;
  a.download = `Presupuesto_${safe}_${formatDatePY(new Date()).replace(/\//g,'-')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  toast("✓ Presupuesto exportado con formato profesional");
}

// ── EXPORT MS PROJECT (XML) ─────────────────────────────────────────
function exportScheduleMSProject() {
  const p = getActiveProject();
  const adenda = getActiveAdenda();
  if (!p || !adenda) return toast("Sin proyecto activo", false);
  if (!adenda.items.length) return toast("Agregá items al presupuesto primero", false);

  const schedules = p.execution.schedules || {};
  const projectStart = p.execution.projectStartDate || todayISO();
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const mspDate = d => { if (!d) return ''; return new Date(d).toISOString().replace(/\.\d{3}Z$/, ''); };
  const calcDur = (s, e) => {
    if (!s || !e) return 'PT8H0M0S';
    let d = Math.max(1, Math.round((new Date(e) - new Date(s)) / 86400000) + 1);
    d -= Math.floor(d / 7) * 2;
    return `PT${Math.max(1, d) * 8}H0M0S`;
  };

  let tasks = '', uid = 1;
  tasks += `<Task><UID>0</UID><ID>0</ID><Name>${esc(p.name)}</Name><Type>1</Type><OutlineLevel>0</OutlineLevel><Start>${mspDate(projectStart)}</Start><Summary>1</Summary></Task>`;

  const cats = {};
  adenda.items.forEach(it => { if (!cats[it.cat]) cats[it.cat] = []; cats[it.cat].push(it); });
  const tMap = {};

  for (const [cat, items] of Object.entries(cats)) {
    tasks += `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${esc(cat)}</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary><Type>1</Type></Task>`;
    uid++;
    for (const item of items) {
      const sch = schedules[item.id] || {};
      const st = sch.start || projectStart, en = sch.end || st;
      const pct = sch.status === 'done' ? 100 : sch.status === 'progress' ? 50 : 0;
      tMap[item.id] = uid;
      tasks += `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${esc(item.name)}</Name><OutlineLevel>2</OutlineLevel><Type>0</Type><Start>${mspDate(st)}</Start><Finish>${mspDate(en)}</Finish><Duration>${calcDur(st, en)}</Duration><PercentComplete>${pct}</PercentComplete><FixedCost>${Math.round(effPrice(item) * item.qty)}</FixedCost><Notes>${esc(item.qty + ' ' + item.unit)}</Notes><Summary>0</Summary></Task>`;
      uid++;
    }
  }

  let resources = '', rUid = 1, cMap = {};
  (state.contractors || []).filter(c => !c.isBlacklisted).forEach(c => {
    cMap[c.id] = rUid;
    resources += `<Resource><UID>${rUid}</UID><ID>${rUid}</ID><Name>${esc(c.name)}</Name><Type>1</Type><Group>${esc(c.specialty || '')}</Group></Resource>`;
    rUid++;
  });

  let assignments = '', aUid = 1;
  adenda.items.forEach(it => {
    const sch = schedules[it.id] || {};
    if (sch.contractorId && cMap[sch.contractorId] && tMap[it.id])
      assignments += `<Assignment><UID>${aUid++}</UID><TaskUID>${tMap[it.id]}</TaskUID><ResourceUID>${cMap[sch.contractorId]}</ResourceUID><Units>1</Units></Assignment>`;
  });

  const wd = n => `<WeekDay><DayType>${n}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>07:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>16:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
<Name>${esc(p.name)}</Name><Title>${esc(p.name)} - Cronograma</Title>
<Company>${esc((state.profile && state.profile.company) || '')}</Company>
<StartDate>${mspDate(projectStart)}</StartDate>
<CurrencySymbol>Gs.</CurrencySymbol><CurrencyCode>PYG</CurrencyCode>
<CalendarUID>1</CalendarUID><DefaultStartTime>07:00:00</DefaultStartTime><DefaultFinishTime>16:00:00</DefaultFinishTime>
<MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>22</DaysPerMonth>
<Calendars><Calendar><UID>1</UID><Name>Paraguay</Name><IsBaseCalendar>1</IsBaseCalendar>
<WeekDays><WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>${wd(2)}${wd(3)}${wd(4)}${wd(5)}${wd(6)}<WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay></WeekDays>
</Calendar></Calendars>
<Tasks>${tasks}</Tasks><Resources>${resources}</Resources><Assignments>${assignments}</Assignments>
</Project>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Cronograma_${(p.name || 'proyecto').replace(/\s+/g, '_')}.xml`;
  a.click(); URL.revokeObjectURL(url);
  toast("Cronograma MS Project (.xml) exportado ✓");
}

// ── PDF ────────────────────────────────────────────────────────────────
function pdfTxt(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[₲]/g, "Gs.").replace(/[—–]/g, "-").replace(/[""]/g, '"').replace(/['']/g, "'");
}

/**
 * Dibuja el logo de Puntero (sello con casco + llana) directamente en el PDF
 * usando primitivas de jsPDF. No requiere imagen externa.
 *
 * @param {jsPDF} doc      Instancia del documento
 * @param {number} cx      Centro X en mm
 * @param {number} cy      Centro Y en mm
 * @param {number} r       Radio del sello en mm (recomendado: 9-10)
 */
function drawPunteroLogo(doc, cx, cy, r) {
  // Círculo de fondo oscuro
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.circle(cx, cy, r, "F");
  // Anillo naranja
  doc.setDrawColor(245, 158, 11); // #f59e0b
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r - 0.7, "S");

  // Llana inclinada (rectángulo trapezoidal naranja, simulado con líneas)
  // Centro del logo, escalado al radio
  const s = r / 9; // factor de escala (radio 9 = tamaño base)
  doc.setFillColor(245, 158, 11);
  // Cuerpo de la llana — un trapecio inclinado -30°
  // Aproximación: dos triángulos que forman el trapecio rotado
  const cos30 = Math.cos(-Math.PI / 6);
  const sin30 = Math.sin(-Math.PI / 6);
  const rotate = (px, py) => [
    cx + (px * cos30 - py * sin30) * s,
    cy + (px * sin30 + py * cos30) * s
  ];
  // Trapecio: (-5, -0.5) (5, -0.5) (4, 3) (-4, 3)
  const p1 = rotate(-5, -0.5);
  const p2 = rotate(5, -0.5);
  const p3 = rotate(4, 3);
  const p4 = rotate(-4, 3);
  doc.triangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], "F");
  doc.triangle(p1[0], p1[1], p3[0], p3[1], p4[0], p4[1], "F");

  // Casco blanco al frente
  doc.setFillColor(255, 255, 255);
  // Visera (elipse achatada)
  doc.ellipse(cx, cy + 1.5 * s, 4.5 * s, 0.7 * s, "F");
  // Cuerpo del casco (semicírculo aproximado con triángulos)
  // Dibujo el cuerpo como un sector circular
  doc.setFillColor(255, 255, 255);
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    const a1 = Math.PI + (i / segments) * Math.PI;
    const a2 = Math.PI + ((i + 1) / segments) * Math.PI;
    const ax = cx + Math.cos(a1) * 4 * s;
    const ay = cy + 1.5 * s + Math.sin(a1) * 3 * s;
    const bx = cx + Math.cos(a2) * 4 * s;
    const by = cy + 1.5 * s + Math.sin(a2) * 3 * s;
    doc.triangle(cx, cy + 1.5 * s, ax, ay, bx, by, "F");
  }
  // Borde sutil del casco
  doc.setDrawColor(203, 213, 225); // #cbd5e1
  doc.setLineWidth(0.15);
  doc.ellipse(cx, cy + 1.5 * s, 4.5 * s, 0.7 * s, "S");

  // Reset
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
}

function generarPDF() {
  const adenda = getActiveAdenda();
  const proj = getActiveProject();
  if (!adenda || !proj) { toast("Sin proyecto activo", false); return; }
  if (adenda.items.length === 0) { toast("Agrega items primero", false); return; }
  if (typeof window.jspdf === "undefined" && typeof jsPDF === "undefined") { toast("jsPDF cargando, intentá en 2 segundos", false); return; }
  const { jsPDF: JPDF } = window.jspdf || { jsPDF: window.jsPDF };
  const doc = new JPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 14;
  const p = state.profile;
  const ivaEnabled = !!adenda.ivaEnabled;
  const profitPct = adenda.profitPct || 0;
  const validDays = state.validDays || 30;
  const budgetNum = state.budgetNum || 1;
  const projectName = proj.name || "";
  const clientName = proj.client || "";
  const clientAddress = proj.address || "";
  const clientPhone = proj.phone || "";
  const notes = adenda.notes || "";
  const { subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
  const grouped = getGrouped();
  const today = new Date().toLocaleDateString("es-PY", { year: "numeric", month: "long", day: "numeric" });
  const PALETTES = {
    corporate: { hdrBg: [30, 58, 138], hdrTx: [255, 255, 255], accentBg: [30, 64, 175], accentTx: [255, 255, 255], catBg: [238, 242, 255], catTx: [30, 64, 175], bodyTx: [15, 23, 42], mutedTx: [71, 85, 105], borderC: [226, 232, 240], altRow: [248, 250, 252], totalBg: [30, 58, 138], totalTx: [255, 255, 255] },
    construction: { hdrBg: [124, 45, 18], hdrTx: [255, 251, 245], accentBg: [194, 65, 12], accentTx: [255, 255, 255], catBg: [255, 237, 213], catTx: [154, 52, 18], bodyTx: [28, 20, 10], mutedTx: [120, 80, 40], borderC: [253, 186, 116], altRow: [255, 247, 237], totalBg: [124, 45, 18], totalTx: [255, 251, 245] },
    minimal: { hdrBg: [17, 17, 17], hdrTx: [255, 255, 255], accentBg: [17, 17, 17], accentTx: [255, 255, 255], catBg: [245, 245, 245], catTx: [50, 50, 50], bodyTx: [30, 30, 30], mutedTx: [100, 100, 100], borderC: [210, 210, 210], altRow: [250, 250, 250], totalBg: [17, 17, 17], totalTx: [255, 255, 255] },
    emerald: { hdrBg: [6, 78, 59], hdrTx: [240, 253, 244], accentBg: [5, 150, 105], accentTx: [255, 255, 255], catBg: [236, 253, 245], catTx: [6, 78, 59], bodyTx: [6, 28, 21], mutedTx: [52, 105, 79], borderC: [167, 243, 208], altRow: [240, 253, 244], totalBg: [6, 78, 59], totalTx: [240, 253, 244] },
    bordeaux: { hdrBg: [76, 5, 25], hdrTx: [255, 241, 242], accentBg: [159, 18, 57], accentTx: [255, 255, 255], catBg: [255, 228, 230], catTx: [136, 19, 55], bodyTx: [30, 5, 12], mutedTx: [100, 40, 55], borderC: [252, 165, 180], altRow: [255, 241, 242], totalBg: [76, 5, 25], totalTx: [255, 241, 242] },
    slate: { hdrBg: [30, 41, 59], hdrTx: [248, 250, 252], accentBg: [71, 85, 105], accentTx: [255, 255, 255], catBg: [241, 245, 249], catTx: [51, 65, 85], bodyTx: [15, 23, 42], mutedTx: [100, 116, 139], borderC: [203, 213, 225], altRow: [248, 250, 252], totalBg: [30, 41, 59], totalTx: [248, 250, 252] },
  };
  const C = PALETTES[state.pdfTheme] || PALETTES.corporate;
  // Derivar hdrTx2 = versión más tenue del color del header (70% opacidad simulada al mezclar con hdrBg)
  C.hdrTx2 = C.hdrTx2 || [
    Math.round(C.hdrTx[0] * 0.75 + C.hdrBg[0] * 0.25),
    Math.round(C.hdrTx[1] * 0.75 + C.hdrBg[1] * 0.25),
    Math.round(C.hdrTx[2] * 0.75 + C.hdrBg[2] * 0.25),
  ];
  let y = 0;
  // Header
  doc.setFillColor(...C.hdrBg); doc.rect(0, 0, W, 36, "F");
  if (state.logoDataUrl) {
    try { doc.addImage(state.logoDataUrl, "PNG", M, 8, 24, 16); } catch (e) {
      drawPunteroLogo(doc, M + 10, 18, 9);
    }
  } else {
    // Logo Puntero por defecto: sello con casco + llana
    drawPunteroLogo(doc, M + 10, 18, 9);
  }
  const tX = M + 24;
  doc.setTextColor(...C.hdrTx);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(pdfTxt(p.company || p.professional || "Puntero"), tX, 13);
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.hdrTx2);
  const lines = [];
  if (p.professional) lines.push(pdfTxt(p.professional + (p.matricula ? " - " + p.matricula : "")));
  if (p.ruc) lines.push("RUC: " + pdfTxt(p.ruc));
  if (p.phone || p.email) lines.push([p.phone, p.email].filter(Boolean).join("   -   "));
  if (p.address) lines.push(pdfTxt(p.address));
  const social = [p.instagram, p.whatsapp, p.website].filter(Boolean).join("   -   ");
  if (social) lines.push(pdfTxt(social));
  lines.forEach((l, i) => doc.text(l, tX, 19 + i * 4.5));
  doc.setTextColor(...C.hdrTx);
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("PRESUPUESTO", W - M, 11, { align: "right" });
  doc.setFontSize(18); doc.text("N\u00BA " + String(budgetNum).padStart(4, "0"), W - M, 21, { align: "right" });
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.hdrTx2);
  doc.text(today, W - M, 27, { align: "right" });
  // Reset al body
  doc.setTextColor(...C.bodyTx);
  y = 42;
  // Client & Project boxes
  const colW = (W - M * 2 - 5) / 2;
  doc.setFillColor(...C.catBg); doc.roundedRect(M, y, colW, 26, 2, 2, "F");
  doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.roundedRect(M, y, colW, 26, 2, 2, "S");
  doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentBg); doc.text("CLIENTE", M + 3, y + 5.5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.bodyTx); doc.setFontSize(9.5); doc.text(pdfTxt(clientName) || "-", M + 3, y + 12, { maxWidth: colW - 6 });
  doc.setFontSize(7.5); doc.setTextColor(...C.mutedTx);
  if (clientAddress) doc.text(clientAddress, M + 3, y + 18, { maxWidth: colW - 6 });
  if (clientPhone) doc.text("Tel: " + clientPhone, M + 3, y + 23, { maxWidth: colW - 6 });
  const c2 = M + colW + 5;
  doc.setFillColor(248, 250, 252); doc.roundedRect(c2, y, colW, 26, 2, 2, "F"); doc.setDrawColor(...C.borderC); doc.roundedRect(c2, y, colW, 26, 2, 2, "S");
  doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentBg); doc.text("PROYECTO / OBRA", c2 + 3, y + 5.5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.bodyTx); doc.setFontSize(9.5); doc.text(pdfTxt(projectName) || "-", c2 + 3, y + 12, { maxWidth: colW - 6 });
  doc.setFontSize(7.5); doc.setTextColor(...C.mutedTx);
  doc.text("Validez: " + validDays + " dias desde emision", c2 + 3, y + 18, { maxWidth: colW - 6 });
  doc.text("Adenda: " + (adenda.name || "-"), c2 + 3, y + 23, { maxWidth: colW - 6 });
  y += 32;
  // Info strip
  const stripMsg = ivaEnabled
    ? "Precios unitarios incluyen materiales y mano de obra - IVA incluido (10% mat / 5% MO) - Valores en Guaranies (Gs.)"
    : "Precios unitarios incluyen materiales y mano de obra - Valores en Guaranies (Gs.) paraguayos";
  doc.setFillColor(254, 243, 199); doc.rect(M, y, W - M * 2, 6, "F");
  doc.setFontSize(6.5); doc.setFont("helvetica", "italic"); doc.setTextColor(146, 64, 14);
  doc.text("  " + stripMsg, M + 2, y + 4.2);
  y += 10;
  // Items table
  const rows = []; let rowNum = 1;
  for (const [cat, ci] of Object.entries(grouped)) {
    rows.push([{ content: pdfTxt(cat), colSpan: 6, styles: { fillColor: C.catBg, textColor: C.catTx, fontStyle: "bold", fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } } }]);
    let catSubtotal = 0;
    for (const item of ci) {
      const { ivaTotal: ivaItem } = calcIVA(item.matCost, item.laborCost, item.qty);
      const totalItem = item.unitPrice * item.qty + (ivaEnabled ? ivaItem : 0);
      catSubtotal += totalItem;
      rows.push([
        { content: String(rowNum++), styles: { halign: "center", fontSize: 7.5, textColor: C.mutedTx } },
        { content: pdfTxt(item.name), styles: { fontSize: 8 } },
        { content: pdfTxt(item.unit), styles: { halign: "center", fontSize: 8 } },
        { content: String(item.qty), styles: { halign: "center", fontSize: 8 } },
        { content: "Gs. " + fmt(item.unitPrice + (ivaEnabled ? Math.round(ivaItem / item.qty) : 0)), styles: { halign: "right", fontSize: 7.5 } },
        { content: "Gs. " + fmt(totalItem), styles: { halign: "right", fontStyle: "bold", fontSize: 7.5 } },
      ]);
    }
    // Banda destacada de subtotal por categoría
    rows.push([
      { content: "Subtotal " + pdfTxt(cat), colSpan: 5, styles: { halign: "right", fontStyle: "bold", fontSize: 8, fillColor: C.accentBg, textColor: C.accentTx, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } } },
      { content: "Gs. " + fmt(catSubtotal), styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: C.accentBg, textColor: C.accentTx, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } } },
    ]);
  }
  doc.autoTable({
    startY: y,
    head: [[{ content: "#", styles: { halign: "center" } }, { content: "DESCRIPCIÓN / RUBRO" }, { content: "UNID.", styles: { halign: "center" } }, { content: "CANT.", styles: { halign: "center" } }, { content: "PRECIO UNIT.", styles: { halign: "right" } }, { content: "TOTAL", styles: { halign: "right" } }]],
    body: rows, theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 }, lineColor: C.borderC, lineWidth: 0.2, textColor: C.bodyTx },
    headStyles: { fillColor: C.accentBg, textColor: C.accentTx, fontStyle: "bold", fontSize: 7, cellPadding: { top: 4, bottom: 4, left: 3, right: 3 } },
    alternateRowStyles: { fillColor: C.altRow },
    columnStyles: { 0: { cellWidth: 7, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 12, halign: "center" }, 3: { cellWidth: 17, halign: "center" }, 4: { cellWidth: 33, halign: "right" }, 5: { cellWidth: 40, halign: "right" } },
    margin: { left: M, right: M },
    tableWidth: "wrap",
    didParseCell: data => {
      // Categoría
      if (data.row.raw?.[0]?.colSpan === 6) { data.cell.styles.fillColor = C.catBg; data.cell.styles.textColor = C.catTx; data.cell.styles.fontStyle = "bold"; }
      // Subtotal (colSpan = 5 en la primera celda)
      if (data.row.raw?.[0]?.colSpan === 5) { data.cell.styles.fillColor = C.accentBg; data.cell.styles.textColor = C.accentTx; data.cell.styles.fontStyle = "bold"; }
    },
  });
  y = doc.lastAutoTable.finalY + 8;
  // Totals box
  const totW = 110; const totX = W - M - totW;
  if (y + 40 > 275) { doc.addPage(); y = M; }
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
  doc.text("Subtotal materiales y mano de obra:", totX, y + 5);
  doc.setTextColor(...C.bodyTx); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(subtotal), W - M, y + 5, { align: "right" }); y += 8;
  if (ivaEnabled) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.text("IVA materiales (10%):", totX, y + 5); doc.setTextColor(79, 70, 229); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(ivaMat), W - M, y + 5, { align: "right" }); y += 7;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.text("IVA mano de obra (5%):", totX, y + 5); doc.setTextColor(79, 70, 229); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(ivaLab), W - M, y + 5, { align: "right" }); y += 7;
  }
  if (profitPct > 0) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.text("Honorarios profesionales (" + profitPct + "%):", totX, y + 5);
    doc.setTextColor(22, 163, 74); doc.setFont("helvetica", "bold"); doc.text("Gs. " + fmt(profitAmt), W - M, y + 5, { align: "right" }); y += 8;
  }
  doc.setDrawColor(...C.accentBg); doc.setLineWidth(0.6); doc.line(totX, y, W - M, y); y += 2;
  doc.setFillColor(...C.totalBg); doc.roundedRect(totX, y, totW, 13, 2, 2, "F");
  doc.setTextColor(...C.totalTx); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("TOTAL" + (ivaEnabled ? " (IVA inc.)" : "") + ":", totX + 4, y + 8);
  doc.setFontSize(10); doc.text("Gs. " + fmt(total), W - M - 3, y + 8, { align: "right" }); y += 19;
  // Notes
  if (notes && notes.trim()) {
    if (y + 20 > 275) { doc.addPage(); y = M; }
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.accentBg); doc.text("NOTAS Y CONDICIONES:", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    const nl2 = doc.splitTextToSize(pdfTxt(notes), W - M * 2); doc.text(nl2, M, y);
  }
  // Signature
  if (state.signDataUrl) {
    const sigY = y + 2;
    if (sigY + 22 < 280) {
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
      doc.text("Firma profesional:", M, sigY + 4);
      try { doc.addImage(state.signDataUrl, "PNG", M, sigY + 6, 50, 14); } catch (e) { }
      doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.line(M, sigY + 21, M + 60, sigY + 21);
      doc.text(pdfTxt(p.professional || p.company || ""), M, sigY + 25);
    }
  }
  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mutedTx);
    doc.setDrawColor(...C.borderC); doc.setLineWidth(0.3); doc.line(M, 287, W - M, 287);
    doc.text((p.company || "Puntero") + (p.ruc ? " - RUC: " + p.ruc : ""), M, 292);
    doc.text("Pagina " + i + " de " + pages, W - M, 292, { align: "right" });
  }
  const fn = "Presupuesto_" + String(budgetNum).padStart(4, "0") + "_" + (clientName || projectName || "Proyecto").replace(/\s+/g, "_") + ".pdf";
  doc.save(fn);
  toast("PDF generado ✓");
}

// ── MODALS ────────────────────────────────────────────────────────────
function createProject() {
    const name = document.getElementById("np-name").value.trim();
    if (!name) return toast("El nombre es obligatorio", false);

    const newP = {
        id: 'p_' + Date.now(),
        name: name,
        client: document.getElementById("np-client").value,
        phone: document.getElementById("np-phone").value,
        address: document.getElementById("np-addr").value,
        m2Area: parseFloat(document.getElementById("np-m2").value) || 0,
        date: formatDatePY(new Date()),
        status: 'active',
        archived: false,
        activeAdendaId: 'main',
        budgets: [
            {
                id: 'main',
                name: 'Presupuesto Principal',
                items: [],
                profitPct: 0,
                ivaEnabled: false,
                notes: ""
            }
        ],
        execution: {
            schedules: {},
            dailyLogs: [],
            materialOrders: [],
            finances: { income: [], expenses: [] },
            documents: [],
            aftercare: [],
            projectStartDate: "",
            projectEndDate: ""
        }
    };

    state.projects.push(newP);
    state.activeProjectId = newP.id;
    state.activeAdendaId = 'main';
    save();
    closeModal();
    setSection('budget');
    toast("Proyecto creado ✓");
}

function saveEditProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    const name = document.getElementById("ep-name").value.trim();
    if (!name) return toast("El nombre es obligatorio", false);
    p.name = name;
    p.client = document.getElementById("ep-client").value;
    p.phone = document.getElementById("ep-phone").value;
    p.address = document.getElementById("ep-addr").value;
    p.m2Area = parseFloat(document.getElementById("ep-m2").value) || 0;
    save(); closeModal(); renderProjects();
    toast("Proyecto actualizado ✓");
}

function archiveProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    p.archived = true;
    if (state.activeProjectId === id) {
        const next = state.projects.find(x => x.id !== id && !x.archived);
        state.activeProjectId = next ? next.id : null;
    }
    save(); renderProjects();
    toast("Proyecto archivado 📦");
}

function unarchiveProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    p.archived = false;
    save(); renderProjects();
    toast("Proyecto restaurado ✓");
}

function deleteProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`¿Eliminar el proyecto "${p.name}" permanentemente?\n\nSe borrarán todos los presupuestos, cronogramas, bitácoras, finanzas y documentos asociados.\n\nEsta acción no se puede deshacer.`)) return;
    if (confirm("¿Hacer una copia de seguridad antes de eliminar?")) {
        exportSingleProject(id);
    }
    state.projects = state.projects.filter(x => x.id !== id);
    if (state.activeProjectId === id) {
        const next = state.projects.find(x => !x.archived);
        state.activeProjectId = next ? next.id : null;
    }
    save(); renderProjects();
    toast("Proyecto eliminado ✕");
}

function exportSingleProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    const assignedConIds = new Set(
        Object.values(p.execution.schedules || {})
            .map(s => s && s.contractorId)
            .filter(Boolean)
    );
    const contractors = (state.contractors || []).filter(c => assignedConIds.has(c.id));
    const data = { project: JSON.parse(JSON.stringify(p)), contractors, profile: state.profile, exportDate: new Date().toISOString(), app: "Puntero", version: "7.0" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Backup_${(p.name || "proyecto").replace(/\s+/g, '_')}.ppy`;
    a.click();
    URL.revokeObjectURL(url);
}

function showModal(type, arg) {
  const el = document.getElementById("modal-area");
  if (!el) return;

  if (window.modals && typeof window.modals[type] === 'function') {
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${window.modals[type](arg)}</div></div>`;
    return;
  }

  if (type === "new_project") {
      el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px">
      <div class="modal-title">Crear Nuevo Proyecto<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="grid2">
        <div class="fullcol"><label class="stat-lbl">Nombre de la Obra</label><input id="np-name" placeholder="Ej: Residencia Martinez"></div>
        <div><label class="stat-lbl">Cliente</label><input id="np-client" placeholder="Nombre completo"></div>
        <div><label class="stat-lbl">Teléfono</label><input id="np-phone" placeholder="WhatsApp"></div>
        <div class="fullcol"><label class="stat-lbl">Ubicación / Dirección</label><input id="np-addr" placeholder="Ciudad, Barrio..."></div>
        <div><label class="stat-lbl">Superficie (m²)</label><input id="np-m2" type="number" placeholder="0"></div>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="createProject()">Crear e Iniciar 🚀</button>
      </div></div></div>`;
  }

  else if (type === "edit_project") {
      const pid = arg;
      const p = state.projects.find(x => x.id === pid);
      if (!p) return;
      el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px">
      <div class="modal-title">Modificar Proyecto<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="grid2">
        <div class="fullcol"><label class="stat-lbl">Nombre de la Obra</label><input id="ep-name" value="${p.name.replace(/"/g, '&quot;')}"></div>
        <div><label class="stat-lbl">Cliente</label><input id="ep-client" value="${(p.client || '').replace(/"/g, '&quot;')}"></div>
        <div><label class="stat-lbl">Teléfono</label><input id="ep-phone" value="${(p.phone || '').replace(/"/g, '&quot;')}"></div>
        <div class="fullcol"><label class="stat-lbl">Ubicación / Dirección</label><input id="ep-addr" value="${(p.address || '').replace(/"/g, '&quot;')}"></div>
        <div><label class="stat-lbl">Superficie (m²)</label><input id="ep-m2" type="number" value="${p.m2Area || 0}"></div>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveEditProject('${pid}')">Guardar Cambios 💾</button>
      </div></div></div>`;
  }

  else if (type === "load_version") {
    const p = getActiveProject();
    const versions = (p && p.versions) || [];
    let rows = versions.map(v => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--bor)">
            <div>
                <div style="font-weight:700">${v.name}</div>
                <div style="font-size:0.75rem; color:var(--tx3)">${formatDatePY(v.date)} - ${v.items?.length || 0} ítems</div>
            </div>
            <div style="display:flex; gap:5px">
                <button class="btn sm" onclick="loadVersion('${v.id}')">📂 Cargar</button>
                <button class="btn sm danger" onclick="deleteVersion('${v.id}'); showModal('load_version')">✕</button>
            </div>
        </div>
    `).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
            <div class="modal-title">Historial de Versiones<button class="delbtn" onclick="closeModal()">✕</button></div>
            <div style="max-height:400px; overflow-y:auto">
                ${rows || '<p style="text-align:center; padding:20px; color:var(--tx3)">No hay versiones guardadas.</p>'}
            </div>
        </div></div>`;
    return;
  }

  if (type === "export") {
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:480px">
      <div class="modal-title">Exportar Presupuesto<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="export-options">
        <div class="export-card" onclick="exportXLS()"><div class="export-icon">📊</div><div class="export-name">Excel / CSV</div><div class="export-desc">Abre con doble clic en Excel o LibreOffice</div></div>
        <div class="export-card" onclick="exportToGoogleSheets()"><div class="export-icon">📋</div><div class="export-name">Google Sheets</div><div class="export-desc">Archivo → Abrir → Subir en Google Sheets</div></div>
      </div>
      <p style="font-size:.95rem;color:var(--tx3);text-align:center;font-style:italic">Incluye ítems, desglose mat/MO, cómputo de materiales y notas.</p>
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn success" onclick="exportXLS()">Descargar</button></div>
    </div></div>`;
  }

  else if (type === "export_project") {
    const proj = getActiveProject();
    const projName = proj ? proj.name : "el proyecto activo";
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:440px">
      <div class="modal-title">🚀 Enviar Proyecto a un Colega<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div style="text-align:center; padding:10px 0">
        <div style="font-size:3rem; margin-bottom:10px">📦</div>
        <p style="font-size:1rem; color:var(--tx2); margin-bottom:14px">Se generará un archivo <strong>.ppy</strong> con toda la información de <strong>${projName}</strong>.</p>
        <div style="background:rgba(var(--acc-rgb), 0.05); padding:12px; border-radius:var(--rad); text-align:left; font-size:0.875rem; color:var(--tx2); margin-bottom:16px">
          <strong>¿Qué incluye este archivo?</strong><br>
          ✅ Presupuesto completo y todas las adendas<br>
          ✅ Cronograma y estados de obra<br>
          ✅ Bitácora, finanzas y materiales<br>
          ✅ Contratistas asignados a este proyecto<br>
          ✅ Notas, honorarios e IVA
        </div>
        <p style="font-size:0.875rem; color:var(--tx3)">Tu colega solo tiene que arrastrar este archivo a su instancia de Puntero para ver todo.</p>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn sm" onclick="importProject()">📥 Importar Proyecto</button>
        <button class="btn primary" onclick="exportProject()">Exportar y Enviar 📤</button>
      </div>
    </div></div>`;
  }

  else if (type === "computo") {
    const mats = calcMaterials();
    let cards = mats.length === 0 ? `<p style="font-size:1rem;color:var(--tx3)">Agregá ítems al presupuesto.</p>` : `<div class="mat-grid">` +
      mats.map(m => {
        const isCem = m.name.toLowerCase().includes("cemento");
        const bolsas = isCem ? Math.ceil(m.qty / 50) : null;
        const qty = Number.isInteger(m.qty) ? m.qty : fmtD(m.qty, 2);
        return `<div class="mat-card"><div class="mat-name">${m.name}</div><div class="mat-qty"><strong>${qty}</strong> ${m.unit}</div>${bolsas ? `<div class="mat-bags">≈ ${bolsas} bolsa${bolsas !== 1 ? "s" : ""} de 50kg</div>` : ""}</div>`;
      }).join("") + `</div>`;
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:740px">
      <div class="modal-title">🧱 Cómputo de Materiales<button class="delbtn" onclick="closeModal()">✕</button></div>
      <p class="mat-note">Cantidades totales agrupadas por material. Uso interno — no aparece en el PDF del cliente.</p>
      ${cards}
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cerrar</button></div>
    </div></div>`;
  }

  else if (type === "breakdown") {
    const bkAdenda = getActiveAdenda();
    const bkIva = bkAdenda && bkAdenda.ivaEnabled;
    const bkProfit = bkAdenda ? (bkAdenda.profitPct || 0) : 0;
    const bk = getBreakdown(); const { totalMats, totalLabor, subtotal, ivaMat, ivaLab, ivaTotal, profitAmt, total } = getTotals();
    const rows = bk.map(r => `<tr class="bk-row"><td>${r.cat}</td><td style="color:var(--mat);font-weight:600">₲ ${fmt(r.matCost)}</td><td style="color:var(--lab);font-weight:600">₲ ${fmt(r.laborCost)}</td><td class="bk-subtotal">₲ ${fmt(r.total)}</td></tr>`).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
      <div class="modal-title">📊 Desglose Mat / MO<button class="delbtn" onclick="closeModal()">✕</button></div>
      <table class="bk-tbl"><thead><tr><th>Categoría</th><th>Materiales</th><th>Mano de Obra</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="bk-footer">
        <div class="tot-row"><span class="tot-lbl" style="color:var(--mat);font-weight:600">Total Materiales</span><span class="tot-val tot-mat">₲ ${fmt(totalMats)}</span></div>
        <div class="tot-row"><span class="tot-lbl" style="color:var(--lab);font-weight:600">Total Mano de Obra</span><span class="tot-val tot-lab">₲ ${fmt(totalLabor)}</span></div>
        <div class="tot-row" style="padding-top:6px;margin-top:4px;border-top:1px solid var(--bor)"><span class="tot-lbl">Costo directo</span><span class="tot-val">₲ ${fmt(subtotal)}</span></div>
        ${bkIva ? `<div class="tot-row"><span class="tot-lbl" style="color:var(--iva)">IVA mat (10%) + MO (5%)</span><span class="tot-val tot-iva">₲ ${fmt(ivaTotal)}</span></div>` : ""}
        ${bkProfit > 0 ? `<div class="tot-row"><span class="tot-lbl" style="color:var(--ok)">Honorarios (${bkProfit}%)</span><span class="tot-val" style="color:var(--ok)">₲ ${fmt(profitAmt)}</span></div>` : ""}
        <div class="tot-row tot-main"><span class="tot-lbl">TOTAL${bkIva ? " (IVA inc.)" : ""}</span><span class="tot-val">₲ ${fmt(total)}</span></div>
        ${subtotal > 0 ? `<div style="display:flex;gap:14px;padding-top:7px;border-top:1px solid var(--bor);margin-top:7px">
          <span style="font-size:.95rem;color:var(--tx3)">Mat: <strong style="color:var(--mat)">${Math.round(totalMats / subtotal * 100)}%</strong></span>
          <span style="font-size:.95rem;color:var(--tx3)">MO: <strong style="color:var(--lab)">${Math.round(totalLabor / subtotal * 100)}%</strong></span>
          ${bkIva && total > 0 ? `<span style="font-size:.95rem;color:var(--tx3)">IVA: <strong style="color:var(--iva)">${Math.round(ivaTotal / total * 100)}%</strong></span>` : ""}
        </div>` : ""}
      </div>
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cerrar</button></div>
    </div></div>`;
  }

  else if (type === "save") {
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
      <div class="modal-title">Guardar Presupuesto</div>
      <p style="font-size:1rem;color:var(--tx2);margin-bottom:12px"><strong>${p.name}</strong><br>Adenda: <strong>${adenda.name}</strong> — ${adenda.items.length} ítems — Total: <strong style="color:var(--acc)">${fmt(getTotals().total)}</strong></p>
      <div class="modal-acts"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="doSave()">Guardar</button></div>
    </div></div>`;
  }

  else if (type === "load") {
    const p = getActiveProject();
    const versions = (p && p.versions) || [];
    const rows = versions.length === 0
      ? `<p style="font-size:1rem;color:var(--tx3)">No hay versiones guardadas. Usá "Guardar" arriba para crear una.</p>`
      : versions.map(v => `<div class="modal-row"><div style="flex:1"><div class="modal-name">${v.name}</div><div class="modal-meta">${formatDatePY(v.date)} · ${v.items?.length || 0} ítems</div></div><button class="btn sm" onclick="loadVersion('${v.id}')">📂 Cargar</button><button class="btn sm danger" onclick="deleteVersion('${v.id}');showModal('load')">✕</button></div>`).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
      <div class="modal-title">Historial de Versiones<button class="delbtn" onclick="closeModal()">✕</button></div>
      ${rows}<div class="modal-acts"><button class="btn" onclick="closeModal()">Cerrar</button></div>
    </div></div>`;
  }

  else if (type === "signature") {
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:420px">
      <div class="modal-title">Firma Digital<button class="delbtn" onclick="closeModal()">✕</button></div>
      <p style="font-size:.875rem;color:var(--tx3);margin-bottom:10px">Dibujá tu firma. Aparecerá en el PDF al pie del presupuesto.</p>
      <canvas id="sign-canvas" class="sign-canvas" width="500" height="120"></canvas>
      <div class="sign-actions">
        <button class="btn sm danger" onclick="clearSignature()">Borrar</button>
        <button class="btn sm primary" onclick="saveSignature()">Guardar firma</button>
      </div>
      ${state.signDataUrl ? `<div style="margin-top:10px"><div style="font-size:.875rem;color:var(--tx3);margin-bottom:4px">Firma guardada:</div><img src="${state.signDataUrl}" style="border:1px solid var(--bor);border-radius:var(--rad);background:#fff;padding:4px;max-width:100%;height:50px;object-fit:contain"></div>` : ''}
    </div></div>`;
    initSignatureCanvas();
  }

  else if (type === "profile") {
    const p = state.profile;
    const pdfThemes = [
      { id: "corporate", name: "Corporativo", desc: "Azul profesional", bg: "#1e3a5f", sur: "#ffffff", acc: "#1e40af", row: "#eef2ff" },
      { id: "construction", name: "Construcción", desc: "Tierra y naranja", bg: "#7c2d12", sur: "#fffbf5", acc: "#c2410c", row: "#fef3e8" },
      { id: "minimal", name: "Minimalista", desc: "Blanco y negro", bg: "#111111", sur: "#ffffff", acc: "#111111", row: "#f5f5f5" },
      { id: "emerald", name: "Esmeralda", desc: "Verde ejecutivo", bg: "#064e3b", sur: "#f0fdf4", acc: "#059669", row: "#ecfdf5" },
      { id: "bordeaux", name: "Burdeos", desc: "Vino elegante", bg: "#4c0519", sur: "#fff1f2", acc: "#9f1239", row: "#ffe4e6" },
      { id: "slate", name: "Pizarra", desc: "Gris moderno", bg: "#1e293b", sur: "#f8fafc", acc: "#475569", row: "#f1f5f9" },
    ];
    const pdfCards = pdfThemes.map(t => {
      const isA = state.pdfTheme === t.id;
      return `<div class="pdf-theme-card${isA ? " active" : ""}" onclick="state.pdfTheme='${t.id}';save();this.closest('.modal').querySelectorAll('.pdf-theme-card').forEach(c=>c.classList.remove('active'));this.classList.add('active')" style="background:${t.sur};border-color:${isA ? "var(--acc)" : "var(--bor)"}">
        <div class="pdf-preview" style="background:${t.bg}">
          <div class="pdf-preview-hdr" style="background:${t.sur}20"></div>
          <div class="pdf-preview-row" style="background:${t.sur}40"></div>
          <div class="pdf-preview-row short" style="background:${t.sur}30"></div>
          <div class="pdf-preview-accent" style="background:${t.acc}"></div>
        </div>
        <div class="pdf-theme-lbl" style="background:${t.sur};color:${t.acc}">
          <div><div style="font-weight:700">${t.name}</div><div style="font-size:1rem;opacity:.7">${t.desc}</div></div>
          <div style="width:13px;height:13px;border-radius:50%;border:2px solid ${t.acc};background:${isA ? t.acc : "transparent"};display:flex;align-items:center;justify-content:center;font-size:.875rem;color:#fff">${isA ? "✓" : ""}</div>
        </div>
      </div>`;
    }).join("");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px">
      <div class="modal-title">Perfil del Profesional<button class="delbtn" onclick="closeModal()">✕</button></div>
      <div class="two-col">
        <div><div class="slbl">Empresa / Estudio</div><input id="p-company" value="${(p.company || "").replace(/"/g, '&quot;')}" placeholder="Nombre empresa" class="mb7"></div>
        <div><div class="slbl">Profesional</div><input id="p-prof" value="${(p.professional || "").replace(/"/g, '&quot;')}" placeholder="Arq. / Ing. Nombre Apellido" class="mb7"></div>
      </div>
      <div class="two-col">
        <div><div class="slbl">Matrícula</div><input id="p-mat" value="${(p.matricula || "").replace(/"/g, '&quot;')}" placeholder="CAP Nº 0000" class="mb7"></div>
        <div><div class="slbl">RUC</div><input id="p-ruc" value="${(p.ruc || "").replace(/"/g, '&quot;')}" placeholder="00000000-0" class="mb7"></div>
      </div>
      <div class="two-col">
        <div style="display:flex;gap:4px"><input id="p-phone" value="${(p.phone || "").replace(/"/g, '&quot;')}" placeholder="Teléfono" class="mb7" style="flex:1">${p.phone ? `<button class="btn sm" onclick="window.open(waLink('${p.phone.replace(/'/g, "\\'")}'), '_blank')" style="padding:0 8px;background:#25D366;color:white;border:none;margin-bottom:7px" title="WhatsApp">💬</button>` : ''}</div>
        <input id="p-email" value="${(p.email || "").replace(/"/g, '&quot;')}" placeholder="Email" class="mb7">
      </div>
      <input id="p-address" value="${(p.address || "").replace(/"/g, '&quot;')}" placeholder="Dirección del estudio" class="mb7">
      <div class="slbl">Redes Sociales</div>
      <div class="two-col">
        <input id="p-ig" value="${(p.instagram || "").replace(/"/g, '&quot;')}" placeholder="Instagram: @usuario" class="mb7">
        <div style="display:flex;gap:4px"><input id="p-wa" value="${(p.whatsapp || "").replace(/"/g, '&quot;')}" placeholder="WhatsApp: +595 9XX XXXXXX" class="mb7" style="flex:1">${p.whatsapp ? `<button class="btn sm" onclick="window.open(waLink('${p.whatsapp.replace(/'/g, "\\'")}'), '_blank')" style="padding:0 8px;background:#25D366;color:white;border:none;margin-bottom:7px" title="Probar link">💬</button>` : ''}</div>
      </div>
      <input id="p-web" value="${(p.website || "").replace(/"/g, '&quot;')}" placeholder="Sitio web: www.tuestudio.com.py" class="mb7">
      <div class="slbl">Logo del Estudio (aparece en el PDF)</div>
      <div class="logo-upload-area" onclick="document.getElementById('logo-file-input').click()">
        ${state.logoDataUrl ? `<img src="${state.logoDataUrl}" class="logo-preview" alt="Logo">` : '<div class="logo-placeholder">📷 Hacé clic para subir tu logo<br><span style="font-size:.75rem">PNG, JPG — recomendado 300x100px</span></div>'}
      </div>
      <input type="file" id="logo-file-input" accept="image/*" style="display:none" onchange="uploadLogo(this)">
      ${state.logoDataUrl ? `<button class="btn sm danger" onclick="state.logoDataUrl='';save();showModal('profile')" style="margin-bottom:12px">✕ Quitar logo</button>` : ''}
      <div class="slbl">Tema del PDF</div>
      <div class="pdf-theme-grid">${pdfCards}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--bor)">
        <button class="btn sm" onclick="showModal('signature')">✍️ Firma digital</button>
      </div>
      <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="doSaveProfile()">Guardar Perfil</button>
      </div>
    </div></div>`;
  }

  // Activar gestos de swipe-to-close en mobile (después de render)
  setTimeout(attachModalSwipeGestures, 0);
  // Bloquear scroll del body cuando hay modal
  document.body.style.overflow = 'hidden';
}

function closeModal() { document.getElementById("modal-area").innerHTML = ""; document.body.style.overflow = ''; }

// ── Gesture: deslizar modal hacia abajo para cerrar (mobile) ───────────────
let _modalDragStart = 0;
let _modalDragCurrent = 0;
let _modalElement = null;
function attachModalSwipeGestures() {
  const modal = document.querySelector('#modal-area .modal');
  if (!modal || window.innerWidth > 768) return;

  modal.addEventListener('touchstart', e => {
    // Solo iniciar swipe si toca el área superior (los primeros 60px = la "agarradera")
    const rect = modal.getBoundingClientRect();
    const y = e.touches[0].clientY;
    if (y - rect.top > 60) return;
    _modalDragStart = y;
    _modalDragCurrent = y;
    _modalElement = modal;
    modal.style.transition = 'none';
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    if (!_modalElement) return;
    _modalDragCurrent = e.touches[0].clientY;
    const delta = _modalDragCurrent - _modalDragStart;
    if (delta > 0) {
      _modalElement.style.transform = `translateY(${delta}px)`;
    }
  }, { passive: true });

  modal.addEventListener('touchend', () => {
    if (!_modalElement) return;
    const delta = _modalDragCurrent - _modalDragStart;
    _modalElement.style.transition = 'transform 0.25s ease';
    if (delta > 100) {
      // Cerrar
      _modalElement.style.transform = 'translateY(100%)';
      setTimeout(closeModal, 220);
    } else {
      _modalElement.style.transform = '';
    }
    _modalElement = null;
    _modalDragStart = 0;
    _modalDragCurrent = 0;
  });
}
function exportDB() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "puntero_db.json"; a.click(); URL.revokeObjectURL(url);
  toast("DB exportada ✓");
}

function exportProject() {
  const proj = getActiveProject();
  if (!proj) return toast("Sin proyecto activo", false);

  // Solo incluir contratistas asignados a este proyecto
  const assignedConIds = new Set(
    Object.values(proj.execution.schedules || {})
      .map(s => s && s.contractorId)
      .filter(Boolean)
  );
  const contractors = (state.contractors || []).filter(c => assignedConIds.has(c.id));

  const project = {
    project: proj,                  // estructura completa del proyecto (budgets, execution, etc.)
    contractors,
    profile: state.profile,
    exportDate: new Date().toISOString(),
    app: "Puntero",
    version: "7.0"
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Proyecto_${(proj.name || "proyecto").replace(/\s+/g, '_')}.ppy`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Proyecto exportado (.ppy) ✓");
  closeModal();
}

function importProject() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".ppy,.json";
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const validApps = ["Puntero", "PresupuestadorPY"]; // retrocompatibilidad con .ppy viejos
        if (!validApps.includes(data.app) && !confirm("El archivo no parece ser un proyecto oficial. ¿Intentar importar de todos modos?")) return;

        // Soporte para formato nuevo (v7) y legacy (v5)
        let newProject;
        if (data.project && data.project.budgets) {
          // Formato v7
          newProject = JSON.parse(JSON.stringify(data.project));
          newProject.id = 'p_' + Date.now(); // evitar colisión
          newProject.name = newProject.name + ' (importado)';
        } else {
          // Formato legacy v5: convertir items planos en proyecto
          newProject = {
            id: 'p_' + Date.now(),
            name: (data.projectName || "Proyecto Importado") + ' (importado)',
            client: data.clientName || "",
            phone: data.clientPhone || "",
            address: data.clientAddress || "",
            date: formatDatePY(new Date()),
            status: 'active',
            activeAdendaId: 'main',
            budgets: [{
              id: 'main',
              name: 'Presupuesto Principal',
              items: data.items || [],
              profitPct: data.profitPct || 0,
              ivaEnabled: !!data.ivaEnabled,
              notes: data.notes || ""
            }],
            execution: {
              schedules: data.schedules || {},
              dailyLogs: [],
              materialOrders: [],
              finances: { income: [], expenses: [] },
              documents: [],
              aftercare: [],
              projectStartDate: "",
              projectEndDate: ""
            }
          };
        }

        state.projects.push(newProject);
        state.activeProjectId = newProject.id;
        state.activeAdendaId = newProject.budgets[0].id;

        // Combinar contratistas sin duplicar
        if (data.contractors && Array.isArray(data.contractors)) {
          data.contractors.forEach(c => {
            if (!state.contractors.find(ex => ex.id === c.id)) state.contractors.push(c);
          });
        }

        save();
        closeModal();
        setSection('budget');
        toast("Proyecto importado con éxito ✓");
      } catch (err) {
        toast("Error al importar proyecto: " + err.message, false);
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function importDB() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json";
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (typeof d !== "object" || !Object.values(d)[0]) throw new Error("Formato inválido");
        DB = d; save(); renderPrices && renderPrices(); closeModal(); toast("DB importada ✓");
      } catch (err) { toast("Error al importar: " + err.message, false); }
    };
    reader.readAsText(file);
  };
  inp.click();
}
// Legacy functions — removed, functionality replaced by saveVersion/loadVersion
function doSaveProfile() {
  state.profile = { company: document.getElementById("p-company").value, professional: document.getElementById("p-prof").value, matricula: document.getElementById("p-mat").value, ruc: document.getElementById("p-ruc").value, phone: document.getElementById("p-phone").value, email: document.getElementById("p-email").value, address: document.getElementById("p-address").value, instagram: document.getElementById("p-ig").value, whatsapp: document.getElementById("p-wa").value, website: document.getElementById("p-web").value };
  save(); closeModal(); toast("Perfil guardado ✓");
}

// ── Update DB badge ──
function updateBadge() {
  const el = document.getElementById("db-badge-hdr");
  if (el) el.textContent = "Precios base mercado PY" + (state.adjustPct ? ` +${state.adjustPct}%` : "");
}

// ── GLOBAL STATS (FORMERLY DASHBOARD) ─────────────────────────────────────────
function renderGlobalStats() {
  const el = document.getElementById("section-dashboard");
  if (!el) return;

  const projects = state.projects || [];
  const activeProjects = projects.filter(p => p.status === 'active');
  const totalVal = projects.reduce((s, p) => {
    const mainAdenda = p.budgets.find(b => b.id === (p.activeAdendaId || 'main')) || p.budgets[0];
    const sub = mainAdenda ? mainAdenda.items.reduce((ss, i) => ss + (i.unitPrice || 0) * i.qty, 0) : 0;
    return s + sub;
  }, 0);
  const avg = projects.length ? totalVal / projects.length : 0;
  
  const thisMonth = projects.filter(p => {
    try { 
        const d = p.date ? new Date(p.date.split('/').reverse().join('-')) : null;
        return d && d.getMonth() === new Date().getMonth(); 
    } catch (e) { return false; }
  }).length;

  const rubros = {};
  for (const p of projects) {
    const mainAdenda = p.budgets.find(b => b.id === (p.activeAdendaId || 'main')) || p.budgets[0];
    if (mainAdenda) for (const i of mainAdenda.items) { rubros[i.cat] = (rubros[i.cat] || 0) + 1; }
  }
  const topRubros = Object.entries(rubros).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const today = new Date();
  
  const alertList = projects.flatMap(p => p.budgets.map(b => ({...b, projectName: p.name, clientName: p.client})));
  const alerts = alertList.map(b => {
    try {
      const emision = b.date ? new Date(b.date.split('/').reverse().join('-')) : today;
      const vence = new Date(emision.getTime() + (b.validDays || 30) * 86400000);
      const diff = Math.ceil((vence - today) / 86400000);
      return { ...b, diff, vence };
    } catch (e) { return { ...b, diff: 999 }; }
  }).filter(b => b.diff < 15).sort((a, b) => a.diff - b.diff);

  let alertHtml = alerts.length === 0
    ? `<p style="font-size:.875rem;color:var(--tx3)">Sin alertas próximas.</p>`
    : alerts.map(b => `<div class="alert-row ${b.diff <= 3 ? "warn" : "ok"}">
        <div class="alert-dot ${b.diff <= 3 ? "warn" : "ok"}"></div>
        <div class="alert-txt"><strong>${b.projectName}</strong> (${b.name})</div>
        <div class="alert-date">${b.diff <= 0 ? "VENCIDO" : b.diff + " días"}</div>
      </div>`).join("");

  let projectsHtml = activeProjects.length === 0
    ? `<div class="empty" style="padding:24px"><p>No hay proyectos activos.</p><button class="btn sm primary" onclick="showModal('new_project')">+ Nuevo Proyecto</button></div>`
    : activeProjects.map(p => {
        const adenda = p.budgets.find(b => b.id === (p.activeAdendaId || 'main')) || p.budgets[0];
        const total = adenda ? adenda.items.reduce((s, i) => s + (i.unitPrice || 0) * i.qty, 0) : 0;
        return `<div class="modal-row" style="background:var(--sur); border:1px solid var(--bor); margin-bottom:10px; padding:15px; cursor:pointer" onclick="state.activeProjectId='${p.id}'; state.activeAdendaId='${p.activeAdendaId}'; save(); setSection('budget');">
            <div style="flex:1">
                <div style="font-weight:700; font-size:1.05rem; color:var(--acc)">${p.name}</div>
                <div style="font-size:0.85rem; color:var(--tx3); margin-top:4px">👤 ${p.client || 'Sin cliente'} · 📍 ${p.address || 'Sin dirección'}</div>
                <div style="display:flex; gap:12px; margin-top:8px">
                    <span class="ichip mat" style="font-size:0.75rem">📦 ${adenda ? adenda.items.length : 0} items</span>
                    <span class="ichip lab" style="font-size:0.75rem">₲ ${fmt(total)}</span>
                </div>
            </div>
            <button class="btn sm primary">Abrir 📂</button>
        </div>`;
    }).join("");

  let histHtml = state.priceHistory.map(p => {
    const change = Math.round((p.mar26 - p.aug25) / p.aug25 * 100);
    const dir = change > 0 ? "up" : change < 0 ? "dn" : "";
    const bar = Math.min(100, Math.abs(change) * 10 + 20);
    return `<div class="hist-row">
      <div class="hist-name">${p.name}</div>
      <div style="font-size:.95rem;color:var(--tx3);width:80px">₲${new Intl.NumberFormat("es-PY").format(p.aug25)}</div>
      <div class="hist-bar-wrap"><div class="hist-bar" style="width:${bar}%"></div></div>
      <div style="font-size:.95rem;color:var(--tx3);width:80px">₲${new Intl.NumberFormat("es-PY").format(p.mar26)}</div>
      <div class="hist-pct ${dir}">${change > 0 ? "+" : ""}${change}%</div>
    </div>`;
  }).join("");

  const TEMPLATES = [
    {
      icon: "🏠", name: "Casa económica 60m²", desc: "Fundaciones, mampostería 0.15m, techo teja española, revoque, piso calcáreo, pintura cal.", meta: "~₲ 126.000.000", items: [
        ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 13.5], ["MAMPOSTERÍA", "Elevación 0.15m ladrillo común", 120],
        ["MAMPOSTERÍA", "Nivelación 0.30m ladrillo común", 12.5], ["AISLACIÓN", "Horizontal 0.15m con asfalto", 43],
        ["TECHOS", "Teja española s/ tejuelón c/ madera", 94], ["CONTRAPISOS", "Contrapiso 10cm cascotes", 65],
        ["REVOQUES", "Revoque 1 capa sin hidrófugo", 226], ["PISOS", "Baldosa calcárea 20x20cm", 61.5],
        ["PINTURAS", "Pintura a la cal", 226], ["DESAGÜE CLOACAL", "Pozo ciego Ø1.50m h=3.00m", 1],
      ]
    },
    {
      icon: "🏢", name: "Dúplex 120m²", desc: "H°A° losa, mampostería cerámica, teja francesa, revoque hidrófugo, porcelanato, látex.", meta: "~₲ 280.000.000", items: [
        ["ESTRUCTURAS", "Zapata fck=18 MPa", 1], ["ESTRUCTURAS", "Columna fck=21 MPa", 0.5],
        ["ESTRUCTURAS", "Losa Rap h=17cm (12+5)", 35], ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 17.6],
        ["MAMPOSTERÍA", "Elevación 0.15m ladrillo cerámico 6 tubos", 240], ["TECHOS", "Teja francesa s/ machimbre", 93],
        ["CONTRAPISOS", "Contrapiso 10cm cascotes", 101], ["REVOQUES", "Revoque 1 capa hidrófugo 1.5cm", 381],
        ["PISOS", "Porcelanato 60x60cm", 19], ["PISOS", "Cerámica esmaltada Cecafi 32x57cm", 62],
        ["PINTURAS", "Látex interior con enduido", 381],
      ]
    },
    {
      icon: "🏪", name: "Local comercial 100m²", desc: "Estructura H°A°, losa, mampostería hueca, chapa termoacústica, piso hormigón pulido.", meta: "~₲ 220.000.000", items: [
        ["ESTRUCTURAS", "Zapata fck=18 MPa", 1.5], ["ESTRUCTURAS", "Columna fck=21 MPa", 0.8],
        ["ESTRUCTURAS", "Losa fck=21MPa", 12.4], ["FUNDACIONES", "Cimiento PBC sin cal (1:12)", 21.8],
        ["MAMPOSTERÍA", "Elevación 0.20m ladrillo cerámico hueco", 200], ["TECHOS", "Techo metálico chapa trapezoidal", 120],
        ["CONTRAPISOS", "Contrapiso 10cm cascotes", 107], ["REVOQUES", "Revoque 1 capa hidrófugo 1.5cm", 480],
        ["PISOS", "Mosaico granítico gris 30x30cm", 42], ["PINTURAS", "Látex exterior con enduido", 480],
      ]
    },
    {
      icon: "🏗️", name: "Ampliación 30m²", desc: "Cimiento, mampostería, techo chapa, revoque, piso calcáreo. Sin instalaciones.", meta: "~₲ 45.000.000", items: [
        ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 4], ["MAMPOSTERÍA", "Elevación 0.15m ladrillo común", 55],
        ["TECHOS", "Chapa Nº28 s/ caños metálicos", 35], ["CONTRAPISOS", "Contrapiso 7cm cascotes", 30],
        ["REVOQUES", "Revoque 1 capa sin hidrófugo", 110], ["PISOS", "Baldosa calcárea 20x20cm", 30],
        ["PINTURAS", "Pintura a la cal", 110],
      ]
    },
  ];
  const tmplCards = TEMPLATES.map((t, idx) => `<div class="tmpl-card" onclick="applyTemplate(${idx})">
    <div class="tmpl-icon">${t.icon}</div>
    <div class="tmpl-name">${t.name}</div>
    <div class="tmpl-desc">${t.desc}</div>
    <div class="tmpl-meta">${t.meta}</div>
  </div>`).join("");
  window._TEMPLATES = TEMPLATES;

  el.innerHTML = `<div class="prices-wrap">
    <div style="margin-bottom:24px">
        <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:6px">PANEL GENERAL</h2>
        <p style="color:var(--tx3)">Resumen de actividad y proyectos activos.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:24px">
      <div class="dash-card"><div class="dash-num">${projects.length}</div><div class="dash-lbl">Proyectos</div><div class="dash-sub">Total registrados</div></div>
      <div class="dash-card"><div class="dash-num" style="font-size:1.1rem">₲ ${new Intl.NumberFormat("es-PY").format(Math.round(totalVal / 1000000))}M</div><div class="dash-lbl">Valor Cartera</div><div class="dash-sub">Total presupuestado</div></div>
      <div class="dash-card"><div class="dash-num" style="font-size:1.1rem">₲ ${new Intl.NumberFormat("es-PY").format(Math.round(avg / 1000000))}M</div><div class="dash-lbl">Promedio</div><div class="dash-sub">Por proyecto</div></div>
      <div class="dash-card"><div class="dash-num">${activeProjects.length}</div><div class="dash-lbl">Activos</div><div class="dash-sub">En ejecución</div></div>
    </div>

    <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:20px; align-items:start">
        <div class="card" style="padding:0; overflow:hidden">
            <div style="padding:15px; border-bottom:1px solid var(--bor); background:var(--sur2); display:flex; justify-content:space-between; align-items:center">
                <h3 style="font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em">🚀 Proyectos Activos</h3>
                <button class="btn sm primary" onclick="showModal('new_project')">+ Nuevo</button>
            </div>
            <div style="padding:15px; max-height:500px; overflow-y:auto">
                ${projectsHtml}
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:20px">
            <div class="card">
                <div class="sec-lbl">Alertas de Vencimiento</div>
                ${alertHtml}
            </div>
            <div class="card">
                <div class="sec-lbl" style="margin-bottom:8px">Rubros Frecuentes</div>
                ${topRubros.length ? topRubros.map(([r, n]) => `<div class="hist-row"><div class="hist-name">${r}</div><div class="hist-bar-wrap"><div class="hist-bar" style="width:${Math.min(100, n * 20)}%"></div></div><div class="hist-pct" style="color:var(--tx2)">${n}x</div></div>`).join("") : `<p style="font-size:.875rem;color:var(--tx3)">Sin datos aún.</p>`}
            </div>
        </div>
    </div>

    <div class="card" style="margin-top:24px; margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="sec-lbl">Historial Comparativo de Precios Mercado PY</div>
        <span style="font-size:0.85rem;color:var(--tx3)">Ago-2025 → Actualidad</span>
      </div>
      ${histHtml}
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="sec-lbl">Plantillas de Obra</div>
        <span style="font-size:.95rem;color:var(--tx3)">Hacé clic para cargar en el presupuesto</span>
      </div>
      <div class="tmpl-grid">${tmplCards}</div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="sec-lbl" style="margin-bottom:8px">Gestión de Base de Datos</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="exportDB()">📥 Exportar DB (JSON)</button>
        <button class="btn" onclick="importDB()">📤 Importar DB</button>
        <span style="font-size:.95rem;color:var(--tx3);align-self:center">Guardá tu base de precios personalizada para restaurarla cuando quieras.</span>
      </div>
    </div>
  </div>`;
}

function applyTemplate(idx) {
  const adenda = getActiveAdenda();
  const proj = getActiveProject();
  if (!adenda || !proj) return toast("Sin proyecto activo", false);

  const t = window._TEMPLATES[idx];
  if (!confirm('¿Cargar plantilla "' + t.name + '" al presupuesto actual? Se agregarán los ítems.')) return;
  let added = 0;
  for (const [cat, name, qty] of t.items) {
    if (DB[cat] && DB[cat][name]) {
      const data = DB[cat][name];
      adenda.items.push({ cat, name, unit: data.unit, unitPrice: data.total, matCost: data.matCost, laborCost: data.laborCost, mats: data.mats || [], qty, id: Date.now() + Math.random() + added, disc: 0, note: "" });
      added++;
    }
  }
  proj.m2Area = t.name.includes("60m²") ? 60 : t.name.includes("120m²") ? 120 : t.name.includes("100m²") ? 100 : 30;
  setSection("budget"); save(); renderBudget();
  toast('Plantilla "' + t.name + '" cargada — ' + added + ' ítems ✓');
}

// ── MOBILE FAB ──────────────────────────────────────────────────────────────────────────
let _fabOpen = false;
function toggleFab() {
  _fabOpen = !_fabOpen;
  document.getElementById("fab-items").className = "mobile-fab-items" + (_fabOpen ? "" : " closed");
  document.getElementById("fab-btn").textContent = _fabOpen ? "✕" : "⚡";
}
function closeFab() { _fabOpen = false; document.getElementById("fab-items").className = "mobile-fab-items closed"; document.getElementById("fab-btn").textContent = "⚡"; }

// ── MOBILE DRAWER (sidebar como cajón deslizable) ─────────────────────────
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('drawer-overlay');
  if (!sb || !ov) return;
  const isOpen = sb.classList.contains('open');
  if (isOpen) {
    sb.classList.remove('open');
    ov.classList.remove('show');
    document.body.style.overflow = '';
  } else {
    sb.classList.add('open');
    ov.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}
function closeSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('drawer-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
}

// ── LOGO UPLOAD ───────────────────────────────────────────────────────────────────────
function uploadLogo(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 500000) { toast("Logo muy grande. Maximo 500KB", false); return; }
  const reader = new FileReader();
  reader.onload = e => {
    state.logoDataUrl = e.target.result;
    save(); showModal("profile");
    toast("Logo guardado ✓");
  };
  reader.readAsDataURL(file);
}

// ── FIRMA DIGITAL ───────────────────────────────────────────────────────────────────────
let _signDraw = false, _signCtx = null, _signCanvas = null;
function initSignatureCanvas() {
  _signCanvas = document.getElementById("sign-canvas");
  if (!_signCanvas) return;
  _signCtx = _signCanvas.getContext("2d");
  _signCtx.strokeStyle = "#1a1a1a"; _signCtx.lineWidth = 2; _signCtx.lineCap = "round"; _signCtx.lineJoin = "round";
  const rect = _signCanvas.getBoundingClientRect();
  _signCanvas.width = rect.width * window.devicePixelRatio || 500;
  _signCanvas.height = 120 * window.devicePixelRatio || 120;
  _signCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  _signCtx.strokeStyle = "#1a1a1a"; _signCtx.lineWidth = 2; _signCtx.lineCap = "round";
  _signCanvas.addEventListener("mousedown", e => { _signDraw = true; _signCtx.beginPath(); const r = _signCanvas.getBoundingClientRect(); _signCtx.moveTo(e.clientX - r.left, e.clientY - r.top); });
  _signCanvas.addEventListener("mousemove", e => { if (!_signDraw) return; const r = _signCanvas.getBoundingClientRect(); _signCtx.lineTo(e.clientX - r.left, e.clientY - r.top); _signCtx.stroke(); });
  _signCanvas.addEventListener("mouseup", () => _signDraw = false);
  _signCanvas.addEventListener("mouseleave", () => _signDraw = false);
  _signCanvas.addEventListener("touchstart", e => { e.preventDefault(); _signDraw = true; _signCtx.beginPath(); const r = _signCanvas.getBoundingClientRect(); const t = e.touches[0]; _signCtx.moveTo(t.clientX - r.left, t.clientY - r.top); }, { passive: false });
  _signCanvas.addEventListener("touchmove", e => { e.preventDefault(); if (!_signDraw) return; const r = _signCanvas.getBoundingClientRect(); const t = e.touches[0]; _signCtx.lineTo(t.clientX - r.left, t.clientY - r.top); _signCtx.stroke(); }, { passive: false });
  _signCanvas.addEventListener("touchend", () => _signDraw = false);
}
function clearSignature() { if (_signCtx && _signCanvas) { _signCtx.clearRect(0, 0, _signCanvas.width, _signCanvas.height); } }
function saveSignature() {
  if (!_signCanvas) return;
  state.signDataUrl = _signCanvas.toDataURL("image/png");
  save(); closeModal(); toast("Firma guardada ✓");
}

// ── INIT ──────────────────────────────────────────────────────────────
function loadDemoProject() {
  // Crear directamente en el modelo nuevo (multi-proyecto)
  const demoProj = {
    id: 'p_demo_' + Date.now(),
    name: "Residencia Demo - San Bernardino",
    client: "Juan Pérez",
    phone: "0981 555 000",
    address: "San Bernardino, Cordillera",
    m2Area: 120,
    date: formatDatePY(new Date()),
    status: 'active',
    activeAdendaId: 'main',
    budgets: [{
      id: 'main',
      name: 'Presupuesto Principal',
      profitPct: 0,
      ivaEnabled: false,
      notes: "",
      items: [
        { id: 101, cat: "ESTRUCTURAS", name: "Zapata fck=18 MPa", unit: "m3", qty: 4, unitPrice: 2554380, matCost: 1851000, laborCost: 703380, mats: [], disc: 0, note: "" },
        { id: 102, cat: "MAMPOSTERÍA", name: "Elevación 0.15m ladrillo común", unit: "m2", qty: 120, unitPrice: 125000, matCost: 91838, laborCost: 33162, mats: [], disc: 0, note: "" }
      ]
    }],
    execution: {
      schedules: {
        "101": { status: "done", start: "2026-04-01", end: "2026-04-10", contractorId: "con_demo_1" },
        "102": { status: "progress", start: "2026-04-12", end: "2026-04-30", contractorId: "con_demo_1" }
      },
      dailyLogs: [],
      materialOrders: [],
      finances: { income: [], expenses: [] },
      documents: [],
      aftercare: [],
      projectStartDate: "2026-04-01",
      projectEndDate: ""
    }
  };

  state.projects = [demoProj];
  state.activeProjectId = demoProj.id;
  state.activeAdendaId = 'main';
  state.migratedV6 = true; // ya está en formato nuevo

  state.contractors = [
    { id: "con_demo_1", name: "Maestro Pintos", phone: "0981 000 111", specialty: "Albañilería y Estructura", email: "pintos_obras@gmail.com", notes: "Excelente para cimientos y mampostería. Muy puntual.", payments: [{amount: 2000000, date: "2026-04-20", note: "Anticipo inicio obra"}], staff: [] },
    { id: "con_demo_2", name: "Juan 'Chapuza' González", phone: "0971 222 333", specialty: "Instalaciones", isBlacklisted: true, notes: "No contratar. Malas terminaciones y deja la obra a medias.", payments: [], staff: [] }
  ];
}

function renderCurrencyArea() {
    const el = document.getElementById("currency-area");
    if (!el) return;
    el.innerHTML = `
        <select id="global-currency" style="width:100px; font-weight:700; background:var(--sur); border:1px solid var(--bor); border-radius:var(--rad); padding:4px" onchange="state.currency=this.value; save(); location.reload()">
            <option value="PYG" ${state.currency === 'PYG' ? 'selected' : ''}>₲ PYG</option>
            <option value="USD" ${state.currency === 'USD' ? 'selected' : ''}>$ USD</option>
        </select>
        ${state.currency === 'USD' ? `<input id="global-exrate" type="number" value="${state.exchangeRate}" style="width:80px; padding:4px; border-radius:var(--rad); border:1px solid var(--bor)" title="Cotización 1 USD" onblur="state.exchangeRate=parseFloat(this.value)||7500; save(); location.reload()">` : ''}
    `;
}

// ── FIREBASE AUTH ──────────────────────────────────────────────────────────
window._currentUser = null;

function initFirebaseAuth() {
  window._AUTH.onAuthStateChanged(function (user) {
    window._currentUser = user;
    var btn = document.getElementById("auth-btn");
    if (btn) {
      btn.textContent = user ? "👤 " + user.email : "🔐 Iniciar Sesión";
    }
    if (user) loadFromFirestore();
  });
}

async function loadFromFirestore() {
  if (!window._currentUser) return;
  try {
    var doc = await window._FIRESTORE.collection("users").doc(window._currentUser.uid).get();
    if (!doc.exists || !doc.data().appState) {
      if (state.projects && state.projects.length > 0) {
        await window._FIRESTORE.collection("users").doc(window._currentUser.uid).set({
          appState: JSON.parse(JSON.stringify(state)),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        toast("Datos locales subidos a la nube ✓");
      }
      return;
    }
    var prevSection = state.section;
    Object.assign(state, doc.data().appState);
    localStorage.setItem("ppy_v5", JSON.stringify(state));
    toast("Datos sincronizados desde la nube ✓");
    if (typeof setSection === "function") setSection(state.section || prevSection || "global_dashboard");
  } catch (e) { console.warn("Firestore load error:", e); }
}

function showAuthModal() {
  if (window._currentUser) {
    var el = document.getElementById("modal-area");
    el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:350px">' +
      '<div class="modal-title">Mi Cuenta<button class="delbtn" onclick="closeModal()">✕</button></div>' +
      '<div style="text-align:center;padding:20px">' +
      '<div style="font-size:2rem;margin-bottom:10px">👤</div>' +
      '<div style="font-weight:700;margin-bottom:4px">' + window._currentUser.email + '</div>' +
      '<div style="color:var(--tx3);font-size:0.85rem">' + window._currentUser.uid.slice(0, 8) + '...</div>' +
      '<div style="margin-top:15px;font-size:0.8rem;color:var(--tx3)">Los datos se sincronizan automáticamente con la nube.</div>' +
      '</div>' +
      '<div class="modal-acts"><button class="btn danger full" onclick="logout()">Cerrar Sesión</button></div></div></div>';
    return;
  }
  var el = document.getElementById("modal-area");
  el.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:350px">' +
    '<div class="modal-title">Iniciar Sesión<button class="delbtn" onclick="closeModal()">✕</button></div>' +
    '<div id="auth-error" style="color:var(--err);font-size:0.85rem;margin-bottom:10px;display:none"></div>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<input id="auth-email" type="email" placeholder="Correo electrónico" style="width:100%">' +
    '<input id="auth-pass" type="password" placeholder="Contraseña" style="width:100%">' +
    '</div>' +
    '<div class="modal-acts" style="flex-direction:column">' +
    '<button class="btn primary full" onclick="login()">Iniciar Sesión</button>' +
    '<button class="btn full" onclick="register()">Crear Cuenta Nueva</button>' +
    '</div></div></div>';
}

async function login() {
  var email = document.getElementById("auth-email").value.trim();
  var pass = document.getElementById("auth-pass").value;
  if (!email || !pass) return toast("Completá todos los campos", false);
  try {
    await window._AUTH.signInWithEmailAndPassword(email, pass);
    closeModal();
    toast("Sesión iniciada ✓");
  } catch (e) {
    var errEl = document.getElementById("auth-error");
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ""; }
  }
}

async function register() {
  var email = document.getElementById("auth-email").value.trim();
  var pass = document.getElementById("auth-pass").value;
  if (!email || !pass) return toast("Completá todos los campos", false);
  if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres", false);
  try {
    await window._AUTH.createUserWithEmailAndPassword(email, pass);
    closeModal();
    toast("Cuenta creada ✓");
  } catch (e) {
    var errEl = document.getElementById("auth-error");
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ""; }
  }
}

async function logout() {
  try {
    await window._AUTH.signOut();
    closeModal();
    toast("Sesión cerrada ✓");
  } catch (e) { toast("Error al cerrar sesión", false); }
}

// ── CLOUD SETTINGS ─────────────────────────────────────────────────────────
function renderCloudSettings() {
  var el = document.getElementById("section-cloud");
  if (!el) return;
  var user = window._currentUser;
  var syncEnabled = state._cloudSyncEnabled !== false;
  var dataSize = new Blob([JSON.stringify(state)]).size;
  var dataSizeStr = dataSize > 1024 ? (dataSize / 1024).toFixed(1) + " KB" : dataSize + " B";
  var lastSync = state._lastCloudSync || null;
  var syncLabel = lastSync ? formatDatePY(lastSync) + " " + (lastSync.split("T")[1] || "").slice(0, 5) : "—";

  el.innerHTML =
    '<div class="prices-wrap">' +
    '<div style="margin-bottom:20px"><h2 class="sec-lbl" style="margin-bottom:4px">☁️ Cloud</h2><p style="color:var(--tx3);font-size:0.9rem">Sincronización y gestión de datos en la nube.</p></div>' +

    '<div class="card"><h3 class="sec-lbl">Estado de Conexión</h3><div style="margin-top:12px">' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Cuenta</span><span style="font-weight:600">' + (user ? user.email : "No conectado") + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Estado</span><span style="font-weight:600;color:' + (user ? "var(--ok)" : "var(--tx3)") + '">' + (user ? "🟢 Conectado" : "⚪ Sin sesión") + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bor)"><span>Última sincronización</span><span style="font-weight:600">' + syncLabel + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0"><span>Tamaño de datos</span><span style="font-weight:600">' + dataSizeStr + '</span></div>' +
    '</div></div>' +

    '<div class="card" style="margin-top:16px"><h3 class="sec-lbl">Sincronización</h3><div style="margin-top:12px">' +
    '<label style="display:flex;align-items:center;gap:12px;cursor:pointer">' +
    '<input type="checkbox" ' + (syncEnabled ? "checked" : "") + ' onchange="state._cloudSyncEnabled=this.checked;save();toast(this.checked?\'Cloud activado\':\'Cloud desactivado\')">' +
    '<span style="font-weight:600">Sincronización automática a la nube</span></label>' +
    '<p style="color:var(--tx3);font-size:0.8rem;margin-top:6px">Cada cambio se sube automáticamente a Firestore cuando hay sesión iniciada.</p>' +
    '</div></div>' +

    '<div class="card" style="margin-top:16px"><h3 class="sec-lbl">Backup y Datos</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
    '<button class="btn full" onclick="exportBackup()">📥 Descargar Backup (JSON)</button>' +
    '<button class="btn full" onclick="importBackup()">📤 Restaurar Backup</button>' +
    (user ? '<button class="btn full danger" onclick="clearCloudData()">🗑️ Borrar datos de la nube</button>' : "") +
    '</div></div>' +

    '<div class="card" style="margin-top:16px;background:var(--sur2)">' +
    '<h3 class="sec-lbl" style="font-size:0.85rem">📋 Firebase Spark Plan (Gratis)</h3>' +
    '<p style="font-size:0.8rem;color:var(--tx3);margin-top:8px">Firestore: 1 GB almacenados · 50k lecturas/día · 20k escrituras/día<br>Authentication: 10k usuarios/mes<br>Hosting: 10 GB storage · 360 MB/día ancho de banda</p>' +
    '<p style="font-size:0.8rem;color:var(--tx3);margin-top:8px">Con uso normal no vas a tener costos. Cada guardado escribe ~2-5 KB en Firestore (~100-200 operaciones/día con uso intensivo).</p>' +
    '</div></div>';
}

function exportBackup() {
  var blob = new Blob([JSON.stringify({ state: state, db: DB, exportedAt: new Date().toISOString() })], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "puntero_backup_" + new Date().toISOString().split("T")[0] + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup descargado ✓");
}

function importBackup() {
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json";
  inp.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var d = JSON.parse(ev.target.result);
        if (d.state) Object.assign(state, d.state);
        if (d.db) DB = d.db;
        save();
        toast("Backup restaurado ✓");
        setSection(state.section || "cloud");
      } catch (err) { toast("Error al restaurar: " + err.message, false); }
    };
    reader.readAsText(file);
  };
  inp.click();
}

async function clearCloudData() {
  if (!window._currentUser) return toast("No hay sesión activa", false);
  if (!confirm("¿Borrar todos los datos de la nube?\n\nLos datos locales NO se borran. Esta acción no se puede deshacer.")) return;
  try {
    await window._FIRESTORE.collection("users").doc(window._currentUser.uid).delete();
    toast("Datos de la nube borrados ✓");
    renderCloudSettings();
  } catch (e) { toast("Error: " + e.message, false); }
}

// ── INIT ───────────────────────────────────────────────────────────────────
window.onload = () => {
  if (!state.finances) state.finances = { income: [], expenses: [] };
  if (!state.materialOrders) state.materialOrders = [];
  if (!state.contractors) state.contractors = [];
  if (!state.jornaleros) state.jornaleros = [];
  if (!state.jornalConfig) state.jornalConfig = { ayudante: 80000, oficial: 110000, puntero: 140000 };
  
  migrateToV7();
  renderCurrencyArea();
  initFirebaseAuth();
  
  setSection('global_dashboard');

  updateBadge();
  checkBackupReminder();
};

/**
 * GEOLOCALIZACIÓN Y MAPAS
 */
function showProjectLocationModal() {
    const p = getActiveProject();
    if (!p) return;
    const loc = p.location || { lat: -25.26, lng: -57.57, address: "" };

    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:600px">
        <div class="modal-title">Ubicación de la Obra<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div class="info-box" style="margin-bottom:15px">Hacé click en el mapa para marcar la ubicación exacta de la obra.</div>
        <div id="project-map" class="map-container">
            <div class="map-placeholder">Cargando mapa...</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px">
            <input id="loc-address" placeholder="Dirección o Referencia (ej: Calle 4 y Avda. Mariscal)" value="${loc.address || ''}">
            <div class="grid2">
                <input id="loc-lat" type="number" step="any" placeholder="Latitud" value="${loc.lat || ''}" readonly>
                <input id="loc-lng" type="number" step="any" placeholder="Longitud" value="${loc.lng || ''}" readonly>
            </div>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cerrar</button>
            <button class="btn ok-btn" onclick="shareProjectLocation()">📤 Compartir Ubicación</button>
            <button class="btn primary" onclick="saveProjectLocation()">Guardar Ubicación 📍</button>
        </div>
    </div></div>`;

    setTimeout(() => initProjectMap(loc), 300);
}

let _map, _marker;
function initProjectMap(loc) {
    const center = loc.lat && loc.lng ? [loc.lat, loc.lng] : [-25.2637, -57.5759]; // Asunción por defecto
    
    _map = L.map('project-map').setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(_map);

    if (loc.lat && loc.lng) {
        _marker = L.marker(center, { draggable: true }).addTo(_map);
    }

    _map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        if (_marker) {
            _marker.setLatLng(e.latlng);
        } else {
            _marker = L.marker(e.latlng, { draggable: true }).addTo(_map);
        }
        document.getElementById('loc-lat').value = lat.toFixed(6);
        document.getElementById('loc-lng').value = lng.toFixed(6);
    });
}

function saveProjectLocation() {
    const p = getActiveProject();
    if (!p) return;
    const lat = parseFloat(document.getElementById('loc-lat').value);
    const lng = parseFloat(document.getElementById('loc-lng').value);
    const address = document.getElementById('loc-address').value;

    if (!lat || !lng) return toast("Marcá la ubicación en el mapa", false);

    p.location = { lat, lng, address };
    save();
    closeModal();
    renderDashboard();
    renderProjects();
    toast("Ubicación guardada ✓");
}

function shareProjectLocation() {
    const p = getActiveProject();
    const lat = document.getElementById('loc-lat').value || (p.location && p.location.lat);
    const lng = document.getElementById('loc-lng').value || (p.location && p.location.lng);
    const address = document.getElementById('loc-address').value || (p.location && p.location.address);

    if (!lat || !lng) return toast("No hay ubicación guardada", false);

    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const text = `📍 *Ubicación de Obra: ${p.name}*\nDirección: ${address || 'Ver mapa'}\n\nLink: ${googleMapsUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank');
}
