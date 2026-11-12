/**
 * Números del menú que salen de los datos simulados, como en el menú del prototipo: alertas que no son de severidad
 * baja y hallazgos sin cerrar, para el usuario de la sesión y la estación filtrada. Se carga aparte (import dinámico)
 * desde la barra lateral. Si este navegador todavía no tiene datos simulados, no hay números (no se cargan para esto).
 */
import type { Perfil } from '@/api/tipos';
import { vistaPara } from './acciones';
import * as local from './local';
import { calcularAlertas } from './selectors';

export { cargarGuardado, suscribir } from './local';

export function contadoresSimulados(perfil: Perfil, codigoEstacion: string | null): Record<string, number> {
  const d = local.instantanea();
  if (!d) return {};
  const usuario = local.usuarioSincronizado(d.db, perfil);
  const vista = vistaPara(d.db, usuario);
  const filtro = (codigoEstacion && vista.estaciones.find((e) => e.codigo === codigoEstacion)?.id) || 'ALL';
  return {
    alertas: calcularAlertas(vista, usuario, filtro).filter((a) => a.severidad !== 'baja').length,
    hallazgos: vista.hallazgos.filter((h) => h.estado !== 'cerrada').length,
  };
}
