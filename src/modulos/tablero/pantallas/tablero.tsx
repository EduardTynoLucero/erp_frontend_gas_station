'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, Esqueleto, Vacio } from '@/componentes/ui/aviso';
import { BarrasAgrupadas, Columnas, ListaBarras } from '@/componentes/ui/barras';
import { EnlaceBoton } from '@/componentes/ui/boton';
import { InsigniaEstado, InsigniaSeveridad } from '@/componentes/ui/insignia';
import { Cabecera, ContenedorTabla, Cuerpo, filaClic, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, pct, periodoLabel, q, qk } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { useTablero } from '../datos';

const ENLACE = 'text-[11px] font-semibold text-primario-tinta hover:underline';

export function PantallaTablero() {
  const { estacionId } = useErp();
  const consulta = useTablero(estacionId);
  const router = useRouter();
  const d = consulta.data;

  return (
    <div>
      <EncabezadoPagina
        titulo="Tablero de gastos"
        descripcion={
          d
            ? `${periodoLabel(d.periodo)}, datos al ${fecha(d.fechaCorte)}. Incluye gastos por autorizar, aprobados y pagados.`
            : 'Incluye gastos por autorizar, aprobados y pagados.'
        }
        acciones={
          d?.puedeRegistrar && (
            <EnlaceBoton href="/gastos?nuevo=1">
              <Plus aria-hidden /> Registrar gasto
            </EnlaceBoton>
          )
        }
      />

      {consulta.isPending ? (
        <div className="grid gap-[6px]">
          <Esqueleto className="h-[64px]" />
          <Esqueleto className="h-[220px]" />
          <Esqueleto className="h-[220px]" />
        </div>
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <Contenido d={consulta.data} alNavegar={(ruta) => router.push(ruta)} />
      )}
    </div>
  );
}

