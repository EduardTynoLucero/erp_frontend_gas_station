'use client';

import { useState } from 'react';
import { Badge, Button, Card, cx, Field, inputCls, Modal, PageHeader, Stat, TableWrap, td, tdR, th, thR } from '../components/ui';
import { MESES_FRECUENCIA } from '../lib/acciones';
import { diasEntre, fecha, q, sumar } from '../lib/format';
import { estacionesVisibles, puedeRegistrar, tiene, veEstacion } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import type { Recurrente } from '../types';

export default function Recurrentes() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const [horizonte, setHorizonte] = useState(7);
  const [form, setForm] = useState<Recurrente | null>(null);
  const administra = tiene(db, usuario, 'catalogos');
  const hoy = db.config.hoy;
  const filas = db.recurrentes
    .filter((r) => veEstacion(db, usuario, r.estacionId) && (estacionFiltro === 'ALL' || r.estacionId === estacionFiltro))
    .sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha) || a.estacionId.localeCompare(b.estacionId));
  const proximos = filas.filter((r) => r.activo && diasEntre(hoy, r.proximaFecha) <= horizonte && puedeRegistrar(db, usuario, r.estacionId).ok);

  const generarProximos = () => acciones.generarRecurrentes(proximos.map((r) => r.id));
  const estaciones = estacionesVisibles(db, usuario);
  const nueva = (): Recurrente => {
    const est = estaciones.find((e) => e.id === estacionFiltro) ?? estaciones[0];
    const cat = db.categorias[0];
    return {
      id: '',
      nombre: '',
      estacionId: est?.id ?? '',
      centroCostoId: db.centrosCosto.find((x) => x.estacionId === est?.id)?.id ?? '',
      categoriaId: cat?.id ?? '',
      subcategoria: cat?.subcategorias[0] ?? '',
      proveedorId: '',
      monto: 0,
      frecuencia: 'Mensual',
      diaPago: 1,
      proximaFecha: hoy,
      activo: true,
    };
  };
  const guardar = async () => {
    if (form && (await acciones.guardarRecurrente(form))) setForm(null);
  };

  return (
    <div>
      <PageHeader
        title="Gastos recurrentes"
        description="Plantillas de gastos periódicos: energía, agua, internet, vigilancia, monitoreo, cuota de marca, seguros y servicios de oficina central. Al generar, el gasto entra a autorización y la plantilla avanza al siguiente periodo."
        actions={administra && <Button onClick={() => setForm(nueva())}>+ Nueva plantilla</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Plantillas activas" value={filas.filter((r) => r.activo).length} />
        <Stat label="Compromiso mensual" value={q(sumar(filas.filter((r) => r.activo), (r) => r.monto))} />
        <Stat label={`Tocan en ${horizonte} días`} value={proximos.length} hint={q(sumar(proximos, (r) => r.monto))} tone={proximos.length ? 'amber' : undefined} />
        <div className="flex flex-col justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <select className={`${inputCls} py-1.5`} value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))} aria-label="Horizonte">
            <option value={7}>Próximos 7 días</option>
            <option value={15}>Próximos 15 días</option>
            <option value={31}>Próximos 31 días</option>
          </select>
          <Button disabled={!proximos.length} onClick={generarProximos}>
            Generar {proximos.length || ''}
          </Button>
        </div>
      </div>

      <Card>
        <TableWrap minWidth={900}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>Gasto</th>
              <th className={th}>Estación</th>
              <th className={th}>Proveedor</th>
              <th className={th}>Próxima fecha</th>
              <th className={th}>Estado</th>
              <th className={thR}>Monto</th>
              <th className={thR}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.map((r) => {
              const d = diasEntre(hoy, r.proximaFecha);
              const puede = puedeRegistrar(db, usuario, r.estacionId).ok;
              return (
                <tr key={r.id} className={r.activo ? '' : 'opacity-60'}>
                  <td className={td}>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{r.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {c.catNombre(r.categoriaId)} · {r.frecuencia}, día {r.diaPago}
                    </p>
                  </td>
                  <td className={td}>{c.estCodigo(r.estacionId)}</td>
                  <td className={cx(td, `max-w-[200px] truncate`)}>{c.provNombre(r.proveedorId)}</td>
                  <td className={cx(td, `whitespace-nowrap`)}>
                    {fecha(r.proximaFecha)}
                    {r.activo && d <= horizonte && <Badge tone={d < 0 ? 'red' : 'amber'} className="ml-1">{d < 0 ? 'Atrasado' : d === 0 ? 'Hoy' : `${d} d`}</Badge>}
                  </td>
                  <td className={td}>{r.activo ? <Badge tone="green">Activa</Badge> : <Badge>Pausada</Badge>}</td>
                  <td className={tdR}>{q(r.monto)}</td>
                  <td className={tdR}>
                    <span className="inline-flex gap-1">
                      {administra && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setForm({ ...r })}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => acciones.toggleRecurrente(r.id)}>
                            {r.activo ? 'Pausar' : 'Activar'}
                          </Button>
                        </>
                      )}
                      {puede && r.activo && (
                        <Button size="sm" variant="secondary" onClick={() => acciones.generarRecurrentes([r.id])}>
                          Generar
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar ${form.nombre}` : 'Nueva plantilla de gasto recurrente'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>Guardar</Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del gasto" className="sm:col-span-2">
              <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Energía eléctrica" />
            </Field>
            <Field label="Estación">
              <select
                className={inputCls}
                value={form.estacionId}
                onChange={(e) => setForm({ ...form, estacionId: e.target.value, centroCostoId: db.centrosCosto.find((x) => x.estacionId === e.target.value)?.id ?? '' })}
              >
                {estaciones.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Centro de costo">
              <select className={inputCls} value={form.centroCostoId} onChange={(e) => setForm({ ...form, centroCostoId: e.target.value })}>
                {db.centrosCosto
                  .filter((x) => x.estacionId === form.estacionId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Categoría">
              <select
                className={inputCls}
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value, subcategoria: db.categorias.find((x) => x.id === e.target.value)?.subcategorias[0] ?? '' })}
              >
                {db.categorias.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subcategoría">
              <select className={inputCls} value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })}>
                {db.categorias
                  .find((x) => x.id === form.categoriaId)
                  ?.subcategorias.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Proveedor" className="sm:col-span-2">
              <select className={inputCls} value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                <option value="">Sin proveedor</option>
                {db.proveedores
                  .filter((p) => p.activo || p.id === form.proveedorId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Monto">
              <input type="number" min="0" step="0.01" className={`${inputCls} tabular-nums`} value={form.monto || ''} onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })} />
            </Field>
            <Field label="Frecuencia">
              <select className={inputCls} value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
                {Object.keys(MESES_FRECUENCIA).map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Próxima fecha">
              <input type="date" className={inputCls} value={form.proximaFecha} onChange={(e) => setForm({ ...form, proximaFecha: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
