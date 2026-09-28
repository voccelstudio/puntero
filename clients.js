/**
 * BASE DE DATOS DE CLIENTES — Puntero ERP
 * Registro de clientes y asignación de presupuestos.
 */

function getClients() {
  if (!state.clients) state.clients = [];
  return state.clients;
}

// Sincroniza la lista de clientes a partir de los proyectos existentes (migración).
function ensureClients() {
  if (state.migratedClients) return;
  var clients = getClients();
  (state.projects || []).forEach(function (p) {
    var name = String(p.client || "").trim();
    if (!name) return;
    if (p.clientId && clients.some(function (c) { return c.id === p.clientId; })) return;
    var slug = name.toLowerCase().replace(/\s+/g, " ");
    var existing = clients.find(function (c) { return String(c.name || "").toLowerCase().replace(/\s+/g, " ") === slug; });
    if (!existing) {
      existing = { id: "cli_" + Date.now().toString(36), name: name, phone: p.phone || "", address: p.address || "", ruc: p.ruc || "", note: "", createdAt: Date.now() };
      clients.push(existing);
    }
    p.clientId = existing.id;
    p.client = existing.name;
    if (!p.phone) p.phone = existing.phone;
    if (!p.address) p.address = existing.address;
  });
  state.migratedClients = true;
  if (typeof save === "function") save();
}

// Cliente de un proyecto: por clientId; si no, por nombre legado; si no, null.
function resolveClient(p) {
  if (!p) return null;
  var clients = getClients();
  if (p.clientId) {
    var byId = clients.find(function (c) { return c.id === p.clientId; });
    if (byId) return byId;
  }
  var name = String(p.client || "").trim();
  if (!name) return null;
  return clients.find(function (c) { return String(c.name || "").trim().toLowerCase() === name.toLowerCase(); }) || null;
}

function clientName(p) {
  var c = resolveClient(p);
  if (c) return c.name || "";
  return p.client || "";
}
function clientPhone(p) {
  var c = resolveClient(p);
  if (c && c.phone) return c.phone;
  return p.phone || "";
}
function clientAddress(p) {
  var c = resolveClient(p);
  if (c && c.address) return c.address;
  return p.address || "";
}
function clientRuc(p) {
  var c = resolveClient(p);
  return (c && c.ruc) || "";
}

// Encuentra o crea un cliente a partir de los datos de un proyecto.
function syncProjectClient(p, data) {
  if (!p) return;
  data = data || {};
  var clients = getClients();
  var name = String(data.name || p.client || "").trim();
  if (!name) { p.clientId = null; return; }
  var existing = clients.find(function (c) { return String(c.name || "").trim().toLowerCase() === name.toLowerCase(); });
  if (!existing && p.clientId) existing = clients.find(function (c) { return c.id === p.clientId; });
  if (!existing) {
    existing = { id: "cli_" + Date.now().toString(36), name: name, phone: data.phone || "", address: data.address || "", ruc: data.ruc || "", note: "", createdAt: Date.now() };
    clients.push(existing);
  } else {
    if (data.phone) existing.phone = data.phone;
    if (data.address) existing.address = data.address;
    if (data.ruc) existing.ruc = data.ruc;
  }
  p.clientId = existing.id;
  p.client = existing.name;
  if (data.phone) p.phone = data.phone;
  if (data.address) p.address = data.address;
  if (data.ruc) p.ruc = data.ruc;
  save();
}

// Selector HTML de clientes (usado en modales de proyecto y en el presupuesto).
function clientOptionsHtml(selectedId, extra) {
  var clients = getClients();
  var h = '<option value=""' + (selectedId ? "" : " selected") + '>— Seleccioná un cliente —</option>';
  clients.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); }).forEach(function (c) {
    var sel = c.id === selectedId ? " selected" : "";
    h += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.name || "Sin nombre") + (c.ruc ? " (RUC " + c.ruc + ")" : "") + "</option>";
  });
  if (extra) h += extra;
  return h;
}

// Cliente efectivo de un presupuesto: adenda.clientId > proyecto > legado.
function resolveBudgetClient(p, adenda) {
  if (adenda && adenda.clientId) {
    var byId = getClients().find(function (c) { return c.id === adenda.clientId; });
    if (byId) return byId;
  }
  return resolveClient(p);
}

