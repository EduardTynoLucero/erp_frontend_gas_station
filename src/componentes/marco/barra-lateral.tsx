'use client';

import {
  Bell,
  Building2,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  Coins,
  FileChartColumn,
  FileSignature,
  Fuel,
  Gauge,
  History,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Plug,
  Receipt,
  Repeat,
  ScrollText,
  SearchCheck,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Split,
  Store,
  Tags,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, pedir } from '@/api/cliente';
import type { Pantalla } from '@/api/tipos';
import { fecha } from '@/lib/formato';
import { NOMBRE_APP, VERSION } from '@/lib/marca';
import { RUTA_DE_PANTALLA } from '@/lib/rutas';
import { cn } from '@/lib/utilidades';
import { useCatalogos, useListaGastos } from '@/modulos/gastos/datos';
import { useErp } from './contexto';
import { usePreferencia } from './preferencias';

const ICONOS: Record<string, LucideIcon> = {
  'mis-solicitudes': Inbox,
  tablero: LayoutDashboard,
  alertas: Bell,
  hallazgos: SearchCheck,
  'dashboard-ventas': ChartColumn,
  inventario: Gauge,
  'tomas-fisicas': ClipboardList,
  cargas: Upload,
  'historial-cargas': History,
  gastos: Receipt,
  autorizaciones: ShieldCheck,
  presupuestos: PiggyBank,
  proveedores: Truck,
  catalogos: Tags,
  estaciones: Building2,
  usuarios: Users,
  reportes: FileChartColumn,
  'cuentas-por-pagar': Wallet,
  'caja-chica': Coins,
  compras: ShoppingCart,
  contratos: FileSignature,
  recurrentes: Repeat,
  prorrateo: Split,
  franquicia: Store,
  indicadores: TrendingUp,
  auditoria: ScrollText,
  integraciones: Plug,
  configuracion: Settings,
};

type ClaveModulo = 'Dashboards' | 'Gastos';

/** Los dos módulos del ERP. El grupo de cada pantalla lo da el backend (iam.pantalla.grupo) */
const MODULOS: { clave: ClaveModulo; icono: LucideIcon; descripcion: string }[] = [
  { clave: 'Dashboards', icono: ChartColumn, descripcion: 'Reportería, analítica e indicadores' },
  { clave: 'Gastos', icono: Receipt, descripcion: 'Operación, control y administración' },
];

/** Si el backend todavía tuviera los grupos viejos (fases), la pantalla va igual a su módulo */
const DE_DASHBOARDS = new Set(['tablero', 'dashboard-ventas', 'indicadores', 'reportes', 'integraciones', 'cargas', 'historial-cargas', 'inventario', 'tomas-fisicas']);
const moduloDe = (p: Pantalla): ClaveModulo =>
  p.grupo === 'Dashboards' || p.grupo === 'Gastos' ? p.grupo : DE_DASHBOARDS.has(p.codigo) ? 'Dashboards' : 'Gastos';

interface Opcion {
  codigo: string;
  nombre: string;
  destino: string;
}

/**
 * Opciones del menú por módulo, en el orden del backend. Varias pantallas pueden vivir en la misma página
 * (cargar reportes e historial de cargas están en Integraciones): la página sale una vez.
 */
function opcionesPorModulo(pantallas: Pantalla[]): Record<ClaveModulo, Opcion[]> {
  const salida: Record<ClaveModulo, Opcion[]> = { Dashboards: [], Gastos: [] };
  const vistas = new Set<string>();
  for (const p of pantallas) {
    const destino = RUTA_DE_PANTALLA[p.codigo];
    if (!destino || vistas.has(destino)) continue;
    vistas.add(destino);
    const nombre = destino === '/integraciones' ? 'Integraciones' : p.nombre;
    salida[moduloDe(p)].push({ codigo: destino === '/integraciones' ? 'integraciones' : p.codigo, nombre, destino });
  }
  return salida;
}

/**
 * Qué módulos del menú están abiertos. Es una preferencia del usuario guardada en la base (clave «menu»: los módulos
 * que dejó cerrados, separados por coma); no se guarda nada en el navegador.
 */
