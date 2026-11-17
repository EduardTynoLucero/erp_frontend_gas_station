'use client';

/**
 * Comprobante de un gasto ya enviado: el documento (factura FEL o recibo) y, si se tiene, la foto o el PDF. El archivo
 * se sube al elegirlo y queda guardado en la base; al guardar el comprobante se manda su id. Si el diálogo se cierra
 * sin guardar, el archivo que se había subido se quita.
 */
import { Paperclip, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import type { GastoDetalle, TipoDocumento } from '@/api/tipos';
import { Boton, clasesBoton } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Modal } from '@/componentes/ui/modal';
import { type Adjunto, quitarAdjunto, subirAdjunto, TIPOS_ADJUNTO, useAccionGasto } from '../datos';

function errorDeCampo(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

export function DialogoComprobante({ gasto, abierto, hoy, alCerrar }: { gasto: GastoDetalle; abierto: boolean; hoy: string; alCerrar: () => void }) {
  const accion = useAccionGasto();
  const actual = gasto.documento;
  const [tipo, setTipo] = useState<Exclude<TipoDocumento, 'Sin documento'>>('FEL');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [fechaEmision, setFechaEmision] = useState(hoy);
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Al abrir: lo que ya tiene el gasto (para corregirlo) o un comprobante nuevo
  useEffect(() => {
    if (!abierto) return;
    const sinDocumento = actual.tipo === 'Sin documento';
    setTipo(actual.tipo === 'Recibo' ? 'Recibo' : 'FEL');
    setSerie(sinDocumento ? '' : actual.serie);
    setNumero(sinDocumento ? '' : actual.numero);
    setFechaEmision(sinDocumento ? hoy : (actual.fechaEmision ?? hoy));
    setAdjunto(actual.adjunto);
    accion.reset();
    // Solo al abrir: mientras está abierto, lo que escribe la persona manda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  /** El archivo recién subido que todavía no es del gasto: si se descarta, se quita de la base */
  const esNuevo = (a: Adjunto | null) => a !== null && a.id !== actual.adjunto?.id;

  async function elegir(archivo: File) {
    setSubiendo(true);
    try {
      const subido = await subirAdjunto(archivo);
      if (esNuevo(adjunto)) void quitarAdjunto(adjunto!.id);
      setAdjunto(subido);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  function quitar() {
    if (esNuevo(adjunto)) void quitarAdjunto(adjunto!.id);
    setAdjunto(null);
  }

  function cerrar() {
    if (esNuevo(adjunto)) void quitarAdjunto(adjunto!.id);
    accion.reset();
    alCerrar();
  }

  async function guardar() {
    try {
      const r = await accion.mutateAsync({
        tipo: 'comprobante',
        id: gasto.id,
        comprobante: { tipo, serie: tipo === 'FEL' ? serie : '', numero, fechaEmision: fechaEmision || null, adjuntoId: adjunto?.id ?? null },
      });
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
      alCerrar={cerrar}
      titulo={`Comprobante de ${gasto.folio}`}
      descripcion="El documento que respalda el gasto y, si lo tiene, su foto o PDF."
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={accion.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={guardar} cargando={accion.isPending} disabled={subiendo}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Tipo" htmlFor="docTipo">
          <Seleccion id="docTipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="FEL">Factura FEL</option>
            <option value="Recibo">Recibo</option>
          </Seleccion>
        </Campo>
        <Campo etiqueta="Fecha de emisión" htmlFor="docFecha" error={errorDeCampo(accion.error, 'fechaEmision')}>
          <Entrada id="docFecha" type="date" max={hoy} value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
        </Campo>
        {tipo === 'FEL' && (
          <Campo etiqueta="Serie" htmlFor="docSerie" error={errorDeCampo(accion.error, 'serie')}>
            <Entrada id="docSerie" value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} />
          </Campo>
        )}
        <Campo etiqueta="Número" htmlFor="docNumero" error={errorDeCampo(accion.error, 'numero')} className={tipo === 'FEL' ? '' : 'sm:col-span-2'}>
          <Entrada id="docNumero" value={numero} onChange={(e) => setNumero(e.target.value)} invalido={!!errorDeCampo(accion.error, 'numero')} />
        </Campo>
      </div>

      <div className="mt-4">
        <p className="mb-[3px] text-[11px] font-semibold leading-[1.2] text-tenue">Foto o PDF del comprobante</p>
        {adjunto ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-[5px] truncate rounded-[2px] border border-borde-suave bg-barra px-[7px] py-[3px] text-[11px] text-tinta">
              <Paperclip className="size-[11px] shrink-0" aria-hidden />
              <span className="truncate">{adjunto.nombre}</span>
            </span>
            <button type="button" className="inline-flex cursor-pointer items-center gap-[3px] text-[11px] font-semibold text-[#c20510] hover:underline dark:text-red-400" onClick={quitar}>
              <X className="size-[11px]" aria-hidden /> Quitar
            </button>
          </div>
        ) : (
          <label className={clasesBoton('secondary', 'md', subiendo ? 'pointer-events-none opacity-60' : undefined)}>
            <Paperclip aria-hidden />
            {subiendo ? 'Subiendo…' : 'Adjuntar foto o PDF'}
            <input
              type="file"
              accept={TIPOS_ADJUNTO.join(',')}
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = '';
                if (archivo) void elegir(archivo);
              }}
            />
          </label>
        )}
        <p className="mt-[3px] text-[11px] text-tenue">JPG, PNG, WEBP, GIF, HEIC o PDF, de hasta 5 MB.</p>
        {errorDeCampo(accion.error, 'adjuntoId') && (
          <p role="alert" className="mt-[3px] text-[11px] font-medium text-[#a51d17] dark:text-red-400">
            {errorDeCampo(accion.error, 'adjuntoId')}
          </p>
        )}
      </div>
    </Modal>
  );
}
