// Cálculos derivados: ejecución presupuestaria, caja chica, alertas, prorrateo e indicadores.
import type { CajaChica, DB, EstadoGasto, Gasto, MovimientoCaja, Severidad, Usuario } from '../types';
import { diasEntre, fecha, periodoDe, q, sumar } from './format';
import { esAjusteContable, faltaComprobante, nivelRequerido, veEstacion, veGasto } from './reglas';
import { rutaGasto } from './rutas';

export const VIGENTES: EstadoGasto[] = ['pendiente', 'aprobado', 'pagado'];
export const esVigente = (g: Gasto) => VIGENTES.includes(g.estado);
export const esEjecutado = (g: Gasto) => g.estado === 'aprobado' || g.estado === 'pagado';

export const ESTACION_CENTRAL = 'OFC';

export function gastosVisibles(db: DB, u: Usuario, estacionFiltro: string): Gasto[] {
  return db.gastos.filter((g) => veGasto(db, u, g) && (estacionFiltro === 'ALL' || g.estacionId === estacionFiltro));
}

export function estacionesEnFiltro(db: DB, u: Usuario, estacionFiltro: string): string[] {
  return db.estaciones
    .filter((e) => veEstacion(db, u, e.id) && (estacionFiltro === 'ALL' || e.id === estacionFiltro))
    .map((e) => e.id);
}

export function periodosDisponibles(db: DB): string[] {
  return [...new Set(db.gastos.map((g) => periodoDe(g.fecha)))].sort();
}

export function ventasDe(db: DB, periodo: string, estacionIds: string[]): number {
  return sumar(
    db.ventas.filter((v) => periodoDe(v.fecha) === periodo && estacionIds.includes(v.estacionId)),
    (v) => v.total,
  );
}

// ---------- Presupuesto ----------

export interface FilaPresupuesto {
  estacionId: string;
  categoriaId: string;
  presupuesto: number;
  ejecutado: number;
  comprometido: number;
  disponible: number;
  pct: number;
}

export function ejecucionPresupuesto(db: DB, periodo: string, estacionIds: string[]): FilaPresupuesto[] {
  const filas: FilaPresupuesto[] = [];
  for (const estacionId of estacionIds) {
    for (const cat of db.categorias) {
      const presupuesto =
        db.presupuestos.find((p) => p.periodo === periodo && p.estacionId === estacionId && p.categoriaId === cat.id)
          ?.monto ?? 0;
      const gs = db.gastos.filter(
        (g) => g.estacionId === estacionId && g.categoriaId === cat.id && periodoDe(g.fecha) === periodo,
      );
      const ejecutado = sumar(gs.filter(esEjecutado), (g) => g.monto);
      const comprometido = sumar(
        gs.filter((g) => g.estado === 'pendiente'),
        (g) => g.monto,
      );
      if (presupuesto === 0 && ejecutado === 0 && comprometido === 0) continue;
      const usado = ejecutado + comprometido;
      filas.push({
        estacionId,
        categoriaId: cat.id,
        presupuesto,
        ejecutado,
        comprometido,
        disponible: presupuesto - usado,
        pct: presupuesto > 0 ? (usado / presupuesto) * 100 : usado > 0 ? Infinity : 0,
      });
    }
  }
  return filas;
}

// ---------- Caja chica ----------

export interface EstadoCaja {
  caja: CajaChica;
  saldo: number;
  porLiquidar: MovimientoCaja[];
  enReposicion: number;
  usoPct: number;
}

export function estadoCaja(db: DB, caja: CajaChica): EstadoCaja {
  const desembolsos = caja.movimientos.filter((m) => m.tipo === 'desembolso');
  const repuesto = (m: MovimientoCaja) => {
    if (!m.liquidacionId) return false;
    const gs = db.gastos.filter((g) => g.referencia === m.liquidacionId);
    return gs.length > 0 && gs.every((g) => g.estado === 'pagado');
  };
  const sinReponer = desembolsos.filter((m) => !repuesto(m));
  const usado = sumar(sinReponer, (m) => m.monto);
  return {
    caja,
    saldo: caja.fondo - usado,
    porLiquidar: desembolsos.filter((m) => !m.liquidacionId),
    enReposicion: sumar(
      sinReponer.filter((m) => m.liquidacionId),
      (m) => m.monto,
    ),
    usoPct: caja.fondo > 0 ? (usado / caja.fondo) * 100 : 0,
  };
}

// ---------- Alertas ----------

