'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { aNumero, BarraProgreso } from '@/componentes/ui/barras';
import { Boton } from '@/componentes/ui/boton';
import { Campo, claseFiltro, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { pct, periodoLabel, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type Presupuestos, useCopiarPresupuestos, useGuardarPresupuesto, usePresupuestos } from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

interface Form {
  /** true = se edita una línea existente (estación y categoría fijas) */
  fija: boolean;
  estacionId: string;
  categoriaId: string;
  monto: string;
}

export function PantallaPresupuestos() {
  const { estacionId } = useErp();
  const [periodo, setPeriodo] = useState<string | undefined>(undefined);
  const consulta = usePresupuestos(periodo, estacionId);
  const copiar = useCopiarPresupuestos();
  const [form, setForm] = useState<Form | null>(null);
  const d = consulta.data;

  async function copiarSiguiente(datos: Presupuestos) {
    try {
      const r = await copiar.mutateAsync({ desde: datos.periodo, hacia: datos.siguiente });
      toast.success(r.mensaje);
      setPeriodo(datos.siguiente);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  const nuevo = (datos: Presupuestos) =>
    setForm({
      fija: false,
      estacionId: estacionId ?? '',
      categoriaId: datos.categorias.find((c) => c.activa)?.id ?? '',
      monto: '',
    });

  return (
    <div>
      <EncabezadoPagina
        titulo="Presupuestos y límites"
        descripcion={`Presupuesto mensual por estación y categoría. Ejecutado = aprobado o pagado; comprometido = por autorizar.${d ? ` Alerta al ${d.alertaPct} %.` : ''}`}
        acciones={
          d && (
            <div className="flex flex-wrap items-center gap-[6px] px-[6px] py-[4px]">
              {d.puedeEditar && (
                <Boton variante="secondary" onClick={() => copiarSiguiente(d)} cargando={copiar.isPending} title="Copia las líneas que falten en el mes siguiente">
                  Copiar a {periodoLabel(d.siguiente).toLowerCase()}
                </Boton>
              )}
              <select className={cn(claseFiltro(), 'w-44')} value={d.periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
                {d.periodos.map((p) => (
                  <option key={p} value={p}>
                    {periodoLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          )
        }
      />

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          {consulta.data.estaciones.length > 0 && (
            <div className="mb-[6px] grid gap-[6px] sm:grid-cols-2 lg:grid-cols-4">
              {consulta.data.estaciones.map((e) => (
                <div key={e.id} className={cn('rounded-[2px] border border-borde bg-superficie px-[10px] py-[8px]', !e.activa && 'opacity-60')}>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-tinta">{e.codigo}</p>
                    <span className="text-[12px] tabular-nums text-tenue">{e.pct === null ? '—' : pct(e.pct, 0)}</span>
                  </div>
                  <p className="mb-[6px] truncate text-[11px] text-tenue">{e.nombre}</p>
                  {/* Sin presupuesto (pct null): la barra va llena en rojo solo si hay gasto; sin gasto, vacía */}
                  <BarraProgreso porcentaje={e.pct ?? (aNumero(e.usado) > 0 ? null : 0)} alertaDesde={consulta.data.alertaPct} />
                  <p className="mt-[6px] text-[11px] tabular-nums text-tenue">
                    {q(e.usado)} de {q(e.presupuesto)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Tarjeta
            titulo={`Detalle por categoría · ${periodoLabel(consulta.data.periodo)}`}
            subtitulo={`Total ${q(consulta.data.totales.usado)} usado de ${q(consulta.data.totales.presupuesto)}`}
            cuerpoClassName="p-0"
          >
            {consulta.data.filas.length === 0 ? (
              <Vacio className="m-[10px]">
                Todavía no hay presupuesto ni gastos en {periodoLabel(consulta.data.periodo).toLowerCase()}
                {estacionId ? ' para esta estación' : ''}.
                {consulta.data.puedeEditar ? ' Asigne el primer monto con «Asignar presupuesto».' : ''}
              </Vacio>
            ) : (
              <ContenedorTabla anchoMinimo={860}>
                <Cabecera>
                  <th className={th}>Estación</th>
                  <th className={th}>Categoría</th>
                  <th className={thR}>Presupuesto</th>
                  <th className={thR}>Ejecutado</th>
                  <th className={thR}>Comprometido</th>
                  <th className={thR}>Disponible</th>
                  <th className={cn(th, 'w-40')}>Uso</th>
                </Cabecera>
                <Cuerpo>
                  {consulta.data.filas.map((f) => {
                    const sinMonto = Number(f.presupuesto) === 0;
                    const contenido = sinMonto ? <Insignia tono="amber">Sin presupuesto</Insignia> : q(f.presupuesto);
                    return (
                      <tr key={`${f.estacion.id}-${f.categoria.id}`}>
                        <td className={td}>{f.estacion.codigo}</td>
                        <td className={td}>{f.categoria.nombre}</td>
                        <td className={tdR}>
                          {consulta.data.puedeEditar ? (
                            <button
                              type="button"
                              className="rounded-[2px] px-1 tabular-nums hover:bg-primario-suave hover:text-primario-tinta"
                              title="Clic para editar"
                              onClick={() => setForm({ fija: true, estacionId: f.estacion.id, categoriaId: f.categoria.id, monto: sinMonto ? '' : f.presupuesto })}
                            >
                              {contenido}
                            </button>
                          ) : (
                            contenido
                          )}
                        </td>
                        <td className={tdR}>{q(f.ejecutado)}</td>
                        <td className={tdR}>{Number(f.comprometido) ? q(f.comprometido) : '—'}</td>
                        <td className={cn(tdR, f.disponible.startsWith('-') && 'font-medium text-red-700 dark:text-red-400')}>{q(f.disponible)}</td>
                        <td className={td}>
                          <div className="flex items-center gap-2">
                            <BarraProgreso porcentaje={f.pct} alertaDesde={consulta.data.alertaPct} />
                            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-tenue">{f.pct === null ? '—' : pct(f.pct, 0)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Cuerpo>
              </ContenedorTabla>
            )}
          </Tarjeta>

          {consulta.data.puedeEditar && (
            <Tarjeta
              className="mt-[6px]"
              titulo="Asignar presupuesto"
              subtitulo="Para una categoría que aún no tiene monto en el periodo"
              acciones={<Boton onClick={() => nuevo(consulta.data)}>Asignar presupuesto</Boton>}
            >
              <p className="text-[11px] text-tenue">
                Elija la estación, la categoría y el monto mensual para {periodoLabel(consulta.data.periodo).toLowerCase()}. Para cambiar un monto existente,
                haga clic sobre él en la tabla.
              </p>
            </Tarjeta>
          )}
        </>
      )}

      {form && d && <DialogoPresupuesto form={form} setForm={setForm} datos={d} />}
    </div>
  );
}

function DialogoPresupuesto({ form, setForm, datos }: { form: Form; setForm: (f: Form | null) => void; datos: Presupuestos }) {
  const guardar = useGuardarPresupuesto();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  const est = datos.estaciones.find((x) => x.id === form.estacionId);
  const cat = datos.categorias.find((x) => x.id === form.categoriaId);
  async function confirmar() {
    try {
      const r = await guardar.mutateAsync({ periodo: datos.periodo, estacionId: form.estacionId, categoriaId: form.categoriaId, monto: form.monto.trim() });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      alCerrar={cerrar}
      titulo={form.fija ? `Presupuesto de ${est?.codigo ?? ''} · ${cat?.nombre ?? ''}` : 'Asignar presupuesto'}
      descripcion={periodoLabel(datos.periodo)}
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={guardar.isPending} disabled={!form.estacionId || !form.categoriaId || !form.monto.trim()}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!form.fija && (
          <>
            <Campo etiqueta="Estación" htmlFor="pr-est" error={errorDe(e, 'estacionId')}>
              <Seleccion id="pr-est" value={form.estacionId} onChange={(ev) => setForm({ ...form, estacionId: ev.target.value })}>
                <option value="">Seleccione…</option>
                {datos.estaciones
                  .filter((x) => x.activa)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.codigo} · {x.nombre}
                    </option>
                  ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Categoría" htmlFor="pr-cat" error={errorDe(e, 'categoriaId')}>
              <Seleccion id="pr-cat" value={form.categoriaId} onChange={(ev) => setForm({ ...form, categoriaId: ev.target.value })}>
                {datos.categorias
                  .filter((x) => x.activa)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
              </Seleccion>
            </Campo>
          </>
        )}
        <Campo etiqueta="Monto mensual" htmlFor="pr-monto" error={errorDe(e, 'monto')} className={form.fija ? 'sm:col-span-2' : undefined}>
          <Entrada
            id="pr-monto"
            autoFocus
            inputMode="decimal"
            className="tabular-nums"
            value={form.monto}
            placeholder="0.00"
            onChange={(ev) => setForm({ ...form, monto: ev.target.value })}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') confirmar();
            }}
          />
        </Campo>
      </div>
    </Modal>
  );
}
