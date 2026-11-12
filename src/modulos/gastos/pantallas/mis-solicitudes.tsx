'use client';

/**
 * Mis solicitudes (/mis-solicitudes): lo que registró el usuario, con el paso en que va cada gasto. «Nuevo gasto o
 * solicitud» y la corrección de un borrador se hacen en el modal, sin salir del listado.
 */
import { useQueries } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, mensajeDeError, pedir } from '@/api/cliente';
import type { EstadoGasto, GastoDetalle, GastoResumen } from '@/api/tipos';
import { useTienePantalla, useTienePermiso } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton, EnlaceBoton } from '@/componentes/ui/boton';
import { InsigniaEstado } from '@/componentes/ui/insignia';
import { Cabecera, ContenedorTabla, Cuerpo, filaClic, PieTabla, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, q } from '@/lib/formato';
import { ModalGasto } from '../componentes/modal-gasto';
import { clavesGastos, useAccionGasto, useGastosPaginados, useListaGastos } from '../datos';
import { CeldaMonto } from '../etiquetas';

function useConteo(estado: EstadoGasto) {
  return useListaGastos({ soloMios: 'true', estado, porPagina: 1 }).data?.resumen;
}

function siguientePaso(g: GastoResumen, motivoRechazo: string | undefined): string {
  switch (g.estado) {
    case 'borrador':
      return 'Envíelo a autorización cuando esté completo';
    case 'pendiente':
      return `Lo autoriza: ${g.nivelRequerido ?? '—'}`;
    case 'aprobado':
      return g.esAjusteContable
        ? 'Ajuste contable registrado'
        : g.faltaComprobante
          ? 'Adjunte el comprobante para que se pueda pagar'
          : 'Tesorería programa el pago';
    case 'rechazado':
      return motivoRechazo || 'Rechazado';
    case 'pagado':
      return g.pago ? `Pagado el ${fecha(g.pago.fecha)}` : 'Pagado';
  }
}

