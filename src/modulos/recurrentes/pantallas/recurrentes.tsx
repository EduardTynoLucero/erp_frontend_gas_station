'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { Campo, claseFiltro, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador } from '@/componentes/ui/tarjeta';
import { fecha, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type Frecuencia, type RecurrenteDetalle, type RecurrentesPantalla, useEstadoRecurrente, useGenerarRecurrentes, useGuardarRecurrente, useRecurrentesPantalla } from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

const HORIZONTES = [7, 15, 31] as const;

interface Form {
  id: string | null;
  nombre: string;
  estacionId: string;
  centroCostoId: string;
  categoriaId: string;
  subcategoria: string;
  proveedorId: string;
  monto: string;
  frecuencia: Frecuencia;
  proximaFecha: string;
}

export function PantallaRecurrentes() {
  const { estacionId } = useErp();
  const [horizonte, setHorizonte] = useState<number>(7);
  const consulta = useRecurrentesPantalla(estacionId, horizonte);
  const estado = useEstadoRecurrente();
  const generar = useGenerarRecurrentes();
  const [form, setForm] = useState<Form | null>(null);
  const d = consulta.data;

  const centroDe = (datos: RecurrentesPantalla, est: string) => datos.opciones.centrosCosto.find((c) => c.estacionId === est && c.activo)?.id ?? '';
  const nueva = (datos: RecurrentesPantalla) => {
    const est = estacionId ?? datos.opciones.estaciones.find((e) => e.activa)?.id ?? '';
    const cat = datos.opciones.categorias.find((c) => c.activa);
    setForm({
      id: null,
      nombre: '',
      estacionId: est,
      centroCostoId: centroDe(datos, est),
      categoriaId: cat?.id ?? '',
      subcategoria: cat?.subcategorias[0] ?? '',
      proveedorId: '',
      monto: '',
      frecuencia: datos.opciones.frecuencias[0] ?? 'Mensual',
      proximaFecha: datos.hoy,
    });
  };
  const editar = (r: RecurrenteDetalle) =>
    setForm({
      id: r.id,
      nombre: r.nombre,
      estacionId: r.estacion.id,
      centroCostoId: r.centroCosto.id,
      categoriaId: r.categoria.id,
      subcategoria: r.subcategoria,
      proveedorId: r.proveedor?.id ?? '',
      monto: r.monto,
      frecuencia: r.frecuencia,
      proximaFecha: r.proximaFecha,
    });

  async function alternar(r: RecurrenteDetalle) {
    try {
      const res = await estado.mutateAsync({ id: r.id, activo: !r.activo });
      toast.success(res.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }
  async function generarIds(ids: string[]) {
    try {
      const res = await generar.mutateAsync(ids);
      toast.success(res.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Gastos recurrentes"
        descripcion="Plantillas de gastos periódicos: energía, agua, internet, vigilancia, monitoreo, cuota de marca, seguros y servicios de oficina central. Al generar, el gasto entra a autorización y la plantilla avanza al siguiente periodo."
        acciones={d && d.puedeEditar && <Boton onClick={() => nueva(d)}>+ Nueva plantilla</Boton>}
      />
      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          <div className="mb-[6px] grid grid-cols-2 gap-[6px] lg:grid-cols-4">
            <Indicador etiqueta="Plantillas activas" valor={consulta.data.resumen.activas} />
            <Indicador etiqueta="Compromiso mensual" valor={q(consulta.data.resumen.compromisoMensual)} />
            <Indicador
              etiqueta={`Tocan en ${horizonte} días`}
              valor={consulta.data.resumen.proximos.cantidad}
              pista={q(consulta.data.resumen.proximos.monto)}
              {...(consulta.data.resumen.proximos.cantidad ? { tono: 'amber' as const } : {})}
            />
            <div className="flex flex-col justify-center gap-[6px] rounded-[2px] border border-borde bg-superficie px-[10px] py-[7px]">
              <select className={claseFiltro()} value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))} aria-label="Horizonte">
                {HORIZONTES.map((h) => (
                  <option key={h} value={h}>
                    Próximos {h} días
                  </option>
                ))}
              </select>
              <Boton
                disabled={!consulta.data.resumen.proximos.cantidad}
                cargando={generar.isPending}
                onClick={() => generarIds(consulta.data.resumen.proximos.ids)}
              >
                Generar {consulta.data.resumen.proximos.cantidad || ''}
              </Boton>
            </div>
          </div>

          {consulta.data.recurrentes.length === 0 ? (
            <Vacio>
              Todavía no hay plantillas de gastos recurrentes{estacionId ? ' en esta estación' : ''}.
              {consulta.data.puedeEditar ? ' Cree la primera con «+ Nueva plantilla».' : ''}
            </Vacio>
          ) : (
            <ContenedorTabla anchoMinimo={900}>
              <Cabecera>
                <th className={th}>Gasto</th>
                <th className={th}>Estación</th>
                <th className={th}>Proveedor</th>
                <th className={th}>Próxima fecha</th>
                <th className={th}>Estado</th>
                <th className={thR}>Monto</th>
                <th className={thR}></th>
              </Cabecera>
              <Cuerpo>
                {consulta.data.recurrentes.map((r) => (
                  <tr key={r.id} className={r.activo ? '' : 'opacity-60'}>
                    <td className={td}>
                      <p className="font-medium text-tinta">{r.nombre}</p>
                      <p className="text-[10px] text-tenue">
                        {r.categoria.nombre} · {r.frecuencia}, día {r.diaPago}
                      </p>
                    </td>
                    <td className={td}>{r.estacion.codigo}</td>
                    <td className={cn(td, 'max-w-[200px] truncate')}>{r.proveedor?.nombre ?? '—'}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>
                      {fecha(r.proximaFecha)}
                      {r.activo && r.dias <= horizonte && (
                        <Insignia tono={r.dias < 0 ? 'red' : 'amber'} className="ml-1">
                          {r.dias < 0 ? 'Atrasado' : r.dias === 0 ? 'Hoy' : `${r.dias} d`}
                        </Insignia>
                      )}
                    </td>
                    <td className={td}>{r.activo ? <Insignia tono="green">Activa</Insignia> : <Insignia>Pausada</Insignia>}</td>
                    <td className={tdR}>{q(r.monto)}</td>
                    <td className={tdR}>
                      <span className="inline-flex gap-1">
                        {consulta.data.puedeEditar && (
                          <>
                            <Boton tamano="sm" variante="ghost" onClick={() => editar(r)}>
                              Editar
                            </Boton>
                            <Boton tamano="sm" variante="ghost" onClick={() => alternar(r)} disabled={estado.isPending}>
                              {r.activo ? 'Pausar' : 'Activar'}
                            </Boton>
                          </>
                        )}
                        {r.activo && (
                          <BotonAccion
                            tamano="sm"
                            variante="secondary"
                            verificacion={r.puedeGenerar}
                            disabled={generar.isPending}
                            onClick={() => generarIds([r.id])}
                          >
                            Generar
                          </BotonAccion>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </Cuerpo>
            </ContenedorTabla>
          )}
        </>
      )}

      {form && d && <DialogoRecurrente form={form} setForm={setForm} opciones={d.opciones} />}
    </div>
  );
}

function DialogoRecurrente({ form, setForm, opciones }: { form: Form; setForm: (f: Form | null) => void; opciones: RecurrentesPantalla['opciones'] }) {
  const guardar = useGuardarRecurrente();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  const categoria = opciones.categorias.find((c) => c.id === form.categoriaId);
  async function confirmar() {
    try {
      const r = await guardar.mutateAsync({
        id: form.id,
        cuerpo: {
          nombre: form.nombre,
          estacionId: form.estacionId,
          centroCostoId: form.centroCostoId,
          categoriaId: form.categoriaId,
          subcategoria: form.subcategoria,
          proveedorId: form.proveedorId || null,
          monto: form.monto.trim(),
          frecuencia: form.frecuencia,
          proximaFecha: form.proximaFecha,
        },
      });
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
      titulo={form.id ? `Editar ${form.nombre}` : 'Nueva plantilla de gasto recurrente'}
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
        <Campo etiqueta="Nombre del gasto" className="sm:col-span-2" htmlFor="rc-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="rc-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} placeholder="Ej. Energía eléctrica" />
        </Campo>
        <Campo etiqueta="Estación" htmlFor="rc-est" error={errorDe(e, 'estacionId')}>
          <Seleccion
            id="rc-est"
            value={form.estacionId}
            onChange={(ev) =>
              setForm({
                ...form,
                estacionId: ev.target.value,
                centroCostoId: opciones.centrosCosto.find((c) => c.estacionId === ev.target.value && c.activo)?.id ?? '',
              })
            }
          >
            {opciones.estaciones
              .filter((x) => x.activa || x.id === form.estacionId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} · {x.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Centro de costo" htmlFor="rc-cc" error={errorDe(e, 'centroCostoId')}>
          <Seleccion id="rc-cc" value={form.centroCostoId} onChange={(ev) => setForm({ ...form, centroCostoId: ev.target.value })}>
            {opciones.centrosCosto
              .filter((x) => x.estacionId === form.estacionId && (x.activo || x.id === form.centroCostoId))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="rc-cat" error={errorDe(e, 'categoriaId')}>
          <Seleccion
            id="rc-cat"
            value={form.categoriaId}
            onChange={(ev) =>
              setForm({ ...form, categoriaId: ev.target.value, subcategoria: opciones.categorias.find((c) => c.id === ev.target.value)?.subcategorias[0] ?? '' })
            }
          >
            {opciones.categorias
              .filter((x) => x.activa || x.id === form.categoriaId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Subcategoría" htmlFor="rc-sub" error={errorDe(e, 'subcategoria')}>
          <Seleccion id="rc-sub" value={form.subcategoria} onChange={(ev) => setForm({ ...form, subcategoria: ev.target.value })}>
            {categoria && form.subcategoria && !categoria.subcategorias.includes(form.subcategoria) && <option>{form.subcategoria}</option>}
            {categoria?.subcategorias.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Proveedor" className="sm:col-span-2" htmlFor="rc-prov" error={errorDe(e, 'proveedorId')}>
          <Seleccion id="rc-prov" value={form.proveedorId} onChange={(ev) => setForm({ ...form, proveedorId: ev.target.value })}>
            <option value="">Sin proveedor</option>
            {opciones.proveedores
              .filter((p) => p.activo || p.id === form.proveedorId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Monto" htmlFor="rc-monto" error={errorDe(e, 'monto')}>
          <Entrada id="rc-monto" inputMode="decimal" className="tabular-nums" value={form.monto} onChange={(ev) => setForm({ ...form, monto: ev.target.value })} placeholder="0.00" />
        </Campo>
        <Campo etiqueta="Frecuencia" htmlFor="rc-frec" error={errorDe(e, 'frecuencia')}>
          <Seleccion id="rc-frec" value={form.frecuencia} onChange={(ev) => setForm({ ...form, frecuencia: ev.target.value as Frecuencia })}>
            {opciones.frecuencias.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Próxima fecha" htmlFor="rc-fecha" error={errorDe(e, 'proximaFecha')}>
          <Entrada id="rc-fecha" type="date" value={form.proximaFecha} onChange={(ev) => setForm({ ...form, proximaFecha: ev.target.value })} />
        </Campo>
      </div>
    </Modal>
  );
}
