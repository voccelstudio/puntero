import { useState } from "react";
import { useMoneda } from "@/contexto/moneda";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import {
  CATEGORIA_NOMBRE,
  FUENTE_NOMBRE,
  METODO_NOMBRE,
  ROL_NOMBRE,
  egresos,
  ingresos,
  montoJornada,
  movimientosDelPeriodo,
  netoMovimientos,
  resumirLiquidacion,
  saldoCaja,
  totalCertificado,
  totalCertificadoSub,
  totalCobrado,
  totalContratado,
} from "@/dominio/finanzas";
import { formatFecha, formatGs, formatPct, hoyIso } from "@/dominio/formato";
import { semillaFinanzas } from "@/dominio/semillas/finanzas";
import type {
  CategoriaMovimiento,
  CertificadoObra,
  DatosFinanzas,
  FuenteFondo,
  Jornalero,
  MetodoPago,
  MovimientoCaja,
  Subcontrato,
} from "@/dominio/tipos";
import { Boton, Card, Campo, Chip, EmptyState, Kpi, Modal, Progress, Select, Td, Texto, Th, Tabla } from "@/ui/base";
import {
  addCertificado,
  addJornada,
  addJornalero,
  addMovimiento,
  addSubcontrato,
  cobrarCertificado,
  liquidarJornalero,
  patchFondo,
  patchJornalero,
  patchMovimiento,
  patchSubcontrato,
  removeCertificado,
  removeMovimiento,
  removeSubcontrato,
} from "@/paginas/finanzas/operaciones";

const MES = new Date().toISOString().slice(0, 7);

type Pestania = "caja" | "certificados" | "subcontratos" | "jornaleros";

