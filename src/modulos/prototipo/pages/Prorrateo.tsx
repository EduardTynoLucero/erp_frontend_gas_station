'use client';

import { useState } from 'react';
import { Link, rutaGasto } from '../lib/router';
import { Aviso, Badge, Button, Card, cx, GroupedBars, inputCls, PageHeader, TableWrap, td, tdR, th, thR } from '../components/ui';
import { pct, periodoDe, periodoLabel, q, qk, sumar } from '../lib/format';
import { tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { ESTACION_CENTRAL, esVigente, pesosProrrateo, periodosDisponibles, ventasDe } from '../lib/selectors';
import type { Config } from '../types';

export default function Prorrateo() {
  const { db, usuario, acciones } = useStore();
  const c = useCatalogos();
  const [periodo, setPeriodo] = useState(db.config.periodoActual);
  const [criterio, setCriterio] = useState<Config['criterioProrrateo']>(db.config.criterioProrrateo);
  const puede = tiene(db, usuario, 'presupuestos');

  const centrales = db.gastos.filter((g) => g.estacionId === ESTACION_CENTRAL && periodoDe(g.fecha) === periodo && g.estado !== 'rechazado');
  const total = sumar(centrales, (g) => g.monto);
  const aplicado = centrales.length > 0 && centrales.every((g) => g.distribucion?.length);
  const pesos = pesosProrrateo(db, periodo, criterio);
  const sinVentas = criterio === 'ventas' && pesos.every((p) => p.base === 1);

  const impacto = pesos.map((p) => {
    const propio = sumar(
      db.gastos.filter((g) => g.estacionId === p.estacionId && periodoDe(g.fecha) === periodo && esVigente(g)),
      (g) => g.monto,
    );
    const asignado = (total * p.pct) / 100;
    const ventas = ventasDe(db, periodo, [p.estacionId]);
    return { ...p, propio, asignado, ventas };
  });

  return (
    <div>
      <PageHeader
        title="Prorrateo de gastos compartidos"
        description="Reparte los gastos de oficina central (contabilidad, sistema administrativo) entre las estaciones que se benefician, según sus ventas o en partes iguales."
        actions={
          <select className={`${inputCls} w-44`} value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
            {periodosDisponibles(db).map((p) => (
              <option key={p} value={p}>
                {periodoLabel(p)}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Gastos de oficina central" subtitle={`${centrales.length} gastos · ${q(total)}`} actions={aplicado ? <Badge tone="green">Prorrateo aplicado</Badge> : <Badge>Sin aplicar</Badge>}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {centrales.map((g) => (
              <li key={g.id} className="flex justify-between gap-2 py-2 first:pt-0">
                <Link to={rutaGasto(g.id)} className="min-w-0 truncate text-slate-700 dark:text-slate-200 hover:underline">
                  {g.descripcion}
                </Link>
                <span className="tabular-nums shrink-0">{q(g.monto)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2" title="Criterio de reparto">
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ['ventas', 'Según ventas del mes'],
                ['partes_iguales', 'Partes iguales'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCriterio(k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${criterio === k ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 ring-brand-500' : 'text-slate-600 dark:text-slate-300 ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
              >
                {l}
              </button>
            ))}
          </div>
          {sinVentas && (
            <div className="mb-3">
              <Aviso tone="amber">No hay ventas importadas para {periodoLabel(periodo).toLowerCase()}; se reparte en partes iguales.</Aviso>
            </div>
          )}
          <TableWrap minWidth={620}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Estación</th>
                <th className={thR}>Ventas</th>
                <th className={thR}>Peso</th>
                <th className={thR}>Asignado</th>
                <th className={thR}>Gasto propio</th>
                <th className={thR}>Gasto total / ventas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {impacto.map((x) => (
                <tr key={x.estacionId}>
                  <td className={td}>
                    {c.estCodigo(x.estacionId)} <span className="text-xs text-slate-500 dark:text-slate-400">{c.estacion(x.estacionId)?.nombre}</span>
                  </td>
                  <td className={tdR}>{x.ventas ? qk(x.ventas) : '—'}</td>
                  <td className={tdR}>{pct(x.pct)}</td>
                  <td className={cx(tdR, `font-medium`)}>{q(x.asignado)}</td>
                  <td className={tdR}>{q(x.propio)}</td>
                  <td className={tdR}>{x.ventas ? pct(((x.propio + x.asignado) / x.ventas) * 100, 2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {aplicado && (
              <Button variant="ghost" disabled={!puede} onClick={() => acciones.quitarProrrateo(periodo)}>
                Quitar prorrateo
              </Button>
            )}
            <Button disabled={!puede || !centrales.length} title={puede ? '' : 'Su rol no aplica prorrateos'} onClick={() => acciones.aplicarProrrateo(periodo, criterio)}>
              {aplicado ? 'Volver a aplicar' : 'Aplicar prorrateo'}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Gasto por estación con y sin prorrateo" subtitle="El reporte por estación puede incluir o no la parte de oficina central">
        <GroupedBars
          series={['Gasto propio', 'Con oficina central']}
          format={qk}
          rows={impacto.map((x) => ({
            key: x.estacionId,
            label: `${c.estCodigo(x.estacionId)} · ${c.estacion(x.estacionId)?.nombre}`,
            values: [x.propio, x.propio + x.asignado],
          }))}
        />
      </Card>
    </div>
  );
}
