'use client';

import { useState, type ReactNode } from 'react';
import { Aviso, Button, Card, Field, inputCls, Modal, PageHeader } from '../components/ui';
import { fecha, periodoLabel } from '../lib/format';
import { tiene } from '../lib/reglas';
import { useStore } from '../lib/store';
import type { Config } from '../types';

export default function Configuracion() {
  const { db, usuario, acciones, restablecer } = useStore();
  const [cfg, setCfg] = useState<Config>(db.config);
  const [confirmar, setConfirmar] = useState(false);
  const puede = tiene(db, usuario, 'configurar');
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div>
      <PageHeader
        title="Configuración y parámetros"
        description="Reglas de negocio que usa toda la aplicación: niveles de autorización, control documental, caja chica, alertas y prorrateo."
        actions={
          puede && (
            <>
              <Button variant="ghost" onClick={() => setCfg(db.config)}>
                Descartar
              </Button>
              <Button onClick={() => acciones.guardarConfig({ ...cfg, niveles: db.config.niveles.map((n, i) => ({ ...n, hasta: cfg.niveles[i]?.hasta ?? n.hasta })) })}>
                Guardar cambios
              </Button>
            </>
          )
        }
      />
      {!puede && (
        <div className="mb-4">
          <Aviso tone="amber">Solo el super administrador modifica estos parámetros. Usted puede consultarlos.</Aviso>
        </div>
      )}
      <fieldset disabled={!puede} className="grid gap-4 lg:grid-cols-2">
        <Card title="Fecha y periodo" subtitle="La primera vez toma la fecha de esta computadora; cámbiela si necesita registrar con otra fecha">
          <div className="grid gap-3 sm:grid-cols-2">
            <Param label="Fecha del sistema" hint="Fecha con la que se registran gastos, aprobaciones y pagos">
              <input type="date" className={inputCls} value={cfg.hoy} onChange={(e) => set('hoy', e.target.value)} />
            </Param>
            <Param label="Periodo abierto">
              <input type="month" className={inputCls} value={cfg.periodoActual} onChange={(e) => set('periodoActual', e.target.value)} />
            </Param>
          </div>
        </Card>

        <Card title="Niveles de autorización por monto">
          <div className="space-y-3">
            {cfg.niveles.map((n, i) => (
              <div key={n.rolId} className="grid grid-cols-2 items-end gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nivel {i + 1}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.etiqueta}</p>
                </div>
                {n.hasta === null ? (
                  <p className="pb-2 text-sm text-slate-600 dark:text-slate-300">Sin límite</p>
                ) : (
                  <Field label="Autoriza hasta (Q)">
                    <input
                      type="number"
                      className={`${inputCls} tabular-nums`}
                      value={n.hasta}
                      onChange={(e) => set('niveles', cfg.niveles.map((x, j) => (j === i ? { ...x, hasta: num(e.target.value) } : x)))}
                    />
                  </Field>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Al guardar, el límite de cada rol se actualiza. Quien solicita nunca autoriza su propio gasto.</p>
        </Card>

        <Card title="Control documental y caja chica">
          <div className="grid gap-3 sm:grid-cols-2">
            <Param label="Comprobante obligatorio desde (Q)">
              <input type="number" className={`${inputCls} tabular-nums`} value={cfg.comprobanteObligatorioDesde} onChange={(e) => set('comprobanteObligatorioDesde', num(e.target.value))} />
            </Param>
            <Param label="Tope por desembolso de caja chica (Q)">
              <input type="number" className={`${inputCls} tabular-nums`} value={cfg.limiteDesembolsoCaja} onChange={(e) => set('limiteDesembolsoCaja', num(e.target.value))} />
            </Param>
          </div>
        </Card>

        <Card title="Alertas">
          <div className="grid gap-3 sm:grid-cols-3">
            <Param label="Presupuesto al (%)">
              <input type="number" className={`${inputCls} tabular-nums`} value={cfg.alertaPresupuestoPct} onChange={(e) => set('alertaPresupuestoPct', num(e.target.value))} />
            </Param>
            <Param label="Pagos que vencen en (días)">
              <input type="number" className={`${inputCls} tabular-nums`} value={cfg.diasAlertaVencimiento} onChange={(e) => set('diasAlertaVencimiento', num(e.target.value))} />
            </Param>
            <Param label="Autorización atrasada tras (días)">
              <input type="number" className={`${inputCls} tabular-nums`} value={cfg.diasAlertaPendiente} onChange={(e) => set('diasAlertaPendiente', num(e.target.value))} />
            </Param>
          </div>
        </Card>

        <Card title="Parámetros de operación">
          <div className="grid gap-3 sm:grid-cols-3">
            <Param label="Prorrateo por defecto">
              <select className={inputCls} value={cfg.criterioProrrateo} onChange={(e) => set('criterioProrrateo', e.target.value as Config['criterioProrrateo'])}>
                <option value="ventas">Según ventas</option>
                <option value="partes_iguales">Partes iguales</option>
              </select>
            </Param>
            <Param label="Comisión de tarjeta (%)" hint="Para valorizar la comisión por turno">
              <input
                type="number"
                step="0.1"
                className={`${inputCls} tabular-nums`}
                value={+(cfg.tasaComisionTarjeta * 100).toFixed(2)}
                onChange={(e) => set('tasaComisionTarjeta', num(e.target.value) / 100)}
              />
            </Param>
            <Param label="Tolerancia de merma (%)" hint="Diferencia aceptable entre lo vendido y lo medido en el tanque">
              <input type="number" step="0.1" className={`${inputCls} tabular-nums`} value={cfg.toleranciaMermaPct} onChange={(e) => set('toleranciaMermaPct', num(e.target.value))} />
            </Param>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Periodo abierto: {periodoLabel(cfg.periodoActual)} · corte de datos {fecha(cfg.fechaCorte)} · fecha del sistema {fecha(cfg.hoy)}.
          </p>
        </Card>
      </fieldset>

      {puede && (
        <Card className="mt-4" title="Datos simulados">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Deja en cero las pantallas con datos simulados: borra los gastos, movimientos de caja chica, compras, contratos, presupuestos y
              adjuntos registrados en este navegador y vuelve a los catálogos iniciales. Los datos reales del ERP (registro de gastos,
              autorizaciones, pagos, usuarios) no cambian.
            </p>
            <Button variant="danger" onClick={() => setConfirmar(true)}>
              Restablecer datos
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="¿Restablecer los datos simulados?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await restablecer()) {
                  setConfirmar(false);
                }
              }}
            >
              Sí, restablecer
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Se perderán los gastos, pagos, usuarios y cambios simulados registrados en este navegador. Los datos reales del ERP no cambian.
        </p>
      </Modal>
    </div>
  );
}

function Param({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      {children}
    </Field>
  );
}
