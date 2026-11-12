'use client';

import { useMemo, useState } from 'react';
import { Button, Card, cx, Field, inputCls, PageHeader, TableWrap, td, tdR, th, thR } from '../components/ui';
import { descargarCSV, pct, periodoDe, periodoLabel, q, sumar } from '../lib/format';
import { useCatalogos, useStore } from '../lib/store';
import { esVigente, gastosVisibles, lineasPorEstacion, periodosDisponibles, type Linea } from '../lib/selectors';

type Eje = 'categoria' | 'subcategoria' | 'estacion' | 'proveedor' | 'centro' | 'unidad' | 'metodo' | 'origen';

const EJES: [Eje, string][] = [
  ['categoria', 'Categoría'],
  ['subcategoria', 'Subcategoría'],
  ['estacion', 'Estación'],
  ['proveedor', 'Proveedor'],
  ['centro', 'Centro de costo'],
  ['unidad', 'Unidad de negocio'],
  ['metodo', 'Forma de pago'],
  ['origen', 'Origen del registro'],
];

const ORIGEN: Record<string, string> = {
  manual: 'Manual',
  recurrente: 'Recurrente',
  reporte: 'Desde reportes',
  caja_chica: 'Caja chica',
  compra: 'Compra',
};

export default function Reportes() {
  const { db, usuario, estacionFiltro } = useStore();
  const c = useCatalogos();
  const [eje, setEje] = useState<Eje>('categoria');
  const [periodo, setPeriodo] = useState('');
  const [estados, setEstados] = useState<'vigentes' | 'pagados' | 'ejecutados'>('vigentes');
  const [prorrateo, setProrrateo] = useState(false);
  const periodos = periodosDisponibles(db);
  const cols = periodo ? [periodo] : periodos;

  const clave = (l: Linea): [string, string] => {
    const g = l.g;
    switch (eje) {
      case 'categoria':
        return [g.categoriaId, c.catNombre(g.categoriaId)];
      case 'subcategoria':
        return [`${g.categoriaId}|${g.subcategoria}`, `${g.subcategoria} (${c.catNombre(g.categoriaId)})`];
      case 'estacion':
        return [l.estacionId, `${c.estCodigo(l.estacionId)} · ${c.estacion(l.estacionId)?.nombre ?? ''}`];
      case 'proveedor':
        return [g.proveedorId ?? '-', c.provNombre(g.proveedorId)];
      case 'centro':
        return [g.centroCostoId, c.ccNombre(g.centroCostoId)];
      case 'unidad': {
        const u = c.centro(g.centroCostoId)?.unidad ?? '-';
        return [u, c.uniNombre(u)];
      }
      case 'metodo':
        return [g.metodoPago, g.metodoPago];
      case 'origen':
        return [g.origen, ORIGEN[g.origen] ?? g.origen];
    }
  };

  const { filas, total, totalesCol, n } = useMemo(() => {
    const gs = gastosVisibles(db, usuario, estacionFiltro)
      .filter((g) => !periodo || periodoDe(g.fecha) === periodo)
      .filter((g) => (estados === 'pagados' ? g.estado === 'pagado' : estados === 'ejecutados' ? g.estado === 'aprobado' || g.estado === 'pagado' : esVigente(g)));
    const lineas = lineasPorEstacion(gs, prorrateo);
    const m = new Map<string, { label: string; porMes: Record<string, number>; total: number; n: number }>();
    for (const l of lineas) {
      const [k, label] = clave(l);
      const f = m.get(k) ?? { label, porMes: {}, total: 0, n: 0 };
      const p = periodoDe(l.g.fecha);
      f.porMes[p] = (f.porMes[p] ?? 0) + l.monto;
      f.total += l.monto;
      f.n += 1;
      m.set(k, f);
    }
    const filas = [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.total - a.total);
    const totalesCol = Object.fromEntries(cols.map((p) => [p, sumar(filas, (f) => f.porMes[p] ?? 0)]));
    return { filas, total: sumar(filas, (f) => f.total), totalesCol, n: gs.length };
  }, [db, usuario, estacionFiltro, periodo, estados, prorrateo, eje, c]);

  const max = Math.max(1, ...filas.map((f) => f.total));
  const ejeLabel = EJES.find(([k]) => k === eje)?.[1] ?? '';

  const exportar = () =>
    descargarCSV(`reporte-gastos-por-${eje}.csv`, [
      [ejeLabel, ...cols.map(periodoLabel), 'Total', '% del total', 'Registros'],
      ...filas.map((f) => [f.label, ...cols.map((p) => (f.porMes[p] ?? 0).toFixed(2)), f.total.toFixed(2), ((f.total / total) * 100).toFixed(1), f.n]),
      ['Total', ...cols.map((p) => (totalesCol[p] ?? 0).toFixed(2)), total.toFixed(2), '100', n],
    ]);

  return (
    <div>
      <PageHeader
        title="Reportes de gastos"
        description="Consulte los gastos por fecha, categoría, estación, proveedor, centro de costo o unidad de negocio y expórtelos a Excel (CSV)."
        actions={
          <Button variant="secondary" onClick={exportar}>
            Exportar CSV
          </Button>
        }
      />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Agrupar por">
            <select className={inputCls} value={eje} onChange={(e) => setEje(e.target.value as Eje)}>
              {EJES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mes">
            <select className={inputCls} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="">Comparar meses</option>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {periodoLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Incluir">
            <select className={inputCls} value={estados} onChange={(e) => setEstados(e.target.value as typeof estados)}>
              <option value="vigentes">Por autorizar, aprobados y pagados</option>
              <option value="ejecutados">Aprobados y pagados</option>
              <option value="pagados">Solo pagados</option>
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={prorrateo} onChange={(e) => setProrrateo(e.target.checked)} className="rounded border-slate-300 dark:border-slate-700" />
            Repartir gastos de oficina central (prorrateo aplicado)
          </label>
        </div>
      </Card>

      <Card className="mt-4" title={`Gastos por ${ejeLabel.toLowerCase()}`} subtitle={`${n} registros · ${q(total)}`}>
        <TableWrap minWidth={720}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>{ejeLabel}</th>
              {cols.map((p) => (
                <th key={p} className={thR}>
                  {periodoLabel(p)}
                </th>
              ))}
              {cols.length > 1 && <th className={thR}>Total</th>}
              <th className={cx(th, `w-48`)}>% del total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.map((f) => (
              <tr key={f.key}>
                <td className={cx(td, `max-w-xs truncate`)}>{f.label}</td>
                {cols.map((p) => (
                  <td key={p} className={tdR}>
                    {f.porMes[p] ? q(f.porMes[p]) : '—'}
                  </td>
                ))}
                {cols.length > 1 && <td className={cx(tdR, `font-medium`)}>{q(f.total)}</td>}
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${(f.total / max) * 100}%` }} />
                    </div>
                    <span className="tabular-nums w-12 text-right text-xs text-slate-600 dark:text-slate-300">{pct((f.total / total) * 100)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-800 font-semibold">
              <td className={td}>Total</td>
              {cols.map((p) => (
                <td key={p} className={tdR}>
                  {q(totalesCol[p] ?? 0)}
                </td>
              ))}
              {cols.length > 1 && <td className={tdR}>{q(total)}</td>}
              <td className={td}></td>
            </tr>
          </tfoot>
        </TableWrap>
        {cols.length > 1 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Octubre llega al corte del {Number(db.config.fechaCorte.slice(8))}, así que todavía no es comparable con un mes completo.</p>
        )}
      </Card>
    </div>
  );
}
