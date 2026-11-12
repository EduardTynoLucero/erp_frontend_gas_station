'use client';

import { useState } from 'react';
import { Badge, Button, Card, Field, inputCls, Modal, PageHeader } from '../components/ui';
import type { DatosEstacion } from '../lib/acciones';
import { fecha, pct, periodoDe, periodoLabel, q, sumar } from '../lib/format';
import { estacionesVisibles, tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { esVigente, ventasDe } from '../lib/selectors';

export default function Estaciones() {
  const { db, usuario, acciones } = useStore();
  const c = useCatalogos();
  const edita = tiene(db, usuario, 'configurar');
  const [form, setForm] = useState<DatosEstacion | null>(null);
  const guardar = async () => {
    if (form && (await acciones.guardarEstacion(form))) setForm(null);
  };
  const periodo = db.config.periodoActual;
  const e = db.empresa;

  return (
    <div>
      <PageHeader
        title="Empresas y estaciones"
        description="Estructura de la franquicia: empresa, estaciones y unidades de negocio."
        actions={
          edita && (
            <Button onClick={() => setForm({ id: '', codigo: '', nombre: '', direccion: '', gerenteId: usuario.id, unidades: ['COMB', 'ADMIN'], activa: true, fondoCaja: 2000 })}>
              + Nueva estación
            </Button>
          )
        }
      />
      <Card title="Empresa">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Razón social</dt>
            <dd className="font-medium text-slate-900 dark:text-white">{e.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">NIT</dt>
            <dd className="text-slate-800 dark:text-slate-100">{e.nit}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Franquicia</dt>
            <dd className="text-slate-800 dark:text-slate-100">{e.franquicia}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Periodo abierto</dt>
            <dd className="text-slate-800 dark:text-slate-100">
              {periodoLabel(e.periodoActual)} · {e.moneda}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {estacionesVisibles(db, usuario).map((est) => {
          const gastos = sumar(
            db.gastos.filter((g) => g.estacionId === est.id && periodoDe(g.fecha) === periodo && esVigente(g)),
            (g) => g.monto,
          );
          const ventas = ventasDe(db, periodo, [est.id]);
          const turnos = db.ventas.filter((v) => v.estacionId === est.id && v.turno);
          return (
            <Card
              key={est.id}
              title={
                <span className="flex items-center gap-2">
                  {est.codigo} · {est.nombre}
                  {est.demo && <Badge tone="violet">Ejemplo</Badge>}
                  {!est.activa && <Badge>Inactiva</Badge>}
                </span>
              }
              subtitle={est.direccion}
              actions={
                edita && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ id: est.id, codigo: est.codigo, nombre: est.nombre, direccion: est.direccion, gerenteId: est.gerenteId, unidades: [...est.unidades], activa: est.activa })}
                  >
                    Editar
                  </Button>
                )
              }
            >
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Responsable</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{c.usrNombre(est.gerenteId)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Gasto del mes</dt>
                  <dd className="tabular-nums font-medium text-slate-900 dark:text-white">{q(gastos)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Ventas del mes</dt>
                  <dd className="tabular-nums text-slate-800 dark:text-slate-100">{ventas ? q(ventas) : 'No aplica'}</dd>
                </div>
                {ventas > 0 && (
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Gasto sobre ventas</dt>
                    <dd className="tabular-nums text-slate-800 dark:text-slate-100">{pct((gastos / ventas) * 100, 2)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Centros de costo</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{db.centrosCosto.filter((x) => x.estacionId === est.id).length}</dd>
                </div>
                {turnos.length > 0 && (
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Turnos importados</dt>
                    <dd className="text-slate-800 dark:text-slate-100">
                      {turnos[0]!.turno}–{turnos[turnos.length - 1]!.turno}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {est.unidades.map((u) => (
                  <Badge key={u} tone="blue">
                    {c.uniNombre(u)}
                  </Badge>
                ))}
              </div>
              {!est.demo && ventas > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Ventas tomadas de los cierres de caja al {fecha(db.config.fechaCorte)}.</p>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar ${form.codigo}` : 'Nueva estación'}
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
            <Field label="Código" hint="2 a 8 letras o números; se usa en los centros de costo">
              <input className={`${inputCls} uppercase`} disabled={!!form.id} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Responsable">
              <select className={inputCls} value={form.gerenteId} onChange={(e) => setForm({ ...form, gerenteId: e.target.value })}>
                {db.usuarios
                  .filter((u) => u.activo)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Nombre" className="sm:col-span-2">
              <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Field>
            <Field label="Dirección" className="sm:col-span-2">
              <input className={inputCls} value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Unidades de negocio (se crea un centro de costo por cada una)</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {db.unidades.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                      checked={form.unidades.includes(u.id)}
                      onChange={(e) => setForm({ ...form, unidades: e.target.checked ? [...form.unidades, u.id] : form.unidades.filter((x) => x !== u.id) })}
                    />
                    {u.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
            {!form.id ? (
              <Field label="Fondo de caja chica (Q)" hint="0 si no tendrá caja chica">
                <input type="number" min="0" className={`${inputCls} tabular-nums`} value={form.fondoCaja ?? 0} onChange={(e) => setForm({ ...form, fondoCaja: Number(e.target.value) })} />
              </Field>
            ) : (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 dark:border-slate-700" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
                Activa
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
