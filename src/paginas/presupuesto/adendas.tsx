import { useMemo, useState } from "react";
import { formatFecha } from "@/dominio/formato";
import { todosLosItems } from "@/dominio/calculo";
import type { Adenda, DatosPresupuesto } from "@/dominio/tipos";
import { Boton, Campo, Chip, EmptyState, Modal, Select, Td, Texto, Th, Tabla } from "@/ui/base";

export function AdendasModal({
  abierto,
  datos,
  onClose,
  onGuardar,
}: {
  abierto: boolean;
  datos: DatosPresupuesto;
  onClose: () => void;
  onGuardar: (datos: DatosPresupuesto) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [autorizadaPor, setAutorizadaPor] = useState("");
  const [estado, setEstado] = useState<Adenda["estado"]>("BORRADOR");

  const itemsPorAdenda = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of todosLosItems(datos)) {
      if (!item.adenda) continue;
      mapa.set(item.adenda, (mapa.get(item.adenda) ?? 0) + item.cantidad * (item.precioMaterial + item.precioManoObra));
    }
    return mapa;
  }, [datos]);

  const puedeCrear = titulo.trim().length > 0 && Number(monto) > 0;

  const crear = () => {
    if (!puedeCrear) return;
    const numero = datos.adendas.length + 1;
    const codigo = `AD-${String(numero).padStart(2, "0")}`;
    onGuardar({
      ...datos,
      adendas: [
        ...datos.adendas,
        {
          codigo,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          monto: Number(monto) || 0,
          fecha: fecha || new Date().toISOString().slice(0, 10),
          estado,
          autorizadaPor: autorizadaPor.trim() || "—",
        },
      ],
    });
    setCreando(false);
    setTitulo("");
    setDescripcion("");
    setMonto("");
    setAutorizadaPor("");
    setEstado("BORRADOR");
  };

  return (
    <Modal abierto={abierto} titulo="Adendas y variaciones" icono="post_add" onClose={onClose} tamano="lg">
      <div className="flex flex-col gap-3">
        {!creando && (
          <div className="flex justify-end">
            <Boton variante="primario" icono="add" onClick={() => setCreando(true)}>
              Nueva adenda
            </Boton>
          </div>
        )}

        {creando && (
          <div className="rounded-md border border-outline-variant bg-surface-container-low p-3 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo etiqueta="Título">
                <Texto value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Refuerzo de losa…" autoFocus />
              </Campo>
              <Campo etiqueta="Monto pactado (Gs.)">
                <Texto inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </Campo>
              <Campo etiqueta="Fecha">
                <Texto type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Campo>
              <Campo etiqueta="Estado">
                <Select value={estado} onChange={(e) => setEstado(e.target.value as Adenda["estado"])}>
                  <option value="BORRADOR">Borrador</option>
                  <option value="APROBADA">Aprobada</option>
                  <option value="RECHAZADA">Rechazada</option>
                </Select>
              </Campo>
            </div>
            <Campo etiqueta="Descripción / alcance">
              <Texto value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Alcance de la variación…" />
            </Campo>
            <Campo etiqueta="Autorizada por">
              <Texto value={autorizadaPor} onChange={(e) => setAutorizadaPor(e.target.value)} placeholder="Nombre del autorizante" />
            </Campo>
            <div className="flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => setCreando(false)}>
                Cancelar
              </Boton>
              <Boton variante="primario" icono="check" onClick={crear} disabled={!puedeCrear}>
                Crear adenda
              </Boton>
            </div>
          </div>
        )}

        {datos.adendas.length === 0 ? (
          <EmptyState
            icono="post_add"
            titulo="Sin adendas"
            descripcion="Las adendas modifican el contrato original: nuevo monto, plazo y condiciones pactados con el comitente."
            accion={
              <Boton variante="secundario" icono="add" onClick={() => setCreando(true)}>
                Crear la primera adenda
              </Boton>
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Título</Th>
                <Th derecha>Monto</Th>
                <Th>Fecha</Th>
                <Th>Autorizada por</Th>
                <Th>Estado</Th>
                <Th>Ítems</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {datos.adendas.map((a) => {
                const parcial = itemsPorAdenda.get(a.codigo) ?? 0;
                return (
                  <tr key={a.codigo} className="hover:bg-surface-container-low">
                    <Td>
                      <span className="font-label-md">{a.codigo}</span>
                    </Td>
                    <Td>
                      <span className="font-body-md">{a.titulo}</span>
                      {a.descripcion && (
                        <span className="block font-body-sm text-on-surface-variant">{a.descripcion}</span>
                      )}
                    </Td>
                    <Td derecha>Gs. {a.monto.toLocaleString("es-PY")}</Td>
                    <Td>{formatFecha(a.fecha)}</Td>
                    <Td>{a.autorizadaPor}</Td>
                    <Td>
                      <Chip tono={a.estado === "APROBADA" ? "exito" : a.estado === "RECHAZADA" ? "error" : "advertencia"}>
                        {a.estado}
                      </Chip>
                    </Td>
                    <Td derecha>
                      {parcial > 0 ? `Gs. ${parcial.toLocaleString("es-PY")}` : "—"}
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        {a.estado !== "APROBADA" && (
                          <Boton
                            tamano="sm"
                            icono="verified"
                            onClick={() =>
                              onGuardar({
                                ...datos,
                                adendas: datos.adendas.map((x) =>
                                  x.codigo === a.codigo ? { ...x, estado: "APROBADA" as const } : x,
                                ),
                              })
                            }
                          >
                            Aprobar
                          </Boton>
                        )}
                        <Boton
                          tamano="sm"
                          variante="peligro"
                          icono="delete"
                          onClick={() => {
                            if (
                              confirm(
                                `Eliminá la adenda ${a.codigo} y sus ítems. Esto no se puede deshacer.`,
                              )
                            ) {
                              onGuardar({
                                ...datos,
                                adendas: datos.adendas.filter((x) => x.codigo !== a.codigo),
                                fases: datos.fases.map((f) => ({
                                  ...f,
                                  items: f.items.filter((item) => item.adenda !== a.codigo),
                                })),
                              });
                            }
                          }}
                        >
                          Borrar
                        </Boton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}

        <p className="font-body-sm text-on-surface-variant">
          Los ítems de presupuesto se vinculan a una adenda desde el formulario de ítem (campo
          "Adenda"). Al aprobar una adenda, sus ítems quedan resaltados en la tabla del presupuesto.
        </p>
      </div>
    </Modal>
  );
}