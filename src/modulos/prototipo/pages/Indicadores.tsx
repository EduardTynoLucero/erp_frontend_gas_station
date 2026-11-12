'use client';

import { useMemo } from 'react';
import { Link, rutaGasto } from '../lib/router';
import { Badge, BarList, Card, cx, Empty, PageHeader, SERIES, Stat, TableWrap, td, tdR, th, thR } from '../components/ui';
import { agrupar, pct, periodoDe, periodoLabel, q, qk, sumar } from '../lib/format';
import { useCatalogos, useStore } from '../lib/store';
import { ejecucionPresupuesto, ESTACION_CENTRAL, estacionesEnFiltro, esVigente, gastosInusuales, gastosVisibles, ventasDe } from '../lib/selectors';

export default function Indicadores() {
  const { db, usuario, estacionFiltro } = useStore();
  const c = useCatalogos();
  const periodo = db.config.periodoActual;

  const d = useMemo(() => {
    const ids = estacionesEnFiltro(db, usuario, estacionFiltro).filter((id) => id !== ESTACION_CENTRAL);
    const mes = gastosVisibles(db, usuario, estacionFiltro).filter((g) => periodoDe(g.fecha) === periodo && esVigente(g));
    const porEst = ids.map((id) => {
      const gasto = sumar(mes.filter((g) => g.estacionId === id), (g) => g.monto);
      const ventas = ventasDe(db, periodo, [id]);
      return { id, gasto, ventas, ratio: ventas ? (gasto / ventas) * 100 : 0 };
    });
    const matriz = db.categorias
      .map((cat) => ({
        cat,
        valores: ids.map((id) => {
          const v = ventasDe(db, periodo, [id]);
          const g = sumar(mes.filter((x) => x.estacionId === id && x.categoriaId === cat.id), (x) => x.monto);
          return v ? (g / v) * 1000 : 0;
        }),
      }))
      .filter((f) => f.valores.some((v) => v > 0));
    const desv = [...agrupar(ejecucionPresupuesto(db, periodo, ids), (f) => f.categoriaId)]
      .map(([cat, fs]) => {
        const p = sumar(fs, (f) => f.presupuesto);
        const u = sumar(fs, (f) => f.ejecutado + f.comprometido);
        return { cat, p, u, dif: u - p };
      })
      .sort((a, b) => b.dif - a.dif);
    const prov = [...agrupar(mes.filter((g) => g.proveedorId), (g) => g.proveedorId!)]
      .map(([k, xs]) => ({ key: k, label: c.provNombre(k), value: sumar(xs, (g) => g.monto) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const perdidas = gastosVisibles(db, usuario, estacionFiltro).filter((g) => g.origen === 'reporte' && g.categoriaId !== 'FIN' && esVigente(g));
    return { ids, porEst, matriz, desv, prov, perdidas, inusuales: gastosInusuales(db, mes), total: sumar(mes, (g) => g.monto) };
  }, [db, usuario, estacionFiltro, periodo, c]);

  const ventasTot = sumar(d.porEst, (x) => x.ventas);

  return (
    <div>
      <PageHeader
        title="Indicadores gerenciales"
        description={`Comparación entre estaciones, desviaciones de presupuesto y gastos fuera de lo normal. ${periodoLabel(periodo)} al corte del ${Number(db.config.fechaCorte.slice(8))}.`}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gasto sobre ventas" value={ventasTot ? pct((sumar(d.porEst, (x) => x.gasto) / ventasTot) * 100, 2) : '—'} hint={`${qk(sumar(d.porEst, (x) => x.gasto))} de ${qk(ventasTot)} vendidos`} />
        <Stat label="Pérdidas tomadas de reportes" value={q(sumar(d.perdidas, (g) => g.monto))} hint="Merma, descuento a cuenta genérica y venta bajo costo" tone={d.perdidas.length ? 'red' : undefined} />
        <Stat label="Gastos fuera de lo normal" value={d.inusuales.length} hint="Ver lista abajo" tone={d.inusuales.length ? 'amber' : undefined} />
        <Stat label="Categorías sobre presupuesto" value={d.desv.filter((x) => x.p > 0 && x.dif > 0).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Gasto sobre ventas por estación" subtitle="Ventas de los cierres de caja">
          <BarList
            format={(n) => pct(n, 2)}
            color={SERIES[1]}
            items={d.porEst
              .filter((x) => x.ventas > 0)
              .map((x) => ({ key: x.id, label: `${c.estCodigo(x.id)} · ${c.estacion(x.id)?.nombre}`, value: x.ratio, sub: qk(x.gasto) }))}
          />
        </Card>
        <Card title="Principales proveedores del mes">
          <BarList format={q} items={d.prov} />
        </Card>
      </div>

      <Card className="mt-4" title="Gasto por cada Q1,000 vendidos, por categoría" subtitle="Permite comparar estaciones de distinto tamaño. Resaltado: la estación que más gasta en esa categoría.">
        {d.matriz.length === 0 ? (
          <Empty>Se calcula cuando hay gastos y ventas del periodo.</Empty>
        ) : (
          <TableWrap minWidth={560}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Categoría</th>
                {d.ids.map((id) => (
                  <th key={id} className={thR}>
                    {c.estCodigo(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.matriz.map(({ cat, valores }) => {
                const max = Math.max(...valores);
                return (
                  <tr key={cat.id}>
                    <td className={td}>{cat.nombre}</td>
                    {valores.map((v, i) => (
                      <td key={i} className={cx(tdR, `${v === max && v > 0 && valores.length > 1 ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`)}>
                        {v ? `Q${v.toFixed(2)}` : '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Desviación contra presupuesto" subtitle="Usado (ejecutado + por autorizar) menos presupuesto">
          {d.desv.length === 0 ? (
            <Empty>Todavía no hay presupuestos ni gastos del periodo.</Empty>
          ) : (
            <TableWrap minWidth={460}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className={th}>Categoría</th>
                  <th className={thR}>Presupuesto</th>
                  <th className={thR}>Usado</th>
                  <th className={thR}>Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.desv.map((x) => (
                  <tr key={x.cat}>
                    <td className={td}>{c.catNombre(x.cat)}</td>
                    <td className={tdR}>{x.p ? q(x.p) : '—'}</td>
                    <td className={tdR}>{q(x.u)}</td>
                    <td className={cx(tdR, `${x.dif > 0 ? 'font-medium text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`)}>
                      {x.dif > 0 ? '+' : ''}
                      {q(x.dif)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
        <Card title="Gastos fuera de lo normal" subtitle="Pérdidas de los reportes y montos mayores al doble de lo habitual">
          {d.inusuales.length === 0 && <Empty>Ningún gasto fuera de lo normal.</Empty>}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {d.inusuales.slice(0, 10).map(({ g, motivo }) => (
              <li key={g.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                <div className="min-w-0">
                  <Link to={rutaGasto(g.id)} className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100 hover:underline">
                    {g.folio} · {g.descripcion}
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.estCodigo(g.estacionId)} · {motivo}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums text-sm font-medium">{q(g.monto)}</p>
                  {g.origen === 'reporte' && <Badge tone="violet">Reporte</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
