'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { Aviso, Esqueleto } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, periodoLabel } from '@/lib/formato';
import { type Configuracion, type CuerpoConfiguracion, useConfiguracion, useGuardarConfiguracion } from '../datos';

type Form = Omit<CuerpoConfiguracion, 'niveles'> & { niveles: { orden: number; hasta: string | null }[] };

function desde(d: Configuracion): Form {
  const p = d.parametros;
  return {
    version: d.version,
    fechaSistema: p.fechaSistema,
    periodoActual: p.periodoActual,
    comprobanteObligatorioDesde: p.comprobanteObligatorioDesde,
    limiteDesembolsoCaja: p.limiteDesembolsoCaja,
    alertaPresupuestoPct: p.alertaPresupuestoPct,
    diasAlertaVencimiento: p.diasAlertaVencimiento,
    diasAlertaPendiente: p.diasAlertaPendiente,
    criterioProrrateo: p.criterioProrrateo,
    tasaComisionTarjetaPct: p.tasaComisionTarjetaPct,
    toleranciaMermaPct: p.toleranciaMermaPct,
    niveles: d.niveles.map((n) => ({ orden: n.orden, hasta: n.hasta })),
  };
}

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo || e.campo.startsWith(`${campo}.`))?.mensaje : undefined;
}

const entero = (v: string) => (v === '' ? 0 : Math.trunc(Number(v)) || 0);

