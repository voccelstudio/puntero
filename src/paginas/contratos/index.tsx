import { useState } from "react";
import { useMoneda } from "@/contexto/moneda";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import { nuevoId } from "@/dominio/calculo";
import { descargarCsv } from "@/dominio/exportar";
import { formatFecha, formatPct, hoyIso, sumarDias } from "@/dominio/formato";
import { semillaContratos } from "@/dominio/semillas/contratos";
import { semillaFinanzas } from "@/dominio/semillas/finanzas";
import type { Contrato, DatosContratos, DatosFinanzas, EstadoContrato, TipoContrato } from "@/dominio/tipos";
import { Area, Boton, Campo, Card, Chip, EmptyState, Kpi, Modal, Progress, Select, Tabla, Td, Texto, Th } from "@/ui/base";
import { BotonesExportar } from "@/ui/exportar";
import {
  ESTADO_CONTRATO_NOMBRE,
  TIPO_CONTRATO_NOMBRE,
  addContrato,
  avancePlazo,
  contratosActivos,
  ejecutadoContrato,
  patchContrato,
  porVencer,
  removeContrato,
  saldoContrato,
  totalContratado,
  totalRetenciones,
} from "@/paginas/contratos/operaciones";

type Tono = "neutro" | "primario" | "secundario" | "tertiary" | "exito" | "error" | "advertencia";

const ESTADO_TONO: Record<EstadoContrato, Tono> = {
  BORRADOR: "neutro",
  ACTIVO: "exito",
  SUSPENDIDO: "advertencia",
  FINALIZADO: "primario",
  RESCINDIDO: "error",
};

