'use client';

/**
 * Nivel actual de los tanques (pestaña Inventario del panel del ETL): por combustible, un medidor con el semáforo de
 * pedido, galonaje estimado, ocupación, cobertura, venta promedio y pedido sugerido; y «Configurar tanques», donde se
 * escriben la capacidad y los parámetros de pedido (permiso configurar_tanques).
 *
 * El medidor es una barra horizontal de 0 a 100 %: las franjas de fondo marcan dónde cambia el semáforo (pedir ya,
 * pedir pronto, estable, arriba del llenado máximo) y la barra llena es la ocupación. El estado va siempre con texto.
 */
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { Boton } from '@/componentes/ui/boton';
import { claseEntrada } from '@/componentes/ui/campos';
import { Modal } from '@/componentes/ui/modal';
import { cn } from '@/lib/utilidades';
import { Estado, type TipoEstado } from '@/modulos/dashboards/componentes/iconos';
import { BOTON_CHICO, TARJETA } from '@/modulos/dashboards/componentes/piezas';
import { Punto } from '@/modulos/dashboards/componentes/tablas';
import { fechaHora, fmt } from '@/modulos/dashboards/formato';
import { colorProducto, ordenarProductos } from '@/modulos/dashboards/productos';
import { type CuerpoTanque, type NivelTanques, type ParametrosTanque, type Tanque, useGuardarTanques } from '../datos';

const ESTADO_TANQUE: Record<Tanque['estado'], TipoEstado> = {
  URGENTE: 'critico',
  PRONTO: 'aviso',
  PROGRAMAR: 'info',
  ESTABLE: 'bueno',
  REVISAR: 'critico',
  SIN_TOMA: 'info',
  SIN_CAPACIDAD: 'info',
};
const ORDEN_ESTADO: Tanque['estado'][] = ['URGENTE', 'REVISAR', 'PRONTO', 'PROGRAMAR', 'ESTABLE', 'SIN_CAPACIDAD', 'SIN_TOMA'];

/**
 * Color de la barra llena según el estado: los colores de estado reservados (--estado-* de globals.css). Rojo Puma
 * pedir ya, ámbar pedir pronto, pizarra programar, verde Puma estable; sin datos, el gris de la base.
 */
const RELLENO: Record<Tanque['estado'], string> = {
  URGENTE: 'var(--estado-critico)',
  REVISAR: 'var(--estado-critico)',
  PRONTO: 'var(--estado-aviso)',
  PROGRAMAR: 'var(--estado-info)',
  ESTABLE: 'var(--estado-bueno)',
  SIN_TOMA: 'var(--graf-base)',
  SIN_CAPACIDAD: 'var(--graf-base)',
};

const dias = (n: number | null) => (n === null ? '–' : n >= 1 ? `${fmt.numero(n, 1)} días` : `${fmt.numero(n * 24, 0)} horas`);

