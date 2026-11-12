'use client';

/**
 * Modal «Nuevo gasto o solicitud» y «Editar borrador». Como en la plantilla, lo que se crea o se corrige se hace en un
 * modal sobre el listado (o sobre el detalle), sin salir de la pantalla. Con `gastoId` edita ese borrador.
 */
import type { ReactNode } from 'react';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import type { GastoDetalle } from '@/api/tipos';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, Esqueleto } from '@/componentes/ui/aviso';
import { Modal } from '@/componentes/ui/modal';
import { useCatalogos, useGasto } from '../datos';
import { FormularioGasto } from './formulario-gasto';

export function ModalGasto({
  abierto,
  alCerrar,
  gastoId,
  alGuardado,
}: {
  abierto: boolean;
  alCerrar: () => void;
  /** Borrador que se edita; sin él, el modal registra un gasto nuevo */
  gastoId?: string | undefined;
  alGuardado: (gasto: GastoDetalle, mensaje: string) => void;
}) {
  const { estacionId, perfil } = useErp();
  const editando = Boolean(gastoId);
  const catalogos = useCatalogos(abierto);
  const gasto = useGasto(gastoId ?? '', abierto && editando);
  const registra = perfil.acceso.permisos.includes('registrar');
  const error = catalogos.error ?? (editando ? gasto.error : null);

  let contenido: ReactNode;
  if (!registra || (catalogos.data && catalogos.data.estaciones.length === 0)) {
    contenido = <Aviso tono="amber">Su rol no registra gastos.</Aviso>;
  } else if (error) {
    const noExiste = error instanceof ErrorApi && error.estado === 404;
    contenido = <Aviso tono={noExiste ? 'amber' : 'red'}>{noExiste ? 'No existe o su usuario no tiene acceso a ese gasto.' : mensajeDeError(error)}</Aviso>;
  } else if (!catalogos.data || (editando && !gasto.data)) {
    contenido = <Esqueleto className="h-[380px] w-full" />;
  } else if (editando && !gasto.data!.acciones.editar.ok) {
    contenido = <Aviso tono="amber">Solo se editan borradores propios ({gasto.data!.acciones.editar.motivo})</Aviso>;
  } else {
    contenido = (
      <FormularioGasto
        key={gastoId ?? 'nuevo'}
        catalogos={catalogos.data}
        gasto={editando ? gasto.data : undefined}
        estacionPreferida={estacionId}
        alCancelar={alCerrar}
        alGuardado={alGuardado}
      />
    );
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      tamano="grande"
      titulo={editando ? `Editar ${gasto.data?.folio ?? 'gasto'}` : 'Nuevo gasto o solicitud'}
      descripcion={editando ? 'Corrija los datos y envíelo a autorización.' : 'Registre un gasto con su comprobante, o pida autorización antes de comprar.'}
    >
      {abierto ? contenido : null}
    </Modal>
  );
}