export function PaginaContratos() {
  const { obra } = useObra();
  const { fmt } = useMoneda();
  const { datos, guardar } = useColeccion<DatosContratos>(obra.id, "contratos", semillaContratos());
  const finanzas = useColeccion<DatosFinanzas>(obra.id, "finanzas", semillaFinanzas());
  const [form, setForm] = useState<Contrato | "nuevo" | null>(null);

  const vencen = porVencer(datos);
  const ejecutado = (id: string) => ejecutadoContrato(finanzas.datos.movimientos, id);
  const totalEjecutado = datos.contratos.reduce((a, c) => a + ejecutado(c.id), 0);
  const totalSaldo = datos.contratos.reduce((a, c) => a + saldoContrato(c, ejecutado(c.id)), 0);

  const exportarCsv = () =>
    descargarCsv(
      `contratos-${obra.codigo}`,
      ["Número", "Título", "Tipo", "Contraparte", "Monto (Gs.)", "Retención", "Inicio", "Fin", "Estado"],
      datos.contratos.map((c) => [
        c.numero,
        c.titulo,
        TIPO_CONTRATO_NOMBRE[c.tipo],
        c.contraparte,
        c.monto,
        formatPct(c.retencion),
        c.fechaInicio,
        c.fechaFin,
        ESTADO_CONTRATO_NOMBRE[c.estado],
      ]),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Contratación · Contratos</p>
          <h1 className="font-headline-xl">Contratos y subcontratos</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obra.nombre} · {datos.contratos.length} contrato(s) · {contratosActivos(datos)} activo(s)
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 no-print">
          <BotonesExportar onCsv={exportarCsv} />
          <Boton variante="primario" icono="add" onClick={() => setForm("nuevo")}>
            Nuevo contrato
          </Boton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Contratos activos" valor={contratosActivos(datos)} icono="description" />
        <Kpi etiqueta="Monto contratado" valor={fmt(totalContratado(datos))} pie={`Retenciones ${fmt(totalRetenciones(datos))}`} icono="payments" />
        <Kpi etiqueta="Ejecutado" valor={fmt(totalEjecutado)} pie="imputado desde Finanzas" icono="trending_up" />
        <Kpi etiqueta="Saldo pendiente" valor={fmt(totalSaldo)} alerta={totalSaldo > 0} icono="pending_actions" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Por vencer (30 días)" valor={vencen.length} icono="event_busy" alerta={vencen.length > 0} />
      </div>

      {datos.contratos.length === 0 ? (
        <EmptyState
          icono="description"
          titulo="Sin contratos"
          descripcion="Cargá el contrato del comitente y los subcontratos con sus montos, plazos y retenciones."
          accion={<Boton variante="primario" icono="add" onClick={() => setForm("nuevo")}>Nuevo contrato</Boton>}
        />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Número</Th>
              <Th>Contrato</Th>
              <Th>Tipo</Th>
              <Th derecha>Monto</Th>
              <Th derecha>Retención</Th>
              <Th derecha>Ejecutado</Th>
              <Th derecha>Saldo</Th>
              <Th>Plazo</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {datos.contratos.map((c) => (
              <tr key={c.id} className="hover:bg-surface-container-low">
                <Td className="font-mono text-xs">{c.numero}</Td>
                <Td>
                  <span className="block font-body-md">{c.titulo}</span>
                  <span className="block font-body-sm text-on-surface-variant">{c.contraparte}</span>
                </Td>
                <Td><Chip tono="neutro">{TIPO_CONTRATO_NOMBRE[c.tipo]}</Chip></Td>
                <Td derecha>{fmt(c.monto)}</Td>
                <Td derecha className="text-on-surface-variant">{formatPct(c.retencion)}</Td>
                <Td derecha>{fmt(ejecutado(c.id))}</Td>
                <Td derecha className={saldoContrato(c, ejecutado(c.id)) === 0 ? "text-ok" : ""}>
                  {fmt(saldoContrato(c, ejecutado(c.id)))}
                </Td>
                <Td className="min-w-40">
                  <span className="block font-body-sm text-on-surface-variant">
                    {formatFecha(c.fechaInicio)} → {formatFecha(c.fechaFin)}
                  </span>
                  <Progress valor={avancePlazo(c)} className="mt-1" />
                </Td>
                <Td><Chip tono={ESTADO_TONO[c.estado]}>{ESTADO_CONTRATO_NOMBRE[c.estado]}</Chip></Td>
                <Td>
                  <div className="flex gap-1 no-print">
                    <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => setForm(c)} />
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono="delete"
                      onClick={() => confirm("¿Eliminar este contrato?") && guardar(removeContrato(datos, c.id))}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      <Card className="print-break-avoid">
        <p className="font-label-sm text-on-surface-variant">
          Los contratos respaldan los certificados y los pagos de Finanzas: el contrato del comitente contra los
          cobros del cliente y los subcontratos/proveedores contra los pagos. Al registrar un movimiento en
          Finanzas podés imputarlo a un contrato para ver su ejecutado y su saldo pendiente acá.
        </p>
      </Card>

      {form && (
        <ContratoForm
          valor={form === "nuevo" ? null : form}
          onCerrar={() => setForm(null)}
          onGuardar={(c) => {
            guardar(form === "nuevo" ? addContrato(datos, { ...c, id: nuevoId("ctr") }) : patchContrato(datos, form.id, c));
            setForm(null);
          }}
        />
      )}
    </div>
  );
}

function ContratoForm({
  valor,
  onCerrar,
  onGuardar,
}: {
  valor: Contrato | null;
  onCerrar: () => void;
  onGuardar: (c: Omit<Contrato, "id">) => void;
}) {
  const [numero, setNumero] = useState(valor?.numero ?? "");
  const [titulo, setTitulo] = useState(valor?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoContrato>(valor?.tipo ?? "CLIENTE");
  const [contraparte, setContraparte] = useState(valor?.contraparte ?? "");
  const [monto, setMonto] = useState(String(valor?.monto ?? 0));
  const [fechaInicio, setFechaInicio] = useState(valor?.fechaInicio ?? hoyIso());
  const [fechaFin, setFechaFin] = useState(valor?.fechaFin ?? sumarDias(hoyIso(), 180));
  const [estado, setEstado] = useState<EstadoContrato>(valor?.estado ?? "BORRADOR");
  const [retencion, setRetencion] = useState(String(Math.round((valor?.retencion ?? 0) * 100)));
  const [nota, setNota] = useState(valor?.nota ?? "");

  return (
    <Modal abierto titulo={valor ? "Editar contrato" : "Nuevo contrato"} icono="description" onClose={onCerrar}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Número">
            <Texto value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="CT-2026-001" />
          </Campo>
          <Campo etiqueta="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoContrato)}>
              {(Object.keys(TIPO_CONTRATO_NOMBRE) as TipoContrato[]).map((t) => (
                <option key={t} value={t}>{TIPO_CONTRATO_NOMBRE[t]}</option>
              ))}
            </Select>
          </Campo>
        </div>
        <Campo etiqueta="Título">
          <Texto value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Contrato principal de obra" />
        </Campo>
        <Campo etiqueta="Contraparte">
          <Texto value={contraparte} onChange={(e) => setContraparte(e.target.value)} placeholder="Comitente / subcontratista" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Monto (Gs.)">
            <Texto type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Campo>
          <Campo etiqueta="Retención (%)" hint="Fondo de garantía">
            <Texto type="number" inputMode="numeric" min={0} max={100} value={retencion} onChange={(e) => setRetencion(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Inicio">
            <Texto type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </Campo>
          <Campo etiqueta="Fin">
            <Texto type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Estado">
          <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoContrato)}>
            {(Object.keys(ESTADO_CONTRATO_NOMBRE) as EstadoContrato[]).map((s) => (
              <option key={s} value={s}>{ESTADO_CONTRATO_NOMBRE[s]}</option>
            ))}
          </Select>
        </Campo>
        <Campo etiqueta="Nota">
          <Area value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={titulo.trim().length === 0}
            onClick={() =>
              onGuardar({
                numero: numero.trim() || "Sin número",
                titulo: titulo.trim(),
                tipo,
                contraparte: contraparte.trim(),
                monto: Math.round(Number(monto)) || 0,
                fechaInicio,
                fechaFin,
                estado,
                retencion: Math.min(1, Math.max(0, (Number(retencion) || 0) / 100)),
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
