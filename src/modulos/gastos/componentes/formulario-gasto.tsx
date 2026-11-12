'use client';

/**
 * Formulario de gasto (nuevo o edición de borrador), dentro del modal de la plantilla: secciones «Datos del gasto» y
 * «Comprobante», el recuadro de la política a la derecha y los botones en el pie del modal. Port de GastoNuevo.tsx
 * conectado a la API:
 *  - POST /api/v1/gastos con la cabecera Idempotency-Key: una clave por formulario, la MISMA en cada reintento
 *    (doble clic, red caída): el backend devuelve el gasto ya creado en lugar de duplicarlo.
 *  - PUT /api/v1/gastos/:id con la versión que se cargó (bloqueo optimista).
 *  - Montos como texto exacto; los errores por campo del backend se marcan en el formulario.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { type FieldErrors, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import type { CatalogosGasto, CuerpoGasto, GastoDetalle } from '@/api/tipos';
import { Aviso } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { PieDeModal } from '@/componentes/ui/modal';
import { Segmentado } from '@/componentes/ui/segmentado';
import { q, sumarDias } from '@/lib/formato';
import { useActualizarGasto, useCrearGasto } from '../datos';
import { CAMPO_DE_API, type CampoGasto, montoFuncionalEstimado, validarGasto, type ValoresGasto } from '../validacion';

const ORDEN_CAMPOS: CampoGasto[] = ['fecha', 'estacionId', 'centroCostoId', 'descripcion', 'monto', 'tipoCambio', 'docNumero', 'vencimiento'];

function nuevaClave(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function valoresIniciales(c: CatalogosGasto, gasto: GastoDetalle | undefined, estacionPreferida: string | undefined): ValoresGasto {
  if (gasto) {
    return {
      modo: gasto.documento.tipo === 'Sin documento' ? 'solicitud' : 'gasto',
      fecha: gasto.fecha,
      estacionId: gasto.estacion.id,
      centroCostoId: gasto.centroCosto.id,
      categoriaId: gasto.categoria.id,
      subcategoria: gasto.subcategoria,
      proveedorId: gasto.proveedor?.id ?? '',
      descripcion: gasto.descripcion,
      moneda: gasto.moneda.codigo,
      monto: gasto.monto,
      tipoCambio: gasto.moneda.codigo === 'GTQ' ? '' : gasto.tipoCambio,
      metodoPago: gasto.metodoPago,
      vencimiento: gasto.vencimiento ?? '',
      docTipo: gasto.documento.tipo === 'Sin documento' ? 'FEL' : gasto.documento.tipo,
      docSerie: gasto.documento.serie,
      docNumero: gasto.documento.numero,
    };
  }
  const estacion = c.estaciones.find((e) => e.id === estacionPreferida) ?? c.estaciones[0];
  const categoria = c.categorias.find((x) => x.id === 'ADM') ?? c.categorias[0];
  return {
    modo: 'gasto',
    fecha: c.parametros.hoy,
    estacionId: estacion?.id ?? '',
    centroCostoId: c.centrosCosto.find((x) => x.estacionId === estacion?.id)?.id ?? '',
    categoriaId: categoria?.id ?? '',
    subcategoria: categoria?.subcategorias[0] ?? '',
    proveedorId: '',
    descripcion: '',
    moneda: c.parametros.monedaFuncional,
    monto: '',
    tipoCambio: '',
    metodoPago: c.metodosPago.find((m) => !m.esAjuste)?.codigo ?? 'Transferencia',
    vencimiento: '',
    docTipo: 'FEL',
    docSerie: '',
    docNumero: '',
  };
}

function cuerpoDe(v: ValoresGasto, c: CatalogosGasto, vencimiento: string): Omit<CuerpoGasto, 'enviar'> {
  const moneda = c.monedas.find((m) => m.codigo === v.moneda);
  const sinDocumento = v.modo === 'solicitud' || v.docTipo === 'Sin documento';
  return {
    fecha: v.fecha,
    estacionId: v.estacionId,
    centroCostoId: v.centroCostoId,
    categoriaId: v.categoriaId,
    subcategoria: v.subcategoria,
    proveedorId: v.proveedorId || null,
    descripcion: v.descripcion.trim(),
    moneda: v.moneda,
    monto: v.monto.trim(),
    ...(moneda && !moneda.esFuncional ? { tipoCambio: v.tipoCambio.trim() } : {}),
    metodoPago: v.metodoPago,
    documento: sinDocumento
      ? { tipo: 'Sin documento', serie: '', numero: '', fechaEmision: null }
      : { tipo: v.docTipo, serie: v.docTipo === 'FEL' ? v.docSerie.trim().toUpperCase() : '', numero: v.docNumero.trim(), fechaEmision: v.fecha },
    vencimiento,
  };
}

const TITULO_SECCION = 'text-[12px] font-bold leading-[1.3] text-tinta';
const MODOS: { valor: ValoresGasto['modo']; texto: string }[] = [
  { valor: 'gasto', texto: 'Gasto realizado' },
  { valor: 'solicitud', texto: 'Solicitud previa' },
];

export function FormularioGasto({
  catalogos,
  gasto,
  estacionPreferida,
  alCancelar,
  alGuardado,
}: {
  catalogos: CatalogosGasto;
  gasto?: GastoDetalle | undefined;
  estacionPreferida?: string | undefined;
  alCancelar: () => void;
  /** El gasto ya quedó guardado: recibe el gasto y el mensaje del backend */
  alGuardado: (gasto: GastoDetalle, mensaje: string) => void;
}) {
  const crear = useCrearGasto();
  const actualizar = useActualizarGasto();
  const clave = useRef<string | null>(null);
  // El borrador tal como se abrió: su versión viaja al guardar (bloqueo optimista), aunque el detalle se refresque solo
  const original = useRef(gasto).current;
  const [erroresServidor, setErroresServidor] = useState<string[]>([]);
  const [enviando, setEnviando] = useState<'borrador' | 'enviar' | null>(null);

  const resolver = useCallback<Resolver<ValoresGasto>>(
    async (valores) => {
      const errores = validarGasto(valores, catalogos);
      if (Object.keys(errores).length === 0) return { values: valores, errors: {} };
      const rhf: FieldErrors<ValoresGasto> = {};
      for (const [campo, mensaje] of Object.entries(errores)) rhf[campo as CampoGasto] = { type: 'validacion', message: mensaje };
      return { values: {}, errors: rhf };
    },
    [catalogos],
  );

  const { register, watch, setValue, setError, handleSubmit, formState } = useForm<ValoresGasto>({
    defaultValues: valoresIniciales(catalogos, gasto, estacionPreferida),
    resolver,
    reValidateMode: 'onChange',
  });
  const v = watch();
  const errores = formState.errors;

  const centros = catalogos.centrosCosto.filter((c) => c.estacionId === v.estacionId);
  const categoria = catalogos.categorias.find((c) => c.id === v.categoriaId);
  const proveedores = useMemo(
    () =>
      [...catalogos.proveedores].sort((a, b) => {
        const pa = a.categoriaId === v.categoriaId ? 0 : 1;
        const pb = b.categoriaId === v.categoriaId ? 0 : 1;
        return pa - pb || a.nombre.localeCompare(b.nombre, 'es');
      }),
    [catalogos.proveedores, v.categoriaId],
  );
  const proveedor = catalogos.proveedores.find((p) => p.id === v.proveedorId);
  const vencimientoSugerido = v.fecha ? sumarDias(v.fecha, proveedor?.diasCredito ?? 0) : '';
  const moneda = catalogos.monedas.find((m) => m.codigo === v.moneda);
  const extranjera = Boolean(moneda && !moneda.esFuncional);
  const montoGtq = montoFuncionalEstimado(v.monto, extranjera ? v.tipoCambio : '1');
  const nivel = catalogos.niveles.find((n) => n.hasta === null || montoGtq.lte(n.hasta)) ?? catalogos.niveles.at(-1);
  const minimoComprobante = catalogos.parametros.comprobanteObligatorioDesde;
  const sinDocumentoObligatorio = v.modo === 'gasto' && v.docTipo === 'Sin documento' && montoGtq.gte(minimoComprobante);

  async function guardar(valores: ValoresGasto, enviar: boolean) {
    setErroresServidor([]);
    setEnviando(enviar ? 'enviar' : 'borrador');
    const cuerpo = cuerpoDe(valores, catalogos, valores.vencimiento || vencimientoSugerido);
    try {
      const r = original
        ? await actualizar.mutateAsync({ id: original.id, cuerpo: { ...cuerpo, enviar, version: original.version } })
        : await crear.mutateAsync({ cuerpo: { ...cuerpo, enviar }, clave: (clave.current ??= nuevaClave()) });
      alGuardado(r.data, r.mensaje);
    } catch (error) {
      setEnviando(null);
      if (error instanceof ErrorApi) {
        const sueltos: string[] = [];
        for (const e of error.errores) {
          const campo = CAMPO_DE_API[e.campo];
          if (campo) setError(campo, { type: 'servidor', message: e.mensaje });
          else sueltos.push(e.mensaje);
        }
        if (error.errores.length === 0) sueltos.push(error.message);
        setErroresServidor(sueltos);
        toast.error(error.message);
      } else {
        toast.error(mensajeDeError(error));
      }
    }
  }

  const mensajes = [...ORDEN_CAMPOS.map((c) => errores[c]?.message).filter((m): m is string => Boolean(m)), ...erroresServidor];

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="grid gap-[10px] lg:grid-cols-[minmax(0,1fr)_250px]">
      <div className="grid min-w-0 content-start gap-[10px]">
        <Segmentado etiqueta="Tipo de registro" opciones={MODOS} valor={v.modo} alCambiar={(m) => setValue('modo', m)} className="justify-self-start" />

        <section className="grid gap-[8px]">
          <h3 className={TITULO_SECCION}>Datos del gasto</h3>
          <div className="grid items-start gap-x-[10px] gap-y-[8px] sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Fecha" htmlFor="fecha" error={errores.fecha?.message}>
              <Entrada id="fecha" type="date" max={catalogos.parametros.hoy} invalido={!!errores.fecha} {...register('fecha')} />
            </Campo>
            <Campo etiqueta="Estación" htmlFor="estacionId" error={errores.estacionId?.message}>
              <Seleccion
                id="estacionId"
                invalido={!!errores.estacionId}
                {...register('estacionId', {
                  onChange: (e) => setValue('centroCostoId', catalogos.centrosCosto.find((c) => c.estacionId === e.target.value)?.id ?? ''),
                })}
              >
                {catalogos.estaciones.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Centro de costo" htmlFor="centroCostoId" pista="Unidad de negocio que absorbe el gasto" error={errores.centroCostoId?.message}>
              <Seleccion id="centroCostoId" invalido={!!errores.centroCostoId} {...register('centroCostoId')}>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Categoría" htmlFor="categoriaId" error={errores.categoriaId?.message}>
              <Seleccion
                id="categoriaId"
                {...register('categoriaId', {
                  onChange: (e) => setValue('subcategoria', catalogos.categorias.find((c) => c.id === e.target.value)?.subcategorias[0] ?? ''),
                })}
              >
                {catalogos.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cuentaContable} · {c.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Subcategoría" htmlFor="subcategoria" error={errores.subcategoria?.message}>
              <Seleccion id="subcategoria" {...register('subcategoria')}>
                {(categoria?.subcategorias ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Proveedor" htmlFor="proveedorId" error={errores.proveedorId?.message}>
              <Seleccion id="proveedorId" {...register('proveedorId')}>
                <option value="">Sin proveedor / varios</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2 lg:col-span-3" error={errores.descripcion?.message}>
              <Entrada id="descripcion" placeholder="Qué se compró o contrató y para qué" invalido={!!errores.descripcion} {...register('descripcion')} />
            </Campo>
            <Campo etiqueta="Moneda" htmlFor="moneda" error={errores.moneda?.message}>
              <Seleccion id="moneda" {...register('moneda', { onChange: () => setValue('tipoCambio', '') })}>
                {catalogos.monedas.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.codigo} · {m.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta={`Monto (IVA incluido)${moneda ? ` en ${moneda.simbolo}` : ''}`} htmlFor="monto" error={errores.monto?.message} pista="Use punto decimal, sin separadores de miles">
              <Entrada id="monto" inputMode="decimal" autoComplete="off" placeholder="0.00" className="tabular-nums" invalido={!!errores.monto} {...register('monto')} />
            </Campo>
            {extranjera && (
              <Campo
                etiqueta={`Tipo de cambio (Q por ${moneda?.codigo})`}
                htmlFor="tipoCambio"
                error={errores.tipoCambio?.message}
                pista={montoGtq.gt(0) ? `Equivale a ${q(montoGtq.toFixed(2))}` : 'Tasa del día del documento'}
              >
                <Entrada id="tipoCambio" inputMode="decimal" autoComplete="off" placeholder="7.66770" className="tabular-nums" invalido={!!errores.tipoCambio} {...register('tipoCambio')} />
              </Campo>
            )}
            <Campo etiqueta="Forma de pago" htmlFor="metodoPago" error={errores.metodoPago?.message}>
              <Seleccion id="metodoPago" {...register('metodoPago')}>
                {catalogos.metodosPago
                  .filter((m) => !m.esAjuste)
                  .map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.codigo}
                    </option>
                  ))}
              </Seleccion>
            </Campo>
            <Campo
              etiqueta="Vencimiento del pago"
              htmlFor="vencimiento"
              error={errores.vencimiento?.message}
              pista={proveedor ? `Sugerido por ${proveedor.diasCredito} días de crédito` : undefined}
            >
              <Entrada
                id="vencimiento"
                type="date"
                value={v.vencimiento || vencimientoSugerido}
                onChange={(e) => setValue('vencimiento', e.target.value, { shouldValidate: formState.isSubmitted })}
              />
            </Campo>
          </div>
        </section>

        {v.modo === 'gasto' ? (
          <section className="grid gap-[8px] border-t border-borde-suave pt-[10px]">
            <h3 className={TITULO_SECCION}>Comprobante</h3>
            <div className="grid items-start gap-x-[10px] gap-y-[8px] sm:grid-cols-3">
              <Campo etiqueta="Tipo" htmlFor="docTipo">
                <Seleccion id="docTipo" {...register('docTipo')}>
                  <option value="FEL">Factura FEL</option>
                  <option value="Recibo">Recibo</option>
                  <option value="Sin documento">Sin documento</option>
                </Seleccion>
              </Campo>
              {v.docTipo === 'FEL' && (
                <Campo etiqueta="Serie" htmlFor="docSerie">
                  <Entrada id="docSerie" placeholder="Ej. A1B2C3D4" invalido={!!errores.docNumero} {...register('docSerie')} />
                </Campo>
              )}
              {v.docTipo !== 'Sin documento' && (
                <Campo etiqueta="Número" htmlFor="docNumero" error={errores.docNumero?.message}>
                  <Entrada id="docNumero" invalido={!!errores.docNumero} {...register('docNumero')} />
                </Campo>
              )}
            </div>
            {sinDocumentoObligatorio && (
              <Aviso tono="amber">Desde {q(minimoComprobante)} el comprobante es obligatorio. Puede enviarlo, pero no se podrá pagar hasta adjuntarlo.</Aviso>
            )}
          </section>
        ) : (
          <Aviso>La solicitud se autoriza antes de comprar. El comprobante se adjunta después, antes del pago.</Aviso>
        )}

        {formState.isSubmitted && mensajes.length > 0 && (
          <Aviso tono="red">
            <ul className="list-inside list-disc space-y-px">
              {mensajes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Aviso>
        )}
      </div>

      {/* Recuadro rojo muy suave con título, como los de los modales de la plantilla */}
      <aside className="content-start self-start rounded-[10px] border border-brand-100 bg-brand-50/50 px-[12px] pb-[12px] pt-[10px] dark:border-borde dark:bg-superficie-suave">
        <h3 className="mb-[6px] text-[13px] font-extrabold leading-[1.3] text-tinta">Política que se aplicará</h3>
        <dl className="grid gap-[7px] text-[12px]">
          <div>
            <dt className="text-[11px] font-semibold text-tenue">Autoriza</dt>
            <dd className="font-semibold text-tinta">
              {nivel?.etiqueta ?? '—'}
              {nivel?.hasta && <span className="font-normal text-tenue"> (hasta {q(nivel.hasta)})</span>}
            </dd>
          </div>
          {extranjera && montoGtq.gt(0) && (
            <div>
              <dt className="text-[11px] font-semibold text-tenue">Equivalente en quetzales</dt>
              <dd className="font-semibold tabular-nums text-tinta">{q(montoGtq.toFixed(2))}</dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] font-semibold text-tenue">Comprobante</dt>
            <dd className="text-tinta">Obligatorio desde {q(minimoComprobante)} para poder pagar</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-tenue">Separación de funciones</dt>
            <dd className="text-tinta">Quien solicita no puede autorizar su propio gasto</dd>
          </div>
        </dl>
        {!gasto && (
          <p className="mt-[8px] border-t border-brand-100 pt-[7px] text-[10.5px] leading-[1.4] text-tenue dark:border-borde">
            Cada envío lleva una clave de idempotencia: si se repite por un doble clic o una falla de red, el gasto no se duplica.
          </p>
        )}
      </aside>

      <PieDeModal>
        <Boton variante="ghost" onClick={alCancelar} disabled={enviando !== null}>
          Cancelar
        </Boton>
        <Boton variante="secondary" cargando={enviando === 'borrador'} disabled={enviando !== null} onClick={handleSubmit((valores) => guardar(valores, false))}>
          Guardar borrador
        </Boton>
        <Boton cargando={enviando === 'enviar'} disabled={enviando !== null} onClick={handleSubmit((valores) => guardar(valores, true))}>
          Enviar a autorización
        </Boton>
      </PieDeModal>
    </form>
  );
}