export function PantallaConfiguracion() {
  const consulta = useConfiguracion();
  const guardar = useGuardarConfiguracion();
  const [borrador, setBorrador] = useState<Form | null>(null);
  const d = consulta.data;
  const cfg = borrador ?? (d ? desde(d) : null);
  const puede = d?.puedeEditar ?? false;
  const e = guardar.error;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => cfg && setBorrador({ ...cfg, [k]: v });

  async function confirmar() {
    if (!cfg || !d) return;
    // Solo se envían los niveles que esta persona puede cambiar; el resto queda como está.
    const niveles = d.puedeEditarNiveles
      ? cfg.niveles.filter((n) => d.niveles.find((x) => x.orden === n.orden)?.puedeCambiar.ok)
      : [];
    try {
      const r = await guardar.mutateAsync({ ...cfg, niveles });
      toast.success(r.mensaje);
      setBorrador(null);
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Configuración y parámetros"
        descripcion="Reglas de negocio que usa toda la aplicación: niveles de autorización, control documental, caja chica, alertas y prorrateo."
        acciones={
          puede && (
            <>
              <Boton variante="ghost" onClick={() => setBorrador(null)} disabled={!borrador || guardar.isPending}>
                Descartar
              </Boton>
              <Boton onClick={confirmar} cargando={guardar.isPending} disabled={!cfg}>
                Guardar cambios
              </Boton>
            </>
          )
        }
      />
      {consulta.isPending ? (
        <div className="grid gap-[6px] lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Esqueleto key={i} className="h-40" />
          ))}
        </div>
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        cfg &&
        d && (
          <>
            {!puede && <Aviso tono="amber" className="mb-[6px]">Solo el super administrador modifica estos parámetros. Usted puede consultarlos.</Aviso>}
            <fieldset disabled={!puede || guardar.isPending} className="grid gap-[6px] lg:grid-cols-2">
              <Tarjeta titulo="Fecha y periodo" subtitulo="Si no fija una fecha, se usa la fecha real de Guatemala; fíjela si necesita registrar con otra fecha">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Param label="Fecha del sistema" hint="Fecha con la que se registran gastos, aprobaciones y pagos" id="cfg-hoy" error={errorDe(e, 'fechaSistema')}>
                    <Entrada
                      id="cfg-hoy"
                      type="date"
                      value={cfg.fechaSistema ?? d.parametros.hoy}
                      disabled={cfg.fechaSistema === null}
                      onChange={(ev) => set('fechaSistema', ev.target.value || null)}
                    />
                    <label className="mt-1 flex items-center gap-2 text-[11px] text-tinta">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={cfg.fechaSistema === null}
                        onChange={(ev) => set('fechaSistema', ev.target.checked ? null : d.parametros.hoy)}
                      />
                      Usar la fecha real
                    </label>
                  </Param>
                  <Param label="Periodo abierto" id="cfg-periodo" error={errorDe(e, 'periodoActual')}>
                    <Entrada id="cfg-periodo" type="month" value={cfg.periodoActual} onChange={(ev) => set('periodoActual', ev.target.value)} />
                  </Param>
                </div>
              </Tarjeta>

              <Tarjeta titulo="Niveles de autorización por monto">
                {cfg.niveles.length === 0 ? (
                  <p className="text-[12px] text-tenue">Todavía no hay niveles de autorización definidos.</p>
                ) : (
                  <div className="space-y-3">
                    {cfg.niveles.map((n, i) => {
                      const nivel = d.niveles.find((x) => x.orden === n.orden);
                      const cambia = d.puedeEditarNiveles && (nivel?.puedeCambiar.ok ?? false);
                      return (
                        <div key={n.orden} className="grid grid-cols-2 items-end gap-3">
                          <div>
                            <p className="text-[11px] text-tenue">Nivel {i + 1}</p>
                            <p className="text-[12px] font-medium text-tinta">{nivel?.etiqueta}</p>
                          </div>
                          {n.hasta === null ? (
                            <p className="pb-2 text-[12px] text-tenue">Sin límite</p>
                          ) : (
                            <Campo
                              etiqueta="Autoriza hasta (Q)"
                              htmlFor={`cfg-nivel-${n.orden}`}
                              pista={!cambia ? (nivel?.puedeCambiar.motivo || (!d.puedeEditarNiveles ? 'Lo cambia quien además administra usuarios y roles' : undefined)) : undefined}
                            >
                              <Entrada
                                id={`cfg-nivel-${n.orden}`}
                                inputMode="decimal"
                                className="tabular-nums"
                                disabled={!cambia}
                                value={n.hasta}
                                onChange={(ev) => set('niveles', cfg.niveles.map((x, j) => (j === i ? { ...x, hasta: ev.target.value } : x)))}
                              />
                            </Campo>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {errorDe(e, 'niveles') && <p className="mt-2 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'niveles')}</p>}
                <p className="mt-3 text-[11px] text-tenue">Al guardar, el límite de cada rol se actualiza. Quien solicita nunca autoriza su propio gasto.</p>
              </Tarjeta>

              <Tarjeta titulo="Control documental y caja chica">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Param label="Comprobante obligatorio desde (Q)" id="cfg-comp" error={errorDe(e, 'comprobanteObligatorioDesde')}>
                    <Entrada id="cfg-comp" inputMode="decimal" className="tabular-nums" value={cfg.comprobanteObligatorioDesde} onChange={(ev) => set('comprobanteObligatorioDesde', ev.target.value)} />
                  </Param>
                  <Param label="Tope por desembolso de caja chica (Q)" id="cfg-caja" error={errorDe(e, 'limiteDesembolsoCaja')}>
                    <Entrada id="cfg-caja" inputMode="decimal" className="tabular-nums" value={cfg.limiteDesembolsoCaja} onChange={(ev) => set('limiteDesembolsoCaja', ev.target.value)} />
                  </Param>
                </div>
              </Tarjeta>

              <Tarjeta titulo="Alertas">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Param label="Presupuesto al (%)" id="cfg-pres" error={errorDe(e, 'alertaPresupuestoPct')}>
                    <Entrada id="cfg-pres" inputMode="decimal" className="tabular-nums" value={cfg.alertaPresupuestoPct} onChange={(ev) => set('alertaPresupuestoPct', ev.target.value)} />
                  </Param>
                  <Param label="Pagos que vencen en (días)" id="cfg-venc" error={errorDe(e, 'diasAlertaVencimiento')}>
                    <Entrada id="cfg-venc" type="number" min={0} className="tabular-nums" value={cfg.diasAlertaVencimiento} onChange={(ev) => set('diasAlertaVencimiento', entero(ev.target.value))} />
                  </Param>
                  <Param label="Autorización atrasada tras (días)" id="cfg-pend" error={errorDe(e, 'diasAlertaPendiente')}>
                    <Entrada id="cfg-pend" type="number" min={0} className="tabular-nums" value={cfg.diasAlertaPendiente} onChange={(ev) => set('diasAlertaPendiente', entero(ev.target.value))} />
                  </Param>
                </div>
              </Tarjeta>

              <Tarjeta titulo="Parámetros de operación">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Param label="Prorrateo por defecto" id="cfg-pro" error={errorDe(e, 'criterioProrrateo')}>
                    <Seleccion id="cfg-pro" value={cfg.criterioProrrateo} onChange={(ev) => set('criterioProrrateo', ev.target.value as Form['criterioProrrateo'])}>
                      <option value="ventas">Según ventas</option>
                      <option value="partes_iguales">Partes iguales</option>
                    </Seleccion>
                  </Param>
                  <Param label="Comisión de tarjeta (%)" hint="Para valorizar la comisión por turno" id="cfg-com" error={errorDe(e, 'tasaComisionTarjetaPct')}>
                    <Entrada id="cfg-com" inputMode="decimal" className="tabular-nums" value={cfg.tasaComisionTarjetaPct} onChange={(ev) => set('tasaComisionTarjetaPct', ev.target.value)} />
                  </Param>
                  <Param label="Tolerancia de merma (%)" hint="Diferencia aceptable entre lo vendido y lo medido en el tanque" id="cfg-merma" error={errorDe(e, 'toleranciaMermaPct')}>
                    <Entrada id="cfg-merma" inputMode="decimal" className="tabular-nums" value={cfg.toleranciaMermaPct} onChange={(ev) => set('toleranciaMermaPct', ev.target.value)} />
                  </Param>
                </div>
                <p className="mt-3 text-[11px] text-tenue">
                  Periodo abierto: {periodoLabel(cfg.periodoActual)} · corte de datos {fecha(d.parametros.fechaCorte)} · fecha del sistema {fecha(cfg.fechaSistema ?? d.parametros.hoy)}
                  {cfg.fechaSistema === null ? ' (fecha real)' : ''} · IVA {d.parametros.tasaIvaPct} %.
                </p>
              </Tarjeta>
            </fieldset>
          </>
        )
      )}
    </div>
  );
}

function Param({ label, hint, id, error, children }: { label: string; hint?: string; id: string; error?: string | undefined; children: ReactNode }) {
  return (
    <Campo etiqueta={label} pista={hint} htmlFor={id} error={error}>
      {children}
    </Campo>
  );
}