function Contenido({ d, alNavegar }: { d: NonNullable<ReturnType<typeof useTablero>['data']>; alNavegar: (ruta: string) => void }) {
  const mesCorto = (periodoLabel(d.periodo).split(' ')[0] ?? '').toLowerCase();
  const diaCorte = Number(d.fechaCorte.slice(8));

  return (
    <>
      <div className={cn('grid grid-cols-2 gap-[6px]', d.presupuesto ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <Indicador
          etiqueta="Gasto del mes"
          valor={qk(d.total)}
          pista={d.pctSobreVentas !== null ? `${pct(d.pctSobreVentas)} de ventas (${qk(d.ventas)})` : `${d.cantidad} gastos`}
        />
        {d.presupuesto && (
          <Indicador
            etiqueta="Presupuesto usado"
            valor={d.presupuesto.pct !== null ? pct(d.presupuesto.pct, 0) : '—'}
            pista={`${qk(d.presupuesto.usado)} de ${qk(d.presupuesto.total)}`}
            tono={d.presupuesto.tono ?? undefined}
          />
        )}
        <Indicador
          etiqueta="Por autorizar"
          valor={d.porAutorizar.cantidad}
          pista={q(d.porAutorizar.monto)}
          tono={d.porAutorizar.cantidad ? 'amber' : undefined}
        />
        <Indicador etiqueta="Por pagar" valor={qk(d.porPagar.monto)} pista={`${d.porPagar.vencen} vencen en ${d.diasAlertaVencimiento} días o menos`} />
        <Indicador
          etiqueta="Pérdidas tomadas de reportes"
          valor={qk(d.perdidas.monto)}
          pista="Merma, descuentos y venta bajo costo"
          tono={d.perdidas.cantidad ? 'red' : undefined}
        />
      </div>

      <div className="mt-[6px] grid gap-[6px] lg:grid-cols-2">
        <Tarjeta titulo="Gasto por categoría" subtitulo={periodoLabel(d.periodo)}>
          <ListaBarras
            elementos={d.porCategoria.map((x) => ({ clave: x.id, etiqueta: x.nombre, valor: x.monto, sub: pct(x.pct, 0) }))}
            formato={q}
            alClic={(id) => alNavegar(`/gastos?categoria=${encodeURIComponent(id)}&periodo=${d.periodo}`)}
            vacio={`Todavía no hay gastos en ${periodoLabel(d.periodo).toLowerCase()}.`}
          />
        </Tarjeta>
        {d.vePresupuesto && (
          <Tarjeta titulo="Presupuesto contra gasto por estación" subtitulo="El gasto incluye lo que está por autorizar">
            <BarrasAgrupadas
              series={['Presupuesto', 'Gasto']}
              filas={d.porEstacion.map((e) => ({ clave: e.id, etiqueta: `${e.codigo} · ${e.nombre}`, valores: [e.presupuesto, e.gasto] }))}
              formato={qk}
              vacio="Todavía no hay estaciones con presupuesto ni gasto en el mes."
            />
          </Tarjeta>
        )}
      </div>

      <div className="mt-[6px] grid gap-[6px] lg:grid-cols-5">
        <Tarjeta titulo="Gasto diario" subtitulo={`1 al ${diaCorte} de ${mesCorto}`} className="lg:col-span-2">
          {d.cantidad === 0 && <p className="mb-[6px] text-[11px] text-tenue">Todavía no hay gastos en el mes: las columnas aparecen al registrar el primero.</p>}
          <Columnas datos={d.diario.map((x) => ({ clave: x.fecha, etiqueta: String(Number(x.fecha.slice(8))), valor: x.monto }))} formato={q} />
        </Tarjeta>
        <Tarjeta
          titulo="Alertas"
          subtitulo={`${d.alertas.total} activas`}
          className="lg:col-span-3"
          acciones={
            d.veAlertas && (
              <Link href="/alertas" className={ENLACE}>
                Ver todas
              </Link>
            )
          }
        >
          {d.alertas.primeras.length === 0 ? (
            <Vacio>Sin alertas activas.</Vacio>
          ) : (
            <ul className="divide-y divide-borde-suave">
              {d.alertas.primeras.map((a) => (
                <li key={a.id} className="flex items-start gap-[8px] py-[6px] first:pt-0 last:pb-0">
                  <InsigniaSeveridad severidad={a.severidad} />
                  <Link href={a.ruta} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-[12px] font-semibold text-tinta">{a.titulo}</p>
                    <p className="truncate text-[11px] text-tenue">
                      {a.estacion.codigo} · {a.detalle}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      {d.veHallazgos && (
        <Tarjeta
          className="mt-[6px]"
          titulo="Hallazgos de los reportes del sistema de la estación"
          subtitulo="Riesgos detectados al analizar tickets, facturación, cierres, mermas y compras. No se suman: se traslapan."
          acciones={
            <Link href="/hallazgos" className={ENLACE}>
              Ver hallazgos
            </Link>
          }
        >
          {d.hallazgos.length === 0 ? (
            <Vacio>Todavía no hay hallazgos registrados.</Vacio>
          ) : (
            <div className="grid gap-[6px] sm:grid-cols-2 lg:grid-cols-4">
              {d.hallazgos.map((h) => (
                <Link key={h.id} href="/hallazgos" className="block rounded-[2px] border border-borde p-[8px] hover:border-primario">
                  <div className="flex items-center justify-between gap-[6px]">
                    <InsigniaSeveridad severidad={h.severidad} />
                    <span className="truncate text-[11px] text-tenue">{h.fuente}</span>
                  </div>
                  <p className="mt-[6px] text-[15px] font-bold tabular-nums text-tinta">{h.monto !== null ? q(h.monto) : 'Sin valorar'}</p>
                  <p className="text-[12px] text-tinta-suave">{h.titulo}</p>
                  <p className="text-[11px] text-tenue">{h.estacion.codigo}</p>
                </Link>
              ))}
            </div>
          )}
        </Tarjeta>
      )}

      <Tarjeta
        className="mt-[6px]"
        titulo="Últimos movimientos"
        acciones={
          <Link href="/gastos" className={ENLACE}>
            Ver registro
          </Link>
        }
      >
        {d.recientes.length === 0 ? (
          <Vacio>Todavía no hay gastos registrados.</Vacio>
        ) : (
          <ContenedorTabla anchoMinimo={720}>
            <Cabecera>
              <th className={th}>Folio</th>
              <th className={th}>Fecha</th>
              <th className={th}>Estación</th>
              <th className={th}>Descripción</th>
              <th className={th}>Estado</th>
              <th className={thR}>Monto</th>
            </Cabecera>
            <Cuerpo>
              {d.recientes.map((g) => (
                <tr key={g.id} className={filaClic} onClick={() => alNavegar(`/gastos/${g.id}`)}>
                  <td className={cn(td, 'whitespace-nowrap font-semibold text-primario-tinta')}>
                    <Link href={`/gastos/${g.id}`} onClick={(e) => e.stopPropagation()}>
                      {g.folio}
                    </Link>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{fecha(g.fecha)}</td>
                  <td className={td}>{g.estacion.codigo}</td>
                  <td className={cn(td, 'max-w-xs truncate')}>{g.descripcion}</td>
                  <td className={td}>
                    <InsigniaEstado estado={g.estado} />
                  </td>
                  <td className={tdR}>{q(g.monto)}</td>
                </tr>
              ))}
            </Cuerpo>
          </ContenedorTabla>
        )}
      </Tarjeta>
    </>
  );
}
