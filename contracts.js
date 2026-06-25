/**
 * contracts.js — Contratos Legales (Ley Paraguaya)
 * Contratos para Clientes y Contratistas con generación de PDF
 */

const CLAUSULAS_PREDEFINIDAS = {
  client: [
    { id: 'objeto', titulo: 'OBJETO DEL CONTRATO', texto: 'El CONTRATANTE contrata los servicios profesionales del CONTRATISTA para la ejecución de la obra de construcción descrita en el presupuesto adjunto, el cual forma parte integrante del presente contrato como Anexo I. El CONTRATISTA se obliga a realizar la obra conforme a los planos, especificaciones técnicas y memoria descriptiva, utilizando materiales de primera calidad y mano de obra especializada, todo de acuerdo a las reglas del arte de la construcción.' },
    { id: 'precio', titulo: 'PRECIO Y FORMA DE PAGO', texto: 'El precio total convenido para la ejecución de la obra es de {total} (en letras: {totalLetras}), a pagarse de la siguiente manera:\n- Anticipo del {anticipo}% al momento de la firma del presente contrato, equivalente a {anticipoMonto}.\n- El saldo restante se cancelará conforme al siguiente cronograma de pagos: {cronograma}.\nLos pagos se realizarán en efectivo, transferencia bancaria o cheque, contra presentación de factura o recibo correspondiente.' },
    { id: 'plazo', titulo: 'PLAZO DE EJECUCIÓN', texto: 'El plazo de ejecución de la obra es de {plazo} días corridos, contados a partir de la fecha de inicio establecida en la cláusula siguiente. El CONTRATISTA se compromete a entregar la obra en el plazo estipulado, sujeto a las condiciones climáticas adversas y a la disponibilidad de materiales en el mercado, las cuales serán consideradas como fuerza mayor.' },
    { id: 'inicio', titulo: 'FECHA DE INICIO Y FINALIZACIÓN', texto: 'La obra dará inicio el día {inicio} y deberá encontrarse finalizada y recibida conforme a satisfacción del CONTRATANTE el día {fin}. Ambas partes acuerdan que los plazos podrán ser modificados de común acuerdo mediante la suscripción de un adenda.' },
    { id: 'obligaciones_cliente', titulo: 'OBLIGACIONES DEL CONTRATANTE', texto: 'El CONTRATANTE se obliga a:\na) Proveer el acceso al inmueble ubicado en {direccion} en el horario acordado.\nb) Realizar los pagos en las fechas estipuladas en la cláusula de PRECIO Y FORMA DE PAGO.\nc) Proveer los servicios básicos (agua y energía eléctrica) necesarios para la ejecución de la obra.\nd) Designar un representante o responsable para la toma de decisiones durante la obra.\ne) Recibir la obra y suscribir el acta de recepción correspondiente.' },
    { id: 'obligaciones_contratista', titulo: 'OBLIGACIONES DEL CONTRATISTA', texto: 'El CONTRATISTA se obliga a:\na) Ejecutar la obra de acuerdo a las especificaciones técnicas, planos y cronograma aprobados.\nb) Utilizar materiales de primera calidad y mano de obra calificada.\nc) Mantener la obra en condiciones de orden, higiene y seguridad.\nd) Cumplir con las disposiciones del Ministerio de Trabajo y del Instituto de Previsión Social (IPS).\ne) Responder por los vicios ocultos y defectos de construcción conforme al Código Civil Paraguayo.\nf) Entregar la obra libre de todo gravamen y en perfectas condiciones de funcionamiento.' },
    { id: 'responsabilidad', titulo: 'RESPONSABILIDAD Y GARANTÍA', texto: 'El CONTRATISTA garantiza la obra por el término de (1) año a partir de la fecha de recepción definitiva, contra defectos de construcción, vicios ocultos y fallas estructurales, de conformidad con lo dispuesto en los Artículos 1025 y siguientes del Código Civil Paraguayo (Ley N° 1183/85). Durante este período, el CONTRATISTA se obliga a realizar las reparaciones necesarias sin costo adicional para el CONTRATANTE.' },
    { id: 'mora', titulo: 'MULTA POR MORA', texto: 'En caso de retraso en la entrega de la obra imputable al CONTRATISTA, éste abonará al CONTRATANTE una multa diaria equivalente al 0,1% (cero coma uno por ciento) del valor total del contrato, hasta un máximo del 10% (diez por ciento) del mismo. Esta cláusula no será aplicable en casos de fuerza mayor o caso fortuito debidamente comprobados.' },
    { id: 'rescision', titulo: 'RESCISIÓN DEL CONTRATO', texto: 'Cualquiera de las partes podrá rescindir el presente contrato en caso de incumplimiento grave de las obligaciones asumidas por la otra parte, previa comunicación fehaciente con 15 (quince) días de antelación. En caso de rescisión imputable al CONTRATISTA, éste deberá restituir los montos percibidos no ejecutados. En caso de rescisión imputable al CONTRATANTE, éste abonará los trabajos efectivamente realizados.' },
    { id: 'domicilio', titulo: 'DOMICILIO Y COMPETENCIA', texto: 'Las partes constituyen domicilio en las direcciones indicadas al pie del presente contrato, y se someten a la competencia de los Tribunales Ordinarios de la Ciudad de San Lorenzo, Departamento Central, República del Paraguay, renunciando expresamente a cualquier otro fuero o jurisdicción que pudiera corresponderles.' }
  ],
  contractor: [
    { id: 'objeto', titulo: 'OBJETO DEL CONTRATO', texto: 'El CONTRATANTE contrata al CONTRATISTA para la ejecución de los trabajos de {especialidad} correspondientes al proyecto de construcción sito en {direccion}. El CONTRATISTA se obliga a realizar las tareas descritas en el Anexo I del presente contrato, con estricta sujeción a las especificaciones técnicas, planos y directrices del CONTRATANTE o su representante técnico.' },
    { id: 'precio', titulo: 'PRECIO Y FORMA DE PAGO', texto: 'El precio convenido por la totalidad de los trabajos es de {total} (en letras: {totalLetras}), que será abonado por el CONTRATANTE al CONTRATISTA de la siguiente forma:\n- Anticipo del {anticipo}% a la firma: {anticipoMonto}.\n- Pagos parciales contra certificación de avance de obra.\n- Saldo final contra la recepción conforme de los trabajos.\nEl CONTRATISTA se obliga a emitir factura o recibo por cada pago recibido.' },
    { id: 'plazo', titulo: 'PLAZO DE EJECUCIÓN', texto: 'El plazo para la ejecución de los trabajos contratados es de {plazo} días corridos, contados a partir de la fecha de inicio establecida. El CONTRATISTA se compromete a cumplir con el cronograma de obra establecido por el CONTRATANTE.' },
    { id: 'obligaciones', titulo: 'OBLIGACIONES DEL CONTRATISTA', texto: 'El CONTRATISTA se obliga a:\na) Ejecutar los trabajos con diligencia y conforme a las reglas del arte.\nb) Proveer las herramientas y equipos necesarios para la ejecución de los trabajos.\nc) Registrar a su personal en el IPS y cumplir con las obligaciones laborales y previsionales.\nd) Mantener un seguro de accidentes personales para su personal.\ne) Responsabilizarse por los daños o perjuicios causados a terceros durante la ejecución de los trabajos.\nf) Mantener el orden y la limpieza en el frente de trabajo.' },
    { id: 'pagos', titulo: 'CONDICIONES DE PAGO', texto: 'Los pagos se realizarán contra presentación de certificado de obra o informe de avance aprobado por el CONTRATANTE o su representante técnico. El CONTRATANTE se reserva el derecho de retener el 10% (diez por ciento) del valor de cada certificado como garantía, que será liberada contra la recepción definitiva de los trabajos.' },
    { id: 'mora', titulo: 'MULTA POR INCUMPLIMIENTO', texto: 'En caso de incumplimiento del plazo de ejecución por causas imputables al CONTRATISTA, éste abonará una penalidad del 0,1% (cero coma uno por ciento) del valor del contrato por cada día de retraso, hasta un máximo del 10% (diez por ciento) del total. El CONTRATANTE podrá descontar dicha multa de los pagos pendientes.' },
    { id: 'rescision', titulo: 'RESCISIÓN', texto: 'El CONTRATANTE podrá rescindir el contrato sin responsabilidad alguna si el CONTRATISTA incurriere en mora superior a 15 (quince) días, si ejecutare los trabajos en forma defectuosa, o si no diere cumplimiento a las disposiciones de seguridad e higiene. En tales casos, el CONTRATANTE podrá contratar a un tercero para finalizar los trabajos por cuenta y riesgo del CONTRATISTA.' }
  ]
};

