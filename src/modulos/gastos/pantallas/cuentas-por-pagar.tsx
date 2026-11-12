'use client';

/** Cuentas por pagar y pagos (/cuentas-por-pagar). El botón "Pagar" sigue a acciones.pagar. Totales en GTQ. */
import { Decimal } from 'decimal.js';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mensajeDeError } from '@/api/cliente';
import type { GastoResumen } from '@/api/tipos';
import { useErp, useTienePermiso } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { ListaBarras } from '@/componentes/ui/barras';
import { Ayuda, Boton } from '@/componentes/ui/boton';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { Pestanas } from '@/componentes/ui/pestanas';
import { Cabecera, ContenedorTabla, Cuerpo, filaClic, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador, Tarjeta } from '@/componentes/ui/tarjeta';
import { diasEntre, fecha, q, qk } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { DialogoPago } from '../componentes/dialogos';
import { useCatalogos, useListaGastos } from '../datos';
import { CeldaMonto, nombreProveedor } from '../etiquetas';

type Pestana = 'porPagar' | 'pagos' | 'proveedores';
const DIAS_ALERTA_VENCIMIENTO = 5;

const suma = (gastos: GastoResumen[]) => gastos.reduce((t, g) => t.plus(g.montoFuncional), new Decimal(0));

