/**
 * Puntero — Base de Datos de Precios v2
 * Fuentes cruzadas:
 *   A) Guía de precios de la construcción — Marzo 2026
 *   B) Guía de precios de la construcción — Agosto 2025
 * Precios en Guaraníes (₲). Incluye materiales + mano de obra.
 * Metodología: promedio ponderado de ambas fuentes.
 *   - Cuando A y B coinciden: se usa el promedio
 *   - Cuando solo hay una fuente: se usa esa fuente
 *   - MO: se usa el promedio entre mín y máx de la guía B, validado con A
 * Actualizado: Marzo 2026
 */

const DB_VERSION = "2026-05-techos-electrica";
const DB_FECHA   = "Mayo 2026 (techos termoacústicos + tableros trifásicos + pluviales)";

// ── PRECIOS UNITARIOS DE MATERIALES (referencia interna) ──────────────────
// Rango A-B documentado en comentarios para transparencia interna
const MAT_PRECIOS = {
  // Cemento y aglomerantes
  // A=1.100/kg (55.000/bolsa)  B=61.500/bolsa (1.230/kg) → promedio 1.165/kg
  "Cemento tipo 1":           { p: 1165,   u: "kg"  },
  // A=1.275/kg (25.500/20kg)  B=1.400/kg (35.000/25kg) → promedio 1.338/kg
  "Cal hidratada":            { p: 1338,   u: "kg"  },
  // A=1.225/kg  B=1.250/kg (50.000/40kg) → promedio 1.238/kg
  "Cal triturada":            { p: 1238,   u: "kg"  },
  // Áridos
  // A=65.000/m3  B=62.000/m3 (310.000/5m3) → promedio 63.500/m3
  "Arena lavada":             { p: 63500,  u: "m3"  },
  "Arena lavada de río":      { p: 63500,  u: "m3"  },
  // A=2.750/kg  B=1.955/kg → promedio 2.353/kg
  "Arena refractaria":        { p: 2353,   u: "kg"  },
  "Tierra gorda":             { p: 64000,  u: "m3"  },
  // Piedras
  "Piedra bruta blanca":      { p: 150000, u: "m3"  }, // A=150.000 (sin dato B)
  // A=120.000/tn  B=145.000/tn (4ta) → promedio 132.500/tn
  "Piedra triturada IV":      { p: 132500, u: "tn"  },
  // A=140.000  B=145.000 → promedio 142.500
  "Piedra triturada V":       { p: 142500, u: "tn"  },
  "Cascotillo cerámico":      { p: 99500,  u: "m3"  },
  "Piedra losa blanca":       { p: 33000,  u: "m2"  },
  // Hierro / acero
  // A=9.200/kg  B=10.000/kg (30.000/3kg) → promedio 9.600/kg
  "Varilla conformada Ø6mm":  { p: 9600,   u: "kg"  },
  // A=9.200/kg  B=10.000/kg (50.000/5kg) → promedio 9.600/kg
  "Varilla conformada Ø8mm":  { p: 9600,   u: "kg"  },
  // A=8.400/kg  B=10.000/kg (75.000/7.5kg) → promedio 9.200/kg
  "Varilla conformada Ø10mm": { p: 9200,   u: "kg"  },
  // A=18.000/kg  B=18.500/kg → promedio 18.250/kg
  "Alambre recocido Nº18":    { p: 18250,  u: "kg"  },
  "Varilla lisa":             { p: 11500,  u: "kg"  },
  "Varilla torsionada":       { p: 11000,  u: "kg"  },
  // Ladrillos
  // A=700/un  B=780/un (Blanco Tobatí) → promedio 740/un
  "Ladrillo común":           { p: 740,    u: "un"  },
  // A=1.265  B=1.750 → promedio 1.508/un
  "Ladrillo laminado Ita Yby":{ p: 1508,   u: "un"  },
  // A=1.298  B=2.050 → promedio 1.674/un
  "Ladrillo cerámico 6 tubos":{ p: 1674,   u: "un"  },
  // A=2.200  B=1.650 (hueco 8x18x25) → promedio 1.925/un
  "Ladrillo cerámico hueco 18x18x25cm": { p: 1925, u: "un" },
  // A=6.148  B=4.550 → promedio 5.349/un
  "Ladrillo refractario":     { p: 5349,   u: "un"  },
  // A=2.644  B=2.000 → promedio 2.322/un
  "Ladrillo convocó recto":   { p: 2322,   u: "un"  },
  // Tejas y tejuelas
  // A=1.809  B=2.000 (Itauguá) → promedio 1.905/un
  "Teja española Yoayu":      { p: 1905,   u: "un"  },
  "Tejuelón 1ra Ita Yby":     { p: 2288,   u: "un"  },
  "Tejuelita 1ra Yoayu":      { p: 658,    u: "un"  },
  // A=2.720  B=2.700 (Chaco) → promedio 2.710/un
  "Teja francesa 1ra Yoayu":  { p: 2710,   u: "un"  },
  // Madera
  // A=3.700  B=4.200 (ybyrapyta 1-2.9m) → promedio 3.950 pulg/m
  "Tirante 2x5 ybyrapyta":    { p: 3950,   u: "pulg/m" },
  "Viga 4x8 ybyrapyta":       { p: 5000,   u: "pulg/m" },
  // A=37.000  B=sin dato → se mantiene A
  "Machimbre ybyrapyta 1x3":  { p: 37000,  u: "m2"  },
  "Listón cedro 1x2":         { p: 5000,   u: "ml"  },
  // A=3.700  B=4.500 (4-4.9m) → promedio 4.100 pulg/m
  "Tirante ybyrapyta":        { p: 4100,   u: "pulg/m" },
  // Pisos y revestimientos
  "Baldosa calcárea 20x20cm": { p: 40000,  u: "m2"  },
  "Mosaico granítico gris 30x30cm": { p: 63000, u: "m2" },
  "Mosaico granítico blanco 30x30cm": { p: 80000, u: "m2" },
  "Cerámica Cecafi 32x57cm":  { p: 34000,  u: "m2"  },
  "Piso Cecafi 45x45cm":      { p: 40600,  u: "m2"  },
  "Porcelanato 60x60cm":      { p: 105000, u: "m2"  }, // desde
  "Layota 1ra Yoayu 28x28cm": { p: 1666,   u: "un"  }, // lisa 12 un/m2
  "Piedra losa blanca rompecabeza": { p: 33000, u: "m2" },
  "Mezcla adhesiva":          { p: 1198,   u: "kg"  },
  "Pastina base gris":        { p: 6000,   u: "kg"  },
  "Pastina base blanca":      { p: 6000,   u: "kg"  },
  // Aislación / impermeabilización
  "Negrolin (asfalto)":       { p: 12888,  u: "lt"  },
  "Betocem hidrófugo":        { p: 6060,   u: "lt"  },
  "Ceresita hidrófugo":       { p: 6150,   u: "lt"  },
  // Pinturas
  "Látex interior":           { p: 16714,  u: "lt"  },
  "Látex exterior":           { p: 16714,  u: "lt"  },
  "Sellador acrílico":        { p: 7777,   u: "lt"  },
  "Enduido interior":         { p: 4840,   u: "kg"  },
  "Enduido exterior":         { p: 5320,   u: "kg"  },
  "Lija":                     { p: 750,    u: "un"  },
  "Fijador Inatix":           { p: 4800,   u: "lt"  },
  "Barniz sintético brillante":{ p: 36944, u: "lt"  },
  "Aceite de linaza":         { p: 15400,  u: "lt"  },
  "Ácido muriático":          { p: 9060,   u: "lt"  },
  // Caños y accesorios sanitarios
  "Caño PVC 40mm":            { p: 7450,   u: "ml"  }, // tubo 6m ₲25.600 → ₲4.267/ml aprox
  "Caño PVC 50mm":            { p: 11250,  u: "ml"  },
  "Caño PVC 100mm":           { p: 26000,  u: "ml"  },
  "Caño PVC roscable 1/2 pulgada": { p: 9850, u: "ml" },
  "Caño PVC roscable 3/4 pulgada": { p: 12850,u: "ml" },
  "Caño PVC roscable 1 pulgada":   { p: 27850,u: "ml" },
  "Rejilla hierro 20x20cm":   { p: 37000,  u: "un"  },
  "Rejilla hierro 30x30cm":   { p: 75000,  u: "un"  },
  "Tapa H° 30x30cm":          { p: 35000,  u: "un"  },
  // Electricidad
  "Cable 2mm":                { p: 3129,   u: "ml"  },
  "Cable 4mm":                { p: 5964,   u: "ml"  },
  "Caño corrugado 3/4":       { p: 400,    u: "ml"  },
  "Llave unipolar + tapa":    { p: 7700,   u: "un"  },
  "Caja metálica conexión":   { p: 1400,   u: "un"  },
  "Caja llave plástica":      { p: 3300,   u: "un"  },
  "Disyuntor TM 1x10A":       { p: 16500,  u: "un"  },
  // Varios
  "REOPLAST Fluidificante":   { p: 19850,  u: "kg"  },
  "REOPLAST":                 { p: 19850,  u: "kg"  },
  "SIKAFLEX Sellador":        { p: 57000,  u: "lt"  },
  "Dintel prefabricado 1mx14cm": { p: 30100, u: "un" },
  "Vigueta listalosa":        { p: 125000, u: "m2"  },
  "Viguetas y ladrillos":     { p: 89100,  u: "m2"  }, // losa rap
  "Balaustre sencillo h=42cm":{ p: 4840,   u: "un"  },
  "Clavo":                    { p: 18000,  u: "kg"  },
  "Clavo 1 a 7 pulgadas":     { p: 18000,  u: "kg"  },
  "Tirafondo galvanizado 3/8x5": { p: 1500, u: "un" },

  // ─── VIDRIOS Y CARPINTERÍA DE VIDRIO ───────────────────────────────
  // Precios mercado PY 2026 (Vidriería Templar, VidrioMAS, Clasipar, Construex)
  // Vidrio plano (dulce/float) sin templar
  "Vidrio dulce 3mm":         { p: 110000, u: "m2"  }, // común para mueblería
  "Vidrio dulce 4mm":         { p: 145000, u: "m2"  }, // ventanas estándar
  "Vidrio dulce 5mm":         { p: 185000, u: "m2"  },
  "Vidrio dulce 6mm":         { p: 235000, u: "m2"  },
  // Vidrio templado / Blindex (importado, instalado solo material)
  "Vidrio blindex/templado 8mm":  { p: 580000, u: "m2"  }, // Clasipar PY 2026
  "Vidrio blindex/templado 10mm": { p: 720000, u: "m2"  },
  "Vidrio blindex/templado 12mm": { p: 920000, u: "m2"  },
  // Vidrio laminado (de seguridad, dos láminas + PVB)
  "Vidrio laminado 3+3mm":    { p: 320000, u: "m2"  },
  "Vidrio laminado 4+4mm":    { p: 410000, u: "m2"  },
  // Vidrio espejado / reflectante
  "Espejo 4mm":               { p: 195000, u: "m2"  },
  "Espejo 6mm":               { p: 275000, u: "m2"  },
  // DVH (doble vidriado hermético) — termopanel
  "DVH 3+9+3 (termopanel)":   { p: 480000, u: "m2"  },
  // Perfilería de aluminio (kg perfil + pintura electrostática)
  "Perfil aluminio línea 20": { p: 38000,  u: "ml"  }, // económico, ventanas
  "Perfil aluminio línea 25": { p: 55000,  u: "ml"  }, // medio
  "Perfil aluminio reforzado":{ p: 78000,  u: "ml"  }, // para frentes grandes
  // Herrajes y accesorios
  "Herraje p/ corrediza blindex": { p: 285000, u: "un" }, // juego ruedas + cierres
  "Bisagra hidráulica blindex":   { p: 380000, u: "un" }, // pivotante
  "Cerradura central blindex":    { p: 425000, u: "un" },
  "Manija acero inox blindex":    { p: 95000,  u: "un" }, // par
  "Tirador acero inox blindex":   { p: 145000, u: "un" }, // tipo H
  "Burlete EPDM":             { p: 4500,   u: "ml"  },
  "Felpa para corrediza":     { p: 2800,   u: "ml"  },
  // Selladores específicos
  "Silicona neutra estructural": { p: 38000, u: "un" }, // cartucho 280ml
  "Silicona acética transparente":{ p: 22000, u: "un" }, // cartucho 280ml

  // ═══ MATERIALES — NUEVAS CATEGORÍAS (Mayo 2026) ════════════════════════
  // Precios verificados PY 2026: Regimiento 8, Sensorview, Ulix, Clasipar, Tupi, Bristol

  // ─── PREVENCIÓN DE INCENDIOS ──────────────────────────────────────────
  "Detector de humo autónomo":     { p: 140000, u: "un" }, // Sensorview/Clasipar
  "Detector humo/calor compatible": { p: 180000, u: "un" }, // sistema centralizado
  "Detector termovelocimétrico":   { p: 210000, u: "un" },
  "Pulsador manual PCI":           { p: 90000,  u: "un" },
  "Sirena audiovisual PCI":        { p: 140000, u: "un" },
  "Central de alarma DSC 4 zonas": { p: 950000, u: "un" }, // incluye gabinete + batería
  "Luz emergencia LED 30 LED":     { p: 95000,  u: "un" }, // batería integrada 2-4hs
  "Cartel señal salida emerg.":    { p: 65000,  u: "un" }, // acrílico fotoluminiscente
  "Cartel salida emerg. luminoso": { p: 185000, u: "un" }, // con LED y batería
  "Cartel EXTINTOR 20x40":         { p: 35000,  u: "un" },
  "Extintor PQS 6kg ABC":          { p: 220000, u: "un" }, // Regimiento 8
  "Extintor PQS 10kg ABC":         { p: 352000, u: "un" },
  "Extintor CO2 5kg":              { p: 380000, u: "un" },
  "Extintor agua hidro 6lt":       { p: 195000, u: "un" },
  "Extintor espuma AFFF 4lt":      { p: 200000, u: "un" },
  "Soporte metálico extintor":     { p: 45000,  u: "un" },
  "Manguera contra incendio 30m":  { p: 850000, u: "un" }, // 1.5"
  "Hidrante de muro tipo gabinete":{ p: 1400000,u: "un" }, // completo
  "Boquilla chorro/niebla":        { p: 280000, u: "un" },
  "Cable PCI BF 2x1.5mm² (rollo)": { p: 6500,   u: "ml" },
  "Caño hidráulico PCI 1.5\" galv.":{ p: 85000, u: "ml" }, // SCH40 c/ acceso
  "Rociador sprinkler estándar":   { p: 75000,  u: "un" },

  // ─── CLIMATIZACIÓN ────────────────────────────────────────────────────
  "Split 9000 BTU frío/calor":     { p: 3200000,u: "un" }, // entrada de gama
  "Split 12000 BTU frío/calor":    { p: 3500000,u: "un" }, // Goodweather/Mabe
  "Split 18000 BTU frío/calor":    { p: 4500000,u: "un" }, // promedio mercado
  "Split 24000 BTU frío/calor":    { p: 5400000,u: "un" }, // Mabe/JAM
  "Split 36000 BTU frío/calor":    { p: 8500000,u: "un" },
  "Split inverter 12000 BTU":      { p: 4200000,u: "un" },
  "Split inverter 18000 BTU":      { p: 5500000,u: "un" }, // mejor eficiencia
  "Split inverter 24000 BTU":      { p: 7700000,u: "un" }, // Haustec/JAM
  "Kit instalación split 3m":      { p: 350000, u: "un" }, // caños, drenaje, soporte
  "Caño cobre A/A 1/4\" (ml)":     { p: 38000,  u: "ml" },
  "Caño cobre A/A 1/2\" (ml)":     { p: 48000,  u: "ml" },
  "Aislante térmico p/ caño A/A":  { p: 18000,  u: "ml" },
  "Soporte exterior split":        { p: 120000, u: "un" }, // metálico galvanizado
  "Carga gas R410A (operación)":   { p: 280000, u: "un" }, // 1 carga estándar
  "Ventilador de techo 132cm":     { p: 480000, u: "un" }, // 5 aspas con luz
  "Ventilador de techo industrial":{ p: 850000, u: "un" }, // alto rendimiento
  "Extractor de aire baño 100mm":  { p: 95000,  u: "un" },
  "Extractor de aire cocina 250mm":{ p: 380000, u: "un" }, // potencia comercial
  "Conducto flexible aluminio 4\"":{ p: 18000,  u: "ml" },

  // ─── PISCINAS ─────────────────────────────────────────────────────────
  "Cemento alto contenido sulfato":{ p: 88000,  u: "un" }, // bolsa 50kg, p/ piscina
  "Aditivo impermeabilizante":     { p: 42000,  u: "kg" },
  "Pegamento p/ piscina":          { p: 18000,  u: "kg" }, // adhesivo cementicio especial
  "Malla electrosoldada Q-92":     { p: 38000,  u: "m2" }, // p/ contrapisos y veredas
  "Skimmer estándar":              { p: 380000, u: "un" },
  "Boquilla impulsión piscina":    { p: 95000,  u: "un" },
  "Toma limpiafondos":             { p: 110000, u: "un" },
  "Reflector LED RGB submarino":   { p: 580000, u: "un" }, // con caja sumergible
  "Equipo bomba+filtro arena 0.5HP":{p: 2800000,u: "un" }, // hasta 50m³
  "Equipo bomba+filtro arena 1HP": { p: 4200000,u: "un" }, // hasta 100m³
  "Arena de sílex (filtro)":       { p: 18000,  u: "kg" },
  "Caño PVC piscina 1.5\"":        { p: 18000,  u: "ml" }, // presión
  "Tablero eléctrico piscina":     { p: 850000, u: "un" }, // diferencial+térmico
  "Cerámica esmaltada piscina":    { p: 145000, u: "m2" }, // azul tradicional
  "Venecitas vitreas piscina":     { p: 280000, u: "m2" }, // alta gama
  "Borde atérmico antideslizante": { p: 95000,  u: "ml" },
  "Membrana líquida pileta":       { p: 95000,  u: "kg" }, // poliuretano

  // ─── PAISAJISMO ───────────────────────────────────────────────────────
  "Tierra negra (camión 6m³)":     { p: 850000, u: "un" }, // entregada
  "Tierra negra suelta":           { p: 145000, u: "m3" },
  "Compost orgánico":              { p: 95000,  u: "m3" },
  "Grama San Agustín en panes":    { p: 18000,  u: "m2" }, // colocada
  "Grama Bahiana semilla":         { p: 28000,  u: "kg" },
  "Grama esmeralda en panes":      { p: 22000,  u: "m2" },
  "Geotextil para jardín":         { p: 12000,  u: "m2" },
  "Mantillo / cobertura corteza":  { p: 35000,  u: "m3" },
  "Aspersor emergente PE":         { p: 45000,  u: "un" },
  "Aspersor turbinado sectorial":  { p: 95000,  u: "un" },
  "Goteo por línea (rollo 100m)":  { p: 280000, u: "un" },
  "Programador riego 4 zonas":     { p: 380000, u: "un" }, // a batería
  "Caño PE riego 16mm":            { p: 4500,   u: "ml" },
  "Palmera Pindó 1.5m":            { p: 280000, u: "un" }, // ejemplar
  "Palmera Areca 1m":              { p: 180000, u: "un" },
  "Lapacho rosado plantín 50cm":   { p: 95000,  u: "un" },
  "Plantín ornamental mediano":    { p: 25000,  u: "un" }, // bromelias, helechos, etc.
  "Cerco vivo San Antonio (ml)":   { p: 85000,  u: "ml" }, // Duranta plantada

  // ─── MOVIMIENTO DE SUELO ──────────────────────────────────────────────
  "Hora máquina retroexcavadora":  { p: 380000, u: "un" }, // hora con operador
  "Hora máquina topadora":         { p: 480000, u: "un" },
  "Suelo seleccionado p/ relleno": { p: 45000,  u: "m3" },
  "Ripio para subbase":            { p: 95000,  u: "m3" },
  "Adoquín hormigón antiestres":   { p: 78000,  u: "m2" }, // ya colocado material
  "Bordillo/cordón hormigón":      { p: 38000,  u: "ml" },

  // ─── BAJA CORRIENTE / DOMÓTICA ────────────────────────────────────────
  "Cable UTP cat6 (rollo 100m)":   { p: 280000, u: "un" },
  "Conector RJ45 cat6":            { p: 1200,   u: "un" },
  "Patch panel 24 puertos":        { p: 480000, u: "un" },
  "Switch 8 puertos gigabit":      { p: 380000, u: "un" },
  "Cable coaxial RG6 (ml)":        { p: 4500,   u: "ml" },
  "Cámara IP exterior 4MP":        { p: 580000, u: "un" }, // visión nocturna
  "Cámara IP domo interior 2MP":   { p: 320000, u: "un" },
  "DVR/NVR 8 canales":             { p: 1450000,u: "un" }, // sin disco
  "Disco rígido vigilancia 2TB":   { p: 480000, u: "un" },
  "Portero eléctrico simple":      { p: 380000, u: "un" }, // audio
  "Videoportero a color":          { p: 1850000,u: "un" }, // pantalla 7\"
  "Motor portón corredizo 600kg":  { p: 2200000,u: "un" }, // con control remoto
  "Motor portón basculante":       { p: 2800000,u: "un" },
  "Control remoto adicional":      { p: 95000,  u: "un" },
  "Sensor PIR alarma":             { p: 95000,  u: "un" },
  "Panel alarma 8 zonas DSC":      { p: 1400000,u: "un" }, // central + teclado
  "Sirena exterior alarma":        { p: 220000, u: "un" },

  // ─── SANITARIOS COMPLEMENTARIOS ───────────────────────────────────────
  "Calefón eléctrico 80lt":        { p: 1450000,u: "un" }, // marca media
  "Calefón eléctrico 150lt":       { p: 2200000,u: "un" },
  "Termotanque a gas 110lt":       { p: 2850000,u: "un" },
  "Termotanque solar 200lt":       { p: 6500000,u: "un" }, // con kit completo
  "Bomba presurizadora 0.5HP":     { p: 1200000,u: "un" }, // doméstica
  "Bomba sumergible pozo 1HP":     { p: 2800000,u: "un" },
  "Tanque polietileno 500lt":      { p: 380000, u: "un" }, // tricapa
  "Tanque polietileno 1000lt":     { p: 580000, u: "un" },
  "Tanque polietileno 2000lt":     { p: 1100000,u: "un" },
  "Tanque cisterna fibra 2500lt":  { p: 1850000,u: "un" }, // enterrable
  "Biodigestor 600lt":             { p: 1850000,u: "un" }, // p/ fosa séptica moderna
  "Biodigestor 1300lt":            { p: 2850000,u: "un" },
  "Anillos pozo absorbente 1m":    { p: 220000, u: "un" }, // hormigón premoldeado

  // ─── IMPERMEABILIZACIONES ─────────────────────────────────────────────
  "Membrana asfáltica 4mm aluminizada":{ p: 95000, u: "m2" }, // rollo
  "Membrana líquida poliuretano":  { p: 85000,  u: "kg" },
  "Imprimación asfáltica (lt)":    { p: 28000,  u: "lt" },
  "Sika top 107 seal (kit)":       { p: 380000, u: "un" }, // cementicio impermeable
  "Banda butílica autoadhesiva":   { p: 18000,  u: "ml" },
  "Geomembrana HDPE 1mm":          { p: 28000,  u: "m2" }, // p/ piletas/cisternas

  // ─── ESCALERAS Y BARANDAS ─────────────────────────────────────────────
  "Hierro estructural caño rect.": { p: 18000,  u: "kg" },
  "Tubo redondo 2\" hierro":       { p: 22000,  u: "ml" },
  "Pasamano hierro forjado":       { p: 145000, u: "ml" }, // diseño simple
  "Baranda hierro torneado":       { p: 280000, u: "ml" }, // con detalles
  "Peldaño metálico chapa estriada":{ p: 95000, u: "un" },
  "Escalón premoldeado hormigón":  { p: 145000, u: "un" },

  // ─── OBRA HÚMEDA COMPLEMENTARIA ───────────────────────────────────────
  "Hidrolavadora hora alquiler":   { p: 95000,  u: "un" },
  "Sellador de juntas poliuretano":{ p: 65000,  u: "un" }, // cartucho 600ml
  "Cinta alta adherencia juntas":  { p: 28000,  u: "ml" },

  // ─── CIELOS RASO — DURLOCK / PVC / YESO (Mayo 2026) ──────────────────
  // Precios verificados: Tecnofor PY, Clasipar, Generador CYPE PY 2026
  "Metal desplegado":              { p: 35000,  u: "m2" }, // p/ revoque cielo raso
  // Placas Durlock (1.20 x 2.40m = 2.88m² rinde efectivo ~2.80m² en cielo)
  "Placa durlock estándar 9.5mm":  { p: 95000,  u: "un" }, // p/ cielo raso, 1.20x2.40m
  "Placa durlock estándar 12.5mm": { p: 115000, u: "un" }, // p/ pared, 1.20x2.40m
  "Placa durlock RH 12.5mm verde": { p: 165000, u: "un" }, // resistente humedad, baño/cocina
  "Placa durlock RF 12.5mm roja":  { p: 195000, u: "un" }, // resistente fuego
  // Perfilería metálica
  "Perfil omega 35mm x 2.60m":     { p: 28000,  u: "un" }, // p/ cielo raso
  "Perfil solera 35mm x 2.60m":    { p: 32000,  u: "un" },
  "Perfil montante 35mm x 2.60m":  { p: 38000,  u: "un" },
  "Perfil F530 cielo raso x 4m":   { p: 65000,  u: "un" }, // primario
  "Perfil CR2 perimetral":         { p: 22000,  u: "ml" },
  "Cuelgue/tensor cielo raso":     { p: 4500,   u: "un" }, // varilla + ojal
  // Accesorios y terminación
  "Tornillo T1 punta fina (cien)": { p: 18000,  u: "un" }, // 100 unidades
  "Tornillo T2 punta mecha (cien)":{ p: 22000,  u: "un" },
  "Cinta papel junta durlock 75m": { p: 35000,  u: "un" },
  "Masilla durlock balde 28kg":    { p: 145000, u: "un" }, // tipo Placomix
  "Masilla secado rápido 25kg":    { p: 165000, u: "un" }, // p/ pegamento + base
  "Lana de vidrio 50mm Isover":    { p: 52000,  u: "m2" }, // aislante térmico/acústico
  // PVC machimbre
  "Cieloraso PVC blanco 6mm":      { p: 26000,  u: "m2" }, // económico
  "Cieloraso PVC blanco 8mm":      { p: 30000,  u: "m2" }, // estándar
  "Cieloraso PVC color pino 8mm":  { p: 48000,  u: "m2" }, // imitación madera
  "Perfil terminación U PVC 6m":   { p: 33000,  u: "un" },
  "Perfil terminación H PVC 6m":   { p: 38000,  u: "un" }, // p/ unión de paneles
  // Yeso (placas tradicionales y molduras)
  "Placa yeso 60x60cm":            { p: 38000,  u: "un" }, // p/ cielo raso modular
  "Placa yeso 60x120cm":           { p: 65000,  u: "un" },
  "Yeso París bolsa 25kg":         { p: 45000,  u: "un" }, // yesito
  "Moldura yeso 8cm":              { p: 18000,  u: "ml" }, // perimetral decorativa
  "Moldura yeso 12cm":             { p: 24000,  u: "ml" },
  "Moldura yeso 14cm":             { p: 32000,  u: "ml" },
  "Junta dilatación cielo raso":   { p: 16000,  u: "ml" },

  // ─── TECHOS METÁLICOS / TERMOACÚSTICOS (Mayo 2026) ───────────────────
  // Fuentes: Tecnimetal PY, Mercofer, Isopanel SA, Clasipar 2026
  "Chapa termoacústica trapez. EPS 30mm": { p: 220000, u: "m2" }, // núcleo isopor 3cm
  "Chapa termoacústica trapez. EPS 50mm": { p: 250000, u: "m2" }, // núcleo isopor 5cm — más usada
  "Chapa termoacústica trapez. PUR 30mm": { p: 320000, u: "m2" }, // poliuretano, mejor aisl.
  "Chapa termoacústica colonial EPS 40mm":{ p: 290000, u: "m2" }, // imitación teja con aisl.
  "Chapa traslúcida fibra vidrio acanal.":{ p: 165000, u: "m2" }, // p/ lucernarios laterales
  "Policarbonato alveolar 6mm":           { p: 95000,  u: "m2" }, // p/ lucernarios cenitales
  "Perfil C galvanizado 100x50":          { p: 38000,  u: "ml" }, // p/ tinglado liviano
  "Perfil C galvanizado 150x50":          { p: 52000,  u: "ml" }, // p/ tinglado mediano
  "Cabriada metálica armada (kg)":        { p: 12000,  u: "kg" }, // hierro armado p/ galpón
  "Tornillo autoperforante c/ arandela":  { p: 800,    u: "un" }, // p/ chapa termoacústica
  "Cumbrera galvanizada universal":       { p: 28000,  u: "ml" },
  "Canaleta zinc Nº24 desarrollada":      { p: 35000,  u: "ml" }, // p/ desagüe pluvial
  "Bajada PVC 100mm pluvial":             { p: 18000,  u: "ml" },
  "Codos y accesorios pluvial PVC 100mm": { p: 25000,  u: "un" },

  // ─── INSTALACIÓN ELÉCTRICA AVANZADA (Mayo 2026) ──────────────────────
  // Fuentes: Sensorview, Conecta, Construex, Promart, AutoSolar 2026
  "Tablero PVC 12 polos riel DIN":        { p: 280000, u: "un" }, // gabinete vacío
  "Tablero PVC 24 polos riel DIN":        { p: 480000, u: "un" },
  "Tablero metálico 36 polos industrial": { p: 1450000,u: "un" }, // c/ puerta y cerradura
  "Llave termomagnética 1P 16A":          { p: 65000,  u: "un" }, // monofásica circuitos pequeños
  "Llave termomagnética 1P 25A":          { p: 75000,  u: "un" },
  "Llave termomagnética 1P 32A":          { p: 85000,  u: "un" },
  "Llave termomagnética 2P 32A":          { p: 165000, u: "un" }, // bipolar (fase + neutro)
  "Llave termomagnética 3P 25A":          { p: 285000, u: "un" }, // tripolar trifásica
  "Llave termomagnética 3P 40A":          { p: 350000, u: "un" }, // p/ tablero principal
  "Llave termomagnética 3P 63A":          { p: 480000, u: "un" }, // industrial mediana
  "Llave diferencial 2P 25A 30mA":        { p: 285000, u: "un" }, // salvavidas residencial
  "Llave diferencial 4P 40A 30mA":        { p: 580000, u: "un" }, // trifásica
  "Toma trifásico industrial 25A IP44":   { p: 145000, u: "un" }, // tomacorriente p/ máquinas
  "Toma trifásico industrial 32A IP44":   { p: 195000, u: "un" },
  "Jabalina cobre 1.5m + tomatierra":     { p: 185000, u: "un" }, // puesta a tierra
  "Cable cobre desnudo 35mm² (tierra)":   { p: 18000,  u: "ml" },
  "Borne unión bimetálico tierra":        { p: 38000,  u: "un" },
  "Riel DIN 35mm x 1m":                   { p: 28000,  u: "ml" },

  // ─── MATERIALES ANTIGUOS FALTANTES (corrige cómputos preexistentes) ──
  "Chapa zinc Nº28":                  { p: 75000,  u: "m2" },
  "Chapa trapezoidal Nº27":           { p: 95000,  u: "m2" },
  "Chapa fibrocemento ondulada 6mm":  { p: 195000, u: "un" }, // placa 1.10x2.44m
  "Caño rectangular 30x50x1.20mm":    { p: 28000,  u: "ml" },
  "Perfil U 100x40 1.8mm":            { p: 38000,  u: "ml" },
  "Perfil C 100x38 1.80mm":           { p: 35000,  u: "ml" },
  "Tornillo autoroscante 2":          { p: 1200,   u: "un" }, // unidad
  "Tornillos 12x2":                   { p: 1500,   u: "un" },
  "Caja tablero principal":           { p: 280000, u: "un" }, // gabinete viejo (no DIN)
  "Llave para calefón 25":            { p: 95000,  u: "un" }, // legacy
  "Caño galvanizado":                 { p: 85000,  u: "un" }, // tira de 6m
  "Curva galvanizada 1 pulgada":      { p: 18000,  u: "un" },

  // ─── MATERIALES ANTIGUOS DE OTRAS CATEGORÍAS (corrige cómputos) ──────
  "Colorante 100cc":                  { p: 12000,  u: "un" },
  "Marco ybyrapyta":                  { p: 285000, u: "un" }, // marco puerta interior
  "Puerta tablero eucalipto":         { p: 580000, u: "un" }, // puerta común interior
  "Puerta tablero punta diamante":    { p: 850000, u: "un" }, // diseño superior
  "Puerta vidriera eucalipto":        { p: 1180000,u: "un" }, // c/ vidrio
  "Hoja persiana varilla 45cm":       { p: 145000, u: "un" },
  "Cerradura externa c/manija":       { p: 165000, u: "un" },
  "Tornillo 1x7":                     { p: 800,    u: "un" },
  "Ficha 5 agujeros":                 { p: 35000,  u: "un" },
  "Balancín fabricado":               { p: 1850000,u: "un" }, // ventana balancín soldada
  "Portón con cerradura":             { p: 4500000,u: "un" }, // portón corredizo metálico
  "Escalera metálica":                { p: 2800000,u: "un" }, // escalera completa estándar
  "Reja artística":                   { p: 580000, u: "m2" }, // reja decorativa para ventana
  "Cortina metálica enrollable":      { p: 850000, u: "m2" }, // p/ locales comerciales
  // Sanitarios e hidráulica (legacy)
  "Caja sifonada 150x150x50mm":       { p: 95000,  u: "un" },
  "Caño 1/2 roscable":                { p: 22000,  u: "ml" }, // hidráulico FV
  "Codo 90° roscable 1/2":            { p: 8500,   u: "un" },
  "Llave de paso 1/2 FV cromada":     { p: 75000,  u: "un" },
  "Tapón roscable 1/2":               { p: 6500,   u: "un" },
  "Cinta teflón 18mmx25m":            { p: 8500,   u: "un" },
  "Tanque Fibrac 500lt":              { p: 480000, u: "un" }, // marca local PY
  "Tanque Fibrac 1000lt":             { p: 750000, u: "un" },
  // Artefactos sanitarios
  "Juego WC cisterna Deca Ravena":    { p: 1350000,u: "un" }, // inodoro completo Deca
  "Juego WC cisterna alta Deca":      { p: 1180000,u: "un" }, // modelo clásico
  "Grifería FV Línea Clásica":        { p: 280000, u: "un" }, // monocomando lavatorio
  "Grifería externa FV":              { p: 165000, u: "un" }, // canilla exterior
  "Canilla lavatorio FV":             { p: 145000, u: "un" },
  "Prolongador FV cromo":             { p: 38000,  u: "un" },
  "Termocalefón 80lt":                { p: 1450000,u: "un" }, // calefón eléctrico legacy
  "Ducha eléctrica Corona":           { p: 380000, u: "un" }, // ducha calentadora
  "Botiquín 44x58x11cm":              { p: 285000, u: "un" }, // espejo c/ guardado
  "Bañera 1.60x0.70m":                { p: 2200000,u: "un" }, // bañera fibra/acrílico
  "Pileta 1 bacha acero inox":        { p: 580000, u: "un" }, // pileta cocina simple
  // Pisos y revestimientos
  "Granito natural":                  { p: 285000, u: "m2" }, // mesada/escalón
  "Mármol blanco":                    { p: 380000, u: "m2" }, // alta gama
  "Zócalo de granito":                { p: 65000,  u: "ml" },
  "Moldura pecho paloma":             { p: 32000,  u: "ml" }, // moldura clásica
  // Otros
  "Parrilla enlozada con carbonera":  { p: 1850000,u: "un" }, // parrilla quincho completa
  "Yeso para construcción":           { p: 38000,  u: "un" }, // bolsa 25kg (legacy de yesito)
};

