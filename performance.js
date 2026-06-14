/**
 * RENDIMIENTO Y KPIs - Puntero ERP
 * Indicadores clave de desempeño de la obra.
 */

function renderPerformance() {
    const el = document.getElementById("section-performance");
    if (!el) return;
    const p = getActiveProject();
    const adenda = getActiveAdenda();
    if (!p || !adenda) { el.innerHTML = "<div class='empty'>Seleccioná un proyecto.</div>"; return; }
    if (!p.execution.schedules) p.execution.schedules = {};

    const { totalProgress } = calcOverallProgress();
    const { totalLabor } = getTotals();
    const orders = p.execution.materialOrders || [];

    // Pagos a contratistas asignados a este proyecto
    const assignedContractorIds = new Set(
        Object.values(p.execution.schedules)
            .map(s => s && s.contractorId)
            .filter(Boolean)
    );
    const contractorPayments = (state.contractors || [])
        .filter(c => assignedContractorIds.has(c.id))
        .reduce((s, c) => s + (c.payments || []).reduce((sp, py) => sp + (py.amount || 0), 0), 0);

    // Ejecución Financiera (pagos vs presupuesto MO)
    const financialExec = totalLabor > 0 ? Math.round((contractorPayments / totalLabor) * 100) : 0;

    // Índice de Desempeño Tiempo (lineal entre fecha inicio y máxima fecha fin)
    let timeProgress = 0;
    const startDateStr = p.execution.projectStartDate;
    if (startDateStr) {
        const start = new Date(startDateStr).getTime();
        const now = Date.now();
        const endTimes = Object.values(p.execution.schedules)
            .map(s => s && s.end ? new Date(s.end).getTime() : 0)
            .filter(t => t > 0);
        const end = endTimes.length ? Math.max(...endTimes, now) : now;
        if (end > start) {
            timeProgress = Math.round(((now - start) / (end - start)) * 100);
            timeProgress = Math.min(100, Math.max(0, timeProgress));
        }
    }

    const ordersDelivered = orders.filter(o => o.status === 'delivered').length;
    const ordersPct = orders.length > 0 ? Math.round(ordersDelivered / orders.length * 100) : 0;

    // Estadísticas de Jornaleros
    const jornaleros = state.jornaleros || [];
    const totalJorActivos = jornaleros.filter(j => j.isActive !== false).length;
    const totalJornadas = jornaleros.reduce((s, j) => s + (j.jornadas || []).length, 0);
    const totalJornalesDevengado = jornaleros.reduce((s, j) => s + (j.jornadas || []).reduce((ss, jd) => ss + (jd.monto || 0), 0), 0);

    el.innerHTML = `
    <div class="prices-wrap">
        <h2 class="sec-lbl">Indicadores Clave de Desempeño (KPIs)</h2>

        <div class="grid2">
            <div class="card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px">
                <div style="font-size:0.9rem; color:var(--tx3); text-transform:uppercase; margin-bottom:15px">Salud del Proyecto</div>
                <div class="gauge-container">
                    <div class="gauge-bar" style="transform: rotate(${(totalProgress * 1.8) - 90}deg); background:${totalProgress >= timeProgress ? 'var(--ok)' : 'var(--err)'}"></div>
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
                        <div class="stat-bar" style="width:${ordersPct}%; background:var(--ok)"></div>
                    </div>
                    <div class="stat-val">${ordersPct}%</div>
                </div>

                <div class="info-box" style="margin-top:25px; background:rgba(96,165,250,0.1)">
                    <p style="font-size:0.85rem"><strong>Tip:</strong> El equilibrio ideal es que el progreso físico (${totalProgress}%) sea ligeramente superior a la ejecución financiera para mantener un flujo de caja saludable.</p>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <h3 class="sec-lbl">👷 Mano de Obra - Jornaleros</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-top:12px">
                <div style="background:var(--sur2); padding:14px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.3rem; font-weight:800; color:var(--acc)">${totalJorActivos}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Jornaleros Activos</div>
                </div>
                <div style="background:var(--sur2); padding:14px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.3rem; font-weight:800; color:var(--acc)">${totalJornadas}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Jornadas Registradas</div>
                </div>
                <div style="background:var(--sur2); padding:14px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.1rem; font-weight:800; color:var(--err)">${fmt(totalJornalesDevengado)}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Total Devengado</div>
                </div>
                <div style="background:var(--sur2); padding:14px; border-radius:var(--rad); text-align:center">
                    <div style="font-size:1.1rem; font-weight:800">${totalJornadas > 0 ? fmt(Math.round(totalJornalesDevengado / totalJornadas)) : '—'}</div>
                    <div style="font-size:0.7rem; color:var(--tx3)">Promedio por Jornada</div>
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
                    ${adenda.items.slice(0, 10).map(i => {
                        const s = p.execution.schedules[i.id] || { status: 'pending' };
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
                    }).join("") || '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--tx3)">Sin ítems para analizar.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <style>
        .gauge-container { width: 150px; height: 75px; background: var(--sur2); border-radius: 150px 150px 0 0; position: relative; overflow: hidden; border: 2px solid var(--bor); }
        .gauge-bar { width: 150px; height: 150px; position: absolute; top: 100%; left: 0; transform-origin: top center; transition: transform 1s ease-out; }
        .gauge-val { position: absolute; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 1.5rem; font-weight: 800; font-family: var(--font-display); }
        .stat-row { display: flex; flex-direction: column; gap: 8px; }
        .stat-bar-bg { width: 100%; height: 10px; background: var(--sur2); border-radius: 5px; overflow: hidden; border: 1px solid var(--bor); }
        .stat-bar { height: 100%; transition: width 0.5s ease; }
        .stat-val { font-weight: 700; font-size: 0.9rem; margin-top: 4px; text-align: right; }
    </style>
    `;
}