export type TipoAlerta = 'presupuesto' | 'comprobante' | 'vencimiento' | 'autorizacion' | 'caja' | 'contrato' | 'recurrente';

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  estacionId: string;
  ruta: string;
  monto?: number;
}

const ORDEN_SEV: Record<Severidad, number> = { critica: 0, alta: 1, media: 2, baja: 3 };

export function calcularAlertas(db: DB, u: Usuario, estacionFiltro: string): Alerta[] {
  const { config } = db;
  const hoy = config.hoy;
  const estaciones = estacionesEnFiltro(db, u, estacionFiltro);
  const enFiltro = (id: string) => estaciones.includes(id);
  const codigo = (id: string) => db.estaciones.find((e) => e.id === id)?.codigo ?? id;
  const catNombre = (id: string) => db.categorias.find((c) => c.id === id)?.nombre ?? id;
  const alertas: Alerta[] = [];

  for (const f of ejecucionPresupuesto(db, config.periodoActual, estaciones)) {
    if (f.presupuesto <= 0 || f.pct < config.alertaPresupuestoPct) continue;
    const excedido = f.pct > 100;
    alertas.push({
      id: `pres-${f.estacionId}-${f.categoriaId}`,
      tipo: 'presupuesto',
      severidad: excedido ? 'alta' : 'media',
      titulo: `${catNombre(f.categoriaId)}: presupuesto ${excedido ? 'excedido' : `al ${f.pct.toFixed(0)} %`}`,
      detalle: `${codigo(f.estacionId)} lleva ${q(f.ejecutado + f.comprometido)} de ${q(f.presupuesto)}${
        f.comprometido > 0 ? ` (incluye ${q(f.comprometido)} por autorizar)` : ''
      }.`,
      estacionId: f.estacionId,
      ruta: '/presupuestos',
      monto: f.ejecutado + f.comprometido - f.presupuesto,
    });
  }

  for (const g of db.gastos) {
    if (!enFiltro(g.estacionId)) continue;
    if (faltaComprobante(db, g)) {
      alertas.push({
        id: `doc-${g.id}`,
        tipo: 'comprobante',
        severidad: g.estado === 'pagado' ? 'alta' : 'media',
        titulo: `${g.folio} sin comprobante${g.estado === 'pagado' ? ' y ya pagado' : ''}`,
        detalle: `${g.descripcion} · ${q(g.monto)}. Obligatorio desde ${q(config.comprobanteObligatorioDesde)}.`,
        estacionId: g.estacionId,
        ruta: rutaGasto(g.id),
        monto: g.monto,
      });
    }
    if (g.estado === 'aprobado' && !esAjusteContable(g) && g.vencimiento) {
      const d = diasEntre(hoy, g.vencimiento);
      if (d <= config.diasAlertaVencimiento) {
        alertas.push({
          id: `venc-${g.id}`,
          tipo: 'vencimiento',
          severidad: d < 0 ? 'alta' : 'media',
          titulo: d < 0 ? `Pago vencido hace ${-d} días` : d === 0 ? 'Pago vence hoy' : `Pago vence en ${d} días`,
          detalle: `${g.folio} · ${g.descripcion} · ${q(g.monto)} (vence ${fecha(g.vencimiento)}).`,
          estacionId: g.estacionId,
          ruta: rutaGasto(g.id),
          monto: g.monto,
        });
      }
    }
    if (g.estado === 'pendiente') {
      const edad = diasEntre(g.fecha, hoy);
      if (edad > config.diasAlertaPendiente) {
        alertas.push({
          id: `aut-${g.id}`,
          tipo: 'autorizacion',
          severidad: 'media',
          titulo: `${g.folio} lleva ${edad} días sin autorizar`,
          detalle: `${g.descripcion} · ${q(g.monto)}. Lo autoriza: ${nivelRequerido(db, g.monto).etiqueta}.`,
          estacionId: g.estacionId,
          ruta: rutaGasto(g.id),
          monto: g.monto,
        });
      }
    }
  }

  for (const caja of db.cajasChicas) {
    if (!enFiltro(caja.estacionId)) continue;
    const ec = estadoCaja(db, caja);
    if (ec.saldo < caja.fondo * 0.3) {
      alertas.push({
        id: `caja-${caja.id}`,
        tipo: 'caja',
        severidad: 'media',
        titulo: `Caja chica de ${codigo(caja.estacionId)} con saldo bajo`,
        detalle: `Saldo ${q(ec.saldo)} de un fondo de ${q(caja.fondo)}. Conviene liquidar y pedir reposición.`,
        estacionId: caja.estacionId,
        ruta: '/caja-chica',
      });
    }
  }

  for (const c of db.contratos) {
    if (!enFiltro(c.estacionId) || c.renovacionAutomatica) continue;
    const d = diasEntre(hoy, c.fin);
    if (d > c.avisoDias) continue;
    const prov = db.proveedores.find((p) => p.id === c.proveedorId)?.nombre ?? '';
    alertas.push({
      id: `ct-${c.id}`,
      tipo: 'contrato',
      severidad: d < 0 || d <= 15 ? 'alta' : 'media',
      titulo: d < 0 ? `Contrato vencido: ${c.objeto}` : `Contrato vence en ${d} días: ${c.objeto}`,
      detalle: `${prov} · ${codigo(c.estacionId)} · vence ${fecha(c.fin)}, sin renovación automática.`,
      estacionId: c.estacionId,
      ruta: '/contratos',
    });
  }

  for (const r of db.recurrentes) {
    if (!r.activo || !enFiltro(r.estacionId)) continue;
    const d = diasEntre(hoy, r.proximaFecha);
    if (d >= 0 && d <= config.diasAlertaVencimiento) {
      alertas.push({
        id: `rec-${r.id}`,
        tipo: 'recurrente',
        severidad: 'baja',
        titulo: `Generar: ${r.nombre}`,
        detalle: `${codigo(r.estacionId)} · ${q(r.monto)} · toca el ${fecha(r.proximaFecha)}.`,
        estacionId: r.estacionId,
        ruta: '/recurrentes',
      });
    }
  }

  return alertas.sort((a, b) => ORDEN_SEV[a.severidad] - ORDEN_SEV[b.severidad]);
}

