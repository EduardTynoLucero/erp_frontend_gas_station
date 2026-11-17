'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { Aviso } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { AreaTexto, Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { SEVERIDADES, type Severidad } from '@/componentes/ui/insignia';
import { Modal, PieDeModal } from '@/componentes/ui/modal';
import { periodoLabel, q } from '@/lib/formato';
import {
  type AnalisisDeReportes,
  type CuerpoNuevoHallazgo,
  type Hallazgo,
  type Hallazgos,
  useAnalizarReportes,
  useGastoDeHallazgo,
  useRegistrarHallazgo,
} from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

/** Registro manual de un hallazgo (origen MANUAL). */
export function ModalNuevoHallazgo({ datos, estacionInicial, alCerrar }: { datos: Hallazgos; estacionInicial?: string; alCerrar: () => void }) {
  const registrar = useRegistrarHallazgo();
  const [f, setF] = useState<CuerpoNuevoHallazgo>({
    severidad: 'media',
    titulo: '',
    monto: null,
    estacionId: datos.estaciones.find((e) => e.id === estacionInicial)?.id ?? datos.estaciones[0]?.id ?? '',
    fuente: '',
    detalle: '',
    accion: '',
    fecha: datos.hoy,
  });
  const cambiar = <K extends keyof CuerpoNuevoHallazgo>(k: K, v: CuerpoNuevoHallazgo[K]) => setF((x) => ({ ...x, [k]: v }));
  const e = registrar.error;

  async function guardar() {
    try {
      const r = await registrar.mutateAsync(f);
      toast.success(r.mensaje);
      alCerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  return (
    <Modal abierto alCerrar={alCerrar} ancho titulo="Registrar hallazgo" descripcion="Un riesgo encontrado al revisar los reportes de la estación, para darle seguimiento.">
      <div className="grid gap-[8px] sm:grid-cols-2">
        <Campo etiqueta="Estación" error={errorDe(e, 'estacionId')}>
          <Seleccion value={f.estacionId} onChange={(ev) => cambiar('estacionId', ev.target.value)}>
            {datos.estaciones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.codigo} · {x.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Severidad" error={errorDe(e, 'severidad')}>
          <Seleccion value={f.severidad} onChange={(ev) => cambiar('severidad', ev.target.value as Severidad)}>
            {(Object.keys(SEVERIDADES) as Severidad[]).map((s) => (
              <option key={s} value={s}>
                {SEVERIDADES[s].texto}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Título" error={errorDe(e, 'titulo')} className="sm:col-span-2">
          <Entrada value={f.titulo} onChange={(ev) => cambiar('titulo', ev.target.value)} placeholder="Ej.: Tickets con precio fuera de pricebook" />
        </Campo>
        <Campo etiqueta="Monto en riesgo (Q)" pista="Vacío si no se puede valorar en quetzales" error={errorDe(e, 'monto')}>
          <Entrada inputMode="decimal" value={f.monto ?? ''} onChange={(ev) => cambiar('monto', ev.target.value.trim() ? ev.target.value : null)} placeholder="0.00" />
        </Campo>
        <Campo etiqueta="Fecha" error={errorDe(e, 'fecha')}>
          <Entrada type="date" max={datos.hoy} value={f.fecha} onChange={(ev) => cambiar('fecha', ev.target.value)} />
        </Campo>
        <Campo etiqueta="Fuente" pista="Reporte o sistema donde se vio (tickets, cierres, liquidación…)" error={errorDe(e, 'fuente')} className="sm:col-span-2">
          <Entrada value={f.fuente} onChange={(ev) => cambiar('fuente', ev.target.value)} />
        </Campo>
        <Campo etiqueta="Detalle" error={errorDe(e, 'detalle')} className="sm:col-span-2">
          <AreaTexto value={f.detalle} onChange={(ev) => cambiar('detalle', ev.target.value)} />
        </Campo>
        <Campo etiqueta="Acción" pista="Qué hay que hacer para atenderlo" error={errorDe(e, 'accion')} className="sm:col-span-2">
          <AreaTexto value={f.accion} onChange={(ev) => cambiar('accion', ev.target.value)} />
        </Campo>
      </div>
      <PieDeModal>
        <Boton variante="secondary" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton cargando={registrar.isPending} onClick={guardar}>
          Registrar hallazgo
        </Boton>
      </PieDeModal>
    </Modal>
  );
}

/** Analiza los reportes del ETL ya cargados de un mes y muestra lo que generó. */
export function ModalAnalizar({ datos, alCerrar }: { datos: Hallazgos; alCerrar: () => void }) {
  const analizar = useAnalizarReportes();
  const [periodo, setPeriodo] = useState(datos.periodoActual);
  const [resultado, setResultado] = useState<AnalisisDeReportes | null>(null);

  async function ejecutar() {
    try {
      const r = await analizar.mutateAsync(periodo);
      toast.success(r.mensaje);
      setResultado(r.data);
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Analizar reportes"
      descripcion="Revisa los reportes de la estación ya cargados de un mes y genera o actualiza sus hallazgos."
    >
      {resultado ? (
        <div className="grid gap-[8px]">
          <p className="text-[12px] text-tinta">
            {periodoLabel(resultado.periodo)}: {resultado.creados} nuevos, {resultado.actualizados} actualizados y {resultado.sinCambios} sin cambios.
          </p>
          {resultado.hallazgos.length > 0 && (
            <ul className="divide-y divide-borde-suave rounded-[2px] border border-borde text-[11px]">
              {resultado.hallazgos.map((h) => (
                <li key={h.codigo} className="flex items-center justify-between gap-[6px] px-[8px] py-[4px]">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{h.codigo}</span> · {h.estacion} · {h.titulo}
                  </span>
                  <span className={h.nuevo ? 'font-semibold text-primario-tinta' : 'text-tenue'}>{h.nuevo ? 'Nuevo' : 'Actualizado'}</span>
                </li>
              ))}
            </ul>
          )}
          {resultado.sinEstacion.length > 0 && (
            <Aviso tono="amber">
              Estaciones de los reportes sin estación del ERP ligada (sus alertas no generan hallazgos): {resultado.sinEstacion.join(', ')}.
            </Aviso>
          )}
        </div>
      ) : (
        <div className="grid gap-[8px]">
          <Campo etiqueta="Mes" pista="Por omisión, el periodo abierto. Volver a analizar actualiza las cifras sin repetir hallazgos ni reabrir los cerrados.">
            <Entrada type="month" value={periodo} onChange={(ev) => setPeriodo(ev.target.value)} />
          </Campo>
          <Aviso>
            Se buscan alertas de ticket (precio fuera de pricebook, posibles duplicados, sin producto), venta bajo costo, saltos en la numeración de tickets y
            merma de las tomas físicas por encima de la tolerancia.
          </Aviso>
        </div>
      )}
      <PieDeModal>
        {resultado ? (
          <Boton onClick={alCerrar}>Cerrar</Boton>
        ) : (
          <>
            <Boton variante="secondary" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton cargando={analizar.isPending} onClick={ejecutar}>
              Analizar
            </Boton>
          </>
        )}
      </PieDeModal>
    </Modal>
  );
}

/** Registra la pérdida del hallazgo como gasto por autorizar. */
export function ModalGastoDeHallazgo({ datos, hallazgo, alCerrar }: { datos: Hallazgos; hallazgo: Hallazgo; alCerrar: () => void }) {
  const registrar = useGastoDeHallazgo();
  const [categoriaId, setCategoriaId] = useState(datos.categorias[0]?.id ?? '');
  const [subcategoria, setSubcategoria] = useState('');
  const [centroCostoId, setCentroCostoId] = useState('');
  const [monto, setMonto] = useState(hallazgo.monto ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [gasto, setGasto] = useState<{ id: string; folio: string; monto: string } | null>(null);
  const categoria = datos.categorias.find((c) => c.id === categoriaId);
  const centros = datos.centros.filter((c) => c.estacionId === hallazgo.estacion.id);
  const e = registrar.error;

  async function guardar() {
    try {
      const r = await registrar.mutateAsync({
        id: hallazgo.id,
        cuerpo: { categoriaId, subcategoria, monto, descripcion, ...(centroCostoId ? { centroCostoId } : {}) },
      });
      toast.success(r.mensaje);
      setGasto(r.data.gasto);
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      ancho
      titulo="Registrar pérdida como gasto"
      descripcion={`${hallazgo.codigo} · ${hallazgo.titulo}. Se crea un gasto por autorizar (ajuste contable sin factura) con el código del hallazgo como referencia.`}
    >
      {gasto ? (
        <Aviso tono="green">
          Se registró el gasto{' '}
          <Link href={`/gastos/${gasto.id}`} className="font-semibold underline">
            {gasto.folio}
          </Link>{' '}
          por {q(gasto.monto)}. Queda por autorizar.
        </Aviso>
      ) : (
        <div className="grid gap-[8px] sm:grid-cols-2">
          <Campo etiqueta="Categoría" error={errorDe(e, 'categoriaId')}>
            <Seleccion
              value={categoriaId}
              onChange={(ev) => {
                setCategoriaId(ev.target.value);
                setSubcategoria('');
              }}
            >
              {datos.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Subcategoría" error={errorDe(e, 'subcategoria')}>
            <Seleccion value={subcategoria} onChange={(ev) => setSubcategoria(ev.target.value)}>
              <option value="">La primera de la categoría</option>
              {categoria?.subcategorias.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Centro de costo" error={errorDe(e, 'centroCostoId')}>
            <Seleccion value={centroCostoId} onChange={(ev) => setCentroCostoId(ev.target.value)}>
              <option value="">Administración de {hallazgo.estacion.codigo}</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Pérdida a registrar (Q)" error={errorDe(e, 'monto')}>
            <Entrada inputMode="decimal" value={monto} onChange={(ev) => setMonto(ev.target.value)} placeholder="0.00" />
          </Campo>
          <Campo etiqueta="Descripción" pista="Vacía: el título del hallazgo" error={errorDe(e, 'descripcion')} className="sm:col-span-2">
            <Entrada value={descripcion} onChange={(ev) => setDescripcion(ev.target.value)} placeholder={hallazgo.titulo} />
          </Campo>
        </div>
      )}
      <PieDeModal>
        {gasto ? (
          <Boton onClick={alCerrar}>Cerrar</Boton>
        ) : (
          <>
            <Boton variante="secondary" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton cargando={registrar.isPending} onClick={guardar}>
              Registrar gasto
            </Boton>
          </>
        )}
      </PieDeModal>
    </Modal>
  );
}
