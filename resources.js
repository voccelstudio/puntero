/**
 * BIBLIOTECA Y RECURSOS - Puntero ERP
 * Plantillas, historial de precios y herramientas de base de datos.
 */

function renderResources() {
    const el = document.getElementById("section-resources");
    if (!el) return;

    // Historial de precios (usando los datos de state.priceHistory)
    const histHtml = (state.priceHistory || []).map(h => {
        const diff = h.mar26 - h.aug25;
        const pct = Math.round((diff / h.aug25) * 100);
        return `
            <div class="hist-row">
                <div class="hist-name">${h.name}</div>
                <div class="hist-bar-wrap">
                    <div class="hist-bar" style="width: ${Math.min(100, (h.mar26/120000)*100)}%"></div>
                </div>
                <div class="hist-pct ${pct > 0 ? 'up' : 'dn'}">${pct > 0 ? '+' : ''}${pct}%</div>
            </div>
        `;
    }).join("");

    const tmplCards = (window._TEMPLATES || []).map((t, idx) => `
        <div class="tmpl-card" onclick="applyTemplate(${idx})">
            <div class="tmpl-icon">${t.icon}</div>
            <div class="tmpl-name">${t.name}</div>
            <div class="tmpl-desc">${t.desc}</div>
            <div class="tmpl-meta">${t.meta}</div>
        </div>
    `).join("");

    el.innerHTML = `
    <div class="prices-wrap">
        <div class="grid2">
            <div class="card">
                <h3 class="sec-lbl">Historial de Precios de Mercado</h3>
                <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:15px">Comparativa Ago 2025 vs. Mar 2026 en Paraguay.</p>
                <div class="scroll-area">
                    ${histHtml}
                </div>
            </div>
            
            <div class="card">
                <h3 class="sec-lbl">Herramientas de Base de Datos</h3>
                <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:15px">Gestioná tu base de precios personalizada.</p>
                <div style="display:flex; flex-direction:column; gap:10px">
                    <button class="btn full" onclick="exportDB()">📥 Exportar Base de Precios (JSON)</button>
                    <button class="btn full" onclick="importDB()">📤 Importar Base de Precios</button>
                    <button class="btn full danger" onclick="if(confirm('¿Restaurar precios originales? Se perderán tus ediciones.')){DB=buildDB();save();toast('Restaurado');renderResources();}">⚠️ Restaurar Precios de Fábrica</button>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">Plantillas de Obra</h3>
            <p style="font-size:0.85rem; color:var(--tx3); margin-bottom:15px">Cargá conjuntos de rubros predefinidos para acelerar tu presupuesto.</p>
            <div class="tmpl-grid">
                ${tmplCards}
            </div>
        </div>
    </div>
    `;
}

// applyTemplate() e importDB() están definidas en app.js
