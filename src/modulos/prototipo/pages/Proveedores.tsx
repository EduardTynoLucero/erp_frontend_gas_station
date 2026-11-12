'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, cx, Field, inputCls, Modal, PageHeader, TableWrap, td, tdR, th, thR } from '../components/ui';
import { q, sumar } from '../lib/format';
import { esAjusteContable, tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { gastosVisibles } from '../lib/selectors';
import type { Proveedor } from '../types';

const VACIO: Proveedor = {
  id: '',
  nombre: '',
  nit: '',
  tipo: '',
  categoriaId: 'ADM',
  contacto: '',
  telefono: '',
  diasCredito: 0,
  activo: true,
};

export default function Proveedores() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const [texto, setTexto] = useState('');
  const [form, setForm] = useState<Proveedor | null>(null);
  const puede = tiene(db, usuario, 'catalogos');
  const guardar = async () => {
    if (form && (await acciones.guardarProveedor(form))) setForm(null);
  };

  const filas = useMemo(() => {
    const gs = gastosVisibles(db, usuario, estacionFiltro);
    const t = texto.trim().toLowerCase();
    return db.proveedores
      .filter((p) => !t || `${p.nombre} ${p.nit} ${p.tipo}`.toLowerCase().includes(t))
      .map((p) => {
        const mios = gs.filter((g) => g.proveedorId === p.id);
        return {
          p,
          n: mios.length,
          pagado: sumar(
            mios.filter((g) => g.estado === 'pagado'),
            (g) => g.monto,
          ),
          saldo: sumar(
            mios.filter((g) => g.estado === 'aprobado' && !esAjusteContable(g)),
            (g) => g.monto,
          ),
        };
      })
      .sort((a, b) => b.pagado + b.saldo - (a.pagado + a.saldo));
  }, [db, usuario, estacionFiltro, texto]);

  return (
    <div>
      <PageHeader
        title="Proveedores"
        description={`Proveedores de bienes, servicios y mantenimiento. Los marcados con origen vienen de los reportes del sistema de la estación.${puede ? '' : ' Los da de alta Contabilidad, para evitar proveedores ficticios.'}`}
        actions={
          puede && (
            <Button onClick={() => setForm({ ...VACIO })}>+ Nuevo proveedor</Button>
          )
        }
      />
      <Card>
        <input className={`${inputCls} mb-4 sm:max-w-sm`} placeholder="Buscar por nombre, NIT o tipo…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <TableWrap minWidth={940}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>Proveedor</th>
              <th className={th}>NIT</th>
              <th className={th}>Categoría</th>
              <th className={thR}>Crédito</th>
              <th className={thR}>Gastos</th>
              <th className={thR}>Pagado</th>
              <th className={thR}>Por pagar</th>
              <th className={th}>Estado</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.map(({ p, n, pagado, saldo }) => (
              <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                <td className={td}>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{p.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.tipo}
                    {p.fuente && (
                      <Badge tone="violet" className="ml-1">
                        {p.fuente}
                      </Badge>
                    )}
                  </p>
                </td>
                <td className={cx(td, `tabular-nums`)}>{p.nit}</td>
                <td className={td}>{c.catNombre(p.categoriaId)}</td>
                <td className={tdR}>{p.diasCredito ? `${p.diasCredito} días` : 'Contado'}</td>
                <td className={tdR}>{n}</td>
                <td className={tdR}>{q(pagado)}</td>
                <td className={tdR}>{saldo ? q(saldo) : '—'}</td>
                <td className={td}>{p.activo ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                <td className={tdR}>
                  {puede && (
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ ...p })}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => acciones.toggleProveedor(p.id)}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar ${form.nombre}` : 'Nuevo proveedor'}
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
            <Field label="Nombre o razón social" className="sm:col-span-2">
              <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Field>
            <Field label="NIT" hint="Se valida que no esté repetido">
              <input className={inputCls} value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <input className={inputCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Mantenimiento, servicios…" />
            </Field>
            <Field label="Categoría principal">
              <select className={inputCls} value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
                {db.categorias.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Días de crédito">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.diasCredito}
                onChange={(e) => setForm({ ...form, diasCredito: Number(e.target.value) })}
              />
            </Field>
            <Field label="Contacto">
              <input className={inputCls} value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <input className={inputCls} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