function useModulosAbiertos(activo: ClaveModulo | null) {
  const [cerrados, fijarCerrados] = usePreferencia('menu', '');
  const lista = cerrados.split(',').filter(Boolean);
  // El módulo de la página abierta se ve aunque estuviera cerrado; se puede volver a cerrar hasta cambiar de página
  const [forzado, setForzado] = useState<ClaveModulo | null>(activo);
  useEffect(() => setForzado(activo), [activo]);
  const abiertos: Record<ClaveModulo, boolean> = {
    Dashboards: forzado === 'Dashboards' || !lista.includes('Dashboards'),
    Gastos: forzado === 'Gastos' || !lista.includes('Gastos'),
  };
  const alternar = (m: ClaveModulo) => {
    const cerrar = abiertos[m];
    if (cerrar && forzado === m) setForzado(null);
    const nuevos = MODULOS.map((x) => x.clave).filter((clave) => (clave === m ? cerrar : lista.includes(clave)));
    fijarCerrados(nuevos.join(','));
  };
  return { abiertos, alternar };
}

/**
 * Pendientes del usuario, como etiquetas del menú: gastos que puede autorizar ahora, sus borradores o rechazados, y las
 * alertas y los hallazgos abiertos (GET /api/v1/alertas/contadores, con el filtro de estación del encabezado). Todo
 * sale de la base; las pantallas que cambian esos números invalidan la clave ['contadores'].
 */
function useContadores(): Record<string, number> {
  const { perfil, estacionId } = useErp();
  const ve = (c: string) => perfil.acceso.pantallas.some((p) => p.codigo === c);
  const autoriza = ve('autorizaciones') && perfil.acceso.permisos.includes('aprobar');
  const pendientes = useListaGastos({ estado: 'pendiente', porPagina: 100 }, { habilitado: autoriza });
  const mias = useListaGastos({ soloMios: 'true', estado: 'borrador,rechazado', porPagina: 1 }, { habilitado: ve('mis-solicitudes') });
  const control = useQuery({
    queryKey: ['contadores', estacionId ?? null],
    queryFn: async () => (await pedir(api.GET('/api/v1/alertas/contadores', { params: { query: estacionId ? { estacionId } : {} } }))).data,
    enabled: ve('alertas') || ve('hallazgos'),
    refetchInterval: 60_000,
  });
  return {
    alertas: control.data?.alertas ?? 0,
    hallazgos: control.data?.hallazgos ?? 0,
    autorizaciones: autoriza ? (pendientes.data?.data.filter((g) => g.acciones.aprobar.ok).length ?? 0) : 0,
    'mis-solicitudes': mias.data?.resumen.cantidad ?? 0,
  };
}

/** El detalle de un gasto (/gastos/:id) marca «Registro de gastos» en el menú */
function activa(o: Opcion, ruta: string): boolean {
  if (o.destino !== '/gastos') return ruta === o.destino;
  return ruta === '/gastos' || ruta.startsWith('/gastos/');
}

