import { useState } from "react";
import type { EntradaObra } from "@/contexto/obra";
import { useGlobal } from "@/dominio/almacen";
import { hoyIso, sumarDias } from "@/dominio/formato";
import { semillaClientes } from "@/dominio/semillas/clientes";
import type { Cliente, EstadoObra, FaseObra, Obra, TipoObra } from "@/dominio/tipos";
import { Boton, Campo, Modal, Select, Texto } from "@/ui/base";
import { addCliente } from "@/paginas/gente/operaciones";

const TIPO_OPCIONES: { valor: TipoObra; texto: string }[] = [
  { valor: "RESIDENCIAL", texto: "Residencial" },
  { valor: "COMERCIAL", texto: "Comercial" },
  { valor: "INDUSTRIAL", texto: "Industrial" },
  { valor: "REFORMA", texto: "Reforma" },
  { valor: "INFRAESTRUCTURA", texto: "Infraestructura" },
];

const ESTADO_OPCIONES: { valor: EstadoObra; texto: string }[] = [
  { valor: "PLANIFICACION", texto: "Planificación" },
  { valor: "APROBADA", texto: "Aprobada" },
  { valor: "EN_CURSO", texto: "En curso" },
  { valor: "FINALIZADA", texto: "Finalizada" },
  { valor: "SUSPENDIDA", texto: "Suspendida" },
];

const FASE_OPCIONES: { valor: FaseObra; texto: string }[] = [
  { valor: "PREPARACION", texto: "Preparación" },
  { valor: "ESTRUCTURA", texto: "Estructura" },
  { valor: "INSTALACIONES", texto: "Instalaciones" },
  { valor: "TERMINACIONES", texto: "Terminaciones" },
];

/**
 * Alta y edición de una obra. Se abre dentro de un `Modal`; en el alta solo
 * pide los datos básicos, en la edición suma estado, etapa y resumen, y ofrece
 * eliminarla del dispositivo.
 */
