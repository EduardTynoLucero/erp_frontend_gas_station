'use client';

import Link from 'next/link';
import { mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, Esqueleto, Vacio } from '@/componentes/ui/aviso';
import { InsigniaEstado } from '@/componentes/ui/insignia';
import { Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Indicador, Tarjeta } from '@/componentes/ui/tarjeta';
import { fecha, pct, periodoLabel, q } from '@/lib/formato';
import { type Franquicia, useFranquicia } from '../datos';

const ENLACE = 'text-[11px] font-semibold text-primario-tinta hover:underline';

export function PantallaFranquicia() {
  const { estacionId } = useErp();
  const consulta = useFranquicia(estacionId);
  const d = consulta.data;
  const marca = d?.franquicia || 'la franquicia';

  return (
    <div>
      <EncabezadoPagina
        titulo="Gastos de franquicia"
        descripcion={`Regalías, cuotas de imagen, licencias y publicidad corporativa de ${marca}. Las compras de combustible al mismo proveedor son inventario y no se registran aquí.`}
      />
      {consulta.isPending ? (
        <div className="grid gap-[6px]">
          <Esqueleto className="h-[64px]" />
          <Esqueleto className="h-[220px]" />
        </div>
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <Contenido d={consulta.data} />
      )}
    </div>
  );
}

