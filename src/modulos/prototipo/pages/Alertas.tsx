'use client';

import { useMemo, useState } from 'react';
import { Link } from '../lib/router';
import { Aviso, Badge, Button, Card, Empty, PageHeader, SeveridadBadge } from '../components/ui';
import { fecha, q } from '../lib/format';
import { tiene } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { calcularAlertas, type TipoAlerta } from '../lib/selectors';
import type { EstadoHallazgo } from '../types';

const TIPOS: Record<TipoAlerta, string> = {
  presupuesto: 'Presupuesto',
  comprobante: 'Comprobantes',
  vencimiento: 'Pagos por vencer',
  autorizacion: 'Autorizaciones atrasadas',
  caja: 'Caja chica',
  contrato: 'Contratos',
  recurrente: 'Recurrentes',
};

const ESTADO_H: Record<EstadoHallazgo, [string, 'red' | 'amber' | 'green']> = {
  abierta: ['Abierto', 'red'],
  en_revision: ['En revisión', 'amber'],
  cerrada: ['Cerrado', 'green'],
};

/** Dos pantallas con permisos distintos: alertas del control de gastos y hallazgos de los reportes de la estación. */
export default function Alertas({ vista = 'alertas' }: { vista?: 'alertas' | 'hallazgos' }) {
  const { db, usuario, estacionFiltro, acciones } = useStore();
  const c = useCatalogos();
  const tab = vista;
  const [tipo, setTipo] = useState<TipoAlerta | ''>('');
  const alertas = useMemo(() => calcularAlertas(db, usuario, estacionFiltro), [db, usuario, estacionFiltro]);
  const hallazgos = db.hallazgos.filter((h) => estacionFiltro === 'ALL' || h.estacionId === estacionFiltro);
  const gestiona = tiene(db, usuario, 'auditar');
  const lista = alertas.filter((a) => !tipo || a.tipo === tipo);
  const conteo = (t: TipoAlerta) => alertas.filter((a) => a.tipo === t).length;

  return (
    <div>
      {tab === 'alertas' ? (
        <PageHeader title="Alertas" description={`Avisos automáticos del control de gastos de sus estaciones (${alertas.length} activas).`} />
      ) : (
        <PageHeader
          title="Hallazgos de reportes"
          description={`Riesgos encontrados al analizar los reportes del sistema de la estación (${hallazgos.filter((h) => h.estado !== 'cerrada').length} abiertos).${gestiona ? '' : ' Solo consulta: el seguimiento lo da auditoría.'}`}
        />
      )}

      {tab === 'alertas' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTipo('')}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${!tipo ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-slate-300 dark:ring-slate-700'}`}
            >
              Todas ({alertas.length})
            </button>
            {(Object.keys(TIPOS) as TipoAlerta[])
              .filter((t) => conteo(t) > 0)
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${tipo === t ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-slate-300 dark:ring-slate-700'}`}
                >
                  {TIPOS[t]} ({conteo(t)})
                </button>
              ))}
          </div>
          <Card>
            {lista.length === 0 ? (
              <Empty>Sin alertas para este filtro.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {lista.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 gap-2 sm:w-44">
                      <SeveridadBadge s={a.severidad} />
                      <Badge>{TIPOS[a.tipo]}</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.titulo}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {c.estCodigo(a.estacionId)} · {a.detalle}
                      </p>
                    </div>
                    <Link to={a.ruta} className="shrink-0 text-sm font-medium text-brand-600 dark:text-brand-300 hover:underline">
                      Revisar →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Las alertas se calculan con los parámetros de Configuración (presupuesto al {db.config.alertaPresupuestoPct} %, pagos a {db.config.diasAlertaVencimiento} días,
            autorizaciones con más de {db.config.diasAlertaPendiente} días). En producción se enviarían por correo o WhatsApp.
          </p>
        </>
      )}

      {tab === 'hallazgos' && (
        <>
          <div className="mb-4">
            <Aviso>
              Montos del análisis de los reportes (tickets, facturación, cierres, liquidación, mermas y compras). Son riesgos que se
              traslapan, no se suman. Los que ya son pérdida (merma, descuentos, venta bajo costo) se registran como gastos por autorizar.
            </Aviso>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {hallazgos.map((h) => (
              <Card key={h.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <SeveridadBadge s={h.severidad} />
                    <Badge tone={ESTADO_H[h.estado][1]}>{ESTADO_H[h.estado][0]}</Badge>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {h.fuente} · {fecha(h.fecha)}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">{h.titulo}</p>
                <p className="tabular-nums text-lg font-semibold text-slate-900 dark:text-white">{q(h.monto)}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{h.detalle}</p>
                <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-medium">Acción: </span>
                  {h.accion}
                </p>
                {gestiona && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {h.estado !== 'en_revision' && (
                      <Button size="sm" variant="secondary" onClick={() => acciones.cambiarEstadoHallazgo(h.id, 'en_revision')}>
                        Marcar en revisión
                      </Button>
                    )}
                    {h.estado !== 'cerrada' ? (
                      <Button size="sm" variant="success" onClick={() => acciones.cambiarEstadoHallazgo(h.id, 'cerrada')}>
                        Cerrar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => acciones.cambiarEstadoHallazgo(h.id, 'abierta')}>
                        Reabrir
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
