import type { Obra } from "@/dominio/tipos";

/** Obras semilla. El índice de obras empieza con estas y crece con el usuario. */
export const IDS_SEMILLA = ["los-alamos", "ypacarai", "sajonia"];

export const OBRAS: Obra[] = [
  {
    id: "los-alamos",
    codigo: "OBR-2024-017",
    nombre: "Residencial Los Álamos — Torre B",
    tipo: "RESIDENCIAL",
    estado: "EN_CURSO",
    fase: "ESTRUCTURA",
    empConstructora: "Voccel Studio Constructora",
    comitente: "Inmobiliaria Guaraní S.A.",
    ubicacion: "Av. Eusebio Ayala km 4, Asunción",
    latitud: -25.2637,
    longitud: -57.5759,
    inicio: "2026-02-16",
    finEstimado: "2026-11-27",
    superficie: 1840,
    monedaContrato: "PYG",
    resumen: "Torre de 8 niveles, estructura terminada y pasando a instalaciones.",
  },
  {
    id: "ypacarai",
    codigo: "OBR-2023-004",
    nombre: "Casa Ypacaraí",
    tipo: "RESIDENCIAL",
    estado: "FINALIZADA",
    fase: "TERMINACIONES",
    empConstructora: "Voccel Studio Constructora",
    comitente: "Familia Benítez Sosa",
    ubicacion: "San Bernardino, Ruta 2 km 32",
    latitud: -25.2833,
    longitud: -57.6333,
    inicio: "2023-06-05",
    finEstimado: "2023-12-15",
    superficie: 120,
    monedaContrato: "PYG",
    resumen: "Casa de una planta, entregada y habitada. Cerrada a costo real.",
  },
  {
    id: "sajonia",
    codigo: "OBR-2026-002",
    nombre: "Reforma Comercial Sajonia",
    tipo: "REFORMA",
    estado: "EN_CURSO",
    fase: "PREPARACION",
    empConstructora: "Voccel Studio Constructora",
    comitente: "Cámara de Comercio de Asunción",
    ubicacion: "Calle Sajonia 1234, Asunción",
    latitud: -25.2841,
    longitud: -57.6119,
    inicio: "2026-08-03",
    finEstimado: "2027-01-15",
    superficie: 460,
    monedaContrato: "PYG",
    resumen: "Reforma integral de local comercial con adenda de refuerzo aprobada.",
  },
];

export function obraPorId(id: string): Obra | undefined {
  return OBRAS.find((o) => o.id === id);
}

export function semillaDe(id: string): Obra | undefined {
  return obraPorId(id);
}