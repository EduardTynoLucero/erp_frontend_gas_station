// Datos de arranque de las pantallas con datos simulados (local.ts los guarda en este navegador la primera vez).
// Solo catálogos, como la base del ERP en cero:
//   - empresa, estaciones reales, unidades, centros de costo, roles, usuarios, categorías, proveedores reales y
//     parámetros;
//   - el fondo de caja chica de la estación con su saldo inicial. Sin él no se puede usar la caja chica, y el fondo
//     no se crea desde las pantallas.
// Nada de gastos, ventas, presupuestos, compras, contratos, recurrentes, hallazgos ni bitácora: se registran aquí.
// "Hoy" es la fecha de esta PC.
import categorias from './categorias.json';
import centrosCosto from './centrosCosto.json';
import config from './config.json';
import empresa from './empresa.json';
import estaciones from './estaciones.json';
import proveedores from './proveedores.json';
import roles from './roles.json';
import unidades from './unidades.json';
import usuarios from './usuarios.json';
import type { CajaChica, DB } from '../types';

/** Fondo fijo de caja chica de cada estación (lo que se repone al liquidar) y quién lo maneja */
const FONDOS_CAJA_CHICA: { estacionId: string; fondo: number; responsableId: string }[] = [
  { estacionId: 'E1', fondo: 3000, responsableId: 'U6' },
];

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Una copia nueva de los datos de arranque, con la fecha de hoy */
export function cargarDatos(): DB {
  const hoy = hoyLocal();
  const periodo = hoy.slice(0, 7);
  const cajasChicas: CajaChica[] = FONDOS_CAJA_CHICA.map((f, i) => ({
    id: `CC${i + 1}`,
    ...f,
    movimientos: [{ id: 'm1', fecha: hoy, tipo: 'apertura', descripcion: 'Saldo inicial del fondo', monto: f.fondo, categoriaId: null, comprobante: '' }],
  }));
  return structuredClone({
    empresa: { ...empresa, periodoActual: periodo },
    estaciones,
    unidades,
    centrosCosto,
    roles,
    usuarios,
    categorias,
    proveedores,
    ventas: [],
    gastos: [],
    presupuestos: [],
    cajasChicas,
    recurrentes: [],
    hallazgos: [],
    auditoria: [],
    config: { ...config, periodoActual: periodo, fechaCorte: hoy, hoy },
    ordenesCompra: [],
    contratos: [],
  } as unknown as DB);
}
