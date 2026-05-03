/**
 * GESTIÓN DE MATERIALES - Puntero ERP
 */

function renderMaterials() {
    const el = document.getElementById("section-materials");
    if (!el) return;
    const p = getActiveProject();
    if (!p) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto para gestionar materiales.</div>"; return; }

    const materialsNeeded = calcMaterials();
    const orders = p.execution.materialOrders || [];

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <div>
                <h2 class="sec-lbl" style="margin:0">Logística e Insumos</h2>
                <p style="color:var(--tx3); font-size:0.9rem">Proyecto: <strong>${p.name}</strong></p>
            </div>
            <button class="btn primary" onclick="showModal('new_order')">+ Nueva Orden de Compra</button>
        </div>

        <div class="dash-grid">
            <div class="dash-card">
                <div class="dash-num">${materialsNeeded.length}</div>
                <div class="dash-lbl">Insumos en Presupuesto</div>
            </div>
            <div class="dash-card">
                <div class="dash-num">${orders.length}</div>
                <div class="dash-lbl">Órdenes Generadas</div>
            </div>
            <div class="dash-card">
                <div class="dash-num" style="color:var(--ok)">${orders.filter(o => o.status === 'delivered').length}</div>
                <div class="dash-lbl">Entregas Completadas</div>
            </div>
        </div>

        <div class="grid2" style="margin-top:20px">
            <div class="card">
                <h3 class="sec-lbl">Consolidado de Necesidades (Cómputo)</h3>
                <div class="scroll-area" style="max-height:500px">
                    <table class="tbl">
                        <thead>
                            <tr><th>Material</th><th>Unid.</th><th style="text-align:right">Cant. Necesaria</th></tr>
                        </thead>
                        <tbody>
                            ${materialsNeeded.map(m => `
                                <tr>
                                    <td><strong>${m.name}</strong></td>
                                    <td><span class="utag">${m.unit}</span></td>
                                    <td style="text-align:right; font-weight:700">${fmtD(m.qty)}</td>
                                </tr>
                            `).join("") || '<tr><td colspan="3" style="text-align:center; padding:20px">No hay ítems en el presupuesto.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3 class="sec-lbl">Órdenes de Compra y Entregas</h3>
                <div class="scroll-area" style="max-height:500px">
                    <div style="display:flex; flex-direction:column; gap:12px">
                        ${orders.map(o => `
                            <div class="cat-item" style="display:block; padding:15px; cursor:default; border-left: 4px solid ${o.status === 'delivered' ? 'var(--ok)' : 'var(--blue)'}">
                                <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                                    <span style="font-weight:800; font-size:0.95rem">#${o.id.toString().slice(-4)} - ${o.supplier || 'Proveedor S/N'}</span>
                                    <span class="iva-badge" style="background:${o.status === 'delivered' ? 'var(--ok)' : 'var(--blue)'}; color:white">${o.status === 'delivered' ? 'RECIBIDO' : 'PEDIDO'}</span>
                                </div>
                                <div style="font-size:0.8rem; color:var(--tx3); margin-bottom:10px">Pedido: ${formatDatePY(o.date)}</div>
                                
                                <div style="margin-top:8px; font-size:0.85rem; background:var(--sur2); padding:10px; border-radius:var(--rad)">
                                    ${o.items.map(i => `• ${i.name}: <strong>${i.qty} ${i.unit}</strong>`).join("<br>")}
                                </div>
                                
                                ${o.status === 'delivered' ? `
                                    <div style="margin-top:12px; display:flex; gap:12px; align-items:center; border-top:1px dashed var(--bor); padding-top:12px">
                                        <div style="flex:1">
                                            <div style="font-size:0.75rem; color:var(--tx3); text-transform:uppercase; font-weight:700">Llegada Obra</div>
                                            <div style="font-size:0.9rem; font-weight:600">${o.deliveryDate ? formatDatePY(o.deliveryDate) : 'S/D'}</div>
                                        </div>
                                        ${o.deliveryPhoto ? `
                                            <div onclick="previewImage('${o.deliveryPhoto}')" style="width:50px; height:50px; border-radius:4px; background:url(${o.deliveryPhoto}) center/cover; cursor:pointer; border:1px solid var(--bor)" title="Ver Remisión"></div>
                                        ` : ''}
                                    </div>
                                ` : ''}

                                <div style="margin-top:12px; font-weight:800; color:var(--tx); font-size:1.1rem">${fmt(o.total || 0)}</div>
                                
                                <div style="display:flex; gap:8px; margin-top:12px">
                                    ${o.status !== 'delivered' ? `<button class="btn sm ok-btn" onclick="showDeliveryModal('${o.id}')">🚚 Marcar Llegada</button>` : ''}
                                    ${!o.isPaid ? `<button class="btn sm" onclick="payOrder('${o.id}')">💰 Pagar</button>` : '<span class="iva-badge" style="background:var(--ok); color:white">PAGADO</span>'}
                                    <button class="btn sm danger" onclick="removeOrder('${o.id}')">✕</button>
                                </div>
                            </div>
                        `).join("") || '<div style="text-align:center; padding:40px; color:var(--tx3)">No hay órdenes registradas.</div>'}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function showDeliveryModal(orderId) {
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
        <div class="modal-title">Confirmar Recepción de Materiales</div>
        <div style="display:flex; flex-direction:column; gap:15px">
            <div>
                <label class="stat-lbl">Fecha de Llegada a Obra</label>
                ${dateInputPY('del-date', todayISO(), '', 'width:100%')}
            </div>
            <div>
                <label class="stat-lbl">Foto de Remisión / Factura</label>
                <div style="display:flex; flex-direction:column; gap:8px">
                    <input type="file" id="del-photo-cam" accept="image/*" capture="environment" style="display:none" onchange="handleDeliveryPhoto(this)">
                    <input type="file" id="del-photo" accept="image/*" style="display:none" onchange="handleDeliveryPhoto(this)">
                    <div style="display:flex; gap:6px">
                        <button class="btn sm" style="flex:1" onclick="document.getElementById('del-photo-cam').click()">📸 Tomar foto</button>
                        <button class="btn sm" style="flex:1" onclick="document.getElementById('del-photo').click()">🖼️ De galería</button>
                    </div>
                    <div id="del-photo-preview" style="width:100%; height:140px; border:2px dashed var(--bor); border-radius:var(--rad); display:flex; align-items:center; justify-content:center; overflow:hidden">
                        <span style="color:var(--tx3); font-size:0.8rem">Vista previa de la foto</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="confirmDelivery('${orderId}')">Confirmar Recepción ✓</button>
        </div>
    </div></div>`;
}

let _tempDeliveryPhoto = "";
function handleDeliveryPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            _tempDeliveryPhoto = e.target.result;
            const preview = document.getElementById("del-photo-preview");
            preview.innerHTML = `<img src="${_tempDeliveryPhoto}" style="max-width:100%; max-height:100%; object-fit:contain">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function confirmDelivery(orderId) {
    const p = getActiveProject();
    const order = p.execution.materialOrders.find(o => o.id == orderId);
    const date = document.getElementById("del-date").value;
    
    if (!date) return toast("La fecha de llegada es requerida", false);

    if (order) {
        order.status = 'delivered';
        order.deliveryDate = date;
        order.deliveryPhoto = _tempDeliveryPhoto;
        _tempDeliveryPhoto = ""; // Reset
        save();
        renderMaterials();
        closeModal();
        toast("Recepción confirmada y registrada ✓");
    }
}

function previewImage(src) {
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay img-viewer" onclick="if(event.target.classList.contains('img-viewer')||event.target.classList.contains('img-viewer-content'))closeModal()" style="background:rgba(0,0,0,0.92); padding:0; align-items:center;">
        <div class="img-viewer-content" style="width:100%; height:100vh; display:flex; align-items:center; justify-content:center; overflow:auto; -webkit-overflow-scrolling:touch; padding:20px; box-sizing:border-box;">
            <img src="${src}" style="max-width:100%; max-height:90vh; object-fit:contain; touch-action:pinch-zoom; user-select:none; cursor:zoom-in;" ondblclick="this.style.maxWidth=this.style.maxWidth==='200%'?'100%':'200%'">
        </div>
        <button class="delbtn" style="position:fixed; top:14px; right:14px; background:rgba(0,0,0,0.7); color:white; border-radius:50%; width:44px; height:44px; font-size:1.3rem; z-index:10" onclick="closeModal()">✕</button>
        <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:white; padding:8px 16px; border-radius:20px; font-size:0.8rem; pointer-events:none">Doble tap para acercar / Pellizcar para zoom</div>
    </div>`;
}

function payOrder(id) {
    const p = getActiveProject();
    if (!p) return;
    if (!p.execution.materialOrders) p.execution.materialOrders = [];
    const o = p.execution.materialOrders.find(x => x.id == id);
    if (!o) return;
    if (confirm(`¿Registrar pago de ${fmt(o.total)} a ${o.supplier}?`)) {
        o.isPaid = true;
        o.paymentDate = todayISO();

        if (!p.execution.finances) p.execution.finances = { income: [], expenses: [] };
        if (!p.execution.finances.expenses) p.execution.finances.expenses = [];
        p.execution.finances.expenses.push({
            id: 'mo_pay_' + Date.now(),
            amount: o.total || 0,
            date: o.paymentDate,
            note: `Pago Materiales: ${o.supplier} (#${o.id.toString().slice(-4)})`
        });

        save();
        renderMaterials();
        toast("Pago registrado ✓");
    }
}

function removeOrder(id) {
    const p = getActiveProject();
    if (!confirm("¿Eliminar esta orden de compra?")) return;
    p.execution.materialOrders = p.execution.materialOrders.filter(o => o.id != id);
    save();
    renderMaterials();
}

function createOrder() {
    const p = getActiveProject();
    const supplier = document.getElementById("mo-supplier").value;
    const total = parseFloat(document.getElementById("mo-total").value) || 0;
    const date = document.getElementById("mo-date").value;
    const items = [];
    
    document.querySelectorAll(".mo-qty").forEach(input => {
        const qty = parseFloat(input.value);
        if (qty > 0) {
            items.push({ name: input.dataset.name, unit: input.dataset.unit, qty: qty });
        }
    });

    if (items.length === 0) return toast("Agregá al menos un material", false);

    const newOrder = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        supplier, total, date, items, status: 'pending', isPaid: false
    };

    if (!p.execution.materialOrders) p.execution.materialOrders = [];
    p.execution.materialOrders.push(newOrder);
    save();
    closeModal();
    renderMaterials();
    toast("Orden de compra creada ✓");
}

