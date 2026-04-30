/**
 * RENDIMIENTO Y KPIs - Puntero ERP
 * Indicadores clave de desempeño de la obra.
 */

function renderPerformance() {
    const el = document.getElementById("section-performance");
    if (!el) return;

    const { totalProgress } = calcOverallProgress();
    const { total, totalMats, totalLabor } = getTotals();
    
    const contractorPayments = state.contractors.reduce((s, c) => s + c.payments.reduce((p, py) => p + py.amount, 0), 0);
    const materialOrdersTotal = (state.materialOrders || []).reduce((s, o) => {
        // Estimación rápida de costo de órdenes si no tienen precio individual (usando proporcionalidad del presupuesto)
        return s + (o.status === 'delivered' ? 1 : 0); 
    }, 0);

    // Ejecución Financiera
    const financialExec = total > 0 ? Math.round((contractorPayments / totalLabor) * 100) : 0;
    
    // Índice de Desempeño (SPI aproximado: Progreso Físico / Progreso Tiempo)
    // Asumimos un cronograma lineal para esta versión simplificada
    let timeProgress = 0;
    if (state.projectStartDate) {
        const start = new Date(state.projectStartDate).getTime();
        const now = Date.now();
        const end = Math.max(...Object.values(state.schedules).map(s => new Date(s.end).getTime()), now);
        timeProgress = Math.round(((now - start) / (end - start)) * 100);
        timeProgress = Math.min(100, Math.max(0, timeProgress));
    }

    el.innerHTML = `
    <div class="prices-wrap">
        <h2 class="sec-lbl">Indicadores Clave de Desempeño (KPIs)</h2>

        <div class="grid2">
            <div class="card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px">
                <div style="font-size:0.9rem; color:var(--tx3); text-transform:uppercase; margin-bottom:15px">Salud del Proyecto</div>
                <div class="gauge-container">
                    <div class="gauge-bar" style="transform: rotate(${(totalProgress * 1.8) - 90}deg); background:${totalProgress > timeProgress ? 'var(--ok)' : 'var(--err)'}"></div>
                    <div class="gauge-val">${totalProgress}%</div>
                </div>
                <div style="margin-top:20px; text-align:center">
                    <div style="font-weight:700">${totalProgress >= timeProgress ? 'A TIEMPO / ADELANTADO' : 'RETRASADO'}</div>
                    <div style="font-size:0.8rem; color:var(--tx3)">Comparado con el tiempo transcurrido (${timeProgress}%)</div>
                </div>
            </div>

            <div class="card">
                <h3 class="sec-lbl">Eficiencia de Ejecución</h3>
                
                <div class="stat-row">
                    <div class="stat-lbl">Mano de Obra (Pagado vs Presupuestado)</div>
                    <div class="stat-bar-bg"><div class="stat-bar" style="width:${Math.min(100, financialExec)}%; background:var(--blue)"></div></div>
                    <div class="stat-val">${financialExec}%</div>
                </div>

                <div class="stat-row" style="margin-top:20px">
                    <div class="stat-lbl">Suministros (Órdenes entregadas)</div>
                    <div class="stat-bar-bg">
                        <div class="stat-bar" style="width:${(state.materialOrders || []).length > 0 ? (state.materialOrders.filter(o => o.status === 'delivered').length / state.materialOrders.length * 100) : 0}%; background:var(--ok)"></div>
                    </div>
                    <div class="stat-val">${(state.materialOrders || []).length > 0 ? Math.round(state.materialOrders.filter(o => o.status === 'delivered').length / state.materialOrders.length * 100) : 0}%</div>
                </div>

                <div class="info-box" style="margin-top:25px; background:rgba(96,165,250,0.1)">
                    <p style="font-size:0.85rem"><strong>Tip:</strong> El equilibrio ideal es que el progreso físico (${totalProgress}%) sea ligeramente superior a la ejecución financiera para mantener un flujo de caja saludable.</p>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">Análisis de Desviación</h3>
            <table class="tbl">
                <thead>
                    <tr>
                        <th>Rubro</th>
                        <th>Estado</th>
                        <th>Progreso</th>
                        <th>Alerta</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.items.slice(0, 10).map(i => {
                        const s = state.schedules[i.id] || { status: 'pending' };
                        const statusLabel = s.status === 'done' ? 'Terminado' : s.status === 'progress' ? 'En Curso' : 'Pendiente';
                        const isDelayed = s.status !== 'done' && s.end && new Date(s.end) < new Date();
                        
                        return `
                            <tr>
                                <td>${i.name}</td>
                                <td><span class="iva-badge" style="background:${s.status === 'done' ? 'var(--ok)' : s.status === 'progress' ? 'var(--blue)' : 'var(--sur2)'}; color:${s.status === 'pending' ? 'var(--tx2)' : 'white'}">${statusLabel}</span></td>
                                <td>
                                    <div style="width:100px; height:6px; background:var(--sur2); border-radius:3px; overflow:hidden">
                                        <div style="width:${s.status === 'done' ? 100 : s.status === 'progress' ? 50 : 0}%; height:100%; background:var(--acc)"></div>
                                    </div>
                                </td>
                                <td style="color:var(--err); font-weight:700">${isDelayed ? '⚠ RETRASO' : ''}</td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    </div>

    <style>
        .gauge-container {
            width: 150px;
            height: 75px;
            background: var(--sur2);
            border-radius: 150px 150px 0 0;
            position: relative;
            overflow: hidden;
            border: 2px solid var(--bor);
        }
        .gauge-bar {
            width: 150px;
            height: 150px;
            position: absolute;
            top: 100%;
            left: 0;
            transform-origin: top center;
            transition: transform 1s ease-out;
        }
        .gauge-val {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            text-align: center;
            font-size: 1.5rem;
            font-weight: 800;
            font-family: var(--font-display);
        }
        .stat-row { display: flex; flex-direction: column; gap: 8px; }
        .stat-bar-bg { width: 100%; height: 10px; background: var(--sur2); border-radius: 5px; overflow: hidden; border: 1px solid var(--bor); }
        .stat-bar { height: 100%; transition: width 0.5s ease; }
        .stat-val { font-weight: 700; font-size: 0.9rem; margin-top: 4px; text-align: right; }
    </style>
    `;
}
