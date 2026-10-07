import { useState } from "react";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import { ROL_NOMBRE } from "@/dominio/finanzas";
import { formatFecha, hoyIso } from "@/dominio/formato";
import { semillaFinanzas } from "@/dominio/semillas/finanzas";
import { semillaGente } from "@/dominio/semillas/gente";
import type { Cliente, Contratista, DatosGente, Jornalero } from "@/dominio/tipos";
import { Boton, Campo, Card, Chip, EmptyState, Kpi, Modal, Select, Td, Texto, Th, Tabla } from "@/ui/base";
import { addJornalero, patchJornalero } from "@/paginas/finanzas/operaciones";
import {
  addCliente,
  addComentario,
  addContratista,
  addPersonal,
  patchContratista,
  removeCliente,
  removeComentario,
  removeContratista,
  removePersonal,
} from "@/paginas/gente/operaciones";

type Pestania = "contratistas" | "clientes" | "jornaleros";

export function PaginaGente() {
  const { obra } = useObra();
  const { datos, guardar } = useColeccion<DatosGente>(
    obra.id,
    "gente",
    semillaGente(obra.id),
  );
  const finanzas = useColeccion(obra.id, "finanzas", semillaFinanzas(obra.id));
  const [pestania, setPestania] = useState<Pestania>("contratistas");
  const [nuevoContratista, setNuevoContratista] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [nuevoJornalero, setNuevoJornalero] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const enListaNegra = datos.contratistas.filter((c) => c.enListaNegra).length;
  const personalTotal = datos.contratistas.reduce((a, c) => a + c.personal.length, 0);
  const ratingPromedio =
    datos.contratistas.length === 0
      ? 0
      : datos.contratistas.reduce((a, c) => a + c.rating, 0) / datos.contratistas.length;

  const detalle = detalleId ? datos.contratistas.find((c) => c.id === detalleId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Ejecución · Gente</p>
        <h1 className="font-headline-xl">Contratistas, jornaleros y clientes</h1>
        <p className="font-body-sm text-on-surface-variant">
          {obra.nombre} · {datos.contratistas.length} contratistas · {finanzas.datos.jornaleros.filter((j) => j.activo).length} jornaleros activos ·{" "}
          {datos.clientes.length} clientes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Contratistas" valor={datos.contratistas.length} icono="handshake" />
        <Kpi etiqueta="En lista negra" valor={enListaNegra} icono="block" alerta={enListaNegra > 0} />
        <Kpi etiqueta="Personal de cuadrillas" valor={personalTotal} icono="groups" />
        <Kpi etiqueta="Rating promedio" valor={`${ratingPromedio.toFixed(1).replace(".", ",")} / 5`} icono="star" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant pb-2">
        {(
          [
            ["contratistas", "Contratistas"],
            ["jornaleros", "Jornaleros"],
            ["clientes", "Clientes"],
          ] as [Pestania, string][]
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setPestania(id)}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-label-md cursor-pointer ${
              pestania === id ? "bg-primary text-on-primary" : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {etiqueta}
          </button>
        ))}

        <div className="ml-auto">
          {pestania === "contratistas" && (
            <Boton variante="primario" icono="add" onClick={() => setNuevoContratista(true)}>
              Nuevo contratista
            </Boton>
          )}
          {pestania === "clientes" && (
            <Boton variante="primario" icono="add" onClick={() => setNuevoCliente(true)}>
              Nuevo cliente
            </Boton>
          )}
          {pestania === "jornaleros" && (
            <Boton variante="primario" icono="add" onClick={() => setNuevoJornalero(true)}>
              Alta de jornalero
            </Boton>
          )}
        </div>
      </div>

      {pestania === "contratistas" && (
        <ContratistasView
          datos={datos}
          onDetalle={setDetalleId}
        />
      )}

      {pestania === "clientes" && (
        <ClientesView
          datos={datos}
          guardar={guardar}
          onNuevo={() => setNuevoCliente(true)}
        />
      )}

      {pestania === "jornaleros" && (
        <JornalerosView
          jornaleros={finanzas.datos.jornaleros}
          guardar={(j, patch) => {
            if (j && patch) finanzas.guardar(patchJornalero(finanzas.datos, j.id, patch));
          }}
          onNuevo={() => setNuevoJornalero(true)}
        />
      )}

      {nuevoContratista && (
        <ContratistaForm
          onCerrar={() => setNuevoContratista(false)}
          onGuardar={(c) => {
            guardar(
              addContratista(datos, {
                ...c,
                id: `con-${Date.now().toString(36)}`,
                rating: 0,
                comentarios: [],
                enListaNegra: false,
                personal: [],
              }),
            );
            setNuevoContratista(false);
          }}
        />
      )}

      {nuevoCliente && (
        <ClienteForm
          onCerrar={() => setNuevoCliente(false)}
          onGuardar={(c) => {
            guardar(addCliente(datos, { ...c, id: `cli-${Date.now().toString(36)}` }));
            setNuevoCliente(false);
          }}
        />
      )}

      {nuevoJornalero && (
        <JornaleroForm
          onCerrar={() => setNuevoJornalero(false)}
          onGuardar={(j) => {
            finanzas.guardar(addJornalero(finanzas.datos, j));
            setNuevoJornalero(false);
          }}
        />
      )}

      {detalle && (
        <DetalleContratista
          contratista={detalle}
          datos={datos}
          guardar={guardar}
          onCerrar={() => setDetalleId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contratistas                                                        */
/* ------------------------------------------------------------------ */

function ContratistasView({
  datos,
  onDetalle,
}: {
  datos: DatosGente;
  onDetalle: (id: string) => void;
}) {
  return datos.contratistas.length === 0 ? (
    <EmptyState
      icono="handshake"
      titulo="Sin contratistas"
      descripcion="Cargá el primer subcontratista o cuadrilla externa."
    />
  ) : (
    <div className="grid gap-4 lg:grid-cols-2">
      {datos.contratistas.map((c) => (
        <Card key={c.id} className={c.enListaNegra ? "border-error/50" : ""}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface-container-high border border-outline-variant">
              <span className="font-headline-md">{c.nombre.slice(0, 1)}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-headline-md truncate">{c.nombre}</p>
                {c.enListaNegra && <Chip tono="error">Lista negra</Chip>}
              </div>
              <p className="font-body-sm text-on-surface-variant">
                {c.empresa} · {c.especialidad}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-body-sm">
                <Estrellas valor={c.rating} />
                <span className="text-on-surface-variant">{c.telefono}</span>
                {c.ruc && <span className="text-on-surface-variant">RUC {c.ruc}</span>}
                <span className="text-on-surface-variant">{c.personal.length} persona(s)</span>
              </div>
            </div>
            <Boton tamano="sm" variante="fantasma" icono="open_in_new" onClick={() => onDetalle(c.id)} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Estrellas({ valor }: { valor: number }) {
  const llenas = Math.round(valor);
  return (
    <span className="font-label-md tracking-wide" title={valor.toFixed(2)} aria-label={`${valor} de 5`}>
      {"★".repeat(llenas)}
      <span className="opacity-30">{"★".repeat(5 - llenas)}</span>
    </span>
  );
}

function ContratistaForm({
  onCerrar,
  onGuardar,
}: {
  onCerrar: () => void;
  onGuardar: (c: Omit<Contratista, "id" | "rating" | "comentarios" | "enListaNegra" | "personal">) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ips, setIps] = useState("");
  const [categoriaIps, setCategoriaIps] = useState("");
  const [ruc, setRuc] = useState("");

  return (
    <Modal abierto titulo="Nuevo contratista" icono="handshake" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre / razón social">
          <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Empresa">
            <Texto value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </Campo>
          <Campo etiqueta="Especialidad">
            <Texto value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Instalaciones eléctricas" />
          </Campo>
        </div>
        <Campo etiqueta="Teléfono">
          <Texto value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="IPS" hint="Registro patronal">
            <Texto value={ips} onChange={(e) => setIps(e.target.value)} />
          </Campo>
          <Campo etiqueta="Categoría IPS">
            <Texto value={categoriaIps} onChange={(e) => setCategoriaIps(e.target.value)} placeholder="Riesgo 3" />
          </Campo>
        </div>
        <Campo etiqueta="RUC">
          <Texto value={ruc} onChange={(e) => setRuc(e.target.value)} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={nombre.trim().length === 0}
            onClick={() =>
              onGuardar({
                nombre: nombre.trim(),
                empresa: empresa.trim() || nombre.trim(),
                especialidad: especialidad.trim(),
                telefono: telefono.trim(),
                ips: ips.trim() || undefined,
                categoriaIps: categoriaIps.trim() || undefined,
                ruc: ruc.trim() || undefined,
              })
            }
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

function DetalleContratista({
  contratista,
  datos,
  guardar,
  onCerrar,
}: {
  contratista: Contratista;
  datos: DatosGente;
  guardar: (d: DatosGente) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [estrellas, setEstrellas] = useState(5);
  const [pNombre, setPNombre] = useState("");
  const [pCi, setPCi] = useState("");
  const [pOficio, setPOficio] = useState("");

  return (
    <Modal abierto titulo={contratista.nombre} icono="managed_accounts" onClose={onCerrar} tamano="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Estrellas valor={contratista.rating} />
          <span className="font-label-md">{contratista.rating.toFixed(1).replace(".", ",")} / 5</span>
          <Chip tono={contratista.enListaNegra ? "error" : "exito"}>
            {contratista.enListaNegra ? "En lista negra" : "Habilitado"}
          </Chip>
          <label className="flex items-center gap-2 font-label-sm cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={contratista.enListaNegra}
              onChange={(e) => guardar(patchContratista(datos, contratista.id, { enListaNegra: e.target.checked }))}
            />
            Lista negra
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="font-label-sm mb-2 text-on-surface-variant">Personal de la cuadrilla</p>
            <Tabla>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>CI</Th>
                  <Th>Oficio</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {contratista.personal.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.nombre}</Td>
                    <Td className="text-on-surface-variant">{p.ci}</Td>
                    <Td className="text-on-surface-variant">{p.oficio}</Td>
                    <Td>
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        icono="close"
                        onClick={() => guardar(removePersonal(datos, contratista.id, p.id))}
                      />
                    </Td>
                  </tr>
                ))}
                {contratista.personal.length === 0 && (
                  <tr>
                    <Td className="text-on-surface-variant">Sin personal cargado.</Td>
                  </tr>
                )}
              </tbody>
            </Tabla>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Campo etiqueta="Nombre" className="flex-1">
                <Texto value={pNombre} onChange={(e) => setPNombre(e.target.value)} />
              </Campo>
              <Campo etiqueta="CI" className="w-28">
                <Texto value={pCi} onChange={(e) => setPCi(e.target.value)} />
              </Campo>
              <Campo etiqueta="Oficio" className="w-28">
                <Texto value={pOficio} onChange={(e) => setPOficio(e.target.value)} />
              </Campo>
              <Boton
                variante="secundario"
                icono="add"
                disabled={pNombre.trim().length === 0}
                onClick={() => {
                  guardar(
                    addPersonal(datos, contratista.id, {
                      id: `p-${Date.now().toString(36)}`,
                      nombre: pNombre.trim(),
                      ci: pCi.trim() || "—",
                      oficio: pOficio.trim() || "—",
                    }),
                  );
                  setPNombre("");
                  setPCi("");
                  setPOficio("");
                }}
              >
                Agregar
              </Boton>
            </div>
          </div>

          <div>
            <p className="font-label-sm mb-2 text-on-surface-variant">Calificaciones y comentarios</p>
            <div className="max-h-56 overflow-y-auto flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-sm">
              {contratista.comentarios.map((r) => (
                <div key={r.id} className="flex items-start gap-2 px-3 py-2">
                  <span className="flex-1 min-w-0">
                    <span className="block font-body-sm flex items-center gap-2">
                      <Estrellas valor={r.estrellas} />
                      <span className="text-on-surface-variant">{formatFecha(r.fecha)}</span>
                    </span>
                    <span className="block font-body-md">{r.texto}</span>
                  </span>
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    icono="close"
                    onClick={() => guardar(removeComentario(datos, contratista.id, r.id))}
                  />
                </div>
              ))}
              {contratista.comentarios.length === 0 && (
                <p className="p-3 font-body-sm text-on-surface-variant">Aún sin calificar.</p>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <Select value={estrellas} onChange={(e) => setEstrellas(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} estrella(s)</option>
                ))}
              </Select>
              <Campo etiqueta="Comentario">
                <Texto
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Puntualidad, calidad, orden…"
                />
              </Campo>
              <Boton
                variante="secundario"
                icono="star"
                disabled={texto.trim().length === 0}
                onClick={() => {
                  guardar(
                    addComentario(datos, contratista.id, {
                      fecha: hoyIso(),
                      estrellas,
                      texto: texto.trim(),
                    }),
                  );
                  setTexto("");
                }}
              >
                Calificar
              </Boton>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-outline-variant pt-4">
          <Boton
            variante="peligro"
            icono="delete"
            onClick={() => {
              if (confirm(`¿Eliminar a ${contratista.nombre}?`)) {
                guardar(removeContratista(datos, contratista.id));
                onCerrar();
              }
            }}
          >
            Eliminar
          </Boton>
          <Boton variante="primario" onClick={onCerrar}>Cerrar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

function ClientesView({
  datos,
  guardar,
  onNuevo,
}: {
  datos: DatosGente;
  guardar: (d: DatosGente) => void;
  onNuevo: () => void;
}) {
  return datos.clientes.length === 0 ? (
    <EmptyState
      icono="person"
      titulo="Sin clientes"
      descripcion="Cargá el primer comitente o cliente."
      accion={<Boton variante="primario" icono="add" onClick={onNuevo}>Nuevo cliente</Boton>}
    />
  ) : (
    <Tabla>
      <thead>
        <tr>
          <Th>Cliente</Th>
          <Th>Contacto</Th>
          <Th>Dirección</Th>
          <Th>RUC</Th>
          <Th>Nota</Th>
          <Th>Acciones</Th>
        </tr>
      </thead>
      <tbody>
        {datos.clientes.map((c) => (
          <tr key={c.id} className="hover:bg-surface-container-low">
            <Td><span className="font-body-md">{c.nombre}</span></Td>
            <Td>
              <span className="block">{c.telefono}</span>
              {c.email && <span className="block font-body-sm text-on-surface-variant">{c.email}</span>}
            </Td>
            <Td className="text-on-surface-variant">{c.direccion}</Td>
            <Td className="font-mono text-xs">{c.ruc ?? "—"}</Td>
            <Td className="text-on-surface-variant max-w-52">{c.nota ?? "—"}</Td>
            <Td>
              <Boton
                tamano="sm"
                variante="fantasma"
                icono="delete"
                onClick={() => confirm(`¿Eliminar a ${c.nombre}?`) && guardar(removeCliente(datos, c.id))}
              />
            </Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function ClienteForm({
  onCerrar,
  onGuardar,
}: {
  onCerrar: () => void;
  onGuardar: (c: Omit<Cliente, "id">) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ruc, setRuc] = useState("");
  const [nota, setNota] = useState("");

  return (
    <Modal abierto titulo="Nuevo cliente" icono="person_add" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre">
          <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Teléfono">
            <Texto value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
          <Campo etiqueta="Email">
            <Texto type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Dirección">
          <Texto value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="RUC">
            <Texto value={ruc} onChange={(e) => setRuc(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Nota">
          <Texto value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Comitente de…" />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={nombre.trim().length === 0}
            onClick={() =>
              onGuardar({
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: email.trim() || undefined,
                direccion: direccion.trim(),
                ruc: ruc.trim() || undefined,
                nota: nota.trim() || undefined,
              })
            }
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Jornaleros                                                          */
/* ------------------------------------------------------------------ */

function JornalerosView({
  jornaleros,
  guardar,
  onNuevo,
}: {
  jornaleros: Jornalero[];
  guardar: (j: Jornalero | null, patch?: Partial<Jornalero>) => void;
  onNuevo: () => void;
}) {
  return jornaleros.length === 0 ? (
    <EmptyState
      icono="engineering"
      titulo="Sin jornaleros"
      descripcion="La liquidación de jornadas se administra en Finanzas → Jornaleros."
      accion={<Boton variante="primario" icono="add" onClick={onNuevo}>Alta de jornalero</Boton>}
    />
  ) : (
    <Tabla>
      <thead>
        <tr>
          <Th>Jornalero</Th>
          <Th>CI</Th>
          <Th>Rol</Th>
          <Th>Oficio</Th>
          <Th derecha>Jornal</Th>
          <Th>Alta</Th>
          <Th>Estado</Th>
        </tr>
      </thead>
      <tbody>
        {jornaleros.map((j) => (
          <tr key={j.id} className="hover:bg-surface-container-low">
            <Td><span className="font-body-md">{j.nombre}</span></Td>
            <Td className="text-on-surface-variant">{j.ci}</Td>
            <Td><Chip tono="neutro">{ROL_NOMBRE[j.rol]}</Chip></Td>
            <Td className="text-on-surface-variant">{j.oficio}</Td>
            <Td derecha>{j.jornalDiario.toLocaleString("es-PY")}</Td>
            <Td>{formatFecha(j.alta)}</Td>
            <Td>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={j.activo}
                  onChange={(e) => guardar(j, { activo: e.target.checked })}
                />
                <Chip tono={j.activo ? "exito" : "neutro"}>{j.activo ? "Activo" : "De baja"}</Chip>
              </label>
            </Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function JornaleroForm({
  onCerrar,
  onGuardar,
}: {
  onCerrar: () => void;
  onGuardar: (j: Jornalero) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [ci, setCi] = useState("");
  const [rol, setRol] = useState<Jornalero["rol"]>("OFICIAL");
  const [oficio, setOficio] = useState("");
  const [jornalDiario, setJornalDiario] = useState("100000");

  return (
    <Modal abierto titulo="Alta de jornalero" icono="engineering" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre y apellido">
          <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Cédula">
            <Texto value={ci} onChange={(e) => setCi(e.target.value)} />
          </Campo>
          <Campo etiqueta="Oficio">
            <Texto value={oficio} onChange={(e) => setOficio(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Rol">
            <Select value={rol} onChange={(e) => setRol(e.target.value as Jornalero["rol"])}>
              {(Object.keys(ROL_NOMBRE) as Jornalero["rol"][]).map((r) => (
                <option key={r} value={r}>{ROL_NOMBRE[r]}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Jornal diario (Gs.)">
            <Texto type="number" inputMode="numeric" value={jornalDiario} onChange={(e) => setJornalDiario(e.target.value)} />
          </Campo>
        </div>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={nombre.trim().length === 0}
            onClick={() =>
              onGuardar({
                id: `j-${Date.now().toString(36)}`,
                nombre: nombre.trim(),
                ci: ci.trim() || "—",
                rol,
                oficio: oficio.trim() || "General",
                jornalDiario: Math.round(Number(jornalDiario)) || 0,
                alta: hoyIso(),
                activo: true,
              })
            }
          >
            Dar de alta
          </Boton>
        </div>
      </div>
    </Modal>
  );
}