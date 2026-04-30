/**
 * GESTIÓN DE MATERIALES - Puntero ERP
 * Maneja la compra y seguimiento de insumos en obra.
 */

function renderMaterials() {
    const el = document.getElementById("section-materials");
    if (!el) return;

    const materialsNeeded = calcMaterials(); // Viene de app.js
    const orders = state.materialOrders || [];

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <h2 class="sec-lbl" style="margin:0">Inventario y Pedidos</h2>
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
                <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:15px">Lista total de materiales según el presupuesto actual.</p>
                <div class="scroll-area" style="max-height:400px">
                    <table class="tbl">
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th>Unid.</th>
                                <th style="text-align:right">Cant. Necesaria</th>
                            </tr>
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
                <div class="scroll-area" style="max-height:400px">
                    <div style="display:flex; flex-direction:column; gap:10px">
                        ${orders.map(o => `
                            <div class="cat-item" style="display:block; padding:12px; cursor:default">
                                <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                                    <span style="font-weight:700; font-size:0.9rem">#${o.id.toString().slice(-4)} - ${o.supplier || 'Proveedor S/N'}</span>
                                    <span class="iva-badge" style="background:${o.status === 'delivered' ? 'var(--ok)' : 'var(--blue)'}; color:white">${o.status === 'delivered' ? 'ENTREGADO' : 'PENDIENTE'}</span>
                                </div>
                                <div style="font-size:0.8rem; color:var(--tx2)">${o.date}</div>
                                <div style="margin-top:8px; font-size:0.85rem">
                                    ${o.items.map(i => `• ${i.name}: ${i.qty} ${i.unit}`).join("<br>")}
                                </div>
                                <div style="display:flex; gap:5px; margin-top:10px">
                                    ${o.status !== 'delivered' ? `<button class="btn sm ok-btn" onclick="markOrderDelivered('${o.id}')">Marcar Entregado</button>` : ''}
                                    <button class="btn sm danger" onclick="removeOrder('${o.id}')">Eliminar</button>
                                </div>
                            </div>
                        `).join("") || '<div style="text-align:center; padding:40px; color:var(--tx3)">No hay órdenes registradas.</div>'}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

function markOrderDelivered(id) {
    const order = state.materialOrders.find(o => o.id == id);
    if (order) {
        order.status = 'delivered';
        save();
        renderMaterials();
        toast("Orden marcada como entregada ✓");
    }
}

function removeOrder(id) {
    if (!confirm("¿Eliminar esta orden de compra?")) return;
    state.materialOrders = state.materialOrders.filter(o => o.id != id);
    save();
    renderMaterials();
}

/**
 * MODAL PARA NUEVA ORDEN
 */
window.modals = window.modals || {};
window.modals.new_order = () => {
    const mats = calcMaterials();
    return `
    <div class="modal-hdr">Nueva Orden de Compra</div>
    <div class="grid2" style="margin-bottom:15px">
        <input id="mo-supplier" placeholder="Proveedor / Corralón">
        <input id="mo-date" type="date" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="card" style="margin-bottom:15px">
        <h4 style="margin-top:0; font-size:0.9rem">Seleccionar Insumos</h4>
        <div style="max-height:250px; overflow-y:auto">
            <table class="tbl sm">
                <thead>
                    <tr><th>Material</th><th>Pedir</th></tr>
                </thead>
                <tbody id="mo-items-list">
                    ${mats.map((m, idx) => `
                        <tr>
                            <td>${m.name} <small>(${m.unit})</small></td>
                            <td><input type="number" class="sm mo-qty" data-name="${m.name}" data-unit="${m.unit}" placeholder="0" style="width:60px"></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    </div>
    <div style="display:flex; gap:10px; justify-content:flex-end">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="createOrder()">Crear Orden</button>
    </div>
    `;
};

function createOrder() {
    const supplier = document.getElementById("mo-supplier").value;
    const date = document.getElementById("mo-date").value;
    const items = [];
    
    document.querySelectorAll(".mo-qty").forEach(input => {
        const qty = parseFloat(input.value);
        if (qty > 0) {
            items.push({
                name: input.dataset.name,
                unit: input.dataset.unit,
                qty: qty
            });
        }
    });

    if (items.length === 0) {
        toast("Agregá al menos un material", false);
        return;
    }

    const newOrder = {
        id: Date.now(),
        supplier,
        date,
        items,
        status: 'pending'
    };

    state.materialOrders.push(newOrder);
    save();
    closeModal();
    renderMaterials();
    toast("Orden de compra creada ✓");
}
