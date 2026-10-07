import { useEffect, useMemo, useState } from "react";
import type { Adenda, EstadoItem, FasePresupuesto, ItemPresupuesto, Unidad } from "@/dominio/tipos";
import { formatUnidad } from "@/dominio/formato";
import { Boton, Campo, Modal, Select, Texto } from "@/ui/base";

const UNIDADES: Unidad[] = ["m2", "m3", "m", "ml", "kg", "gl", "u", "dia", "jornal", "mes"];
const ESTADOS: EstadoItem[] = ["PENDIENTE", "EN_EJECUCION", "EJECUTADO", "APROBADO"];

export interface FichaItemValor {
  item: ItemPresupuesto;
  faseId: string;
}

/** Formulario de ítem de presupuesto: editar uno existente o crear uno nuevo. */
export function FichaItem({
  abierto,
  inicial,
  fases,
  adendas,
  faseIdInicial,
  onGuardar,
  onCerrar,
}: {
  abierto: boolean;
  inicial: FichaItemValor | null;
  fases: FasePresupuesto[];
  adendas: Adenda[];
  faseIdInicial: string | null;
  onGuardar: (valor: FichaItemValor) => void;
  onCerrar: () => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState<Unidad>("m2");
  const [cantidad, setCantidad] = useState("1");
  const [precioMaterial, setPrecioMaterial] = useState("0");
  const [precioManoObra, setPrecioManoObra] = useState("0");
  const [cantidadEjecutada, setCantidadEjecutada] = useState("0");
  const [estado, setEstado] = useState<EstadoItem>("PENDIENTE");
  const [nota, setNota] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [faseId, setFaseId] = useState("");
  const [adenda, setAdenda] = useState("");

  useEffect(() => {
    if (!abierto) return;
    const i = inicial?.item;
    if (i) {
      setDescripcion(i.descripcion);
      setUnidad(i.unidad);
      setCantidad(String(i.cantidad));
      setPrecioMaterial(String(i.precioMaterial));
      setPrecioManoObra(String(i.precioManoObra));
      setCantidadEjecutada(String(i.cantidadEjecutada));
      setEstado(i.estado);
      setNota(i.nota ?? "");
      setProveedor(i.proveedor ?? "");
      setAdenda(i.adenda ?? "");
      setFaseId(inicial!.faseId);
    } else {
      setDescripcion("");
      setUnidad("m2");
      setCantidad("1");
      setPrecioMaterial("0");
      setPrecioManoObra("0");
      setCantidadEjecutada("0");
      setEstado("PENDIENTE");
      setNota("");
      setProveedor("");
      setAdenda("");
      setFaseId(faseIdInicial ?? fases[0]?.id ?? "");
    }
  }, [abierto, inicial, faseIdInicial, fases]);

  const unitario = useMemo(() => {
    const pm = Number(precioMaterial) || 0;
    const pmo = Number(precioManoObra) || 0;
    return pm + pmo;
  }, [precioMaterial, precioManoObra]);

  const total = useMemo(() => unitario * (Number(cantidad) || 0), [unitario, cantidad]);

  const puedeGuardar = descripcion.trim().length > 0 && Number(cantidad) >= 0;

  const guardar = () => {
    if (!puedeGuardar) return;
    const base: ItemPresupuesto = {
      id: inicial?.item.id ?? `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      codigo: "",
      descripcion: descripcion.trim(),
      unidad,
      cantidad: Number(cantidad) || 0,
      precioMaterial: Number(precioMaterial) || 0,
      precioManoObra: Number(precioManoObra) || 0,
      rubroId: inicial?.item.rubroId,
      rubroCategoria: inicial?.item.rubroCategoria,
      rendimiento: inicial?.item.rendimiento,
      adenda: adenda || undefined,
      estado,
      cantidadEjecutada: Number(cantidadEjecutada) || 0,
      proveedor: proveedor || undefined,
    };
    if (nota.trim()) base.nota = nota.trim();
    onGuardar({ item: base, faseId });
    onCerrar();
  };

  return (
    <Modal
      abierto={abierto}
      titulo={inicial ? "Editar ítem" : "Nuevo ítem"}
      icono={inicial ? "edit_note" : "add_circle"}
      onClose={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Descripción">
          <Texto value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del ítem" autoFocus />
        </Campo>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Fase">
            <Select value={faseId} onChange={(e) => setFaseId(e.target.value)}>
              {fases.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.numero}. {f.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Unidad">
            <Select value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {formatUnidad(u)}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Cantidad">
            <Texto inputMode="decimal" type="number" min={0} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Campo>
          <Campo etiqueta="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoItem)}>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Material (Gs.)">
            <Texto inputMode="numeric" value={precioMaterial} onChange={(e) => setPrecioMaterial(e.target.value)} />
          </Campo>
          <Campo etiqueta="Mano de obra (Gs.)">
            <Texto inputMode="numeric" value={precioManoObra} onChange={(e) => setPrecioManoObra(e.target.value)} />
          </Campo>
          <Campo etiqueta="Ejecutado">
            <Texto inputMode="decimal" type="number" min={0} value={cantidadEjecutada} onChange={(e) => setCantidadEjecutada(e.target.value)} />
          </Campo>
          <Campo etiqueta="Adenda" hint={adendas.length === 0 ? "Sin adendas cargadas" : undefined}>
            <Select value={adenda} onChange={(e) => setAdenda(e.target.value)}>
              <option value="">—</option>
              {adendas.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.codigo}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <Campo etiqueta="Nota / condiciones">
          <Texto value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Condiciones de ejecución, referencia del plano…" />
        </Campo>

        <Campo etiqueta="Proveedor sugerido">
          <Texto value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Opcional" />
        </Campo>

        <div className="flex items-center justify-between rounded-sm border border-outline-variant bg-surface-container-low px-3 py-2">
          <span className="font-label-sm">Unitario: Gs. {unitario.toLocaleString("es-PY")}</span>
          <span className="font-headline-sm">Total: Gs. {total.toLocaleString("es-PY")}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono="check" onClick={guardar} disabled={!puedeGuardar}>
            {inicial ? "Guardar cambios" : "Agregar ítem"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}