// ── MODAL: NUEVA ORDEN DE COMPRA ───────────────────────────────────────────
window.modals = window.modals || {};
window.modals.new_order = () => {
    const p = getActiveProject();
    if (!p) return `<div class="modal-title">Sin proyecto<button class="delbtn" onclick="closeModal()">✕</button></div><p>Seleccioná un proyecto primero.</p>`;

    const materialsNeeded = calcMaterials();
    const today = todayISO();

    // Sugerir proveedores existentes
    const supplierOpts = (state.suppliers || []).map(s => `<option value="${s.name.replace(/"/g, '&quot;')}">`).join("");

    const matRows = materialsNeeded.length === 0
        ? `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--tx3)">No hay materiales en el presupuesto.</td></tr>`
        : materialsNeeded.map(m => `
            <tr>
                <td>${m.name}</td>
                <td><span class="utag">${m.unit}</span></td>
                <td>
                    <input type="number" class="mo-qty"
                        data-name="${m.name.replace(/"/g, '&quot;')}"
                        data-unit="${m.unit}"
                        min="0" step="0.01"
                        placeholder="0"
                        style="width:100px; text-align:right">
                    <span style="font-size:0.7rem; color:var(--tx3)">/ ${fmtD(m.qty)} total</span>
                </td>
            </tr>
        `).join("");

    return `
        <div class="modal-title">Nueva Orden de Compra<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px">
            <div>
                <label class="stat-lbl">Proveedor</label>
                <input id="mo-supplier" list="mo-supplier-list" placeholder="Nombre / corralón">
                <datalist id="mo-supplier-list">${supplierOpts}</datalist>
            </div>
            <div>
                <label class="stat-lbl">Fecha del Pedido</label>
                ${dateInputPY('mo-date', today, '', 'width:100%')}
            </div>
            <div class="fullcol" style="grid-column:1/-1">
                <label class="stat-lbl">Monto Total (₲)</label>
                <input id="mo-total" type="number" placeholder="0" min="0">
            </div>
        </div>
        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--tx3); margin:10px 0">Cantidades a pedir</h4>
        <div style="max-height:300px; overflow-y:auto; border:1px solid var(--bor); border-radius:var(--rad)">
            <table class="tbl sm">
                <thead>
                    <tr><th>Material</th><th>Unid.</th><th style="text-align:right">Cantidad a pedir</th></tr>
                </thead>
                <tbody>${matRows}</tbody>
            </table>
        </div>
        <div class="modal-acts">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn primary" onclick="createOrder()">Crear Orden 📦</button>
        </div>
    `;
};