// ---------- Prorrateo ----------

export interface Peso {
  estacionId: string;
  pct: number;
  base: number;
}

export function pesosProrrateo(db: DB, periodo: string, criterio: 'ventas' | 'partes_iguales'): Peso[] {
  const destinos = db.estaciones.filter((e) => e.id !== ESTACION_CENTRAL && e.activa);
  if (criterio === 'ventas') {
    const bases = destinos.map((e) => ({ estacionId: e.id, base: ventasDe(db, periodo, [e.id]) }));
    const total = sumar(bases, (b) => b.base);
    if (total > 0) return bases.map((b) => ({ ...b, pct: (b.base / total) * 100 }));
  }
  return destinos.map((e) => ({ estacionId: e.id, base: 1, pct: 100 / destinos.length }));
}

export interface Linea {
  estacionId: string;
  monto: number;
  g: Gasto;
}

/** Desglosa los gastos por estación; con prorrateo, los de oficina central se reparten. */
export function lineasPorEstacion(gastos: Gasto[], conProrrateo: boolean): Linea[] {
  const out: Linea[] = [];
  for (const g of gastos) {
    if (conProrrateo && g.distribucion?.length) {
      for (const d of g.distribucion) out.push({ estacionId: d.estacionId, monto: d.monto, g });
    } else out.push({ estacionId: g.estacionId, monto: g.monto, g });
  }
  return out;
}

// ---------- Indicadores ----------

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface Inusual {
  g: Gasto;
  motivo: string;
}

/** Gastos que se salen de lo normal: montos > 2× la mediana de su subcategoría, o pérdidas detectadas en reportes. */
export function gastosInusuales(db: DB, gastos: Gasto[]): Inusual[] {
  const porSub = new Map<string, number[]>();
  for (const g of db.gastos.filter(esVigente)) {
    const k = `${g.categoriaId}|${g.subcategoria}`;
    porSub.set(k, [...(porSub.get(k) ?? []), g.monto]);
  }
  const out: Inusual[] = [];
  for (const g of gastos.filter(esVigente)) {
    if (g.origen === 'reporte') {
      // Las comisiones de tarjeta siguen al volumen vendido; las demás partidas de reportes son pérdidas.
      if (g.categoriaId !== 'FIN') out.push({ g, motivo: `Pérdida detectada en ${g.referencia ?? 'reportes'}` });
      continue;
    }
    const xs = porSub.get(`${g.categoriaId}|${g.subcategoria}`) ?? [];
    if (xs.length >= 3) {
      const med = mediana(xs);
      if (g.monto > med * 2) out.push({ g, motivo: `${(g.monto / med).toFixed(1)} veces la mediana de ${g.subcategoria} (${q(med)})` });
    }
  }
  return out.sort((a, b) => b.g.monto - a.g.monto);
}
