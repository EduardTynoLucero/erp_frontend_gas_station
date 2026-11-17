'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, Esqueleto, Vacio } from '@/componentes/ui/aviso';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, pct, periodoLabel, q } from '@/lib/formato';
import { type EmpresaYEstaciones, type EstacionAdministrada, useEmpresaYEstaciones, useGuardarEmpresa, useGuardarEstacion } from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

interface FormEstacion {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
  gerenteId: string;
  unidades: string[];
  codigoEtl: string;
  activa: boolean;
  fondoCaja: string;
}

interface FormEmpresa {
  nombre: string;
  nit: string;
  franquicia: string;
}

export function PantallaEstaciones() {
  const { perfil } = useErp();
  const consulta = useEmpresaYEstaciones();
  const d = consulta.data;
  const edita = d?.puedeEditar ?? false;
  const [form, setForm] = useState<FormEstacion | null>(null);
  const [empresa, setEmpresa] = useState<FormEmpresa | null>(null);

  const nueva = (datos: EmpresaYEstaciones) =>
    setForm({
      id: '',
      codigo: '',
      nombre: '',
      direccion: '',
      gerenteId: datos.usuarios.some((u) => u.id === perfil.usuario.id) ? perfil.usuario.id : '',
      unidades: datos.unidades.map((u) => u.codigo).filter((c) => c === 'COMB' || c === 'ADMIN'),
      codigoEtl: '',
      activa: true,
      fondoCaja: '0.00',
    });
  const editar = (est: EstacionAdministrada) =>
    setForm({
      id: est.id,
      codigo: est.codigo,
      nombre: est.nombre,
      direccion: est.direccion,
      gerenteId: est.gerente?.id ?? '',
      unidades: est.unidades.map((u) => u.codigo),
      codigoEtl: est.codigoEtl ?? '',
      activa: est.activa,
      fondoCaja: est.caja?.fondo ?? '0.00',
    });

  return (
    <div>
      <EncabezadoPagina
        titulo="Empresas y estaciones"
        descripcion="Estructura de la franquicia: empresa, estaciones y unidades de negocio."
        acciones={
          d &&
          edita && (
            <BotonAccion verificacion={d.puedeCrear} onClick={() => nueva(d)}>
              + Nueva estación
            </BotonAccion>
          )
        }
      />
      {consulta.isPending ? (
        <div className="grid gap-[6px]">
          <Esqueleto className="h-20" />
          <div className="grid gap-[6px] md:grid-cols-2">
            <Esqueleto className="h-44" />
            <Esqueleto className="h-44" />
          </div>
        </div>
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          <Tarjeta
            titulo="Empresa"
            acciones={
              edita && (
                <Boton
                  tamano="sm"
                  variante="ghost"
                  onClick={() => setEmpresa({ nombre: consulta.data.empresa.nombre, nit: consulta.data.empresa.nit, franquicia: consulta.data.empresa.franquicia ?? '' })}
                >
                  Editar
                </Boton>
              )
            }
          >
            <dl className="grid gap-4 text-[12px] sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <dt className="text-[11px] text-tenue">Razón social</dt>
                <dd className="font-medium text-tinta">{consulta.data.empresa.nombre}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-tenue">NIT</dt>
                <dd className="text-tinta">{consulta.data.empresa.nit || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-tenue">Franquicia</dt>
                <dd className="text-tinta">{consulta.data.empresa.franquicia || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-tenue">Periodo abierto</dt>
                <dd className="text-tinta">
                  {periodoLabel(consulta.data.periodo)} · {consulta.data.empresa.moneda}
                </dd>
              </div>
            </dl>
          </Tarjeta>

          {consulta.data.estaciones.length === 0 ? (
            <Vacio className="mt-[6px]">
              Todavía no hay estaciones a su alcance.{edita && consulta.data.puedeCrear.ok ? ' Cree la primera con «+ Nueva estación».' : ''}
            </Vacio>
          ) : (
            <div className="mt-[6px] grid gap-[6px] md:grid-cols-2">
              {consulta.data.estaciones.map((est) => (
                <Tarjeta
                  key={est.id}
                  titulo={
                    <span className="flex flex-wrap items-center gap-2">
                      {est.codigo} · {est.nombre}
                      {est.esOficinaCentral && <Insignia tono="violet">Oficina central</Insignia>}
                      {est.demo && <Insignia tono="violet">Ejemplo</Insignia>}
                      {!est.activa && <Insignia>Inactiva</Insignia>}
                    </span>
                  }
                  subtitulo={est.direccion || undefined}
                  acciones={
                    edita && (
                      <Boton tamano="sm" variante="ghost" onClick={() => editar(est)}>
                        Editar
                      </Boton>
                    )
                  }
                >
                  <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] text-tenue">Responsable</dt>
                      <dd className="text-tinta">{est.gerente?.nombre ?? 'Sin responsable'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-tenue">Gasto del mes</dt>
                      <dd className="font-medium tabular-nums text-tinta">{q(est.gastoMes)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-tenue">Ventas del mes</dt>
                      <dd className="tabular-nums text-tinta">{est.ventasMes ? q(est.ventasMes) : 'No aplica'}</dd>
                    </div>
                    {est.ratioPct !== null && (
                      <div>
                        <dt className="text-[11px] text-tenue">Gasto sobre ventas</dt>
                        <dd className="tabular-nums text-tinta">{pct(est.ratioPct, 2)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-[11px] text-tenue">Centros de costo</dt>
                      <dd className="text-tinta">{est.centros}</dd>
                    </div>
                    {est.turnos && (
                      <div>
                        <dt className="text-[11px] text-tenue">Turnos importados</dt>
                        <dd className="text-tinta">
                          {est.turnos.min}–{est.turnos.max}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-[11px] text-tenue">Caja chica</dt>
                      <dd className="tabular-nums text-tinta">
                        {est.caja ? `${est.caja.codigo} · fondo ${q(est.caja.fondo)}${est.caja.activa ? '' : ' (inactiva)'}` : 'No tiene'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-tenue">Código en el ETL</dt>
                      <dd className="font-mono text-tinta">{est.codigoEtl ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {est.unidades.map((u) => (
                      <Insignia key={u.codigo} tono="blue">
                        {u.nombre}
                      </Insignia>
                    ))}
                  </div>
                  {!est.demo && est.ventasMes && (
                    <p className="mt-3 text-[11px] text-tenue">Ventas tomadas de los cierres de caja al {fecha(consulta.data.fechaCorte)}.</p>
                  )}
                </Tarjeta>
              ))}
            </div>
          )}
        </>
      )}

      {form && d && <DialogoEstacion form={form} setForm={setForm} datos={d} />}
      {empresa && <DialogoEmpresa form={empresa} setForm={setEmpresa} />}
    </div>
  );
}

function DialogoEstacion({ form, setForm, datos }: { form: FormEstacion; setForm: (f: FormEstacion | null) => void; datos: EmpresaYEstaciones }) {
  const guardar = useGuardarEstacion();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  const nueva = !form.id;
  async function confirmar() {
    const base = {
      nombre: form.nombre,
      direccion: form.direccion,
      gerenteId: form.gerenteId || null,
      unidades: form.unidades,
      codigoEtl: form.codigoEtl || null,
    };
    try {
      const r = nueva
        ? await guardar.mutateAsync({ nueva: true, cuerpo: { ...base, codigo: form.codigo, fondoCaja: form.fondoCaja.trim() || '0' } })
        : await guardar.mutateAsync({ nueva: false, id: form.id, cuerpo: { ...base, activa: form.activa } });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  // Si el responsable actual ya no está activo, se conserva en la lista para no perderlo al guardar.
  const actual = datos.estaciones.find((x) => x.id === form.id)?.gerente;
  const responsables = actual && !datos.usuarios.some((u) => u.id === actual.id) ? [actual, ...datos.usuarios] : datos.usuarios;
  return (
    <Modal
      abierto
      alCerrar={cerrar}
      titulo={nueva ? 'Nueva estación' : `Editar ${form.codigo}`}
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
        <Campo etiqueta="Código" pista="2 a 8 letras o números; se usa en los centros de costo" htmlFor="est-codigo" error={errorDe(e, 'codigo')}>
          <Entrada id="est-codigo" className="uppercase" disabled={!nueva} value={form.codigo} onChange={(ev) => setForm({ ...form, codigo: ev.target.value.toUpperCase() })} />
        </Campo>
        <Campo etiqueta="Responsable" htmlFor="est-gerente" error={errorDe(e, 'gerenteId')}>
          <Seleccion id="est-gerente" value={form.gerenteId} onChange={(ev) => setForm({ ...form, gerenteId: ev.target.value })}>
            <option value="">Sin responsable</option>
            {responsables.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Nombre" className="sm:col-span-2" htmlFor="est-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="est-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Dirección" className="sm:col-span-2" htmlFor="est-dir" error={errorDe(e, 'direccion')}>
          <Entrada id="est-dir" value={form.direccion} onChange={(ev) => setForm({ ...form, direccion: ev.target.value })} />
        </Campo>
        <Campo
          etiqueta="Estación en el ETL"
          pista="La liga con sus ventas y turnos. Sin estación del ETL no tiene datos operativos."
          className="sm:col-span-2"
          htmlFor="est-etl"
          error={errorDe(e, 'codigoEtl')}
        >
          <Seleccion id="est-etl" value={form.codigoEtl} onChange={(ev) => setForm({ ...form, codigoEtl: ev.target.value })}>
            <option value="">Sin datos operativos</option>
            {datos.estacionesEtl.map((x) => {
              const otra = x.estacionId !== null && x.estacionId !== form.id;
              return (
                <option key={x.codigo} value={x.codigo} disabled={otra}>
                  {x.codigo} · {x.nombre}
                  {otra ? ' (ligada a otra estación)' : ''}
                </option>
              );
            })}
          </Seleccion>
        </Campo>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[11px] font-medium text-tenue">Unidades de negocio (se crea un centro de costo por cada una)</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {datos.unidades.map((u) => (
              <label key={u.codigo} className="flex items-center gap-2 text-[12px] text-tinta">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={form.unidades.includes(u.codigo)}
                  onChange={(ev) =>
                    setForm({ ...form, unidades: ev.target.checked ? [...form.unidades, u.codigo] : form.unidades.filter((x) => x !== u.codigo) })
                  }
                />
                {u.nombre}
              </label>
            ))}
          </div>
          {errorDe(e, 'unidades') && <p className="mt-1 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'unidades')}</p>}
        </fieldset>
        {nueva ? (
          <Campo etiqueta="Fondo de caja chica (Q)" pista="0 si no tendrá caja chica" htmlFor="est-fondo" error={errorDe(e, 'fondoCaja')}>
            <Entrada id="est-fondo" inputMode="decimal" className="tabular-nums" value={form.fondoCaja} onChange={(ev) => setForm({ ...form, fondoCaja: ev.target.value })} />
          </Campo>
        ) : (
          <label className="flex items-center gap-2 text-[12px] text-tinta">
            <input type="checkbox" className="size-4" checked={form.activa} onChange={(ev) => setForm({ ...form, activa: ev.target.checked })} />
            Activa
          </label>
        )}
      </div>
    </Modal>
  );
}

function DialogoEmpresa({ form, setForm }: { form: FormEmpresa; setForm: (f: FormEmpresa | null) => void }) {
  const guardar = useGuardarEmpresa();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  async function confirmar() {
    try {
      const r = await guardar.mutateAsync({ nombre: form.nombre, nit: form.nit, franquicia: form.franquicia.trim() || null });
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
      titulo="Editar empresa"
      descripcion="El nombre de la empresa sale en el encabezado de la aplicación."
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
        <Campo etiqueta="Razón social" className="sm:col-span-2" htmlFor="emp-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="emp-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="NIT" htmlFor="emp-nit" error={errorDe(e, 'nit')}>
          <Entrada id="emp-nit" value={form.nit} onChange={(ev) => setForm({ ...form, nit: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Franquicia" htmlFor="emp-fran" error={errorDe(e, 'franquicia')}>
          <Entrada id="emp-fran" value={form.franquicia} onChange={(ev) => setForm({ ...form, franquicia: ev.target.value })} />
        </Campo>
      </div>
    </Modal>
  );
}
