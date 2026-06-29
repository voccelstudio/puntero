/* Pega TODO esto en la consola (F12) y presiona Enter */

(function() {
  if (typeof DB === 'undefined' || typeof state === 'undefined') {
    return console.error("Ejecutar desde la app (F12)");
  }

  var items = [
    // ── FUNDACIONES ──
    ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 17.6],
    ["FUNDACIONES", "Cimiento PBC sin cal (1:12)", 4.2],
    ["FUNDACIONES", "Aterramiento canchada de cemento", 6.5],

    // ── ESTRUCTURAS ──
    ["ESTRUCTURAS", "Zapata fck=18 MPa", 1.5],
    ["ESTRUCTURAS", "Columna fck=21 MPa", 0.6],
    ["ESTRUCTURAS", "Viga fck=21 MPa", 0.4],
    ["ESTRUCTURAS", "Losa Rap h=17cm (12+5)", 42],

    // ── MAMPOSTERIA ──
    ["MAMPOSTERIA", "Elevaci\u00f3n 0.15m ladrillo cer\u00e1mico 6 tubos", 220],
    ["MAMPOSTERIA", "Elevaci\u00f3n 0.20m ladrillo cer\u00e1mico hueco", 40],
    ["MAMPOSTERIA", "Tabique 0.10m ladrillo cer\u00e1mico 6 tubos", 35],

    // ── AISLACION ──
    ["AISLACION", "Horizontal asf\u00e1ltica 0.15m", 48],

    // ── CONTRAPISOS ──
    ["CONTRAPISOS", "Contrapiso 10cm cascotes", 90],
    ["CONTRAPISOS", "Carpeta nivelaci\u00f3n 2cm", 90],

    // ── REVOQUES ──
    ["REVOQUES", "Revoque 1 capa hidr\u00f3fugo 1.5cm", 260],
    ["REVOQUES", "Revoque 1 capa sin hidr\u00f3fugo", 120],
    ["REVOQUES", "Revoque salpicado lavable exterior", 60],

    // ── TECHOS ──
    ["TECHOS", "Teja francesa s/ machimbre", 140],
    ["TECHOS", "Cielorraso machimbre 1x3", 140],

    // ── PISOS ──
    ["PISOS", "Porcelanato 60x60cm", 60],
    ["PISOS", "Cer\u00e1mica esmaltada Cecafi 32x57cm", 50],
    ["PISOS", "Mosaico gran\u00edtico gris 30x30cm", 30],
    ["PISOS", "Baldosa calc\u00e1rea 20x20cm", 20],

    // ── PINTURAS ──
    ["PINTURAS", "L\u00e1tex interior con enduido", 320],
    ["PINTURAS", "L\u00e1tex exterior con enduido", 60],
    ["PINTURAS", "Pintura a la cal", 40],

    // ── CARPINTERIA MADERA ──
    ["CARPINTERIA MADERA", "Puerta placa 0.70x2.10m", 8],
    ["CARPINTERIA MADERA", "Puerta placa 0.80x2.10m", 3],
    ["CARPINTERIA MADERA", "Ventana madera 1.20x1.20m", 6],
    ["CARPINTERIA MADERA", "Juego cocina gas BUTAN", 1],

    // ── CARPINTERIA METALICA ──
    ["CARPINTERIA METALICA", "Ventana aluminio 1.20x1.20m", 4],
    ["CARPINTERIA METALICA", "Puerta aluminio corrediza 1.80x2.10m", 1],
    ["CARPINTERIA METALICA", "Port\u00f3n met\u00e1lico 2.50x2.00m", 1],

    // ── AGUA CORRIENTE ──
    ["AGUA CORRIENTE", "Punto de agua fr\u00eda/caliente", 12],
    ["AGUA CORRIENTE", "Termotanque el\u00e9ctrico 80lt", 1],
    ["AGUA CORRIENTE", "Tanque cisterna 500lt", 1],

    // ── ARTEFACTOS SANITARIOS ──
    ["ARTEFACTOS SANITARIOS", "Inodoro completo", 3],
    ["ARTEFACTOS SANITARIOS", "Lavatorio completo", 3],
    ["ARTEFACTOS SANITARIOS", "Ducha cromada", 3],
    ["ARTEFACTOS SANITARIOS", "Bacha cocina acero", 1],
    ["ARTEFACTOS SANITARIOS", "Grifer\u00eda mezcladora cocina", 1],

    // ── INSTALACION ELECTRICA ──
    ["INSTALACION EL\u00c9CTRICA", "Punto de luz", 18],
    ["INSTALACION EL\u00c9CTRICA", "Tomacorriente 2 bocas", 24],
    ["INSTALACION EL\u00c9CTRICA", "Disyuntor TM 1x40A", 1],
    ["INSTALACION EL\u00c9CTRICA", "Tablero 12 polos", 1],
    ["INSTALACION EL\u00c9CTRICA", "Cable 4mm", 60],

    // ── DESAGUE CLOACAL ──
    ["VARIOS", "Pozo ciego \u00d81.50m h=3.00m", 1],

    // ── QUINCHO ──
    ["MAMPOSTERIA", "Elevaci\u00f3n 0.15m ladrillo com\u00fan", 30],
    ["TECHOS", "Chapa N\u00ba28 s/ ca\u00f1os met\u00e1licos", 25],
    ["CONTRAPISOS", "Contrapiso 10cm cascotes", 25],
    ["PISOS", "Baldosa calc\u00e1rea 20x20cm", 25],
    ["REVOQUES", "Revoque 1 capa sin hidr\u00f3fugo", 50],

    // ── COCHERA ──
    ["ESTRUCTURAS", "Viga fck=21 MPa", 0.3],
    ["TECHOS", "Chapa N\u00ba28 s/ ca\u00f1os met\u00e1licos", 30],
    ["PISOS", "Mosaico gran\u00edtico gris 30x30cm", 30],

    // ── VEREDAS Y ACCESOS (jard\u00edn) ──
    ["VEREDAS Y ACCESOS", "Vereda hormig\u00f3n simple 8cm", 35],
  ];

  var added = 0;
  var projId = 'p_' + Date.now();
  var adendaId = 'ad_' + Date.now();

  state.projects.push({
    id: projId,
    name: "Casa Habitaci\u00f3n 2D - 140m\u00b2",
    client: "Cliente Ejemplo",
    phone: "0981 000 000",
    address: "Asunci\u00f3n, Paraguay",
    m2Area: 140,
    date: new Date().toLocaleDateString("es-PY"),
    status: "active",
    activeAdendaId: adendaId,
    budgets: [{
      id: adendaId,
      name: "Presupuesto Principal",
      items: [],
      profitPct: 12,
      ivaEnabled: true,
      notes: "Casa de 2 habitaciones, sala, cocina, comedor, 3 ba\u00f1os, quincho y cochera. Planta alta: no. Jard\u00edn: s\u00ed.",
    }],
    execution: { finances: { income:[], expenses:[] }, schedules:{}, dailyLogs:[], documents:[] }
  });

  items.forEach(function(row) {
    var cat = row[0], name = row[1], qty = row[2];
    if (DB[cat] && DB[cat][name]) {
      var data = DB[cat][name];
      var proj = state.projects[state.projects.length - 1];
      proj.budgets[0].items.push({
        cat: cat,
        name: name,
        unit: data.unit,
        unitPrice: data.total,
        matCost: data.matCost,
        laborCost: data.laborCost,
        mats: data.mats || [],
        qty: qty,
        id: Date.now() + Math.random() + added,
        disc: 0,
        note: ""
      });
      added++;
    }
  });

  state._currentProjectId = projId;
  save();
  setSection("budget");
  renderBudget();
  console.log("✅ Proyecto ejemplo creado — " + added + " \u00edtems cargados");
  toast("Proyecto ejemplo cargado \u2713 (" + added + " \u00edtems)");
})();
