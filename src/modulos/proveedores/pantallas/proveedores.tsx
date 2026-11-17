'use client';

import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { useErp } from '@/componentes/marco/contexto';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { BarraTabla, BuscadorTabla, Cabecera, ContenedorTabla, Cuerpo, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina } from '@/componentes/ui/tarjeta';
import { q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type ProveedorDetalle, type ProveedoresPantalla, useEstadoProveedor, useGuardarProveedor, useProveedoresPantalla } from '../datos';

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo)?.mensaje : undefined;
}

interface Form {
  id: string | null;
  nombre: string;
  nit: string;
  tipo: string;
  categoriaId: string;
  contacto: string;
  telefono: string;
  diasCredito: string;
}

const cero = (v: string) => /^0+(\.0+)?$/.test(v);

export function PantallaProveedores() {
  const { estacionId } = useErp();
  const [texto, setTexto] = useState('');
  const buscar = useDeferredValue(texto);
  const consulta = useProveedoresPantalla(estacionId, buscar);
  const estado = useEstadoProveedor();
  const [form, setForm] = useState<Form | null>(null);
  const puede = consulta.data?.puedeEditar ?? false;

  const nuevo = (d: ProveedoresPantalla) =>
    setForm({ id: null, nombre: '', nit: '', tipo: '', categoriaId: d.categorias.find((c) => c.activa)?.id ?? '', contacto: '', telefono: '', diasCredito: '0' });
  const editar = (p: ProveedorDetalle) =>
    setForm({
      id: p.id,
      nombre: p.nombre,
      nit: p.nit,
      tipo: p.tipo,
      categoriaId: p.categoria?.id ?? '',
      contacto: p.contacto,
      telefono: p.telefono,
      diasCredito: String(p.diasCredito),
    });

  async function alternar(p: ProveedorDetalle) {
    try {
      const r = await estado.mutateAsync({ id: p.id, activo: !p.activo });
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion={`Proveedores de bienes, servicios y mantenimiento. Los marcados con origen vienen de los reportes del sistema de la estación.${
          consulta.data && !puede ? ' Los da de alta Contabilidad, para evitar proveedores ficticios.' : ''
        }`}
        acciones={consulta.data && puede && <Boton onClick={() => nuevo(consulta.data)}>+ Nuevo proveedor</Boton>}
      />
      <BarraTabla>
        <BuscadorTabla valor={texto} alCambiar={setTexto} etiqueta="Buscar por nombre, NIT o tipo…" className="sm:w-[300px]" />
      </BarraTabla>
      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : consulta.data.proveedores.length === 0 ? (
        <Vacio>
          {buscar.trim()
            ? 'Ningún proveedor coincide con la búsqueda.'
            : `Todavía no hay proveedores.${puede ? ' Dé de alta el primero con «+ Nuevo proveedor».' : ''}`}
        </Vacio>
      ) : (
        <ContenedorTabla anchoMinimo={940}>
          <Cabecera>
            <th className={th}>Proveedor</th>
            <th className={th}>NIT</th>
            <th className={th}>Categoría</th>
            <th className={thR}>Crédito</th>
            <th className={thR}>Gastos</th>
            <th className={thR}>Pagado</th>
            <th className={thR}>Por pagar</th>
            <th className={th}>Estado</th>
            <th className={th}></th>
          </Cabecera>
          <Cuerpo>
            {consulta.data.proveedores.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                <td className={td}>
                  <p className="font-medium text-tinta">{p.nombre}</p>
                  <p className="text-[10px] text-tenue">
                    {p.tipo}
                    {p.fuente && (
                      <Insignia tono="violet" className="ml-1">
                        {p.fuente}
                      </Insignia>
                    )}
                  </p>
                </td>
                <td className={cn(td, 'tabular-nums')}>{p.nit}</td>
                <td className={td}>{p.categoria?.nombre ?? '—'}</td>
                <td className={tdR}>{p.diasCredito ? `${p.diasCredito} días` : 'Contado'}</td>
                <td className={tdR}>{p.gastos}</td>
                <td className={tdR}>{q(p.pagado)}</td>
                <td className={tdR}>{cero(p.porPagar) ? '—' : q(p.porPagar)}</td>
                <td className={td}>{p.activo ? <Insignia tono="green">Activo</Insignia> : <Insignia>Inactivo</Insignia>}</td>
                <td className={tdR}>
                  {puede && (
                    <span className="inline-flex gap-1">
                      <Boton tamano="sm" variante="ghost" onClick={() => editar(p)}>
                        Editar
                      </Boton>
                      <Boton tamano="sm" variante="ghost" onClick={() => alternar(p)} disabled={estado.isPending}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </Boton>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Cuerpo>
        </ContenedorTabla>
      )}

      {form && consulta.data && <DialogoProveedor form={form} setForm={setForm} categorias={consulta.data.categorias} />}
    </div>
  );
}

function DialogoProveedor({
  form,
  setForm,
  categorias,
}: {
  form: Form;
  setForm: (f: Form | null) => void;
  categorias: ProveedoresPantalla['categorias'];
}) {
  const guardar = useGuardarProveedor();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  async function confirmar() {
    try {
      const r = await guardar.mutateAsync({
        id: form.id,
        cuerpo: {
          nombre: form.nombre,
          nit: form.nit,
          tipo: form.tipo,
          categoriaId: form.categoriaId || null,
          contacto: form.contacto,
          telefono: form.telefono,
          diasCredito: Math.max(0, Math.trunc(Number(form.diasCredito) || 0)),
        },
      });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      ancho
      alCerrar={cerrar}
      titulo={form.id ? `Editar ${form.nombre}` : 'Nuevo proveedor'}
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={guardar.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre o razón social" className="sm:col-span-2" htmlFor="pr-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="pr-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="NIT" pista="Se valida que no esté repetido" htmlFor="pr-nit" error={errorDe(e, 'nit')}>
          <Entrada id="pr-nit" value={form.nit} onChange={(ev) => setForm({ ...form, nit: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Tipo" htmlFor="pr-tipo" error={errorDe(e, 'tipo')}>
          <Entrada id="pr-tipo" value={form.tipo} onChange={(ev) => setForm({ ...form, tipo: ev.target.value })} placeholder="Mantenimiento, servicios…" />
        </Campo>
        <Campo etiqueta="Categoría principal" htmlFor="pr-cat" error={errorDe(e, 'categoriaId')}>
          <Seleccion id="pr-cat" value={form.categoriaId} onChange={(ev) => setForm({ ...form, categoriaId: ev.target.value })}>
            <option value="">Sin categoría</option>
            {categorias
              .filter((c) => c.activa || c.id === form.categoriaId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Días de crédito" htmlFor="pr-dias" error={errorDe(e, 'diasCredito')}>
          <Entrada id="pr-dias" type="number" min="0" inputMode="numeric" value={form.diasCredito} onChange={(ev) => setForm({ ...form, diasCredito: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Contacto" htmlFor="pr-contacto" error={errorDe(e, 'contacto')}>
          <Entrada id="pr-contacto" value={form.contacto} onChange={(ev) => setForm({ ...form, contacto: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="pr-tel" error={errorDe(e, 'telefono')}>
          <Entrada id="pr-tel" value={form.telefono} onChange={(ev) => setForm({ ...form, telefono: ev.target.value })} />
        </Campo>
      </div>
    </Modal>
  );
}
