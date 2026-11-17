'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador } from '@/componentes/ui/tarjeta';
import { fecha, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type ContratoDetalle, type ContratosPantalla, useContratosPantalla, useGuardarContrato, useRenovarContrato } from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

const TONO = { Vencido: 'red', 'Por vencer': 'amber', Vigente: 'green' } as const;

interface Form {
  id: string | null;
  numero: string;
  objeto: string;
  proveedorId: string;
  estacionId: string;
  categoriaId: string;
  montoMensual: string;
  inicio: string;
  fin: string;
  renovacionAutomatica: boolean;
  avisoDias: string;
  documento: string;
}

/** Misma fecha un año después (AAAA-MM-DD); el backend valida la fecha. */
const unAnoDespues = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

export function PantallaContratos() {
  const { estacionId } = useErp();
  const consulta = useContratosPantalla(estacionId);
  const renovar = useRenovarContrato();
  const [form, setForm] = useState<Form | null>(null);
  const d = consulta.data;

  const nuevo = (datos: ContratosPantalla) =>
    setForm({
      id: null,
      numero: '',
      objeto: '',
      proveedorId: '',
      estacionId: estacionId ?? datos.opciones.estaciones.find((e) => e.activa)?.id ?? '',
      categoriaId: datos.opciones.categorias.find((c) => c.activa)?.id ?? '',
      montoMensual: '',
      inicio: datos.hoy,
      fin: unAnoDespues(datos.hoy),
      renovacionAutomatica: false,
      avisoDias: '30',
      documento: '',
    });
  const editar = (x: ContratoDetalle) =>
    setForm({
      id: x.id,
      numero: x.numero,
      objeto: x.objeto,
      proveedorId: x.proveedor.id,
      estacionId: x.estacion.id,
      categoriaId: x.categoria.id,
      montoMensual: x.montoMensual,
      inicio: x.inicio,
      fin: x.fin,
      renovacionAutomatica: x.renovacionAutomatica,
      avisoDias: String(x.avisoDias),
      documento: x.documento,
    });

  async function renovar12(x: ContratoDetalle) {
    try {
      const r = await renovar.mutateAsync({ id: x.id, meses: 12 });
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  const porVencer = d?.contratos.filter((x) => x.porVencer) ?? [];

  return (
    <div>
      <EncabezadoPagina
        titulo="Contratos y servicios"
        descripcion="Servicios contratados por estación, con su vencimiento y aviso de renovación."
        acciones={d && d.puedeEditar && <Boton onClick={() => nuevo(d)}>+ Nuevo contrato</Boton>}
      />
      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          <div className="mb-[6px] grid grid-cols-2 gap-[6px] lg:grid-cols-4">
            <Indicador etiqueta="Contratos" valor={consulta.data.resumen.contratos} />
            <Indicador etiqueta="Compromiso mensual" valor={q(consulta.data.resumen.compromisoMensual)} />
            <Indicador etiqueta="Por vencer sin renovación" valor={consulta.data.resumen.porVencer} {...(consulta.data.resumen.porVencer ? { tono: 'amber' as const } : {})} />
            <Indicador etiqueta="Con renovación automática" valor={consulta.data.resumen.renovacionAutomatica} />
          </div>
          {porVencer.length > 0 && (
            <Aviso tono="amber" className="mb-[6px]">
              {porVencer.map((x) => `${x.objeto} (${x.estacion.codigo}) ${x.dias < 0 ? `venció hace ${-x.dias} días` : `vence en ${x.dias} días`}`).join(' · ')}. Decida si
              renueva o cotiza otro proveedor.
            </Aviso>
          )}
          {consulta.data.contratos.length === 0 ? (
            <Vacio>Todavía no hay contratos registrados{estacionId ? ' en esta estación' : ''}.{consulta.data.puedeEditar ? ' Registre el primero con «+ Nuevo contrato».' : ''}</Vacio>
          ) : (
            <ContenedorTabla anchoMinimo={960}>
              <Cabecera>
                <th className={th}>Servicio</th>
                <th className={th}>Proveedor</th>
                <th className={th}>Estación</th>
                <th className={th}>Vigencia</th>
                <th className={th}>Estado</th>
                <th className={thR}>Mensual</th>
                <th className={thR}></th>
              </Cabecera>
              <Cuerpo>
                {consulta.data.contratos.map((x) => (
                  <tr key={x.id}>
                    <td className={td}>
                      <p className="font-medium text-tinta">{x.objeto}</p>
                      <p className="text-[10px] text-tenue">
                        {x.numero} · {x.categoria.nombre} · {x.documento}
                      </p>
                    </td>
                    <td className={cn(td, 'max-w-[200px] truncate')}>{x.proveedor.nombre}</td>
                    <td className={td}>{x.estacion.codigo}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>
                      {fecha(x.inicio)} – {fecha(x.fin)}
                      <p className="text-[10px] text-tenue">{x.renovacionAutomatica ? 'Renovación automática' : `Aviso ${x.avisoDias} días antes`}</p>
                    </td>
                    <td className={td}>
                      <Insignia tono={TONO[x.estado]}>{x.estado}</Insignia>
                      <p className="mt-0.5 text-[10px] text-tenue">{x.dias >= 0 ? `${x.dias} días` : `hace ${-x.dias} días`}</p>
                    </td>
                    <td className={tdR}>{q(x.montoMensual)}</td>
                    <td className={tdR}>
                      <span className="inline-flex gap-1">
                        {consulta.data.puedeEditar && (
                          <Boton tamano="sm" variante="ghost" onClick={() => editar(x)}>
                            Editar
                          </Boton>
                        )}
                        {consulta.data.puedeRenovar && x.renovable && (
                          <Boton tamano="sm" variante="secondary" onClick={() => renovar12(x)} disabled={renovar.isPending}>
                            Renovar 12 meses
                          </Boton>
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

      {form && d && <DialogoContrato form={form} setForm={setForm} opciones={d.opciones} />}
    </div>
  );
}

function DialogoContrato({ form, setForm, opciones }: { form: Form; setForm: (f: Form | null) => void; opciones: ContratosPantalla['opciones'] }) {
  const guardar = useGuardarContrato();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  async function confirmar() {
    try {
      const r = await guardar.mutateAsync({
        id: form.id,
        cuerpo: {
          objeto: form.objeto,
          proveedorId: form.proveedorId,
          estacionId: form.estacionId,
          categoriaId: form.categoriaId,
          montoMensual: form.montoMensual.trim() || '0',
          inicio: form.inicio,
          fin: form.fin,
          renovacionAutomatica: form.renovacionAutomatica,
          avisoDias: Math.max(0, Math.trunc(Number(form.avisoDias) || 0)),
          documento: form.documento,
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
      titulo={form.id ? `Editar ${form.numero}` : 'Nuevo contrato'}
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
        <Campo etiqueta="Servicio contratado" className="sm:col-span-2" htmlFor="ct-objeto" error={errorDe(e, 'objeto')}>
          <Entrada id="ct-objeto" value={form.objeto} onChange={(ev) => setForm({ ...form, objeto: ev.target.value })} placeholder="Ej. Vigilancia 24 h" />
        </Campo>
        <Campo etiqueta="Proveedor" className="sm:col-span-2" htmlFor="ct-prov" error={errorDe(e, 'proveedorId')}>
          <Seleccion id="ct-prov" value={form.proveedorId} onChange={(ev) => setForm({ ...form, proveedorId: ev.target.value })}>
            <option value="">Seleccione…</option>
            {opciones.proveedores
              .filter((p) => p.activo || p.id === form.proveedorId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Estación" htmlFor="ct-est" error={errorDe(e, 'estacionId')}>
          <Seleccion id="ct-est" value={form.estacionId} onChange={(ev) => setForm({ ...form, estacionId: ev.target.value })}>
            {opciones.estaciones
              .filter((x) => x.activa || x.id === form.estacionId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} · {x.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="ct-cat" error={errorDe(e, 'categoriaId')}>
          <Seleccion id="ct-cat" value={form.categoriaId} onChange={(ev) => setForm({ ...form, categoriaId: ev.target.value })}>
            {opciones.categorias
              .filter((x) => x.activa || x.id === form.categoriaId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Inicio" htmlFor="ct-ini" error={errorDe(e, 'inicio')}>
          <Entrada id="ct-ini" type="date" value={form.inicio} onChange={(ev) => setForm({ ...form, inicio: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Fin" htmlFor="ct-fin" error={errorDe(e, 'fin')}>
          <Entrada id="ct-fin" type="date" value={form.fin} onChange={(ev) => setForm({ ...form, fin: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Monto mensual (Q)" htmlFor="ct-monto" error={errorDe(e, 'montoMensual')}>
          <Entrada id="ct-monto" inputMode="decimal" className="tabular-nums" value={form.montoMensual} onChange={(ev) => setForm({ ...form, montoMensual: ev.target.value })} placeholder="0.00" />
        </Campo>
        <Campo etiqueta="Avisar con (días)" htmlFor="ct-aviso" error={errorDe(e, 'avisoDias')}>
          <Entrada id="ct-aviso" type="number" min="0" className="tabular-nums" value={form.avisoDias} onChange={(ev) => setForm({ ...form, avisoDias: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Documento" pista="Nombre del archivo o ubicación física" className="sm:col-span-2" htmlFor="ct-doc" error={errorDe(e, 'documento')}>
          <Entrada id="ct-doc" value={form.documento} onChange={(ev) => setForm({ ...form, documento: ev.target.value })} />
        </Campo>
        <label className="flex items-center gap-2 text-[12px] text-tinta sm:col-span-2">
          <input type="checkbox" className="size-4" checked={form.renovacionAutomatica} onChange={(ev) => setForm({ ...form, renovacionAutomatica: ev.target.checked })} />
          Se renueva automáticamente
        </label>
      </div>
    </Modal>
  );
}
