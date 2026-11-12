'use client';

import { Link, rutaGasto } from '../lib/router';
import { Aviso, Card, EstadoBadge, PageHeader, Stat, TableWrap, td, tdR, th, thR } from '../components/ui';
import { fecha, pct, periodoDe, periodoLabel, q, sumar } from '../lib/format';
import { veEstacion } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import { ESTACION_CENTRAL, esVigente, periodosDisponibles, ventasDe } from '../lib/selectors';

const FRQ = 'FRQ';

export default function Franquicia() {
  const { db, usuario, estacionFiltro } = useStore();
  const c = useCatalogos();
  const periodo = db.config.periodoActual;
  const periodos = periodosDisponibles(db);
  const estaciones = db.estaciones.filter(
    (e) => e.id !== ESTACION_CENTRAL && veEstacion(db, usuario, e.id) && (estacionFiltro === 'ALL' || e.id === estacionFiltro),
  );
  const ids = estaciones.map((e) => e.id);
  const gastos = db.gastos.filter((g) => g.categoriaId === FRQ && ids.includes(g.estacionId) && esVigente(g)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const mes = gastos.filter((g) => periodoDe(g.fecha) === periodo);
  const proximos = db.recurrentes.filter((r) => r.categoriaId === FRQ && r.activo && ids.includes(r.estacionId));
  const contratos = db.contratos.filter((x) => x.categoriaId === FRQ && ids.includes(x.estacionId));

  return (
    <div>
      <PageHeader
        title="Gastos de franquicia"
        description={`Regalías, cuotas de imagen, licencias y publicidad corporativa de ${db.empresa.franquicia}. Las compras de combustible al mismo proveedor son inventario y no se registran aquí.`}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Cargos de ${periodoLabel(periodo).toLowerCase()}`} value={q(sumar(mes, (g) => g.monto))} hint={`${mes.length} cargos`} />
        <Stat
          label="Sobre ventas"
          value={(() => {
            const v = ventasDe(db, periodo, ids);
            return v ? pct((sumar(mes, (g) => g.monto) / v) * 100, 2) : '—';
          })()}
          hint="Cuotas de marca / ventas del mes"
        />
        <Stat label="Próximo cargo mensual" value={q(sumar(proximos, (r) => r.monto))} hint={proximos[0] ? `El ${fecha(proximos[0].proximaFecha)}` : undefined} />
        <Stat label="Contratos de franquicia" value={contratos.length} hint={contratos[0] ? `Vence ${fecha(contratos[0].fin)}` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Por estación y mes">
          <TableWrap minWidth={420}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Estación</th>
                {periodos.map((p) => (
                  <th key={p} className={thR}>
                    {periodoLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {estaciones.map((e) => (
                <tr key={e.id}>
                  <td className={td}>
                    {e.codigo} <span className="text-xs text-slate-500 dark:text-slate-400">{e.nombre}</span>
                  </td>
                  {periodos.map((p) => (
                    <td key={p} className={tdR}>
                      {q(sumar(gastos.filter((g) => g.estacionId === e.id && periodoDe(g.fecha) === p), (g) => g.monto))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
        <Card title="Controles relacionados con la marca">
          <div className="space-y-2">
            <Aviso>Las regalías y la publicidad corporativa no tienen registros todavía; el catálogo ya las contempla para cuando el cliente comparta el contrato.</Aviso>
            <Aviso tone="amber">Conviene validar cada factura del proveedor de la franquicia contra su lista de precios.</Aviso>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Cargos registrados">
        <TableWrap minWidth={720}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>Folio</th>
              <th className={th}>Fecha</th>
              <th className={th}>Estación</th>
              <th className={th}>Concepto</th>
              <th className={th}>Estado</th>
              <th className={thR}>Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {gastos.map((g) => (
              <tr key={g.id}>
                <td className={td}>
                  <Link to={rutaGasto(g.id)} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                    {g.folio}
                  </Link>
                </td>
                <td className={td}>{fecha(g.fecha)}</td>
                <td className={td}>{c.estCodigo(g.estacionId)}</td>
                <td className={td}>{g.descripcion}</td>
                <td className={td}>
                  <EstadoBadge estado={g.estado} />
                </td>
                <td className={tdR}>{q(g.monto)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