function Contenido({ d }: { d: Franquicia }) {
  return (
    <>
      <div className="mb-[6px] grid grid-cols-2 gap-[6px] lg:grid-cols-4">
        <Indicador
          etiqueta={`Cargos de ${periodoLabel(d.periodo).toLowerCase()}`}
          valor={q(d.cargosDelMes.monto)}
          pista={`${d.cargosDelMes.cantidad} cargos`}
        />
        <Indicador etiqueta="Sobre ventas" valor={d.pctSobreVentas !== null ? pct(d.pctSobreVentas, 2) : '—'} pista="Cuotas de marca / ventas del mes" />
        <Indicador
          etiqueta="Próximo cargo mensual"
          valor={q(d.proximoCargo.monto)}
          pista={d.proximoCargo.fecha ? `El ${fecha(d.proximoCargo.fecha)}` : 'Sin plantillas recurrentes de franquicia'}
        />
        <Indicador
          etiqueta="Contratos de franquicia"
          valor={d.contratos.cantidad}
          pista={d.contratos.proximoVencimiento ? `Vence ${fecha(d.contratos.proximoVencimiento)}` : 'Sin contratos registrados'}
        />
      </div>

      <div className="grid gap-[6px] lg:grid-cols-2">
        <Tarjeta titulo="Por estación y mes">
          {d.porEstacion.length === 0 ? (
            <Vacio>No hay estaciones en el filtro.</Vacio>
          ) : (
            <ContenedorTabla anchoMinimo={420}>
              <Cabecera>
                <th className={th}>Estación</th>
                {d.periodos.map((p) => (
                  <th key={p} className={thR}>
                    {periodoLabel(p)}
                  </th>
                ))}
                {d.periodos.length > 1 && <th className={thR}>Total</th>}
              </Cabecera>
              <Cuerpo>
                {d.porEstacion.map((f) => (
                  <tr key={f.estacion.id}>
                    <td className={td}>
                      {f.estacion.codigo} <span className="text-tenue">{f.estacion.nombre}</span>
                    </td>
                    {d.periodos.map((p) => (
                      <td key={p} className={tdR}>
                        {q(f.porMes[p] ?? '0.00')}
                      </td>
                    ))}
                    {d.periodos.length > 1 && <td className={tdR}>{q(f.total)}</td>}
                  </tr>
                ))}
              </Cuerpo>
              {d.periodos.length > 0 && (
                <tfoot>
                  <tr>
                    <td className={`${td} font-semibold`}>Total</td>
                    {d.periodos.map((p) => (
                      <td key={p} className={`${tdR} font-semibold`}>
                        {q(d.totales.porMes[p] ?? '0.00')}
                      </td>
                    ))}
                    {d.periodos.length > 1 && <td className={`${tdR} font-semibold`}>{q(d.totales.total)}</td>}
                  </tr>
                </tfoot>
              )}
            </ContenedorTabla>
          )}
          {d.periodos.length === 0 && <p className="mt-[6px] text-[11px] text-tenue">Todavía no hay cargos de franquicia registrados.</p>}
        </Tarjeta>
        <Tarjeta titulo="Controles relacionados con la marca">
          <div className="space-y-[6px]">
            {d.cargosTotal === 0 && (
              <Aviso>Las regalías y la publicidad corporativa no tienen registros todavía; el catálogo ya las contempla para cuando se comparta el contrato.</Aviso>
            )}
            <Aviso tono="amber">Conviene validar cada factura del proveedor de la franquicia contra su lista de precios.</Aviso>
            {d.veRecurrentes && d.proximoCargo.plantillas.length > 0 && (
              <div>
                <div className="mb-[3px] flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-tenue">Plantillas recurrentes</p>
                  <Link href="/recurrentes" className={ENLACE}>
                    Ver recurrentes
                  </Link>
                </div>
                <ul className="divide-y divide-borde-suave text-[11px]">
                  {d.proximoCargo.plantillas.map((r) => (
                    <li key={r.id} className="flex justify-between gap-[6px] py-[3px]">
                      <span className="min-w-0 truncate">
                        {r.codigo} · {r.nombre} · {r.estacion.codigo} · {r.frecuencia}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {q(r.monto)} · {fecha(r.proximaFecha)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.veContratos && d.contratos.lista.length > 0 && (
              <div>
                <div className="mb-[3px] flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-tenue">Contratos</p>
                  <Link href="/contratos" className={ENLACE}>
                    Ver contratos
                  </Link>
                </div>
                <ul className="divide-y divide-borde-suave text-[11px]">
                  {d.contratos.lista.map((c) => (
                    <li key={c.id} className="flex justify-between gap-[6px] py-[3px]">
                      <span className="min-w-0 truncate">
                        {c.numero} · {c.objeto} · {c.proveedor} · {c.estacion.codigo}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {q(c.montoMensual)}/mes · vence {fecha(c.fin)} ({c.diasParaVencer} días)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta
        className="mt-[6px]"
        titulo="Cargos registrados"
        subtitulo={d.cargosTotal > d.cargos.length ? `Se muestran ${d.cargos.length} de ${d.cargosTotal}` : undefined}
      >
        {d.cargos.length === 0 ? (
          <Vacio>Todavía no hay cargos de franquicia registrados.</Vacio>
        ) : (
          <ContenedorTabla anchoMinimo={720}>
            <Cabecera>
              <th className={th}>Folio</th>
              <th className={th}>Fecha</th>
              <th className={th}>Estación</th>
              <th className={th}>Concepto</th>
              <th className={th}>Estado</th>
              <th className={thR}>Monto</th>
            </Cabecera>
            <Cuerpo>
              {d.cargos.map((g) => (
                <tr key={g.id}>
                  <td className={td}>
                    <Link href={`/gastos/${g.id}`} className="font-semibold text-primario-tinta hover:underline">
                      {g.folio}
                    </Link>
                  </td>
                  <td className={td}>{fecha(g.fecha)}</td>
                  <td className={td}>{g.estacion.codigo}</td>
                  <td className={td}>
                    {g.descripcion}
                    {g.subcategoria && <span className="text-tenue"> · {g.subcategoria}</span>}
                  </td>
                  <td className={td}>
                    <InsigniaEstado estado={g.estado} />
                  </td>
                  <td className={tdR}>{q(g.monto)}</td>
                </tr>
              ))}
            </Cuerpo>
          </ContenedorTabla>
        )}
      </Tarjeta>
    </>
  );
}