export function BarraLateral() {
  const { perfil } = useErp();
  const ruta = usePathname();
  const contadores = useContadores();
  const veGastos = perfil.acceso.pantallas.some((p) => ['gastos', 'mis-solicitudes', 'autorizaciones', 'cuentas-por-pagar'].includes(p.codigo));
  const catalogos = useCatalogos(veGastos);
  const hoy = catalogos.data?.parametros.hoy;
  const opciones = useMemo(() => opcionesPorModulo(perfil.acceso.pantallas), [perfil]);
  const moduloActivo = MODULOS.find((m) => opciones[m.clave].some((o) => activa(o, ruta)))?.clave ?? null;
  const { abiertos, alternar } = useModulosAbiertos(moduloActivo);

  // Contador de pendientes (por autorizar, borradores, alertas): etiqueta ámbar de la plantilla
  const CONTADOR =
    'shrink-0 rounded-full border border-[#fde68a] bg-[#fef3c7] px-[6px] text-[10px] font-bold leading-[16px] tabular-nums text-[#b45309] ' +
    'dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300';

  return (
    <div className="flex h-full flex-col bg-superficie">
      <Link href="/" className="flex min-h-[46px] items-center gap-[8px] border-b border-borde px-[9px] py-[7px]">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[2px] bg-primario text-white">
          <Fuel className="size-[16px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-[1.2] text-tinta">{NOMBRE_APP}</span>
          <span className="block truncate text-[10px] leading-[1.3] text-tenue">
            {[perfil.empresa.franquicia, perfil.empresa.nombre].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>

      {/* Dos módulos: Dashboards y Gastos. Solo las pantallas con página en este frontend.
          Jerarquía: cada módulo es un bloque. Su encabezado es una tarjeta (fondo de barra, borde y franja roja a la
          izquierda, título grande en negrita y la flecha del acordeón en su recuadro); sus pantallas van debajo con
          sangría, letra un poco más chica y una línea guía que las une al módulo. Entre un bloque y el otro hay un
          espacio con un divisor. Los colores son los de la plantilla, que cambian solos con el tema claro u oscuro */}
      <nav className="flex-1 overflow-y-auto px-[6px] py-[8px]" aria-label="Menú principal">
        {MODULOS.filter((m) => opciones[m.clave].length > 0).map((m, n) => {
          const lista = opciones[m.clave];
          const abierto = abiertos[m.clave];
          const pendientes = lista.reduce((t, o) => t + (contadores[o.codigo] ?? 0), 0);
          const idLista = `menu-${m.clave.toLowerCase()}`;
          const conActiva = m.clave === moduloActivo;
          return (
            <section key={m.clave} className={cn(n > 0 && 'mt-[10px] border-t border-borde pt-[10px]')}>
              <button
                type="button"
                onClick={() => alternar(m.clave)}
                aria-expanded={abierto}
                aria-controls={idLista}
                title={m.descripcion}
                className={cn(
                  'group flex min-h-[38px] w-full cursor-pointer items-center gap-[8px] rounded-[2px] border border-l-[3px] border-borde border-l-primario py-[6px] pl-[8px] pr-[6px] ' +
                    'text-left transition-colors focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primario',
                  conActiva ? 'bg-primario-suave hover:bg-primario-suave-2' : 'bg-barra hover:bg-realce',
                )}
              >
                <m.icono aria-hidden className={cn('size-[16px] shrink-0', conActiva ? 'text-primario' : 'text-tinta-suave')} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[13px] font-extrabold uppercase leading-[1.2] tracking-[0.04em]',
                    conActiva ? 'text-primario-tinta' : 'text-tinta',
                  )}
                >
                  {m.clave}
                </span>
                {!abierto && pendientes > 0 && <span className={CONTADOR}>{pendientes}</span>}
                {/* Flecha del acordeón: en su recuadro, a la derecha; apunta abajo con el módulo abierto */}
                <span className="grid size-[22px] shrink-0 place-items-center rounded-[2px] border border-borde-campo bg-superficie text-tinta transition-colors group-hover:border-primario group-hover:text-primario-tinta">
                  <ChevronDown aria-hidden className={cn('size-[14px] transition-transform duration-200', abierto ? 'rotate-0' : '-rotate-90')} />
                </span>
              </button>
              <div
                id={idLista}
                className={cn('grid transition-[grid-template-rows] duration-200 ease-out', abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
              >
                {/* La línea guía es el borde izquierdo de la lista, alineado con el ícono del módulo */}
                <ul className="ml-[18px] min-h-0 overflow-hidden border-l border-borde pl-[7px]" inert={!abierto}>
                  {lista.map((o, i) => {
                    const Icono = ICONOS[o.codigo] ?? LayoutDashboard;
                    const contador = contadores[o.codigo] ?? 0;
                    const esActiva = activa(o, ruta);
                    return (
                      <li key={o.destino} className={cn('py-px', i === 0 && 'pt-[5px]', i === lista.length - 1 && 'pb-[3px]')}>
                        <Link
                          href={o.destino}
                          aria-current={esActiva ? 'page' : undefined}
                          className={cn(
                            // before: el ramal que une la opción con la línea guía
                            'group relative flex min-h-[32px] items-center gap-[6px] rounded-[2px] py-[5px] pl-[6px] pr-[4px] text-[11.5px] font-medium leading-[1.25] transition-colors ' +
                              "focus:outline-none before:absolute before:top-1/2 before:left-[-7px] before:h-px before:w-[5px] before:content-['']",
                            esActiva
                              ? 'bg-primario font-semibold text-white before:bg-primario'
                              : 'text-[#334155] before:bg-borde hover:bg-primario-suave hover:text-primario-tinta focus-visible:bg-primario-suave dark:text-slate-200',
                          )}
                        >
                          <Icono aria-hidden className={cn('size-[14px] shrink-0', esActiva ? 'text-white' : 'text-[#64748b] group-hover:text-primario-tinta dark:text-slate-400')} />
                          <span className="min-w-0 flex-1 text-balance break-words">{o.nombre}</span>
                          {contador > 0 && <span className={cn(CONTADOR, esActiva && 'border-white bg-white text-brand-700 dark:border-white dark:bg-white dark:text-brand-700')}>{contador}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </nav>

      <div className="border-t border-borde px-[9px] py-[6px] text-[10px] leading-[1.4] text-tenue">
        {hoy ? `Fecha del sistema: ${fecha(hoy)}.` : ''}
        <span className="mt-[2px] block font-semibold text-tinta-suave">Versión {VERSION}</span>
      </div>
    </div>
  );
}
