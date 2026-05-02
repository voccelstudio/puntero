/**
 * DIRECTORIO DE PROVEEDORES - Puntero ERP
 * Gestión de proveedores y comparativa de precios.
 */

function renderSuppliers() {
    const el = document.getElementById("section-suppliers");
    if (!el) return;

    if (!state.suppliers) state.suppliers = [];
    if (!state._quotes) state._quotes = []; // Registro de cotizaciones { supplierId, materialName, price, date }

    const suppliers = state.suppliers;

    el.innerHTML = `
    <div class="prices-wrap">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
            <h2 class="sec-lbl" style="margin:0">Gestión de Proveedores</h2>
            <div style="display:flex; gap:10px">
                <button class="btn ok-btn" onclick="showModal('new_supplier')">+ Nuevo Proveedor</button>
                <button class="btn primary" onclick="showModal('compare_prices')">📊 Comparar Precios</button>
            </div>
        </div>

        <div class="con-grid">
            ${suppliers.map(s => `
                <div class="card con-card" onclick="viewSupplier('${s.id}')">
                    <div class="con-name">${s.name}</div>
                    <div class="con-meta">
                        <span>📞 ${s.phone || 'S/T'}</span>
                        <span>🏢 ${s.category || 'General'}</span>
                        <span>📍 ${s.address || 'S/D'}</span>
                    </div>
                    <div class="con-stats">
                        <div class="stat-box">
                            <div class="stat-lbl">Calificación</div>
                            <div class="stat-val">${'⭐'.repeat(s.rating || 5)}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-lbl">Cotizaciones</div>
                            <div class="stat-val">${(state._quotes || []).filter(q => q.supplierId == s.id).length}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:5px; margin-top:12px">
                        ${s.phone ? `<button class="btn sm" onclick="event.stopPropagation(); window.open(waLink('${s.phone}'), '_blank')" style="background:#25D366; color:white; border:none">💬 WhatsApp</button>` : ''}
                        <button class="btn sm danger" onclick="event.stopPropagation(); deleteSupplier('${s.id}')">✕</button>
                    </div>
                </div>
            `).join("") || '<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--tx3)">No hay proveedores registrados.</div>'}
        </div>
    </div>
    `;
}

function deleteSupplier(id) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    state.suppliers = state.suppliers.filter(s => s.id != id);
    save();
    renderSuppliers();
}

function viewSupplier(id) {
    const s = (state.suppliers || []).find(x => x.id == id);
    if (!s) return;
    const quotes = (state._quotes || []).filter(q => q.supplierId == id);
    const el = document.getElementById("modal-area");
    el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px">
        <div class="modal-title">${s.name}<button class="delbtn" onclick="closeModal()">✕</button></div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px">
            <div><strong>📞 Teléfono:</strong> ${s.phone || 'S/D'}</div>
            <div><strong>🏢 Categoría:</strong> ${s.category || 'General'}</div>
            <div><strong>📍 Dirección:</strong> ${s.address || 'S/D'}</div>
            <div><strong>⭐ Calificación:</strong> ${'⭐'.repeat(s.rating || 5)}</div>
        </div>
        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--tx3); margin:10px 0">Cotizaciones registradas (${quotes.length})</h4>
        <div style="max-height:200px; overflow-y:auto; border:1px solid var(--bor); border-radius:var(--rad); padding:8px">
            ${quotes.length === 0
                ? '<p style="color:var(--tx3); text-align:center; padding:10px">Sin cotizaciones cargadas.</p>'
                : quotes.map(q => `
                    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--bor)">
                        <span>${q.materialName}</span>
                        <span style="font-weight:700">${fmt(q.price)}</span>
                    </div>
                `).join("")
            }
        </div>
        <div class="modal-acts">
            ${s.phone ? `<button class="btn" onclick="window.open(waLink('${s.phone.replace(/'/g, "\\'")}'), '_blank')" style="background:#25D366; color:white; border:none">💬 WhatsApp</button>` : ''}
            <button class="btn" onclick="closeModal()">Cerrar</button>
        </div>
    </div></div>`;
}

/**
 * MODALES DE PROVEEDORES
 */
window.modals.new_supplier = () => `
    <div class="modal-title">Registrar Nuevo Proveedor</div>
    <div style="display:flex; flex-direction:column; gap:12px">
        <input id="s-name" placeholder="Nombre de la Empresa / Corralón">
        <div class="grid2">
            <input id="s-phone" placeholder="Teléfono / WhatsApp">
            <select id="s-cat">
                <option value="General">Categoría: General</option>
                <option value="Corralón">Corralón / Materiales</option>
                <option value="Electricidad">Materiales Eléctricos</option>
                <option value="Plomería">Plomería y Sanitarios</option>
                <option value="Terminaciones">Pisos y Revestimientos</option>
            </select>
        </div>
        <input id="s-address" placeholder="Dirección / Ubicación">
        <div style="display:flex; gap:10px; justify-content:flex-end">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn ok-btn" onclick="createSupplier()">Guardar Proveedor</button>
        </div>
    </div>
