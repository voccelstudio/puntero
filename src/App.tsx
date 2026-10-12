import { HashRouter, Route, Routes } from "react-router-dom";
import { MonedaProvider } from "@/contexto/moneda";
import { ObraProvider } from "@/contexto/obra";
import { TemaProvider } from "@/contexto/tema";
import { PaginaBitacora } from "@/paginas/bitacora";
import { PaginaContratos } from "@/paginas/contratos";
import { PaginaCronograma } from "@/paginas/cronograma";
import { PaginaFinanzas } from "@/paginas/finanzas";
import { PaginaGente } from "@/paginas/gente";
import { PaginaInformes } from "@/paginas/informes";
import { PaginaInicio } from "@/paginas/inicio";
import { PaginaPresupuesto } from "@/paginas/presupuesto";
import { PaginaRecursos } from "@/paginas/recursos";
import { Shell } from "@/ui/layout";

export default function App() {
  return (
    <HashRouter>
      <TemaProvider>
        <MonedaProvider>
          <ObraProvider>
            <Routes>
              <Route element={<Shell />}>
                <Route path="/" element={<PaginaInicio />} />
                <Route path="/informes" element={<PaginaInformes />} />
                <Route path="/presupuesto" element={<PaginaPresupuesto />} />
                <Route path="/finanzas" element={<PaginaFinanzas />} />
                <Route path="/contratos" element={<PaginaContratos />} />
                <Route path="/cronograma" element={<PaginaCronograma />} />
                <Route path="/gente" element={<PaginaGente />} />
                <Route path="/bitacora" element={<PaginaBitacora />} />
                <Route path="/recursos" element={<PaginaRecursos />} />
              </Route>
            </Routes>
          </ObraProvider>
        </MonedaProvider>
      </TemaProvider>
    </HashRouter>
  );
}