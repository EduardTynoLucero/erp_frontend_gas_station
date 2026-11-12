'use client';

/**
 * Inventario y tanques: la pestaña «Inventario» del panel del ETL sobre la API del ERP. De arriba hacia abajo:
 *   - Nivel actual de los tanques (semáforo y pedido sugerido) y «Configurar tanques»;
 *   - existencia final por combustible y Movimiento de inventario (inicial + compras − ventas = final, con el ajuste
 *     por toma física);
 *   - Existencia, compras y ventas por día (cascada), Existencia al cierre de cada día y Compras y ventas por día;
 *   - Compras de combustible del periodo y Tomas físicas del periodo.
 * La existencia sale de la toma física más cercana: sin ninguna toma de un combustible no se puede saber.
 */
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import { EncabezadoPagina } from '@/componentes/ui/tarjeta';
import { useTienePantalla } from '@/componentes/marco/contexto';
import { cn } from '@/lib/utilidades';
import { BarrasApiladas, Lineas } from '@/modulos/dashboards/componentes/graficas';
import { Estado } from '@/modulos/dashboards/componentes/iconos';
import { BOTON_CHICO, Cargando, Segmentado, TARJETA, TarjetaGrafica, TarjetaVacia, Veredicto } from '@/modulos/dashboards/componentes/piezas';
import { type Columna, Punto, TablaDatos, TablaPivote } from '@/modulos/dashboards/componentes/tablas';
import { diaSemana, fecha, fechaHora, fmt, num, plural } from '@/modulos/dashboards/formato';
import { colorProducto, ordenarProductos, pivotar } from '@/modulos/dashboards/productos';
import { Cascada, type Paso } from '../componentes/cascada';
import { BarraOperacion, type FiltrosFecha } from '../componentes/filtros';
import { NivelDeTanques } from '../componentes/tanques';
import { hoy, type Inventario, preferencia, rangoRapido, useInventario, useOpcionesOperacion, useTanques } from '../datos';

type ProductoInv = Inventario['productos'][number];
type TomaInv = Inventario['tomas'][number];

const REJILLA = 'grid grid-cols-12 items-stretch gap-4';
const COL5 = 'col-span-12 @min-[1050px]:col-span-5';
const COL7 = 'col-span-12 @min-[1050px]:col-span-7';

const n = (v: string | null | undefined) => (v === null || v === undefined ? null : num(v));
const conSigno = (v: number) => (v > 0 ? `+${fmt.galones(v)}` : fmt.galones(v));
const diaLargo = (f: string) => `${diaSemana(f)} ${fecha(f, true)}`;

