import type { Obra } from "@/dominio/tipos";

/**
 * Catálogo de obras semilla.
 *
 * La app arranca sin datos de ejemplo: el usuario crea todas sus obras. Los
 * arreglos quedan vacíos para que el registro (`puntero.v1.obras`) sea la
 * única fuente de verdad y no haya obras inmutables.
 */
export const IDS_SEMILLA: string[] = [];

export const OBRAS: Obra[] = [];
