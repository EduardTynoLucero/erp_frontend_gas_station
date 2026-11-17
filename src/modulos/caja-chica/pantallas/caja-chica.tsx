'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { BarraProgreso } from '@/componentes/ui/barras';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type CajaChica, type CajasChicas, type MovimientoCaja, useCajasChicas, useDesembolso, useGuardarCaja, useLiquidarCaja } from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

function EstadoMovimiento({ m }: { m: MovimientoCaja }) {
  if (m.estado === 'apertura') return <Insignia>Apertura</Insignia>;
  if (m.estado === 'por_liquidar') return <Insignia tono="amber">Por liquidar</Insignia>;
  const titulo = m.liquidacion ?? undefined;
  return (
    <span title={titulo}>
      {m.estado === 'repuesto' ? <Insignia tono="green">Repuesto</Insignia> : <Insignia tono="blue">En reposición</Insignia>}
    </span>
  );
}

interface FormCaja {
  id: string | null;
  codigo: string;
  estacionId: string;
  fondo: string;
  responsableId: string;
  activa: boolean;
}

interface FormMov {
  fecha: string;
  descripcion: string;
  monto: string;
  categoriaId: string;
  comprobante: string;
}

export function PantallaCajaChica() {
  const { estacionId } = useErp();
  const consulta = useCajasChicas(estacionId);
  const liquidar = useLiquidarCaja();
  const [sel, setSel] = useState('');
  const [formCaja, setFormCaja] = useState<FormCaja | null>(null);
  const [formMov, setFormMov] = useState<FormMov | null>(null);
  const d = consulta.data;
  const actual: CajaChica | undefined = d ? (d.cajas.find((x) => x.id === sel) ?? d.cajas[0]) : undefined;

  const abrir = (datos: CajasChicas) =>
    setFormCaja({
      id: null,
      codigo: '',
      estacionId: datos.estacionesSinCaja.find((e) => e.id === estacionId)?.id ?? datos.estacionesSinCaja[0]?.id ?? '',
      fondo: '',
      responsableId: '',
      activa: true,
    });
  const editar = (c: CajaChica) =>
    setFormCaja({ id: c.id, codigo: c.codigo, estacionId: c.estacion.id, fondo: c.fondo, responsableId: c.responsable.id, activa: c.activa });

  async function liquidarCaja(c: CajaChica) {
    try {
      const r = await liquidar.mutateAsync(c.id);
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Caja chica"
        descripcion={
          d
            ? `Fondo fijo por estación. Tope por desembolso ${q(d.parametros.limiteDesembolso)}; comprobante obligatorio desde ${q(
                d.parametros.comprobanteObligatorioDesde,
              )}. Al liquidar, los desembolsos pasan a autorización y el fondo se repone cuando se paga.`
            : 'Fondo fijo por estación. Al liquidar, los desembolsos pasan a autorización y el fondo se repone cuando se paga.'
        }
        acciones={
          d &&
          d.puedeAdministrar && (
            <Boton onClick={() => abrir(d)} disabled={!d.estacionesSinCaja.length} title={d.estacionesSinCaja.length ? undefined : 'Todas sus estaciones ya tienen caja chica'}>
              + Abrir caja chica
            </Boton>
          )
        }
      />

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : consulta.data.cajas.length === 0 ? (
        <Vacio>
          Todavía no hay cajas chicas{estacionId ? ' en esta estación' : ' en las estaciones que puede ver'}. Una caja chica es un fondo fijo de la estación
          para gastos menores: el encargado registra cada desembolso con su comprobante y, al liquidar, pide la reposición del fondo.
          {consulta.data.puedeAdministrar
            ? consulta.data.estacionesSinCaja.length
              ? ' Abra la primera con «+ Abrir caja chica»: elija la estación, el monto del fondo y el responsable.'
              : ''
            : ' La abre quien administra los parámetros y las estaciones.'}
        </Vacio>
      ) : (
        <>
          <div className="grid gap-[6px] md:grid-cols-3">
            {consulta.data.cajas.map((caja) => (
              <button
                key={caja.id}
                type="button"
                onClick={() => setSel(caja.id)}
                className={cn(
                  'rounded-[2px] border bg-superficie px-[10px] py-[8px] text-left',
                  actual?.id === caja.id ? 'border-primario ring-1 ring-primario' : 'border-borde hover:border-borde-campo',
                  !caja.activa && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-tinta">
                    {caja.codigo} · {caja.estacion.codigo}
                    {!caja.activa && (
                      <Insignia className="ml-1" tono="gray">
                        Inactiva
                      </Insignia>
                    )}
                  </p>
                  <span className="truncate text-[11px] text-tenue">{caja.responsable.nombre}</span>
                </div>
                <p className="mt-[6px] text-[20px] font-semibold tabular-nums text-tinta">{q(caja.saldo)}</p>
                <p className="mb-[6px] text-[11px] text-tenue">saldo de un fondo de {q(caja.fondo)}</p>
                <BarraProgreso porcentaje={caja.usoPct} alertaDesde={70} />
                <div className="mt-[6px] flex justify-between text-[11px] text-tenue">
                  <span>Por liquidar: {q(caja.porLiquidar)}</span>
                  <span>En reposición: {q(caja.enReposicion)}</span>
                </div>
              </button>
            ))}
          </div>

          {actual && (
            <Tarjeta
              className="mt-[6px]"
              cuerpoClassName="p-0"
              titulo={`Movimientos de ${actual.codigo} · ${actual.estacion.nombre}`}
              subtitulo={actual.totalMovimientos > actual.movimientos.length ? `Los últimos ${actual.movimientos.length} de ${actual.totalMovimientos}` : undefined}
              acciones={
                <>
                  {consulta.data.puedeAdministrar && (
                    <Boton variante="ghost" onClick={() => editar(actual)}>
                      Editar caja
                    </Boton>
                  )}
                  {consulta.data.opera && (
                    <>
                      <BotonAccion
                        variante="secondary"
                        verificacion={actual.puedeOperar}
                        disabled={!actual.porLiquidarCantidad}
                        title={actual.porLiquidarCantidad ? undefined : 'No hay desembolsos por liquidar'}
                        cargando={liquidar.isPending}
                        onClick={() => liquidarCaja(actual)}
                      >
                        Liquidar y pedir reposición
                      </BotonAccion>
                      <BotonAccion
                        verificacion={actual.puedeOperar}
                        onClick={() =>
                          setFormMov({ fecha: consulta.data.hoy, descripcion: '', monto: '', categoriaId: consulta.data.categorias[0]?.id ?? '', comprobante: '' })
                        }
                      >
                        + Desembolso
                      </BotonAccion>
                    </>
                  )}
                </>
              }
            >
              {!consulta.data.opera && (
                <Aviso className="m-[10px]">
                  Solo consulta: los desembolsos y la liquidación los registra el encargado de caja chica. La reposición la autoriza el gerente y la paga Tesorería.
                </Aviso>
              )}
              {actual.movimientos.length === 0 ? (
                <Vacio className="m-[10px]">Esta caja todavía no tiene movimientos.</Vacio>
              ) : (
                <ContenedorTabla anchoMinimo={720}>
                  <Cabecera>
                    <th className={th}>Fecha</th>
                    <th className={th}>Descripción</th>
                    <th className={th}>Categoría</th>
                    <th className={th}>Comprobante</th>
                    <th className={th}>Estado</th>
                    <th className={thR}>Monto</th>
                  </Cabecera>
                  <Cuerpo>
                    {actual.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td className={cn(td, 'whitespace-nowrap')}>{fecha(m.fecha)}</td>
                        <td className={td}>{m.descripcion}</td>
                        <td className={td}>{m.categoria?.nombre ?? '—'}</td>
                        <td className={td}>{m.comprobante || <span className="text-[11px] text-tenue">Sin comprobante</span>}</td>
                        <td className={td}>
                          <EstadoMovimiento m={m} />
                        </td>
                        <td className={cn(tdR, m.tipo === 'apertura' && 'text-emerald-700 dark:text-emerald-400')}>
                          {m.tipo === 'apertura' ? '+' : '−'}
                          {q(m.monto)}
                        </td>
                      </tr>
                    ))}
                  </Cuerpo>
                </ContenedorTabla>
              )}
            </Tarjeta>
          )}
        </>
      )}

      {formMov && actual && d && <DialogoDesembolso caja={actual} datos={d} form={formMov} setForm={setFormMov} />}
      {formCaja && d && <DialogoCaja datos={d} form={formCaja} setForm={setFormCaja} />}
    </div>
  );
}