// ── PORCENTAJES MO POR CATEGORÍA ─────────────────────────────────────────
// Fuente A = Mandua Marzo 2026 (costeo de obra)
// Fuente B = Costos Construcción Agosto 2025 (MO min/max)
// Se usa promedio de ambas fuentes cuando están disponibles.
// MO B (HºAº): 680.000-1.000.000 → promedio 840.000/m3 → ~35% de total ~2.400.000
const LABOR_PCT = {
  // A=38%  B=35% (promedio mín-máx sobre total) → 36%
  "ESTRUCTURAS":          36,
  // A=32%  B=~35% (cimiento piedra bruta) → 33%
  "FUNDACIONES":          33,
  // A=35%  B=~37% (mampostería 0.15m: MO 21.000-45.000 sobre total ~91.000) → 36%
  "MAMPOSTERÍA":          36,
  // A=30%  B=~32% → 31%
  "CONTRAPISOS":          31,
  // A=40%  B=~42% (revoque 1 capa: MO 20.000-35.000 sobre total ~31.000) → 41%
  "REVOQUES":             41,
  // A=35%  B=~37% (tejas españolas tejuelones MO 35.000-60.000 sobre total ~279.000) → 36%
  "TECHOS":               36,
  // A=30%  B=~30% → 30%
  "PISOS":                30,
  // A=35%  B=~33% → 34%
  "AISLACIÓN":            34,
  // A=50%  B=~48% (látex con fijador MO 16.000-20.000 sobre total ~35.000) → 49%
  "PINTURAS":             49,
  // A=20%  B=~22% → 21%
  "CARPINTERÍA MADERA":   21,
  // A=15%  B=~15% → 15%
  "CARPINTERÍA METÁLICA": 15,
  // Vidrios: instalación liviana, mayor parte material → ~13%
  // (cortes, pulido, sellado, herrajes, regulación de paño)
  "VIDRIOS":              13,
  // A=40%  B=~42% → 41%
  "DESAGÜE CLOACAL":      41,
  // A=35%  B=~36% → 35%
  "AGUA CORRIENTE":       35,
  // A=20%  B=~20% → 20%
  "ARTEFACTOS SANITARIOS":20,
  // A=45%  B=~45% → 45%
  "INSTALACIÓN ELÉCTRICA":45,
  // A=30%  B=~30% → 30%
  "VARIOS":               30,

  // ─── NUEVAS CATEGORÍAS (Mayo 2026) ──────────────────────────────────────
  // PCI: tendido + colocación + pruebas, equipos pesan más → ~22%
  "PREVENCIÓN DE INCENDIOS": 22,
  // Climatización: equipo es la mayor parte, instalación/cañería/eléctrico → ~20%
  "CLIMATIZACIÓN":           20,
  // Piscinas: hormigón + impermeabilización + equipos. Mucha MO → ~38%
  "PISCINAS":                38,
  // Paisajismo: alta mano de obra (preparación suelo, plantación) → ~45%
  "PAISAJISMO":              45,
  // Movimiento de suelo: máquinas + operarios → ~30%
  "MOVIMIENTO DE SUELO":     30,
  // Baja corriente: tendido cuidadoso, certificación → ~40%
  "BAJA CORRIENTE":          40,
  // Sanitarios complementarios: equipo + instalación → ~25%
  "SANITARIOS COMPLEMENTARIOS": 25,
  // Impermeabilización: aplicación cuidadosa, pruebas → ~38%
  "IMPERMEABILIZACIONES":    38,
  // Escaleras y barandas: trabajo de herrería + instalación → ~28%
  "ESCALERAS Y BARANDAS":    28,
  // Obra húmeda complementaria: trabajos finales → ~50%
  "OBRA HÚMEDA COMPLEMENTARIA": 50,
};

