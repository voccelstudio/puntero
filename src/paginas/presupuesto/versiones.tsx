import { formatFecha } from "@/dominio/formato";
import type { DatosPresupuesto, VersionPresupuesto } from "@/dominio/tipos";
import { Boton, Chip, EmptyState, Modal, Td, Th, Tabla } from "@/ui/base";

/** Historial de versiones del presupuesto con restauración y eliminación. */
export function Versiones({
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
  const restaurar = (version: VersionPresupuesto) => {
    if (confirm(`¿Restaurar la versión "${version.etiqueta}" al presupuesto activo?`)) {
      onGuardar({
        ...datos,
        fases: version.fases,
        parametros: version.parametros,
        adendas: version.adendas,
      });
    }
  };

  return (
    <Modal abierto={abierto} titulo="Historial de versiones" icono="history" onClose={onClose} tamano="lg">
      {datos.versiones.length === 0 ? (
        <EmptyState
          icono="history"
          titulo="Aún no hay versiones"
          descripcion="Guardá una versión desde el botón «Guardar versión» del presupuesto para poder volver a cualquier estado anterior."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Tabla>
            <thead>
              <tr>
                <Th>Etiqueta</Th>
                <Th>Fecha</Th>
                <Th derecha>Ítems</Th>
                <Th>Estado</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {[...datos.versiones]
                .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                .map((v) => {
                  const totalItems = v.fases.reduce((acc, f) => acc + f.items.length, 0);
                  return (
                    <tr key={v.id} className="hover:bg-surface-container-low">
                      <Td>
                        <span className="font-body-md">{v.etiqueta}</span>
                        <span className="block font-body-sm text-on-surface-variant">{v.id}</span>
                      </Td>
                      <Td>{formatFecha(v.fecha.slice(0, 10))}</Td>
                      <Td derecha>{totalItems}</Td>
                      <Td>
                        <Chip>Histórica</Chip>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Boton tamano="sm" icono="history" onClick={() => restaurar(v)}>
                            Restaurar
                          </Boton>
                          <Boton
                            tamano="sm"
                            variante="peligro"
                            icono="delete"
                            onClick={() => {
                              if (confirm("¿Borrar esta versión del historial?")) {
                                onGuardar({
                                  ...datos,
                                  versiones: datos.versiones.filter((x) => x.id !== v.id),
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
          <p className="font-body-sm text-on-surface-variant">
            Restaurar copia fases, parámetros y adendas de esa versión al presupuesto activo. El
            historial no se pierde.
          </p>
        </div>
      )}
    </Modal>
  );
}