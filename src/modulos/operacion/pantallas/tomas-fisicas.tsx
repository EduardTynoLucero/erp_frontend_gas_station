'use client';

/**
 * Tomas físicas: la pestaña del panel del ETL sobre la API del ERP. Registrar una medición por combustible (misma fecha
 * y hora), corregirla, anularla, restaurarla y ver su bitácora. Nada se borra: una toma equivocada se anula. Cada toma
 * trae lo que debía haber según la toma anterior, las compras y las ventas, y la diferencia (faltante o sobrante).
 * Quién registra o cambia es el usuario con sesión. Sin el permiso tomas_fisicas la pantalla es de solo lectura.
 */
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardPlus, History, Pencil, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { Boton } from '@/componentes/ui/boton';
import { Campo, claseEntrada, claseFiltro, Entrada } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { BarraTabla, BuscadorTabla, CUERPO_TABLA, MostrarRegistros, Paginacion, PieTabla, td as tdFino, th as thFino } from '@/componentes/ui/tabla';
import { EncabezadoPagina } from '@/componentes/ui/tarjeta';
import { useTienePantalla } from '@/componentes/marco/contexto';
import { cn } from '@/lib/utilidades';
import { Estado } from '@/modulos/dashboards/componentes/iconos';
import { BOTON_CHICO, Cargando, Segmentado, TARJETA, TarjetaVacia, Veredicto } from '@/modulos/dashboards/componentes/piezas';
import { Punto } from '@/modulos/dashboards/componentes/tablas';
import { fecha, fechaHora, fmt, num, plural } from '@/modulos/dashboards/formato';
import { colorProducto, ordenarProductos } from '@/modulos/dashboards/productos';
import { BarraOperacion, CAMPO, type FiltrosFecha } from '../componentes/filtros';
import {
  hoy,
  type OpcionesOperacion,
  preferencia,
  rangoRapido,
  type TomaFisica,
  useAnularToma,
  useBitacoraToma,
  useEditarToma,
  useOpcionesOperacion,
  useRegistrarToma,
  useTomas,
} from '../datos';

type EstadoTomas = 'vigentes' | 'anuladas' | 'todas';
const ESTADOS: { valor: EstadoTomas; texto: string }[] = [
  { valor: 'vigentes', texto: 'Vigentes' },
  { valor: 'anuladas', texto: 'Anuladas' },
  { valor: 'todas', texto: 'Todas' },
];

/** Galones como texto decimal: hasta 3 decimales, sin separadores de miles */
const GALONES = /^\d{1,7}(\.\d{1,3})?$/;
const conSigno = (v: number) => (v > 0 ? `+${fmt.galones(v)}` : fmt.galones(v));
const instante = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : '–');

function Diferencia({ t }: { t: TomaFisica }) {
  if (t.anulada || t.diferencia === null) return <span className="text-slate-400">{t.anulada ? '' : 'Primera toma'}</span>;
  const v = num(t.diferencia);
  if (Math.abs(v) < 0.0005) return <Estado tipo="bueno">Cuadra</Estado>;
  return <Estado tipo={v < 0 ? 'aviso' : 'info'}>{`${v < 0 ? 'Faltante' : 'Sobrante'} ${conSigno(v)}`}</Estado>;
}

type Orden = { clave: 'fechaHora' | 'producto' | 'galones' | 'diferencia'; asc: boolean };

