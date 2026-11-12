'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, cx, Field, inputCls, PageHeader, ProgressBar, TableWrap, td, tdR, th, thR } from '../components/ui';
import { agrupar, pct, periodoLabel, q, sumar, sumarMeses } from '../lib/format';
import { tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { ejecucionPresupuesto, estacionesEnFiltro, periodosDisponibles } from '../lib/selectors';

export default function Presupuestos() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const [periodo, setPeriodo] = useState(db.config.periodoActual);
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [nuevo, setNuevo] = useState({ estacionId: '', categoriaId: 'ADM', monto: '' });
  const puedeEditar = tiene(db, usuario, 'presupuestos');

  const estaciones = estacionesEnFiltro(db, usuario, estacionFiltro);
  const filas = useMemo(() => ejecucionPresupuesto(db, periodo, estaciones), [db, periodo, estaciones]);
  const porEst = agrupar(filas, (f) => f.estacionId);
  const tot = {
    presupuesto: sumar(filas, (f) => f.presupuesto),
    usado: sumar(filas, (f) => f.ejecutado + f.comprometido),
  };

  const guardar = async (estacionId: string, categoriaId: string) => {
    if (await acciones.guardarPresupuesto(periodo, estacionId, categoriaId, Number(valor))) setEditando(null);
  };
  const periodos = [...new Set([...periodosDisponibles(db), ...db.presupuestos.map((p) => p.periodo), db.config.periodoActual])].sort();
  const siguiente = sumarMeses(`${periodo}-01`, 1).slice(0, 7);
  const copiar = async () => {
    if (await acciones.copiarPresupuestos(periodo, siguiente)) setPeriodo(siguiente);
  };

  return (
    <div>
      <PageHeader
        title="Presupuestos y límites"
        description={`Presupuesto mensual por estación y categoría. Ejecutado = aprobado o pagado; comprometido = por autorizar. Alerta al ${db.config.alertaPresupuestoPct} %.`}
        actions={
          <>
            {puedeEditar && (
              <Button variant="secondary" onClick={copiar} title="Copia las líneas que falten en el mes siguiente">
                Copiar a {periodoLabel(siguiente).toLowerCase()}
              </Button>
            )}
            <select className={`${inputCls} w-44`} value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {periodoLabel(p)}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {estaciones.map((id) => {
          const f = porEst.get(id) ?? [];
          const p = sumar(f, (x) => x.presupuesto);
          const u = sumar(f, (x) => x.ejecutado + x.comprometido);
          const pc = p ? (u / p) * 100 : 0;
          return (
            <div key={id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.estCodigo(id)}</p>
                <span className="tabular-nums text-sm text-slate-600 dark:text-slate-300">{p ? pct(pc, 0) : '—'}</span>
              </div>
              <p className="mb-2 truncate text-xs text-slate-500 dark:text-slate-400">{c.estacion(id)?.nombre}</p>
              <ProgressBar pct={pc} warnAt={db.config.alertaPresupuestoPct} />
              <p className="tabular-nums mt-2 text-xs text-slate-500 dark:text-slate-400">
                {q(u)} de {q(p)}
              </p>
            </div>
          );
        })}
      </div>

      <Card
        title={`Detalle por categoría · ${periodoLabel(periodo)}`}
        subtitle={`Total ${q(tot.usado)} usado de ${q(tot.presupuesto)}`}
      >
        <TableWrap minWidth={860}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>Estación</th>
              <th className={th}>Categoría</th>
              <th className={thR}>Presupuesto</th>
              <th className={thR}>Ejecutado</th>
              <th className={thR}>Comprometido</th>
              <th className={thR}>Disponible</th>
              <th className={cx(th, `w-40`)}>Uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.map((f) => {
              const key = `${f.estacionId}-${f.categoriaId}`;
              return (
                <tr key={key}>
                  <td className={td}>{c.estCodigo(f.estacionId)}</td>
                  <td className={td}>{c.catNombre(f.categoriaId)}</td>
                  <td className={tdR}>
                    {editando === key ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          type="number"
                          className={`${inputCls} tabular-nums w-28 py-1 text-right`}
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardar(f.estacionId, f.categoriaId);
                            if (e.key === 'Escape') setEditando(null);
                          }}
                        />
                        <Button size="sm" onClick={() => guardar(f.estacionId, f.categoriaId)}>
                          OK
                        </Button>
                      </span>
                    ) : (
                      <button
                        className={puedeEditar ? 'tabular-nums rounded px-1 hover:bg-brand-50 dark:hover:bg-brand-500/15 hover:text-brand-700 dark:hover:text-brand-200' : 'tabular-nums cursor-default'}
                        onClick={() => {
                          if (!puedeEditar) return;
                          setEditando(key);
                          setValor(String(f.presupuesto));
                        }}
                        title={puedeEditar ? 'Clic para editar' : undefined}
                      >
                        {f.presupuesto ? q(f.presupuesto) : <Badge tone="amber">Sin presupuesto</Badge>}
                      </button>
                    )}
                  </td>
                  <td className={tdR}>{q(f.ejecutado)}</td>
                  <td className={tdR}>{f.comprometido ? q(f.comprometido) : '—'}</td>
                  <td className={cx(tdR, `${f.disponible < 0 ? 'font-medium text-red-700 dark:text-red-400' : ''}`)}>{q(f.disponible)}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={f.pct} warnAt={db.config.alertaPresupuestoPct} />
                      <span className="tabular-nums w-12 shrink-0 text-right text-xs text-slate-600 dark:text-slate-300">{isFinite(f.pct) ? pct(f.pct, 0) : '—'}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Card>

      {puedeEditar && (
        <Card className="mt-4" title="Asignar presupuesto" subtitle="Para una categoría que aún no tiene monto en el periodo">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Estación">
              <select className={inputCls} value={nuevo.estacionId} onChange={(e) => setNuevo({ ...nuevo, estacionId: e.target.value })}>
                <option value="">Seleccione…</option>
                {estaciones.map((id) => (
                  <option key={id} value={id}>
                    {c.estCodigo(id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoría">
              <select className={inputCls} value={nuevo.categoriaId} onChange={(e) => setNuevo({ ...nuevo, categoriaId: e.target.value })}>
                {db.categorias.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monto mensual">
              <input type="number" className={`${inputCls} tabular-nums`} value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!nuevo.estacionId || !nuevo.monto}
                onClick={async () => {
                  if (await acciones.guardarPresupuesto(periodo, nuevo.estacionId, nuevo.categoriaId, Number(nuevo.monto))) setNuevo({ ...nuevo, monto: '' });
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
