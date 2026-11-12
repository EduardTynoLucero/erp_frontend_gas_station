'use client';

/**
 * Dashboard de ventas: réplica de la pestaña «Dashboard» del panel del ETL sobre la API del ERP
 * (GET /api/v1/dashboards/ventas/opciones y /ventas), que lee los datos agregados que publica el ETL.
 *
 * Estados (mismos textos del panel): consultando, error con «Reintentar», modelo vacío, vistas atrasadas,
 * sin ventas con estos filtros y el caso normal (indicadores y cinco filas de gráficas y listas).
 * Decisiones a propósito frente al panel: al cambiar filtros se conservan la medida elegida y la vista de
 * gráfica o tabla de cada tarjeta, y lo ya dibujado se queda (atenuado) mientras llega la consulta nueva.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import type { OpcionesVentas } from '@/api/tipos';
import { EncabezadoPagina } from '@/componentes/ui/tarjeta';
import { cn } from '@/lib/utilidades';
import { BarraFiltros, type CambioFiltros } from '../componentes/barra-filtros';
import { Indicadores } from '../componentes/indicadores';
import { BOTON_CHICO, Cargando, TarjetaVacia, Veredicto } from '../componentes/piezas';
import { TicketsParaRevisar, TicketsQueFaltan } from '../componentes/revision';
import { Clientes, CuandoSeVende, Facturacion, PorProducto, UtilidadPorGalon, VentasPorDia, VentasPorTurno } from '../componentes/secciones';
import { useDashboardVentas, useOpcionesVentas } from '../datos';
import { ajustarFiltros, consultaDe, type EstadoFiltros, rangoDe } from '../filtros';

// Rejilla de 12 columnas; por debajo de ~1050 px de ancho útil (1100 px de pantalla en el panel) todo se apila
const REJILLA = 'grid grid-cols-12 items-stretch gap-4';
const COL = {
  4: 'col-span-12 @min-[1050px]:col-span-4',
  5: 'col-span-12 @min-[1050px]:col-span-5',
  6: 'col-span-12 @min-[1050px]:col-span-6',
  7: 'col-span-12 @min-[1050px]:col-span-7',
  8: 'col-span-12 @min-[1050px]:col-span-8',
  12: 'col-span-12',
};

function AvisoVistas({ opciones, alActualizar }: { opciones: OpcionesVentas; alActualizar: () => void }) {
  if (!opciones.vistasAtrasadas) return null;
  return (
    <Veredicto
      tipo="aviso"
      titulo="Los totales pueden estar atrasados"
      acciones={
        <button type="button" onClick={alActualizar} className={BOTON_CHICO}>
          Actualizar
        </button>
      }
    >
      <p>
        Los indicadores, Ventas por día, Por producto y Utilidad por galón salen de un resumen que no tiene todo lo que hay en la base, y no se pudo
        poner al día solo. Las demás gráficas leen los tickets directamente: los totales pueden no cuadrar entre sí y el rango de fechas puede no
        llegar al último día cargado.
      </p>
      <p className="text-[11px] text-tenue">
        Presiona Actualizar para intentarlo otra vez. Si sigue igual, quien administra la base puede ejecutar CALL mart.refrescar();
        {opciones.avisoVistas ? ` Detalle: ${opciones.avisoVistas}` : ''}
      </p>
    </Veredicto>
  );
}

function ErrorConsulta({ error, alReintentar, reintentando }: { error: unknown; alReintentar: () => void; reintentando: boolean }) {
  return (
    <Veredicto
      tipo="critico"
      titulo="No se pudo consultar el dashboard"
      acciones={
        <button type="button" onClick={alReintentar} disabled={reintentando} className={BOTON_CHICO}>
          Reintentar
        </button>
      }
    >
      <p>{mensajeDeError(error)}</p>
    </Veredicto>
  );
}

export function PantallaDashboardVentas() {
  const cliente = useQueryClient();
  const opciones = useOpcionesVentas();

  // ponerOpciones del panel: cuando cambian las opciones (por ejemplo, una carga nueva) se reajustan los filtros
  const [estado, setEstado] = useState<{ clave: string; filtros: EstadoFiltros | null }>({ clave: '', filtros: null });
  if (opciones.data) {
    const clave = JSON.stringify(opciones.data);
    if (clave !== estado.clave) setEstado({ clave, filtros: ajustarFiltros(estado.filtros, opciones.data) });
  }
  const filtros = estado.filtros;
  const dashboard = useDashboardVentas(filtros ? consultaDe(filtros) : null, opciones.data?.ultimaCarga);

  const cambiarFiltros = (cambio: CambioFiltros) =>
    setEstado((e) => {
      if (!e.filtros) return e;
      const f: EstadoFiltros = { ...e.filtros, ...cambio };
      if (!f.estacion) delete f.estacion;
      if (!f.producto) delete f.producto;
      return { ...e, filtros: f };
    });
  // «Actualizar»: vuelve a leer las opciones y el dashboard
  const actualizar = () => void cliente.invalidateQueries({ queryKey: ['dashboards', 'ventas'] });

  const encabezado = (
    <EncabezadoPagina
      titulo="Dashboard de ventas"
      descripcion="Tickets de despacho que publica el ETL (BISS): ventas, galones, utilidad, facturación y tickets para revisar."
    />
  );

  if (opciones.isPending)
    return (
      <>
        {encabezado}
        <Cargando>Consultando el modelo…</Cargando>
      </>
    );
  if (opciones.isError)
    return (
      <>
        {encabezado}
        <ErrorConsulta error={opciones.error} alReintentar={() => void opciones.refetch()} reintentando={opciones.isFetching} />
      </>
    );

  const datosOpciones = opciones.data;
  const rango = rangoDe(datosOpciones);
  if (!rango || !filtros)
    return (
      <>
        {encabezado}
        {datosOpciones.vistasAtrasadas ? (
          <AvisoVistas opciones={datosOpciones} alActualizar={actualizar} />
        ) : (
          <TarjetaVacia titulo="Todavía no hay datos en el modelo">
            Los datos aparecen cuando el servicio ETL publica la primera carga de tickets de su estación.
          </TarjetaVacia>
        )}
      </>
    );

  const d = dashboard.data;
  const consultando = dashboard.isFetching;

  let cuerpo;
  if (dashboard.isError && !d)
    cuerpo = <ErrorConsulta error={dashboard.error} alReintentar={() => void dashboard.refetch()} reintentando={consultando} />;
  else if (!d) cuerpo = <Cargando>Consultando el modelo…</Cargando>;
  else if (!d.kpis.tickets)
    cuerpo = (
      <TarjetaVacia titulo="Sin ventas con estos filtros">Prueba con otro rango de fechas o quita el filtro de producto.</TarjetaVacia>
    );
  else
    cuerpo = (
      <div className="@container space-y-4">
        <Indicadores datos={d} />
        <div className={REJILLA}>
          <VentasPorDia d={d} className={COL[8]} />
          <PorProducto d={d} className={COL[4]} />
        </div>
        <div className={REJILLA}>
          <UtilidadPorGalon d={d} className={COL[6]} />
          <CuandoSeVende d={d} className={COL[6]} />
        </div>
        <div className={REJILLA}>
          <VentasPorTurno d={d} className={COL[12]} />
        </div>
        <div className={REJILLA}>
          <Facturacion d={d} className={COL[4]} />
          <Clientes d={d} className={COL[8]} />
        </div>
        <div className={REJILLA}>
          <TicketsParaRevisar d={d} className={COL[7]} />
          <TicketsQueFaltan d={d} className={COL[5]} />
        </div>
      </div>
    );

  return (
    <>
      {encabezado}
      <div className="space-y-4">
        <BarraFiltros
          opciones={datosOpciones}
          rango={rango}
          filtros={filtros}
          alCambiar={cambiarFiltros}
          alActualizar={actualizar}
          actualizando={consultando || opciones.isFetching}
        />
        <AvisoVistas opciones={datosOpciones} alActualizar={actualizar} />
        <div
          aria-busy={consultando || undefined}
          className={cn('transition-opacity duration-200', consultando && dashboard.isPlaceholderData && 'pointer-events-none opacity-60')}
        >
          {cuerpo}
        </div>
      </div>
    </>
  );
}
