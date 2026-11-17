'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Insignia, InsigniaSeveridad } from '@/componentes/ui/insignia';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type TipoAlerta, useAlertas } from '../datos';

const TIPOS: Record<TipoAlerta, string> = {
  presupuesto: 'Presupuesto',
  comprobante: 'Comprobantes',
  vencimiento: 'Pagos por vencer',
  autorizacion: 'Autorizaciones atrasadas',
  caja: 'Caja chica',
  contrato: 'Contratos',
  recurrente: 'Recurrentes',
};

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'h-[24px] cursor-pointer rounded-full border px-[10px] text-[11px] font-semibold',
        activo ? 'border-primario bg-primario text-white' : 'border-borde-campo bg-superficie text-tinta-suave hover:border-primario hover:text-primario-tinta',
      )}
    >
      {children}
    </button>
  );
}

export function PantallaAlertas() {
  const { estacionId } = useErp();
  const consulta = useAlertas(estacionId);
  const [tipo, setTipo] = useState<TipoAlerta | ''>('');
  const d = consulta.data;
  const conteo = (t: TipoAlerta) => d?.conteo[t] ?? 0;
  const lista = d ? d.alertas.filter((a) => !tipo || a.tipo === tipo) : [];

  return (
    <div>
      <EncabezadoPagina
        titulo="Alertas"
        descripcion={`Avisos automáticos del control de gastos de sus estaciones${d ? ` (${d.alertas.length} activas)` : ''}.`}
      />

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <>
          <div className="mb-[6px] flex flex-wrap gap-[6px]">
            <Chip activo={!tipo} onClick={() => setTipo('')}>
              Todas ({consulta.data.alertas.length})
            </Chip>
            {(Object.keys(TIPOS) as TipoAlerta[])
              .filter((t) => conteo(t) > 0)
              .map((t) => (
                <Chip key={t} activo={tipo === t} onClick={() => setTipo(t)}>
                  {TIPOS[t]} ({conteo(t)})
                </Chip>
              ))}
          </div>
          <Tarjeta>
            {lista.length === 0 ? (
              <Vacio>
                {consulta.data.alertas.length === 0
                  ? `No hay alertas${estacionId ? ' en esta estación' : ''}: ningún presupuesto por agotarse, gasto sin comprobante, pago por vencer, autorización atrasada, caja chica con saldo bajo, contrato por vencer ni recurrente próximo.`
                  : 'Sin alertas para este filtro.'}
              </Vacio>
            ) : (
              <ul className="divide-y divide-borde-suave">
                {lista.map((a) => (
                  <li key={a.id} className="flex flex-col gap-[6px] py-[8px] first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 gap-[6px] sm:w-[220px]">
                      <InsigniaSeveridad severidad={a.severidad} />
                      <Insignia>{TIPOS[a.tipo]}</Insignia>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-tinta">
                        {a.titulo}
                        {a.monto !== null && <span className="ml-[6px] font-normal tabular-nums text-tenue">{q(a.monto)}</span>}
                      </p>
                      <p className="text-[11px] text-tenue">
                        {a.estacion.codigo} · {a.detalle}
                      </p>
                    </div>
                    <Link href={a.ruta} className="shrink-0 text-[12px] font-semibold text-primario-tinta hover:underline">
                      Revisar →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <p className="mt-[6px] text-[11px] text-tenue">
            Las alertas se calculan con los parámetros de Configuración (presupuesto al {consulta.data.parametros.alertaPresupuestoPct} %, pagos a{' '}
            {consulta.data.parametros.diasAlertaVencimiento} días, autorizaciones con más de {consulta.data.parametros.diasAlertaPendiente} días).
          </p>
        </>
      )}
    </div>
  );
}