function Medidor({ t }: { t: Tanque }) {
  const u = t.umbrales;
  const pct = t.porcentaje === null ? null : Math.max(0, Math.min(100, t.porcentaje));
  const franjas = u
    ? [
        { desde: 0, hasta: u.urgente, clase: 'bg-red-100 dark:bg-red-500/15', nombre: 'Pedir ya' },
        { desde: u.urgente, hasta: u.pronto, clase: 'bg-amber-100 dark:bg-amber-500/15', nombre: 'Pedir pronto' },
        { desde: u.pronto, hasta: u.llenado, clase: 'bg-emerald-50 dark:bg-emerald-500/10', nombre: 'Estable' },
        { desde: u.llenado, hasta: 100, clase: 'bg-slate-200 dark:bg-slate-700/60', nombre: 'Arriba del llenado máximo' },
      ].filter((f) => f.hasta > f.desde)
    : [];
  const etiqueta = `${t.producto}: ${pct === null ? 'sin porcentaje' : `${fmt.numero(t.porcentaje, 1)}% de ocupación`}. ${t.titulo}`;
  return (
    <div role="img" aria-label={etiqueta} className="mt-3">
      <div className="relative h-7 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200 ring-inset dark:bg-slate-800 dark:ring-slate-700">
        {franjas.map((f) => (
          <div key={f.nombre} title={f.nombre} className={cn('absolute inset-y-0', f.clase)} style={{ left: `${f.desde}%`, width: `${f.hasta - f.desde}%` }} />
        ))}
        {pct !== null && (
          <div
            className="absolute inset-y-1 left-0 rounded-r-[4px] border-r-2 border-[var(--graf-superficie)]"
            style={{ width: `${pct}%`, background: RELLENO[t.estado] }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-slate-900 tabular-nums dark:text-white">
          <span className="rounded bg-white/80 px-1.5 dark:bg-slate-900/80">
            {t.galones === null ? 'Sin toma física' : t.parametros ? `${fmt.numero(t.porcentaje, 1)}%` : 'Configura la capacidad'}
          </span>
        </div>
      </div>
      {u && (
        <div className="mt-1 flex justify-between text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
          <span>0%</span>
          <span>
            pedir ya &lt; {fmt.numero(u.urgente, 0)}% · pronto &lt; {fmt.numero(u.pronto, 0)}% · llenado {fmt.numero(u.llenado, 0)}%
          </span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{titulo}</dt>
      <dd className="text-sm font-semibold text-slate-900 tabular-nums dark:text-white">
        {valor}
        {nota && <small className="block text-xs font-normal text-slate-500 dark:text-slate-400">{nota}</small>}
      </dd>
    </div>
  );
}

function TarjetaTanque({ t }: { t: Tanque }) {
  const p = t.parametros;
  const ultimas = [
    t.toma ? `Última toma: ${fechaHora(t.toma.en)}, ${fmt.galones(t.toma.galones)}` : null,
    t.ultimaCompra ? `última compra: ${fechaHora(t.ultimaCompra.en)}, ${fmt.galones(t.ultimaCompra.galones)}` : null,
  ].filter(Boolean);
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-white">
          <Punto color={colorProducto(t.producto)} />
          {t.producto}
        </span>
        <Estado tipo={ESTADO_TANQUE[t.estado]}>{t.titulo}</Estado>
      </div>
      <Medidor t={t} />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Dato
          titulo="Galonaje actual"
          valor={t.galones === null ? '–' : `${t.estimado ? '≈ ' : ''}${fmt.galones(t.galones)}`}
          nota={t.estimado ? 'estimado a esta hora' : null}
        />
        <Dato
          titulo="Capacidad"
          valor={p ? fmt.galones(p.capacidad_galones) : 'Sin configurar'}
          nota={p ? `llenado máximo ${fmt.pct(p.llenado_maximo_pct, 0)}` : null}
        />
        <Dato
          titulo="Ocupación"
          valor={t.porcentaje === null ? '–' : fmt.pct(t.porcentaje)}
          nota={t.espacioLibre !== null ? `caben ${fmt.galones(t.espacioLibre)}` : null}
        />
        <Dato titulo="Alcanza para" valor={dias(t.coberturaDias)} nota={t.agotamiento ? `se acaba el ${fechaHora(t.agotamiento)}` : null} />
        <Dato titulo="Venta promedio" valor={`${fmt.galones(t.consumoDiario)} / día`} nota={t.diasConsumo ? `últimos ${t.diasConsumo} días` : null} />
        <Dato
          titulo="Pedir"
          valor={t.fechaPedido ? ((t.diasParaPedir ?? 1) <= 0 ? 'Hoy' : fechaHora(t.fechaPedido)) : '–'}
          nota={t.pedidoSugerido ? `${fmt.galones(t.pedidoSugerido)} sugeridos` : null}
        />
      </dl>
      <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{t.recomendacion}</p>
      {ultimas.length > 0 && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{ultimas.join(' · ')}</p>}
      {t.avisos.map((a) => (
        <p key={a} className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Estado tipo="aviso">
            <span className="font-normal whitespace-normal">{a}</span>
          </Estado>
        </p>
      ))}
    </div>
  );
}

export function NivelDeTanques({ datos, puedeConfigurar }: { datos: NivelTanques; puedeConfigurar: boolean }) {
  const [configurando, setConfigurando] = useState(false);
  const tanques = ordenarProductos(datos.tanques.map((x) => x.producto)).map((n) => datos.tanques.find((x) => x.producto === n)!);
  const cuenta = ORDEN_ESTADO.map((e) => [e, tanques.filter((x) => x.estado === e)] as const).filter(([, l]) => l.length);
  return (
    <section className={cn(TARJETA, 'p-[10px]')}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_320px]">
          <h2 className="text-[12px] font-bold leading-[1.25] text-tinta">Nivel actual de los tanques</h2>
          <p className="mt-px text-[11px] leading-[1.35] text-tenue">
            Estimado al {fechaHora(datos.ahora)} desde la última toma física, con las compras y las ventas cargadas. El semáforo: rojo, pedir ya;
            amarillo, pedir pronto; verde, estable; gris, arriba del llenado máximo.
          </p>
        </div>
        {puedeConfigurar && (
          <button type="button" className={BOTON_CHICO} onClick={() => setConfigurando(true)}>
            <Settings2 className="size-3.5" aria-hidden />
            Configurar tanques
          </button>
        )}
      </div>
      {tanques.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Todavía no hay combustibles en el modelo: carga un reporte de tickets.</p>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700 dark:text-slate-300">
            {cuenta.map(([e, l]) => (
              <Estado key={e} tipo={ESTADO_TANQUE[e]}>
                {l.map((x) => x.producto).join(', ')}: {l[0]!.titulo}
              </Estado>
            ))}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tanques.map((t) => (
              <TarjetaTanque key={t.producto} t={t} />
            ))}
          </div>
        </>
      )}
      {configurando && <ConfigurarTanques datos={datos} alCerrar={() => setConfigurando(false)} />}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

const CAMPOS: { clave: keyof ParametrosTanque; titulo: string; ayuda: string; paso: number; min: number }[] = [
  { clave: 'capacidad_galones', titulo: 'Capacidad (gal)', ayuda: 'Suma de los tanques del producto', paso: 1, min: 1 },
  { clave: 'tiempo_entrega_dias', titulo: 'Entrega (días)', ayuda: 'Del pedido a la descarga', paso: 0.5, min: 0 },
  { clave: 'dias_seguridad', titulo: 'Reserva (días)', ayuda: 'Venta que debe quedar al llegar', paso: 0.5, min: 0 },
  { clave: 'nivel_minimo_pct', titulo: 'Mínimo (%)', ayuda: 'Debajo de esto, pedir ya', paso: 1, min: 0 },
  { clave: 'llenado_maximo_pct', titulo: 'Llenado máximo (%)', ayuda: 'Hasta dónde se llena', paso: 1, min: 1 },
  { clave: 'multiplo_pedido', titulo: 'Pedidos de (gal)', ayuda: 'Múltiplo de cada pedido', paso: 100, min: 1 },
  { clave: 'horizonte_dias', titulo: 'Proyectar (días)', ayuda: 'Ventana para programar', paso: 1, min: 1 },
  { clave: 'dias_consumo', titulo: 'Promedio de (días)', ayuda: 'Días para la venta promedio', paso: 1, min: 3 },
];

type Valores = Record<string, Record<string, string>>;

function ConfigurarTanques({ datos, alCerrar }: { datos: NivelTanques; alCerrar: () => void }) {
  const productos = ordenarProductos(datos.tanques.map((x) => x.producto));
  const [valores, setValores] = useState<Valores>(() =>
    Object.fromEntries(
      productos.map((nombre) => {
        const x = datos.tanques.find((y) => y.producto === nombre);
        return [
          nombre,
          Object.fromEntries(
            CAMPOS.map((c) => {
              const v = x?.parametros?.[c.clave] ?? (c.clave === 'capacidad_galones' ? '' : datos.porDefecto[c.clave as keyof typeof datos.porDefecto]);
              return [c.clave, String(v)];
            }),
          ),
        ];
      }),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const guardar = useGuardarTanques();

  const enviar = () => {
    setError(null);
    const cambios: CuerpoTanque[] = [];
    for (const producto of productos) {
      const v = valores[producto]!;
      if (v.capacidad_galones!.trim() === '') continue; // sin capacidad no se guarda
      const p: Record<string, number> = {};
      for (const c of CAMPOS) {
        const texto = v[c.clave]!.trim();
        const n = Number(texto);
        if (texto === '' || !Number.isFinite(n) || n < c.min) {
          setError(`${producto}: «${c.titulo}» tiene que ser un número de ${c.min} en adelante.`);
          return;
        }
        p[c.clave] = c.clave === 'dias_consumo' ? Math.round(n) : n;
      }
      if (p.nivel_minimo_pct! >= p.llenado_maximo_pct!) {
        setError(`${producto}: el mínimo tiene que ser menor que el llenado máximo.`);
        return;
      }
      cambios.push({ estacion: datos.estacion, producto, ...(p as unknown as ParametrosTanque) });
    }
    if (!cambios.length) {
      setError('Escribe la capacidad de al menos un combustible.');
      return;
    }
    guardar.mutate(cambios, {
      onSuccess: () => {
        toast.success(cambios.length === 1 ? 'Tanque guardado' : `${cambios.length} tanques guardados`);
        alCerrar();
      },
      onError: (e) => setError(mensajeDeError(e)),
    });
  };

  return (
    <Modal
      abierto
      ancho
      alCerrar={alCerrar}
      titulo={`Configurar tanques · ${datos.estacion}`}
      descripcion="La capacidad es la suma de los tanques de cada combustible, en galones. Los demás valores deciden el semáforo; los que ya vienen son un punto de partida. Un producto sin capacidad no se guarda."
      pie={
        <>
          <Boton variante="secondary" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={enviar} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th scope="col" className="px-2.5 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                Combustible
              </th>
              {CAMPOS.map((c) => (
                <th key={c.clave} scope="col" title={c.ayuda} className="px-2 py-2 text-left align-bottom font-medium text-slate-600 dark:text-slate-300">
                  {c.titulo}
                  <small className="block font-normal text-slate-500 dark:text-slate-400">{c.ayuda}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productos.map((nombre, i) => (
              <tr key={nombre} className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className="px-2.5 py-2 text-left font-medium whitespace-nowrap text-slate-800 dark:text-slate-100">
                  <Punto color={colorProducto(nombre)} />
                  {nombre}
                </th>
                {CAMPOS.map((c, j) => (
                  <td key={c.clave} className="px-2 py-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={c.min}
                      step={c.paso}
                      autoFocus={i === 0 && j === 0}
                      aria-label={`${nombre}: ${c.titulo}`}
                      value={valores[nombre]![c.clave]}
                      onChange={(e) => setValores((v) => ({ ...v, [nombre]: { ...v[nombre]!, [c.clave]: e.target.value } }))}
                      className={claseEntrada(false, 'w-24 px-2 py-1.5 tabular-nums')}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}
