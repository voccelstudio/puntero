const { DB_RAW, LABOR_PCT, buildDB } = require("./db_precios.js");
const fs = require("fs");

const DB = buildDB();

function lookup(cat, name) {
  if (!DB[cat]) throw new Error(`Categoria '${cat}' no encontrada`);
  if (!DB[cat][name]) throw new Error(`Item '${name}' no encontrado en ${cat}`);
  return DB[cat][name];
}

const items = [
  // ── FUNDACIONES ──
  ["FUNDACIONES", "Cimiento PBC con cal (1/2:1:4)", 17.6],
  ["FUNDACIONES", "Cimiento PBC sin cal (1:12)", 4.2],
  ["FUNDACIONES", "Hormig\u00f3n Cicl\u00f3peo (1:3:6)", 6.5],

  // ── ESTRUCTURAS ──
  ["ESTRUCTURAS", "Zapata fck=18 MPa", 1.5],
  ["ESTRUCTURAS", "Columna fck=21 MPa", 0.6],
  ["ESTRUCTURAS", "Viga fck=21 MPa", 0.7],
  ["ESTRUCTURAS", "Losa Rap h=17cm (12+5)", 42],

  // ── MAMPOSTER\u00cdA ──
  ["MAMPOSTER\u00cdA", "Elevaci\u00f3n 0.15m ladrillo cer\u00e1mico 6 tubos", 220],
  ["MAMPOSTER\u00cdA", "Elevaci\u00f3n 0.20m ladrillo cer\u00e1mico hueco", 40],
  ["MAMPOSTER\u00cdA", "Elevaci\u00f3n 0.15m ladrillo com\u00fan", 30],

  // ── AISLACI\u00d3N ──
  ["AISLACI\u00d3N", "Horizontal 0.15m con asfalto", 48],

  // ── CONTRAPISOS ──
  ["CONTRAPISOS", "Contrapiso 10cm cascotes (1/4:1:4:6)", 115],

  // ── REVOQUES ──
  ["REVOQUES", "Revoque 1 capa 1.5cm hidr\u00f3fugo (1:4:16)", 260],
  ["REVOQUES", "Revoque 1 capa sin hidr\u00f3fugo", 170],
  ["REVOQUES", "Revoque salpicado (1:3)", 60],

  // ── TECHOS ──
  ["TECHOS", "Teja francesa s/ machimbre", 140],
  ["TECHOS", "Chapa N\u00ba28 s/ ca\u00f1os met\u00e1licos", 55],

  // ── CIELO RASOS ──
  ["CIELO RASOS", "Cielo raso machimbre c/ estructura madera", 140],

  // ── PISOS ──
  ["PISOS", "Porcelanato 60x60cm", 60],
  ["PISOS", "Cer\u00e1mica esmaltada Cecafi 32x57cm", 50],
  ["PISOS", "Mosaico gran\u00edtico gris 30x30cm", 60],
  ["PISOS", "Baldosa calc\u00e1rea 20x20cm", 45],

  // ── PINTURAS ──
  ["PINTURAS", "L\u00e1tex interior con enduido", 320],
  ["PINTURAS", "L\u00e1tex exterior con enduido", 60],
  ["PINTURAS", "Pintura a la cal", 40],

  // ── CARPINTER\u00cdA MADERA ──
  ["CARPINTER\u00cdA MADERA", "Puerta tablero eucalipto 0.80x2.10m", 5],
  ["CARPINTER\u00cdA MADERA", "Marco ybyrapyta puerta 0.70m", 3],
  ["CARPINTER\u00cdA MADERA", "Marco ybyrapyta puerta 0.80m", 5],

  // ── CARPINTER\u00cdA MET\u00c1LICA ──
  ["CARPINTER\u00cdA MET\u00c1LICA", "Port\u00f3n cochera 3.00x2.00m", 1],
  ["CARPINTER\u00cdA MET\u00c1LICA", "Reja hierro art\u00edstica 1.50x1.20m", 4],

  // ── HERRER\u00cdA ORNAMENTAL ──
  ["HERRER\u00cdA ORNAMENTAL", "Port\u00f3n corredizo chapa lisa 3.00x2.00m", 1],
  ["HERRER\u00cdA ORNAMENTAL", "Puerta peatonal met\u00e1lica 0.90x2.10m", 1],

  // ── DESAG\u00dcE CLOACAL ──
  ["DESAG\u00dcE CLOACAL", "Pozo ciego \u00d81.50m h=3.00m", 1],
  ["DESAG\u00dcE CLOACAL", "Boca de desag\u00fce 30x30x30cm", 8],
  ["DESAG\u00dcE CLOACAL", "Ca\u00f1o PVC 100mm (desag\u00fce)", 15],

  // ── AGUA CORRIENTE ──
  ["AGUA CORRIENTE", "Instalaci\u00f3n agua fr\u00eda - ba\u00f1o completo", 3],
  ["AGUA CORRIENTE", "Instalaci\u00f3n agua fr\u00eda - pileta cocina", 1],
  ["AGUA CORRIENTE", "Tanque cisterna fibra de vidrio 500lt", 1],

  // ── ARTEFACTOS SANITARIOS ──
  ["ARTEFACTOS SANITARIOS", "Ba\u00f1o completo fr\u00edo y caliente (sin ba\u00f1era)", 3],
  ["ARTEFACTOS SANITARIOS", "Pileta cocina acero inoxidable", 1],

  // ── INSTALACI\u00d3N EL\u00c9CTRICA ──
  ["INSTALACI\u00d3N EL\u00c9CTRICA", "L\u00e1mpara con interruptor", 18],
  ["INSTALACI\u00d3N EL\u00c9CTRICA", "Tomacorriente", 24],
  ["INSTALACI\u00d3N EL\u00c9CTRICA", "Tablero monof\u00e1sico 12 polos completo", 1],
  ["INSTALACI\u00d3N EL\u00c9CTRICA", "Llave diferencial 2P 25A 30mA (salvavidas)", 1],
  ["INSTALACI\u00d3N EL\u00c9CTRICA", "Puesta a tierra completa (jabalina + cable)", 1],

  // ── VEREDAS Y ACCESOS ──
  ["VEREDAS Y ACCESOS", "Vereda hormig\u00f3n alisado 7cm s/ malla", 35],
  ["VEREDAS Y ACCESOS", "Cord\u00f3n de vereda premoldeado colocado", 20],
];

