'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { aNumero, ListaBarras } from '@/componentes/ui/barras';
import { Boton } from '@/componentes/ui/boton';
import { AreaTexto, Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Pestanas } from '@/componentes/ui/pestanas';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { periodoLabel, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type CatalogoCategoria, type CatalogoCentro, type CatalogosPantalla, useCatalogosPantalla, useGuardarCategoria, useGuardarCentro } from '../datos';

type Pestana = 'categorias' | 'centros' | 'unidades';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

interface FormCategoria {
  nueva: boolean;
  id: string;
  nombre: string;
  descripcion: string;
  cuentaContable: string;
  subs: string;
  activa: boolean;
}

interface FormCentro {
  nuevo: boolean;
  id: string;
  codigo: string;
  estacionId: string;
  unidadCodigo: string;
  nombre: string;
  activo: boolean;
}

export function PantallaCatalogos() {
  const { estacionId } = useErp();
  const consulta = useCatalogosPantalla(estacionId);
  const d = consulta.data;
  const [pestana, setPestana] = useState<Pestana>('categorias');
  const [catForm, setCat] = useState<FormCategoria | null>(null);
  const [ccForm, setCc] = useState<FormCentro | null>(null);
  const edita = d?.puedeEditar ?? false;

  const nuevaCategoria = () => setCat({ nueva: true, id: '', nombre: '', descripcion: '', cuentaContable: '', subs: '', activa: true });
  const editarCategoria = (c: CatalogoCategoria) =>
    setCat({
      nueva: false,
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      cuentaContable: c.cuentaContable,
      subs: c.subcategorias.map((s) => s.nombre).join('\n'),
      activa: c.activa,
    });
  const nuevoCentro = (datos: CatalogosPantalla) =>
    setCc({
      nuevo: true,
      id: '',
      codigo: '',
      estacionId: estacionId ?? datos.estaciones[0]?.id ?? '',
      unidadCodigo: datos.unidades[0]?.codigo ?? '',
      nombre: '',
      activo: true,
    });
  const editarCentro = (c: CatalogoCentro) =>
    setCc({ nuevo: false, id: c.id, codigo: c.codigo, estacionId: c.estacion.id, unidadCodigo: c.unidad.codigo, nombre: c.nombre, activo: c.activo });

  return (
    <div>
      <EncabezadoPagina
        titulo="Catálogos y centros de costo"
        descripcion={`Clasificación de gastos con su cuenta contable, y centros de costo por estación y unidad de negocio.${
          d ? ` Montos de ${periodoLabel(d.periodo).toLowerCase()}.` : ''
        }`}
        acciones={
          d &&
          edita &&
          (pestana === 'categorias' ? (
            <Boton onClick={nuevaCategoria}>+ Nueva categoría</Boton>
          ) : pestana === 'centros' ? (
            <Boton onClick={() => nuevoCentro(d)}>+ Nuevo centro de costo</Boton>
          ) : null)
        }
      />
      <Pestanas
        valor={pestana}
        alCambiar={setPestana}
        pestanas={[
          { valor: 'categorias', etiqueta: `Categorías (${d?.categorias.length ?? 0})` },
          { valor: 'centros', etiqueta: `Centros de costo (${d?.centros.length ?? 0})` },
          { valor: 'unidades', etiqueta: 'Unidades de negocio' },
        ]}
      />

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          {pestana === 'categorias' &&
            (consulta.data.categorias.length === 0 ? (
              <Vacio>Todavía no hay categorías de gasto.{edita ? ' Cree la primera con «+ Nueva categoría».' : ''}</Vacio>
            ) : (
              <div className="grid gap-[6px] md:grid-cols-2">
                {consulta.data.categorias.map((cat) => (
                  <Tarjeta key={cat.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-tenue">Cuenta {cat.cuentaContable || '—'}</p>
                        <p className="text-[13px] font-semibold text-tinta">{cat.nombre}</p>
                        <p className="mt-0.5 text-[11px] text-tenue">{cat.descripcion}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-semibold tabular-nums text-tinta">{q(cat.monto)}</p>
                        <p className="text-[11px] text-tenue">{cat.gastos} gastos</p>
                        {!cat.activa && <Insignia>Inactiva</Insignia>}
                        {edita && (
                          <Boton tamano="sm" variante="ghost" className="mt-1" onClick={() => editarCategoria(cat)}>
                            Editar
                          </Boton>
                        )}
                      </div>
                    </div>
                    <div className="mt-[8px] flex flex-wrap gap-1.5">
                      {cat.subcategorias.map((s) => (
                        <Insignia key={s.nombre} tono={s.gastos ? 'blue' : 'gray'}>
                          {s.nombre}
                          {s.gastos > 0 && ` · ${s.gastos}`}
                        </Insignia>
                      ))}
                    </div>
                  </Tarjeta>
                ))}
              </div>
            ))}

          {pestana === 'centros' &&
            (consulta.data.centros.length === 0 ? (
              <Vacio>Todavía no hay centros de costo para las estaciones a la vista.</Vacio>
            ) : (
              <ContenedorTabla anchoMinimo={640}>
                <Cabecera>
                  <th className={th}>Código</th>
                  <th className={th}>Estación</th>
                  <th className={th}>Unidad de negocio</th>
                  <th className={thR}>Gastos</th>
                  <th className={thR}>Monto del mes</th>
                  <th className={thR}></th>
                </Cabecera>
                <Cuerpo>
                  {consulta.data.centros.map((cc) => (
                    <tr key={cc.id} className={cc.activo ? '' : 'opacity-60'}>
                      <td className={cn(td, 'font-medium')}>
                        {cc.codigo}
                        <p className="text-[10px] font-normal text-tenue">{cc.nombre}</p>
                      </td>
                      <td className={td}>{cc.estacion.nombre}</td>
                      <td className={td}>{cc.unidad.nombre}</td>
                      <td className={tdR}>{cc.gastos}</td>
                      <td className={tdR}>{q(cc.monto)}</td>
                      <td className={tdR}>
                        {edita && (
                          <Boton tamano="sm" variante="ghost" onClick={() => editarCentro(cc)}>
                            Editar
                          </Boton>
                        )}
                      </td>
                    </tr>
                  ))}
                </Cuerpo>
              </ContenedorTabla>
            ))}

          {pestana === 'unidades' && (
            <Tarjeta titulo="Gasto por unidad de negocio" subtitulo="Combustible, tienda, lubricantes, lavado y administración">
              <ListaBarras
                formato={q}
                vacio="Todavía no hay unidades de negocio."
                elementos={[...consulta.data.unidades]
                  .sort((a, b) => aNumero(b.monto) - aNumero(a.monto))
                  .map((u) => ({ clave: u.codigo, etiqueta: u.nombre, valor: u.monto }))}
              />
            </Tarjeta>
          )}
        </>
      )}

      {catForm && <DialogoCategoria form={catForm} setForm={setCat} />}
      {ccForm && d && <DialogoCentro form={ccForm} setForm={setCc} datos={d} />}
    </div>
  );
}

