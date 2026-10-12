import { useState } from "react";
import { useObra } from "@/contexto/obra";
import { useColeccion } from "@/dominio/almacen";
import { nuevoId } from "@/dominio/calculo";
import { descargarCsv } from "@/dominio/exportar";
import { formatFecha, formatPct, hoyIso } from "@/dominio/formato";
import { semillaBitacora } from "@/dominio/semillas/bitacora";
import type { ClimaObra, DatosBitacora, EntradaBitacora } from "@/dominio/tipos";
import { Area, Boton, Campo, Card, Chip, EmptyState, Kpi, Modal, Progress, Select, Texto } from "@/ui/base";
import { BotonesExportar } from "@/ui/exportar";
import {
  CLIMA_NOMBRE,
  addEntrada,
  avancePromedio,
  diasConLluvia,
  horasAcumuladas,
  patchEntrada,
  removeEntrada,
  ultimaEntrada,
} from "@/paginas/bitacora/operaciones";

type Tono = "neutro" | "primario" | "secundario" | "tertiary" | "exito" | "error" | "advertencia";

const CLIMA_TONO: Record<ClimaObra, Tono> = {
  SOLEADO: "advertencia",
  NUBLADO: "neutro",
  LLUVIA: "tertiary",
  TORMENTA: "error",
  VIENTO: "secundario",
  CALOR_EXTREMO: "error",
};