/** Faltante o sobrante de una toma contra lo calculado, con palabra (el color nunca va solo) */
function Diferencia({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-slate-400">–</span>;
  if (Math.abs(valor) < 0.0005) return <Estado tipo="bueno">Cuadra</Estado>;
  return <Estado tipo={valor < 0 ? 'aviso' : 'info'}>{`${valor < 0 ? 'Faltante' : 'Sobrante'} ${conSigno(valor)}`}</Estado>;
}

const ConProducto = ({ nombre }: { nombre: string }) => (
  <span className="whitespace-nowrap">
    <Punto color={colorProducto(nombre)} />
    {nombre}
  </span>
);

/** Existencia al final del rango: la calculada, ajustada a la última toma física del rango si hubo */
function finalAjustado(p: ProductoInv): number | null {
  return p.tomasEnRango && p.finalSegunToma !== null ? n(p.finalSegunToma) : n(p.finalTeorico);
}

interface FilaKardex {
  fecha: string;
  producto: string;
  inicial: number;
  compras: number;
  ventas: number;
  ajuste: number;
  tomas: (TomaInv & { ajuste: number })[];
  final: number;
}

/**
 * Existencia al cierre de cada día desde la inicial, con las compras y las ventas del día. Cada toma física del rango
 * manda: el día de la toma la existencia se ajusta a lo medido y el ajuste queda aparte. La diferencia de cada toma
 * viene contra lo calculado desde la inicial, sin ajustes: su ajuste es esa diferencia menos los ajustes anteriores.
 */
function kardex(inv: Inventario, productos: ProductoInv[]): FilaKardex[] {
  const filas: FilaKardex[] = [];
  for (const p of productos) {
    if (p.inicial === null) continue;
    const ajustes = new Map<string, { ajuste: number; tomas: FilaKardex['tomas'] }>();
    let yaAjustado = 0;
    for (const m of inv.tomas.filter((x) => x.producto === p.producto && x.diferencia !== null)) {
      const ajuste = num(m.diferencia) - yaAjustado;
      yaAjustado += ajuste;
      const dia = m.fechaHora.slice(0, 10);
      const a = ajustes.get(dia) ?? { ajuste: 0, tomas: [] };
      a.ajuste += ajuste;
      a.tomas.push({ ...m, ajuste });
      ajustes.set(dia, a);
    }
    let saldo = num(p.inicial);
    for (const d of inv.diario.filter((x) => x.producto === p.producto)) {
      const inicial = saldo;
      const a = ajustes.get(d.fecha) ?? { ajuste: 0, tomas: [] };
      saldo = saldo + num(d.compras) - num(d.ventas) + a.ajuste;
      filas.push({ fecha: d.fecha, producto: p.producto, inicial, compras: num(d.compras), ventas: num(d.ventas), ajuste: a.ajuste, tomas: a.tomas, final: saldo });
    }
  }
  return filas;
}

// ---------------------------------------------------------------------------------------------

function Indicadores({ productos }: { productos: ProductoInv[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {productos.map((p) => {
        const final = finalAjustado(p);
        const ajuste = final !== null && p.finalTeorico !== null ? final - num(p.finalTeorico) : 0;
        const nota =
          p.inicial === null
            ? `Movimiento del periodo: ${conSigno(num(p.compras) - num(p.ventas))}`
            : `Inicial ${fmt.galones(p.inicial)} · compras ${fmt.galones(p.compras)} · ventas ${fmt.galones(p.ventas)}`;
        const toma =
          p.tomasEnRango && p.finalSegunToma !== null
            ? `Ajustada a la toma del ${fechaHora(p.finalTomaEn, false)}${Math.abs(ajuste) >= 0.0005 ? ` (${ajuste < 0 ? 'faltante' : 'sobrante'} ${conSigno(ajuste)})` : ''}`
            : null;
        return (
          <div key={p.producto} className={cn(TARJETA, 'p-4')}>
            <div className="text-[11px] text-tenue">
              <ConProducto nombre={p.producto} /> · existencia final
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums dark:text-white">{final === null ? 'Sin toma física' : fmt.galones(final)}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{nota}</div>
            {toma && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{toma}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Movimiento({ inv, productos }: { inv: Inventario; productos: ProductoInv[] }) {
  const filas = productos.map((p) => ({
    ...p,
    dif: p.tomasEnRango && p.finalSegunToma !== null && p.finalTeorico !== null ? num(p.finalSegunToma) - num(p.finalTeorico) : null,
  }));
  const columnas: Columna<(typeof filas)[number]>[] = [
    { titulo: 'Producto', valor: (p) => <ConProducto nombre={p.producto} /> },
    { titulo: 'Existencia inicial', valor: (p) => (p.inicial === null ? 'Sin toma' : fmt.galones(p.inicial)), der: true },
    { titulo: '+ Compras', valor: (p) => `${fmt.galones(p.compras)}${p.facturas ? ` (${plural(p.facturas, 'factura', 'facturas')})` : ''}`, der: true },
    { titulo: '− Ventas', valor: (p) => fmt.galones(p.ventas), der: true },
    { titulo: '= Final calculada', valor: (p) => (p.finalTeorico === null ? '–' : fmt.galones(p.finalTeorico)), der: true },
    { titulo: 'Ajuste por toma física', valor: (p) => <Diferencia valor={p.dif} /> },
    { titulo: 'Existencia final', valor: (p) => (finalAjustado(p) === null ? '–' : fmt.galones(finalAjustado(p))), der: true },
    {
      titulo: 'Toma de partida',
      valor: (p) => (p.inicialTomaEn ? `${fechaHora(p.inicialTomaEn)} · ${fmt.galones(p.inicialTomaGalones)}` : '–'),
    },
  ];
  return (
    <section className={cn(TARJETA, 'p-[10px]')}>
      <h3 className="text-[12px] font-bold leading-[1.25] text-tinta">Movimiento de inventario</h3>
      <p className="mt-px mb-[6px] text-[11px] leading-[1.35] text-tenue">
        {inv.filtros.estacion} · del {fecha(inv.filtros.desde, true)} al {fecha(inv.filtros.hasta, true)}. Galones.
      </p>
      <TablaDatos columnas={columnas} filas={filas} limitar={false} clave={(p) => p.producto} />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        La final calculada es inicial + compras − ventas. Si en el periodo hay una toma física, la existencia se ajusta a lo medido: el ajuste negativo
        es faltante (merma, evaporación, calibración, ventas sin ticket o una compra registrada con otra fecha) y el positivo, sobrante. La existencia
        final sale de la última toma, más las compras y menos las ventas que vinieron después de ella.
      </p>
    </section>
  );
}

function CascadaPorDia({ inv, productos, filas }: { inv: Inventario; productos: ProductoInv[]; filas: FilaKardex[] }) {
  const conToma = productos.filter((p) => p.inicial !== null);
  const [elegido, setElegido] = useState<string | null>(null);
  const producto = conToma.some((p) => p.producto === elegido) ? elegido! : conToma[0]?.producto;
  const subtitulo =
    'Cada día las compras suben la existencia, las ventas la bajan y la barra llena es la existencia al cierre. El día de una toma física, el ajuste la lleva a lo medido. Galones.';
  if (!producto)
    return (
      <TarjetaGrafica
        titulo="Existencia, compras y ventas por día"
        subtitulo={subtitulo}
        alto={120}
        grafica={<SinToma />}
        tabla={() => <SinToma />}
      />
    );
  const p = conToma.find((x) => x.producto === producto)!;
  const dias = filas.filter((f) => f.producto === producto);
  const pasos: Paso[] = [
    {
      etiqueta: 'Inicial',
      titulo: `${producto} · existencia al empezar el ${fecha(inv.filtros.desde, true)}`,
      tipo: 'total',
      antes: 0,
      despues: num(p.inicial),
      nota: p.inicialTomaEn ? `Calculada desde la toma física del ${fechaHora(p.inicialTomaEn)}` : null,
    },
  ];
  for (const d of dias) {
    const dia = diaLargo(d.fecha);
    if (d.compras) pasos.push({ etiqueta: '', titulo: `${producto} · compras del ${dia}`, tipo: 'sube', antes: d.inicial, despues: d.inicial + d.compras });
    const despuesDeVentas = d.inicial + d.compras - d.ventas;
    pasos.push({ etiqueta: '', titulo: `${producto} · ventas del ${dia}`, tipo: 'baja', antes: d.inicial + d.compras, despues: despuesDeVentas });
    // El ajuste va al final del día: la existencia al cierre queda igual a la toma más lo que pasó después de ella
    if (d.tomas.length)
      pasos.push({
        etiqueta: '',
        titulo: `${producto} · ajuste por toma física del ${dia}`,
        tipo: 'ajuste',
        antes: despuesDeVentas,
        despues: d.final,
        nota: d.tomas
          .map(
            (m) =>
              `Toma de las ${m.fechaHora.slice(11)}: ${fmt.galones(m.galones)} medidos contra ${fmt.galones(num(m.galones) - m.ajuste)} calculados (${m.ajuste < 0 ? 'faltante' : 'sobrante'} ${conSigno(m.ajuste)})`,
          )
          .join(' · '),
      });
    pasos.push({
      etiqueta: fecha(d.fecha),
      titulo: `${producto} · existencia al cierre del ${dia}`,
      tipo: 'total',
      antes: 0,
      despues: d.final,
      nota: d.tomas.length ? d.tomas.map((m) => `Toma física a las ${m.fechaHora.slice(11)}: ${fmt.galones(m.galones)}`).join(' · ') : null,
    });
  }
  const columnas: Columna<FilaKardex>[] = [
    { titulo: 'Fecha', valor: (f) => diaLargo(f.fecha) },
    { titulo: 'Existencia inicial', valor: (f) => fmt.galones(f.inicial), der: true },
    { titulo: '+ Compras', valor: (f) => fmt.galones(f.compras), der: true },
    { titulo: '− Ventas', valor: (f) => fmt.galones(f.ventas), der: true },
    { titulo: 'Ajuste por toma física', valor: (f) => (f.tomas.length ? <Diferencia valor={f.ajuste} /> : '') },
    { titulo: '= Existencia al cierre', valor: (f) => fmt.galones(f.final), der: true },
  ];
  return (
    <TarjetaGrafica
      titulo="Existencia, compras y ventas por día"
      subtitulo={subtitulo}
      alto={340}
      controles={
        conToma.length > 1 ? (
          <Segmentado etiqueta="Combustible" opciones={conToma.map((x) => ({ valor: x.producto, texto: x.producto }))} valor={producto} alCambiar={setElegido} />
        ) : undefined
      }
      grafica={<Cascada etiqueta={`Cascada de inventario de ${producto}`} pasos={pasos} colorTotal={colorProducto(producto)} formato={fmt.galones} formatoEje={fmt.galonesCorto} />}
      tabla={() => <TablaDatos columnas={columnas} filas={dias} clave={(f) => f.fecha} />}
    />
  );
}

function SinToma() {
  return <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">Sin toma física: no se puede calcular la existencia</p>;
}

function ExistenciaPorDia({ inv, productos, filas }: { inv: Inventario; productos: ProductoInv[]; filas: FilaKardex[] }) {
  const fechas = [...new Set(inv.diario.map((d) => d.fecha))];
  const series = productos
    .filter((p) => p.inicial !== null)
    .map((p) => ({ nombre: p.producto, valores: fechas.map((f) => filas.find((x) => x.fecha === f && x.producto === p.producto)?.final ?? null) }));
  const columnas: Columna<FilaKardex>[] = [
    { titulo: 'Fecha', valor: (f) => diaLargo(f.fecha) },
    { titulo: 'Producto', valor: (f) => <ConProducto nombre={f.producto} /> },
    { titulo: 'Inicial', valor: (f) => fmt.galones(f.inicial), der: true },
    { titulo: '+ Compras', valor: (f) => fmt.galones(f.compras), der: true },
    { titulo: '− Ventas', valor: (f) => fmt.galones(f.ventas), der: true },
    { titulo: '= Final', valor: (f) => fmt.galones(f.final), der: true },
  ];
  return (
    <TarjetaGrafica
      className={COL7}
      titulo="Existencia al cierre de cada día"
      subtitulo="Desde la existencia inicial, ajustada a cada toma física; los días con toma lo dicen en el tooltip"
      alto={300}
      grafica={
        series.length ? (
          <Lineas
            etiqueta="Existencia al cierre de cada día"
            categorias={fechas}
            series={series}
            formato={fmt.galones}
            formatoEje={fmt.galonesCorto}
            etiquetaX={(x) => fecha(x)}
            tituloTooltip={(x) => `${diaLargo(x)} · al cierre`}
            notaTooltip={(x) => {
              const delDia = inv.tomas.filter((m) => m.fechaHora.slice(0, 10) === x);
              return delDia.length ? delDia.map((m) => `Toma ${m.producto} ${m.fechaHora.slice(11)}: ${fmt.galones(m.galones)}`).join(' · ') : null;
            }}
          />
        ) : (
          <SinToma />
        )
      }
      tabla={() => (
        <TablaDatos
          columnas={columnas}
          filas={[...filas].sort((a, b) => a.fecha.localeCompare(b.fecha))}
          vacio="Sin toma física: no se puede calcular la existencia"
          clave={(f) => `${f.fecha}-${f.producto}`}
        />
      )}
    />
  );
}

function ComprasVentasPorDia({ inv }: { inv: Inventario }) {
  const [m, setM] = useState<'ventas' | 'compras'>('ventas');
  const { categorias, series } = pivotar(inv.diario, (f) => f.fecha, (f) => num(f[m]));
  return (
    <TarjetaGrafica
      className={COL5}
      titulo="Compras y ventas por día"
      subtitulo="Galones por producto"
      alto={300}
      controles={
        <Segmentado
          etiqueta="Medida"
          opciones={[
            { valor: 'ventas', texto: 'Ventas' },
            { valor: 'compras', texto: 'Compras' },
          ]}
          valor={m}
          alCambiar={setM}
        />
      }
      grafica={
        <BarrasApiladas
          etiqueta={`${m === 'ventas' ? 'Ventas' : 'Compras'} por día`}
          categorias={categorias}
          series={series}
          formato={fmt.galones}
          formatoEje={fmt.galonesCorto}
          etiquetaX={(x) => fecha(x)}
          tituloTooltip={(x) => `${diaLargo(x)} · ${m === 'ventas' ? 'Ventas' : 'Compras'}`}
        />
      }
      tabla={() => <TablaPivote categorias={categorias} series={series} etiqueta={diaLargo} tituloCategoria="Fecha" formato={fmt.galones} />}
    />
  );
}

function ComprasDelPeriodo({ inv }: { inv: Inventario }) {
  type Fila = Inventario['compras'][number] & { esPie?: boolean };
  const total = inv.compras.reduce((a, k) => ({ galones: a.galones + num(k.galones), total: a.total + num(k.total), costo: a.costo + num(k.costo) }), {
    galones: 0,
    total: 0,
    costo: 0,
  });
  const pie: Fila = {
    fechaHora: '',
    factura: '',
    turno: null,
    producto: '',
    proveedor: null,
    galones: String(total.galones),
    precio: '',
    total: String(total.total),
    costo: String(total.costo),
    costoPorGalon: total.galones ? String(total.costo / total.galones) : null,
    esPie: true,
  };
  const columnas: Columna<Fila>[] = [
    { titulo: 'Fecha y hora', valor: (k) => (k.esPie ? 'Total' : <span className="whitespace-nowrap">{fechaHora(k.fechaHora)}</span>) },
    { titulo: 'Factura', valor: (k) => k.factura },
    { titulo: 'Turno', valor: (k) => (k.esPie ? '' : (k.turno ?? '–')), der: true },
    { titulo: 'Producto', valor: (k) => (k.esPie ? '' : <ConProducto nombre={k.producto} />) },
    { titulo: 'Galones', valor: (k) => fmt.numero(k.galones, 3), der: true },
    { titulo: 'Precio', valor: (k) => (k.esPie ? '' : fmt.numero(k.precio, 4)), der: true },
    { titulo: 'Total', valor: (k) => fmt.moneda(k.total), der: true },
    { titulo: 'Costo FOB', valor: (k) => fmt.moneda(k.costo), der: true },
    { titulo: 'Costo por galón', valor: (k) => fmt.porGalon(k.costoPorGalon), der: true },
    { titulo: 'Proveedor', valor: (k) => (k.esPie ? '' : (k.proveedor ?? '–')) },
  ];
  return (
    <section className={cn(TARJETA, 'p-[10px]')}>
      <h3 className="text-[12px] font-bold leading-[1.25] text-tinta">Compras de combustible del periodo</h3>
      <p className="mt-px mb-[6px] text-[11px] leading-[1.35] text-tenue">
        {inv.compras.length
          ? `${plural(inv.compras.length, 'línea', 'líneas')} · ${fmt.galones(total.galones)} · ${fmt.moneda(total.total)} facturado`
          : 'Las compras entran con el Reporte de compras de BISS, que se sube en Integraciones.'}
      </p>
      <TablaDatos columnas={columnas} filas={inv.compras} pie={inv.compras.length ? pie : null} vacio="Sin compras de combustible en el periodo" clave={(k, i) => `${k.factura}-${k.producto}-${i}`} />
    </section>
  );
}

function TomasDelPeriodo({ inv, veTomas }: { inv: Inventario; veTomas: boolean }) {
  const columnas: Columna<TomaInv>[] = [
    { titulo: 'Fecha y hora', valor: (m) => <span className="whitespace-nowrap">{fechaHora(m.fechaHora)}</span> },
    { titulo: 'Producto', valor: (m) => <ConProducto nombre={m.producto} /> },
    { titulo: 'Medido', valor: (m) => fmt.galones(m.galones), der: true },
    { titulo: 'Debía haber', valor: (m) => (m.teorico === null ? '–' : fmt.galones(m.teorico)), der: true },
    { titulo: 'Diferencia', valor: (m) => <Diferencia valor={n(m.diferencia)} /> },
    { titulo: 'Quién', valor: (m) => m.usuario ?? '–' },
    { titulo: 'Observaciones', valor: (m) => m.observaciones ?? '' },
  ];
  return (
    <section className={cn(TARJETA, 'p-[10px]')}>
      <h3 className="text-[12px] font-bold leading-[1.25] text-tinta">Tomas físicas del periodo</h3>
      <p className="mt-px mb-[6px] text-[11px] leading-[1.35] text-tenue">
        Contra lo que debía haber según la existencia inicial, las compras y las ventas.{' '}
        {veTomas && (
          <>
            Se registran, corrigen y anulan en{' '}
            <Link href="/tomas-fisicas" className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
              Tomas físicas
            </Link>
            .
          </>
        )}
      </p>
      <TablaDatos columnas={columnas} filas={inv.tomas} vacio="Sin tomas físicas en el periodo" clave={(m) => m.tomaId} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

export function PantallaInventario() {
  const cliente = useQueryClient();
  const veTomas = useTienePantalla('tomas-fisicas');
  const opciones = useOpcionesOperacion();
  const [filtros, setFiltros] = useState<FiltrosFecha | null>(null);

  // Primera vez (y si la estación elegida ya no está): la estación recordada o la primera, y los últimos 7 días con datos
  const o = opciones.data;
  if (o && o.estaciones.length && (!filtros || !o.estaciones.some((e) => e.codigo === filtros.estacion))) {
    const recordada = preferencia.leer('estacion');
    const estacion = o.estaciones.some((e) => e.codigo === recordada) ? recordada! : o.estaciones[0]!.codigo;
    setFiltros({ estacion, ...rangoRapido(o.rango.hasta ?? hoy(), '7'), rapido: '7' });
  }

  const ultimaCarga = o?.ultimaCarga;
  const inventario = useInventario(filtros ? { estacion: filtros.estacion, desde: filtros.desde, hasta: filtros.hasta } : null, ultimaCarga);
  const tanques = useTanques(filtros?.estacion ?? null, ultimaCarga);
  const actualizar = () => void cliente.invalidateQueries({ queryKey: ['operacion'] });

  const encabezado = (
    <EncabezadoPagina
      titulo="Inventario y tanques"
      descripcion="Existencias de combustible desde las tomas físicas, con las compras y las ventas que publica el ETL; nivel de los tanques y cuándo pedir."
    />
  );
  if (opciones.isPending)
    return (
      <>
        {encabezado}
        <Cargando>Consultando el inventario…</Cargando>
      </>
    );
  if (opciones.isError)
    return (
      <>
        {encabezado}
        <Veredicto
          tipo="critico"
          titulo="No se pudo calcular el inventario"
          acciones={
            <button type="button" className={BOTON_CHICO} onClick={() => void opciones.refetch()}>
              Reintentar
            </button>
          }
        >
          <p>{mensajeDeError(opciones.error)}</p>
        </Veredicto>
      </>
    );
  if (!o!.estaciones.length || !filtros)
    return (
      <>
        {encabezado}
        <TarjetaVacia titulo="Todavía no hay estaciones en el modelo">
          La estación aparece cuando el servicio ETL publica la primera carga de tickets. Sube la Consulta de Tickets de BISS en Integraciones.
        </TarjetaVacia>
      </>
    );

  const cambiar = (f: FiltrosFecha) => {
    preferencia.guardar('estacion', f.estacion);
    setFiltros(f);
  };
  const inv = inventario.data;
  const productos = inv ? ordenarProductos(inv.productos.map((p) => p.producto)).map((nombre) => inv.productos.find((p) => p.producto === nombre)!) : [];
  const sinToma = productos.filter((p) => p.inicial === null);
  const filas = inv ? kardex(inv, productos) : [];
  const consultando = inventario.isFetching || tanques.isFetching;

  let cuerpo;
  if (inventario.isError && !inv)
    cuerpo = (
      <Veredicto
        tipo="critico"
        titulo="No se pudo calcular el inventario"
        acciones={
          <button type="button" className={BOTON_CHICO} onClick={() => void inventario.refetch()}>
            Reintentar
          </button>
        }
      >
        <p>{mensajeDeError(inventario.error)}</p>
      </Veredicto>
    );
  else if (!inv) cuerpo = <Cargando>Calculando el inventario…</Cargando>;
  else
    cuerpo = (
      <div className="@container space-y-4">
        {tanques.data ? (
          <NivelDeTanques datos={tanques.data} puedeConfigurar={o!.puedeConfigurarTanques} />
        ) : tanques.isError ? (
          <Veredicto tipo="critico" titulo="No se pudo leer el nivel de los tanques">
            <p>{mensajeDeError(tanques.error)}</p>
          </Veredicto>
        ) : (
          <Cargando>Leyendo el nivel de los tanques…</Cargando>
        )}
        {sinToma.length ? (
          <Veredicto
            tipo="aviso"
            titulo={sinToma.length === productos.length ? 'Registra una toma física para ver las existencias' : `Falta una toma física de ${sinToma.map((p) => p.producto).join(', ')}`}
            acciones={
              veTomas ? (
                <Link href="/tomas-fisicas" className={BOTON_CHICO}>
                  Registrar una toma física
                </Link>
              ) : undefined
            }
          >
            <p>
              La existencia sale de una medición de los tanques: con una sola toma, en cualquier fecha, se calcula hacia adelante y hacia atrás con las
              compras y las ventas cargadas.
            </p>
          </Veredicto>
        ) : (
          <p className="text-[11px] text-tenue">
            Existencia inicial al empezar el {fecha(inv.filtros.desde, true)} y final al terminar el {fecha(inv.filtros.hasta, true)}, calculadas desde
            la toma física más cercana con las compras y las ventas cargadas. Una venta o compra a la misma hora de la toma cuenta como posterior a ella.
          </p>
        )}
        <Indicadores productos={productos} />
        <Movimiento inv={inv} productos={productos} />
        <CascadaPorDia inv={inv} productos={productos} filas={filas} />
        <div className={REJILLA}>
          <ExistenciaPorDia inv={inv} productos={productos} filas={filas} />
          <ComprasVentasPorDia inv={inv} />
        </div>
        <ComprasDelPeriodo inv={inv} />
        <TomasDelPeriodo inv={inv} veTomas={veTomas} />
      </div>
    );

  return (
    <>
      {encabezado}
      <div className="space-y-4">
        <BarraOperacion
          etiqueta="Filtros del inventario"
          estaciones={o!.estaciones}
          filtros={filtros}
          rango={o!.rango}
          alCambiar={cambiar}
          alRapido={(tipo) => cambiar({ ...filtros, ...rangoRapido(o!.rango.hasta ?? hoy(), tipo), rapido: tipo })}
          alActualizar={actualizar}
          actualizando={consultando}
        />
        <div aria-busy={consultando || undefined} className={cn('transition-opacity duration-200', consultando && inventario.isPlaceholderData && 'opacity-60')}>
          {cuerpo}
        </div>
      </div>
    </>
  );
}
