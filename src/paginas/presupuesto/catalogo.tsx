import { useMemo, useState } from "react";
import { buscarRubros, CATEGORIAS, type Rubro } from "@/dominio/precios";
import { itemDesdeRubro } from "@/dominio/calculo";
import { formatUnidad } from "@/dominio/formato";
import type { ItemPresupuesto } from "@/dominio/tipos";
import { Boton, EmptyState, Icono, Modal, Select, Tabla, Td, Texto, Th } from "@/ui/base";

const POR_PAGINA = 25;

/** Navegador del catálogo de la base de precios (399 rubros). */
export function CatalogoRubros({
  abierto,
  onClose,
  onAgregar,
}: {
  abierto: boolean;
  onClose: () => void;
  /** Recibe el ítem construido con los precios de la base. */
  onAgregar: (item: ItemPresupuesto) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("TODAS");
  const [pagina, setPagina] = useState(0);
  const [cantidad, setCantidad] = useState<Record<string, string>>({});

  const resultados = useMemo(() => {
    const filtrados = categoria === "TODAS" ? buscarRubros(busqueda, 1000) : buscarRubros(busqueda, 1000).filter((r) => r.categoria === categoria);
    return filtrados;
  }, [busqueda, categoria]);

  const totalPaginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  const visibles = resultados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const cantidadDe = (id: string) => Number(cantidad[id]) || 0;

  const agregar = (rubro: Rubro) => {
    const q = cantidadDe(rubro.id);
    if (q <= 0) return alert("Ingresá una cantidad mayor a cero.");
    const item = itemDesdeRubro(rubro, q);
    item.id = `${rubro.id}::${Date.now().toString(36)}`;
    onAgregar(item);
    setCantidad((c) => ({ ...c, [rubro.id]: "" }));
  };

  return (
    <Modal abierto={abierto} titulo="Catálogo de rubros" icono="menu_book" onClose={onClose} tamano="lg">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_240px]">
          <Texto
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por nombre, material o código…"
          />
          <Select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setPagina(0);
            }}
          >
            <option value="TODAS">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <p className="font-body-sm text-on-surface-variant">
          {resultados.length} rubros · precios de las guías de referencia (material + mano de obra)
        </p>

        {visibles.length === 0 ? (
          <EmptyState icono="search_off" titulo="Sin resultados" descripcion="Probá con otro término o categoría." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Rubro</Th>
                <Th>Categoría</Th>
                <Th>Unidad</Th>
                <Th derecha>Precio unitario</Th>
                <Th>Cantidad</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low">
                  <Td>
                    <span className="font-body-md">{r.nombre}</span>
                    <span className="block font-body-sm text-on-surface-variant">
                      Mat Gs. {r.costoMateriales.toLocaleString("es-PY")} · MO Gs.{" "}
                      {r.costoManoObra.toLocaleString("es-PY")}
                      {r.materiales.length > 0 && ` · ${r.materiales.length} mat.`}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-body-sm">{r.categoria}</span>
                  </Td>
                  <Td>{formatUnidad(r.unidad as ItemPresupuesto["unidad"])}</Td>
                  <Td derecha>
                    <span className="font-label-md">
                      Gs. {(r.costoMateriales + r.costoManoObra).toLocaleString("es-PY")}
                    </span>
                  </Td>
                  <Td>
                    <Texto
                      inputMode="decimal"
                      type="number"
                      min={0}
                      className="w-20"
                      value={cantidad[r.id] ?? ""}
                      onChange={(e) => setCantidad((c) => ({ ...c, [r.id]: e.target.value }))}
                    />
                  </Td>
                  <Td>
                    <Boton tamano="sm" icono="add" onClick={() => agregar(r)}>
                      Agregar
                    </Boton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between">
            <Boton variante="fantasma" icono="chevron_left" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Boton>
            <span className="font-label-sm">
              Página {pagina + 1} de {totalPaginas}
            </span>
            <Boton variante="fantasma" onClick={() => setPagina((p) => p + 1)} disabled={pagina + 1 >= totalPaginas}>
              Siguiente
              <Icono nombre="chevron_right" tamaño={16} className="ml-1" />
            </Boton>
          </div>
        )}
      </div>
    </Modal>
  );
}