const budgetItems = [];
let counter = 0;
items.forEach(([cat, name, qty]) => {
  const data = lookup(cat, name);
  budgetItems.push({
    cat, name,
    unit: data.unit,
    unitPrice: data.total,
    matCost: data.matCost,
    laborCost: data.laborCost,
    mats: data.mats || [],
    qty,
    id: Date.now() + Math.random() + counter,
    disc: 0, note: ""
  });
  counter++;
});

const proj = {
  id: "p_ejemplo_mh",
  name: "Casa Habitaci\u00f3n 2D - 140m\u00b2 (MH)",
  client: "Cliente Ejemplo",
  phone: "0981 000 000",
  address: "Asunci\u00f3n, Paraguay",
  m2Area: 140,
  date: new Date().toLocaleDateString("es-PY"),
  status: "active",
  activeAdendaId: "ad_ejemplo_mh",
  budgets: [{
    id: "ad_ejemplo_mh",
    name: "Presupuesto Principal",
    items: budgetItems,
    profitPct: 12,
    ivaEnabled: true,
    notes: "Casa de 2 dormitorios, sala, cocina, comedor, 3 ba\u00f1os, quincho, cochera y jard\u00edn. Planta alta: no.",
  }],
  execution: {
    finances: { income: [], expenses: [] },
    schedules: {},
    dailyLogs: [],
    documents: []
  }
};

const ppy = {
  project: proj,
  contractors: [],
  profile: {
    name: "Constructor Ejemplo",
    email: "constructor@ejemplo.com",
    phone: "0981 000 001",
    logo: ""
  },
  exportDate: new Date().toISOString(),
  app: "Puntero",
  version: "7.0"
};

fs.writeFileSync("ejemplo-mh.ppy", JSON.stringify(ppy, null, 2), "utf8");
console.log("✅ ejemplo-mh.ppy generado con " + budgetItems.length + " items");
