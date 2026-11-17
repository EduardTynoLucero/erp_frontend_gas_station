'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton, BotonAccion } from '@/componentes/ui/boton';
import { Insignia, InsigniaSeveridad } from '@/componentes/ui/insignia';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, q } from '@/lib/formato';
import { ModalAnalizar, ModalGastoDeHallazgo, ModalNuevoHallazgo } from '../componentes/modales';
import { type EstadoHallazgo, type Hallazgo, useEstadoHallazgo, useHallazgos } from '../datos';

const ESTADO_H: Record<EstadoHallazgo, [string, 'red' | 'amber' | 'green']> = {
  abierta: ['Abierto', 'red'],
  en_revision: ['En revisión', 'amber'],
  cerrada: ['Cerrado', 'green'],
};

export function PantallaHallazgos() {
  const { estacionId } = useErp();
  const consulta = useHallazgos(estacionId);
  const cambiarEstado = useEstadoHallazgo();
  const [modal, setModal] = useState<{ tipo: 'nuevo' } | { tipo: 'analizar' } | { tipo: 'gasto'; hallazgo: Hallazgo } | null>(null);
  const d = consulta.data;

  async function estado(h: Hallazgo, nuevo: EstadoHallazgo) {
    try {
      const r = await cambiarEstado.mutateAsync({ id: h.id, estado: nuevo });
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }
  const ocupado = (h: Hallazgo) => cambiarEstado.isPending && cambiarEstado.variables?.id === h.id;

  return (
    <div>
      <EncabezadoPagina
        titulo="Hallazgos de reportes"
        descripcion={`Riesgos encontrados al analizar los reportes del sistema de la estación${d ? ` (${d.abiertos} abiertos)` : ''}.${
          d && !d.gestiona ? ' Solo consulta: el seguimiento lo da auditoría.' : ''
        }`}
        acciones={
          d?.gestiona && (
            <>
              <Boton variante="ghost" onClick={() => setModal({ tipo: 'analizar' })}>
                Analizar reportes
              </Boton>
              <Boton
                onClick={() => setModal({ tipo: 'nuevo' })}
                disabled={!d.estaciones.length}
                title={d.estaciones.length ? undefined : 'No tiene estaciones activas a su cargo'}
              >
                + Registrar hallazgo
              </Boton>
            </>
          )
        }
      />

      <div className="mb-[6px]">
        <Aviso>
          Montos del análisis de los reportes (tickets, facturación, cierres, liquidación, mermas y compras). Son riesgos que se traslapan, no se suman. Los que
          ya son pérdida (merma, descuentos, venta bajo costo) se registran como gastos por autorizar.
        </Aviso>
      </div>

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : consulta.data.hallazgos.length === 0 ? (
        <Vacio>
          Todavía no hay hallazgos{estacionId ? ' en esta estación' : ' en las estaciones que puede ver'}. Un hallazgo es un riesgo encontrado en los reportes
          de la estación (precios fuera de pricebook, tickets duplicados o faltantes, venta bajo costo, merma por encima de la tolerancia).
          {consulta.data.gestiona
            ? ' Genérelos con «Analizar reportes», que revisa los reportes ya cargados del mes, o registre uno a mano con «+ Registrar hallazgo».'
            : ' Los genera y les da seguimiento auditoría.'}
        </Vacio>
      ) : (
        <div className="grid gap-[6px] md:grid-cols-2">
          {consulta.data.hallazgos.map((h) => (
            <Tarjeta key={h.id}>
              <div className="flex flex-wrap items-center justify-between gap-[6px]">
                <div className="flex gap-[6px]">
                  <InsigniaSeveridad severidad={h.severidad} />
                  <Insignia tono={ESTADO_H[h.estado][1]}>{ESTADO_H[h.estado][0]}</Insignia>
                  <Insignia tono="violet">{h.origen === 'ETL' ? 'Análisis de reportes' : 'Manual'}</Insignia>
                </div>
                <span className="text-[11px] text-tenue">
                  {h.codigo} · {h.estacion.codigo} · {h.fuente ? `${h.fuente} · ` : ''}
                  {fecha(h.fecha)}
                </span>
              </div>
              <p className="mt-[6px] text-[12px] font-semibold text-tinta">{h.titulo}</p>
              <p className="text-[17px] font-bold tabular-nums text-tinta">{h.monto === null ? <span className="text-[12px] font-normal text-tenue">Sin valorar en quetzales</span> : q(h.monto)}</p>
              {h.detalle && <p className="mt-[3px] text-[12px] text-tinta-suave">{h.detalle}</p>}
              {h.accion && (
                <p className="mt-[6px] text-[12px] text-tinta">
                  <span className="font-semibold">Acción: </span>
                  {h.accion}
                </p>
              )}
              {h.gasto && (
                <p className="mt-[6px] text-[11px] text-tenue">
                  Pérdida registrada como gasto{' '}
                  {h.gasto.folio ? (
                    <Link href={`/gastos/${h.gasto.id}`} className="font-semibold text-primario-tinta hover:underline">
                      {h.gasto.folio}
                    </Link>
                  ) : (
                    '(no visible para usted)'
                  )}
                  .
                </p>
              )}
              {(consulta.data.gestiona || (consulta.data.puedeRegistrarGasto && !h.gasto)) && (
                <div className="mt-[8px] flex flex-wrap gap-[6px]">
                  {consulta.data.gestiona && (
                    <>
                      {h.estado !== 'en_revision' && (
                        <Boton tamano="sm" variante="secondary" disabled={ocupado(h)} onClick={() => estado(h, 'en_revision')}>
                          Marcar en revisión
                        </Boton>
                      )}
                      {h.estado !== 'cerrada' ? (
                        <Boton tamano="sm" variante="success" disabled={ocupado(h)} onClick={() => estado(h, 'cerrada')}>
                          Cerrar
                        </Boton>
                      ) : (
                        <Boton tamano="sm" variante="ghost" disabled={ocupado(h)} onClick={() => estado(h, 'abierta')}>
                          Reabrir
                        </Boton>
                      )}
                    </>
                  )}
                  {consulta.data.puedeRegistrarGasto && !h.gasto && (
                    <BotonAccion
                      tamano="sm"
                      variante="secondary"
                      verificacion={h.acciones.registrarGasto}
                      onClick={() => setModal({ tipo: 'gasto', hallazgo: h })}
                    >
                      Registrar pérdida como gasto
                    </BotonAccion>
                  )}
                </div>
              )}
            </Tarjeta>
          ))}
        </div>
      )}

      {d && modal?.tipo === 'nuevo' && <ModalNuevoHallazgo datos={d} estacionInicial={estacionId} alCerrar={() => setModal(null)} />}
      {d && modal?.tipo === 'analizar' && <ModalAnalizar datos={d} alCerrar={() => setModal(null)} />}
      {d && modal?.tipo === 'gasto' && <ModalGastoDeHallazgo datos={d} hallazgo={modal.hallazgo} alCerrar={() => setModal(null)} />}
    </div>
  );
}
