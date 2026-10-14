// Genera el manifiesto versionado que consumen los suscriptores PRO.
//
// Flujo para actualizar precios (sin tocar la app):
//   1. Editá precios/db.json  (la copia maestra de precios)
//   2. Cambiá "version" y "mes" en ese archivo
//   3. node tools/build_precios.js
//   4. Deploy
//
// La app compara la versión del manifiesto contra la que el usuario tiene
// INSTALADA (localStorage), no contra la compilada en db_precios.js. Por eso
// actualizar precios no obliga a nadie a actualizar la app.
//
// precios/ NO contiene datos de clientes ni proyectos: solo precios públicos.

const fs = require("fs");
const path = require("path");
const { buildDB, DB_VERSION, DB_MES, DB_FECHA } = require("../db_precios.js");

const DIR = path.join(__dirname, "..", "precios");
const SRC = path.join(DIR, "db.json");
const OUT = path.join(DIR, "manifest.json");

if (!fs.existsSync(DIR)) { fs.mkdirSync(DIR, { recursive: true }); }

// Semilla: si todavía no existe la copia maestra, se genera desde la DB compilada.
if (!fs.existsSync(SRC)) {
  const seed = {
    version: DB_VERSION,
    mes: DB_MES || null,
    nota: DB_FECHA || null,
    db: buildDB(),
  };
  fs.writeFileSync(SRC, JSON.stringify(seed, null, 1), "utf8");
  console.log("🌱 precios/db.json creado como copia maestra (editá este archivo para actualizar)");
}

const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
const db = src.db || {};
const categorias = Object.keys(db).length;
const rubros = Object.values(db).reduce((n, items) => n + Object.keys(items).length, 0);

if (!src.version) {
  console.error("❌ precios/db.json no tiene 'version'. Ponele una (ej: \"2026-11\").");
  process.exit(1);
}

const manifest = {
  app: "puntero-precios",
  version: src.version,
  mes: src.mes || null,
  nota: src.nota || null,
  generado: new Date().toISOString(),
  categorias,
  rubros,
  db,
};

fs.writeFileSync(OUT, JSON.stringify(manifest), "utf8");
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(
  "✅ precios/manifest.json · v" + src.version +
  " · " + categorias + " categorías · " + rubros + " rubros · " + kb + " KB"
);
