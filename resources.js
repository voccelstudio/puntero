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

    // Plantillas de obra
    const TEMPLATES = [
        {
          icon: "🏠", name: "Dúplex Estándar 120m²", desc: "2 plantas, 3 dorm, terminaciones medias. Incluye estructura, mampostería y revoques.", meta: "~₲ 280.000.000", items: [
            ["ESTRUCTURAS", "Hormigón Armado p/ vigas y pilares", 18], ["MAMPOSTERÍA", "Elevación 0.15m ladrillo hueco", 280],
            ["REVOQUES", "Revoque 2 capas (grueso y fino)", 450], ["PISOS", "Piso porcelanato 60x60", 120],
            ["INSTALACIÓN ELÉCTRICA", "Punto de luz completo", 65], ["INSTALACIÓN ELÉCTRICA", "Tomacorriente doble", 40]
          ]
        },
        {
          icon: "🚜", name: "Muralla Perimetral 100m", desc: "Cimiento de piedra, elevación ladrillo común, pilares cada 3m, sin revoque.", meta: "~₲ 45.000.000", items: [
            ["FUNDACIONES", "Cimiento piedra bruta colocada", 35], ["ESTRUCTURAS", "Hormigón Armado p/ encadenado", 8],
            ["MAMPOSTERÍA", "Elevación 0.15m ladrillo común", 250], ["VARIOS", "Limpieza de terreno y nivelación", 1]
          ]
        },
        {
          icon: "🏗️", name: "Ampliación 30m²", desc: "Cimiento, mampostería, techo chapa, revoque, piso calcáreo. Sin instalaciones.", meta: "~₲ 45.000.000", items: [
            ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 4], ["MAMPOSTERÍA", "Elevación 0.15m ladrillo común", 55],
            ["TECHOS", "Chapa Nº28 s/ caños metálicos", 35], ["CONTRAPISOS", "Contrapiso 7cm cascotes", 30],
            ["REVOQUES", "Revoque 1 capa sin hidrófugo", 110], ["PISOS", "Baldosa calcárea 20x20cm", 30],
            ["PINTURAS", "Pintura a la cal", 110],
          ]
        }
    ];
    window._TEMPLATES = TEMPLATES;

    const tmplCards = TEMPLATES.map((t, idx) => `
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

/**
 * LÓGICA DE PLANTILLAS
 */
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
            adenda.items.push({
                cat, name, unit: data.unit,
                unitPrice: data.total,
                matCost: data.matCost,
                laborCost: data.laborCost,
                mats: data.mats || [],
                qty,
                id: Date.now() + Math.random() + added,
                disc: 0, note: ""
            });
            added++;
        }
    }

    proj.m2Area = t.name.includes("60m²") ? 60 : t.name.includes("120m²") ? 120 : t.name.includes("100m²") ? 100 : 30;
    save();
    setSection("budget");
    toast('Plantilla "' + t.name + '" cargada — ' + added + ' ítems ✓');
}

/**
 * IMPORTACIÓN DE DB
 */
function importDB() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const d = JSON.parse(ev.target.result);
                DB = d;
                save();
                toast("Base de datos importada ✓");
                renderResources();
            } catch (err) {
                toast("Error al importar: " + err.message, false);
            }
        };
        reader.readAsText(file);
    };
    inp.click();
}
