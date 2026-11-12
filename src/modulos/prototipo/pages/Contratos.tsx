'use client';

import { useState } from 'react';
import { Aviso, Badge, Button, Card, cx, Field, inputCls, Modal, PageHeader, Stat, TableWrap, td, tdR, th, thR } from '../components/ui';
import { diasEntre, fecha, q, sumar, sumarMeses } from '../lib/format';
import { estacionesVisibles, tiene, veEstacion } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import type { Contrato } from '../types';

export default function Contratos() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const hoy = db.config.hoy;
  const edita = tiene(db, usuario, 'catalogos');
  const renueva = tiene(db, usuario, 'aprobar') && tiene(db, usuario, 'ver_todo');
  const [form, setForm] = useState<Contrato | null>(null);
  const guardar = async () => {
    if (form && (await acciones.guardarContrato(form))) setForm(null);
  };
  const nuevo = (): Contrato => ({
    id: '',
    proveedorId: '',
    estacionId: estacionFiltro !== 'ALL' ? estacionFiltro : (estacionesVisibles(db, usuario)[0]?.id ?? ''),
    objeto: '',
    categoriaId: db.categorias[0]?.id ?? '',
    montoMensual: 0,
    inicio: hoy,
    fin: sumarMeses(hoy, 12),
    renovacionAutomatica: false,
    avisoDias: 30,
    documento: '',
  });
  const contratos = db.contratos
    .filter((x) => veEstacion(db, usuario, x.estacionId) && (estacionFiltro === 'ALL' || x.estacionId === estacionFiltro))
    .map((x) => ({ x, dias: diasEntre(hoy, x.fin) }))
    .sort((a, b) => a.dias - b.dias);
  const estado = (dias: number, aviso: number, auto: boolean) =>
    dias < 0 ? (['Vencido', 'red'] as const) : dias <= aviso && !auto ? (['Por vencer', 'amber'] as const) : (['Vigente', 'green'] as const);
  const porVencer = contratos.filter(({ x, dias }) => dias <= x.avisoDias && !x.renovacionAutomatica);

  return (
    <div>
      <PageHeader
        title="Contratos y servicios"
        description="Servicios contratados por estación, con su vencimiento y aviso de renovación."
        actions={edita && <Button onClick={() => setForm(nuevo())}>+ Nuevo contrato</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contratos" value={contratos.length} />
        <Stat label="Compromiso mensual" value={q(sumar(contratos, ({ x }) => x.montoMensual))} />
        <Stat label="Por vencer sin renovación" value={porVencer.length} tone={porVencer.length ? 'amber' : undefined} />
        <Stat label="Con renovación automática" value={contratos.filter(({ x }) => x.renovacionAutomatica).length} />
      </div>
      {porVencer.length > 0 && (
        <div className="mb-4">
          <Aviso tone="amber">
            {porVencer.map(({ x, dias }) => `${x.objeto} (${c.estCodigo(x.estacionId)}) vence en ${dias} días`).join(' · ')}. Decida si renueva o cotiza otro proveedor.
          </Aviso>
        </div>
      )}
      <Card>
        <TableWrap minWidth={960}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>Servicio</th>
              <th className={th}>Proveedor</th>
              <th className={th}>Estación</th>
              <th className={th}>Vigencia</th>
              <th className={th}>Estado</th>
              <th className={thR}>Mensual</th>
              <th className={thR}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {contratos.map(({ x, dias }) => {
              const [txt, tone] = estado(dias, x.avisoDias, x.renovacionAutomatica);
              return (
                <tr key={x.id}>
                  <td className={td}>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{x.objeto}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {x.id} · {c.catNombre(x.categoriaId)} · {x.documento}
                    </p>
                  </td>
                  <td className={cx(td, `max-w-[200px] truncate`)}>{c.provNombre(x.proveedorId)}</td>
                  <td className={td}>{c.estCodigo(x.estacionId)}</td>
                  <td className={cx(td, `whitespace-nowrap`)}>
                    {fecha(x.inicio)} – {fecha(x.fin)}
                    <p className="text-xs text-slate-500 dark:text-slate-400">{x.renovacionAutomatica ? 'Renovación automática' : `Aviso ${x.avisoDias} días antes`}</p>
                  </td>
                  <td className={td}>
                    <Badge tone={tone}>{txt}</Badge>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{dias >= 0 ? `${dias} días` : `hace ${-dias} días`}</p>
                  </td>
                  <td className={tdR}>{q(x.montoMensual)}</td>
                  <td className={tdR}>
                    <span className="inline-flex gap-1">
                      {edita && (
                        <Button size="sm" variant="ghost" onClick={() => setForm({ ...x })}>
                          Editar
                        </Button>
                      )}
                      {renueva && txt !== 'Vigente' && (
                        <Button size="sm" variant="secondary" onClick={() => acciones.renovarContrato(x.id, 12)}>
                          Renovar 12 meses
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
        title={form?.id ? `Editar ${form.id}` : 'Nuevo contrato'}
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
            <Field label="Servicio contratado" className="sm:col-span-2">
              <input className={inputCls} value={form.objeto} onChange={(e) => setForm({ ...form, objeto: e.target.value })} placeholder="Ej. Vigilancia 24 h" />
            </Field>
            <Field label="Proveedor" className="sm:col-span-2">
              <select className={inputCls} value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                <option value="">Seleccione…</option>
                {db.proveedores
                  .filter((p) => p.activo || p.id === form.proveedorId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Estación">
              <select className={inputCls} value={form.estacionId} onChange={(e) => setForm({ ...form, estacionId: e.target.value })}>
                {estacionesVisibles(db, usuario).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoría">
              <select className={inputCls} value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
                {db.categorias.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Inicio">
              <input type="date" className={inputCls} value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </Field>
            <Field label="Fin">
              <input type="date" className={inputCls} value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} />
            </Field>
            <Field label="Monto mensual (Q)">
              <input type="number" min="0" className={`${inputCls} tabular-nums`} value={form.montoMensual || ''} onChange={(e) => setForm({ ...form, montoMensual: Number(e.target.value) })} />
            </Field>
            <Field label="Avisar con (días)">
              <input type="number" min="0" className={`${inputCls} tabular-nums`} value={form.avisoDias} onChange={(e) => setForm({ ...form, avisoDias: Number(e.target.value) })} />
            </Field>
            <Field label="Documento" hint="Nombre del archivo o ubicación física" className="sm:col-span-2">
              <input className={inputCls} value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                checked={form.renovacionAutomatica}
                onChange={(e) => setForm({ ...form, renovacionAutomatica: e.target.checked })}
              />
              Se renueva automáticamente
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
