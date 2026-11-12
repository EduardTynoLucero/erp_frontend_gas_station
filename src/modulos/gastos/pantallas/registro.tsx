'use client';

/**
 * Registro de gastos (/gastos): todos los gastos visibles, como un listado de la plantilla: barra de filtros que se
 * oculta, «Mostrar N registros», buscador, tabla fina y páginas. «Nuevo gasto» abre el modal; exporta a CSV.
 */
import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import type { ConsultaGastos, EstadoGasto, GastoDetalle, OrigenGasto } from '@/api/tipos';
import { useErp, useTienePantalla, useTienePermiso } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { claseFiltro } from '@/componentes/ui/campos';
import { ESTADOS, InsigniaEstado } from '@/componentes/ui/insignia';
import { BarraFiltros, CampoFiltro, CasillaFiltro, useFiltrosAbiertos } from '@/componentes/ui/listado';
import { BuscadorTabla, Cabecera, ContenedorTabla, Cuerpo, filaClic, MostrarRegistros, Paginacion, PieTabla, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, periodoLabel, q } from '@/lib/formato';
import { useRetardo } from '@/lib/ganchos';
import { cn } from '@/lib/utilidades';
import { ModalGasto } from '../componentes/modal-gasto';
import { exportarCsv } from '../csv';
import { useCatalogos, useListaGastos } from '../datos';
import { CeldaComprobante, CeldaMonto, nombreProveedor, ORIGEN_CORTO, rangoDePeriodo, ultimosPeriodos } from '../etiquetas';

const ORDEN_ESTADOS: EstadoGasto[] = ['borrador', 'pendiente', 'aprobado', 'pagado', 'rechazado'];