function DialogoDesembolso({ caja, datos, form, setForm }: { caja: CajaChica; datos: CajasChicas; form: FormMov; setForm: (f: FormMov | null) => void }) {
  const desembolso = useDesembolso();
  const e = desembolso.error;
  const cerrar = () => setForm(null);
  async function registrar() {
    try {
      const r = await desembolso.mutateAsync({
        id: caja.id,
        cuerpo: { fecha: form.fecha, descripcion: form.descripcion.trim(), monto: form.monto.trim(), categoriaId: form.categoriaId, comprobante: form.comprobante.trim() },
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
      alCerrar={cerrar}
      titulo={`Desembolso de ${caja.codigo}`}
      descripcion={`${caja.estacion.nombre} · saldo ${q(caja.saldo)}`}
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={desembolso.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={registrar} cargando={desembolso.isPending}>
            Registrar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha" htmlFor="cc-fecha" error={errorDe(e, 'fecha')}>
          <Entrada id="cc-fecha" type="date" value={form.fecha} max={datos.hoy} onChange={(ev) => setForm({ ...form, fecha: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Monto" htmlFor="cc-monto" error={errorDe(e, 'monto')}>
          <Entrada id="cc-monto" inputMode="decimal" className="tabular-nums" placeholder="0.00" value={form.monto} onChange={(ev) => setForm({ ...form, monto: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Descripción" className="sm:col-span-2" htmlFor="cc-desc" error={errorDe(e, 'descripcion')}>
          <Entrada id="cc-desc" value={form.descripcion} onChange={(ev) => setForm({ ...form, descripcion: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="cc-cat" error={errorDe(e, 'categoriaId')}>
          <Seleccion id="cc-cat" value={form.categoriaId} onChange={(ev) => setForm({ ...form, categoriaId: ev.target.value })}>
            {datos.categorias.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Comprobante" htmlFor="cc-comp" error={errorDe(e, 'comprobante')}>
          <Entrada id="cc-comp" value={form.comprobante} placeholder="FEL o recibo" onChange={(ev) => setForm({ ...form, comprobante: ev.target.value })} />
        </Campo>
      </div>
      <Aviso className="mt-3">
        Tope {q(datos.parametros.limiteDesembolso)} por desembolso. Desde {q(datos.parametros.comprobanteObligatorioDesde)} se exige comprobante.
      </Aviso>
    </Modal>
  );
}

function DialogoCaja({ datos, form, setForm }: { datos: CajasChicas; form: FormCaja; setForm: (f: FormCaja | null) => void }) {
  const guardar = useGuardarCaja();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  async function confirmar() {
    try {
      const r =
        form.id === null
          ? await guardar.mutateAsync({ id: null, cuerpo: { estacionId: form.estacionId, fondo: form.fondo.trim(), responsableId: form.responsableId } })
          : await guardar.mutateAsync({ id: form.id, cuerpo: { fondo: form.fondo.trim(), responsableId: form.responsableId, activa: form.activa } });
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
      titulo={form.id ? `Editar ${form.codigo}` : 'Abrir caja chica'}
      descripcion={
        form.id
          ? 'El fondo no puede quedar por debajo de lo desembolsado sin reponer.'
          : 'Una caja por estación. Se registra el movimiento de apertura con el monto del fondo.'
      }
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={guardar.isPending} disabled={!form.estacionId || !form.responsableId || !form.fondo.trim()}>
            {form.id ? 'Guardar' : 'Abrir caja'}
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {form.id === null && (
          <Campo etiqueta="Estación" className="sm:col-span-2" htmlFor="cj-est" error={errorDe(e, 'estacionId')}>
            <Seleccion id="cj-est" value={form.estacionId} onChange={(ev) => setForm({ ...form, estacionId: ev.target.value })}>
              {datos.estacionesSinCaja.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} · {x.nombre}
                </option>
              ))}
            </Seleccion>
          </Campo>
        )}
        <Campo etiqueta="Fondo fijo" htmlFor="cj-fondo" error={errorDe(e, 'fondo')}>
          <Entrada id="cj-fondo" inputMode="decimal" className="tabular-nums" placeholder="0.00" value={form.fondo} onChange={(ev) => setForm({ ...form, fondo: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Responsable" htmlFor="cj-resp" error={errorDe(e, 'responsableId')}>
          <Seleccion id="cj-resp" value={form.responsableId} onChange={(ev) => setForm({ ...form, responsableId: ev.target.value })}>
            <option value="">Seleccione…</option>
            {datos.responsables.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        {form.id !== null && (
          <label className="flex items-center gap-2 text-[12px] text-tinta sm:col-span-2">
            <input type="checkbox" checked={form.activa} onChange={(ev) => setForm({ ...form, activa: ev.target.checked })} />
            Caja activa (una caja inactiva no admite desembolsos)
          </label>
        )}
      </div>
    </Modal>
  );
}
