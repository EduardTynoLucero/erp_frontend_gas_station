'use client';

/**
 * Integraciones (/integraciones), en el módulo de Dashboards: la carga de reportes al ETL. Se sueltan los .xlsx de
 * BISS, el backend los deja en la cola y el servicio ETL los revisa (vista previa con cuadre, incidencias y
 * comparación con la base) y, al confirmar, los carga.
 */
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Seleccion } from '@/componentes/ui/campos';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { cn } from '@/lib/utilidades';
import { HistorialCargas } from '../componentes/historial-cargas';
import { TarjetaSubida } from '../componentes/tarjeta-subida';
import { MAX_MB, ZonaCarga } from '../componentes/zona-carga';
import { clavesIngesta, type ResumenIngesta, subirArchivo, useResumenIngesta } from '../datos';
import { tamano } from '../etl';

interface SubidaLocal {
  clave: string;
  nombre: string;
  bytes: number;
  progreso: number;
}

function EstadoServicio({ activo }: { activo: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        activo
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
      )}
    >
      <span className="relative mt-1 flex size-2.5 shrink-0">
        {activo && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn('relative inline-flex size-2.5 rounded-full', activo ? 'bg-emerald-500' : 'bg-amber-500')} />
      </span>
      <div>
        <p className="font-medium">{activo ? 'Servicio ETL conectado' : 'El servicio ETL no está encendido'}</p>
        <p className="mt-0.5 opacity-90">
          {activo ? (
            'Revisa cada archivo en cuanto llega y lo carga al confirmar: validación, cuadre, modelo de ventas y estadísticas al día.'
          ) : (
            <>
              Los archivos que suba quedan en cola y se revisan cuando se encienda. Para encenderlo, abra una terminal en la carpeta etl y
              déjela corriendo con: <code className="font-mono text-xs">npm run dev</code>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function CargaDeReportes() {
  const resumen = useResumenIngesta();
  const qc = useQueryClient();
  const { estaciones: estacionesErp, estacionId } = useErp();
  const [locales, setLocales] = useState<SubidaLocal[]>([]);
  const [estacionElegida, setEstacionElegida] = useState<string | null>(null);

  if (resumen.isPending) return <EsqueletoTabla filas={6} />;
  if (resumen.isError) {
    return (
      <Aviso tono="red">
        No se pudo consultar la carga de reportes: {mensajeDeError(resumen.error)}{' '}
        <button type="button" className="font-medium underline" onClick={() => void resumen.refetch()}>
          Reintentar
        </button>
      </Aviso>
    );
  }
  const d = resumen.data;
  // Estación para el Reporte de compras (no la trae): la elegida, la del filtro del encabezado o la primera
  const codigoFiltro = estacionesErp.find((e) => e.id === estacionId)?.codigo;
  const porDefecto = d.estaciones.find((e) => e.codigo === codigoFiltro)?.codigo ?? d.estaciones[0]?.codigo ?? '';
  const estacion = estacionElegida && d.estaciones.some((e) => e.codigo === estacionElegida) ? estacionElegida : porDefecto;

  async function subir(archivos: File[]) {
    for (const archivo of archivos) {
      if (!/\.xlsx$/i.test(archivo.name)) {
        toast.error(`"${archivo.name}" no es un archivo .xlsx. Suba la Consulta de Tickets o el Reporte de compras exportados de BISS en Excel.`);
        continue;
      }
      if (archivo.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${archivo.name}" pesa ${tamano(archivo.size)}: el máximo es ${MAX_MB} MB.`);
        continue;
      }
      const clave = `${Date.now()}-${Math.random()}`;
      setLocales((l) => [{ clave, nombre: archivo.name, bytes: archivo.size, progreso: 0 }, ...l]);
      try {
        const subida = await subirArchivo(archivo, estacion || undefined, (progreso) =>
          setLocales((l) => l.map((x) => (x.clave === clave ? { ...x, progreso } : x))),
        );
        qc.setQueryData<ResumenIngesta>(clavesIngesta.resumen, (r) =>
          r ? { ...r, subidas: [subida, ...r.subidas.filter((s) => s.id !== subida.id)] } : r,
        );
        void qc.invalidateQueries({ queryKey: clavesIngesta.resumen });
        toast.success(`${archivo.name}: recibido. El servicio ETL lo está revisando.`);
      } catch (e) {
        toast.error(`${archivo.name}: ${mensajeDeError(e)}`);
      } finally {
        setLocales((l) => l.filter((x) => x.clave !== clave));
      }
    }
  }

  const visibles = d.subidas.filter((s) => s.estado !== 'CANCELADA');

  return (
    <div className="space-y-4">
      <EstadoServicio activo={d.servicio.activo} />

      {d.puedeSubir ? (
        <Tarjeta
          titulo="Subir reportes de BISS"
          subtitulo="El servicio ETL revisa cada archivo antes de cargarlo: usted ve qué trae, si cuadra y qué cambia en la base, y decide."
        >
          <div className="space-y-3">
            <ZonaCarga alElegir={(a) => void subir(a)} />
            {d.estaciones.length > 0 && (
              <Campo
                etiqueta="Estación para el Reporte de compras"
                pista="La Consulta de Tickets trae su estación en cada ticket; el Reporte de compras no, y se carga en esta."
                htmlFor="estacion-carga"
                className="max-w-md"
              >
                <Seleccion id="estacion-carga" value={estacion} onChange={(e) => setEstacionElegida(e.target.value)}>
                  {d.estaciones.map((e) => (
                    <option key={e.codigo} value={e.codigo}>
                      {e.codigo} · {e.nombre}
                    </option>
                  ))}
                </Seleccion>
              </Campo>
            )}
          </div>
        </Tarjeta>
      ) : (
        <Aviso>Su usuario consulta el historial de cargas. Para subir reportes necesita el permiso «Subir y cargar reportes de BISS al ETL».</Aviso>
      )}

      {(locales.length > 0 || visibles.length > 0) && (
        <section aria-label="Archivos subidos" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Archivos subidos</h2>
            <Boton variante="ghost" tamano="sm" icono={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => void resumen.refetch()}>
              Actualizar
            </Boton>
          </div>
          {locales.map((l) => (
            <div key={l.clave} className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-500/30 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{l.nombre}</span>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  Subiendo… {l.progreso} % de {tamano(l.bytes)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-500 transition-[width] duration-200" style={{ width: `${l.progreso}%` }} />
              </div>
            </div>
          ))}
          {visibles.map((s, i) => (
            <TarjetaSubida key={s.id} s={s} servicioActivo={d.servicio.activo} abiertaAlInicio={i === 0 && s.estado === 'COMPLETADA' && !s.carga} />
          ))}
        </section>
      )}

      <HistorialCargas cargas={d.cargas} />
    </div>
  );
}

export function PantallaIntegraciones() {
  return (
    <>
      <EncabezadoPagina
        titulo="Integraciones"
        descripcion="La carga de los reportes de BISS al ETL, que alimenta el Dashboard de ventas, el inventario y el historial de cargas."
      />
      <CargaDeReportes />
    </>
  );
}
