import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { MonedaProvider } from "@/contexto/moneda";
import { ObraProvider } from "@/contexto/obra";
import { TemaProvider } from "@/contexto/tema";
import { PaginaCronograma } from "@/paginas/cronograma";
import { PaginaFinanzas } from "@/paginas/finanzas";
import { PaginaGente } from "@/paginas/gente";
import { PaginaPresupuesto } from "@/paginas/presupuesto";
import { Shell } from "@/ui/layout";

export default function App() {
  return (
    <HashRouter>
      <TemaProvider>
        <MonedaProvider>
          <ObraProvider>
            <Routes>
              <Route element={<Shell />}>
                <Route path="/" element={<Navigate to="/presupuesto" replace />} />
                <Route path="/presupuesto" element={<PaginaPresupuesto />} />
                <Route path="/finanzas" element={<PaginaFinanzas />} />
                <Route path="/cronograma" element={<PaginaCronograma />} />
                <Route path="/gente" element={<PaginaGente />} />
              </Route>
            </Routes>
          </ObraProvider>
        </MonedaProvider>
      </TemaProvider>
    </HashRouter>
  );
}