export function PantallaCuentasPorPagar() {
  const router = useRouter();
  const { estacionId } = useErp();
  const paga = useTienePermiso('pagar');
  const catalogos = useCatalogos();
  const hoy = catalogos.data?.parametros.hoy ?? '';
  const [pestana, setPestana] = useState<Pestana>('porPagar');
  const [pagar, setPagar] = useState<GastoResumen | null>(null);

  const filtro = estacionId ? { estacionId } : {};
  const aprobados = useListaGastos({ estado: 'aprobado', porPagina: 100, orden: 'fecha', ...filtro });
  const pagados = useListaGastos({ estado: 'pagado', porPagina: 100, orden: '-fecha', ...filtro });

  const dias = (g: GastoResumen) => (g.vencimiento && hoy ? diasEntre(hoy, g.vencimiento) : 0);
  const porPagar = (aprobados.data?.data ?? [])
    .filter((g) => !g.esAjusteContable)
    .sort((a, b) => (a.vencimiento ?? '').localeCompare(b.vencimiento ?? ''));
  const pagos = (pagados.data?.data ?? []).filter((g) => g.pago).sort((a, b) => (b.pago?.fecha ?? '').localeCompare(a.pago?.fecha ?? ''));

  const tramos: { etiqueta: string; filtro: (d: number) => boolean }[] = [
    { etiqueta: 'Vencido', filtro: (d) => d < 0 },
    { etiqueta: '0 a 7 días', filtro: (d) => d >= 0 && d <= 7 },
    { etiqueta: '8 a 15 días', filtro: (d) => d >= 8 && d <= 15 },
    { etiqueta: '16 a 30 días', filtro: (d) => d >= 16 && d <= 30 },
    { etiqueta: 'Más de 30', filtro: (d) => d > 30 },
  ];

  const agrupar = (gastos: GastoResumen[], clave: (g: GastoResumen) => string) => {
    const grupos = new Map<string, GastoResumen[]>();
    for (const g of gastos) grupos.set(clave(g), [...(grupos.get(clave(g)) ?? []), g]);
    return [...grupos.entries()]
      .map(([k, lista]) => ({ clave: k, etiqueta: k, valor: suma(lista).toNumber(), sub: `${lista.length} doc.` }))
      .sort((a, b) => b.valor - a.valor);
  };

  function tonoVence(d: number): Tono {
    if (d < 0) return 'red';
    return d <= DIAS_ALERTA_VENCIMIENTO ? 'amber' : 'gray';
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas por pagar y pagos"
        descripcion="Gastos aprobados pendientes de pago, por vencimiento, y el historial de pagos. Los ajustes contables (merma, descuentos) no generan pago y no aparecen aquí."
      />
      {!paga && (
        <Aviso className="mb-4">Solo consulta: los pagos los registra Tesorería.</Aviso>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tramos.map((t) => {
          const lista = porPagar.filter((g) => t.filtro(dias(g)));
          return (
            <Indicador
              key={t.etiqueta}
              etiqueta={t.etiqueta}
              valor={qk(suma(lista).toNumber())}
              pista={`${lista.length} documentos`}
              tono={t.etiqueta === 'Vencido' && lista.length > 0 ? 'red' : undefined}
            />
          );
        })}
      </div>

      <Tarjeta>
        <Pestanas
          valor={pestana}
          alCambiar={setPestana}
          pestanas={[
            { valor: 'porPagar', etiqueta: `Por pagar (${porPagar.length})` },
            { valor: 'pagos', etiqueta: `Pagos realizados (${pagos.length})` },
            { valor: 'proveedores', etiqueta: 'Saldo por proveedor' },
          ]}
        />
        {aprobados.isError ? (
          <Aviso tono="red">{mensajeDeError(aprobados.error)}</Aviso>
        ) : aprobados.isPending ? (
          <EsqueletoTabla filas={4} />
        ) : pestana === 'porPagar' ? (
          porPagar.length === 0 ? (
            <Vacio>No hay cuentas por pagar.</Vacio>
          ) : (
            <ContenedorTabla anchoMinimo={900}>
              <Cabecera>
                <th className={th}>Vence</th>
                <th className={th}>Folio</th>
                <th className={th}>Proveedor</th>
                <th className={th}>Estación</th>
                <th className={th}>Comprobante</th>
                <th className={thR}>Monto</th>
                {paga && <th className={th} aria-label="Acción" />}
              </Cabecera>
              <Cuerpo>
                {porPagar.map((g) => {
                  const d = dias(g);
                  return (
                    <tr key={g.id} className={filaClic} onClick={() => router.push(`/gastos/${g.id}`)}>
                      <td className={`${td} whitespace-nowrap`}>
                        {fecha(g.vencimiento)}
                        <span className="mt-0.5 block">
                          <Insignia tono={tonoVence(d)}>{d < 0 ? `Vencido ${-d} d` : d === 0 ? 'Hoy' : `En ${d} d`}</Insignia>
                        </span>
                      </td>
                      <td className={cn(td, 'font-medium text-brand-700 dark:text-brand-300')}>{g.folio}</td>
                      <td className={`${td} max-w-xs`}>
                        <span className="block truncate">{nombreProveedor(g.proveedor)}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{g.descripcion}</span>
                      </td>
                      <td className={td}>{g.estacion.codigo}</td>
                      <td className={td}>
                        {g.faltaComprobante ? <Insignia tono="red">Falta</Insignia> : <span className="text-xs text-slate-600 dark:text-slate-300">{g.documento.tipo}</span>}
                      </td>
                      <td className={tdR}>
                        <CeldaMonto g={g} />
                      </td>
                      {paga && (
                        <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                          {g.acciones.pagar.ok ? (
                            <Boton tamano="sm" onClick={() => setPagar(g)}>
                              Pagar
                            </Boton>
                          ) : (
                            <Ayuda texto={g.acciones.pagar.motivo}>
                              <Boton variante="secondary" tamano="sm" onClick={() => router.push(`/gastos/${g.id}`)}>
                                Adjuntar comprobante
                              </Boton>
                            </Ayuda>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Cuerpo>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold dark:border-slate-700">
                  <td className={td} colSpan={5}>
                    Total por pagar
                  </td>
                  <td className={tdR}>{q(suma(porPagar).toFixed(2))}</td>
                  {paga && <td />}
                </tr>
              </tfoot>
            </ContenedorTabla>
          )
        ) : pestana === 'pagos' ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {pagos.length === 0 ? (
                <Vacio>Todavía no hay pagos registrados.</Vacio>
              ) : (
                <ContenedorTabla anchoMinimo={640}>
                  <Cabecera>
                    <th className={th}>Fecha de pago</th>
                    <th className={th}>Folio</th>
                    <th className={th}>Proveedor</th>
                    <th className={th}>Método y referencia</th>
                    <th className={thR}>Monto</th>
                  </Cabecera>
                  <Cuerpo>
                    {pagos.slice(0, 60).map((g) => (
                      <tr key={g.id} className={filaClic} onClick={() => router.push(`/gastos/${g.id}`)}>
                        <td className={`${td} whitespace-nowrap`}>{fecha(g.pago?.fecha)}</td>
                        <td className={cn(td, 'font-medium text-brand-700 dark:text-brand-300')}>{g.folio}</td>
                        <td className={td}>
                          <span className="block max-w-[220px] truncate">{nombreProveedor(g.proveedor)}</span>
                        </td>
                        <td className={td}>
                          {g.pago?.metodo} <span className="text-xs text-slate-500 dark:text-slate-400">{g.pago?.referencia}</span>
                        </td>
                        <td className={tdR}>
                          <CeldaMonto g={g} />
                        </td>
                      </tr>
                    ))}
                  </Cuerpo>
                </ContenedorTabla>
              )}
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Pagado por método</div>
              <ListaBarras elementos={agrupar(pagos, (g) => g.pago?.metodo ?? '—')} formato={(v) => qk(v)} />
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Los pagos en efectivo deberían salir de caja chica y tener recibo. A proveedores, mejor por transferencia o cheque para dejar rastro bancario.
              </p>
            </div>
          </div>
        ) : (
          <ListaBarras elementos={agrupar(porPagar, (g) => nombreProveedor(g.proveedor))} formato={(v) => q(v)} />
        )}
      </Tarjeta>

      {pagar && <DialogoPago gasto={pagar} abierto hoy={hoy} alCerrar={() => setPagar(null)} />}
    </>
  );
}