export function PaginaBitacora() {
  const { obra } = useObra();
  const { datos, guardar } = useColeccion<DatosBitacora>(obra.id, "bitacora", semillaBitacora());
  const [form, setForm] = useState<EntradaBitacora | "nueva" | null>(null);

  const ultima = ultimaEntrada(datos);
  const avance = avancePromedio(datos);

  const exportarCsv = () =>
    descargarCsv(
      `bitacora-${obra.codigo}`,
      ["Fecha", "Clima", "Temp (°C)", "Personal", "Horas", "Avance", "Actividades", "Incidencias", "Visita", "Responsable"],
      datos.entradas.map((e) => [
        e.fecha,
        CLIMA_NOMBRE[e.clima],
        e.temperatura ?? "",
        e.personalPresente,
        e.horasTrabajadas,
        formatPct(e.avance),
        e.actividades,
        e.incidencias ?? "",
        e.visita ?? "",
        e.responsable,
      ]),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Ejecución · Bitácora</p>
          <h1 className="font-headline-xl">Bitácora diaria y órdenes de trabajo</h1>
          <p className="font-body-sm text-on-surface-variant">
            {obra.nombre} · {datos.entradas.length} parte(s) diario(s) · clima, personal, avance e incidencias
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 no-print">
          <BotonesExportar onCsv={exportarCsv} />
          <Boton variante="primario" icono="add" onClick={() => setForm("nueva")}>
            Nueva entrada
          </Boton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          etiqueta="Personal (último parte)"
          valor={ultima?.personalPresente ?? 0}
          pie={ultima ? formatFecha(ultima.fecha) : "sin partes"}
          icono="groups"
        />
        <Kpi etiqueta="Horas acumuladas" valor={horasAcumuladas(datos)} icono="schedule" />
        <Kpi etiqueta="Días de lluvia" valor={diasConLluvia(datos)} icono="rainy" alerta={diasConLluvia(datos) > 0} />
        <Kpi etiqueta="Avance declarado" valor={formatPct(avance, 0)} icono="trending_up" />
      </div>

      {datos.entradas.length === 0 ? (
        <EmptyState
          icono="fact_check"
          titulo="Sin partes diarios"
          descripcion="Registrá lo que pasa cada día en obra: es el respaldo documental para certificar avances y reclamar adicionales."
          accion={<Boton variante="primario" icono="add" onClick={() => setForm("nueva")}>Nueva entrada</Boton>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {datos.entradas.map((e) => (
            <Card key={e.id} className="print-break-avoid">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline-sm">{formatFecha(e.fecha, "larga")}</span>
                    <Chip tono={CLIMA_TONO[e.clima]}>{CLIMA_NOMBRE[e.clima]}</Chip>
                    {typeof e.temperatura === "number" && <Chip>{e.temperatura} °C</Chip>}
                    <span className="font-body-sm text-on-surface-variant">
                      {e.personalPresente} persona(s) · {e.horasTrabajadas} h
                    </span>
                  </div>
                  <p className="font-body-sm text-on-surface-variant mt-0.5">Responsable: {e.responsable || "—"}</p>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <Boton tamano="sm" variante="fantasma" icono="edit" onClick={() => setForm(e)} />
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    icono="delete"
                    onClick={() => confirm("¿Eliminar esta entrada?") && guardar(removeEntrada(datos, e.id))}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="font-label-sm text-on-surface-variant">Actividades / órdenes de trabajo</p>
                  <p className="font-body-md whitespace-pre-line">{e.actividades || "—"}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {e.incidencias && (
                    <div>
                      <p className="font-label-sm text-on-surface-variant">Incidencias</p>
                      <p className="font-body-md whitespace-pre-line text-error">{e.incidencias}</p>
                    </div>
                  )}
                  {e.visita && (
                    <div>
                      <p className="font-label-sm text-on-surface-variant">Visitas</p>
                      <p className="font-body-md">{e.visita}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between font-label-sm">
                  <span className="text-on-surface-variant">Avance declarado del día</span>
                  <span>{formatPct(e.avance)}</span>
                </div>
                <Progress valor={e.avance} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <EntradaForm
          valor={form === "nueva" ? null : form}
          onCerrar={() => setForm(null)}
          onGuardar={(entrada) => {
            guardar(form === "nueva" ? addEntrada(datos, { ...entrada, id: nuevoId("bit") }) : patchEntrada(datos, form.id, entrada));
            setForm(null);
          }}
        />
      )}
    </div>
  );
}

function EntradaForm({
  valor,
  onCerrar,
  onGuardar,
}: {
  valor: EntradaBitacora | null;
  onCerrar: () => void;
  onGuardar: (e: Omit<EntradaBitacora, "id">) => void;
}) {
  const [fecha, setFecha] = useState(valor?.fecha ?? hoyIso());
  const [clima, setClima] = useState<ClimaObra>(valor?.clima ?? "SOLEADO");
  const [temperatura, setTemperatura] = useState(valor?.temperatura !== undefined ? String(valor.temperatura) : "");
  const [personalPresente, setPersonal] = useState(String(valor?.personalPresente ?? 0));
  const [horasTrabajadas, setHoras] = useState(String(valor?.horasTrabajadas ?? 8));
  const [avance, setAvance] = useState(String(Math.round((valor?.avance ?? 0) * 100)));
  const [actividades, setActividades] = useState(valor?.actividades ?? "");
  const [incidencias, setIncidencias] = useState(valor?.incidencias ?? "");
  const [visita, setVisita] = useState(valor?.visita ?? "");
  const [responsable, setResponsable] = useState(valor?.responsable ?? "");

  return (
    <Modal abierto titulo={valor ? "Editar entrada" : "Nueva entrada"} icono="fact_check" onClose={onCerrar} tamano="lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Fecha">
            <Texto type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Clima">
            <Select value={clima} onChange={(e) => setClima(e.target.value as ClimaObra)}>
              {(Object.keys(CLIMA_NOMBRE) as ClimaObra[]).map((c) => (
                <option key={c} value={c}>{CLIMA_NOMBRE[c]}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Temp. (°C)">
            <Texto type="number" inputMode="numeric" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} />
          </Campo>
          <Campo etiqueta="Personal">
            <Texto type="number" inputMode="numeric" value={personalPresente} onChange={(e) => setPersonal(e.target.value)} />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Horas trabajadas">
            <Texto type="number" inputMode="decimal" value={horasTrabajadas} onChange={(e) => setHoras(e.target.value)} />
          </Campo>
          <Campo etiqueta="Avance del día (%)">
            <Texto type="number" inputMode="numeric" min={0} max={100} value={avance} onChange={(e) => setAvance(e.target.value)} />
          </Campo>
        </div>

        <Campo etiqueta="Actividades / órdenes de trabajo">
          <Area
            value={actividades}
            onChange={(e) => setActividades(e.target.value)}
            placeholder="Hormigonado de columnas eje 3-4, armado de losas…"
          />
        </Campo>
        <Campo etiqueta="Incidencias" hint="Atrasos, clima, faltantes — base para reclamar adicionales">
          <Area value={incidencias} onChange={(e) => setIncidencias(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Visitas">
            <Texto value={visita} onChange={(e) => setVisita(e.target.value)} />
          </Campo>
          <Campo etiqueta="Responsable">
            <Texto value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </Campo>
        </div>

        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={actividades.trim().length === 0}
            onClick={() =>
              onGuardar({
                fecha,
                clima,
                temperatura: temperatura.trim() === "" ? undefined : Math.round(Number(temperatura)),
                personalPresente: Math.round(Number(personalPresente)) || 0,
                horasTrabajadas: Number(horasTrabajadas) || 0,
                avance: Math.min(1, Math.max(0, (Number(avance) || 0) / 100)),
                actividades: actividades.trim(),
                incidencias: incidencias.trim() || undefined,
                visita: visita.trim() || undefined,
                responsable: responsable.trim(),
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
