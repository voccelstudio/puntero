import { useMemo, useState } from "react";
import { computoPorRubro } from "@/dominio/calculo";
import { formatUnidad } from "@/dominio/formato";
import type { DatosPresupuesto } from "@/dominio/tipos";
import { Chip, Modal, Progress, Tabla, Td, Th } from "@/ui/base";

/** Cómputo métrico por rubro y por partida, con desvío presupuestado vs ejecutado. */
export function Computo({
  abierto,
  datos,
  onClose,
}: {
  abierto: boolean;
  datos: DatosPresupuesto;
  onClose: () => void;
}) {
  const [soloConSaldo, setSoloConSaldo] = useState(false);

  const rubros = useMemo(() => {
    const todos = computoPorRubro(datos.fases.flatMap((f) => f.items));
    return soloConSaldo ? todos.filter((r) => r.saldo > 0) : todos;
  }, [datos, soloConSaldo]);

  const totalPresupuestado = rubros.reduce((a, r) => a + r.presupuestado, 0);
  const totalEjecutado = rubros.reduce((a, r) => a + r.ejecutado, 0);
  const totalCosto = rubros.reduce((a, r) => a + r.costoPresupuestado, 0);
  const totalEjecutadoCosto = rubros.reduce((a, r) => a + r.costoEjecutado, 0);

  return (
    <Modal
      abierto={abierto}
      titulo="Cómputo métrico"
      icono="functions"
      onClose={onClose}
      tamano="lg"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip>Presupuestado: {totalPresupuestado.toLocaleString("es-PY")} u</Chip>
            <Chip>Ejecutado: {totalEjecutado.toLocaleString("es-PY")} u</Chip>
            <Chip tono={totalEjecutado <= totalPresupuestado ? "exito" : "error"}>
              Costo prev: Gs. {totalCosto.toLocaleString("es-PY")} · Ejec: Gs.{" "}
              {totalEjecutadoCosto.toLocaleString("es-PY")}
            </Chip>
          </div>
          <label className="flex items-center gap-2 font-label-sm cursor-pointer">
            <input
              type="checkbox"
              checked={soloConSaldo}
              onChange={(e) => setSoloConSaldo(e.target.checked)}
            />
            Solo con saldo
          </label>
        </div>

        <Tabla>
          <thead>
            <tr>
              <Th>Rubro</Th>
              <Th>Unidad</Th>
              <Th derecha>Presupuestado</Th>
              <Th derecha>Ejecutado</Th>
              <Th derecha>Saldo</Th>
              <Th>Avance</Th>
              <Th derecha>Partidas</Th>
            </tr>
          </thead>
          <tbody>
            {rubros.map((r) => (
              <tr key={r.rubroId} className="hover:bg-surface-container-low">
                <Td>
                  <span className="font-body-md">{r.descripcion}</span>
                  <span className="block font-body-sm text-on-surface-variant">
                    {r.categoria} · Gs. {r.precioUnitario.toLocaleString("es-PY")}/u
                  </span>
                </Td>
                <Td>{formatUnidad(r.unidad)}</Td>
                <Td derecha>{r.presupuestado.toLocaleString("es-PY")}</Td>
                <Td derecha>{r.ejecutado.toLocaleString("es-PY")}</Td>
                <Td derecha>
                  <span className={r.saldo < 0 ? "text-error" : ""}>
                    {(r.saldo >= 0 ? "+" : "") + r.saldo.toLocaleString("es-PY")}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2 min-w-32">
                    <Progress valor={r.avance} />
                    <span className="font-label-sm w-10 text-right">
                      {Math.round(r.avance * 100)}%
                    </span>
                  </div>
                </Td>
                <Td derecha>
                  <Chip>{r.totalItems}</Chip>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </div>
    </Modal>
  );
}