'use client';

import { useMemo } from 'react';
import { Link, useNavigate, rutaGasto } from '../lib/router';
import { BarList, Card, Columns, cx, Empty, EstadoBadge, GroupedBars, PageHeader, SeveridadBadge, Stat, TableWrap, td, tdR, th, thR } from '../components/ui';
import { agrupar, diasEntre, fecha, pct, periodoDe, periodoLabel, q, qk, sumar, sumarDias } from '../lib/format';
import { puedeVerModulo } from '../lib/acceso';
import { esAjusteContable, tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { calcularAlertas, ejecucionPresupuesto, estacionesEnFiltro, esVigente, gastosVisibles, ventasDe } from '../lib/selectors';

export default function Tablero() {
  const { db, usuario, estacionFiltro } = useStore();
  const c = useCatalogos();
  const nav = useNavigate();
  const periodo = db.config.periodoActual;

  const d = useMemo(() => {
    const visibles = gastosVisibles(db, usuario, estacionFiltro);
    const mes = visibles.filter((g) => periodoDe(g.fecha) === periodo && esVigente(g));
    const estaciones = estacionesEnFiltro(db, usuario, estacionFiltro);
    const pres = ejecucionPresupuesto(db, periodo, estaciones);
    const presTotal = sumar(pres, (f) => f.presupuesto);
    const usado = sumar(pres, (f) => f.ejecutado + f.comprometido);
    const ventas = ventasDe(db, periodo, estaciones);
    const total = sumar(mes, (g) => g.monto);
    const pendientes = visibles.filter((g) => g.estado === 'pendiente');
    const porPagar = visibles.filter((g) => g.estado === 'aprobado' && !esAjusteContable(g));
    const vencen = porPagar.filter((g) => g.vencimiento && diasEntre(db.config.hoy, g.vencimiento) <= db.config.diasAlertaVencimiento);
    const perdidas = visibles.filter((g) => g.origen === 'reporte' && g.categoriaId !== 'FIN' && esVigente(g));

    const porCat = [...agrupar(mes, (g) => g.categoriaId)]
      .map(([k, gs]) => ({ key: k, label: c.catNombre(k), value: sumar(gs, (g) => g.monto) }))
      .sort((a, b) => b.value - a.value);

    const porEst = estaciones.map((id) => {
      const f = pres.filter((x) => x.estacionId === id);
      return {
        key: id,
        label: `${c.estCodigo(id)} · ${c.estacion(id)?.nombre ?? ''}`,
        values: [sumar(f, (x) => x.presupuesto), sumar(f, (x) => x.ejecutado + x.comprometido)],
      };
    });

    const dias: { key: string; label: string; value: number }[] = [];
    for (let f = `${periodo}-01`; f <= db.config.fechaCorte; f = sumarDias(f, 1)) {
      dias.push({ key: f, label: String(Number(f.slice(8))), value: sumar(mes.filter((g) => g.fecha === f), (g) => g.monto) });
    }

    return { mes, total, ventas, presTotal, usado, pendientes, porPagar, vencen, perdidas, porCat, porEst, dias, recientes: [...visibles].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.folio.localeCompare(a.folio)).slice(0, 7) };
  }, [db, usuario, estacionFiltro, periodo, c]);

  const alertas = useMemo(() => calcularAlertas(db, usuario, estacionFiltro), [db, usuario, estacionFiltro]);
  const hallazgos = db.hallazgos.filter((h) => estacionFiltro === 'ALL' || h.estacionId === estacionFiltro);
  const vePresupuesto = puedeVerModulo(db, usuario, 'presupuestos');
  const veHallazgos = puedeVerModulo(db, usuario, 'hallazgos');
  const veAlertas = puedeVerModulo(db, usuario, 'alertas');

  return (
    <div>
      <PageHeader
        title="Tablero de gastos"
        description={`${periodoLabel(periodo)}, datos al ${fecha(db.config.fechaCorte)}. Incluye gastos por autorizar, aprobados y pagados.`}
        actions={
          tiene(db, usuario, 'registrar') && (
            <Link to="/gastos/nuevo" className="inline-flex items-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
              + Registrar gasto
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Gasto del mes"
          value={qk(d.total)}
          hint={d.ventas > 0 ? `${pct((d.total / d.ventas) * 100)} de ventas (${qk(d.ventas)})` : `${d.mes.length} gastos`}
        />
        {vePresupuesto && (
          <Stat
            label="Presupuesto usado"
            value={d.presTotal ? pct((d.usado / d.presTotal) * 100, 0) : '—'}
            hint={`${qk(d.usado)} de ${qk(d.presTotal)}`}
            tone={d.usado > d.presTotal ? 'red' : d.usado / Math.max(1, d.presTotal) >= 0.9 ? 'amber' : undefined}
          />
        )}
        <Stat label="Por autorizar" value={d.pendientes.length} hint={q(sumar(d.pendientes, (g) => g.monto))} tone={d.pendientes.length ? 'amber' : undefined} />
        <Stat
          label="Por pagar"
          value={qk(sumar(d.porPagar, (g) => g.monto))}
          hint={`${d.vencen.length} vencen en ${db.config.diasAlertaVencimiento} días o menos`}
        />
        <Stat
          label="Pérdidas tomadas de reportes"
          value={qk(sumar(d.perdidas, (g) => g.monto))}
          hint="Merma, descuentos y venta bajo costo"
          tone={d.perdidas.length ? 'red' : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Gasto por categoría" subtitle={periodoLabel(periodo)}>
          <BarList
            items={d.porCat.map((x) => ({ ...x, sub: d.total ? pct((x.value / d.total) * 100, 0) : '' }))}
            format={q}
            onClick={(k) => nav(`/gastos?categoria=${k}`)}
          />
        </Card>
        {vePresupuesto && (
          <Card title="Presupuesto contra gasto por estación" subtitle="El gasto incluye lo que está por autorizar">
            <GroupedBars series={['Presupuesto', 'Gasto']} rows={d.porEst} format={qk} />
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Gasto diario" subtitle={`1 al ${Number(db.config.fechaCorte.slice(8))} de ${(periodoLabel(periodo).split(' ')[0] ?? '').toLowerCase()}`} className="lg:col-span-2">
          <Columns data={d.dias} format={q} />
        </Card>
        <Card
          title="Alertas"
          subtitle={`${alertas.length} activas`}
          className="lg:col-span-3"
          actions={
            veAlertas && (
              <Link to="/alertas" className="text-xs font-medium text-brand-600 dark:text-brand-300 hover:underline">
                Ver todas
              </Link>
            )
          }
        >
          {alertas.length === 0 && <Empty>Sin alertas activas.</Empty>}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {alertas.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <SeveridadBadge s={a.severidad} />
                <Link to={a.ruta} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{a.titulo}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{a.detalle}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {veHallazgos && (
      <Card
        className="mt-4"
        title="Hallazgos de los reportes del sistema de la estación"
        subtitle="Riesgos detectados al analizar tickets, facturación, cierres, mermas y compras. No se suman: se traslapan."
        actions={
          <Link to="/hallazgos" className="text-xs font-medium text-brand-600 dark:text-brand-300 hover:underline">
            Ver hallazgos
          </Link>
        }
      >
        {hallazgos.length === 0 && <Empty>Todavía no hay hallazgos registrados.</Empty>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {hallazgos.slice(0, 4).map((h) => (
            <div key={h.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <SeveridadBadge s={h.severidad} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{h.fuente}</span>
              </div>
              <p className="tabular-nums mt-2 text-lg font-semibold text-slate-900 dark:text-white">{q(h.monto)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{h.titulo}</p>
            </div>
          ))}
        </div>
      </Card>
      )}

      <Card
        className="mt-4"
        title="Últimos movimientos"
        actions={
          <Link to="/gastos" className="text-xs font-medium text-brand-600 dark:text-brand-300 hover:underline">
            Ver registro
          </Link>
        }
      >
        {d.recientes.length === 0 ? (
          <Empty>Todavía no hay gastos registrados.</Empty>
        ) : (
          <TableWrap minWidth={720}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Folio</th>
                <th className={th}>Fecha</th>
                <th className={th}>Estación</th>
                <th className={th}>Descripción</th>
                <th className={th}>Estado</th>
                <th className={thR}>Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.recientes.map((g) => (
                <tr key={g.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => nav(rutaGasto(g.id))}>
                  <td className={cx(td, `whitespace-nowrap font-medium text-brand-700 dark:text-brand-300`)}>{g.folio}</td>
                  <td className={cx(td, `whitespace-nowrap`)}>{fecha(g.fecha)}</td>
                  <td className={td}>{c.estCodigo(g.estacionId)}</td>
                  <td className={cx(td, `max-w-xs truncate`)}>{g.descripcion}</td>
                  <td className={td}>
                    <EstadoBadge estado={g.estado} />
                  </td>
                  <td className={tdR}>{q(g.monto)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
