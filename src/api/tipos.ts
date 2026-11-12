/** Tipos de la API, generados desde el contrato OpenAPI del backend (npm run api:tipos). */
import type { components, paths } from './esquema';

type Esquemas = components['schemas'];

export type Perfil = Esquemas['Perfil'];
export type Pantalla = Esquemas['Pantalla'];
export type Modulos = Perfil['acceso']['modulos'];
export type Verificacion = Esquemas['Verificacion'];
export type AccionesGasto = Esquemas['AccionesGasto'];
export type GastoResumen = Esquemas['GastoResumen'];
export type GastoDetalle = Esquemas['GastoDetalle'];
export type CatalogosGasto = Esquemas['CatalogosGasto'];
export type EstadoGasto = GastoResumen['estado'];
export type OrigenGasto = GastoResumen['origen'];
export type TipoDocumento = GastoResumen['documento']['tipo'];
export type OpcionesVentas = Esquemas['OpcionesVentas'];
export type DashboardVentas = Esquemas['DashboardVentas'];
export type Problema = Esquemas['Problema'];
export type ResumenIngesta = Esquemas['ResumenIngesta'];
export type SubidaIngesta = Esquemas['SubidaIngesta'];
export type CargaDeSubida = Esquemas['CargaDeSubida'];
export type CargaEtl = Esquemas['CargaEtl'];

export type ListaGastos = paths['/api/v1/gastos']['get']['responses'][200]['content']['application/json'];
export type ConsultaGastos = NonNullable<paths['/api/v1/gastos']['get']['parameters']['query']>;
export type CuerpoGasto = paths['/api/v1/gastos']['post']['requestBody']['content']['application/json'];
export type CuerpoActualizarGasto = paths['/api/v1/gastos/{id}']['put']['requestBody']['content']['application/json'];
export type CuerpoPago = paths['/api/v1/gastos/{id}/pagar']['post']['requestBody']['content']['application/json'];
export type FiltrosVentas = NonNullable<paths['/api/v1/dashboards/ventas']['get']['parameters']['query']>;

export type { components, paths };