export function FormObra({
  titulo,
  obra = null,
  onCerrar,
  onGuardar,
  onActualizar,
  onEliminar,
}: {
  titulo: string;
  obra?: Obra | null;
  onCerrar: () => void;
  onGuardar?: (entrada: EntradaObra) => void;
  onActualizar?: (obra: Obra) => void;
  onEliminar?: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(obra?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoObra>(obra?.tipo ?? "RESIDENCIAL");
  const [comitente, setComitente] = useState(obra?.comitente ?? "");
  const clientes = useGlobal<Cliente[]>("clientes", semillaClientes());
  const [clienteId, setClienteId] = useState(obra?.clienteId ?? "");
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [cliNombre, setCliNombre] = useState("");
  const [cliTelefono, setCliTelefono] = useState("");
  const [cliDireccion, setCliDireccion] = useState("");
  const [empresa, setEmpresa] = useState(obra?.empConstructora ?? "");
  const [ubicacion, setUbicacion] = useState(obra?.ubicacion ?? "");
  const [superficie, setSuperficie] = useState(obra?.superficie ? String(obra.superficie) : "");
  const [estado, setEstado] = useState<EstadoObra>(obra?.estado ?? "PLANIFICACION");
  const [fase, setFase] = useState<FaseObra>(obra?.fase ?? "PREPARACION");
  const [resumen, setResumen] = useState(obra?.resumen ?? "");
  const [inicio, setInicio] = useState(obra?.inicio ?? hoyIso());
  const [fin, setFin] = useState(obra?.finEstimado ?? sumarDias(hoyIso(), 180));

  const guardar = () => {
    if (obra && onActualizar) {
      onActualizar({
        ...obra,
        nombre: nombre.trim(),
        tipo,
        comitente: comitente.trim(),
        empConstructora: empresa.trim(),
        clienteId: clienteId || undefined,
        ubicacion: ubicacion.trim(),
        superficie: Number(superficie) || 0,
        estado,
        fase,
        resumen,
        inicio,
        finEstimado: fin,
      });
    } else if (onGuardar) {
      onGuardar({
        nombre,
        tipo,
        comitente,
        empConstructora: empresa,
        clienteId: clienteId || undefined,
        ubicacion,
        superficie: Number(superficie) || 0,
        inicio,
        finEstimado: fin,
      });
    }
    onCerrar();
  };

  return (
    <Modal abierto titulo={titulo} icono={obra ? "edit" : "add_home"} onClose={onCerrar} tamano="md">
      <div className="flex flex-col gap-3">
        {obra && (
          <div className="rounded-sm border border-outline-variant bg-surface-container-low p-2 font-label-sm text-on-surface-variant">
            {obra.codigo} · datos guardados en este dispositivo
          </div>
        )}

        <Campo etiqueta="Nombre del proyecto">
          <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Residencial Mbocayaty" />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoObra)}>
              {TIPO_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Superficie (m²)">
            <Texto inputMode="decimal" type="number" min={0} value={superficie} onChange={(e) => setSuperficie(e.target.value)} />
          </Campo>
        </div>

        <div className="flex flex-col gap-2">
          <Campo etiqueta="Cliente (registro del dispositivo)">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {clientes.datos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          {!nuevoCliente ? (
            <Boton variante="fantasma" tamano="sm" icono="person_add" onClick={() => setNuevoCliente(true)}>
              Nuevo cliente
            </Boton>
          ) : (
            <div className="flex flex-col gap-2 rounded-sm border border-outline-variant bg-surface-container-low p-2">
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="Nombre">
                  <Texto value={cliNombre} onChange={(e) => setCliNombre(e.target.value)} />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Texto value={cliTelefono} onChange={(e) => setCliTelefono(e.target.value)} />
                </Campo>
              </div>
              <Campo etiqueta="Dirección">
                <Texto value={cliDireccion} onChange={(e) => setCliDireccion(e.target.value)} />
              </Campo>
              <div className="flex justify-end gap-2">
                <Boton variante="fantasma" tamano="sm" onClick={() => setNuevoCliente(false)}>
                  Cancelar
                </Boton>
                <Boton
                  tamano="sm"
                  icono="check"
                  disabled={!cliNombre.trim()}
                  onClick={() => {
                    const nuevo: Cliente = {
                      id: `cli-${Date.now().toString(36)}`,
                      nombre: cliNombre.trim(),
                      telefono: cliTelefono.trim(),
                      direccion: cliDireccion.trim(),
                    };
                    clientes.guardar((previo) => addCliente(previo, nuevo));
                    setClienteId(nuevo.id);
                    setComitente((v) => v || nuevo.nombre);
                    setNuevoCliente(false);
                    setCliNombre("");
                    setCliTelefono("");
                    setCliDireccion("");
                  }}
                >
                  Crear y asignar
                </Boton>
              </div>
            </div>
          )}
        </div>

        <Campo etiqueta="Comitente">
          <Texto value={comitente} onChange={(e) => setComitente(e.target.value)} placeholder="Inmobiliaria / familia" />
        </Campo>
        <Campo etiqueta="Constructora">
          <Texto value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </Campo>
        <Campo etiqueta="Ubicación">
          <Texto value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ciudad, distrito, referencia…" />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Inicio">
            <Texto type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo etiqueta="Entrega estimada">
            <Texto type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </Campo>
        </div>

        {obra && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Estado">
                <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoObra)}>
                  {ESTADO_OPCIONES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.texto}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Etapa">
                <Select value={fase} onChange={(e) => setFase(e.target.value as FaseObra)}>
                  {FASE_OPCIONES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.texto}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>
            <Campo etiqueta="Resumen">
              <textarea
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
                className="min-h-16 bg-surface-container-low border border-outline-variant rounded-sm px-2.5 py-1.5 font-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-tertiary outline-none w-full"
                placeholder="Nota breve sobre el proyecto…"
              />
            </Campo>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
          <Boton icono="save" disabled={!nombre.trim()} onClick={guardar}>
            {obra ? "Guardar cambios" : "Crear obra"}
          </Boton>

          {obra && onEliminar && (
            <Boton
              variante="peligro"
              icono="delete"
              onClick={() => {
                if (
                  confirm(
                    `¿Eliminar "${obra.nombre}"? Se borran sus colecciones de este dispositivo (presupuesto, finanzas, cronograma, gente) y de los respaldos.`,
                  )
                ) {
                  onEliminar(obra.id);
                  onCerrar();
                }
              }}
            >
              Eliminar obra
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  );
}