export function PantallaTomasFisicas() {
  const cliente = useQueryClient();
  const veInventario = useTienePantalla('inventario');
  const opciones = useOpcionesOperacion();
  const [filtros, setFiltros] = useState<(FiltrosFecha & { producto: string; estado: EstadoTomas }) | null>(null);
  const [buscar, setBuscar] = useState('');
  const [orden, setOrden] = useState<Orden>({ clave: 'fechaHora', asc: false });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [registrando, setRegistrando] = useState(false);
  const [editando, setEditando] = useState<TomaFisica | null>(null);
  const [anulando, setAnulando] = useState<TomaFisica | null>(null);
  const [bitacora, setBitacora] = useState<TomaFisica | null>(null);

  const o = opciones.data;
  if (o && o.estaciones.length && (!filtros || !o.estaciones.some((e) => e.codigo === filtros.estacion))) {
    const recordada = preferencia.leer('estacion');
    const estacion = o.estaciones.some((e) => e.codigo === recordada) ? recordada! : o.estaciones[0]!.codigo;
    setFiltros({ estacion, desde: '', hasta: '', rapido: '', producto: '', estado: 'vigentes' });
  }
  const consulta = filtros
    ? {
        estacion: filtros.estacion,
        estado: filtros.estado,
        ...(filtros.desde ? { desde: filtros.desde } : {}),
        ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
        ...(filtros.producto ? { producto: filtros.producto } : {}),
      }
    : null;
  const tomas = useTomas(consulta);

  const filas = useMemo(() => {
    const texto = buscar.trim().toLowerCase();
    const lista = (tomas.data ?? []).filter(
      (t) => !texto || [t.producto, t.observaciones, t.usuario, t.modificadaPor, t.anuladaPor].some((x) => x?.toLowerCase().includes(texto)),
    );
    const valor = (t: TomaFisica) =>
      orden.clave === 'galones' ? num(t.galones) : orden.clave === 'diferencia' ? (t.diferencia === null ? -Infinity : num(t.diferencia)) : t[orden.clave];
    return [...lista].sort((a, b) => {
      const x = valor(a);
      const y = valor(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1);
    });
  }, [tomas.data, buscar, orden]);

  const encabezado = (
    <EncabezadoPagina
      titulo="Tomas físicas"
      descripcion="Mediciones de los tanques (varilla). Con ellas se calcula la existencia de combustible; una toma equivocada se corrige o se anula, nunca se borra."
      acciones={
        o?.puedeRegistrarTomas && o.estaciones.length ? (
          <Boton icono={<ClipboardPlus className="size-4" aria-hidden />} onClick={() => setRegistrando(true)}>
            Registrar toma física
          </Boton>
        ) : undefined
      }
    />
  );
  if (opciones.isPending)
    return (
      <>
        {encabezado}
        <Cargando>Leyendo las tomas físicas…</Cargando>
      </>
    );
  if (opciones.isError)
    return (
      <>
        {encabezado}
        <Veredicto tipo="critico" titulo="No se pudieron leer las tomas físicas">
          <p>{mensajeDeError(opciones.error)}</p>
        </Veredicto>
      </>
    );
  if (!o!.estaciones.length || !filtros)
    return (
      <>
        {encabezado}
        <TarjetaVacia titulo="Todavía no hay estaciones en el modelo">
          La estación aparece cuando el servicio ETL publica la primera carga de tickets. Sube la Consulta de Tickets de BISS en Integraciones y
          después registra aquí la primera toma física.
        </TarjetaVacia>
      </>
    );

  const cambiar = (f: typeof filtros) => {
    preferencia.guardar('estacion', f!.estacion);
    setFiltros(f);
    setPagina(1);
  };
  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);
  const ordenar = (clave: Orden['clave']) => setOrden((x) => ({ clave, asc: x.clave === clave ? !x.asc : clave !== 'fechaHora' }));
  const Th = ({ clave, children, der }: { clave?: Orden['clave']; children: string; der?: boolean }) => (
    <th
      scope="col"
      aria-sort={clave && orden.clave === clave ? (orden.asc ? 'ascending' : 'descending') : undefined}
      className={cn(
        thFino,
        der ? 'text-right' : 'text-left',
      )}
    >
      {clave ? (
        <button type="button" onClick={() => ordenar(clave)} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
          {children}
          <span aria-hidden className="text-[10px]">
            {orden.clave === clave ? (orden.asc ? '▲' : '▼') : '↕'}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
  const td = tdFino;

  return (
    <>
      {encabezado}
      <div className="space-y-4">
        <BarraOperacion
          etiqueta="Filtros de las tomas físicas"
          estaciones={o!.estaciones}
          filtros={filtros}
          rango={o!.rango}
          fechasOpcionales
          alCambiar={(f) => cambiar({ ...filtros, ...f })}
          alRapido={(tipo) => cambiar({ ...filtros, ...rangoRapido(o!.rango.hasta ?? hoy(), tipo), rapido: tipo })}
          alActualizar={() => void cliente.invalidateQueries({ queryKey: ['operacion'] })}
          actualizando={tomas.isFetching}
        >
          <label className={CAMPO}>
            Producto
            <select value={filtros.producto} onChange={(e) => cambiar({ ...filtros, producto: e.target.value })} className={claseFiltro('min-w-[110px]')}>
              <option value="">Todos</option>
              {ordenarProductos(o!.productos).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className={CAMPO}>
            Estado
            <Segmentado etiqueta="Estado" opciones={ESTADOS} valor={filtros.estado} alCambiar={(estado) => cambiar({ ...filtros, estado })} />
          </div>
        </BarraOperacion>

        {!o!.puedeRegistrarTomas && (
          <p className="text-[11px] text-tenue">
            Solo lectura: registrar, corregir y anular tomas físicas lo hace quien tiene el permiso de tomas físicas (gerente de estación).
          </p>
        )}

        <section className={cn(TARJETA, 'p-[10px]')}>
          <div className="mb-[6px]">
            <div>
              <h2 className="text-[12px] font-bold leading-[1.25] text-tinta">Tomas físicas · {filtros.estacion}</h2>
              <p className="mt-px text-[11px] leading-[1.35] text-tenue">
                {tomas.data
                  ? `${plural(filas.length, 'toma', 'tomas')}${filtros.desde || filtros.hasta ? ` del ${fecha(filtros.desde || null, true)} al ${fecha(filtros.hasta || null, true)}` : ''}. «Debía haber» es la toma anterior más las compras y menos las ventas de en medio.`
                  : 'Consultando…'}
                {veInventario && (
                  <>
                    {' '}
                    La existencia de cada día está en{' '}
                    <Link href="/inventario" className="font-semibold text-primario-tinta underline-offset-2 hover:underline">
                      Inventario y tanques
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Barra del datatable de la plantilla: «Mostrar N registros» a la izquierda y el buscador a la derecha */}
          <BarraTabla>
            <MostrarRegistros
              valor={porPagina}
              alCambiar={(n) => {
                setPorPagina(n);
                setPagina(1);
              }}
            />
            <BuscadorTabla
              valor={buscar}
              alCambiar={(v) => {
                setBuscar(v);
                setPagina(1);
              }}
              etiqueta="Buscar producto, observación, quién…"
              className="sm:w-[260px]"
            />
          </BarraTabla>

          {tomas.isError ? (
            <Veredicto tipo="critico" titulo="No se pudieron leer las tomas físicas">
              <p>{mensajeDeError(tomas.error)}</p>
            </Veredicto>
          ) : !tomas.data ? (
            <Cargando>Leyendo las tomas físicas…</Cargando>
          ) : filas.length === 0 ? (
            <p className="border border-borde px-[14px] py-[18px] text-center text-[12px] text-tenue">
              {tomas.data.length
                ? 'Ninguna toma coincide con la búsqueda.'
                : filtros.estado === 'anuladas'
                  ? 'No hay tomas anuladas con estos filtros.'
                  : 'Todavía no hay tomas físicas con estos filtros.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto border border-borde bg-superficie">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr>
                      <Th clave="fechaHora">Fecha y hora</Th>
                      <Th clave="producto">Producto</Th>
                      <Th clave="galones" der>
                        Medido
                      </Th>
                      <Th der>Debía haber</Th>
                      <Th clave="diferencia">Diferencia</Th>
                      <Th>Observaciones</Th>
                      <Th>Registró</Th>
                      <Th>Estado</Th>
                      <Th>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody className={CUERPO_TABLA}>
                    {visibles.map((t) => (
                      <tr key={t.tomaId} className={cn(t.anulada && '[&>td]:text-slate-400')}>
                        <td className={cn(td, 'whitespace-nowrap')}>{fechaHora(t.fechaHora)}</td>
                        <td className={cn(td, 'whitespace-nowrap')}>
                          <Punto color={colorProducto(t.producto)} />
                          {t.producto}
                        </td>
                        <td className={cn(td, 'text-right whitespace-nowrap tabular-nums', t.anulada && 'line-through')}>{fmt.galones(t.galones)}</td>
                        <td className={cn(td, 'text-right whitespace-nowrap tabular-nums')}>{t.anulada || t.teorico === null ? '–' : fmt.galones(t.teorico)}</td>
                        <td className={td}>
                          <Diferencia t={t} />
                        </td>
                        <td className={cn(td, 'max-w-56')}>{t.observaciones ?? ''}</td>
                        <td className={td}>
                          {t.usuario ?? 'sin nombre'}
                          <span className="block text-[10px] text-tenue">{instante(t.registradaEn)}</span>
                        </td>
                        <td className={td}>
                          {t.anulada ? (
                            <Insignia tono="red">Anulada</Insignia>
                          ) : t.modificadaEn ? (
                            <Insignia tono="amber">Corregida</Insignia>
                          ) : (
                            <Insignia tono="green">Vigente</Insignia>
                          )}
                        </td>
                        <td className={cn(td, 'whitespace-nowrap')}>
                          <div className="flex gap-[2px]">
                            {o!.puedeRegistrarTomas && !t.anulada && (
                              <button type="button" className={BOTON_CHICO} onClick={() => setEditando(t)} aria-label={`Editar la toma de ${t.producto} del ${fechaHora(t.fechaHora)}`}>
                                <Pencil aria-hidden />
                                Editar
                              </button>
                            )}
                            {o!.puedeRegistrarTomas && (
                              <button
                                type="button"
                                className={BOTON_CHICO}
                                onClick={() => setAnulando(t)}
                                aria-label={`${t.anulada ? 'Restaurar' : 'Anular'} la toma de ${t.producto} del ${fechaHora(t.fechaHora)}`}
                              >
                                {t.anulada ? <RotateCcw aria-hidden /> : <XCircle aria-hidden />}
                                {t.anulada ? 'Restaurar' : 'Anular'}
                              </button>
                            )}
                            <button type="button" className={BOTON_CHICO} onClick={() => setBitacora(t)} aria-label={`Bitácora de la toma de ${t.producto} del ${fechaHora(t.fechaHora)}`}>
                              <History aria-hidden />
                              Bitácora
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PieTabla desde={(paginaActual - 1) * porPagina + 1} hasta={(paginaActual - 1) * porPagina + visibles.length} total={filas.length}>
                <Paginacion pagina={paginaActual} paginas={totalPaginas} alCambiar={setPagina} />
              </PieTabla>
              {tomas.data.length >= 500 && (
                <p className="mt-[4px] text-[11px] text-tenue">Se muestran las 500 más recientes: acota las fechas para ver otras.</p>
              )}
            </>
          )}
        </section>
      </div>

      {registrando && <RegistrarToma opciones={o!} estacion={filtros.estacion} alCerrar={() => setRegistrando(false)} />}
      {editando && <EditarToma toma={editando} alCerrar={() => setEditando(null)} />}
      {anulando && <AnularToma toma={anulando} alCerrar={() => setAnulando(null)} />}
      {bitacora && <Bitacora toma={bitacora} alCerrar={() => setBitacora(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------

/** Mensaje de un campo devuelto por la API (422), si lo hay */
function errorDeCampo(e: unknown, campo: string): string | undefined {
  return e instanceof ErrorApi ? e.errores?.find((x) => x.campo === campo || x.campo.startsWith(`${campo}.`))?.mensaje : undefined;
}

function RegistrarToma({ opciones, estacion: inicial, alCerrar }: { opciones: OpcionesOperacion; estacion: string; alCerrar: () => void }) {
  const productos = ordenarProductos(opciones.productos);
  const [estacion, setEstacion] = useState(inicial);
  const [fechaToma, setFechaToma] = useState(hoy());
  const [hora, setHora] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [galones, setGalones] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const registrar = useRegistrarToma();

  const enviar = () => {
    setError(null);
    if (!fechaToma || !hora) return setError('Escribe la fecha y la hora de la medición.');
    if (fechaToma > hoy()) return setError('La toma no puede ser de una fecha futura.');
    const lecturas = productos.filter((p) => (galones[p] ?? '').trim() !== '').map((p) => ({ producto: p, galones: galones[p]!.trim() }));
    if (!lecturas.length) return setError('Escribe los galones de al menos un producto.');
    const malo = lecturas.find((l) => !GALONES.test(l.galones));
    if (malo) return setError(`${malo.producto}: escribe los galones con punto decimal y hasta 3 decimales, sin comas (por ejemplo 2331.5).`);
    registrar.mutate(
      { estacion, fecha: fechaToma, hora, lecturas, ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}) },
      {
        onSuccess: (r) => {
          toast.success(r.guardadas === 1 ? 'Toma física registrada' : `${r.guardadas} tomas físicas registradas`);
          alCerrar();
        },
        onError: (e) => setError(mensajeDeError(e)),
      },
    );
  };

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Registrar toma física"
      descripcion="Una medición por combustible, todas con la misma fecha y hora. Deja vacío el combustible que no se midió."
      pie={
        <>
          <Boton variante="secondary" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={enviar} cargando={registrar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Estación" className="sm:col-span-2">
          <select value={estacion} onChange={(e) => setEstacion(e.target.value)} className={claseEntrada()}>
            {opciones.estaciones.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.codigo} · {e.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha de la medición" htmlFor="toma-fecha">
          <Entrada id="toma-fecha" type="date" max={hoy()} value={fechaToma} onChange={(e) => setFechaToma(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Hora de la medición" htmlFor="toma-hora" error={errorDeCampo(registrar.error, 'hora')}>
          <Entrada id="toma-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
        </Campo>
        {productos.map((p, i) => (
          <Campo
            key={p}
            htmlFor={`toma-${p}`}
            etiqueta={
              <>
                <Punto color={colorProducto(p)} />
                {p} (galones)
              </>
            }
          >
            <Entrada
              id={`toma-${p}`}
              inputMode="decimal"
              autoFocus={i === 0}
              placeholder="Ejemplo: 2331.5"
              value={galones[p] ?? ''}
              onChange={(e) => setGalones((g) => ({ ...g, [p]: e.target.value }))}
              className="tabular-nums"
            />
          </Campo>
        ))}
        <Campo etiqueta="Observaciones (opcional)" htmlFor="toma-obs" className="sm:col-span-2">
          <Entrada
            id="toma-obs"
            maxLength={300}
            placeholder="Ejemplo: varilla al cierre, después del último despacho"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </Campo>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}

function EditarToma({ toma, alCerrar }: { toma: TomaFisica; alCerrar: () => void }) {
  const [fechaToma, setFechaToma] = useState(toma.fecha);
  const [hora, setHora] = useState(toma.hora);
  const [galones, setGalones] = useState(String(Number(toma.galones)));
  const [observaciones, setObservaciones] = useState(toma.observaciones ?? '');
  const [error, setError] = useState<string | null>(null);
  const editar = useEditarToma();

  const enviar = () => {
    setError(null);
    if (!fechaToma || !hora) return setError('Escribe la fecha y la hora de la medición.');
    if (fechaToma > hoy()) return setError('La toma no puede ser de una fecha futura.');
    if (!GALONES.test(galones.trim())) return setError('Escribe los galones con punto decimal y hasta 3 decimales, sin comas.');
    editar.mutate(
      { id: toma.tomaId, cuerpo: { fecha: fechaToma, hora, galones: galones.trim(), ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}) } },
      {
        onSuccess: () => {
          toast.success('Toma física corregida');
          alCerrar();
        },
        onError: (e) => setError(mensajeDeError(e)),
      },
    );
  };

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`Corregir toma de ${toma.producto}`}
      descripcion="El cambio queda en la bitácora de la toma, con lo que tenía antes."
      pie={
        <>
          <Boton variante="secondary" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={enviar} cargando={editar.isPending}>
            Guardar cambios
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha de la medición" htmlFor="ed-fecha">
          <Entrada id="ed-fecha" type="date" max={hoy()} value={fechaToma} onChange={(e) => setFechaToma(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hora de la medición" htmlFor="ed-hora">
          <Entrada id="ed-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
        <Campo
          etiqueta={
            <>
              <Punto color={colorProducto(toma.producto)} />
              {toma.producto} (galones)
            </>
          }
          htmlFor="ed-galones"
        >
          <Entrada id="ed-galones" inputMode="decimal" autoFocus value={galones} onChange={(e) => setGalones(e.target.value)} className="tabular-nums" />
        </Campo>
        <Campo etiqueta="Observaciones (opcional)" htmlFor="ed-obs" className="sm:col-span-2">
          <Entrada id="ed-obs" maxLength={300} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Campo>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}

function AnularToma({ toma, alCerrar }: { toma: TomaFisica; alCerrar: () => void }) {
  const anular = !toma.anulada;
  const accion = useAnularToma();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={anular ? '¿Anular esta toma física?' : '¿Restaurar esta toma física?'}
      pie={
        <>
          <Boton variante="secondary" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante={anular ? 'danger' : 'primary'}
            cargando={accion.isPending}
            onClick={() =>
              accion.mutate(
                { id: toma.tomaId, anular },
                {
                  onSuccess: () => {
                    toast.success(anular ? 'Toma física anulada' : 'Toma física restaurada');
                    alCerrar();
                  },
                  onError: (e) => setError(mensajeDeError(e)),
                },
              )
            }
          >
            {anular ? 'Anular' : 'Restaurar'}
          </Boton>
        </>
      }
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">
        {toma.producto} del {fechaHora(toma.fechaHora)}: {fmt.galones(toma.galones)}.
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {anular
          ? 'La toma deja de contar en el inventario, pero no se borra: queda en la lista de anuladas y se puede restaurar.'
          : 'La toma vuelve a contar en el inventario. Si ya hay otra toma vigente del mismo combustible a esa hora, primero anula esa.'}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}

// Las acciones que anota el trigger de dw.toma_fisica_historial (las mismas etiquetas del panel)
const ACCIONES: Record<string, { texto: string; tipo: 'bueno' | 'aviso' | 'critico' | 'info' }> = {
  CREADA: { texto: 'Creada', tipo: 'bueno' },
  MODIFICADA: { texto: 'Editada', tipo: 'info' },
  ANULADA: { texto: 'Anulada', tipo: 'aviso' },
  RESTAURADA: { texto: 'Restaurada', tipo: 'bueno' },
};
const CAMPOS: Record<string, string> = {
  fecha_hora: 'Fecha y hora',
  galones: 'Galones',
  observaciones: 'Observaciones',
  producto: 'Producto',
  estacion: 'Estación',
};

function Bitacora({ toma, alCerrar }: { toma: TomaFisica; alCerrar: () => void }) {
  const q = useBitacoraToma(toma.tomaId);
  return (
    <Modal abierto ancho alCerrar={alCerrar} titulo={`Bitácora · ${toma.producto} del ${fechaHora(toma.fechaHora)}`}>
      {q.isPending ? (
        <Cargando>Leyendo la bitácora…</Cargando>
      ) : q.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">{mensajeDeError(q.error)}</p>
      ) : !q.data.length ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Sin cambios registrados.</p>
      ) : (
        <div className="overflow-x-auto border border-borde bg-superficie">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Cuándo', 'Qué pasó', 'Campo', 'Antes', 'Después', 'Quién'].map((t) => (
                  <th key={t} scope="col" className={thFino}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={CUERPO_TABLA}>
              {q.data.map((h, i) => {
                const a = ACCIONES[h.accion] ?? { texto: h.accion, tipo: 'info' as const };
                return (
                  <tr key={i}>
                    <td className={cn(tdFino, 'whitespace-nowrap')}>{instante(h.en)}</td>
                    <td className={tdFino}>
                      <Estado tipo={a.tipo}>{a.texto}</Estado>
                    </td>
                    <td className={tdFino}>{h.campo ? (CAMPOS[h.campo] ?? h.campo) : ''}</td>
                    <td className={tdFino}>{h.valorAnterior ?? ''}</td>
                    <td className={tdFino}>{h.valorNuevo ?? ''}</td>
                    <td className={tdFino}>{h.usuario ?? 'sin nombre'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