function renderContratos() {
  const el = document.getElementById("section-contratos");
  if (!el) return;
  if (!state.contratos) state.contratos = [];
  const p = getActiveProject();

  let h = `<div class="prices-wrap">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px">
      <div>
        <h2 style="font-family:var(--font-display); font-weight:800; margin-bottom:4px">CONTRATOS</h2>
        <p style="color:var(--tx3); font-size:0.9rem">Documentos legales · Lenguaje jurídico paraguayo</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="btn sm" onclick="showExportContratos()">📥 Exportar Todos</button>
        <button class="btn primary" onclick="showNewContratoModal()">+ Nuevo Contrato</button>
      </div>
    </div>`;

  // Resumen
  const totalContratos = state.contratos.length;
  const signedCount = state.contratos.filter(c => c.status === 'signed').length;
  const draftCount = state.contratos.filter(c => c.status === 'draft').length;
  const clientCount = state.contratos.filter(c => c.tipo === 'cliente').length;
  const contractorCount = state.contratos.filter(c => c.tipo === 'contratista').length;

  h += `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; margin-bottom:18px">
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem">${totalContratos}</div><div class="dash-lbl">Total Contratos</div></div>
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem; color:var(--ok)">${signedCount}</div><div class="dash-lbl">Firmados</div></div>
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem; color:var(--blue)">${draftCount}</div><div class="dash-lbl">Borradores</div></div>
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem">${clientCount}</div><div class="dash-lbl">De Cliente</div></div>
    <div class="dash-card" style="padding:12px"><div class="dash-num" style="font-size:1.2rem">${contractorCount}</div><div class="dash-lbl">De Contratista</div></div>
  </div>`;

  // Filtros
  const filterTipo = document.getElementById("ctr-filter-tipo")?.value || "all";
  const filterStatus = document.getElementById("ctr-filter-status")?.value || "all";

  h += `<div class="card" style="margin-bottom:18px; padding:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap">
    <span style="font-size:0.85rem; font-weight:700; color:var(--tx3)">Filtros:</span>
    <select id="ctr-filter-tipo" style="width:140px;font-size:0.85rem" onchange="renderContratos()">
      <option value="all">Todos los tipos</option>
      <option value="cliente">Contrato con Cliente</option>
      <option value="contratista">Contrato con Contratista</option>
    </select>
    <select id="ctr-filter-status" style="width:130px;font-size:0.85rem" onchange="renderContratos()">
      <option value="all">Todos los estados</option>
      <option value="draft">Borrador</option>
      <option value="signed">Firmado</option>
    </select>
  </div>`;

  const filtered = state.contratos.filter(c => {
    if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

  h += `<div class="con-grid">`;
  filtered.forEach(c => {
    const tipoLabel = c.tipo === 'cliente' ? 'Cliente' : 'Contratista';
    const statusLabel = c.status === 'signed' ? 'FIRMADO' : 'BORRADOR';
    const statusColor = c.status === 'signed' ? 'var(--ok)' : 'var(--blue)';
    const parteContraria = c.tipo === 'cliente' ? escapeHtml(c.clienteNombre || '—') : escapeHtml(c.contratistaNombre || '—');
    const proyectoNombre = c.projectId ? ((state.projects || []).find(pr => pr.id === c.projectId)?.name || '—') : '—';

    h += `<div class="con-card" style="border-left:4px solid ${statusColor}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start">
        <div>
          <div class="con-name">${escapeHtml(c.titulo || 'Contrato')}</div>
          <div class="con-meta">
            <span>📋 ${tipoLabel}</span>
            <span>🏢 ${proyectoNombre}</span>
            <span>👤 ${parteContraria}</span>
          </div>
        </div>
        <span class="iva-badge" style="background:${statusColor}; color:white">${statusLabel}</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--bor)">
        <div class="stat-box"><div class="stat-lbl">Monto</div><div class="stat-val">${fmt(c.monto || 0)}</div></div>
        <div class="stat-box"><div class="stat-lbl">Fecha Firma</div><div class="stat-val">${formatDatePY(c.fechaFirma) || '—'}</div></div>
      </div>
      <div style="margin-top:14px; display:flex; gap:6px; flex-wrap:wrap">
        <button class="btn sm" style="flex:1; background:rgba(var(--acc-rgb),0.1); border-color:rgba(var(--acc-rgb),0.3)" onclick="showEditContratoModal('${c.id}')">✏️ Editar</button>
        <button class="btn sm" style="flex:1" onclick="previewContrato('${c.id}')">👁️ Previsualizar</button>
        <button class="btn sm" style="flex:1" onclick="generarPDFContrato('${c.id}')">📄 PDF</button>
        <button class="btn sm danger" onclick="deleteContrato('${c.id}')">✕</button>
      </div>
    </div>`;
  });

  h += filtered.length === 0 ? `<div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--sur); border-radius:var(--rad); border:1px dashed var(--bor)"><p style="color:var(--tx3)">Sin contratos aún. <button class="btn sm primary" onclick="showNewContratoModal()">+ Crear primero</button></p></div>` : '';
  h += `</div></div>`;
  el.innerHTML = h;
}

function showNewContratoModal() {
  const el = document.getElementById("modal-area");
  const p = getActiveProject();
  const projects = (state.projects || []).map(pr => `<option value="${pr.id}">${escapeHtml(pr.name)}</option>`).join("");
  const contractors = (state.contractors || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px">
    <div class="modal-title">Nuevo Contrato<button class="delbtn" onclick="closeModal()">✕</button></div>
    <div style="display:flex; flex-direction:column; gap:10px">
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Tipo de Contrato</label>
      <select id="ctr-tipo">
        <option value="">Seleccionar...</option>
        <option value="cliente">Contrato con Cliente (Obra Completa)</option>
        <option value="contratista">Contrato con Contratista (Subcontrato)</option>
      </select>
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Título del Contrato</label>
      <input id="ctr-titulo" placeholder="Ej: Contrato de Construcción de Vivienda" value="Contrato de Construcción">
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Proyecto Asociado</label>
      <select id="ctr-project">${projects}</select>
      <div id="ctr-cliente-fields">
        <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Nombre del Cliente</label>
        <input id="ctr-cliente-nombre" placeholder="Nombre y apellido del cliente" value="${p ? escapeHtml(p.client) : ''}">
      </div>
      <div id="ctr-contratista-fields" style="display:none">
        <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Contratista</label>
        <select id="ctr-contratista-id">${contractors}</select>
      </div>
      <div class="two-col">
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Monto Total (₲)</label>
          <input id="ctr-monto" type="number" value="${p ? getTotals().total : 0}">
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Anticipo (%)</label>
          <input id="ctr-anticipo" type="number" value="30" min="0" max="100">
        </div>
      </div>
      <div class="two-col">
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Fecha de Firma</label>
          ${dateInputPY('ctr-fecha-firma', todayISO(), '', 'width:100%')}
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Duración (días)</label>
          <input id="ctr-plazo" type="number" value="120">
        </div>
      </div>
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Cronograma de Pagos</label>
      <textarea id="ctr-cronograma" rows="2" placeholder="Ej: 30% inicio, 30% a los 30 días, 40% al final">30% a la firma, 30% al 50% de avance, 40% a la recepción de obra</textarea>
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Cláusulas adicionales (opcional)</label>
      <textarea id="ctr-clausulas" rows="3" placeholder="Cualquier cláusula especial que quieras agregar..."></textarea>
    </div>
    <div class="modal-acts">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="saveNewContrato()">Crear Contrato 📄</button>
    </div>
  </div></div>`;

  // Toggle campos según tipo
  document.getElementById("ctr-tipo").onchange = function() {
    const isCliente = this.value === 'cliente';
    document.getElementById("ctr-cliente-fields").style.display = isCliente ? '' : 'none';
    document.getElementById("ctr-contratista-fields").style.display = this.value === 'contratista' ? '' : 'none';
    document.getElementById("ctr-titulo").value = isCliente ? 'Contrato de Construcción de Vivienda' : 'Contrato de Prestación de Servicios';
  };
}

function saveNewContrato() {
  const tipo = document.getElementById("ctr-tipo").value;
  if (!tipo) return toast("Seleccioná el tipo de contrato", false);
  const titulo = document.getElementById("ctr-titulo").value.trim();
  if (!titulo) return toast("El título es requerido", false);
  const projectId = document.getElementById("ctr-project").value;
  const monto = parseFloat(document.getElementById("ctr-monto").value) || 0;
  const anticipoPct = parseFloat(document.getElementById("ctr-anticipo").value) || 0;
  const fechaFirma = document.getElementById("ctr-fecha-firma").value;
  const plazo = parseInt(document.getElementById("ctr-plazo").value) || 120;
  const cronograma = document.getElementById("ctr-cronograma").value;

  const contrato = {
    id: 'ctr_' + Date.now(),
    tipo,
    titulo,
    projectId: projectId || null,
    monto,
    anticipoPct,
    anticipoMonto: monto * anticipoPct / 100,
    fechaFirma,
    inicio: fechaFirma,
    fin: addDays(fechaFirma, plazo),
    plazo,
    cronograma,
    clausulasCustom: document.getElementById("ctr-clausulas").value.trim(),
    status: 'draft',
    createdAt: new Date().toISOString()
  };

  if (tipo === 'cliente') {
    contrato.clienteNombre = document.getElementById("ctr-cliente-nombre").value.trim();
    if (!contrato.clienteNombre) return toast("Nombre del cliente requerido", false);
  } else {
    const conId = document.getElementById("ctr-contratista-id").value;
    const con = state.contractors.find(c => c.id === conId);
    contrato.contratistaId = conId;
    contrato.contratistaNombre = con ? con.name : '';
    if (!conId) return toast("Seleccioná un contratista", false);
  }

  if (!state.contratos) state.contratos = [];
  state.contratos.push(contrato);
  save(); closeModal(); renderContratos();
  toast("Contrato creado ✓");
}

function showEditContratoModal(id) {
  const c = state.contratos.find(x => x.id === id);
  if (!c) return;
  const el = document.getElementById("modal-area");
  const projects = (state.projects || []).map(pr => `<option value="${pr.id}"${pr.id === c.projectId ? ' selected' : ''}>${escapeHtml(pr.name)}</option>`).join("");
  const contractors = (state.contractors || []).map(con => `<option value="${con.id}"${con.id === c.contratistaId ? ' selected' : ''}>${escapeHtml(con.name)}</option>`).join("");

  el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:550px; max-height:90vh; overflow-y:auto">
    <div class="modal-title">Editar Contrato<button class="delbtn" onclick="closeModal()">✕</button></div>
    <div style="display:flex; flex-direction:column; gap:10px">
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Título</label>
      <input id="ctr-titulo" value="${escapeHtml(c.titulo)}">
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Proyecto</label>
      <select id="ctr-project">${projects}</select>
      ${c.tipo === 'cliente' ? `
        <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Cliente</label>
        <input id="ctr-cliente-nombre" value="${escapeHtml(c.clienteNombre || '')}">
      ` : `
        <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Contratista</label>
        <select id="ctr-contratista-id">${contractors}</select>
      `}
      <div class="two-col">
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Monto (₲)</label>
          <input id="ctr-monto" type="number" value="${c.monto || 0}">
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Anticipo %</label>
          <input id="ctr-anticipo" type="number" value="${c.anticipoPct || 0}">
        </div>
      </div>
      <div class="two-col">
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Fecha Firma</label>
          ${dateInputPY('ctr-fecha-firma', c.fechaFirma || '', '', 'width:100%')}
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Plazo (días)</label>
          <input id="ctr-plazo" type="number" value="${c.plazo || 120}">
        </div>
      </div>
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Cronograma de Pagos</label>
      <textarea id="ctr-cronograma" rows="2">${escapeHtml(c.cronograma || '')}</textarea>
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Cláusulas adicionales</label>
      <textarea id="ctr-clausulas" rows="3">${escapeHtml(c.clausulasCustom || '')}</textarea>
      <label style="font-weight:600; font-size:0.85rem; color:var(--tx3)">Estado</label>
      <select id="ctr-status">
        <option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Borrador</option>
        <option value="signed" ${c.status === 'signed' ? 'selected' : ''}>Firmado</option>
      </select>
    </div>
    <div class="modal-acts">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="saveEditContrato('${id}')">Guardar Cambios</button>
    </div>
  </div></div>`;
}

function saveEditContrato(id) {
  const c = state.contratos.find(x => x.id === id);
  if (!c) return;
  c.titulo = document.getElementById("ctr-titulo").value.trim();
  c.projectId = document.getElementById("ctr-project").value;
  c.monto = parseFloat(document.getElementById("ctr-monto").value) || 0;
  c.anticipoPct = parseFloat(document.getElementById("ctr-anticipo").value) || 0;
  c.anticipoMonto = c.monto * c.anticipoPct / 100;
  c.fechaFirma = document.getElementById("ctr-fecha-firma").value;
  c.plazo = parseInt(document.getElementById("ctr-plazo").value) || 120;
  c.cronograma = document.getElementById("ctr-cronograma").value;
  c.clausulasCustom = document.getElementById("ctr-clausulas").value.trim();
  c.status = document.getElementById("ctr-status").value;
  if (c.tipo === 'cliente') {
    c.clienteNombre = document.getElementById("ctr-cliente-nombre").value.trim();
  } else {
    const conId = document.getElementById("ctr-contratista-id").value;
    const con = state.contractors.find(ct => ct.id === conId);
    c.contratistaId = conId;
    c.contratistaNombre = con ? con.name : '';
  }
  save(); closeModal(); renderContratos();
  toast("Contrato actualizado ✓");
}

function deleteContrato(id) {
  if (!confirm("¿Eliminar este contrato definitivamente?")) return;
  state.contratos = state.contratos.filter(c => c.id !== id);
  save(); renderContratos();
}

function showExportContratos() {
  const el = document.getElementById("modal-area");
  const stateCount = state.contratos ? state.contratos.length : 0;
  el.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px">
    <div class="modal-title">Exportar Contratos<button class="delbtn" onclick="closeModal()">✕</button></div>
    <p style="font-size:0.9rem; color:var(--tx3); margin-bottom:14px">Se exportarán ${stateCount} contratos en formato PDF para impresión y firma física.</p>
    <div style="display:flex; flex-direction:column; gap:10px">
      <button class="btn primary full" onclick="closeModal(); exportContratosBulk()">📄 Exportar Todos como PDF</button>
    </div>
  </div></div>`;
}

function exportContratosBulk() {
  if (!state.contratos || state.contratos.length === 0) return toast("Sin contratos para exportar", false);
  (state.contratos || []).forEach((c, i) => {
    setTimeout(() => generarPDFContrato(c.id), i * 500);
  });
  toast("Generando " + state.contratos.length + " PDFs...");
}

// ── HELPER ─────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function numeroALetras(num) {
  if (!num || isNaN(num)) return 'CERO';
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
  const decenas = ['', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  let entero = Math.floor(num);
  let resultado = '';

  if (entero === 0) return 'CERO';

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;

  if (millones > 0) {
    resultado += (millones === 1 ? 'UN MILLÓN' : numeroALetras(millones) + ' MILLONES') + ' ';
  }
  if (miles > 0) {
    resultado += (miles === 1 ? 'MIL' : numeroALetras(miles) + ' MIL') + ' ';
  }
  if (resto > 0) {
    if (resto === 100) resultado += 'CIEN ';
    else {
      const c = Math.floor(resto / 100);
      const d = Math.floor((resto % 100) / 10);
      const u = resto % 10;
      if (c > 0) resultado += centenas[c] + ' ';
      if (d > 0) {
        if (d === 1) resultado += unidades[10 + u] + ' ';
        else if (d === 2 && u > 0) resultado += 'VEINTI' + unidades[u].toLowerCase() + ' ';
        else {
          resultado += decenas[d] + (u > 0 ? ' Y ' : ' ');
          if (u > 0) resultado += unidades[u] + ' ';
        }
      } else if (u > 0) resultado += unidades[u] + ' ';
    }
  }
  return resultado.trim() + ' GUARANÍES';
}

// ── PREVISUALIZACIÓN ──────────────────────────────────────────────────
function previewContrato(id) {
  const c = state.contratos.find(x => x.id === id);
  if (!c) return;
  const proj = c.projectId ? (state.projects || []).find(p => p.id === c.projectId) : null;
  const profile = state.profile || {};
  const clausulas = c.tipo === 'cliente' ? CLAUSULAS_PREDEFINIDAS.client : CLAUSULAS_PREDEFINIDAS.contractor;
  const montoLetras = numeroALetras(c.monto || 0);
  const direccion = proj ? (proj.address || proj.location?.address || '—') : '—';
  const inicioFmt = formatDatePY(c.fechaFirma);
  const finFmt = formatDatePY(c.fin);
  const especialidad = c.tipo === 'contratista' ? (state.contractors.find(con => con.id === c.contratistaId)?.specialty || 'construcción') : 'construcción';

  const hoy = new Date();
  const fechaHoy = hoy.getDate() + " de " + ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][hoy.getMonth()] + " de " + hoy.getFullYear();

  let html = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:700px; max-height:90vh; overflow-y:auto">
    <div class="modal-title">Vista Previa: ${escapeHtml(c.titulo)}<button class="delbtn" onclick="closeModal()">✕</button></div>
    <div style="background:white; color:#1e293b; padding:30px 25px; font-family:serif; line-height:1.6; border-radius:var(--rad)">
      <div style="text-align:center; margin-bottom:20px">
        <div style="font-size:16px; font-weight:bold; color:#0f3478">CONTRATO DE ${c.tipo === 'cliente' ? 'CONSTRUCCIÓN' : 'PRESTACIÓN DE SERVICIOS'}</div>
        <div style="font-size:11px; color:#666; margin-top:4px">Código: ${c.id} | Fecha: ${fechaHoy}</div>
        <hr style="margin:12px 0; border:none; border-top:2px solid #0f3478">
      </div>

      <div style="font-size:12px; text-align:justify">
        <p><strong>COMPARECENCIA</strong></p>
        <p>Comparecen, por una parte, <strong>${escapeHtml(profile.professional || 'El Profesional')}</strong>, con registro ${profile.matricula || '—'}, en adelante denominado <strong>"EL CONTRATANTE"</strong>, y por otra parte, <strong>${c.tipo === 'cliente' ? escapeHtml(c.clienteNombre || 'El Cliente') : escapeHtml(c.contratistaNombre || 'El Contratista')}</strong>, en adelante denominado <strong>"${c.tipo === 'cliente' ? 'EL COMITENTE' : 'EL CONTRATISTA'}"</strong>. Ambas partes, capaces para contratar y obligarse, convienen en celebrar el presente contrato sujeto a las siguientes cláusulas:</p>
        <hr style="margin:10px 0; border:none; border-top:1px solid #ccc">
      </div>`;

  clausulas.forEach((cla, idx) => {
    let texto = cla.texto
      .replace('{total}', fmt(c.monto || 0))
      .replace('{totalLetras}', montoLetras)
      .replace('{anticipo}', c.anticipoPct)
      .replace('{anticipoMonto}', fmt(c.anticipoMonto || 0))
      .replace('{plazo}', c.plazo || 120)
      .replace('{inicio}', inicioFmt)
      .replace('{fin}', finFmt)
      .replace('{direccion}', direccion)
      .replace('{cronograma}', c.cronograma || '—')
      .replace('{especialidad}', especialidad);

    html += `<div style="font-size:12px; text-align:justify; margin-top:10px">
      <p><strong>CLÁUSULA ${idx + 1}: ${cla.titulo}</strong></p>
      <p>${texto}</p>
    </div>`;
  });

  if (c.clausulasCustom) {
    html += `<hr style="margin:10px 0; border:none; border-top:1px solid #ccc">
      <div style="font-size:12px; text-align:justify">
        <p><strong>CLÁUSULAS ADICIONALES</strong></p>
        <p>${escapeHtml(c.clausulasCustom)}</p>
      </div>`;
  }

  html += `<hr style="margin:10px 0; border:none; border-top:2px solid #0f3478">
    <div style="font-size:11px">
      <p><strong>DATOS DE LAS PARTES</strong></p>
      <p><strong>CONTRATANTE:</strong> ${escapeHtml(profile.professional || '—')} | RUC: ${profile.ruc || '—'} | Tel: ${profile.phone || '—'}</p>
      <p><strong>${c.tipo === 'cliente' ? 'COMITENTE' : 'CONTRATISTA'}:</strong> ${c.tipo === 'cliente' ? escapeHtml(c.clienteNombre || '—') : escapeHtml(c.contratistaNombre || '—')}</p>
      <p><strong>PROYECTO:</strong> ${proj ? escapeHtml(proj.name) : '—'} | Dirección: ${direccion}</p>
    </div>

    <hr style="margin:10px 0; border:none; border-top:2px solid #0f3478">
    <div style="font-size:12px; margin-top:20px; text-align:center">
      <p><strong>FIRMAS</strong></p>
      <p style="font-size:10px; color:#666">En señal de conformidad, en la ciudad de San Lorenzo, a los ${fechaHoy}.</p>
      <div style="display:flex; justify-content:space-between; margin-top:30px; padding:0 20px">
        <div style="text-align:center">
          <div style="border-top:1px solid #333; width:200px; padding-top:4px">${escapeHtml(profile.professional || 'CONTRATANTE')}</div>
          <div style="font-size:9px; color:#666">Firma y aclaración</div>
        </div>
        <div style="text-align:center">
          <div style="border-top:1px solid #333; width:200px; padding-top:4px">${c.tipo === 'cliente' ? escapeHtml(c.clienteNombre || 'COMITENTE') : escapeHtml(c.contratistaNombre || 'CONTRATISTA')}</div>
          <div style="font-size:9px; color:#666">Firma y aclaración</div>
        </div>
      </div>
      <div style="text-align:center; margin-top:25px">
        <div style="border-top:1px solid #333; width:200px; padding-top:4px; margin:0 auto">TESTIGO</div>
        <div style="font-size:9px; color:#666">Firma y aclaración</div>
      </div>
    </div>
    </div>
    <div class="modal-acts" style="margin-top:15px">
      <button class="btn" onclick="closeModal()">Cerrar</button>
      <button class="btn primary" onclick="closeModal(); generarPDFContrato('${c.id}')">📄 Generar PDF</button>
    </div>
  </div></div>`;

  document.getElementById("modal-area").innerHTML = html;
}

// ── GENERAR PDF ──────────────────────────────────────────────────────
function generarPDFContrato(id) {
  const c = state.contratos.find(x => x.id === id);
  if (!c) return toast("Contrato no encontrado", false);

  const proj = c.projectId ? (state.projects || []).find(p => p.id === c.projectId) : null;
  const profile = state.profile || {};
  const clausulas = c.tipo === 'cliente' ? CLAUSULAS_PREDEFINIDAS.client : CLAUSULAS_PREDEFINIDAS.contractor;
  const montoLetras = numeroALetras(c.monto || 0);
  const direccion = proj ? (proj.address || proj.location?.address || '—') : '—';
  const inicioFmt = formatDatePY(c.fechaFirma);
  const finFmt = formatDatePY(c.fin);
  const anticipoMontoLetras = numeroALetras(c.anticipoMonto || 0);
  const especialidad = c.tipo === 'contratista' ? (state.contractors.find(con => con.id === c.contratistaId)?.specialty || 'construcción') : 'construcción';

  const hoy = new Date();
  const ciudad = "San Lorenzo";
  const fechaHoy = hoy.getDate() + " de " + ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][hoy.getMonth()] + " de " + hoy.getFullYear();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'A4');
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;
  let pageNum = 1;
  const lineH = 5;

  function addFooter() {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Puntero — Gestión de Obra | Contrato generado el ' + fechaHoy + ' | Pág. ' + pageNum, margin, 292);
  }

  function checkPage() {
    if (y > 260) {
      addFooter();
      doc.addPage();
      pageNum++;
      y = margin;
    }
  }

  function addLine(text, opts) {
    opts = opts || {};
    const fontSize = opts.size || 10;
    const bold = opts.bold || false;
    const align = opts.align || 'left';
    const color = opts.color || [30, 30, 30];
    const indent = opts.indent || 0;
    const gap = opts.gap !== undefined ? opts.gap : 2;

    checkPage();
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    if (bold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(text, contentW - indent);
    lines.forEach(l => {
      checkPage();
      doc.text(l, margin + indent, y);
      y += lineH * (fontSize / 10);
    });
    y += gap;
    doc.setFont('helvetica', 'normal');
  }

  function addSeparator() {
    checkPage();
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  }

  // ── ENCABEZADO ──────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 55, 120);
  doc.text('CONTRATO DE ' + (c.tipo === 'cliente' ? 'CONSTRUCCIÓN' : 'PRESTACIÓN DE SERVICIOS'), margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('Código: ' + c.id + ' | Fecha: ' + fechaHoy, margin, y);
  y += 3;
  doc.text('Versión para impresión y firma física', margin, y);
  y += 10;

  addSeparator();

  // ── COMPARECENCIA ─────────────────────────────────────────────
  addLine('COMPARECENCIA', { size: 13, bold: true, color: [15, 55, 120], gap: 4 });
  const comparece = `Comparecen, por una parte, ${escapeHtml(profile.professional || 'El Profesional')}, con registro ${profile.matricula || '—'}, en adelante denominado "EL CONTRATANTE", y por otra parte, ${c.tipo === 'cliente' ? escapeHtml(c.clienteNombre || 'El Cliente') : escapeHtml(c.contratistaNombre || 'El Contratista')}, en adelante denominado "${c.tipo === 'cliente' ? 'EL COMITENTE' : 'EL CONTRATISTA'}". Ambas partes, capaces para contratar y obligarse, convienen en celebrar el presente contrato sujeto a las siguientes cláusulas:`;
  addLine(comparece, { size: 10, gap: 4 });

  addSeparator();

  // ── CLÁUSULAS ─────────────────────────────────────────────────
  clausulas.forEach((cla, idx) => {
    checkPage();
    let texto = cla.texto
      .replace('{total}', fmt(c.monto || 0))
      .replace('{totalLetras}', montoLetras)
      .replace('{anticipo}', c.anticipoPct)
      .replace('{anticipoMonto}', fmt(c.anticipoMonto || 0))
      .replace('{plazo}', c.plazo || 120)
      .replace('{inicio}', inicioFmt)
      .replace('{fin}', finFmt)
      .replace('{direccion}', direccion)
      .replace('{cronograma}', c.cronograma || '—')
      .replace('{especialidad}', especialidad);

    addLine('CLÁUSULA ' + (idx + 1) + ': ' + cla.titulo, { size: 10, bold: true, color: [50, 50, 50], gap: 2 });
    addLine(texto, { size: 9, indent: 5, gap: 4 });
  });

  // ── CLÁUSULAS ADICIONALES ─────────────────────────────────────
  if (c.clausulasCustom) {
    checkPage();
    addSeparator();
    addLine('CLÁUSULAS ADICIONALES', { size: 11, bold: true, color: [15, 55, 120], gap: 3 });
    addLine(c.clausulasCustom, { size: 9, indent: 5, gap: 4 });
  }

  addSeparator();

  // ── DATOS DE LAS PARTES ───────────────────────────────────────
  addLine('DATOS DE LAS PARTES', { size: 11, bold: true, color: [15, 55, 120], gap: 4 });

  addLine('CONTRATANTE (Profesional/ Empresa):', { size: 9, bold: true, gap: 1 });
  addLine(profile.professional || '—', { size: 9, indent: 5 });
  addLine('RUC: ' + (profile.ruc || '—'), { size: 9, indent: 5 });
  addLine('Teléfono: ' + (profile.phone || '—'), { size: 9, indent: 5 });
  addLine('Email: ' + (profile.email || '—'), { size: 9, indent: 5 });
  addLine('Dirección: ' + (profile.address || '—'), { size: 9, indent: 5, gap: 4 });

  if (c.tipo === 'cliente') {
    addLine('COMITENTE (Cliente/ Propietario):', { size: 9, bold: true, gap: 1 });
    addLine(escapeHtml(c.clienteNombre || '—'), { size: 9, indent: 5, gap: 4 });
  } else {
    addLine('CONTRATISTA (Subcontratista):', { size: 9, bold: true, gap: 1 });
    addLine(escapeHtml(c.contratistaNombre || '—'), { size: 9, indent: 5 });
    const con = state.contractors.find(ct => ct.id === c.contratistaId);
    if (con) {
      addLine('Teléfono: ' + (con.phone || '—'), { size: 9, indent: 5 });
      addLine('Especialidad: ' + (con.specialty || '—'), { size: 9, indent: 5 });
    }
    addLine('', { size: 5, gap: 2 });
  }

  addLine('PROYECTO:', { size: 9, bold: true, gap: 1 });
  addLine(proj ? escapeHtml(proj.name) : '—', { size: 9, indent: 5 });
  addLine('Dirección de la obra: ' + direccion, { size: 9, indent: 5, gap: 4 });

  addSeparator();

  // ── FIRMAS ─────────────────────────────────────────────────────
  addLine('FIRMAS', { size: 13, bold: true, color: [15, 55, 120], gap: 6 });
  addLine('En señal de conformidad y aceptación de todas y cada una de las cláusulas del presente contrato, las partes firman en la ciudad de ' + ciudad + ', a los ' + fechaHoy + '.', { size: 9, gap: 8 });

  // Espacio para firmas
  const firmasY = y;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  if (firmasY + 40 < 260) {
    // Firma contratante
    doc.line(margin, firmasY, margin + 70, firmasY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(profile.professional || 'CONTRATANTE', margin + 35, firmasY + 4, { align: 'center' });
    doc.text('Firma y aclaración', margin + 35, firmasY + 9, { align: 'center' });

    // Firma contratado
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.line(pageW - margin - 70, firmasY, pageW - margin, firmasY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const nombreFirma = c.tipo === 'cliente' ? (c.clienteNombre || 'COMITENTE') : (c.contratistaNombre || 'CONTRATISTA');
    doc.text(nombreFirma, pageW - margin - 35, firmasY + 4, { align: 'center' });
    doc.text('Firma y aclaración', pageW - margin - 35, firmasY + 9, { align: 'center' });

    y = firmasY + 20;
  }

  // Testigo
  if (y + 30 < 260) {
    addLine('', { size: 5 });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.line(margin + 30, y, margin + 100, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text('TESTIGO (Firma y aclaración)', margin + 65, y + 4, { align: 'center' });
    y += 15;
  }

  addFooter();

  // Guardar PDF
  const safeName = (c.titulo || 'contrato').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
  doc.save(safeName + '_' + c.id.slice(-8) + '.pdf');
  toast("PDF generado ✓");
}
