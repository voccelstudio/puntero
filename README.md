# Puntero 4.0

Gestion de obra para constructoras paraguayas: presupuestos, cronograma, finanzas y
control de materiales.

Reescritura de la v2 (Firebase + vanilla JS) sobre **Next.js 16**, React 19, TypeScript y
Tailwind CSS v4.

## Pila

| Capa | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS v4 |
| Lenguaje | TypeScript (strict) |
| Datos | Mock tipado en `src/lib/data/` — sin persistencia todavia |

## Pantallas

| Ruta | Pantalla |
| --- | --- |
| `/` | Centro de comando: KPIs, cronograma critico, bitacora, HSE |
| `/presupuesto` | Constructor de presupuestos: computo por fases, motor financiero, adendas |
| `/finanzas` | Finanzas: caja chica y jornales |
| `/materiales` | Materiales: pedidos, precios de referencia, biblioteca tecnica |

## Como correr

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

## Scripts

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de produccion
npm run start      # servir el build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run check      # typecheck + lint + build
```

## Decisiones de negocio

**Guaranies como moneda base.** Todos los montos se guardan en PYG — la moneda en la que se
mueve plata en obra — y el USD es derivado. El selector de la barra superior recalcula toda
la interfaz entre `Gs.` y `US$`.

**Cotizacion de referencia.** Se consume `open.er-api.com` con revalidacion cada hora y un
respaldo offline (`7300` Gs/USD) para que la app no quede vacia si la API falla. Ojo: la API
no es el Banco Central del Paraguay, asi que para produccion hay que enchufar una fuente
oficial.

**IVA 10%** (Paraguay). Los gastos generales se aplican sobre el costo directo, no sobre el
costo ya cargado con beneficio, para no duplicar la base de calculo.

**Localizacion.** Asunción, MOPC, IPS, Cemento Guarani y normas ASTM.

## Pendiente para produccion

1. **Supabase** — auth + Postgres + RLS por `organization_id`.
2. **Persistencia** — Server Actions para caja chica y pedidos; hoy son estado local.
3. **Multi-tenant** — el aislamiento entre constructoras define si el producto se puede vender.
4. **RBAC** — el "Modo Maestro" implica ocultar costos a ciertos roles; eso es policy, no un
   `if` en el front.

Los datos mock estan en `src/lib/data/*.ts` y todo pasa por `src/lib/types.ts`, asi que
migrar a Supabase es cambiar el origen, no las pantallas.