export function PantallaRegistro({ inicial }: { inicial: { categoria?: string; origen?: string; periodo?: string; nuevo?: boolean } }) {
  const router = useRouter();
  const { estacionId } = useErp();
  const tienePermiso = useTienePermiso('registrar');
  const tienePantalla = useTienePantalla('gastos', 'mis-solicitudes');
  const puedeRegistrar = tienePermiso && tienePantalla;
  const catalogos = useCatalogos();

  const [buscar, setBuscar] = useState('');
  const busqueda = useRetardo(buscar.trim(), 350);
  const [estado, setEstado] = useState<EstadoGasto | ''>('');
  const [categoria, setCategoria] = useState(inicial.categoria ?? '');
  const [origen, setOrigen] = useState<OrigenGasto | ''>((inicial.origen as OrigenGasto | undefined) ?? '');
  const [periodo, setPeriodo] = useState(inicial.periodo ?? '');
  const [sinComprobante, setSinComprobante] = useState(false);
  const [porPagina, setPorPagina] = useState(50);
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [nuevo, setNuevo] = useState(Boolean(inicial.nuevo));
  const [filtrosAbiertos, alternarFiltros] = useFiltrosAbiertos('gastos');

  const filtrosActivos = [estado, categoria, origen, periodo, sinComprobante].filter(Boolean).length;
  const filtros = useMemo<Omit<ConsultaGastos, 'pagina' | 'porPagina'>>(
    () => ({
      orden: '-fecha',
      ...(estacionId ? { estacionId } : {}),
      ...(busqueda ? { buscar: busqueda } : {}),
      ...(estado ? { estado } : {}),
      ...(categoria ? { categoriaId: categoria } : {}),
      ...(origen ? { origen } : {}),
      ...(periodo ? rangoDePeriodo(periodo) : {}),
      ...(sinComprobante ? { sinComprobante: 'true' as const } : {}),
    }),
    [estacionId, busqueda, estado, categoria, origen, periodo, sinComprobante],
  );
  // Al cambiar un filtro o el tamaño de página se vuelve a la primera
  useEffect(() => setPagina(1), [filtros, porPagina]);

  const lista = useListaGastos({ ...filtros, pagina, porPagina });
  const filas = lista.data?.data ?? [];
  const resumen = lista.data?.resumen;
  const total = resumen?.cantidad ?? 0;
  const paginas = lista.data?.paginacion.totalPaginas ?? 1;
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const periodos = catalogos.data ? ultimosPeriodos(catalogos.data.parametros.hoy) : [];

  function limpiar() {
    setEstado('');
    setCategoria('');
    setOrigen('');
    setPeriodo('');
    setSinComprobante(false);
  }

  async function exportar() {
    setExportando(true);
    try {
      const n = await exportarCsv(filtros);
      toast.success(`Se exportaron ${n} gastos a gastos.csv.`);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setExportando(false);
    }
  }

  function cerrarNuevo() {
    setNuevo(false);
    // Si se llegó por /gastos?nuevo=1, la dirección vuelve a ser la del listado
    if (inicial.nuevo) router.replace('/gastos');
  }

  function guardado(g: GastoDetalle, mensaje: string) {
    cerrarNuevo();
    toast.success(mensaje, { action: { label: `Ver ${g.folio}`, onClick: () => router.push(`/gastos/${g.id}`) } });
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Registro de gastos"
        descripcion="Todos los gastos de las estaciones que puede ver, con su comprobante, estado de autorización y pago."
        acciones={
          <>
            <Boton variante="secondary" icono={<Download aria-hidden />} onClick={exportar} cargando={exportando}>
              Exportar CSV
            </Boton>
            {puedeRegistrar && (
              <Boton icono={<Plus aria-hidden />} onClick={() => setNuevo(true)}>
                Nuevo gasto
              </Boton>
            )}
          </>
        }
      />

      <Tarjeta cuerpoClassName="p-0">
        <BarraFiltros
          abierto={filtrosAbiertos}
          alAlternar={alternarFiltros}
          activos={filtrosActivos}
          alLimpiar={limpiar}
          controles={
            <>
              <span className="text-[11px] text-tenue">
                {resumen ? (
                  <>
                    {resumen.cantidad.toLocaleString('en-US')} gastos · <b className="font-bold tabular-nums text-tinta">{q(resumen.montoFuncional)}</b>
                  </>
                ) : (
                  'Cargando…'
                )}
              </span>
              <MostrarRegistros valor={porPagina} alCambiar={setPorPagina} />
              <BuscadorTabla valor={buscar} alCambiar={setBuscar} etiqueta="Buscar folio, descripción, proveedor…" className="ml-0 sm:w-[250px]" />
            </>
          }
        >
          <CampoFiltro etiqueta="Estado">
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoGasto | '')} className={claseFiltro()}>
              <option value="">Todos</option>
              {ORDEN_ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADOS[e].texto}
                </option>
              ))}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Categoría">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={claseFiltro()}>
              <option value="">Todas</option>
              {catalogos.data?.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Origen">
            <select value={origen} onChange={(e) => setOrigen(e.target.value as OrigenGasto | '')} className={claseFiltro()}>
              <option value="">Todos</option>
              {(Object.keys(ORIGEN_CORTO) as OrigenGasto[]).map((o) => (
                <option key={o} value={o}>
                  {ORIGEN_CORTO[o]}
                </option>
              ))}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Mes">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={claseFiltro()}>
              <option value="">Todos</option>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {periodoLabel(p)}
                </option>
              ))}
            </select>
          </CampoFiltro>
          <CasillaFiltro etiqueta="Solo sin comprobante" marcado={sinComprobante} alCambiar={setSinComprobante} />
        </BarraFiltros>

        {lista.isError ? (
          <div className="p-[10px]">
            <Aviso tono="red">{mensajeDeError(lista.error)}</Aviso>
          </div>
        ) : lista.isPending ? (
          <div className="p-[10px]">
            <EsqueletoTabla />
          </div>
        ) : filas.length === 0 ? (
          <div className="p-[10px]">
            <Vacio>No hay gastos con esos filtros.</Vacio>
          </div>
        ) : (
          <>
            <ContenedorTabla anchoMinimo={980} className={cn('border-0', lista.isPlaceholderData && 'opacity-60')}>
              <Cabecera>
                <th className={th}>Folio</th>
                <th className={th}>Fecha</th>
                <th className={th}>Estación</th>
                <th className={th}>Categoría</th>
                <th className={th}>Proveedor</th>
                <th className={th}>Descripción</th>
                <th className={th}>Comprobante</th>
                <th className={th}>Estado</th>
                <th className={thR}>Monto</th>
              </Cabecera>
              <Cuerpo>
                {filas.map((g) => (
                  <tr key={g.id} className={filaClic} onClick={() => router.push(`/gastos/${g.id}`)}>
                    <td className={cn(td, 'whitespace-nowrap font-semibold text-primario-tinta')}>
                      <Link href={`/gastos/${g.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {g.folio}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{fecha(g.fecha)}</td>
                    <td className={td}>{g.estacion.codigo}</td>
                    <td className={td}>
                      <span className="whitespace-nowrap">{g.categoria.nombre}</span>
                      {g.subcategoria && <span className="block text-[10px] text-tenue">{g.subcategoria}</span>}
                    </td>
                    <td className={td}>
                      <span className="block max-w-[180px] truncate">{nombreProveedor(g.proveedor)}</span>
                    </td>
                    <td className={td}>
                      <span className="block max-w-[280px] truncate">{g.descripcion}</span>
                      {g.origen !== 'manual' && <span className="block text-[10px] text-tenue">{ORIGEN_CORTO[g.origen]}</span>}
                    </td>
                    <td className={td}>
                      <CeldaComprobante g={g} />
                    </td>
                    <td className={td}>
                      <InsigniaEstado estado={g.estado} />
                    </td>
                    <td className={tdR}>
                      <CeldaMonto g={g} />
                    </td>
                  </tr>
                ))}
              </Cuerpo>
            </ContenedorTabla>
            <PieTabla desde={desde} hasta={desde + filas.length - 1} total={total} className="mt-0 border-t border-borde px-[8px] py-[3px]">
              <Paginacion pagina={pagina} paginas={paginas} alCambiar={setPagina} ocupado={lista.isFetching && lista.isPlaceholderData} />
            </PieTabla>
          </>
        )}
      </Tarjeta>

      <ModalGasto abierto={nuevo} alCerrar={cerrarNuevo} alGuardado={guardado} />
    </>
  );
}
