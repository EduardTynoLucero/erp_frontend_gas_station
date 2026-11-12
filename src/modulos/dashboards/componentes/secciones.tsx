'use client';

/**
 * Tarjetas de gráfica del dashboard, en el orden del panel del ETL. Cada una arma sus series con las mismas reglas,
 * títulos, tooltips y tablas equivalentes («Ver tabla»).
 */
import { useState } from 'react';
import type { DashboardVentas } from '@/api/tipos';
import {
  diaSemana,
  ejeDe,
  fecha,
  fechaHora,
  fmt,
  formatoDe,
  MEDIDAS_DIA,
  type Medida,
  nombreMedida,
  num,
  pct,
  plural,
  suma,
} from '../formato';
import { COLOR_UNICO, colorProducto, ordenarProductos, pivotar } from '../productos';
import { BarrasApiladas, BarrasHorizontales, Lineas } from './graficas';
import { MapaCalor, MEDIDAS_MAPA, type MedidaMapa, TablaMapa } from './mapa-calor';
import { Segmentado, TarjetaGrafica } from './piezas';
import { type Columna, Punto, TablaDatos, TablaPivote } from './tablas';

type D = DashboardVentas;
interface PropsSeccion {
  d: D;
  className?: string;
}

// ---------------------------------------------------------------------------------------------------------------

