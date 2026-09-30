"use client";

import { useState } from "react";
import { useMoneda } from "@/components/moneda-provider";
import { Icono } from "@/components/icono";
import {
  Button,
  Card,
  CardAcento,
  CardTitle,
  Chip,
  Kpi,
  Progress,
  SectionHeader,
  Td,
  Th,
  Tabla,
} from "@/components/ui";
import { FASES_PRESUPUESTO, OBRA, PARAMETROS_FINANCIEROS } from "@/lib/data/obra";
import { calcularPresupuesto } from "@/lib/calculo";
import {
  FLUJO_SEMANAL,
  LIQUIDACIONES_JORNAL,
  MOVIMIENTOS_CAJA,
  SUBCONTRATOS,
} from "@/lib/data/finanzas";
import { ACOPIOS } from "@/lib/data/materiales";
import { formatFecha, formatNumero, formatPct, formatUnidad } from "@/lib/format";

const RESUMEN = calcularPresupuesto(
  FASES_PRESUPUESTO.flatMap((f) => f.items),
  PARAMETROS_FINANCIEROS,
);

/** Fondo fijo de caja en terreno. */
const FONDO_FIJO = 15_000_000;
const CERTIFICADO = Math.round(RESUMEN.costoDirecto * 0.84);
const COBRADO = Math.round(CERTIFICADO * 0.947);
const EGRESOS = {
  materiales: 54_200_000,
  manoObra: 32_400_000,
  subcontratos: 8_200_000,
};
const MARGEN_OBJETIVO = 0.2;
const GANANCIA = Math.round(CERTIFICADO - EGRESOS.materiales - EGRESOS.manoObra - EGRESOS.subcontratos);
const MARGEN = CERTIFICADO > 0 ? GANANCIA / CERTIFICADO : 0;