export function PaginaFinanzas() {
  const { obra } = useObra();
  const { datos, guardar } = useColeccion(
    obra.id,
    "finanzas",
    semillaFinanzas(obra.id),
  );
  const [pestania, setPestania] = useState<Pestania>("caja");

  const netoMes = netoMovimientos(movimientosDelPeriodo(datos.movimientos, `${MES}-01`));
  const saldo = saldoCaja(datos);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Contratación · Finanzas</p>
        <h1 className="font-headline-xl">Finanzas y caja chica</h1>
        <p className="font-body-sm text-on-surface-variant">
          {obra.nombre} · Flujo del mes {formatGs(netoMes)} · Saldo de caja {formatGs(saldo)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Fondo fijo de caja" valor={formatGs(datos.fondoFijo)} icono="account_balance_wallet" />
        <Kpi etiqueta="Saldo disponible" valor={formatGs(saldo)} pie="neto de movimientos de caja" icono="payments" alerta={saldo < 0} />
        <Kpi etiqueta="Certificados" valor={formatGs(totalCertificado(datos.certificados))} pie={`Cobrado ${formatGs(totalCobrado(datos.certificados))}`} icono="verified" />
        <Kpi etiqueta="Subcontratos" valor={formatGs(totalContratado(datos.subcontratos))} pie={`Certificado ${formatGs(totalCertificadoSub(datos.subcontratos))}`} icono="handshake" />
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant pb-2 mb-4">
          {(
            [
              ["caja", "Caja chica"],
              ["certificados", "Certificados"],
              ["subcontratos", "Subcontratos"],
              ["jornaleros", "Jornaleros"],
            ] as [Pestania, string][]
          ).map(([id, etiqueta]) => (
            <button
              key={id}
              onClick={() => setPestania(id)}
              className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-label-md cursor-pointer ${
                pestania === id
                  ? "bg-primary text-on-primary"
                  : "text-on-surface hover:bg-surface-container"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {pestania === "caja" && <CajaView datos={datos} guardar={guardar} />}
        {pestania === "certificados" && <CertificadosView datos={datos} guardar={guardar} />}
        {pestania === "subcontratos" && <SubcontratosView datos={datos} guardar={guardar} />}
        {pestania === "jornaleros" && <JornalerosView datos={datos} guardar={guardar} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Caja chica                                                          */
/* ------------------------------------------------------------------ */

function CajaView({ datos, guardar }: { datos: DatosFinanzas; guardar: (d: DatosFinanzas) => void }) {
  const { fmt } = useMoneda();
  const [nuevo, setNuevo] = useState(false);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [soloMes, setSoloMes] = useState(true);

  const visibles = soloMes ? movimientosDelPeriodo(datos.movimientos, `${MES}-01`) : datos.movimientos;
  const act = editarId ? datos.movimientos.find((m) => m.id === editarId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Ingresos del mes" valor={fmt(ingresos(visibles))} icono="north_east" />
        <Kpi etiqueta="Egresos del mes" valor={fmt(egresos(visibles))} icono="south_west" />
        <Kpi etiqueta="Neto del mes" valor={fmt(netoMovimientos(visibles))} icono="swap_vert" />
        <Kpi etiqueta="Movimientos" valor={visibles.length} icono="receipt" />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 font-label-sm cursor-pointer">
          <input type="checkbox" checked={soloMes} onChange={(e) => setSoloMes(e.target.checked)} />
          Solo este mes
        </label>
        <span className="font-body-sm text-on-surface-variant">
          Fondo fijo: {fmt(datos.fondoFijo)}
        </span>
        <div className="ml-auto flex gap-2">
          <Boton
            variante="secundario"
            icono="savings"
            onClick={() => {
              const v = prompt("Nuevo fondo fijo de caja chica:", String(datos.fondoFijo));
              if (v != null && Number(v) >= 0) guardar(patchFondo(datos, Math.round(Number(v))));
            }}
          >
            Fondo fijo
          </Boton>
          <Boton variante="primario" icono="add_card" onClick={() => setNuevo(true)}>
            Nuevo movimiento
          </Boton>
        </div>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          icono="receipt_long"
          titulo="Sin movimientos"
          descripcion="El registro de caja en este período está vacío. Agregá un ingreso o egreso para arrancar."
        />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Concepto</Th>
              <Th>Categoría</Th>
              <Th>Fuente</Th>
              <Th>Método</Th>
              <Th>Responsable</Th>
              <Th derecha>Monto</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m) => {
              const egreso = m.monto < 0;
              return (
                <tr key={m.id} className="hover:bg-surface-container-low">
                  <Td>{formatFecha(m.fecha)}</Td>
                  <Td>
                    <span className="font-body-md">{m.concepto}</span>
                    {m.factura && (
                      <span className="block font-body-sm text-on-surface-variant">
                        Factura {m.factura}
                        {m.ruc && ` · RUC ${m.ruc}`}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Chip tono={m.monto > 0 ? "exito" : m.categoria === "MANO_DE_OBRA" ? "primario" : "neutro"}>
                      {CATEGORIA_NOMBRE[m.categoria]}
                    </Chip>
                  </Td>
                  <Td className="text-on-surface-variant">{FUENTE_NOMBRE[m.fuente]}</Td>
                  <Td className="text-on-surface-variant">{METODO_NOMBRE[m.metodo]}</Td>
                  <Td className="text-on-surface-variant">{m.responsable}</Td>
                  <Td derecha>
                    <span className={`font-label-md ${egreso ? "text-error" : "text-ok"}`}>
                      {egreso ? "−" : "+"} {fmt(Math.abs(m.monto))}
                    </span>
                  </Td>
                  <Td>
                    <Chip tono={m.estado === "APROBADO" ? "exito" : m.estado === "RECHAZADO" ? "error" : "advertencia"}>
                      {m.estado}
                    </Chip>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => setEditarId(m.id)} />
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        icono="delete"
                        onClick={() => confirm("¿Eliminar este movimiento?") && guardar(removeMovimiento(datos, m.id))}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}

      {(nuevo || act) && (
        <ModalMovimiento
          inicial={act}
          onCerrar={() => {
            setNuevo(false);
            setEditarId(null);
          }}
          onGuardar={(m) => {
            if (act) guardar(patchMovimiento(datos, act.id, m));
            else guardar(addMovimiento(datos, m));
          }}
        />
      )}
    </div>
  );
}

const CATEGORIAS: CategoriaMovimiento[] = [
  "MATERIALES", "MANO_DE_OBRA", "SUBCONTRATOS", "MAQUINARIAS", "SERVICIOS",
  "TRAMITES", "VIATICOS", "ALMACEN", "HONORARIOS", "INGRESOS", "OTROS",
];
const FUENTES: FuenteFondo[] = ["CAJA_CHICA", "CUENTA", "ANTICIPO", "CERTIFICADO", "OTRO"];
const METODOS: MetodoPago[] = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "TARJETA", "DEPOSITO"];

function ModalMovimiento({
  inicial,
  onCerrar,
  onGuardar,
}: {
  inicial: MovimientoCaja | null;
  onCerrar: () => void;
  onGuardar: (m: MovimientoCaja) => void;
}) {
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">(inicial ? (inicial.monto >= 0 ? "INGRESO" : "EGRESO") : "EGRESO");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyIso());
  const [concepto, setConcepto] = useState(inicial?.concepto ?? "");
  const [categoria, setCategoria] = useState<CategoriaMovimiento>(inicial?.categoria ?? "MATERIALES");
  const [fuente, setFuente] = useState<FuenteFondo>(inicial?.fuente ?? "CAJA_CHICA");
  const [metodo, setMetodo] = useState<MetodoPago>(inicial?.metodo ?? "EFECTIVO");
  const [responsable, setResponsable] = useState(inicial?.responsable ?? "");
  const [monto, setMonto] = useState(inicial ? String(Math.abs(inicial.monto)) : "");
  const [estado] = useState<MovimientoCaja["estado"]>(inicial?.estado ?? "PENDIENTE");
  const [ruc, setRuc] = useState(inicial?.ruc ?? "");
  const [factura, setFactura] = useState(inicial?.factura ?? "");

  const puedeGuardar = concepto.trim().length > 0 && Number(monto) > 0;

  return (
    <Modal abierto titulo={inicial ? "Editar movimiento" : "Nuevo movimiento"} icono="receipt" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Boton variante={tipo === "INGRESO" ? "primario" : "secundario"} icono="north_east" onClick={() => setTipo("INGRESO")}>
            Ingreso
          </Boton>
          <Boton variante={tipo === "EGRESO" ? "primario" : "secundario"} icono="south_west" onClick={() => setTipo("EGRESO")}>
            Egreso
          </Boton>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <Texto type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Monto (Gs.)">
            <Texto
              type="number"
              inputMode="numeric"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Campo>
        </div>

        <Campo etiqueta="Concepto">
          <Texto value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Qué movimiento fue…" />
        </Campo>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo etiqueta="Categoría">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaMovimiento)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{CATEGORIA_NOMBRE[c]}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Fuente">
            <Select value={fuente} onChange={(e) => setFuente(e.target.value as FuenteFondo)}>
              {FUENTES.map((f) => (
                <option key={f} value={f}>{FUENTE_NOMBRE[f]}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Método">
            <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {METODOS.map((m) => (
                <option key={m} value={m}>{METODO_NOMBRE[m]}</option>
              ))}
            </Select>
          </Campo>
        </div>

        <Campo etiqueta="Responsable">
          <Texto value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Quién lo registró / lo pagó" />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Factura / recibo" hint="Con factura se puede deducir el gasto">
            <Texto value={factura} onChange={(e) => setFactura(e.target.value)} />
          </Campo>
          <Campo etiqueta="RUC del emisor">
            <Texto value={ruc} onChange={(e) => setRuc(e.target.value)} />
          </Campo>
        </div>

        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={!puedeGuardar}
            onClick={() => {
              onGuardar({
                id: inicial?.id ?? `mov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                fecha,
                concepto: concepto.trim(),
                categoria,
                fuente,
                metodo,
                responsable: responsable.trim() || "—",
                monto: (tipo === "INGRESO" ? 1 : -1) * Math.round(Number(monto)),
                estado,
                ruc: ruc.trim() || undefined,
                factura: factura.trim() || undefined,
              });
              onCerrar();
            }}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Certificados                                                        */
/* ------------------------------------------------------------------ */

function CertificadosView({ datos, guardar }: { datos: DatosFinanzas; guardar: (d: DatosFinanzas) => void }) {
  const { fmt } = useMoneda();
  const [nuevo, setNuevo] = useState(false);

  const siguienteNumero = datos.certificados.length
    ? Math.max(...datos.certificados.map((c) => c.numero)) + 1
    : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline-md">Certificados de obra</h2>
          <p className="font-body-sm text-on-surface-variant">
            {totalCertificado(datos.certificados).toLocaleString("es-PY")} Gs. certificados ·{" "}
            {(totalCobrado(datos.certificados) > 0 && totalCertificado(datos.certificados) > 0
              ? (totalCobrado(datos.certificados) / totalCertificado(datos.certificados)) * 100
              : 0).toFixed(1)
              .replace(".", ",")}% cobrado
          </p>
        </div>
        <Boton variante="primario" icono="add" onClick={() => setNuevo(true)}>
          Nuevo certificado
        </Boton>
      </div>

      {datos.certificados.length === 0 ? (
        <EmptyState icono="verified" titulo="Sin certificados" descripcion="Cargá el primer certificado de avance." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>N°</Th>
              <Th>Período</Th>
              <Th derecha>Monto</Th>
              <Th derecha>Cobrado</Th>
              <Th derecha>Saldo</Th>
              <Th>Avance</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {datos.certificados.map((c) => {
              const saldo = c.monto - c.montoCobrado;
              return (
                <tr key={c.id} className="hover:bg-surface-container-low">
                  <Td><span className="font-label-md">{String(c.numero).padStart(2, "0")}</span></Td>
                  <Td>{c.periodo}</Td>
                  <Td derecha>{fmt(c.monto)}</Td>
                  <Td derecha>{fmt(c.montoCobrado)}</Td>
                  <Td derecha className={saldo > 0 ? "text-error" : ""}>{fmt(saldo)}</Td>
                  <Td>
                    <Progress valor={c.monto > 0 ? c.montoCobrado / c.monto : 0} className="w-24" />
                  </Td>
                  <Td>
                    <Chip tono={c.estado === "COBRADO" ? "exito" : c.estado === "EN_AUDITORIA" ? "advertencia" : "neutro"}>
                      {c.estado === "COBRADO" ? "Cobrado" : c.estado === "EN_AUDITORIA" ? "En auditoría" : "Pendiente"}
                    </Chip>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      {saldo > 0 && (
                        <Boton
                          tamano="sm"
                          variante="fantasma"
                          icono="payments"
                          onClick={() => {
                            const v = prompt(
                              `Monto a cobrar del certificado N° ${c.numero} (saldo ${saldo}):`,
                              String(saldo),
                            );
                            if (v && Number(v) > 0) guardar(cobrarCertificado(datos, c.id, Number(v)));
                          }}
                        />
                      )}
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        icono="delete"
                        onClick={() => confirm("¿Eliminar certificado?") && guardar(removeCertificado(datos, c.id))}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}

      {nuevo && (
        <Modal abierto titulo="Nuevo certificado" icono="verified" onClose={() => setNuevo(false)}>
          <CertificadoForm
            numero={siguienteNumero}
            onGuardar={(c) => {
              guardar(addCertificado(datos, { ...c, id: `cert-${Date.now().toString(36)}` }));
              setNuevo(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function CertificadoForm({
  numero,
  onGuardar,
}: {
  numero: number;
  onGuardar: (c: Omit<CertificadoObra, "id">) => void;
}) {
  const [periodo, setPeriodo] = useState(
    new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
  );
  const [monto, setMonto] = useState("");
  const [montoCobrado, setMontoCobrado] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="N°">
          <Texto value={numero} readOnly className="opacity-60" />
        </Campo>
        <Campo etiqueta="Período">
          <Texto value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Monto (Gs.)">
        <Texto type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </Campo>
      <Campo etiqueta="Cobrado al día (Gs.)" hint="0 si todavía no se cobró">
        <Texto type="number" inputMode="numeric" value={montoCobrado} onChange={(e) => setMontoCobrado(e.target.value)} />
      </Campo>
      <div className="flex justify-end">
        <Boton
          variante="primario"
          icono="check"
          disabled={Number(monto) > 0 === false}
          onClick={() =>
            onGuardar({
              numero,
              periodo: periodo.trim() || "—",
              monto: Math.round(Number(monto)) || 0,
              montoCobrado: Math.round(Number(montoCobrado)) || 0,
              estado: Number(montoCobrado) > 0 && Number(montoCobrado) >= Number(monto) ? "COBRADO" : "PENDIENTE",
            })
          }
        >
          Guardar
        </Boton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Subcontratos                                                        */
/* ------------------------------------------------------------------ */

function SubcontratosView({ datos, guardar }: { datos: DatosFinanzas; guardar: (d: DatosFinanzas) => void }) {
  const { fmt } = useMoneda();
  const [nuevo, setNuevo] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-md">Contratos con subcontratistas</h2>
        <Boton variante="primario" icono="add" onClick={() => setNuevo(true)}>
          Nuevo subcontrato
        </Boton>
      </div>

      {datos.subcontratos.length === 0 ? (
        <EmptyState icono="handshake" titulo="Sin subcontratos" descripcion="Cargá el primer contrato de subcontratación." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Empresa</Th>
              <Th>Especialidad</Th>
              <Th>Contrato</Th>
              <Th derecha>Contratado</Th>
              <Th derecha>Certificado</Th>
              <Th>Avance</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {datos.subcontratos.map((s) => (
              <tr key={s.id} className="hover:bg-surface-container-low">
                <Td><span className="font-body-md">{s.empresa}</span></Td>
                <Td className="text-on-surface-variant">{s.especialidad}</Td>
                <Td><span className="font-mono text-xs">{s.contratoNro}</span></Td>
                <Td derecha>{fmt(s.montoContratado)}</Td>
                <Td derecha>{fmt(s.montoCertificado)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Progress valor={s.avance} className="w-24" />
                    <span className="font-label-sm">{formatPct(s.avance, 0)}</span>
                  </div>
                </Td>
                <Td>
                  <select
                    value={s.estado}
                    onChange={(e) => guardar(patchSubcontrato(datos, s.id, { estado: e.target.value as Subcontrato["estado"] }))}
                    className="bg-surface-container-low border border-outline-variant rounded-sm px-1.5 py-1 text-xs cursor-pointer"
                  >
                    <option value="EN_EJECUCION">En ejecución</option>
                    <option value="FINALIZADO">Finalizado</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </select>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono="edit"
                      onClick={() => {
                        const av = prompt("Avance del contrato (0-100):", String(Math.round(s.avance * 100)));
                        const cert = prompt("Monto certificado (Gs.):", String(s.montoCertificado));
                        if (av != null && Number(av) >= 0) {
                          guardar(patchSubcontrato(datos, s.id, { avance: Math.min(100, Number(av)) / 100 }));
                        }
                        if (cert != null && Number(cert) >= 0) {
                          guardar(patchSubcontrato(datos, s.id, { montoCertificado: Math.round(Number(cert)) }));
                        }
                      }}
                    />
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono="delete"
                      onClick={() => confirm("¿Eliminar subcontrato?") && guardar(removeSubcontrato(datos, s.id))}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      {nuevo && (
        <Modal abierto titulo="Nuevo subcontrato" icono="handshake" onClose={() => setNuevo(false)}>
          <SubcontratoForm
            onGuardar={(s) => {
              guardar(addSubcontrato(datos, { ...s, id: `sub-${Date.now().toString(36)}` }));
              setNuevo(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function SubcontratoForm({ onGuardar }: { onGuardar: (s: Omit<Subcontrato, "id">) => void }) {
  const [empresa, setEmpresa] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [contratoNro, setContratoNro] = useState("");
  const [montoContratado, setMontoContratado] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Empresa">
        <Texto value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
      </Campo>
      <Campo etiqueta="Especialidad">
        <Texto value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="N° de contrato">
          <Texto value={contratoNro} onChange={(e) => setContratoNro(e.target.value)} />
        </Campo>
        <Campo etiqueta="Monto contratado (Gs.)">
          <Texto type="number" inputMode="numeric" value={montoContratado} onChange={(e) => setMontoContratado(e.target.value)} />
        </Campo>
      </div>
      <div className="flex justify-end">
        <Boton
          variante="primario"
          icono="check"
          disabled={empresa.trim().length === 0}
          onClick={() =>
            onGuardar({
              empresa: empresa.trim(),
              especialidad: especialidad.trim(),
              contratoNro: contratoNro.trim() || "—",
              montoContratado: Math.round(Number(montoContratado)) || 0,
              montoCertificado: 0,
              avance: 0,
              estado: "PENDIENTE",
            })
          }
        >
          Guardar
        </Boton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jornaleros                                                          */
/* ------------------------------------------------------------------ */

function JornalerosView({ datos, guardar }: { datos: DatosFinanzas; guardar: (d: DatosFinanzas) => void }) {
  const { fmt } = useMoneda();
  const [nuevo, setNuevo] = useState(false);
  const [jornaleroId, setJornaleroId] = useState(datos.jornaleros[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoyIso());
  const [horasNormales, setHorasNormales] = useState("8");
  const [horasExtra, setHorasExtra] = useState("0");

  const jornaleroActual = datos.jornaleros.find((j) => j.id === jornaleroId) ?? null;
  const impagas = datos.jornadas.filter((j) => !j.pagada);
  const resumenActual = jornaleroActual ? resumirLiquidacion(jornaleroActual, datos.jornadas) : null;

  const jornadasDel = (id: string) =>
    datos.jornadas
      .filter((j) => j.jornaleroId === id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Jornaleros activos" valor={datos.jornaleros.filter((j) => j.activo).length} icono="engineering" />
        <Kpi etiqueta="Jornadas impagas" valor={impagas.length} icono="schedule" />
        <Kpi etiqueta="Pendiente de liquidar" valor={fmt((resumenActual ?? { total: 0 }).total)} icono="payments" />
        <Kpi etiqueta="Liquidaciones" valor={datos.liquidaciones.length} icono="receipt" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Jornaleros */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-headline-md">Jornaleros</h3>
            <Boton tamano="sm" variante="secundario" icono="add" onClick={() => setNuevo(true)}>
              Alta
            </Boton>
          </div>
          <div className="flex flex-col divide-y divide-outline-variant">
            {datos.jornaleros.map((j) => {
              const porLiquidar = resumirLiquidacion(j, datos.jornadas);
              return (
                <div key={j.id} className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => setJornaleroId(j.id)}
                    className={`flex flex-1 items-center gap-3 text-left cursor-pointer rounded-sm px-2 py-1 ${jornaleroId === j.id ? "bg-surface-container-low" : "hover:bg-surface-container-low"}`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-container-high border border-outline-variant">
                      <span className="font-label-sm">{j.nombre.slice(0, 1)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-body-md truncate">{j.nombre}</span>
                      <span className="block font-body-sm text-on-surface-variant">
                        {ROL_NOMBRE[j.rol]} · {fmt(j.jornalDiario)}
                      </span>
                    </span>
                    {porLiquidar.total > 0 && (
                      <Chip tono="advertencia">{fmtCompactoStr(porLiquidar.total)}</Chip>
                    )}
                  </button>
                  <label className="flex items-center gap-1 font-label-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={j.activo}
                      onChange={(e) => guardar(patchJornalero(datos, j.id, { activo: e.target.checked }))}
                    />
                    {j.activo ? "Alta" : "Baja"}
                  </label>
                </div>
              );
            })}
            {datos.jornaleros.length === 0 && (
              <EmptyState icono="groups" titulo="Sin jornaleros" />
            )}
          </div>
        </Card>

        {/* Jornadas + liquidación */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-headline-md">Jornadas del día</h3>
            <span className="font-body-sm text-on-surface-variant">
              {jornaleroActual?.nombre ?? "Seleccioná un jornalero"}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Campo etiqueta="Jornalero" className="flex-1">
              <Select value={jornaleroId} onChange={(e) => setJornaleroId(e.target.value)}>
                {datos.jornaleros.map((j) => (
                  <option key={j.id} value={j.id}>{j.nombre}</option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Fecha">
              <Texto type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo etiqueta="Horas">
              <div className="flex items-center gap-1">
                <Texto
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="w-16"
                  value={horasNormales}
                  onChange={(e) => setHorasNormales(e.target.value)}
                />
                <span className="font-label-sm text-on-surface-variant">+</span>
                <Texto
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="w-14"
                  value={horasExtra}
                  onChange={(e) => setHorasExtra(e.target.value)}
                />
                <span className="font-label-sm text-on-surface-variant">ext.</span>
              </div>
            </Campo>
            <Boton
              variante="primario"
              icono="add"
              disabled={!jornaleroActual || Number(horasNormales) + Number(horasExtra) <= 0}
              onClick={() => {
                guardar(
                  addJornada(datos, {
                    id: `jrn-${Date.now().toString(36)}`,
                    jornaleroId,
                    fecha,
                    horasNormales: Number(horasNormales) || 0,
                    horasExtra: Number(horasExtra) || 0,
                    pagada: false,
                  }),
                );
              }}
            >
              Cargar
            </Boton>
          </div>

          {jornaleroActual && (
            <div className="mt-3">
              <div className="rounded-sm border border-outline-variant bg-surface-container-low p-3">
                {impagas.some((x) => x.jornaleroId === jornaleroActual.id) ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-label-sm text-on-surface-variant">Liquidación pendiente</p>
                      <p className="font-headline-lg">
                        {resumenActual?.diasTrabajados} día(s) · {resumenActual?.horasOrdinarias}h +{" "}
                        {resumenActual?.horasExtra}h extra
                      </p>
                      <p className="font-body-sm text-on-surface-variant">
                        Jornal {fmt(jornaleroActual.jornalDiario)}/día · total {fmt(resumenActual?.total ?? 0)}
                      </p>
                    </div>
                    <Boton
                      variante="secundario"
                      icono="payments"
                      disabled={!resumenActual || resumenActual.total <= 0}
                      onClick={() => confirm("¿Liquidar y pagar estas jornadas? Se descuenta de caja chica.") && guardar(liquidarJornalero(datos, jornaleroActual.id))}
                    >
                      Liquidar y pagar
                    </Boton>
                  </div>
                ) : (
                  <p className="font-body-sm text-on-surface-variant">
                    Todas las jornadas de este jornalero están pagadas.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-3">
            <p className="font-label-sm mb-2 text-on-surface-variant">
              Últimas jornadas de {jornaleroActual?.nombre ?? "…"}
            </p>
            <Tabla>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th derecha>Horas</Th>
                  <Th derecha>Extra</Th>
                  <Th derecha>Monto</Th>
                  <Th>Paga</Th>
                </tr>
              </thead>
              <tbody>
                {(jornaleroActual ? jornadasDel(jornaleroActual.id) : [])
                  .slice(0, 8)
                  .map((j) => (
                    <tr key={j.id}>
                      <Td>{formatFecha(j.fecha)}</Td>
                      <Td derecha>{j.horasNormales}</Td>
                      <Td derecha>{j.horasExtra > 0 ? `${j.horasExtra}h` : "—"}</Td>
                      <Td derecha>{fmt(montoJornada(jornaleroActual!, j))}</Td>
                      <Td>
                        <Chip tono={j.pagada ? "exito" : "advertencia"}>{j.pagada ? "Pagada" : "Impaga"}</Chip>
                      </Td>
                    </tr>
                  ))}
                {(jornaleroActual ? jornadasDel(jornaleroActual.id) : []).length === 0 && (
                  <tr>
                    <Td className="text-on-surface-variant">Sin jornadas cargadas.</Td>
                  </tr>
                )}
              </tbody>
            </Tabla>
          </div>
        </Card>
      </div>

      {nuevo && (
        <Modal abierto titulo="Alta de jornalero" icono="engineering" onClose={() => setNuevo(false)}>
          <JornaleroForm
            onGuardar={(j) => {
              guardar(addJornalero(datos, j));
              setNuevo(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function fmtCompactoStr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return `${v}`;
}

function JornaleroForm({ onGuardar }: { onGuardar: (j: Jornalero) => void }) {
  const [nombre, setNombre] = useState("");
  const [ci, setCi] = useState("");
  const [rol, setRol] = useState<Jornalero["rol"]>("OFICIAL");
  const [oficio, setOficio] = useState("");
  const [jornalDiario, setJornalDiario] = useState("100000");

  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Nombre y apellido">
        <Texto value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cédula">
          <Texto value={ci} onChange={(e) => setCi(e.target.value)} />
        </Campo>
        <Campo etiqueta="Oficio">
          <Texto value={oficio} onChange={(e) => setOficio(e.target.value)} placeholder="Albañilería" />
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
      <div className="flex justify-end">
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
  );
}