export function VentasPorDia({ d, className }: PropsSeccion) {
  const [m, setM] = useState<Medida>('venta');
  const { categorias, series } = pivotar(d.diario, (f) => f.fecha, (f) => num(f[m]));
  const formato = formatoDe(m);
  return (
    <TarjetaGrafica
      className={className}
      titulo="Ventas por día"
      subtitulo="Por producto, según la fecha del ticket"
      alto={300}
      controles={<Segmentado etiqueta="medida" opciones={MEDIDAS_DIA} valor={m} alCambiar={setM} />}
      grafica={
        <BarrasApiladas
          etiqueta="Ventas por día"
          categorias={categorias}
          series={series}
          formato={formato}
          formatoEje={ejeDe(m)}
          etiquetaX={(x) => fecha(x)}
          tituloTooltip={(x) => `${diaSemana(x)} ${fecha(x, true)} · ${nombreMedida(m)}`}
        />
      }
      tabla={() => (
        <TablaPivote categorias={categorias} series={series} etiqueta={(x) => `${diaSemana(x)} ${fecha(x, true)}`} tituloCategoria="Fecha" formato={formato} />
      )}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------

const MEDIDAS_PRODUCTO = MEDIDAS_DIA.slice(0, 3);

interface FilaProducto {
  producto: string;
  tickets: number;
  galones: string;
  venta: string;
  utilidad: string;
  margen: string | number;
  ventaSinFactura: string;
  esPie?: boolean;
}

function TablaProductos({ productos }: { productos: D['productos'] }) {
  const filas: FilaProducto[] = productos.map((p) => ({ ...p, margen: p.margenPct }));
  const pie: FilaProducto = {
    producto: 'Total',
    tickets: productos.reduce((a, p) => a + p.tickets, 0),
    galones: suma(productos.map((p) => p.galones)),
    venta: suma(productos.map((p) => p.venta)),
    utilidad: suma(productos.map((p) => p.utilidad)),
    margen: pct(num(suma(productos.map((p) => p.utilidad))), num(suma(productos.map((p) => p.neto)))),
    ventaSinFactura: suma(productos.map((p) => p.ventaSinFactura)),
    esPie: true,
  };
  const columnas: Columna<FilaProducto>[] = [
    {
      titulo: 'Producto',
      valor: (f) =>
        f.esPie ? (
          'Total'
        ) : (
          <span className="whitespace-nowrap">
            <Punto color={colorProducto(f.producto)} />
            {f.producto}
          </span>
        ),
    },
    { titulo: 'Tickets', valor: (f) => fmt.entero(f.tickets), der: true },
    { titulo: 'Galones', valor: (f) => fmt.numero(f.galones, 2), der: true },
    { titulo: 'Venta', valor: (f) => fmt.moneda(f.venta), der: true },
    { titulo: 'Utilidad', valor: (f) => fmt.moneda(f.utilidad), der: true },
    { titulo: 'Margen', valor: (f) => fmt.pct(f.margen), der: true },
    { titulo: 'Sin factura', valor: (f) => fmt.moneda(f.ventaSinFactura), der: true },
  ];
  return <TablaDatos columnas={columnas} filas={filas} pie={pie} clave={(f) => f.producto} />;
}

export function PorProducto({ d, className }: PropsSeccion) {
  const [m, setM] = useState<Medida>('venta');
  const filas = [...d.productos].sort((a, b) => num(b[m]) - num(a[m]));
  const valores = filas.map((f) => num(f[m]));
  const total = valores.reduce((a, v) => a + v, 0);
  const formato = formatoDe(m);
  return (
    <TarjetaGrafica
      className={className}
      titulo="Por producto"
      subtitulo="Participación en el periodo"
      alto={300}
      controles={<Segmentado etiqueta="medida" opciones={MEDIDAS_PRODUCTO} valor={m} alCambiar={setM} />}
      grafica={
        <BarrasHorizontales
          etiqueta="Por producto"
          categorias={filas.map((f) => f.producto)}
          valores={valores}
          colores={filas.map((f) => colorProducto(f.producto))}
          formatoEje={ejeDe(m)}
          etiquetaDe={(i) => `${formato(filas[i]![m])} · ${fmt.pct(pct(valores[i]!, total))}`}
          tooltipDe={(i) => {
            const p = filas[i]!;
            return {
              titulo: p.producto,
              filas: [{ color: colorProducto(p.producto), nombre: nombreMedida(m), valor: formato(p[m]) }],
              nota: `Margen ${fmt.pct(p.margenPct)} · ${fmt.porGalon(p.utilidadPorGalon)} de utilidad`,
            };
          }}
        />
      }
      tabla={() => <TablaProductos productos={d.productos} />}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------

const ejeUtilidad = (v: number) => (Number.isInteger(v) ? fmt.monedaEntera(v) : fmt.moneda(v));

export function UtilidadPorGalon({ d, className }: PropsSeccion) {
  const filas = d.diario.filter((f) => f.producto !== 'SIN PRODUCTO' && num(f.galones) > 0);
  const categorias = [...new Set(filas.map((f) => f.fecha))].sort();
  const productos = ordenarProductos(filas.map((f) => f.producto));
  const indice = new Map(filas.map((f) => [`${f.fecha}|${f.producto}`, f]));
  const series = productos.map((p) => ({
    nombre: p,
    valores: categorias.map((x) => {
      const f = indice.get(`${x}|${p}`);
      return f ? num(f.utilidadPorGalon) : null;
    }),
  }));
  const columnas: Columna<string>[] = [
    { titulo: 'Fecha', valor: (x) => `${diaSemana(x)} ${fecha(x, true)}` },
    ...productos.map((p) => ({ titulo: p, valor: (x: string) => fmt.porGalon(indice.get(`${x}|${p}`)?.utilidadPorGalon), der: true })),
  ];
  return (
    <TarjetaGrafica
      className={className}
      titulo="Utilidad por galón"
      subtitulo="Por día y producto: venta neta menos costo, entre galones. Un salto brusco suele ser un costo mal cargado en la compra."
      alto={300}
      grafica={
        <Lineas
          etiqueta="Utilidad por galón"
          categorias={categorias}
          series={series}
          formato={fmt.porGalon}
          formatoEje={ejeUtilidad}
          etiquetaX={(x) => fecha(x)}
          tituloTooltip={(x) => `${diaSemana(x)} ${fecha(x, true)}`}
        />
      }
      tabla={() => <TablaDatos columnas={columnas} filas={categorias} clave={(x) => x} />}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function CuandoSeVende({ d, className }: PropsSeccion) {
  const [m, setM] = useState<MedidaMapa>('tickets');
  return (
    <TarjetaGrafica
      className={className}
      titulo="¿Cuándo se vende?"
      subtitulo="Promedio por día, según el día de la semana y la hora del despacho"
      alto={300}
      controles={<Segmentado etiqueta="medida" opciones={MEDIDAS_MAPA} valor={m} alCambiar={setM} />}
      grafica={<MapaCalor celdas={d.mapaDeCalor} medida={m} />}
      tabla={() => <TablaMapa celdas={d.mapaDeCalor} medida={m} />}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------

const MEDIDAS_TURNO: { valor: Medida; texto: string }[] = [
  { valor: 'venta', texto: 'Venta' },
  { valor: 'galones', texto: 'Galones' },
  { valor: 'ventaSinFactura', texto: 'Sin factura' },
];

type FilaTurno = D['turnos'][number] & { clave: string };
type InfoTurno = FilaTurno & { enRango: number };

export function VentasPorTurno({ d, className }: PropsSeccion) {
  const [m, setM] = useState<Medida>('venta');
  const varias = new Set(d.turnos.map((f) => f.estacion)).size > 1;
  const filas: FilaTurno[] = d.turnos.map((f) => ({ ...f, clave: `${f.estacion} ${f.turno}` }));
  // Por turno: los datos de su primera fila y cuántos de sus tickets caen en el rango (suma de sus productos)
  const info = new Map<string, InfoTurno>();
  for (const f of filas) {
    const i = info.get(f.clave) ?? { ...f, enRango: 0 };
    i.enRango += f.tickets;
    info.set(f.clave, i);
  }
  const de = (clave: string) => info.get(clave)!;
  const numero = (i: InfoTurno) => (i.turno === -1 ? 'Sin turno' : String(i.turno));
  const etiqueta = (clave: string) => (varias ? `${de(clave).estacion} ${numero(de(clave))}` : numero(de(clave)));
  const orden = (a: string, b: string) => de(a).estacion.localeCompare(de(b).estacion) || de(a).turno - de(b).turno;
  const enParte = (i: InfoTurno) => i.enRango < i.ticketsTurno;
  const titulo = (clave: string) => {
    const i = de(clave);
    return [i.turno === -1 ? 'Sin turno' : `Turno ${i.turno}`, varias ? i.estacion : null, i.fechaOperativa ? `fecha operativa ${fecha(i.fechaOperativa, true)}` : null]
      .filter(Boolean)
      .join(' · ');
  };
  const nota = (clave: string) => {
    const i = de(clave);
    const partes: string[] = [];
    if (i.desde && i.hasta) partes.push(`Tickets del ${fechaHora(i.desde, false)} al ${fechaHora(i.hasta, false)}`);
    if (enParte(i)) partes.push(`En el rango: ${fmt.entero(i.enRango)} de sus ${fmt.entero(i.ticketsTurno)} tickets`);
    return partes.join('. ') || null;
  };
  const { categorias, series } = pivotar(filas, (f) => f.clave, (f) => num(f[m]), orden);
  const formato = formatoDe(m);
  return (
    <TarjetaGrafica
      className={className}
      titulo="Ventas por turno"
      subtitulo="Por producto, con los tickets cuya fecha cae en el rango (igual que los indicadores). Un turno que cruza la medianoche puede salir en parte; su fecha operativa es el día con más tickets."
      alto={300}
      controles={<Segmentado etiqueta="medida" opciones={MEDIDAS_TURNO} valor={m} alCambiar={setM} />}
      grafica={
        <BarrasApiladas
          etiqueta="Ventas por turno"
          categorias={categorias}
          series={series}
          formato={formato}
          formatoEje={ejeDe(m)}
          etiquetaX={etiqueta}
          tituloTooltip={titulo}
          notaTooltip={nota}
        />
      }
      tabla={() => (
        <TablaPivote
          categorias={categorias}
          series={series}
          etiqueta={(x) => `${etiqueta(x)} · ${fecha(de(x).fechaOperativa)}${enParte(de(x)) ? ' (en parte)' : ''}`}
          tituloCategoria="Turno"
          formato={formato}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------

const ORDEN_FACTURACION = ['FACTURA INDIVIDUAL', 'FACTURA GLOBAL', 'SIN FACTURA'];
const NOMBRE_FACTURACION: Record<string, string> = {
  'SIN FACTURA': 'Sin factura',
  'FACTURA GLOBAL': 'Factura global',
  'FACTURA INDIVIDUAL': 'Factura individual',
};
const nombreFacturacion = (t: string) => NOMBRE_FACTURACION[t] ?? t;

export function Facturacion({ d, className }: PropsSeccion) {
  const filas = [...d.facturacion].sort((a, b) => ORDEN_FACTURACION.indexOf(a.tipo) - ORDEN_FACTURACION.indexOf(b.tipo));
  const valores = filas.map((f) => num(f.venta));
  const total = valores.reduce((a, v) => a + v, 0);
  const columnas: Columna<D['facturacion'][number]>[] = [
    { titulo: 'Facturación', valor: (f) => nombreFacturacion(f.tipo) },
    { titulo: 'Tickets', valor: (f) => fmt.entero(f.tickets), der: true },
    { titulo: 'Venta', valor: (f) => fmt.moneda(f.venta), der: true },
    { titulo: '% de la venta', valor: (f) => fmt.pct(pct(num(f.venta), total)), der: true },
  ];
  return (
    <TarjetaGrafica
      className={className}
      titulo="Facturación"
      subtitulo="Venta según cómo se facturó el ticket"
      alto={260}
      grafica={
        <BarrasHorizontales
          etiqueta="Facturación"
          categorias={filas.map((f) => nombreFacturacion(f.tipo))}
          valores={valores}
          colores={[COLOR_UNICO]}
          formatoEje={fmt.monedaCorta}
          etiquetaDe={(i) => `${fmt.monedaCorta(valores[i])} · ${fmt.pct(pct(valores[i]!, total))}`}
          tooltipDe={(i) => ({
            titulo: nombreFacturacion(filas[i]!.tipo),
            filas: [{ color: COLOR_UNICO, nombre: 'Venta', valor: fmt.moneda(filas[i]!.venta) }],
            nota: plural(filas[i]!.tickets, 'ticket', 'tickets'),
          })}
        />
      }
      tabla={() => <TablaDatos columnas={columnas} filas={filas} clave={(f) => f.tipo} />}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------

type Cliente = D['clientes'][number];
const nombreCliente = (c: Cliente) => c.nombre ?? c.codigo;

export function Clientes({ d, className }: PropsSeccion) {
  const filas = d.clientes;
  const valores = filas.map((c) => num(c.venta));
  const conRecargo = filas.some((c) => num(c.recargo) > 0);
  const columnas: Columna<Cliente>[] = [
    { titulo: 'Cliente', valor: nombreCliente },
    { titulo: 'Código', valor: (c) => c.codigo },
    { titulo: 'NIT', valor: (c) => c.nit ?? '–' },
    { titulo: 'Tickets', valor: (c) => fmt.entero(c.tickets), der: true },
    { titulo: 'Galones', valor: (c) => fmt.numero(c.galones, 2), der: true },
    { titulo: 'Venta', valor: (c) => fmt.moneda(c.venta), der: true },
    { titulo: 'Sin factura', valor: (c) => fmt.moneda(c.ventaSinFactura), der: true },
    { titulo: 'Descuento', valor: (c) => fmt.moneda(c.descuento), der: true },
    ...(conRecargo ? [{ titulo: 'Recargo', valor: (c: Cliente) => fmt.moneda(c.recargo), der: true }] : []),
  ];
  return (
    <TarjetaGrafica
      className={className}
      titulo="Clientes con código: los 10 que más compran"
      subtitulo="Sin consumidor final, con su nombre y NIT actuales. En el detalle: venta sin factura, descuentos y recargos de pricebook."
      alto={260}
      grafica={
        <BarrasHorizontales
          etiqueta="Clientes con código: los 10 que más compran"
          categorias={filas.map(nombreCliente)}
          valores={valores}
          colores={[COLOR_UNICO]}
          formatoEje={fmt.monedaCorta}
          anchoEtiqueta={32}
          etiquetaDe={(i) => fmt.monedaCorta(valores[i])}
          tooltipDe={(i) => {
            const c = filas[i]!;
            return {
              titulo: nombreCliente(c),
              filas: [{ color: COLOR_UNICO, nombre: 'Venta', valor: fmt.moneda(c.venta) }],
              nota: [
                c.codigo,
                plural(c.tickets, 'ticket', 'tickets'),
                `sin factura ${fmt.moneda(c.ventaSinFactura)}`,
                `descuento ${fmt.moneda(c.descuento)}`,
                num(c.recargo) > 0 ? `recargo ${fmt.moneda(c.recargo)}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            };
          }}
        />
      }
      tabla={() => <TablaDatos columnas={columnas} filas={filas} clave={(c) => c.codigo} />}
    />
  );
}