const TABS = [
  { id: "caja", label: "Caja chica diaria de obra", icon: "receipt", badge: "4 pend." },
  { id: "jornales", label: "Jornaleros, subcontratos y proveedores", icon: "engineering", badge: "18 nóminas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MAX_FLUJO = Math.max(...FLUJO_SEMANAL.map((s) => Math.abs(s.neto)));

function BarraFlujo({ neto, semana }: { neto: number; semana: number }) {
  const positivo = neto >= 0;
  const alto = Math.max(8, (Math.abs(neto) / MAX_FLUJO) * 40);

  return (
    <div
      className={`flex-1 rounded-t ${positivo ? "bg-tertiary-container" : "bg-surface-container"}`}
      style={{ height: `${alto}px` }}
      title={`Semana ${semana}: ${positivo ? "+" : "-"} ${neto.toLocaleString("es-PY")} Gs`}
    />
  );
}

function TabCaja({ fmt }: { fmt: (n: number) => string }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");

  const pendientes = MOVIMIENTOS_CAJA.filter((m) => m.estado === "PENDIENTE");
  const totalEgresos = MOVIMIENTOS_CAJA.filter((m) => m.monto < 0).reduce((a, m) => a + m.monto, 0);
  const saldoCaja = FONDO_FIJO + totalEgresos;

  return (
    <div className="flex flex-col gap-space-md pb-space-xl">
      {/* Alta rápida */}
      <Card className="p-space-md">
        <CardTitle
          titulo="Alta rápida de gasto"
          icono={<Icono name="add_circle" className="text-primary" />}
          extra={<Chip tono="neutro">Requiere aprobación</Chip>}
        />
        <form
          className="mt-space-sm grid grid-cols-1 gap-space-sm md:grid-cols-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-label-sm text-label-sm text-secondary">Concepto</span>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. compra de cemento x 40 bolsas"
              className="rounded bg-surface-container-low px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-secondary">Monto (Gs.)</span>
            <input
              type="number"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="rounded bg-surface-container-low px-space-sm py-1.5 text-right font-label-md text-label-md text-on-surface placeholder:text-secondary focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-secondary">Responsable</span>
            <select className="rounded bg-surface-container-low px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary">
              <option>Capataz Gómez</option>
              <option>Ing. Valenzuela</option>
              <option>Compras</option>
            </select>
          </label>
          <div className="flex items-end gap-space-sm md:col-span-4">
            <Button type="submit" disabled={!concepto || !monto}>
              <Icono name="attachment" tamano="sm" />
              Adjuntar comprobante y enviar
            </Button>
            {concepto || monto ? (
              <Button
                variante="fantasma"
                onClick={() => {
                  setConcepto("");
                  setMonto("");
                }}
              >
                Limpiar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {/* Libro de movimientos */}
      <Card className="overflow-hidden">
        <SectionHeader
          titulo="Libro de caja chica"
          icono={<Icono name="receipt" className="text-primary text-xl" />}
          acciones={
            <>
              <span className="rounded bg-surface-container px-space-sm py-1 font-label-sm text-label-sm text-secondary">
                {pendientes.length} pendientes
              </span>
              <Button variante="secundario" tamano="sm">
                <Icono name="file_download" tamano="sm" />Exportar
              </Button>
            </>
          }
        />
        <Tabla>
          <thead className="bg-surface-container-low text-secondary">
            <tr>
              <Th>Fecha</Th>
              <Th>Concepto</Th>
              <Th>Categoría</Th>
              <Th>Responsable</Th>
              <Th align="right">Monto</Th>
              <Th align="center">Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {MOVIMIENTOS_CAJA.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-surface-container-low/40">
                <Td className="whitespace-nowrap font-label-sm text-label-sm text-secondary">
                  {formatFecha(m.fecha)}
                </Td>
                <Td>
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    {m.concepto}
                  </span>
                  {m.comprobante ? (
                    <span className="block font-label-sm text-label-sm text-secondary">
                      {m.comprobante}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <Chip tono="neutro">{m.categoria}</Chip>
                </Td>
                <Td className="font-body-sm text-body-sm text-on-surface-variant">
                  {m.responsable}
                </Td>
                <Td
                  align="right"
                  className={`font-label-md text-label-md font-semibold ${
                    m.monto < 0 ? "text-secondary" : "text-tertiary"
                  }`}
                >
                  {fmt(m.monto)}
                </Td>
                <Td align="center">
                  <Chip
                    tono={
                      m.estado === "APROBADO" ? "exito" : m.estado === "RECHAZADO" ? "error" : "neutro"
                    }
                  >
                    {m.estado === "APROBADO"
                      ? "Aprobado"
                      : m.estado === "RECHAZADO"
                        ? "Rechazado"
                        : "Pendiente"}
                  </Chip>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-outline bg-surface-container-low font-semibold">
              <Td className="font-headline-sm text-headline-sm" colSpan={4}>
                Total de egresos del período
              </Td>
              <Td align="right" className="font-label-md text-label-md text-secondary">
                {fmt(totalEgresos)}
              </Td>
              <Td />
            </tr>
            <tr className="bg-surface-container font-semibold">
              <Td className="font-headline-sm text-headline-sm" colSpan={4}>
                Saldo de caja en terreno
              </Td>
              <Td align="right" className="font-label-lg text-label-lg text-on-surface">
                {fmt(saldoCaja)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </Tabla>
      </Card>
    </div>
  );
}

function TabJornales({ fmt }: { fmt: (n: number) => string }) {
  const totalJornales = LIQUIDACIONES_JORNAL.reduce((a, j) => a + j.total, 0);
  const pendientes = LIQUIDACIONES_JORNAL.filter((j) => j.estado === "PENDIENTE").length;

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      {/* Liquidación de mano de obra */}
      <Card className="overflow-hidden">
        <SectionHeader
          titulo="Liquidación de mano de obra semanal"
          icono={<Icono name="engineering" className="text-primary text-xl" />}
          acciones={
            <>
              <Chip tono="neutro">{LIQUIDACIONES_JORNAL.length} jornaleros</Chip>
              <Button disabled={pendientes === 0}>
                <Icono name="account_balance" tamano="sm" />
                Transferir lote ({pendientes})
              </Button>
            </>
          }
        />
        <Tabla>
          <thead className="bg-surface-container-low text-secondary">
            <tr>
              <Th>Jornalero</Th>
              <Th>Oficio</Th>
              <Th align="center">Días</Th>
              <Th align="right">Horas ord.</Th>
              <Th align="right">Horas extra</Th>
              <Th align="right">Jornal diario</Th>
              <Th align="right">Total</Th>
              <Th align="center">Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {LIQUIDACIONES_JORNAL.map((j) => (
              <tr key={j.id} className="transition-colors hover:bg-surface-container-low/40">
                <Td>
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    {j.nombre}
                  </span>
                  <span className="block font-label-sm text-label-sm text-secondary">
                    CI {j.ci}
                  </span>
                </Td>
                <Td>
                  <Chip tono="neutro">{j.oficio}</Chip>
                </Td>
                <Td align="center" className="font-label-md text-label-md text-on-surface">
                  {j.diasTrabajados}
                </Td>
                <Td align="right" className="font-label-md text-label-md text-on-surface-variant">
                  {j.horasOrdinarias}
                </Td>
                <Td align="right" className="font-label-md text-label-md text-on-surface-variant">
                  {j.horasExtra || "—"}
                </Td>
                <Td align="right" className="font-label-md text-label-md text-on-surface">
                  {fmt(j.jornalDiario)}
                </Td>
                <Td align="right" className="font-label-md text-label-md font-semibold text-on-surface">
                  {fmt(j.total)}
                </Td>
                <Td align="center">
                  <Chip tono={j.estado === "PAGADO" ? "exito" : "neutro"}>
                    {j.estado === "PAGADO" ? "Pagado" : "Pendiente"}
                  </Chip>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-outline bg-surface-container-low font-semibold">
              <Td className="font-headline-sm text-headline-sm" colSpan={6}>
                Total a liquidar
              </Td>
              <Td align="right" className="font-label-lg text-label-lg text-on-surface">
                {fmt(totalJornales)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </Tabla>
      </Card>

      {/* Subcontratos */}
      <div>
        <h2 className="mb-space-sm font-headline-md text-headline-md text-on-surface">
          Subcontratos activos y compromisos financieros
        </h2>
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
          {SUBCONTRATOS.map((sc) => (
            <Card key={sc.id} className="p-space-md">
              <div className="flex items-start justify-between gap-space-sm">
                <div className="flex items-start gap-space-sm">
                  <div className="rounded bg-surface-container p-space-xs text-primary">
                    <Icono name={sc.icono} className="text-xl" />
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      {sc.empresa}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {sc.especialidad}
                    </p>
                    <span className="mt-0.5 block font-label-sm text-label-sm text-secondary">
                      Contrato {sc.contratoNro}
                    </span>
                  </div>
                </div>
                <Chip tono="primario">{formatPct(sc.avance, 0)}</Chip>
              </div>

              <Progress valor={sc.avance} className="mt-space-md" />

              <dl className="mt-space-sm grid grid-cols-2 gap-space-sm text-right">
                <div className="rounded bg-surface-container-low p-space-xs">
                  <dt className="font-label-sm text-label-sm text-secondary">Contratado</dt>
                  <dd className="font-label-md text-label-md font-semibold text-on-surface">
                    {fmt(sc.montoContratado)}
                  </dd>
                </div>
                <div className="rounded bg-surface-container-low p-space-xs">
                  <dt className="font-label-sm text-label-sm text-secondary">Certificado</dt>
                  <dd className="font-label-md text-label-md font-semibold text-primary">
                    {fmt(sc.montoCertificado)}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </div>

      {/* Acopios */}
      <Card className="overflow-hidden">
        <SectionHeader
          titulo="Acopio y materiales almacenados"
          icono={<Icono name="inventory" className="text-primary text-xl" />}
        />
        <Tabla>
          <thead className="bg-surface-container-low text-secondary">
            <tr>
              <Th>Material</Th>
              <Th align="right">Cantidad</Th>
              <Th>Ingreso</Th>
              <Th>Destino en rubros</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {ACOPIOS.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-surface-container-low/40">
                <Td className="font-headline-sm text-headline-sm text-on-surface">
                  {a.material}
                </Td>
                <Td align="right" className="font-label-md text-label-md text-on-surface">
                  {formatNumero(a.cantidad)} {formatUnidad(a.unidad)}
                </Td>
                <Td className="font-label-sm text-label-sm text-secondary">
                  {formatFecha(a.fechaIngreso)}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {a.destinoRubros.map((r) => (
                      <Chip key={r} tono="tertiary">
                        {r}
                      </Chip>
                    ))}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Card>
    </div>
  );
}

export default function FinanzasObra() {
  const { fmt, fmtUsd, tipoCambio } = useMoneda();
  const [tab, setTab] = useState<TabId>("caja");

  const flujoNeto = FLUJO_SEMANAL.reduce((a, s) => a + s.neto, 0);
  const pendienteCobro = CERTIFICADO - COBRADO;
  const totalEgresos = EGRESOS.materiales + EGRESOS.manoObra + EGRESOS.subcontratos;
  const saldoCaja = FONDO_FIJO - totalEgresos;

  return (
    <div>
      {/* Aviso de modo maestro */}
      <div className="px-gutter-desktop pt-space-md">
        <div className="flex items-center justify-between gap-space-sm rounded bg-surface-container-high p-space-sm shadow-sm">
          <div className="flex min-w-0 items-center gap-space-sm">
            <Icono name="lock" className="shrink-0 text-xl text-primary" />
            <div className="flex min-w-0 flex-wrap items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm uppercase tracking-wider text-primary">
                Modo maestro activo:
              </span>
              <span className="truncate font-body-md text-body-md text-on-surface">
                Visualización irrestricta de costos directos, márgenes y liquidación bancaria de
                mano de obra.
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-space-sm">
            <span className="hidden rounded bg-surface-container-lowest px-space-xs py-0.5 font-label-sm text-label-sm text-secondary shadow-sm sm:inline">
              ID: MASTER-SEC-889
            </span>
            <button
              type="button"
              className="rounded p-space-xs text-secondary transition-colors hover:text-on-surface"
              aria-label="Cerrar notificación"
            >
              <Icono name="close" className="text-base" />
            </button>
          </div>
        </div>
      </div>

      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-space-sm px-gutter-desktop py-space-md md:flex-row md:items-center">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
              Control económico · {OBRA.nombre.split("—")[1]?.trim()}
            </span>
            <span className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
              Semana {OBRA.semanaActual} / cert. 04
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Finanzas de obra, caja chica y jornales
          </h1>
        </div>

        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <div className="flex items-center rounded bg-surface-container-low p-0.5 shadow-sm">
            <button
              type="button"
              className="flex items-center gap-1 rounded bg-surface-container-lowest px-space-sm py-1 font-label-sm text-label-sm text-on-surface shadow-sm"
            >
              <Icono name="file_download" tamano="xs" />XLS
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded px-space-sm py-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-on-surface"
            >
              <Icono name="picture_as_pdf" tamano="xs" />PDF
            </button>
          </div>
          <Button>
            <Icono name="account_balance" />
            Conciliar cuentas
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-space-md px-gutter-desktop pb-space-lg md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta="Facturado / certificado"
          valor={fmt(CERTIFICADO)}
          tonoTrafilla="on-secondary-fixed"
          progreso={COBRADO / CERTIFICADO}
          icono={<Icono name="receipt_long" className="text-base text-secondary" />}
          pie={`Cobrado ${fmt(COBRADO)} · pendiente ${fmt(pendienteCobro)}`}
        />
        <Kpi
          etiqueta="Egresos ejecutados"
          valor={fmt(totalEgresos)}
          tonoTrafilla="primary"
          pie={`${formatPct(totalEgresos / RESUMEN.total)} del presupuesto · margen objetivo ${formatPct(MARGEN_OBJETIVO, 0)}`}
          icono={<Icono name="payments" className="text-base text-primary" />}
        />
        <Kpi
          etiqueta="Margen operativo"
          valor={formatPct(MARGEN)}
          tonoTrafilla="tertiary"
          pie={`Ganancia acumulada: ${fmt(GANANCIA)}`}
          icono={<Icono name="trending_up" className="text-base text-tertiary" />}
        />
        <Kpi
          etiqueta="Caja chica terreno"
          valor={fmt(saldoCaja)}
          tonoTrafilla="primary-container"
          pie={`Fondo fijo: ${fmt(FONDO_FIJO)}`}
          icono={<Icono name="point_of_sale" className="text-base text-primary" />}
        />
      </div>

      {/* Franja de flujo de caja */}
      <div className="px-gutter-desktop pb-space-lg">
        <div className="flex flex-col items-center gap-space-lg rounded bg-surface-container-low p-space-md shadow-sm lg:flex-row">
          <div className="flex w-full items-center gap-space-md lg:w-1/3">
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded bg-tertiary-container text-on-tertiary-container">
              <Icono name="construction" className="text-4xl" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="font-label-sm text-label-sm uppercase text-secondary">
                Inspección de flujo
              </span>
              <span className="truncate font-headline-sm text-headline-sm text-on-surface">
                Torre B — losa nivel +8
              </span>
              <span className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                Certificado mensual N° 4 en revisión por auditoría externa del banco fiduciario.
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col justify-between lg:w-2/3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase text-secondary">
                Flujo neto semanal (ingresos vs. egresos)
              </span>
              <span className="font-label-sm text-label-sm font-semibold text-tertiary">
                + {fmt(flujoNeto)} neto
              </span>
            </div>
            <div className="flex h-12 w-full items-end gap-1.5 rounded bg-surface-container-lowest p-1.5 shadow-sm">
              {FLUJO_SEMANAL.map((s) => (
                <BarraFlujo key={s.semana} neto={s.neto} semana={s.semana} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-gutter-desktop pb-space-md">
        <div
          className="flex w-fit items-center gap-space-xs rounded bg-surface-container-lowest p-1 shadow-sm"
          role="tablist"
          aria-label="Módulos de finanzas"
        >
          {TABS.map((t) => {
            const activo = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-space-xs rounded px-space-md py-1.5 font-headline-sm text-headline-sm transition-all ${
                  activo
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-secondary transition-colors hover:text-on-surface"
                }`}
              >
                <Icono name={t.icon} className="text-base" />
                <span>{t.label}</span>
                <span
                  className={`rounded px-space-xs py-0.5 font-label-sm text-label-sm ${
                    activo ? "bg-on-primary/20" : "bg-surface-container text-on-surface"
                  }`}
                >
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido */}
      <div className="px-gutter-desktop" role="tabpanel">
        {tab === "caja" ? <TabCaja fmt={fmt} /> : <TabJornales fmt={fmt} />}
      </div>

      {/* Pie de referencia cambiaria */}
      <div className="px-gutter-desktop pb-space-lg">
        <CardAcento tono="tertiary" className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <Icono name="account_balance" className="text-xl text-primary" />
            <div>
              <span className="block font-headline-sm text-headline-sm text-on-surface">
                Valores expresados en guaraníes (PYG)
              </span>
              <span className="font-label-sm text-label-sm text-secondary">
                Cotización de referencia 1 US$ = {fmt(tipoCambio)} · equivalentes:
                {" "}
                {fmtUsd(RESUMEN.total)} en total presupuestado
              </span>
            </div>
          </div>
          <Chip tono="primario">IVA {formatPct(PARAMETROS_FINANCIEROS.iva, 0)}</Chip>
        </CardAcento>
      </div>
    </div>
  );
}