function clientProjects(c) {
  return (state.projects || []).filter(function (p) { return (p.clientId && p.clientId === c.id) || (String(p.client || "").trim().toLowerCase() === String(c.name || "").trim().toLowerCase()); });
}

function clientTotalMoney(c) {
  var ps = clientProjects(c);
  var t = 0;
  ps.forEach(function (p) {
    (p.budgets || []).forEach(function (b) {
      (b.items || []).forEach(function (i) { t += (Number(i.unitPrice) || 0) * (1 - (i.disc || 0) / 100) * (Number(i.qty) || 0); });
    });
  });
  return t;
}

function renderClients() {
  var el = document.getElementById("section-clients");
  if (!el) return;
  ensureClients();
  var clients = getClients();
  var q = (state.clientFilter || "").toLowerCase();
  var list = clients.filter(function (c) { return !q || String(c.name || "").toLowerCase().includes(q) || String(c.ruc || "").toLowerCase().includes(q) || String(c.phone || "").toLowerCase().includes(q); })
    .sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });

  var cards = list.map(function (c) {
    var ps = clientProjects(c);
    var total = clientTotalMoney(c);
    var phoneClean = String(c.phone || "").replace(/[^\d+]/g, "");
    return '<div class="card con-card" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">' +
        '<div>' +
          '<div style="font-family:var(--font-display);font-weight:800;font-size:1.05rem">' + escapeHtml(c.name || "—") + '</div>' +
          '<div style="font-size:0.8rem;color:var(--tx3);margin-top:2px">' +
            (c.ruc ? "RUC: " + escapeHtml(c.ruc) + " · " : "") +
            (c.phone ? "📞 " + escapeHtml(c.phone) : "") + (c.phone && c.address ? " · " : "") +
            (c.address ? "📍 " + escapeHtml(c.address) : "") +
          '</div>' +
          (c.email ? '<div style="font-size:0.8rem;color:var(--tx3)">✉️ ' + escapeHtml(c.email) + "</div>" : "") +
          (c.note ? '<div style="font-size:0.8rem;color:var(--tx2);margin-top:4px;font-style:italic">' + escapeHtml(c.note) + "</div>" : "") +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-weight:800;font-size:1rem;color:var(--acc)">₲ ' + fmt(total) + '</div>' +
          '<div style="font-size:0.7rem;color:var(--tx3)">' + ps.length + ' presupuesto' + (ps.length !== 1 ? "s" : "") + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
        (c.phone ? '<a href="https://wa.me/' + phoneClean + '" target="_blank" style="flex:1" class="btn sm">💬 WhatsApp</a>' : "") +
        '<button class="btn sm" style="flex:1" onclick="setSectionClientsProjects(\'' + c.id + '\')">🏢 Proyectos</button>' +
        '<button class="btn sm" style="flex:1" onclick="openClientForm(\'' + c.id + '\')">✏️ Editar</button>' +
        '<button class="btn sm danger" style="flex:1" onclick="deleteClient(\'' + c.id + '\')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join("");

  el.innerHTML = '<div class="prices-wrap">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">' +
      '<div><h2 class="sec-lbl" style="margin:0">Base de Clientes</h2><p style="color:var(--tx3);font-size:0.9rem">Registrá clientes y asignáles presupuestos</p></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<div class="srch" style="margin:0;min-width:200px"><span class="srch-ico">🔍</span><input placeholder="Buscar cliente, RUC, teléfono..." value="' + escapeHtml(state.clientFilter || "") + '" oninput="state.clientFilter=this.value;renderClients()"></div>' +
        '<button class="btn primary" onclick="openClientForm()">+ Nuevo Cliente</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">' +
      '<span style="font-size:0.8rem;color:var(--tx3)">' + clients.length + " cliente" + (clients.length !== 1 ? "s" : "") + " en la base</span>" +
      (state.clientFilter ? '<button class="btn sm" onclick="state.clientFilter=\'\';renderClients()">✕ Limpiar filtro</button>' : "") +
    '</div>' +
    (cards || '<div class="empty"><div class="empty-ico">👥</div><div>No hay clientes todavía. Creá el primero para asignarle presupuestos.</div></div>') +
  '</div>';
}

// Llama desde la sección Clientes: ver proyectos de un cliente.
function setSectionClientsProjects(clientId) {
  state.clientFilterProj = clientId;
  setSection("projects");
  renderProjects();
  toast("Proyectos de " + (getClients().find(function (c) { return c.id === clientId; }) || {}).name);
}

function openClientForm(id) {
  var c = id ? getClients().find(function (x) { return x.id === id; }) : null;
  window.modals = window.modals || {};
  window.modals.client_form = function () {
    return '<div class="modal-title">' + (c ? "Modificar Cliente" : "Nuevo Cliente") + '<button class="delbtn" onclick="closeModal()">✕</button></div>' +
      '<div class="grid2">' +
        '<div class="fullcol"><label class="stat-lbl">Nombre *</label><input id="cf-name" placeholder="Nombre completo o empresa" value="' + escapeHtml((c && c.name) || "") + '"></div>' +
        '<div><label class="stat-lbl">Teléfono / WhatsApp</label><input id="cf-phone" placeholder="Ej: 0981 123456" value="' + escapeHtml((c && c.phone) || "") + '"></div>' +
        '<div><label class="stat-lbl">Email</label><input id="cf-email" type="email" placeholder="cliente@mail.com" value="' + escapeHtml((c && c.email) || "") + '"></div>' +
        '<div><label class="stat-lbl">RUC / CI</label><input id="cf-ruc" placeholder="RUC o cédula" value="' + escapeHtml((c && c.ruc) || "") + '"></div>' +
        '<div class="fullcol"><label class="stat-lbl">Dirección</label><input id="cf-addr" placeholder="Ciudad, Barrio, Calle..." value="' + escapeHtml((c && c.address) || "") + '"></div>' +
        '<div class="fullcol"><label class="stat-lbl">Nota interna</label><input id="cf-note" placeholder="Observaciones (no aparece en el PDF)" value="' + escapeHtml((c && c.note) || "") + '"></div>' +
      '</div>' +
      '<div class="modal-acts">' +
        '<button class="btn" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn primary" onclick="saveClientForm(\'' + (c ? c.id : "") + '\')">Guardar 💾</button>' +
      '</div>';
  };
  showModal("client_form");
}

function saveClientForm(id) {
  var clients = getClients();
  var name = String(document.getElementById("cf-name").value || "").trim();
  if (!name) { toast("El nombre es obligatorio", false); return; }
  var c = id ? clients.find(function (x) { return x.id === id; }) : null;
  if (!c) {
    c = { id: "cli_" + Date.now().toString(36), createdAt: Date.now() };
    clients.push(c);
  }
  c.name = name;
  c.phone = document.getElementById("cf-phone").value.trim();
  c.email = document.getElementById("cf-email").value.trim();
  c.ruc = document.getElementById("cf-ruc").value.trim();
  c.address = document.getElementById("cf-addr").value.trim();
  c.note = document.getElementById("cf-note").value.trim();
  // Mantener los proyectos asignados sincronizados con el nombre del cliente.
  (state.projects || []).forEach(function (p) {
    if (p.clientId === c.id) p.client = c.name;
  });
  save();
  closeModal();
  renderClients();
  updateBadge();
  if (document.getElementById("bd-client-id") && typeof renderBudget === "function") renderBudget();
  toast("Cliente guardado ✓");
}

function deleteClient(id) {
  var c = getClients().find(function (x) { return x.id === id; });
  if (!c) return;
  var n = clientProjects(c).length;
  var msg = "¿Eliminar el cliente \"" + c.name + "\"?";
  if (n > 0) msg += "\n\nTiene " + n + " presupuesto" + (n !== 1 ? "s" : "") + " asignado" + (n !== 1 ? "s" : "") + "; quedarán sin cliente.";
  if (!confirm(msg)) return;
  state.clients = state.clients.filter(function (x) { return x.id !== id; });
  (state.projects || []).forEach(function (p) { if (p.clientId === id) p.clientId = null; });
  save();
  renderClients();
  toast("Cliente eliminado ✕");
}