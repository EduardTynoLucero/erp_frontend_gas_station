/**
 * Dónde corre el frontend. En la PC de desarrollo los avisos dicen cómo encender cada servicio (`npm run dev`); en
 * producción (Dokploy) los servicios son aplicaciones desplegadas y el aviso solo dice qué pasa y a quién avisar.
 * Next.js sustituye process.env.NODE_ENV al compilar, también en el código del navegador.
 */
export const ES_DESARROLLO = process.env.NODE_ENV !== 'production';

/** Sin respuesta del backend */
export const MENSAJE_SIN_CONEXION = ES_DESARROLLO
  ? 'No hay conexión con el servidor. Revise que el backend esté encendido (npm run dev en backend/).'
  : 'No hay conexión con el servidor. Intente de nuevo en unos minutos; si continúa, avise a soporte.';

/** Cómo se enciende el servicio ETL cuando la cola de reportes no lo encuentra escuchando */
export const COMO_ENCENDER_ETL = ES_DESARROLLO
  ? 'Para encenderlo, abra una terminal en la carpeta etl y déjela corriendo con: npm run dev'
  : 'Avise a soporte para que revise la aplicación del ETL en el servidor.';
