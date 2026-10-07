/**
 * Operaciones puras sobre `DatosGente` (contratistas y clientes).
 */

import type {
  Cliente,
  Contratista,
  DatosGente,
  PersonalAsignado,
  RatingComentario,
} from "@/dominio/tipos";

export function addContratista(datos: DatosGente, c: Contratista): DatosGente {
  return { ...datos, contratistas: [...datos.contratistas, c] };
}

export function patchContratista(
  datos: DatosGente,
  id: string,
  patch: Partial<Contratista>,
): DatosGente {
  return {
    ...datos,
    contratistas: datos.contratistas.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function removeContratista(datos: DatosGente, id: string): DatosGente {
  return { ...datos, contratistas: datos.contratistas.filter((c) => c.id !== id) };
}

/** Agrega una calificación y recalcula el promedio 0..5. */
export function addComentario(
  datos: DatosGente,
  contratistaId: string,
  comentario: Omit<RatingComentario, "id">,
): DatosGente {
  const comentarios = {
    id: `c-${Date.now().toString(36)}`,
    ...comentario,
  };
  return {
    ...datos,
    contratistas: datos.contratistas.map((c): Contratista => {
      if (c.id !== contratistaId) return c;
      const todos = [...c.comentarios, comentarios];
      const rating =
        todos.reduce((a, r) => a + r.estrellas, 0) / Math.max(1, todos.length);
      return { ...c, comentarios: todos, rating };
    }),
  };
}

export function removeComentario(datos: DatosGente, contratistaId: string, comentarioId: string): DatosGente {
  return {
    ...datos,
    contratistas: datos.contratistas.map((c): Contratista => {
      if (c.id !== contratistaId) return c;
      const comentarios = c.comentarios.filter((r) => r.id !== comentarioId);
      const rating =
        comentarios.length === 0
          ? 0
          : comentarios.reduce((a, r) => a + r.estrellas, 0) / comentarios.length;
      return { ...c, comentarios, rating };
    }),
  };
}

export function addPersonal(
  datos: DatosGente,
  contratistaId: string,
  persona: PersonalAsignado,
): DatosGente {
  return {
    ...datos,
    contratistas: datos.contratistas.map((c) =>
      c.id === contratistaId ? { ...c, personal: [...c.personal, persona] } : c,
    ),
  };
}

export function removePersonal(datos: DatosGente, contratistaId: string, personaId: string): DatosGente {
  return {
    ...datos,
    contratistas: datos.contratistas.map((c) =>
      c.id === contratistaId
        ? { ...c, personal: c.personal.filter((p) => p.id !== personaId) }
        : c,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

export function addCliente(datos: DatosGente, cliente: Cliente): DatosGente {
  return { ...datos, clientes: [...datos.clientes, cliente] };
}

export function patchCliente(datos: DatosGente, id: string, patch: Partial<Cliente>): DatosGente {
  return {
    ...datos,
    clientes: datos.clientes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function removeCliente(datos: DatosGente, id: string): DatosGente {
  return {
    ...datos,
    clientes: datos.clientes.filter((c) => c.id !== id),
  };
}