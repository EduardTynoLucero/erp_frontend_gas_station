import type { NextConfig } from 'next';

/**
 * El navegador habla SOLO con Next.js (mismo origen): /api/v1/* se reenvía al backend desde src/proxy.ts, que lee
 * API_URL en cada petición. No se usan rewrites aquí porque se fijan al compilar y la imagen de Docker quedaría atada
 * a un backend. Así las cookies httpOnly de sesión (erp_acceso / erp_refresco) quedan en el mismo origen y no hace
 * falta CORS.
 */
const config: NextConfig = {
  // Producción en Docker: .next/standalone trae su propio server.js y solo los node_modules que usa (ver Dockerfile)
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    /**
     * Los reportes de BISS se suben por aquí hacia el backend (POST /api/v1/ingesta/subidas) y pesan más de 10 MB
     * (una Consulta de Tickets de varias semanas llega a 18 MB). Como la aplicación tiene proxy.ts, Next.js guarda en
     * memoria el cuerpo de cada petición y, por defecto, solo los primeros 10 MB: al backend le llegaba el archivo
     * cortado, se quedaba esperando el resto y la subida terminaba en un error 500 («socket hang up»).
     * El tope de un reporte es 50 MB (MAX_MB en zona-carga.tsx y MAX_BYTES en el backend): este límite va por encima
     * para que cualquier reporte válido pase entero. Un archivo de más de 50 MB ni se sube: la pantalla lo rechaza antes.
     * Lo comprueba la prueba de punta a punta (etl/e2e/flujo-completo.ts) con una subida de 12 MB.
     */
    proxyClientMaxBodySize: '64mb',
  },
};

export default config;
