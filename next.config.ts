import type { NextConfig } from "next";

/**
 * GitHub Pages sirve el repo bajo `/puntero/`, no en la raíz del dominio, así
 * que la app tiene que pedir sus assets y navegar con ese prefijo. En local
 * queda vacío y todo funciona en `localhost:3000`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // GitHub Pages solo sirve archivos estáticos: no hay Node que atienda
  // requests. `next build` deja el sitio completo en `out/`.
  output: "export",

  // Pages resuelve `/finanzas/` desde `finanzas/index.html`, nunca desde
  // `finanzas.html`. Sin esto los links internos dan 404.
  trailingSlash: true,

  basePath,
  assetPrefix: basePath,

  // No usamos `next/image` hoy, pero el export estático no soporta el loader
  // por defecto. Dejarlo en `unoptimized` evita que aparezca si alguien lo usa.
  images: { unoptimized: true },
};

export default nextConfig;