function DialogoCategoria({ form, setForm }: { form: FormCategoria; setForm: (f: FormCategoria | null) => void }) {
  const guardar = useGuardarCategoria();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  async function confirmar() {
    const base = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      cuentaContable: form.cuentaContable,
      subcategorias: form.subs
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      activa: form.activa,
    };
    try {
      const r = form.nueva
        ? await guardar.mutateAsync({ nueva: true, cuerpo: { id: form.id, ...base } })
        : await guardar.mutateAsync({ nueva: false, id: form.id, cuerpo: base });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      ancho
      alCerrar={cerrar}
      titulo={form.nueva ? 'Nueva categoría' : `Editar ${form.nombre}`}
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Código" pista="2 a 6 letras, ej. LIM" htmlFor="cat-id" error={errorDe(e, 'id')}>
          <Entrada id="cat-id" className="uppercase" disabled={!form.nueva} value={form.id} onChange={(ev) => setForm({ ...form, id: ev.target.value.toUpperCase() })} />
        </Campo>
        <Campo etiqueta="Cuenta contable" htmlFor="cat-cuenta" error={errorDe(e, 'cuentaContable')}>
          <Entrada id="cat-cuenta" value={form.cuentaContable} onChange={(ev) => setForm({ ...form, cuentaContable: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Nombre" className="sm:col-span-2" htmlFor="cat-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="cat-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Descripción" className="sm:col-span-2" htmlFor="cat-desc" error={errorDe(e, 'descripcion')}>
          <Entrada id="cat-desc" value={form.descripcion} onChange={(ev) => setForm({ ...form, descripcion: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Subcategorías" pista="Una por línea" className="sm:col-span-2" htmlFor="cat-subs" error={errorDe(e, 'subcategorias')}>
          <AreaTexto id="cat-subs" rows={5} value={form.subs} onChange={(ev) => setForm({ ...form, subs: ev.target.value })} />
        </Campo>
        <label className="flex items-center gap-2 text-[12px] text-tinta">
          <input type="checkbox" className="size-4" checked={form.activa} onChange={(ev) => setForm({ ...form, activa: ev.target.checked })} />
          Activa (aparece al registrar gastos)
        </label>
      </div>
    </Modal>
  );
}

function DialogoCentro({ form, setForm, datos }: { form: FormCentro; setForm: (f: FormCentro | null) => void; datos: CatalogosPantalla }) {
  const guardar = useGuardarCentro();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  async function confirmar() {
    try {
      const r = form.nuevo
        ? await guardar.mutateAsync({ nuevo: true, cuerpo: { estacionId: form.estacionId, unidadCodigo: form.unidadCodigo, nombre: form.nombre, activo: form.activo } })
        : await guardar.mutateAsync({ nuevo: false, id: form.id, cuerpo: { nombre: form.nombre, activo: form.activo } });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      ancho
      alCerrar={cerrar}
      titulo={form.nuevo ? 'Nuevo centro de costo' : `Editar ${form.codigo}`}
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Estación" htmlFor="cc-est" error={errorDe(e, 'estacionId')}>
          <Seleccion id="cc-est" disabled={!form.nuevo} value={form.estacionId} onChange={(ev) => setForm({ ...form, estacionId: ev.target.value })}>
            {datos.estaciones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.codigo} · {x.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Unidad de negocio" htmlFor="cc-uni" error={errorDe(e, 'unidadCodigo')}>
          <Seleccion id="cc-uni" disabled={!form.nuevo} value={form.unidadCodigo} onChange={(ev) => setForm({ ...form, unidadCodigo: ev.target.value })}>
            {datos.unidades.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Nombre" pista="Si lo deja vacío se arma con la unidad y la estación" className="sm:col-span-2" htmlFor="cc-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="cc-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <label className="flex items-center gap-2 text-[12px] text-tinta">
          <input type="checkbox" className="size-4" checked={form.activo} onChange={(ev) => setForm({ ...form, activo: ev.target.checked })} />
          Activo
        </label>
      </div>
    </Modal>
  );
}
