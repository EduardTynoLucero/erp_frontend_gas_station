'use client';

/** Diálogos de acción sobre un gasto (aprobar/rechazar, pagar, eliminar). Textos del prototipo. */
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import type { GastoResumen } from '@/api/tipos';
import { Boton } from '@/componentes/ui/boton';
import { AreaTexto, Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Modal } from '@/componentes/ui/modal';
import { useAccionGasto, useEliminarGasto } from '../datos';
import { METODOS_DE_PAGO, montoDe, nombreProveedor } from '../etiquetas';

type GastoBasico = Pick<GastoResumen, 'id' | 'folio' | 'descripcion' | 'monto' | 'moneda' | 'proveedor' | 'metodoPago'>;

function errorDeCampo(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

export function DialogoDecision({
  gasto,
  decision,
  alCerrar,
}: {
  gasto: GastoBasico;
  decision: 'aprobar' | 'rechazar' | null;
  alCerrar: () => void;
}) {
  const accion = useAccionGasto();
  const [comentario, setComentario] = useState('');
  const aprobar = decision === 'aprobar';

  async function confirmar() {
    try {
      const r = aprobar
        ? await accion.mutateAsync({ tipo: 'aprobar', id: gasto.id, comentario })
        : await accion.mutateAsync({ tipo: 'rechazar', id: gasto.id, comentario });
      toast.success(r.mensaje);
      setComentario('');
      accion.reset();
      alCerrar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <Modal
      abierto={decision !== null}
      alCerrar={() => {
        accion.reset();
        alCerrar();
      }}
      titulo={`${aprobar ? 'Aprobar' : 'Rechazar'} ${gasto.folio}`}
      pie={
        <>
          <Boton variante="ghost" onClick={alCerrar} disabled={accion.isPending}>
            Cancelar
          </Boton>
          {aprobar ? (
            <Boton variante="success" onClick={confirmar} cargando={accion.isPending}>
              Aprobar {montoDe(gasto)}
            </Boton>
          ) : (
            <Boton variante="danger" onClick={confirmar} cargando={accion.isPending}>
              Rechazar
            </Boton>
          )}
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{gasto.descripcion}</p>
      <Campo etiqueta={aprobar ? 'Comentario (opcional)' : 'Motivo del rechazo'} htmlFor="comentario" error={errorDeCampo(accion.error, 'comentario')}>
        <AreaTexto id="comentario" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} invalido={!!errorDeCampo(accion.error, 'comentario')} />
      </Campo>
    </Modal>
  );
}

export function DialogoPago({ gasto, abierto, hoy, alCerrar }: { gasto: GastoBasico; abierto: boolean; hoy: string; alCerrar: () => void }) {
  const accion = useAccionGasto();
  const [fechaPago, setFechaPago] = useState(hoy);
  const [metodo, setMetodo] = useState(gasto.metodoPago === 'Efectivo' ? 'Efectivo' : 'Transferencia');
  const [referencia, setReferencia] = useState('');

  async function confirmar() {
    try {
      const r = await accion.mutateAsync({ tipo: 'pagar', id: gasto.id, pago: { fecha: fechaPago, metodo, referencia } });
      toast.success(r.mensaje);
      accion.reset();
      alCerrar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={() => {
        accion.reset();
        alCerrar();
      }}
      titulo={`Registrar pago de ${gasto.folio}`}
      pie={
        <>
          <Boton variante="ghost" onClick={alCerrar} disabled={accion.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={accion.isPending}>
            Registrar pago
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha de pago" htmlFor="fechaPago" error={errorDeCampo(accion.error, 'fecha')}>
          <Entrada id="fechaPago" type="date" max={hoy} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
        </Campo>
        <Campo etiqueta="Método" htmlFor="metodoPago" error={errorDeCampo(accion.error, 'metodo')}>
          <Seleccion id="metodoPago" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS_DE_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo
          etiqueta="Referencia"
          htmlFor="referencia"
          className="sm:col-span-2"
          pista="Número de transferencia, cheque o recibo de caja"
          error={errorDeCampo(accion.error, 'referencia')}
        >
          <Entrada id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="No. de transferencia o cheque" />
        </Campo>
      </div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Monto: <b className="tabular-nums text-slate-900 dark:text-white">{montoDe(gasto)}</b> a {nombreProveedor(gasto.proveedor)}
      </p>
    </Modal>
  );
}

export function DialogoEliminar({ gasto, abierto, alCerrar, alEliminar }: { gasto: GastoBasico; abierto: boolean; alCerrar: () => void; alEliminar: () => void }) {
  const eliminar = useEliminarGasto();
  async function confirmar() {
    try {
      const r = await eliminar.mutateAsync(gasto.id);
      toast.success(r.mensaje);
      alEliminar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }
  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={`Eliminar borrador ${gasto.folio}`}
      pie={
        <>
          <Boton variante="ghost" onClick={alCerrar} disabled={eliminar.isPending}>
            Cancelar
          </Boton>
          <Boton variante="danger" onClick={confirmar} cargando={eliminar.isPending}>
            Eliminar
          </Boton>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">El borrador se borra y queda constancia en la bitácora. Esta acción no se puede deshacer.</p>
    </Modal>
  );
}