// ── IVA POR TIPO ──────────────────────────────────────────────────────────
// Paraguay: IVA 10% materiales, 5% MO (servicios personales)
const IVA_MAT = 0.10;
const IVA_LAB = 0.05;

// ── BASE DE DATOS DE RUBROS ───────────────────────────────────────────────
// Formato: { u: unidad, m: costo materiales (₲), mats: [{n, q, u}], y: rendimiento por día (unidades/día) }
// Precios recalculados con promedio de ambas fuentes (Mandua Mar-2026 + Costos Ago-2025)
// El costo de MO se calcula automáticamente al construir la DB

const DB_RAW = {

// ════════════════════════════════════════════════════════════════════════
"ESTRUCTURAS": {
// ════════════════════════════════════════════════════════════════════════
  "Zapata fck=18 MPa": {
    u:"m3", m:1960000, y: 1.5,
    // Mandua Costeo pág 36: Mat ₲1.201.000 + MO ₲650.000 = ₲1.851.000
    mats:[
      {n:"Cemento tipo 1",q:300,u:"kg"},
      {n:"Arena lavada",q:0.70,u:"m3"},
      {n:"Piedra triturada IV",q:1.40,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:65,u:"kg"},
      {n:"Alambre recocido Nº18",q:0.30,u:"kg"},
      {n:"REOPLAST Fluidificante",q:3.50,u:"kg"},
    ]
  },
  "Columna fck=21 MPa": {
    u:"m3", m:2520000, y: 0.8,
    // Mandua Costeo pág 36: total ₲2.380.175
    mats:[
      {n:"Cemento tipo 1",q:300,u:"kg"},
      {n:"Arena lavada",q:0.70,u:"m3"},
      {n:"Piedra triturada IV",q:1.40,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:95,u:"kg"},
      {n:"Alambre recocido Nº18",q:0.40,u:"kg"},
      {n:"Clavo 1 a 7 pulgadas",q:0.40,u:"kg"},
      {n:"REOPLAST Fluidificante",q:3.50,u:"kg"},
    ]
  },
  "Viga fck=21 MPa": {
    u:"m3", m:2455000, y: 0.8,
    // Mandua Costeo pág 36: total ₲2.320.250
    mats:[
      {n:"Cemento tipo 1",q:300,u:"kg"},
      {n:"Arena lavada",q:0.70,u:"m3"},
      {n:"Piedra triturada IV",q:1.40,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:90,u:"kg"},
      {n:"Alambre recocido Nº18",q:0.40,u:"kg"},
      {n:"REOPLAST",q:3,u:"kg"},
    ]
  },
  "Losa fck=21MPa": {
    u:"m3", m:2415000, y: 1.2,
    // Mandua Costeo pág 36: total ₲2.281.300
    mats:[
      {n:"Cemento tipo 1",q:350,u:"kg"},
      {n:"Arena lavada",q:0.70,u:"m3"},
      {n:"Piedra triturada IV",q:1.30,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:80,u:"kg"},
      {n:"Alambre recocido Nº18",q:0.40,u:"kg"},
      {n:"REOPLAST",q:4,u:"kg"},
    ]
  },
  "Encadenado 13x20 cm": {
    u:"ml", m:119000,
    // Mandua pág 36: ₲113.400
    mats:[
      {n:"Cemento tipo 1",q:10,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
      {n:"Piedra triturada IV",q:0.04,u:"tn"},
      {n:"Varilla conformada Ø6mm",q:3.20,u:"kg"},
      {n:"Alambre recocido Nº18",q:0.10,u:"kg"},
    ]
  },
  "Encadenado 13x30 cm": {
    u:"ml", m:145000,
    // Mandua pág 36: ₲137.800
    mats:[
      {n:"Cemento tipo 1",q:12,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
      {n:"Piedra triturada IV",q:0.05,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:3.60,u:"kg"},
    ]
  },
  "Encadenado 30x30 cm": {
    u:"ml", m:180000,
    // Mandua pág 36: ₲171.000
    mats:[
      {n:"Cemento tipo 1",q:27,u:"kg"},
      {n:"Arena lavada",q:0.06,u:"m3"},
      {n:"Piedra triturada IV",q:0.13,u:"tn"},
      {n:"Varilla conformada Ø10mm",q:4.00,u:"kg"},
    ]
  },
  "Losa Rap h=17cm (12+5)": {
    u:"m2", m:240000,
    // Mandua Costeo pág 37: ₲227.080
    mats:[
      {n:"Cemento tipo 1",q:22.8,u:"kg"},
      {n:"Arena lavada",q:0.04,u:"m3"},
      {n:"Piedra triturada V",q:0.09,u:"tn"},
      {n:"Varilla conformada Ø6mm",q:1.80,u:"kg"},
      {n:"Alambre recocido Nº18",q:0.06,u:"kg"},
      {n:"Viguetas y ladrillos",q:1,u:"m2"},
    ]
  },
  "Losa Rap h=24cm (20+4)": {
    u:"m2", m:252000,
    // Mandua Costeo pág 37: ₲239.070
    mats:[
      {n:"Cemento tipo 1",q:24.2,u:"kg"},
      {n:"Arena lavada",q:0.05,u:"m3"},
      {n:"Piedra triturada V",q:0.11,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:1.80,u:"kg"},
      {n:"Viguetas y ladrillos",q:1,u:"m2"},
    ]
  },
  "Losa Listalosa": {
    u:"m2", m:233000,
    // Mandua Costeo pág 37: ₲220.400
    mats:[
      {n:"Cemento tipo 1",q:18,u:"kg"},
      {n:"Piedra triturada V",q:0.08,u:"tn"},
      {n:"Arena lavada",q:0.03,u:"m3"},
      {n:"Varilla conformada Ø6mm",q:1.87,u:"kg"},
      {n:"Vigueta listalosa",q:1,u:"m2"},
    ]
  },
  "Piso H°A° fck=21MPa 10cm": {
    u:"m2", m:220000,
    // Mandua Costeo pág 37: ₲208.087
    mats:[
      {n:"Cemento tipo 1",q:35,u:"kg"},
      {n:"Arena lavada de río",q:0.07,u:"m3"},
      {n:"Piedra triturada IV",q:0.13,u:"tn"},
      {n:"Varilla conformada Ø8mm",q:5,u:"kg"},
      {n:"Varilla lisa",q:1,u:"kg"},
      {n:"REOPLAST",q:0.35,u:"kg"},
      {n:"SIKAFLEX Sellador",q:0.33,u:"lt"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"FUNDACIONES": {
// ════════════════════════════════════════════════════════════════════════
  "Cimiento PBC con cal (1/2:1:4)": {
    u:"m3", m:440000,
    // Mandua Costeo pág 37: ₲419.850
    mats:[
      {n:"Piedra bruta blanca",q:1.20,u:"m3"},
      {n:"Cemento tipo 1",q:46,u:"kg"},
      {n:"Cal triturada",q:30,u:"kg"},
      {n:"Arena lavada",q:0.30,u:"m3"},
    ]
  },
  "Cimiento PBC sin cal (1:12)": {
    u:"m3", m:370000,
    // Mandua Costeo pág 37: ₲353.920
    mats:[
      {n:"Piedra bruta blanca",q:1.20,u:"m3"},
      {n:"Cemento tipo 1",q:80,u:"kg"},
      {n:"Arena lavada",q:0.60,u:"m3"},
    ]
  },
  "Cimiento H° Cascotes - Tierra Gorda": {
    u:"m3", m:322000,
    // Mandua Costeo pág 37: ₲310.000
    mats:[
      {n:"Tierra gorda",q:0.60,u:"m3"},
      {n:"Cemento tipo 1",q:80,u:"kg"},
      {n:"Cascotillo cerámico",q:0.80,u:"m3"},
    ]
  },
  "Cimiento H° Cascotes - Arena Lavada": {
    u:"m3", m:458000,
    // Mandua Costeo pág 37: ₲442.600
    mats:[
      {n:"Arena lavada",q:0.60,u:"m3"},
      {n:"Cemento tipo 1",q:200,u:"kg"},
      {n:"Cascotillo cerámico",q:0.80,u:"m3"},
    ]
  },
  "Hormigón Ciclópeo (1:3:6)": {
    u:"m3", m:716000,
    // Mandua Costeo pág 37: ₲685.500
    mats:[
      {n:"Piedra bruta blanca",q:0.40,u:"m3"},
      {n:"Cemento tipo 1",q:225,u:"kg"},
      {n:"Arena lavada",q:0.40,u:"m3"},
      {n:"Piedra triturada IV",q:1.05,u:"tn"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"MAMPOSTERÍA": {
// ════════════════════════════════════════════════════════════════════════
  "Nivelación 0.30m ladrillo común": {
    u:"m2", m:178000,
    // Mandua Costeo pág 37: ₲169.703
    mats:[
      {n:"Ladrillo común",q:122,u:"un"},
      {n:"Cemento tipo 1",q:14.1,u:"kg"},
      {n:"Cal triturada",q:13.3,u:"kg"},
      {n:"Arena lavada",q:0.10,u:"m3"},
    ]
  },
  "Elevación 0.15m ladrillo común": {
    u:"m2", m:96000,
    // Mandua Costeo pág 38: ₲91.838
    mats:[
      {n:"Ladrillo común",q:65,u:"un"},
      {n:"Cemento tipo 1",q:5.74,u:"kg"},
      {n:"Cal triturada",q:5.53,u:"kg"},
      {n:"Arena lavada",q:0.05,u:"m3"},
    ]
  },
  "Elevación 0.20m ladrillo común": {
    u:"m2", m:135000,
    // Mandua Costeo pág 38: ₲128.443
    mats:[
      {n:"Ladrillo común",q:95,u:"un"},
      {n:"Cemento tipo 1",q:8.80,u:"kg"},
      {n:"Cal triturada",q:8.50,u:"kg"},
      {n:"Arena lavada",q:0.09,u:"m3"},
    ]
  },
  "Elevación 0.30m ladrillo común": {
    u:"m2", m:173000,
    // Mandua Costeo pág 38: ₲164.845
    mats:[
      {n:"Ladrillo común",q:122,u:"un"},
      {n:"Cemento tipo 1",q:11.8,u:"kg"},
      {n:"Cal triturada",q:11.4,u:"kg"},
      {n:"Arena lavada",q:0.10,u:"m3"},
    ]
  },
  "Elevación 0.15m ladrillo cerámico 6 tubos": {
    u:"m2", m:62000,
    // Mandua Costeo pág 38: ₲54.868
    mats:[
      {n:"Ladrillo cerámico 6 tubos",q:20,u:"un"},
      {n:"Cemento tipo 1",q:1.80,u:"kg"},
      {n:"Cal triturada",q:1.70,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
    ]
  },
  "Elevación 0.20m ladrillo cerámico hueco": {
    u:"m2", m:88000,
    // Mandua Costeo pág 38: ₲83.423
    mats:[
      {n:"Ladrillo cerámico hueco 18x18x25cm",q:19,u:"un"},
      {n:"Cemento tipo 1",q:2.80,u:"kg"},
      {n:"Cal triturada",q:2.70,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
    ]
  },
  "Sardinel ladrillo común": {
    u:"ml", m:64000,
    // Mandua Costeo pág 38: ₲61.263
    mats:[
      {n:"Ladrillo común",q:16,u:"un"},
      {n:"Cemento tipo 1",q:2.10,u:"kg"},
      {n:"Cal triturada",q:0.90,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
    ]
  },
  "Sardinel ladrillo laminado": {
    u:"ml", m:78000,
    // Mandua Costeo pág 39: ₲67.773
    mats:[
      {n:"Ladrillo laminado Ita Yby",q:14,u:"un"},
      {n:"Cemento tipo 1",q:2.10,u:"kg"},
      {n:"Cal triturada",q:0.90,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
    ]
  },
  "Muro piedra bruta 30cm": {
    u:"m2", m:160000,
    // Mandua Costeo pág 39: ₲153.850
    mats:[
      {n:"Piedra bruta blanca",q:0.30,u:"m3"},
      {n:"Cemento tipo 1",q:12,u:"kg"},
      {n:"Cal triturada",q:14,u:"kg"},
      {n:"Arena lavada",q:0.10,u:"m3"},
    ]
  },
  "Pilar ladrillo común 30x30": {
    u:"ml", m:79000,
    // Mandua Costeo pág 39: ₲75.350
    mats:[
      {n:"Ladrillo común",q:35,u:"un"},
      {n:"Cemento tipo 1",q:10,u:"kg"},
      {n:"Cal triturada",q:4,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"CONTRAPISOS": {
// ════════════════════════════════════════════════════════════════════════
  "Contrapiso 7cm cascotes (1/4:1:4:6)": {
    u:"m2", m:36000,
    // Mandua Costeo pág 40: ₲34.440
    mats:[
      {n:"Cemento tipo 1",q:4,u:"kg"},
      {n:"Cal triturada",q:5,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
      {n:"Cascotillo cerámico",q:0.07,u:"m3"},
    ]
  },
  "Contrapiso 10cm cascotes (1/4:1:4:6)": {
    u:"m2", m:44500,
    // Mandua Costeo pág 40: ₲42.405
    mats:[
      {n:"Cemento tipo 1",q:5,u:"kg"},
      {n:"Cal triturada",q:6,u:"kg"},
      {n:"Arena lavada",q:0.04,u:"m3"},
      {n:"Cascotillo cerámico",q:0.09,u:"m3"},
    ]
  },
  "Contrapiso 20cm - Losa Sanitaria": {
    u:"m2", m:52000,
    // Mandua Costeo pág 40: ₲49.655
    mats:[
      {n:"Cemento tipo 1",q:7,u:"kg"},
      {n:"Cal triturada",q:10,u:"kg"},
      {n:"Arena lavada",q:0.05,u:"m3"},
      {n:"Cascotillo cerámico",q:0.09,u:"m3"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"REVOQUES": {
// ════════════════════════════════════════════════════════════════════════
  "Revoque 1 capa 1.5cm hidrófugo (1:4:16)": {
    u:"m2", m:33000,
    // Mandua Costeo pág 40: ₲31.365
    mats:[
      {n:"Cemento tipo 1",q:1.50,u:"kg"},
      {n:"Cal triturada",q:4,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
      {n:"Betocem hidrófugo",q:0.25,u:"lt"},
    ]
  },
  "Revoque 1 capa sin hidrófugo": {
    u:"m2", m:31500,
    // Mandua Costeo pág 40: ₲29.850
    mats:[
      {n:"Cemento tipo 1",q:1.50,u:"kg"},
      {n:"Cal triturada",q:4,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
    ]
  },
  "Revoque salpicado (1:3)": {
    u:"m2", m:28800,
    // Mandua Costeo pág 40: ₲27.488
    mats:[
      {n:"Cemento tipo 1",q:3,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
      {n:"Ceresita hidrófugo",q:0.25,u:"lt"},
    ]
  },
  "Azotada impermeable 0.5cm": {
    u:"m2", m:13000,
    // Mandua Costeo pág 40: ₲12.465
    mats:[
      {n:"Cemento tipo 1",q:2.70,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
      {n:"Ceresita hidrófugo",q:0.30,u:"lt"},
    ]
  },
  "Revoque cielorraso (1:4:12)": {
    u:"m2", m:52000,
    // Mandua Costeo pág 40: ₲49.658
    mats:[
      {n:"Cemento tipo 1",q:1.60,u:"kg"},
      {n:"Cal triturada",q:5.10,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"TECHOS": {
// ════════════════════════════════════════════════════════════════════════
  "Teja española s/ tejuelón c/ madera": {
    u:"m2", m:296000,
    // Mandua Costeo pág 40: ₲279.541
    mats:[
      {n:"Teja española Yoayu",q:28,u:"un"},
      {n:"Tejuelón 1ra Ita Yby",q:10,u:"un"},
      {n:"Tirante 2x5 ybyrapyta",q:20,u:"pulg/m"},
      {n:"Viga 4x8 ybyrapyta",q:3.80,u:"pulg/m"},
    ]
  },
  "Teja española s/ tejuelita": {
    u:"m2", m:291000,
    // Mandua Costeo pág 40: ₲275.351
    mats:[
      {n:"Teja española Yoayu",q:28,u:"un"},
      {n:"Tejuelita 1ra Yoayu",q:30,u:"un"},
      {n:"Tirante 2x5 ybyrapyta",q:20,u:"pulg/m"},
    ]
  },
  "Teja francesa s/ machimbre": {
    u:"m2", m:302000,
    // Mandua Costeo pág 40: ₲286.114
    mats:[
      {n:"Teja francesa 1ra Yoayu",q:16,u:"un"},
      {n:"Machimbre ybyrapyta 1x3",q:1.05,u:"m2"},
      {n:"Tirante 2x5 ybyrapyta",q:24,u:"pulg/m"},
      {n:"Listón cedro 1x2",q:2,u:"ml"},
    ]
  },
  "Chapa Nº28 s/ caños metálicos": {
    u:"m2", m:122214,
    // Mandua Costeo pág 40: ₲122.214
    mats:[
      {n:"Caño rectangular 30x50x1.20mm",q:1,u:"ml"},
      {n:"Chapa zinc Nº28",q:1.05,u:"m2"},
      {n:"Tornillo autoroscante 2",q:4,u:"un"},
    ]
  },
  "Chapa Nº28 s/ varillas torsionadas": {
    u:"m2", m:197504,
    // Mandua Costeo pág 40: ₲197.504
    mats:[
      {n:"Varilla torsionada",q:6,u:"kg"},
      {n:"Chapa zinc Nº28",q:1.05,u:"m2"},
    ]
  },
  "Chapa fibrocemento ondulada 6mm": {
    u:"m2", m:83440,
    // Mandua Costeo pág 41: ₲83.440
    mats:[
      {n:"Chapa fibrocemento ondulada 6mm",q:0.40,u:"un"},
      {n:"Tirante 2x5 ybyrapyta",q:5,u:"pulg/m"},
      {n:"Clavo 1 a 7 pulgadas",q:0.03,u:"kg"},
    ]
  },
  "Techo metálico chapa trapezoidal": {
    u:"m2", m:172464,
    // Mandua Costeo pág 41: ₲172.464
    mats:[
      {n:"Chapa trapezoidal Nº27",q:1,u:"m2"},
      {n:"Perfil U 100x40 1.8mm",q:1,u:"ml"},
      {n:"Perfil C 100x38 1.80mm",q:1,u:"ml"},
      {n:"Tornillos 12x2",q:4,u:"un"},
    ]
  },
  "Entrepiso de madera": {
    u:"m2", m:149200,
    // Mandua Costeo pág 41: ₲149.200
    mats:[
      {n:"Tirante ybyrapyta",q:20,u:"pulg/m"},
      {n:"Machimbre ybyrapyta 1x3",q:1.10,u:"m2"},
      {n:"Clavo",q:0.25,u:"kg"},
    ]
  },

// ─── TECHOS TERMOACÚSTICOS / METÁLICOS MODERNOS (Mayo 2026) ──────────
// Sistemas premium con aislación térmica/acústica integrada
// Fuentes: Tecnimetal PY, Mercofer, Isopanel SA, Clasipar 2026

  "Chapa termoacústica trapez. EPS 30mm s/ estructura existente": {
    u:"m2", m:240000,
    // Solo provisión y colocación, estructura aparte
    // Ref: Tecnimetal PY 2026 ~₲240k/m² instalado
    mats:[
      {n:"Chapa termoacústica trapez. EPS 30mm",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:8,u:"un"},
    ]
  },
  "Chapa termoacústica trapez. EPS 50mm s/ estructura existente": {
    u:"m2", m:275000,
    // La más usada — buen balance precio/aislación
    // Ref: Tecnimetal PY 2026 ~₲290k/m²
    mats:[
      {n:"Chapa termoacústica trapez. EPS 50mm",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:8,u:"un"},
    ]
  },
  "Chapa termoacústica PUR 30mm (premium)": {
    u:"m2", m:355000,
    // Núcleo poliuretano — mejor aislación térmica que EPS
    // Ref: Tecnimetal PY 2026 ~₲390k/m²
    mats:[
      {n:"Chapa termoacústica trapez. PUR 30mm",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:8,u:"un"},
    ]
  },
  "Chapa termoacústica colonial (imit. teja)": {
    u:"m2", m:325000,
    // Estética colonial paraguaya con aislación moderna
    mats:[
      {n:"Chapa termoacústica colonial EPS 40mm",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:8,u:"un"},
    ]
  },

  "Tinglado completo c/ estructura + chapa trapez.": {
    u:"m2", m:185000,
    // Llave en mano: estructura metálica + chapa simple acanalada/trapezoidal
    // Ref: Tecnimetal PY 2026: ₲160k-180k/m²
    mats:[
      {n:"Perfil C galvanizado 100x50",q:0.8,u:"ml"},
      {n:"Cabriada metálica armada (kg)",q:5,u:"kg"},
      {n:"Chapa trapezoidal Nº27",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:8,u:"un"},
    ]
  },
  "Tinglado completo c/ estructura + termoacústica": {
    u:"m2", m:295000,
    // Llave en mano: estructura + chapa termoacústica EPS 50mm
    // Ref: Clasipar PY 2026: ₲250k-290k/m²
    mats:[
      {n:"Perfil C galvanizado 100x50",q:0.8,u:"ml"},
      {n:"Cabriada metálica armada (kg)",q:5,u:"kg"},
      {n:"Chapa termoacústica trapez. EPS 50mm",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:8,u:"un"},
    ]
  },
  "Cabriada metálica armada (por kg)": {
    u:"kg", m:14500,
    // Para galpones/tinglados grandes — armada y soldada en obra
    mats:[
      {n:"Cabriada metálica armada (kg)",q:1,u:"kg"},
    ]
  },

// ─── ACCESORIOS Y TERMINACIONES DE TECHO ────────────────────────────
  "Lucernario policarbonato alveolar 6mm": {
    u:"m2", m:135000,
    // Translúcido para iluminación natural — quinchos, locales
    mats:[
      {n:"Policarbonato alveolar 6mm",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:6,u:"un"},
    ]
  },
  "Cerramiento lateral chapa traslúcida": {
    u:"m2", m:195000,
    // Para galpones y tinglados — entra luz natural
    mats:[
      {n:"Chapa traslúcida fibra vidrio acanal.",q:1.05,u:"m2"},
      {n:"Tornillo autoperforante c/ arandela",q:6,u:"un"},
    ]
  },
  "Cumbrera galvanizada universal": {
    u:"ml", m:38000,
    // Remate superior del techo
    mats:[
      {n:"Cumbrera galvanizada universal",q:1.05,u:"ml"},
      {n:"Tornillo autoperforante c/ arandela",q:4,u:"un"},
    ]
  },
  "Canaleta zinc Nº24 colocada": {
    u:"ml", m:55000,
    // Desagüe pluvial perimetral
    mats:[
      {n:"Canaleta zinc Nº24 desarrollada",q:1.05,u:"ml"},
    ]
  },
  "Bajada pluvial PVC 100mm completa": {
    u:"ml", m:32000,
    // Caño + abrazaderas + codos
    mats:[
      {n:"Bajada PVC 100mm pluvial",q:1.05,u:"ml"},
      {n:"Codos y accesorios pluvial PVC 100mm",q:0.2,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"PISOS": {
// ════════════════════════════════════════════════════════════════════════
  "Baldosa calcárea 20x20cm": {
    u:"m2", m:82000,
    // Mandua Costeo pág 41: ₲79.225
    mats:[
      {n:"Baldosa calcárea 20x20cm",q:1.05,u:"m2"},
      {n:"Cemento tipo 1",q:4,u:"kg"},
      {n:"Cal triturada",q:3,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
      {n:"Pastina base gris",q:0.20,u:"kg"},
    ]
  },
  "Mosaico granítico gris 30x30cm": {
    u:"m2", m:147000,
    // Mandua Costeo pág 41: ₲141.975
    mats:[
      {n:"Mosaico granítico gris 30x30cm",q:1.05,u:"m2"},
      {n:"Cemento tipo 1",q:8,u:"kg"},
      {n:"Cal triturada",q:7,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
  "Mosaico granítico blanco 30x30cm": {
    u:"m2", m:155000,
    // Mandua Costeo pág 41: ₲149.325
    mats:[
      {n:"Mosaico granítico blanco 30x30cm",q:1.05,u:"m2"},
      {n:"Cemento tipo 1",q:8,u:"kg"},
      {n:"Cal triturada",q:7,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
  "Cerámica esmaltada Cecafi 32x57cm": {
    u:"m2", m:77000,
    // Mandua Costeo pág 41: ₲75.093
    mats:[
      {n:"Cerámica Cecafi 32x57cm",q:1.05,u:"m2"},
      {n:"Mezcla adhesiva",q:3.50,u:"kg"},
      {n:"Pastina base blanca",q:0.20,u:"kg"},
    ]
  },
  "Cerámica Cecafi 45x45cm": {
    u:"m2", m:82500,
    // Mandua Costeo pág 41: ₲80.226
    mats:[
      {n:"Piso Cecafi 45x45cm",q:1.05,u:"m2"},
      {n:"Mezcla adhesiva",q:2,u:"kg"},
      {n:"Pastina base blanca",q:0.20,u:"kg"},
    ]
  },
  "Porcelanato 60x60cm": {
    u:"m2", m:152000,
    // Mandua Costeo pág 41: ₲147.846
    mats:[
      {n:"Porcelanato 60x60cm",q:1.05,u:"m2"},
      {n:"Mezcla adhesiva",q:2,u:"kg"},
      {n:"Pastina base blanca",q:0.20,u:"kg"},
    ]
  },
  "Layota 28x28cm Yoayu": {
    u:"m2", m:58500,
    // Mandua Costeo pág 41: ₲56.017
    mats:[
      {n:"Layota 1ra Yoayu 28x28cm",q:12,u:"un"},
      {n:"Cemento tipo 1",q:4,u:"kg"},
      {n:"Cal triturada",q:3,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
  "Piedra losa rompecabeza": {
    u:"m2", m:92000,
    // Mandua Costeo pág 41: ₲89.200
    mats:[
      {n:"Piedra losa blanca",q:1.05,u:"m2"},
      {n:"Cemento tipo 1",q:6,u:"kg"},
      {n:"Cal triturada",q:4,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"AISLACIÓN": {
// ════════════════════════════════════════════════════════════════════════
  "Horizontal 0.30m con asfalto": {
    u:"ml", m:33000,
    // Mandua Costeo pág 39: ₲31.818
    mats:[
      {n:"Cemento tipo 1",q:1.80,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
      {n:"Negrolin (asfalto)",q:1,u:"lt"},
    ]
  },
  "Horizontal 0.15m con asfalto": {
    u:"ml", m:19500,
    // Mandua Costeo pág 39: ₲18.844
    mats:[
      {n:"Cemento tipo 1",q:1,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
      {n:"Negrolin (asfalto)",q:0.50,u:"lt"},
    ]
  },
  "Vertical panderete 0.15m": {
    u:"m2", m:111000,
    // Mandua Costeo pág 39: ₲106.691
    mats:[
      {n:"Ladrillo común",q:27,u:"un"},
      {n:"Cemento tipo 1",q:5,u:"kg"},
      {n:"Arena lavada",q:0.30,u:"m3"},
      {n:"Negrolin (asfalto)",q:2,u:"lt"},
      {n:"Betocem hidrófugo",q:0.25,u:"lt"},
    ]
  },
  "Losa para baño": {
    u:"m2", m:62000,
    // Mandua Costeo pág 39: ₲59.847
    mats:[
      {n:"Cemento tipo 1",q:7,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
      {n:"Negrolin (asfalto)",q:1.50,u:"lt"},
      {n:"Betocem hidrófugo",q:0.25,u:"lt"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"PINTURAS": {
// ════════════════════════════════════════════════════════════════════════
  "Pintura a la cal": {
    u:"m2", m:15000,
    // Mandua Costeo pág 51: ₲14.255 (con colorante)
    mats:[
      {n:"Cal triturada",q:0.50,u:"kg"},
      {n:"Colorante 100cc",q:0.05,u:"un"},
      {n:"Fijador Inatix",q:0.60,u:"lt"},
      {n:"Lija",q:0.25,u:"un"},
    ]
  },
  "Látex interior con enduido": {
    u:"m2", m:37000,
    // Mandua Costeo pág 51: ₲35.399
    mats:[
      {n:"Lija",q:0.25,u:"un"},
      {n:"Sellador acrílico",q:0.05,u:"lt"},
      {n:"Látex interior",q:0.30,u:"lt"},
      {n:"Enduido interior",q:1.20,u:"kg"},
    ]
  },
  "Látex interior sin enduido": {
    u:"m2", m:23500,
    // Mandua Costeo pág 51: ₲22.591
    mats:[
      {n:"Lija",q:0.25,u:"un"},
      {n:"Sellador acrílico",q:0.05,u:"lt"},
      {n:"Látex interior",q:0.30,u:"lt"},
    ]
  },
  "Látex exterior con enduido": {
    u:"m2", m:37700,
    // Mandua Costeo pág 51: ₲35.975
    mats:[
      {n:"Lija",q:0.25,u:"un"},
      {n:"Sellador acrílico",q:0.05,u:"lt"},
      {n:"Látex exterior",q:0.30,u:"lt"},
      {n:"Enduido exterior",q:1.20,u:"kg"},
    ]
  },
  "Látex exterior sin enduido": {
    u:"m2", m:22591,
    // Mandua Costeo pág 51: ₲22.591
    mats:[
      {n:"Lija",q:0.25,u:"un"},
      {n:"Látex exterior",q:0.30,u:"lt"},
    ]
  },
  "Barnizado machimbre": {
    u:"m2", m:28500,
    // Mandua Costeo pág 51: ₲27.316
    mats:[
      {n:"Aceite de linaza",q:0.20,u:"lt"},
      {n:"Barniz sintético brillante",q:0.25,u:"lt"},
    ]
  },
  "Tejuela al barniz": {
    u:"m2", m:28000,
    // Mandua Costeo pág 51: ₲26.870
    mats:[
      {n:"Ácido muriático",q:0.07,u:"lt"},
      {n:"Barniz sintético brillante",q:0.25,u:"lt"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"CARPINTERÍA MADERA": {
// ════════════════════════════════════════════════════════════════════════
  "Marco ybyrapyta puerta 0.70m": {
    u:"un", m:400750,
    // Mandua Costeo pág 49: ₲400.750
    mats:[
      {n:"Marco ybyrapyta",q:5.10,u:"ml"},
      {n:"Tirafondo galvanizado 3/8x5",q:5,u:"un"},
      {n:"Cemento tipo 1",q:1,u:"kg"},
    ]
  },
  "Marco ybyrapyta puerta 0.80m": {
    u:"un", m:407750,
    // Mandua Costeo pág 49: ₲407.750
    mats:[
      {n:"Marco ybyrapyta",q:5.40,u:"ml"},
      {n:"Tirafondo galvanizado 3/8x5",q:5,u:"un"},
    ]
  },
  "Marco ybyrapyta ventana 1.50m": {
    u:"un", m:443750,
    // Mandua Costeo pág 49: ₲443.750
    mats:[
      {n:"Marco ybyrapyta",q:5.80,u:"ml"},
      {n:"Tirafondo galvanizado 3/8x5",q:8,u:"un"},
    ]
  },
  "Puerta tablero eucalipto 0.80x2.10m": {
    u:"un", m:1185500,
    // Mandua Costeo pág 50: ₲1.185.500
    mats:[
      {n:"Puerta tablero eucalipto",q:1,u:"un"},
      {n:"Ficha 5 agujeros",q:1.50,u:"par"},
      {n:"Cerradura externa c/manija",q:1,u:"un"},
    ]
  },
  "Puerta tablero punta diamante 0.80x2.10m": {
    u:"un", m:1855500,
    // Mandua Costeo pág 50: ₲1.855.500
    mats:[
      {n:"Puerta tablero punta diamante",q:1,u:"un"},
      {n:"Ficha 5 agujeros",q:1.50,u:"par"},
      {n:"Cerradura externa c/manija",q:1,u:"un"},
    ]
  },
  "Persiana 1.50x2.10m 3 hojas": {
    u:"un", m:1705000,
    // Mandua Costeo pág 50: ₲1.705.000
    mats:[
      {n:"Hoja persiana varilla 45cm",q:3.15,u:"m2"},
      {n:"Ficha 5 agujeros",q:3,u:"par"},
      {n:"Tornillo 1x7",q:60,u:"un"},
    ]
  },
  "Vidriera 1.50x2.10m 3 hojas": {
    u:"un", m:1232500,
    // Mandua Costeo pág 50: ₲1.232.500
    mats:[
      {n:"Puerta vidriera eucalipto",q:3.15,u:"m2"},
      {n:"Ficha 5 agujeros",q:3,u:"par"},
      {n:"Tornillo 1x7",q:60,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"CARPINTERÍA METÁLICA": {
// ════════════════════════════════════════════════════════════════════════
  "Balancín hasta 1m²": {
    u:"m2", m:258750,
    // Mandua Costeo pág 50: ₲258.750
    mats:[
      {n:"Balancín fabricado",q:1,u:"m2"},
      {n:"Cemento tipo 1",q:1,u:"kg"},
    ]
  },
  "Portón cochera 3.00x2.00m": {
    u:"un", m:2027450,
    // Mandua Costeo pág 51: ₲2.027.450
    mats:[
      {n:"Portón con cerradura",q:6,u:"m2"},
      {n:"Cemento tipo 1",q:5,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
  "Portón cochera 4.40x4.00m": {
    u:"un", m:5166250,
    // Mandua Costeo pág 51: ₲5.166.250
    mats:[
      {n:"Portón con cerradura",q:17.6,u:"m2"},
      {n:"Cemento tipo 1",q:10,u:"kg"},
    ]
  },
  "Escalera metálica recta": {
    u:"un", m:1503750,
    // Mandua Costeo pág 51: ₲1.503.750
    mats:[
      {n:"Escalera metálica",q:4,u:"un"},
      {n:"Cemento tipo 1",q:5,u:"kg"},
    ]
  },
  "Reja hierro artística 1.50x1.20m": {
    u:"un", m:497950,
    // Mandua Costeo pág 51: ₲497.950
    mats:[
      {n:"Reja artística",q:1.80,u:"m2"},
      {n:"Cemento tipo 1",q:3,u:"kg"},
    ]
  },
  "Cortina metálica 2.40x2.60m": {
    u:"un", m:4346000,
    // Mandua Costeo pág 51: ₲4.346.000
    mats:[
      {n:"Cortina metálica enrollable",q:1,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"DESAGÜE CLOACAL": {
// ════════════════════════════════════════════════════════════════════════
  "Boca de desagüe 20x20x20cm": {
    u:"un", m:165525,
    // Mandua Costeo pág 43: ₲165.525
    mats:[
      {n:"Ladrillo común",q:50,u:"un"},
      {n:"Cemento tipo 1",q:5,u:"kg"},
      {n:"Arena lavada",q:0.04,u:"m3"},
      {n:"Cal triturada",q:5,u:"kg"},
      {n:"Rejilla hierro 20x20cm",q:1,u:"un"},
    ]
  },
  "Boca de desagüe 30x30x30cm": {
    u:"un", m:219325,
    // Mandua Costeo pág 43: ₲219.325
    mats:[
      {n:"Ladrillo común",q:65,u:"un"},
      {n:"Cemento tipo 1",q:7,u:"kg"},
      {n:"Arena lavada",q:0.05,u:"m3"},
      {n:"Cal triturada",q:7,u:"kg"},
      {n:"Rejilla hierro 30x30cm",q:1,u:"un"},
    ]
  },
  "Registro 30x30x30cm": {
    u:"un", m:213025,
    // Mandua Costeo pág 43: ₲213.025
    mats:[
      {n:"Ladrillo común",q:65,u:"un"},
      {n:"Cemento tipo 1",q:7,u:"kg"},
      {n:"Arena lavada",q:0.05,u:"m3"},
      {n:"Cal triturada",q:7,u:"kg"},
      {n:"Tapa H° 30x30cm",q:1,u:"un"},
    ]
  },
  "Caño PVC 40mm (desagüe)": {
    u:"ml", m:21450,
    // Mandua Costeo pág 43: ₲21.450
    mats:[{n:"Caño PVC 40mm",q:1,u:"ml"}]
  },
  "Caño PVC 50mm (desagüe)": {
    u:"ml", m:25250,
    // Mandua Costeo pág 43: ₲25.250
    mats:[{n:"Caño PVC 50mm",q:1,u:"ml"}]
  },
  "Caño PVC 100mm (desagüe)": {
    u:"ml", m:49000,
    // Mandua Costeo pág 43: ₲49.000
    mats:[{n:"Caño PVC 100mm",q:1,u:"ml"}]
  },
  "Pozo ciego Ø1.50m h=3.00m": {
    u:"un", m:2617500,
    // Mandua Costeo pág 44: ₲2.617.500
    mats:[
      {n:"Ladrillo común",q:1100,u:"un"},
      {n:"Cemento tipo 1",q:150,u:"kg"},
      {n:"Arena lavada",q:0.50,u:"m3"},
    ]
  },
  "Cámara séptica 1.00x1.60x1.20m": {
    u:"un", m:1578250,
    // Mandua Costeo pág 44: ₲1.578.250
    mats:[
      {n:"Ladrillo común",q:420,u:"un"},
      {n:"Cemento tipo 1",q:100,u:"kg"},
      {n:"Cal triturada",q:50,u:"kg"},
      {n:"Arena lavada",q:1.50,u:"m3"},
      {n:"Varilla conformada Ø6mm",q:2.50,u:"kg"},
    ]
  },
  "Rejilla de piso sifonada 150x150mm": {
    u:"un", m:141000,
    // Mandua Costeo pág 44: ₲141.000
    mats:[{n:"Caja sifonada 150x150x50mm",q:1,u:"un"}]
  },
},

// ════════════════════════════════════════════════════════════════════════
"AGUA CORRIENTE": {
// ════════════════════════════════════════════════════════════════════════
  "Caño PVC roscable 1 pulgada": {
    u:"ml", m:43850,
    // Mandua Costeo pág 45: ₲43.850
    mats:[{n:"Caño PVC roscable 1 pulgada",q:1,u:"ml"}]
  },
  "Caño PVC roscable 3/4 pulgada": {
    u:"ml", m:25850,
    // Mandua Costeo pág 45: ₲25.850
    mats:[{n:"Caño PVC roscable 3/4 pulgada",q:1,u:"ml"}]
  },
  "Caño PVC roscable 1/2 pulgada": {
    u:"ml", m:17850,
    // Mandua Costeo pág 45: ₲17.850
    mats:[{n:"Caño PVC roscable 1/2 pulgada",q:1,u:"ml"}]
  },
  "Instalación agua fría - baño completo": {
    u:"un", m:727090,
    // Mandua Costeo pág 45: ₲727.090
    mats:[
      {n:"Caño 1/2 roscable",q:9,u:"ml"},
      {n:"Codo 90° roscable 1/2",q:6,u:"un"},
      {n:"Llave de paso 1/2 FV cromada",q:2,u:"un"},
      {n:"Tapón roscable 1/2",q:4,u:"un"},
      {n:"Cinta teflón 18mmx25m",q:2,u:"un"},
    ]
  },
  "Instalación agua fría - baño servicio": {
    u:"un", m:521975,
    // Mandua Costeo pág 45: ₲521.975
    mats:[
      {n:"Caño 1/2 roscable",q:6,u:"ml"},
      {n:"Codo 90° roscable 1/2",q:6,u:"un"},
      {n:"Tapón roscable 1/2",q:2,u:"un"},
      {n:"Cinta teflón 18mmx25m",q:1,u:"un"},
    ]
  },
  "Instalación agua fría - baño social": {
    u:"un", m:320380,
    // Mandua Costeo pág 45: ₲320.380
    mats:[
      {n:"Caño 1/2 roscable",q:4,u:"ml"},
      {n:"Codo 90° roscable 1/2",q:6,u:"un"},
      {n:"Tapón roscable 1/2",q:2,u:"un"},
      {n:"Cinta teflón 18mmx25m",q:1,u:"un"},
    ]
  },
  "Instalación agua fría - pileta cocina": {
    u:"un", m:220810,
    // Mandua Costeo pág 46: ₲220.810
    mats:[
      {n:"Caño 1/2 roscable",q:2,u:"ml"},
      {n:"Codo 90° roscable 1/2",q:3,u:"un"},
      {n:"Tapón roscable 1/2",q:1,u:"un"},
    ]
  },
  "Tanque cisterna fibra de vidrio 1000lt": {
    u:"un", m:1010900,
    // Mandua Costeo pág 52: ₲1.010.900
    mats:[
      {n:"Ladrillo común",q:100,u:"un"},
      {n:"Cemento tipo 1",q:12,u:"kg"},
      {n:"Cal triturada",q:10,u:"kg"},
      {n:"Tanque Fibrac 1000lt",q:1,u:"un"},
      {n:"Dintel prefabricado 1mx14cm",q:2,u:"un"},
    ]
  },
  "Tanque cisterna fibra de vidrio 500lt": {
    u:"un", m:715950,
    // Mandua Costeo pág 52: ₲715.950
    mats:[
      {n:"Ladrillo común",q:100,u:"un"},
      {n:"Cemento tipo 1",q:12,u:"kg"},
      {n:"Cal triturada",q:10,u:"kg"},
      {n:"Arena lavada",q:0.30,u:"m3"},
      {n:"Varilla conformada Ø6mm",q:3,u:"kg"},
      {n:"Tanque Fibrac 500lt",q:1,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"ARTEFACTOS SANITARIOS": {
// ════════════════════════════════════════════════════════════════════════
  "Baño completo frío y caliente (sin bañera)": {
    u:"un", m:7604143,
    // Mandua Costeo pág 46: ₲7.604.143
    mats:[
      {n:"Juego WC cisterna Deca Ravena",q:1,u:"un"},
      {n:"Grifería FV Línea Clásica",q:1,u:"un"},
      {n:"Termocalefón 80lt",q:1,u:"un"},
      {n:"Botiquín 44x58x11cm",q:1,u:"un"},
      {n:"Ducha eléctrica Corona",q:1,u:"un"},
    ]
  },
  "Baño completo con bañera común": {
    u:"un", m:8886143,
    // Mandua Costeo pág 46: ₲8.886.143
    mats:[
      {n:"Juego WC cisterna Deca Ravena",q:1,u:"un"},
      {n:"Grifería FV Línea Clásica",q:1,u:"un"},
      {n:"Bañera 1.60x0.70m",q:1,u:"un"},
    ]
  },
  "Baño social standard": {
    u:"un", m:1890163,
    // Mandua Costeo pág 47: ₲1.890.163
    mats:[
      {n:"Juego WC cisterna alta Deca",q:1,u:"un"},
      {n:"Canilla lavatorio FV",q:1,u:"un"},
      {n:"Prolongador FV cromo",q:2,u:"un"},
    ]
  },
  "Pileta cocina acero inoxidable": {
    u:"un", m:598000,
    // Mandua Costeo pág 47: ₲598.000
    mats:[
      {n:"Pileta 1 bacha acero inox",q:1,u:"un"},
      {n:"Grifería externa FV",q:1,u:"un"},
    ]
  },
  "Mesada granito para cocina": {
    u:"un", m:2139000,
    // Mandua Costeo pág 47: ₲2.139.000
    mats:[
      {n:"Granito natural",q:2.28,u:"m2"},
      {n:"Moldura pecho paloma",q:3.20,u:"ml"},
      {n:"Zócalo de granito",q:0.50,u:"m2"},
    ]
  },
  "Mesada mármol baño 0.70x0.60m": {
    u:"un", m:602000,
    // Mandua Costeo pág 47: ₲602.000
    mats:[
      {n:"Mármol blanco",q:0.42,u:"m2"},
      {n:"Moldura pecho paloma",q:1.90,u:"ml"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"INSTALACIÓN ELÉCTRICA": {
// ════════════════════════════════════════════════════════════════════════
  "Lámpara con interruptor": {
    u:"un", m:101869,
    // Mandua Costeo pág 49: ₲101.869
    mats:[
      {n:"Caja llave plástica",q:1,u:"un"},
      {n:"Caja metálica conexión",q:1,u:"un"},
      {n:"Caño corrugado 3/4",q:5,u:"ml"},
      {n:"Cable 2mm",q:11,u:"ml"},
      {n:"Llave unipolar + tapa",q:1,u:"un"},
    ]
  },
  "Tomacorriente": {
    u:"un", m:101869,
    // Mandua Costeo pág 49: ₲101.869
    mats:[
      {n:"Caja llave plástica",q:1,u:"un"},
      {n:"Caja metálica conexión",q:1,u:"un"},
      {n:"Caño corrugado 3/4",q:5,u:"ml"},
      {n:"Cable 2mm",q:11,u:"ml"},
    ]
  },
  "Tablero principal 6 llaves TM": {
    u:"un", m:549700,
    // Mandua Costeo pág 49: ₲549.700
    mats:[
      {n:"Caja tablero principal",q:1,u:"un"},
      {n:"Disyuntor TM 1x10A",q:6,u:"un"},
    ]
  },
  "Circuito calefón / AA / ducha eléctrica": {
    u:"un", m:356152,
    // Mandua Costeo pág 49: ₲356.152
    mats:[
      {n:"Caja llave plástica",q:1,u:"un"},
      {n:"Llave para calefón 25",q:1,u:"un"},
      {n:"Cable 4mm",q:13,u:"ml"},
      {n:"Caño corrugado 3/4",q:5,u:"ml"},
    ]
  },
  "Pilar mampostería 0.45x0.45x1.70m": {
    u:"un", m:789070,
    // Mandua Costeo pág 47: ₲789.070
    mats:[
      {n:"Ladrillo común",q:170,u:"un"},
      {n:"Cemento tipo 1",q:30,u:"kg"},
      {n:"Cal triturada",q:60,u:"kg"},
      {n:"Arena lavada",q:0.25,u:"m3"},
    ]
  },
  "Puesto medición monofásico 40A": {
    u:"un", m:1532990,
    // Mandua Costeo pág 48: ₲1.532.990
    mats:[
      {n:"Caño galvanizado",q:1,u:"un"},
      {n:"Curva galvanizada 1 pulgada",q:2,u:"un"},
      {n:"Disyuntor TM 1x10A",q:1,u:"un"},
      {n:"Cable 4mm",q:40,u:"ml"},
    ]
  },

// ─── TABLEROS Y PROTECCIONES MODERNAS (Mayo 2026) ────────────────────
// Sistemas con riel DIN, llaves termomagnéticas y diferenciales
// Fuentes: Sensorview, Conecta PY, Promart, AutoSolar 2026

  "Tablero monofásico 12 polos completo": {
    u:"un", m:1180000,
    // Vivienda media: 1 termomagnética principal + 4 secundarias + 1 diferencial
    mats:[
      {n:"Tablero PVC 12 polos riel DIN",q:1,u:"un"},
      {n:"Llave termomagnética 1P 32A",q:1,u:"un"},
      {n:"Llave termomagnética 1P 16A",q:4,u:"un"},
      {n:"Llave diferencial 2P 25A 30mA",q:1,u:"un"},
      {n:"Riel DIN 35mm x 1m",q:0.5,u:"ml"},
    ]
  },
  "Tablero TRIFÁSICO 12 polos completo": {
    u:"un", m:1850000,
    // Vivienda grande / local comercial chico
    // 1 llave principal trifásica + diferencial trifásico + 6 termomagnéticas
    mats:[
      {n:"Tablero PVC 12 polos riel DIN",q:1,u:"un"},
      {n:"Llave termomagnética 3P 40A",q:1,u:"un"},
      {n:"Llave diferencial 4P 40A 30mA",q:1,u:"un"},
      {n:"Llave termomagnética 1P 16A",q:4,u:"un"},
      {n:"Llave termomagnética 1P 32A",q:2,u:"un"},
      {n:"Riel DIN 35mm x 1m",q:0.5,u:"ml"},
    ]
  },
  "Tablero TRIFÁSICO 24 polos completo": {
    u:"un", m:3200000,
    // Local comercial mediano / oficina
    mats:[
      {n:"Tablero PVC 24 polos riel DIN",q:1,u:"un"},
      {n:"Llave termomagnética 3P 63A",q:1,u:"un"},
      {n:"Llave diferencial 4P 40A 30mA",q:2,u:"un"},
      {n:"Llave termomagnética 1P 16A",q:8,u:"un"},
      {n:"Llave termomagnética 1P 32A",q:4,u:"un"},
      {n:"Llave termomagnética 3P 25A",q:1,u:"un"},
      {n:"Riel DIN 35mm x 1m",q:1,u:"ml"},
    ]
  },
  "Tablero TRIFÁSICO 36 polos industrial": {
    u:"un", m:5800000,
    // Industria liviana / locales grandes con maquinaria
    mats:[
      {n:"Tablero metálico 36 polos industrial",q:1,u:"un"},
      {n:"Llave termomagnética 3P 63A",q:2,u:"un"},
      {n:"Llave diferencial 4P 40A 30mA",q:3,u:"un"},
      {n:"Llave termomagnética 1P 32A",q:6,u:"un"},
      {n:"Llave termomagnética 3P 25A",q:3,u:"un"},
      {n:"Llave termomagnética 3P 40A",q:2,u:"un"},
      {n:"Riel DIN 35mm x 1m",q:1.5,u:"ml"},
    ]
  },

// ─── PROTECCIONES INDIVIDUALES (POR UNIDAD) ─────────────────────────
  "Llave termomagnética 1P (16A/25A/32A)": {
    u:"un", m:90000,
    mats:[
      {n:"Llave termomagnética 1P 25A",q:1,u:"un"},
    ]
  },
  "Llave termomagnética 3P (25A/40A) trifásica": {
    u:"un", m:340000,
    mats:[
      {n:"Llave termomagnética 3P 40A",q:1,u:"un"},
    ]
  },
  "Llave diferencial 2P 25A 30mA (salvavidas)": {
    u:"un", m:330000,
    // Obligatorio en circuitos residenciales nuevos
    mats:[
      {n:"Llave diferencial 2P 25A 30mA",q:1,u:"un"},
    ]
  },
  "Llave diferencial 4P 40A 30mA trifásica": {
    u:"un", m:660000,
    mats:[
      {n:"Llave diferencial 4P 40A 30mA",q:1,u:"un"},
    ]
  },

// ─── TOMAS Y PUESTA A TIERRA ────────────────────────────────────────
  "Toma trifásico industrial 25A IP44": {
    u:"un", m:195000,
    // Para máquinas industriales, soldadoras, etc.
    mats:[
      {n:"Toma trifásico industrial 25A IP44",q:1,u:"un"},
    ]
  },
  "Toma trifásico industrial 32A IP44": {
    u:"un", m:255000,
    mats:[
      {n:"Toma trifásico industrial 32A IP44",q:1,u:"un"},
    ]
  },
  "Puesta a tierra completa (jabalina + cable)": {
    u:"un", m:425000,
    // Sistema de protección obligatorio según ANDE
    mats:[
      {n:"Jabalina cobre 1.5m + tomatierra",q:1,u:"un"},
      {n:"Cable cobre desnudo 35mm² (tierra)",q:8,u:"ml"},
      {n:"Borne unión bimetálico tierra",q:1,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"VARIOS": {
// ════════════════════════════════════════════════════════════════════════
  "Moldura doble": {
    u:"ml", m:115600,
    // Mandua Costeo pág 52: ₲115.600
    mats:[
      {n:"Ladrillo común",q:12,u:"un"},
      {n:"Arena lavada",q:0.10,u:"m3"},
      {n:"Cemento tipo 1",q:12,u:"kg"},
      {n:"Cal triturada",q:20,u:"kg"},
    ]
  },
  "Moldura sencilla": {
    u:"ml", m:59475,
    // Mandua Costeo pág 52: ₲59.475
    mats:[
      {n:"Cemento tipo 1",q:5,u:"kg"},
      {n:"Cal triturada",q:3,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
    ]
  },
  "Balaustre sencillo h=42cm": {
    u:"ml", m:56575,
    // Mandua Costeo pág 52: ₲56.575
    mats:[
      {n:"Balaustre sencillo h=42cm",q:5,u:"un"},
      {n:"Ladrillo común",q:12,u:"un"},
      {n:"Varilla conformada Ø6mm",q:0.50,u:"kg"},
      {n:"Cemento tipo 1",q:1,u:"kg"},
    ]
  },
  "Dintel hormigón prefabricado 1m x 14cm": {
    u:"un", m:45100,
    // Mandua Costeo pág 39: ₲45.100
    mats:[{n:"Dintel prefabricado 1mx14cm",q:1,u:"un"}]
  },
  "Estufa boca 1.00m": {
    u:"un", m:3043840,
    // Mandua Costeo pág 52: ₲3.043.840
    mats:[
      {n:"Ladrillo refractario",q:80,u:"un"},
      {n:"Cemento tipo 1",q:150,u:"kg"},
      {n:"Arena refractaria",q:3,u:"kg"},
      {n:"Varilla conformada Ø6mm",q:3,u:"kg"},
    ]
  },
  "Parrilla boca 1.00m": {
    u:"un", m:4995000,
    // Mandua Costeo pág 52: ₲4.995.000
    mats:[
      {n:"Ladrillo común",q:750,u:"un"},
      {n:"Cemento tipo 1",q:150,u:"kg"},
      {n:"Arena lavada",q:1,u:"m3"},
      {n:"Varilla conformada Ø6mm",q:6,u:"kg"},
      {n:"Parrilla enlozada con carbonera",q:1,u:"un"},
    ]
  },
  "Tanque cisterna fibra de vidrio 1000lt (varios)": {
    u:"un", m:1010900,
    // Mandua Costeo pág 52: ₲1.010.900
    mats:[
      {n:"Ladrillo común",q:100,u:"un"},
      {n:"Cemento tipo 1",q:12,u:"kg"},
      {n:"Cal triturada",q:10,u:"kg"},
      {n:"Tanque Fibrac 1000lt",q:1,u:"un"},
      {n:"Dintel prefabricado 1mx14cm",q:2,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
// NUEVOS RUBROS — Fuente: Guía de Costos Agosto 2025
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
"DEMOLICIONES": {
// ════════════════════════════════════════════════════════════════════════
  "Demolición muro 0.15m con recuperación": {
    u:"m2", m:8000,
    mats:[]
  },
  "Demolición muro 0.30m con recuperación": {
    u:"m2", m:10000,
    mats:[]
  },
  "Demolición muro 0.15m sin recuperación": {
    u:"m2", m:6000,
    mats:[]
  },
  "Demolición techo madera-tejuelita-tejas": {
    u:"m2", m:15000,
    mats:[]
  },
  "Demolición contrapisos": {
    u:"m2", m:3000,
    mats:[]
  },
  "Demolición piso-revoques-revestimientos": {
    u:"m2", m:4000,
    mats:[]
  },
  "Demolición/desmonte de aberturas": {
    u:"un", m:8000,
    mats:[]
  },
  "Demolición cielorrasos armados": {
    u:"m2", m:4000,
    mats:[]
  },
  "Movimiento de suelo desmonte manual": {
    u:"m3", m:3000,
    mats:[]
  },
  "Relleno y compactación manual": {
    u:"m3", m:8000,
    mats:[]
  },
  "Excavación para cimiento sin acarreo": {
    u:"m3", m:6000,
    mats:[]
  },
  "Excavación para pozo ciego sin acarreo": {
    u:"m3", m:8000,
    mats:[]
  },
},

// ════════════════════════════════════════════════════════════════════════
"CIELO RASOS": {
// ════════════════════════════════════════════════════════════════════════
  "Cielo raso machimbre c/ estructura madera": {
    u:"m2", m:130700,
    mats:[
      {n:"Machimbre ybyrapyta 1x3",q:1.10,u:"m2"},
      {n:"Listón cedro 1x2",q:3,u:"ml"},
      {n:"Clavo",q:0.25,u:"kg"},
    ]
  },
  "Cielo raso metal desplegado c/ madera": {
    u:"m2", m:85000,
    mats:[
      {n:"Metal desplegado",q:1.05,u:"m2"},
      {n:"Listón cedro 1x2",q:2.5,u:"ml"},
    ]
  },
  "Revoque horizontal cielorraso 1 capa": {
    u:"m2", m:52000,
    mats:[
      {n:"Cemento tipo 1",q:1.60,u:"kg"},
      {n:"Cal triturada",q:5.10,u:"kg"},
      {n:"Arena lavada",q:0.01,u:"m3"},
    ]
  },
  "Revoque horizontal cielorraso 2 capas": {
    u:"m2", m:56000,
    mats:[
      {n:"Cemento tipo 1",q:2.50,u:"kg"},
      {n:"Cal triturada",q:7,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
    ]
  },

// ─── DURLOCK / PLACAS DE YESO ACARTONADO ──────────────────────────────
  "Cielo raso durlock estándar 9.5mm": {
    u:"m2", m:115000,
    // Sistema completo: placa + estructura + masilla + cinta
    // Ref: Clasipar PY 2026 ~120k/m2 instalado
    mats:[
      {n:"Placa durlock estándar 9.5mm",q:0.36,u:"un"}, // 1 placa cubre ~2.80m²
      {n:"Perfil F530 cielo raso x 4m",q:0.4,u:"un"},
      {n:"Perfil CR2 perimetral",q:0.7,u:"ml"},
      {n:"Cuelgue/tensor cielo raso",q:1.5,u:"un"},
      {n:"Tornillo T2 punta mecha (cien)",q:0.15,u:"un"},
      {n:"Cinta papel junta durlock 75m",q:0.04,u:"un"},
      {n:"Masilla durlock balde 28kg",q:0.05,u:"un"},
    ]
  },
  "Cielo raso durlock RH 12.5mm (baño/cocina)": {
    u:"m2", m:165000,
    // Placa verde resistente a humedad — esencial en zonas húmedas
    mats:[
      {n:"Placa durlock RH 12.5mm verde",q:0.36,u:"un"},
      {n:"Perfil F530 cielo raso x 4m",q:0.4,u:"un"},
      {n:"Perfil CR2 perimetral",q:0.7,u:"ml"},
      {n:"Cuelgue/tensor cielo raso",q:1.5,u:"un"},
      {n:"Tornillo T2 punta mecha (cien)",q:0.15,u:"un"},
      {n:"Cinta papel junta durlock 75m",q:0.04,u:"un"},
      {n:"Masilla durlock balde 28kg",q:0.05,u:"un"},
    ]
  },
  "Cielo raso durlock RF 12.5mm (anti-fuego)": {
    u:"m2", m:185000,
    // Placa roja resistente al fuego — p/ cocheras, salas de máquinas
    mats:[
      {n:"Placa durlock RF 12.5mm roja",q:0.36,u:"un"},
      {n:"Perfil F530 cielo raso x 4m",q:0.4,u:"un"},
      {n:"Perfil CR2 perimetral",q:0.7,u:"ml"},
      {n:"Cuelgue/tensor cielo raso",q:1.5,u:"un"},
      {n:"Tornillo T2 punta mecha (cien)",q:0.15,u:"un"},
      {n:"Cinta papel junta durlock 75m",q:0.04,u:"un"},
      {n:"Masilla durlock balde 28kg",q:0.05,u:"un"},
    ]
  },
  "Cielo raso durlock c/ aislante térmico": {
    u:"m2", m:185000,
    // Con lana de vidrio entre estructura — confort térmico/acústico
    mats:[
      {n:"Placa durlock estándar 9.5mm",q:0.36,u:"un"},
      {n:"Perfil F530 cielo raso x 4m",q:0.4,u:"un"},
      {n:"Perfil CR2 perimetral",q:0.7,u:"ml"},
      {n:"Cuelgue/tensor cielo raso",q:1.5,u:"un"},
      {n:"Tornillo T2 punta mecha (cien)",q:0.15,u:"un"},
      {n:"Cinta papel junta durlock 75m",q:0.04,u:"un"},
      {n:"Masilla durlock balde 28kg",q:0.05,u:"un"},
      {n:"Lana de vidrio 50mm Isover",q:1.05,u:"m2"},
    ]
  },
  "Cielo raso durlock con luz indirecta (gargantas)": {
    u:"m2", m:235000,
    // Diseño con buñas/gargantas para iluminación LED indirecta
    mats:[
      {n:"Placa durlock estándar 9.5mm",q:0.5,u:"un"}, // más placa por geometría
      {n:"Perfil F530 cielo raso x 4m",q:0.6,u:"un"},
      {n:"Perfil CR2 perimetral",q:1.2,u:"ml"},
      {n:"Cuelgue/tensor cielo raso",q:2,u:"un"},
      {n:"Tornillo T2 punta mecha (cien)",q:0.25,u:"un"},
      {n:"Cinta papel junta durlock 75m",q:0.06,u:"un"},
      {n:"Masilla durlock balde 28kg",q:0.08,u:"un"},
    ]
  },

// ─── PVC (CIELORRASO LIVIANO ECONÓMICO) ──────────────────────────────
  "Cielo raso PVC blanco 6mm instalado": {
    u:"m2", m:50000,
    // El más económico — quincho, lavadero, garaje
    // Ref: Clasipar PY 2026: 50.000/m2 instalado
    mats:[
      {n:"Cieloraso PVC blanco 6mm",q:1.05,u:"m2"},
      {n:"Perfil solera 35mm x 2.60m",q:0.8,u:"un"},
      {n:"Perfil terminación U PVC 6m",q:0.2,u:"un"},
      {n:"Tornillo T1 punta fina (cien)",q:0.1,u:"un"},
    ]
  },
  "Cielo raso PVC blanco 8mm instalado": {
    u:"m2", m:60000,
    // Mejor rigidez, más usado en interiores
    // Ref: Clasipar PY 2026: 60.000/m2 instalado
    mats:[
      {n:"Cieloraso PVC blanco 8mm",q:1.05,u:"m2"},
      {n:"Perfil solera 35mm x 2.60m",q:0.8,u:"un"},
      {n:"Perfil terminación U PVC 6m",q:0.2,u:"un"},
      {n:"Tornillo T1 punta fina (cien)",q:0.1,u:"un"},
    ]
  },
  "Cielo raso PVC color pino 8mm instalado": {
    u:"m2", m:85000,
    // Imitación madera — muy popular en quinchos PY
    // Ref: Clasipar PY 2026: 85.000/m2 instalado
    mats:[
      {n:"Cieloraso PVC color pino 8mm",q:1.05,u:"m2"},
      {n:"Perfil solera 35mm x 2.60m",q:0.8,u:"un"},
      {n:"Perfil terminación U PVC 6m",q:0.2,u:"un"},
      {n:"Tornillo T1 punta fina (cien)",q:0.1,u:"un"},
    ]
  },

// ─── YESO TRADICIONAL / YESITO ────────────────────────────────────────
  "Cielo raso yeso modular 60x60": {
    u:"m2", m:75000,
    // Sistema desmontable T (oficinas, locales comerciales)
    // Ref: Clasipar PY 2026: 56.000-75.000/m2
    mats:[
      {n:"Placa yeso 60x60cm",q:2.85,u:"un"}, // 2.78 placas/m² + perdida
      {n:"Perfil solera 35mm x 2.60m",q:0.4,u:"un"},
      {n:"Cuelgue/tensor cielo raso",q:1.5,u:"un"},
    ]
  },
  "Cielo raso yeso aplicado (yesito) 1cm": {
    u:"m2", m:65000,
    // Capa de yeso fino sobre revoque, terminación lisa
    mats:[
      {n:"Yeso París bolsa 25kg",q:0.8,u:"un"}, // ~12kg/m² para 1cm
    ]
  },

// ─── MOLDURAS Y TERMINACIONES (POR ML) ────────────────────────────────
  "Moldura yeso decorativa 8cm": {
    u:"ml", m:25000,
    // Perimetral clásica
    mats:[
      {n:"Moldura yeso 8cm",q:1.05,u:"ml"},
    ]
  },
  "Moldura yeso decorativa 12cm": {
    u:"ml", m:32000,
    mats:[
      {n:"Moldura yeso 12cm",q:1.05,u:"ml"},
    ]
  },
  "Moldura yeso decorativa 14cm": {
    u:"ml", m:42000,
    mats:[
      {n:"Moldura yeso 14cm",q:1.05,u:"ml"},
    ]
  },
  "Junta dilatación cielo raso (por ml)": {
    u:"ml", m:24000,
    // Necesaria cada 8m lineales en cielos largos
    mats:[
      {n:"Junta dilatación cielo raso",q:1,u:"ml"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"YESERÍA": {
// ════════════════════════════════════════════════════════════════════════
  "Enlucido muros revoque grueso + yeso": {
    u:"m2", m:48000,
    mats:[
      {n:"Cemento tipo 1",q:2,u:"kg"},
      {n:"Arena lavada",q:0.02,u:"m3"},
      {n:"Yeso para construcción",q:3,u:"kg"},
    ]
  },
  "Enlucido cielorraso revoque + yeso": {
    u:"m2", m:53000,
    mats:[
      {n:"Cemento tipo 1",q:2,u:"kg"},
      {n:"Cal triturada",q:3,u:"kg"},
      {n:"Yeso para construcción",q:3,u:"kg"},
    ]
  },
  "Taparrollos de cortinas (h/60cm)": {
    u:"ml", m:120000,
    mats:[
      {n:"Yeso para construcción",q:5,u:"kg"},
      {n:"Cemento tipo 1",q:1,u:"kg"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"REVESTIMIENTOS": {
// ════════════════════════════════════════════════════════════════════════
  "Azulejo 15x15 / 20x20 / 30x30cm colocado": {
    u:"m2", m:73000,
    mats:[
      {n:"Cerámica Cecafi 32x57cm",q:1.05,u:"m2"},
      {n:"Mezcla adhesiva",q:3.50,u:"kg"},
      {n:"Pastina base blanca",q:0.20,u:"kg"},
    ]
  },
  "Piedra rompecabeza en piso junta tomada": {
    u:"m2", m:55000,
    mats:[
      {n:"Piedra losa blanca",q:1.05,u:"m2"},
      {n:"Cemento tipo 1",q:6,u:"kg"},
      {n:"Arena lavada",q:0.03,u:"m3"},
    ]
  },
  "Madera machimbre cedro/guatambú clavada": {
    u:"m2", m:85000,
    mats:[
      {n:"Machimbre ybyrapyta 1x3",q:1.10,u:"m2"},
      {n:"Clavo",q:0.25,u:"kg"},
    ]
  },
  "Ladrillejo cerámico 5x25cm": {
    u:"m2", m:65000,
    mats:[
      {n:"Cerámica Cecafi 32x57cm",q:1.05,u:"m2"},
      {n:"Mezcla adhesiva",q:3,u:"kg"},
    ]
  },
  "Escalón revestido con cerámica (1m ancho)": {
    u:"un", m:110000,
    mats:[
      {n:"Cerámica Cecafi 32x57cm",q:0.60,u:"m2"},
      {n:"Mezcla adhesiva",q:2,u:"kg"},
      {n:"Pastina base blanca",q:0.10,u:"kg"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"LUSTRE Y BARNIZ": {
// ════════════════════════════════════════════════════════════════════════
  "Lustre natural marcos (tapaporos+sopleteo)": {
    u:"ml", m:22000,
    mats:[
      {n:"Barniz sintético brillante",q:0.05,u:"lt"},
      {n:"Lija",q:0.10,u:"un"},
    ]
  },
  "Lustre natural persianas (tapaporos+sopleteo)": {
    u:"m2", m:48000,
    mats:[
      {n:"Barniz sintético brillante",q:0.15,u:"lt"},
      {n:"Aceite de linaza",q:0.05,u:"lt"},
      {n:"Lija",q:0.25,u:"un"},
    ]
  },
  "Lustre natural puerta placa / vidriera": {
    u:"m2", m:36000,
    mats:[
      {n:"Barniz sintético brillante",q:0.12,u:"lt"},
      {n:"Lija",q:0.25,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"VIDRIOS": {
// ════════════════════════════════════════════════════════════════════════
// Precios verificados Paraguay 2026 — Vidriería Templar, VidrioMAS, Clasipar
// Incluyen: vidrio, perfilería aluminio, herrajes, sellado silicona americana,
// instalación. NO incluyen IVA (se calcula aparte si aplica).
// MO baja (13%) porque domina el costo del material/perfil.
// ──────────────────────────────────────────────────────────────────────

// ─── 1. VIDRIO PLANO (DULCE/FLOAT) PARA VENTANAS COMUNES ───────────
  "Vidrio dulce 4mm colocado en abertura": {
    u:"m2", m:175000,
    // Vidrio + sellado en marco existente (ventana de madera/aluminio)
    mats:[
      {n:"Vidrio dulce 4mm",q:1.05,u:"m2"},
      {n:"Silicona acética transparente",q:0.15,u:"un"},
    ]
  },
  "Vidrio dulce 5mm colocado en abertura": {
    u:"m2", m:215000,
    mats:[
      {n:"Vidrio dulce 5mm",q:1.05,u:"m2"},
      {n:"Silicona acética transparente",q:0.15,u:"un"},
    ]
  },
  "Vidrio dulce 6mm colocado en abertura": {
    u:"m2", m:265000,
    mats:[
      {n:"Vidrio dulce 6mm",q:1.05,u:"m2"},
      {n:"Silicona acética transparente",q:0.15,u:"un"},
    ]
  },

// ─── 2. VENTANAS ALUMINIO + VIDRIO DULCE (SISTEMA COMPLETO) ────────
  "Ventana corrediza aluminio L20 + vidrio dulce 4mm": {
    u:"m2", m:380000,
    // Línea económica para vivienda estándar
    mats:[
      {n:"Vidrio dulce 4mm",q:1.05,u:"m2"},
      {n:"Perfil aluminio línea 20",q:7,u:"ml"},
      {n:"Felpa para corrediza",q:6,u:"ml"},
      {n:"Silicona acética transparente",q:0.5,u:"un"},
    ]
  },
  "Ventana corrediza aluminio L25 + vidrio dulce 5mm": {
    u:"m2", m:520000,
    // Línea media, mejor cierre y aislación
    mats:[
      {n:"Vidrio dulce 5mm",q:1.05,u:"m2"},
      {n:"Perfil aluminio línea 25",q:7,u:"ml"},
      {n:"Felpa para corrediza",q:6,u:"ml"},
      {n:"Burlete EPDM",q:4,u:"ml"},
      {n:"Silicona acética transparente",q:0.5,u:"un"},
    ]
  },
  "Ventana fija aluminio + vidrio dulce 5mm": {
    u:"m2", m:430000,
    mats:[
      {n:"Vidrio dulce 5mm",q:1.05,u:"m2"},
      {n:"Perfil aluminio línea 25",q:5,u:"ml"},
      {n:"Burlete EPDM",q:4,u:"ml"},
      {n:"Silicona acética transparente",q:0.5,u:"un"},
    ]
  },
  "Ventana abatible aluminio + vidrio dulce 5mm": {
    u:"m2", m:580000,
    // Más herrajes (bisagras + cierre)
    mats:[
      {n:"Vidrio dulce 5mm",q:1.05,u:"m2"},
      {n:"Perfil aluminio línea 25",q:6,u:"ml"},
      {n:"Burlete EPDM",q:5,u:"ml"},
      {n:"Silicona acética transparente",q:0.5,u:"un"},
    ]
  },

// ─── 3. VENTANAS BLINDEX (TEMPLADO) — UNIDADES ESTÁNDAR ────────────
// Precios fijos por dimensiones de mercado (Templar / VidrioMAS)
  "Ventana corrediza blindex 8mm 1.50x1.00m": {
    u:"un", m:850000,
    // Templar: ₲850.000 instalada
    mats:[
      {n:"Vidrio blindex/templado 8mm",q:1.5,u:"m2"},
      {n:"Perfil aluminio línea 25",q:5,u:"ml"},
      {n:"Herraje p/ corrediza blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1,u:"un"},
    ]
  },
  "Ventana corrediza blindex 8mm por m²": {
    u:"m2", m:580000,
    // Para medidas no estándar
    mats:[
      {n:"Vidrio blindex/templado 8mm",q:1,u:"m2"},
      {n:"Perfil aluminio línea 25",q:3.5,u:"ml"},
      {n:"Herraje p/ corrediza blindex",q:0.7,u:"un"},
      {n:"Silicona neutra estructural",q:0.7,u:"un"},
    ]
  },
  "Ventana fija blindex 8mm por m²": {
    u:"m2", m:520000,
    mats:[
      {n:"Vidrio blindex/templado 8mm",q:1,u:"m2"},
      {n:"Perfil aluminio línea 25",q:3.5,u:"ml"},
      {n:"Silicona neutra estructural",q:1,u:"un"},
    ]
  },

// ─── 4. PUERTAS BLINDEX ─────────────────────────────────────────────
  "Puerta batiente blindex 10mm 0.80x2.10m": {
    u:"un", m:1250000,
    // Templar: ₲1.250.000 instalada
    mats:[
      {n:"Vidrio blindex/templado 10mm",q:1.68,u:"m2"},
      {n:"Bisagra hidráulica blindex",q:2,u:"un"},
      {n:"Cerradura central blindex",q:1,u:"un"},
      {n:"Manija acero inox blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1,u:"un"},
    ]
  },
  "Puerta batiente blindex 10mm 0.90x2.10m": {
    u:"un", m:1450000,
    mats:[
      {n:"Vidrio blindex/templado 10mm",q:1.89,u:"m2"},
      {n:"Bisagra hidráulica blindex",q:2,u:"un"},
      {n:"Cerradura central blindex",q:1,u:"un"},
      {n:"Manija acero inox blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1,u:"un"},
    ]
  },
  "Puerta corrediza blindex 10mm 1.50x2.10m": {
    u:"un", m:1700000,
    // Templar: ₲1.700.000 instalada
    mats:[
      {n:"Vidrio blindex/templado 10mm",q:3.15,u:"m2"},
      {n:"Perfil aluminio reforzado",q:7,u:"ml"},
      {n:"Herraje p/ corrediza blindex",q:1,u:"un"},
      {n:"Tirador acero inox blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1.5,u:"un"},
    ]
  },

// ─── 5. FRENTES Y CERRAMIENTOS BLINDEX (FACHADAS) ──────────────────
  "Frente blindex 10mm 4 hojas 2.00x2.10m (2fijas+2corredizas)": {
    u:"un", m:2500000,
    // VidrioMAS: ₲2.500.000 — incluye cerradura central
    mats:[
      {n:"Vidrio blindex/templado 10mm",q:4.2,u:"m2"},
      {n:"Perfil aluminio reforzado",q:12,u:"ml"},
      {n:"Herraje p/ corrediza blindex",q:2,u:"un"},
      {n:"Cerradura central blindex",q:1,u:"un"},
      {n:"Tirador acero inox blindex",q:2,u:"un"},
      {n:"Silicona neutra estructural",q:2,u:"un"},
    ]
  },
  "Cerramiento blindex 10mm fachada por m²": {
    u:"m2", m:680000,
    // Para fachadas mayores a la unidad estándar
    mats:[
      {n:"Vidrio blindex/templado 10mm",q:1,u:"m2"},
      {n:"Perfil aluminio reforzado",q:3,u:"ml"},
      {n:"Silicona neutra estructural",q:1,u:"un"},
    ]
  },
  "Frente corrediza vidrio dulce 8mm 2.00x2.10m": {
    u:"un", m:2000000,
    // Alternativa económica al blindex (Templar)
    mats:[
      {n:"Vidrio dulce 6mm",q:4.2,u:"m2"},
      {n:"Perfil aluminio reforzado",q:10,u:"ml"},
      {n:"Herraje p/ corrediza blindex",q:2,u:"un"},
      {n:"Tirador acero inox blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1.5,u:"un"},
    ]
  },

// ─── 6. MAMPARAS Y BOX DE BAÑO BLINDEX ──────────────────────────────
  "Mampara baño blindex 8mm 1.50x2.00m fija": {
    u:"un", m:1500000,
    // VidrioMAS: ₲1.400.000-1.650.000 según diseño
    mats:[
      {n:"Vidrio blindex/templado 8mm",q:3,u:"m2"},
      {n:"Perfil aluminio línea 25",q:4,u:"ml"},
      {n:"Silicona neutra estructural",q:1,u:"un"},
    ]
  },
  "Mampara baño blindex 8mm con puerta batiente": {
    u:"un", m:1850000,
    // Con puerta + bisagra hidráulica
    mats:[
      {n:"Vidrio blindex/templado 8mm",q:3.5,u:"m2"},
      {n:"Perfil aluminio línea 25",q:5,u:"ml"},
      {n:"Bisagra hidráulica blindex",q:2,u:"un"},
      {n:"Manija acero inox blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1.5,u:"un"},
    ]
  },
  "Box esquinero baño blindex 8mm corredizo": {
    u:"un", m:1850000,
    // Box esquinero (2 lados con corrediza)
    mats:[
      {n:"Vidrio blindex/templado 8mm",q:3.5,u:"m2"},
      {n:"Perfil aluminio línea 25",q:8,u:"ml"},
      {n:"Herraje p/ corrediza blindex",q:1,u:"un"},
      {n:"Manija acero inox blindex",q:1,u:"un"},
      {n:"Silicona neutra estructural",q:1.5,u:"un"},
    ]
  },

// ─── 7. BARANDAS DE VIDRIO ──────────────────────────────────────────
  "Baranda blindex 10mm escalera/balcón con perfil U": {
    u:"ml", m:850000,
    // Por metro lineal, altura estándar 1.10m
    mats:[
      {n:"Vidrio blindex/templado 10mm",q:1.15,u:"m2"},
      {n:"Perfil aluminio reforzado",q:1.2,u:"ml"},
      {n:"Silicona neutra estructural",q:0.5,u:"un"},
    ]
  },
  "Baranda blindex 12mm piscina con botones acero": {
    u:"ml", m:1100000,
    // Sistema de botones (más limpio visualmente)
    mats:[
      {n:"Vidrio blindex/templado 12mm",q:1.3,u:"m2"},
      {n:"Tirador acero inox blindex",q:4,u:"un"},
      {n:"Silicona neutra estructural",q:0.5,u:"un"},
    ]
  },

// ─── 8. ESPEJOS ─────────────────────────────────────────────────────
  "Espejo 4mm colocado con clips/silicona": {
    u:"m2", m:235000,
    mats:[
      {n:"Espejo 4mm",q:1,u:"m2"},
      {n:"Silicona neutra estructural",q:0.3,u:"un"},
    ]
  },
  "Espejo 6mm colocado con marco aluminio": {
    u:"m2", m:340000,
    mats:[
      {n:"Espejo 6mm",q:1,u:"m2"},
      {n:"Perfil aluminio línea 20",q:4,u:"ml"},
      {n:"Silicona neutra estructural",q:0.3,u:"un"},
    ]
  },

// ─── 9. VIDRIOS DE SEGURIDAD Y EFICIENCIA ──────────────────────────
  "Vidrio laminado 3+3mm seguridad": {
    u:"m2", m:380000,
    // Para frentes / techos donde rompe pero no cae
    mats:[
      {n:"Vidrio laminado 3+3mm",q:1.05,u:"m2"},
      {n:"Silicona neutra estructural",q:0.3,u:"un"},
    ]
  },
  "DVH termopanel 3+9+3mm con marco aluminio": {
    u:"m2", m:680000,
    // Doble vidriado hermético — aislación térmica/acústica
    mats:[
      {n:"DVH 3+9+3 (termopanel)",q:1.05,u:"m2"},
      {n:"Perfil aluminio reforzado",q:4,u:"ml"},
      {n:"Burlete EPDM",q:5,u:"ml"},
      {n:"Silicona neutra estructural",q:0.5,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"PREVENCIÓN DE INCENDIOS": {
// ════════════════════════════════════════════════════════════════════════
// Sistema completo PCI para edificaciones según normativa paraguaya
// Fuentes: Regimiento 8, Sensorview, Clasipar, todoluz PY 2026
// MO 22%: tendido de cables, colocación, prueba de funcionamiento
// ──────────────────────────────────────────────────────────────────────

// ─── 1. DETECCIÓN ──────────────────────────────────────────────────
  "Detector de humo autónomo (residencial)": {
    u:"un", m:175000,
    mats:[
      {n:"Detector de humo autónomo",q:1,u:"un"},
    ]
  },
  "Detector humo/calor centralizado colocado": {
    u:"un", m:240000,
    mats:[
      {n:"Detector humo/calor compatible",q:1,u:"un"},
      {n:"Cable PCI BF 2x1.5mm² (rollo)",q:8,u:"ml"},
    ]
  },
  "Detector termovelocimétrico colocado": {
    u:"un", m:275000,
    mats:[
      {n:"Detector termovelocimétrico",q:1,u:"un"},
      {n:"Cable PCI BF 2x1.5mm² (rollo)",q:8,u:"ml"},
    ]
  },
  "Pulsador manual con caja": {
    u:"un", m:140000,
    mats:[
      {n:"Pulsador manual PCI",q:1,u:"un"},
      {n:"Cable PCI BF 2x1.5mm² (rollo)",q:6,u:"ml"},
    ]
  },
  "Sirena audiovisual colocada": {
    u:"un", m:190000,
    mats:[
      {n:"Sirena audiovisual PCI",q:1,u:"un"},
      {n:"Cable PCI BF 2x1.5mm² (rollo)",q:6,u:"ml"},
    ]
  },
  "Central alarma DSC 4 zonas instalada": {
    u:"un", m:1180000,
    mats:[
      {n:"Central de alarma DSC 4 zonas",q:1,u:"un"},
      {n:"Cable PCI BF 2x1.5mm² (rollo)",q:20,u:"ml"},
    ]
  },

// ─── 2. SEÑALÉTICA Y EMERGENCIA ────────────────────────────────────
  "Luz de emergencia LED autónoma": {
    u:"un", m:130000,
    mats:[
      {n:"Luz emergencia LED 30 LED",q:1,u:"un"},
    ]
  },
  "Cartel salida emergencia fotolum.": {
    u:"un", m:80000,
    mats:[
      {n:"Cartel señal salida emerg.",q:1,u:"un"},
    ]
  },
  "Cartel salida emergencia luminoso": {
    u:"un", m:230000,
    // Con LED y batería para apagones
    mats:[
      {n:"Cartel salida emerg. luminoso",q:1,u:"un"},
    ]
  },
  "Cartel señalización extintor 20x40": {
    u:"un", m:42000,
    mats:[
      {n:"Cartel EXTINTOR 20x40",q:1,u:"un"},
    ]
  },

// ─── 3. EXTINTORES ─────────────────────────────────────────────────
  "Extintor PQS 6kg ABC con soporte": {
    u:"un", m:285000,
    // Polvo químico seco — el más común en oficinas/locales
    mats:[
      {n:"Extintor PQS 6kg ABC",q:1,u:"un"},
      {n:"Soporte metálico extintor",q:1,u:"un"},
    ]
  },
  "Extintor PQS 10kg ABC con soporte": {
    u:"un", m:420000,
    // Para áreas más amplias
    mats:[
      {n:"Extintor PQS 10kg ABC",q:1,u:"un"},
      {n:"Soporte metálico extintor",q:1,u:"un"},
    ]
  },
  "Extintor CO2 5kg con soporte": {
    u:"un", m:445000,
    // Para áreas con equipos eléctricos
    mats:[
      {n:"Extintor CO2 5kg",q:1,u:"un"},
      {n:"Soporte metálico extintor",q:1,u:"un"},
    ]
  },
  "Extintor agua hidro 6lt con soporte": {
    u:"un", m:255000,
    mats:[
      {n:"Extintor agua hidro 6lt",q:1,u:"un"},
      {n:"Soporte metálico extintor",q:1,u:"un"},
    ]
  },

// ─── 4. SISTEMA HIDRÁULICO ─────────────────────────────────────────
  "Hidrante de muro completo (gabinete)": {
    u:"un", m:2400000,
    // Gabinete + manguera + boquilla
    mats:[
      {n:"Hidrante de muro tipo gabinete",q:1,u:"un"},
      {n:"Manguera contra incendio 30m",q:1,u:"un"},
      {n:"Boquilla chorro/niebla",q:1,u:"un"},
    ]
  },
  "Cañería incendio 1.5\" galvanizada": {
    u:"ml", m:105000,
    mats:[
      {n:"Caño hidráulico PCI 1.5\" galv.",q:1,u:"ml"},
    ]
  },
  "Rociador sprinkler estándar colocado": {
    u:"un", m:110000,
    mats:[
      {n:"Rociador sprinkler estándar",q:1,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"CLIMATIZACIÓN": {
// ════════════════════════════════════════════════════════════════════════
// Aires split, ventiladores, extractores. Precios mercado PY 2026.
// Fuentes: Bristol, Tupi, Artaza, Tienda Movil, Inverfin
// MO 20%: instalación + caños + carga gas + pruebas
// ──────────────────────────────────────────────────────────────────────

// ─── 1. AIRES ACONDICIONADOS SPLIT (FRÍO/CALOR) ────────────────────
  "Split 9000 BTU instalado": {
    u:"un", m:3850000,
    // Para ambiente chico (hasta 12m²)
    mats:[
      {n:"Split 9000 BTU frío/calor",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
    ]
  },
  "Split 12000 BTU instalado (12-18m²)": {
    u:"un", m:4150000,
    // El más vendido — dormitorios principales
    mats:[
      {n:"Split 12000 BTU frío/calor",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
    ]
  },
  "Split 18000 BTU instalado (18-30m²)": {
    u:"un", m:5150000,
    // Living/comedor mediano
    mats:[
      {n:"Split 18000 BTU frío/calor",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
    ]
  },
  "Split 24000 BTU instalado (30-40m²)": {
    u:"un", m:6050000,
    // Living/comedor grande, oficinas
    mats:[
      {n:"Split 24000 BTU frío/calor",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
    ]
  },
  "Split 36000 BTU instalado (40-60m²)": {
    u:"un", m:9300000,
    // Locales comerciales / espacios grandes
    mats:[
      {n:"Split 36000 BTU frío/calor",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
      {n:"Soporte exterior split",q:1,u:"un"},
    ]
  },

// ─── 2. AIRES INVERTER (BAJO CONSUMO) ──────────────────────────────
  "Split inverter 12000 BTU instalado": {
    u:"un", m:4900000,
    // 30-50% menos consumo eléctrico
    mats:[
      {n:"Split inverter 12000 BTU",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
    ]
  },
  "Split inverter 18000 BTU instalado": {
    u:"un", m:6300000,
    mats:[
      {n:"Split inverter 18000 BTU",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
    ]
  },
  "Split inverter 24000 BTU instalado": {
    u:"un", m:8500000,
    mats:[
      {n:"Split inverter 24000 BTU",q:1,u:"un"},
      {n:"Kit instalación split 3m",q:1,u:"un"},
      {n:"Soporte exterior split",q:1,u:"un"},
    ]
  },

// ─── 3. INSTALACIÓN ADICIONAL (POR ML EXTRA) ───────────────────────
  "Cañería A/A extra (por metro)": {
    u:"ml", m:115000,
    // Cuando la distancia supera el kit estándar
    mats:[
      {n:"Caño cobre A/A 1/4\" (ml)",q:1,u:"ml"},
      {n:"Caño cobre A/A 1/2\" (ml)",q:1,u:"ml"},
      {n:"Aislante térmico p/ caño A/A",q:2,u:"ml"},
    ]
  },
  "Recarga gas R410A": {
    u:"un", m:300000,
    // Servicio técnico
    mats:[
      {n:"Carga gas R410A (operación)",q:1,u:"un"},
    ]
  },

// ─── 4. VENTILACIÓN ────────────────────────────────────────────────
  "Ventilador de techo 132cm con luz": {
    u:"un", m:540000,
    mats:[
      {n:"Ventilador de techo 132cm",q:1,u:"un"},
    ]
  },
  "Ventilador industrial colocado": {
    u:"un", m:920000,
    mats:[
      {n:"Ventilador de techo industrial",q:1,u:"un"},
    ]
  },
  "Extractor aire baño 100mm instalado": {
    u:"un", m:140000,
    mats:[
      {n:"Extractor de aire baño 100mm",q:1,u:"un"},
    ]
  },
  "Extractor aire cocina 250mm con conducto": {
    u:"un", m:480000,
    mats:[
      {n:"Extractor de aire cocina 250mm",q:1,u:"un"},
      {n:"Conducto flexible aluminio 4\"",q:3,u:"ml"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"PISCINAS": {
// ════════════════════════════════════════════════════════════════════════
// Construcción completa de piscinas + equipos. Precios mercado PY 2026.
// MO 38%: hormigón + impermeabilización + colocación azulejo + pruebas
// ──────────────────────────────────────────────────────────────────────

// ─── 1. PISCINAS COMPLETAS (LLAVE EN MANO) ──────────────────────────
  "Piscina H°A° 5x3m completa": {
    u:"un", m:30000000,
    // Llave en mano: H°A° 210kg/cm², azulejos, motor+filtro Vulcano,
    // 1 dreno + 2 retornos + 1 aspiración + 1 skimmer + 2 luces LED
    // Bordes atérmicos. NO incluye excavación.
    // Referencia Clasipar PY 2026
    mats:[]
  },
  "Piscina H°A° 6x3m completa": {
    u:"un", m:35000000,
    mats:[]
  },
  "Piscina H°A° 7x3m completa": {
    u:"un", m:39000000,
    mats:[]
  },
  "Piscina H°A° 8x3m completa": {
    u:"un", m:45000000,
    mats:[]
  },

// ─── 2. POR PARTES (PARA OBRAS PERSONALIZADAS) ──────────────────────
  "Vaso piscina H°A° proyectado (m²)": {
    u:"m2", m:425000,
    // Hormigón gunitado fck 300 con doble armadura ø6 c/10cm
    // Ref: CYPE Paraguay 2026
    mats:[
      {n:"Cemento alto contenido sulfato",q:0.3,u:"un"},
      {n:"Aditivo impermeabilizante",q:1.5,u:"kg"},
      {n:"Varilla conformada Ø8mm",q:8,u:"kg"},
    ]
  },
  "Revestimiento azulejo cerámico piscina": {
    u:"m2", m:185000,
    mats:[
      {n:"Cerámica esmaltada piscina",q:1.05,u:"m2"},
      {n:"Pegamento p/ piscina",q:5,u:"kg"},
    ]
  },
  "Revestimiento venecitas vítreas": {
    u:"m2", m:340000,
    // Acabado premium
    mats:[
      {n:"Venecitas vitreas piscina",q:1.05,u:"m2"},
      {n:"Pegamento p/ piscina",q:5,u:"kg"},
    ]
  },
  "Borde atérmico antideslizante": {
    u:"ml", m:115000,
    mats:[
      {n:"Borde atérmico antideslizante",q:1,u:"ml"},
    ]
  },

// ─── 3. EQUIPAMIENTO ELECTROMECÁNICO ────────────────────────────────
  "Equipo bomba+filtro 0.5HP (≤50m³)": {
    u:"un", m:3450000,
    // Para piscinas residenciales chicas/medianas
    mats:[
      {n:"Equipo bomba+filtro arena 0.5HP",q:1,u:"un"},
      {n:"Arena de sílex (filtro)",q:25,u:"kg"},
    ]
  },
  "Equipo bomba+filtro 1HP (≤100m³)": {
    u:"un", m:5100000,
    // Piscinas residenciales grandes
    mats:[
      {n:"Equipo bomba+filtro arena 1HP",q:1,u:"un"},
      {n:"Arena de sílex (filtro)",q:50,u:"kg"},
    ]
  },
  "Skimmer + boquilla + dreno (set)": {
    u:"un", m:680000,
    mats:[
      {n:"Skimmer estándar",q:1,u:"un"},
      {n:"Boquilla impulsión piscina",q:1,u:"un"},
      {n:"Toma limpiafondos",q:1,u:"un"},
    ]
  },
  "Reflector LED RGB submarino instalado": {
    u:"un", m:720000,
    mats:[
      {n:"Reflector LED RGB submarino",q:1,u:"un"},
    ]
  },
  "Tablero eléctrico piscina": {
    u:"un", m:1050000,
    mats:[
      {n:"Tablero eléctrico piscina",q:1,u:"un"},
    ]
  },
  "Cañería PVC 1.5\" piscina": {
    u:"ml", m:24000,
    mats:[
      {n:"Caño PVC piscina 1.5\"",q:1,u:"ml"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"PAISAJISMO": {
// ════════════════════════════════════════════════════════════════════════
// Jardinería y paisaje exterior. Mucha mano de obra (preparación + plantación)
// MO 45%: nivelación, plantación, riego, mantenimiento inicial
// ──────────────────────────────────────────────────────────────────────

// ─── 1. PREPARACIÓN DE TERRENO ─────────────────────────────────────
  "Tierra negra zarandeada (suministro)": {
    u:"m3", m:175000,
    mats:[
      {n:"Tierra negra suelta",q:1,u:"m3"},
    ]
  },
  "Compost orgánico aplicado": {
    u:"m3", m:130000,
    mats:[
      {n:"Compost orgánico",q:1,u:"m3"},
    ]
  },
  "Geotextil para jardín": {
    u:"m2", m:18000,
    mats:[
      {n:"Geotextil para jardín",q:1.1,u:"m2"},
    ]
  },
  "Cobertura de corteza decorativa": {
    u:"m3", m:55000,
    mats:[
      {n:"Mantillo / cobertura corteza",q:1,u:"m3"},
    ]
  },

// ─── 2. CÉSPED Y GRAMA ─────────────────────────────────────────────
  "Grama San Agustín en panes colocada": {
    u:"m2", m:32000,
    // El más popular en PY: tropical, soporta sombra parcial
    mats:[
      {n:"Grama San Agustín en panes",q:1.05,u:"m2"},
      {n:"Tierra negra suelta",q:0.05,u:"m3"},
    ]
  },
  "Grama esmeralda en panes colocada": {
    u:"m2", m:38000,
    // Más fina, alto tránsito
    mats:[
      {n:"Grama esmeralda en panes",q:1.05,u:"m2"},
      {n:"Tierra negra suelta",q:0.05,u:"m3"},
    ]
  },
  "Siembra grama Bahiana": {
    u:"m2", m:18000,
    // Económica, semilla, ideal grandes superficies
    mats:[
      {n:"Grama Bahiana semilla",q:0.025,u:"kg"},
      {n:"Tierra negra suelta",q:0.05,u:"m3"},
    ]
  },

// ─── 3. RIEGO AUTOMÁTICO ───────────────────────────────────────────
  "Aspersor emergente con conexión": {
    u:"un", m:65000,
    // Para jardín grande con aspersión amplia
    mats:[
      {n:"Aspersor emergente PE",q:1,u:"un"},
      {n:"Caño PE riego 16mm",q:2,u:"ml"},
    ]
  },
  "Aspersor turbinado sectorial": {
    u:"un", m:115000,
    // Mayor alcance, sectorial
    mats:[
      {n:"Aspersor turbinado sectorial",q:1,u:"un"},
      {n:"Caño PE riego 16mm",q:2,u:"ml"},
    ]
  },
  "Sistema riego por goteo (por ml)": {
    u:"ml", m:6500,
    // Para canteros y plantaciones
    mats:[
      {n:"Goteo por línea (rollo 100m)",q:0.012,u:"un"},
    ]
  },
  "Programador riego 4 zonas instalado": {
    u:"un", m:430000,
    mats:[
      {n:"Programador riego 4 zonas",q:1,u:"un"},
    ]
  },

// ─── 4. PLANTAS Y ESPECIES ─────────────────────────────────────────
  "Palmera Pindó plantada": {
    u:"un", m:340000,
    // Especie nativa más usada en jardines PY
    mats:[
      {n:"Palmera Pindó 1.5m",q:1,u:"un"},
      {n:"Tierra negra suelta",q:0.1,u:"m3"},
      {n:"Compost orgánico",q:0.05,u:"m3"},
    ]
  },
  "Palmera Areca plantada": {
    u:"un", m:230000,
    // Decorativa, ornamental
    mats:[
      {n:"Palmera Areca 1m",q:1,u:"un"},
      {n:"Tierra negra suelta",q:0.08,u:"m3"},
    ]
  },
  "Lapacho rosado plantado": {
    u:"un", m:150000,
    // Árbol nacional de Paraguay
    mats:[
      {n:"Lapacho rosado plantín 50cm",q:1,u:"un"},
      {n:"Tierra negra suelta",q:0.1,u:"m3"},
      {n:"Compost orgánico",q:0.05,u:"m3"},
    ]
  },
  "Plantín ornamental cantero": {
    u:"un", m:38000,
    // Bromelias, helechos, agapantos, etc.
    mats:[
      {n:"Plantín ornamental mediano",q:1,u:"un"},
    ]
  },
  "Cerco vivo San Antonio plantado": {
    u:"ml", m:115000,
    // Duranta erecta, cerco florido típico PY
    mats:[
      {n:"Cerco vivo San Antonio (ml)",q:1,u:"ml"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"MOVIMIENTO DE SUELO": {
// ════════════════════════════════════════════════════════════════════════
// Excavación, nivelación, relleno, exteriores, pavimentos
// MO 30%: operadores de máquina + obreros para tareas manuales
// ──────────────────────────────────────────────────────────────────────

  "Excavación a máquina (m³)": {
    u:"m3", m:35000,
    // Hora máquina rinde ~25m³, prorrateado
    mats:[
      {n:"Hora máquina retroexcavadora",q:0.04,u:"un"},
    ]
  },
  "Excavación manual (m³)": {
    u:"m3", m:85000,
    // Para zonas inaccesibles a máquina
    mats:[]
  },
  "Relleno con suelo seleccionado compactado": {
    u:"m3", m:75000,
    mats:[
      {n:"Suelo seleccionado p/ relleno",q:1.1,u:"m3"},
    ]
  },
  "Subbase de ripio compactado": {
    u:"m3", m:130000,
    // Para soportar vereda o pavimento
    mats:[
      {n:"Ripio para subbase",q:1.1,u:"m3"},
    ]
  },
  "Nivelación de terreno con topadora": {
    u:"m2", m:12000,
    mats:[
      {n:"Hora máquina topadora",q:0.003,u:"un"},
    ]
  },
  "Pavimento adoquines hormigón colocado": {
    u:"m2", m:135000,
    // Antiestrés trabado, antideslizante
    mats:[
      {n:"Adoquín hormigón antiestres",q:1.05,u:"m2"},
      {n:"Arena lavada",q:0.05,u:"m3"},
    ]
  },
  "Cordón cuneta hormigón": {
    u:"ml", m:65000,
    // Para delimitar veredas y jardines
    mats:[
      {n:"Bordillo/cordón hormigón",q:1,u:"ml"},
      {n:"Cemento tipo 1",q:8,u:"kg"},
    ]
  },
  "Vereda hormigón 7cm con malla": {
    u:"m2", m:185000,
    // Vereda exterior estándar
    mats:[
      {n:"Cemento tipo 1",q:18,u:"kg"},
      {n:"Arena lavada",q:0.04,u:"m3"},
      {n:"Piedra triturada IV",q:0.07,u:"tn"},
      {n:"Malla electrosoldada Q-92",q:1.05,u:"m2"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"BAJA CORRIENTE": {
// ════════════════════════════════════════════════════════════════════════
// Cableado de red, CCTV, alarmas, automatización portones, video-portero
// MO 40%: tendido cuidadoso por canalización + certificación + programación
// ──────────────────────────────────────────────────────────────────────

// ─── 1. RED DATOS ───────────────────────────────────────────────────
  "Punto de red cat6 con tomacorriente": {
    u:"un", m:185000,
    // Cable + RJ45 + roseta + certificación
    mats:[
      {n:"Cable UTP cat6 (rollo 100m)",q:0.12,u:"un"},
      {n:"Conector RJ45 cat6",q:2,u:"un"},
    ]
  },
  "Patch panel 24 puertos instalado": {
    u:"un", m:600000,
    mats:[
      {n:"Patch panel 24 puertos",q:1,u:"un"},
    ]
  },
  "Switch de red 8 puertos gigabit": {
    u:"un", m:435000,
    mats:[
      {n:"Switch 8 puertos gigabit",q:1,u:"un"},
    ]
  },

// ─── 2. CCTV / VIDEOVIGILANCIA ──────────────────────────────────────
  "Cámara IP exterior 4MP instalada": {
    u:"un", m:780000,
    // Visión nocturna, antivandálica
    mats:[
      {n:"Cámara IP exterior 4MP",q:1,u:"un"},
      {n:"Cable UTP cat6 (rollo 100m)",q:0.18,u:"un"},
    ]
  },
  "Cámara IP domo interior 2MP instalada": {
    u:"un", m:480000,
    mats:[
      {n:"Cámara IP domo interior 2MP",q:1,u:"un"},
      {n:"Cable UTP cat6 (rollo 100m)",q:0.15,u:"un"},
    ]
  },
  "DVR/NVR 8 canales con disco 2TB": {
    u:"un", m:2200000,
    // Sistema completo de grabación
    mats:[
      {n:"DVR/NVR 8 canales",q:1,u:"un"},
      {n:"Disco rígido vigilancia 2TB",q:1,u:"un"},
    ]
  },

// ─── 3. CONTROL DE ACCESO ───────────────────────────────────────────
  "Portero eléctrico simple instalado": {
    u:"un", m:520000,
    mats:[
      {n:"Portero eléctrico simple",q:1,u:"un"},
    ]
  },
  "Videoportero a color 7\" instalado": {
    u:"un", m:2300000,
    mats:[
      {n:"Videoportero a color",q:1,u:"un"},
    ]
  },
  "Motor portón corredizo 600kg instalado": {
    u:"un", m:2750000,
    mats:[
      {n:"Motor portón corredizo 600kg",q:1,u:"un"},
      {n:"Control remoto adicional",q:1,u:"un"},
    ]
  },
  "Motor portón basculante instalado": {
    u:"un", m:3450000,
    mats:[
      {n:"Motor portón basculante",q:1,u:"un"},
      {n:"Control remoto adicional",q:1,u:"un"},
    ]
  },

// ─── 4. ALARMAS Y SEGURIDAD ─────────────────────────────────────────
  "Sistema alarma 8 zonas DSC instalado": {
    u:"un", m:1850000,
    // Central + sirena + 4 sensores PIR
    mats:[
      {n:"Panel alarma 8 zonas DSC",q:1,u:"un"},
      {n:"Sensor PIR alarma",q:4,u:"un"},
      {n:"Sirena exterior alarma",q:1,u:"un"},
    ]
  },
  "Sensor PIR adicional instalado": {
    u:"un", m:135000,
    mats:[
      {n:"Sensor PIR alarma",q:1,u:"un"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"SANITARIOS COMPLEMENTARIOS": {
// ════════════════════════════════════════════════════════════════════════
// Calefones, termotanques, bombas, tanques, biodigestores, pozos
// MO 25%: instalación hidráulica + eléctrica + pruebas
// ──────────────────────────────────────────────────────────────────────

// ─── 1. CALEFACCIÓN AGUA ────────────────────────────────────────────
  "Calefón eléctrico 80lt instalado": {
    u:"un", m:1700000,
    mats:[
      {n:"Calefón eléctrico 80lt",q:1,u:"un"},
    ]
  },
  "Calefón eléctrico 150lt instalado": {
    u:"un", m:2580000,
    mats:[
      {n:"Calefón eléctrico 150lt",q:1,u:"un"},
    ]
  },
  "Termotanque a gas 110lt instalado": {
    u:"un", m:3340000,
    mats:[
      {n:"Termotanque a gas 110lt",q:1,u:"un"},
    ]
  },
  "Termotanque solar 200lt completo": {
    u:"un", m:7800000,
    // Kit completo con paneles + tanque
    mats:[
      {n:"Termotanque solar 200lt",q:1,u:"un"},
    ]
  },

// ─── 2. BOMBAS Y RESERVAS ───────────────────────────────────────────
  "Bomba presurizadora 0.5HP instalada": {
    u:"un", m:1450000,
    mats:[
      {n:"Bomba presurizadora 0.5HP",q:1,u:"un"},
    ]
  },
  "Bomba sumergible pozo 1HP instalada": {
    u:"un", m:3400000,
    // Para pozos de hasta ~30m
    mats:[
      {n:"Bomba sumergible pozo 1HP",q:1,u:"un"},
    ]
  },
  "Tanque polietileno 500lt instalado": {
    u:"un", m:480000,
    mats:[
      {n:"Tanque polietileno 500lt",q:1,u:"un"},
    ]
  },
  "Tanque polietileno 1000lt instalado": {
    u:"un", m:720000,
    mats:[
      {n:"Tanque polietileno 1000lt",q:1,u:"un"},
    ]
  },
  "Tanque polietileno 2000lt instalado": {
    u:"un", m:1340000,
    mats:[
      {n:"Tanque polietileno 2000lt",q:1,u:"un"},
    ]
  },
  "Cisterna fibra 2500lt enterrada": {
    u:"un", m:2400000,
    // Reserva subterránea
    mats:[
      {n:"Tanque cisterna fibra 2500lt",q:1,u:"un"},
    ]
  },

// ─── 3. CLOACAL Y POZOS ─────────────────────────────────────────────
  "Biodigestor 600lt instalado": {
    u:"un", m:2400000,
    // Sistema sanitario moderno (sin pozo séptico tradicional)
    mats:[
      {n:"Biodigestor 600lt",q:1,u:"un"},
    ]
  },
  "Biodigestor 1300lt instalado": {
    u:"un", m:3450000,
    // Para vivienda más grande / familia numerosa
    mats:[
      {n:"Biodigestor 1300lt",q:1,u:"un"},
    ]
  },
  "Pozo absorbente 4 anillos H°": {
    u:"un", m:1450000,
    // Sistema tradicional, 4m profundidad
    mats:[
      {n:"Anillos pozo absorbente 1m",q:4,u:"un"},
      {n:"Piedra triturada IV",q:1.5,u:"tn"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"IMPERMEABILIZACIONES": {
// ════════════════════════════════════════════════════════════════════════
// Membranas, líquidos, juntas, tratamientos especiales
// MO 38%: aplicación cuidadosa, varias capas, pruebas de estanqueidad
// ──────────────────────────────────────────────────────────────────────

  "Membrana asfáltica 4mm aluminizada": {
    u:"m2", m:115000,
    // La más usada en techos planos PY
    mats:[
      {n:"Membrana asfáltica 4mm aluminizada",q:1.1,u:"m2"},
      {n:"Imprimación asfáltica (lt)",q:0.3,u:"lt"},
    ]
  },
  "Membrana líquida poliuretano (2 manos)": {
    u:"m2", m:125000,
    // Para superficies irregulares, baños, terrazas
    mats:[
      {n:"Membrana líquida poliuretano",q:1.4,u:"kg"},
    ]
  },
  "Imprimación asfáltica previa": {
    u:"m2", m:25000,
    mats:[
      {n:"Imprimación asfáltica (lt)",q:0.5,u:"lt"},
    ]
  },
  "Sellado estanco baño/terraza (Sika top 107)": {
    u:"m2", m:95000,
    // Cementicio elástico, ideal baños y duchas
    mats:[
      {n:"Sika top 107 seal (kit)",q:0.15,u:"un"},
    ]
  },
  "Banda butílica autoadhesiva": {
    u:"ml", m:24000,
    // Para juntas de dilatación y fisuras
    mats:[
      {n:"Banda butílica autoadhesiva",q:1.05,u:"ml"},
    ]
  },
  "Geomembrana HDPE piscinas/cisternas": {
    u:"m2", m:38000,
    mats:[
      {n:"Geomembrana HDPE 1mm",q:1.1,u:"m2"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"ESCALERAS Y BARANDAS": {
// ════════════════════════════════════════════════════════════════════════
// Escaleras metálicas, barandas, pasamanos, escalones premoldeados
// MO 28%: trabajo de herrería + colocación + pintura final
// ──────────────────────────────────────────────────────────────────────

  "Escalera metálica recta (por escalón)": {
    u:"un", m:480000,
    // Estructura tubular + peldaño chapa estriada, sin pintura final
    mats:[
      {n:"Hierro estructural caño rect.",q:8,u:"kg"},
      {n:"Peldaño metálico chapa estriada",q:1,u:"un"},
    ]
  },
  "Escalera caracol metálica (por escalón)": {
    u:"un", m:680000,
    // Estructura central + peldaños radiales
    mats:[
      {n:"Hierro estructural caño rect.",q:12,u:"kg"},
      {n:"Peldaño metálico chapa estriada",q:1,u:"un"},
    ]
  },
  "Escalón premoldeado hormigón": {
    u:"un", m:185000,
    mats:[
      {n:"Escalón premoldeado hormigón",q:1,u:"un"},
    ]
  },
  "Pasamano hierro forjado simple": {
    u:"ml", m:185000,
    // Diseño clásico
    mats:[
      {n:"Pasamano hierro forjado",q:1,u:"ml"},
    ]
  },
  "Baranda hierro torneado decorativa": {
    u:"ml", m:340000,
    // Con detalles forjados
    mats:[
      {n:"Baranda hierro torneado",q:1,u:"ml"},
    ]
  },
  "Baranda tubo redondo 2\" simple": {
    u:"ml", m:115000,
    // La más económica, industrial
    mats:[
      {n:"Tubo redondo 2\" hierro",q:1.5,u:"ml"},
    ]
  },
},

// ════════════════════════════════════════════════════════════════════════
"OBRA HÚMEDA COMPLEMENTARIA": {
// ════════════════════════════════════════════════════════════════════════
// Trabajos finales de obra: hidrolavado, sellado de juntas, retoques
// MO 50%: poco material, mucha mano de obra fina
// ──────────────────────────────────────────────────────────────────────

  "Hidrolavado fachada (m²)": {
    u:"m2", m:18000,
    // Limpieza profunda con presión antes de pintura
    mats:[
      {n:"Hidrolavadora hora alquiler",q:0.05,u:"un"},
    ]
  },
  "Sellado juntas dilatación poliuretano": {
    u:"ml", m:28000,
    mats:[
      {n:"Sellador de juntas poliuretano",q:0.15,u:"un"},
    ]
  },
  "Retape y retoque general": {
    u:"m2", m:22000,
    // Trabajos finales antes de entrega
    mats:[
      {n:"Cemento tipo 1",q:1,u:"kg"},
      {n:"Cal triturada",q:1,u:"kg"},
    ]
  },
  "Limpieza final de obra (m²)": {
    u:"m2", m:8000,
    // Por superficie cubierta
    mats:[]
  },
  "Prueba presión instalación agua": {
    u:"un", m:380000,
    // Test global del sistema antes de cerrar paredes
    mats:[]
  },
  "Prueba estanqueidad cloacal": {
    u:"un", m:280000,
    mats:[]
  },
},

}; // fin DB_RAW

// ── FUNCIÓN CONSTRUCTORA ──────────────────────────────────────────────
function buildDB(raw = DB_RAW, laborPct = LABOR_PCT) {
  const db = {};
  for (const [cat, items] of Object.entries(raw)) {
    db[cat] = {};
    const pct = laborPct[cat] || 30;
    for (const [name, item] of Object.entries(items)) {
      const lab = Math.round(item.m * pct / 100);
      db[cat][name] = {
        unit:      item.u,
        matCost:   item.m,
        laborCost: lab,
        laborPct:  pct,
        total:     item.m + lab,
        mats:      item.mats || [],
        y:         item.y || null,
      };
    }
  }
  return db;
}

// ── EXPORTAR ──────────────────────────────────────────────────────────
if (typeof module !== "undefined") {
  module.exports = { DB_RAW, LABOR_PCT, IVA_MAT, IVA_LAB, MAT_PRECIOS, DB_VERSION, DB_FECHA, buildDB };
}