export function PantallaMisSolicitudes({ nuevo = false }: { nuevo?: boolean }) {
  const router = useRouter();
  const registra = useTienePermiso('registrar');
  const veCompras = useTienePantalla('compras');
  const accion = useAccionGasto();
  // El modal: 'nuevo' registra un gasto; un id corrige ese borrador
  const [modal, setModal] = useState<'nuevo' | string | null>(nuevo ? 'nuevo' : null);

  function cerrarModal() {
    setModal(null);
    // Si se llegó por /mis-solicitudes?nuevo=1, la dirección vuelve a ser la del listado
    if (nuevo) router.replace('/mis-solicitudes');
  }

  function guardado(g: GastoDetalle, mensaje: string) {
    cerrarModal();
    toast.success(mensaje, { action: { label: `Ver ${g.folio}`, onClick: () => router.push(`/gastos/${g.id}`) } });
  }

  const borradores = useConteo('borrador');
  const pendientes = useConteo('pendiente');
  const aprobados = useConteo('aprobado');
  const pagados = useConteo('pagado');
  const rechazadosConteo = useConteo('rechazado');

  const rechazados = useListaGastos({ soloMios: 'true', estado: 'rechazado', porPagina: 20 });
  // El motivo del rechazo está en el detalle de cada gasto rechazado (suelen ser pocos)
  const detalles = useQueries({
    queries: (rechazados.data?.data ?? []).map((g) => ({
      queryKey: clavesGastos.detalle(g.id),
      queryFn: async () => (await pedir(api.GET('/api/v1/gastos/{id}', { params: { path: { id: g.id } } }))).data,
    })),
  });
  const motivos = new Map(
    detalles.flatMap((d) => (d.data ? [[d.data.id, d.data.aprobaciones.filter((a) => a.accion === 'rechazado').at(-1)?.comentario ?? '']] : [])),
  );

  const lista = useGastosPaginados({ soloMios: 'true', porPagina: 50, orden: '-fecha' });
  const filas = lista.data?.pages.flatMap((p) => p.data) ?? [];
  const total = lista.data?.pages[0]?.resumen.cantidad ?? 0;

  async function corregir(g: GastoResumen) {
    try {
      const r = await accion.mutateAsync({ tipo: 'reabrir', id: g.id });
      toast.success(r.mensaje);
      setModal(g.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Mis solicitudes"
        descripcion="Los gastos que usted registró, con el paso en que va cada uno."
        acciones={
          <>
            {/* Como en el prototipo: los requerimientos de compra se hacen en Compras administrativas */}
            {veCompras && (
              <EnlaceBoton href="/compras" variante="secondary">
                <Plus aria-hidden /> Requerimiento de compra
              </EnlaceBoton>
            )}
            {registra && (
              <Boton icono={<Plus aria-hidden />} onClick={() => setModal('nuevo')}>
                Nuevo gasto o solicitud
              </Boton>
            )}
          </>
        }
      />

      <div className="mb-[6px] grid grid-cols-2 gap-[6px] lg:grid-cols-5">
        <Indicador etiqueta="Borradores" valor={borradores?.cantidad ?? '—'} />
        <Indicador
          etiqueta="Por autorizar"
          valor={pendientes?.cantidad ?? '—'}
          pista={pendientes ? q(pendientes.montoFuncional) : undefined}
          tono={pendientes && pendientes.cantidad > 0 ? 'amber' : undefined}
        />
        <Indicador etiqueta="Aprobados por pagar" valor={aprobados?.cantidad ?? '—'} pista={aprobados ? q(aprobados.montoFuncional) : undefined} />
        <Indicador etiqueta="Pagados" valor={pagados?.cantidad ?? '—'} pista={pagados ? q(pagados.montoFuncional) : undefined} />
        <Indicador etiqueta="Rechazados" valor={rechazadosConteo?.cantidad ?? '—'} tono={rechazadosConteo && rechazadosConteo.cantidad > 0 ? 'red' : undefined} />
      </div>

      {(rechazados.data?.data.length ?? 0) > 0 && (
        <div className="mb-[6px] space-y-[4px]">
          {rechazados.data!.data.map((g) => (
            <Aviso key={g.id} tono="red">
              <b className="font-medium">{g.folio}</b> fue rechazado{motivos.get(g.id) ? `: “${motivos.get(g.id)}”.` : '.'}{' '}
              {g.acciones.reabrir.ok && (
                <Boton variante="ghost" tamano="sm" className="ml-1 font-medium underline" onClick={() => void corregir(g)} cargando={accion.isPending}>
                  Corregir y volver a enviar
                </Boton>
              )}
            </Aviso>
          ))}
        </div>
      )}

      <Tarjeta titulo="Gastos y solicitudes" subtitulo={`${total} registros`}>
        {lista.isError ? (
          <Aviso tono="red">{mensajeDeError(lista.error)}</Aviso>
        ) : lista.isPending ? (
          <EsqueletoTabla />
        ) : filas.length === 0 ? (
          <Vacio>Todavía no ha registrado gastos. Use “Nuevo gasto o solicitud”.</Vacio>
        ) : (
          <>
            <ContenedorTabla anchoMinimo={760}>
              <Cabecera>
                <th className={th}>Folio</th>
                <th className={th}>Descripción</th>
                <th className={th}>Estado</th>
                <th className={th}>Siguiente paso</th>
                <th className={thR}>Monto</th>
              </Cabecera>
              <Cuerpo>
                {filas.map((g) => (
                  <tr key={g.id} className={filaClic} onClick={() => (g.estado === 'borrador' && g.acciones.editar.ok ? setModal(g.id) : router.push(`/gastos/${g.id}`))}>
                    <td className={td}>
                      <span className="block font-semibold text-primario-tinta">{g.folio}</span>
                      <span className="block text-[10px] text-tenue">{fecha(g.fecha)}</span>
                    </td>
                    <td className={`${td} max-w-xs`}>
                      <span className="block truncate">{g.descripcion}</span>
                      <span className="block text-[10px] text-tenue">
                        {g.estacion.codigo} · {g.categoria.nombre}
                      </span>
                    </td>
                    <td className={td}>
                      <InsigniaEstado estado={g.estado} />
                    </td>
                    <td className={`${td} max-w-[16rem]`}>{siguientePaso(g, motivos.get(g.id))}</td>
                    <td className={tdR}>
                      <CeldaMonto g={g} />
                    </td>
                  </tr>
                ))}
              </Cuerpo>
            </ContenedorTabla>
            {total > filas.length && (
              <PieTabla desde={1} hasta={filas.length} total={total}>
                <Boton variante="secondary" tamano="sm" onClick={() => void lista.fetchNextPage()} cargando={lista.isFetchingNextPage}>
                  Mostrar más ({total - filas.length} restantes)
                </Boton>
              </PieTabla>
            )}
          </>
        )}
      </Tarjeta>

      <ModalGasto abierto={modal !== null} alCerrar={cerrarModal} gastoId={modal && modal !== 'nuevo' ? modal : undefined} alGuardado={guardado} />
    </>
  );
}
