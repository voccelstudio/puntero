import { imprimir } from "@/dominio/exportar";
import { Boton } from "@/ui/base";

/**
 * Par de botones "CSV" + "Imprimir / PDF" para las cabeceras de módulo.
 *
 * Va marcado `no-print` para que no aparezca en el propio papel. El componente
 * de la pantalla solo se preocupa por armar sus filas.
 */
export function BotonesExportar({
  onCsv,
  etiquetaCsv = "CSV",
}: {
  onCsv: () => void;
  etiquetaCsv?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 no-print">
      <Boton variante="secundario" icono="download" onClick={onCsv}>
        {etiquetaCsv}
      </Boton>
      <Boton variante="secundario" icono="print" onClick={imprimir}>
        Imprimir / PDF
      </Boton>
    </div>
  );
}
