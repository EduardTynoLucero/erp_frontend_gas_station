import { PantallaRegistro } from '@/modulos/gastos/pantallas/registro';

export const metadata = { title: 'Registro de gastos' };

export default async function PaginaGastos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  // ?nuevo=1 abre el modal «Nuevo gasto» (a donde lleva /gastos/nuevo)
  return <PantallaRegistro inicial={{ categoria: texto(p.categoria), origen: texto(p.origen), periodo: texto(p.periodo), nuevo: p.nuevo === '1' }} />;
}