`;

function createSupplier() {
    const name = document.getElementById("s-name").value;
    const phone = document.getElementById("s-phone").value;
    const category = document.getElementById("s-cat").value;
    const address = document.getElementById("s-address").value;

    if (!name) return toast("El nombre es obligatorio", false);

    const newSup = {
        id: Date.now(),
        name, phone, category, address,
        rating: 5
    };

    state.suppliers.push(newSup);
    save();
    closeModal();
    renderSuppliers();
    toast("Proveedor guardado ✓");
}

window.modals.compare_prices = () => {
    const materials = calcMaterials();
    const suppliers = state.suppliers;

    if (!suppliers.length) return `<div class="modal-title">Comparativa</div><p>Primero registrá al menos un proveedor.</p>`;
    
    return `
    <div class="modal-title">Comparativa de Precios por Proveedor</div>
    <div class="scroll-area" style="max-height:60vh">
        <table class="tbl sm">
            <thead>
                <tr>
                    <th>Material</th>
                    ${suppliers.map(s => `<th style="text-align:center">${s.name}</th>`).join("")}
                </tr>
            </thead>
            <tbody>
                ${materials.map(m => {
                    const quotes = (state._quotes || []).filter(q => q.materialName === m.name);
                    const minPrice = quotes.length ? Math.min(...quotes.map(q => q.price)) : 0;

                    return `
                        <tr>
                            <td><strong>${m.name}</strong> <small>(${m.unit})</small></td>
                            ${suppliers.map(s => {
                                const q = quotes.find(qt => qt.supplierId == s.id);
                                const isBest = q && q.price === minPrice;
                                return `
                                    <td style="text-align:center">
                                        <input type="number" class="q-input" 
                                               style="width:80px; font-size:0.8rem; text-align:right; ${isBest ? 'border-color:var(--ok); background:var(--matbg)' : ''}" 
                                               placeholder="₲" 
                                               value="${q ? q.price : ''}"
                                               onblur="saveQuote(${s.id}, '${m.name.replace(/'/g, "\\'")}', this.value)">
                                    </td>
                                `;
                            }).join("")}
                        </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
    </div>
    <div class="modal-acts">
        <button class="btn" onclick="closeModal()">Cerrar</button>
    </div>
    `;
};

function saveQuote(supplierId, materialName, price) {
    if (!state._quotes) state._quotes = [];
    const p = parseFloat(price);
    
    // Eliminar anterior si existe
    state._quotes = state._quotes.filter(q => !(q.supplierId == supplierId && q.materialName === materialName));
    
    if (p > 0) {
        state._quotes.push({
            supplierId,
            materialName,
            price: p,
            date: new Date().toLocaleDateString('es-PY')
        });
    }
    
    save();
    // No cerramos el modal para que pueda seguir cargando
    toast("Precio guardado ✓");
}
