'use client';

import { useMemo, useState } from 'react';
import { Badge, BarList, Button, Card, cx, Field, inputCls, Modal, PageHeader, TableWrap, Tabs, td, tdR, th, thR } from '../components/ui';
import { periodoDe, periodoLabel, q, sumar } from '../lib/format';
import { tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { estacionesEnFiltro, esVigente, gastosVisibles } from '../lib/selectors';
import type { Categoria, CentroCosto } from '../types';

type Tab = 'categorias' | 'centros' | 'unidades';

export default function Catalogos() {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const [tab, setTab] = useState<Tab>('categorias');
  const edita = tiene(db, usuario, 'catalogos');
  const [catForm, setCat] = useState<{ c: Categoria; subs: string; nueva: boolean } | null>(null);
  const [centroForm, setCc] = useState<{ c: CentroCosto; nuevo: boolean } | null>(null);
  const guardarCat = async () => {
    if (catForm && (await acciones.guardarCategoria({ ...catForm.c, subcategorias: catForm.subs.split('\n') }, catForm.nueva))) setCat(null);
  };
  const guardarCc = async () => {
    if (centroForm && (await acciones.guardarCentro(centroForm.c, centroForm.nuevo))) setCc(null);
  };
  const periodo = db.config.periodoActual;

  const mes = useMemo(
    () => gastosVisibles(db, usuario, estacionFiltro).filter((g) => periodoDe(g.fecha) === periodo && esVigente(g)),
    [db, usuario, estacionFiltro, periodo],
  );
  const estaciones = estacionesEnFiltro(db, usuario, estacionFiltro);
  const centros = db.centrosCosto.filter((x) => estaciones.includes(x.estacionId));

  return (
    <div>
      <PageHeader
        title="Catálogos y centros de costo"
        description={`Clasificación de gastos con su cuenta contable, y centros de costo por estación y unidad de negocio. Montos de ${periodoLabel(periodo).toLowerCase()}.`}
        actions={
          edita &&
          (tab === 'categorias' ? (
            <Button onClick={() => setCat({ c: { id: '', nombre: '', descripcion: '', cuentaContable: '', subcategorias: [], activa: true }, subs: '', nueva: true })}>
              + Nueva categoría
            </Button>
          ) : tab === 'centros' ? (
            <Button
              onClick={() =>
                setCc({ c: { id: '', codigo: '', nombre: '', estacionId: estaciones[0] ?? '', unidad: db.unidades[0]?.id ?? '', activo: true }, nuevo: true })
              }
            >
              + Nuevo centro de costo
            </Button>
          ) : null)
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'categorias', label: `Categorías (${db.categorias.length})` },
          { id: 'centros', label: `Centros de costo (${centros.length})` },
          { id: 'unidades', label: 'Unidades de negocio' },
        ]}
      />

      {tab === 'categorias' && (
        <div className="grid gap-3 md:grid-cols-2">
          {db.categorias.map((cat) => {
            const gs = mes.filter((g) => g.categoriaId === cat.id);
            return (
              <Card key={cat.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cuenta {cat.cuentaContable}</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{cat.nombre}</p>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{cat.descripcion}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-semibold text-slate-900 dark:text-white">{q(sumar(gs, (g) => g.monto))}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{gs.length} gastos</p>
                    {!cat.activa && <Badge>Inactiva</Badge>}
                    {edita && (
                      <Button size="sm" variant="ghost" className="mt-1" onClick={() => setCat({ c: { ...cat }, subs: cat.subcategorias.join('\n'), nueva: false })}>
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cat.subcategorias.map((s) => {
                    const n = gs.filter((g) => g.subcategoria === s).length;
                    return (
                      <Badge key={s} tone={n ? 'blue' : 'gray'}>
                        {s}
                        {n > 0 && ` · ${n}`}
                      </Badge>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'centros' && (
        <Card>
          <TableWrap minWidth={640}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Código</th>
                <th className={th}>Estación</th>
                <th className={th}>Unidad de negocio</th>
                <th className={thR}>Gastos</th>
                <th className={thR}>Monto del mes</th>
                <th className={thR}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {centros.map((cc) => {
                const gs = mes.filter((g) => g.centroCostoId === cc.id);

                return (
                  <tr key={cc.id} className={cc.activo ? '' : 'opacity-60'}>
                    <td className={cx(td, `font-medium`)}>
                      {cc.codigo}
                      <p className="text-xs font-normal text-slate-500 dark:text-slate-400">{cc.nombre}</p>
                    </td>
                    <td className={td}>{c.estacion(cc.estacionId)?.nombre}</td>
                    <td className={td}>{c.uniNombre(cc.unidad)}</td>
                    <td className={tdR}>{gs.length}</td>
                    <td className={tdR}>{q(sumar(gs, (g) => g.monto))}</td>
                    <td className={tdR}>
                      {edita && (
                        <Button size="sm" variant="ghost" onClick={() => setCc({ c: { ...cc }, nuevo: false })}>
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>
      )}

      {tab === 'unidades' && (
        <Card title="Gasto por unidad de negocio" subtitle="Combustible, tienda, lubricantes, lavado y administración">
          <BarList
            format={q}
            items={db.unidades
              .map((u) => ({
                key: u.id,
                label: u.nombre,
                value: sumar(
                  mes.filter((g) => c.centro(g.centroCostoId)?.unidad === u.id),
                  (g) => g.monto,
                ),
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </Card>
      )}

      <Modal
        open={!!catForm}
        onClose={() => setCat(null)}
        title={catForm?.nueva ? 'Nueva categoría' : `Editar ${catForm?.c.nombre ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCat(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarCat}>Guardar</Button>
          </>
        }
      >
        {catForm && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" hint="2 a 6 letras, ej. LIM">
              <input
                className={`${inputCls} uppercase`}
                disabled={!catForm.nueva}
                value={catForm.c.id}
                onChange={(e) => setCat({ ...catForm, c: { ...catForm.c, id: e.target.value.toUpperCase() } })}
              />
            </Field>
            <Field label="Cuenta contable">
              <input className={inputCls} value={catForm.c.cuentaContable} onChange={(e) => setCat({ ...catForm, c: { ...catForm.c, cuentaContable: e.target.value } })} />
            </Field>
            <Field label="Nombre" className="sm:col-span-2">
              <input className={inputCls} value={catForm.c.nombre} onChange={(e) => setCat({ ...catForm, c: { ...catForm.c, nombre: e.target.value } })} />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <input className={inputCls} value={catForm.c.descripcion} onChange={(e) => setCat({ ...catForm, c: { ...catForm.c, descripcion: e.target.value } })} />
            </Field>
            <Field label="Subcategorías" hint="Una por línea" className="sm:col-span-2">
              <textarea className={inputCls} rows={5} value={catForm.subs} onChange={(e) => setCat({ ...catForm, subs: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                checked={catForm.c.activa}
                onChange={(e) => setCat({ ...catForm, c: { ...catForm.c, activa: e.target.checked } })}
              />
              Activa (aparece al registrar gastos)
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!centroForm}
        onClose={() => setCc(null)}
        title={centroForm?.nuevo ? 'Nuevo centro de costo' : `Editar ${centroForm?.c.codigo ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCc(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarCc}>Guardar</Button>
          </>
        }
      >
        {centroForm && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Estación">
              <select
                className={inputCls}
                disabled={!centroForm.nuevo}
                value={centroForm.c.estacionId}
                onChange={(e) => setCc({ ...centroForm, c: { ...centroForm.c, estacionId: e.target.value } })}
              >
                {db.estaciones.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unidad de negocio">
              <select
                className={inputCls}
                disabled={!centroForm.nuevo}
                value={centroForm.c.unidad}
                onChange={(e) => setCc({ ...centroForm, c: { ...centroForm.c, unidad: e.target.value } })}
              >
                {db.unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre" hint="Si lo deja vacío se arma con la unidad y la estación" className="sm:col-span-2">
              <input className={inputCls} value={centroForm.c.nombre} onChange={(e) => setCc({ ...centroForm, c: { ...centroForm.c, nombre: e.target.value } })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                checked={centroForm.c.activo}
                onChange={(e) => setCc({ ...centroForm, c: { ...centroForm.c, activo: e.target.checked } })}
              />
              Activo
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
