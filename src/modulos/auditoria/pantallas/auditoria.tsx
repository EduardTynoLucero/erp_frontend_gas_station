'use client';

import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { Aviso, EsqueletoTabla, Vacio } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { claseFiltro } from '@/componentes/ui/campos';
import { Insignia, type Tono } from '@/componentes/ui/insignia';
import { BarraFiltros, CampoFiltro, useFiltrosAbiertos } from '@/componentes/ui/listado';
import { Cabecera, ContenedorTabla, Cuerpo, MostrarRegistros, Paginacion, PieTabla, td, th } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fechaHora } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import { type ConsultaBitacora, exportarBitacora, useBitacora } from '../datos';

/** Tono de la etiqueta según la acción (palabra clave dentro del nombre de la acción). */
function tonoAccion(accion: string): Tono {
  const a = accion.toLowerCase();
  if (a.includes('aproba') || a.includes('autoriz')) return 'green';
  if (a.includes('rechaz') || a.includes('anula') || a.includes('elimin')) return 'red';
  if (a.includes('pag')) return 'blue';
  if (a.includes('config') || a.includes('prorrat')) return 'violet';
  if (a.includes('hallazgo')) return 'amber';
  return 'gray';
}

export function PantallaAuditoria() {
  const [abiertos, alternar] = useFiltrosAbiertos('auditoria');
  const [usuarioId, setUsuarioId] = useState('');
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [texto, setTexto] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(50);
  const [exportando, setExportando] = useState(false);
  const buscar = useDeferredValue(texto.trim());

  const filtro: Omit<ConsultaBitacora, 'pagina' | 'porPagina'> = {
    ...(usuarioId && { usuarioId }),
    ...(entidad && { entidad }),
    ...(accion && { accion }),
    ...(buscar && { buscar }),
    ...(desde && { desde }),
    ...(hasta && { hasta }),
  };
  const consulta = useBitacora({ ...filtro, pagina, porPagina });
  const d = consulta.data;
  const activos = [usuarioId, entidad, accion, texto.trim(), desde, hasta].filter(Boolean).length;
  const fijar = (f: (v: string) => void) => (v: string) => {
    f(v);
    setPagina(1);
  };

  function limpiar() {
    setUsuarioId('');
    setEntidad('');
    setAccion('');
    setTexto('');
    setDesde('');
    setHasta('');
    setPagina(1);
  }

  async function exportar() {
    setExportando(true);
    try {
      const n = await exportarBitacora(filtro);
      toast.success(`Se exportaron ${n.toLocaleString('en-US')} eventos.`);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setExportando(false);
    }
  }

  const pag = d?.paginacion;

  return (
    <div>
      <EncabezadoPagina
        titulo="Auditoría y trazabilidad"
        descripcion="Cada creación, autorización, pago y cambio de configuración queda registrado con usuario y hora. La bitácora no se puede editar."
        acciones={
          <Boton variante="ghost" cargando={exportando} disabled={!pag?.total} onClick={exportar}>
            Exportar CSV
          </Boton>
        }
      />

      <Tarjeta titulo="Bitácora" subtitulo={pag ? `${pag.total.toLocaleString('en-US')} eventos` : undefined} cuerpoClassName="p-0">
        <BarraFiltros
          abierto={abiertos}
          alAlternar={alternar}
          activos={activos}
          alLimpiar={limpiar}
          controles={<MostrarRegistros valor={porPagina} opciones={[25, 50, 100, 200]} alCambiar={(n) => (setPorPagina(n), setPagina(1))} />}
        >
          <CampoFiltro etiqueta="Usuario">
            <select className={claseFiltro()} value={usuarioId} onChange={(e) => fijar(setUsuarioId)(e.target.value)}>
              <option value="">Todos</option>
              {d?.filtros.usuarios.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Entidad">
            <select className={claseFiltro()} value={entidad} onChange={(e) => fijar(setEntidad)(e.target.value)}>
              <option value="">Todas</option>
              {d?.filtros.entidades.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Acción">
            <select className={claseFiltro()} value={accion} onChange={(e) => fijar(setAccion)(e.target.value)}>
              <option value="">Todas</option>
              {d?.filtros.acciones.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Desde">
            <input type="date" className={claseFiltro()} value={desde} onChange={(e) => fijar(setDesde)(e.target.value)} />
          </CampoFiltro>
          <CampoFiltro etiqueta="Hasta">
            <input type="date" className={claseFiltro()} value={hasta} onChange={(e) => fijar(setHasta)(e.target.value)} />
          </CampoFiltro>
          <CampoFiltro etiqueta="Buscar en detalle">
            <input className={claseFiltro()} value={texto} onChange={(e) => fijar(setTexto)(e.target.value)} placeholder="Folio, monto…" />
          </CampoFiltro>
        </BarraFiltros>

        <div className="p-[10px]">
          {consulta.isPending ? (
            <EsqueletoTabla />
          ) : consulta.isError ? (
            <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
          ) : consulta.data.eventos.length === 0 ? (
            <Vacio>
              {activos
                ? 'Ningún evento coincide con los filtros.'
                : 'La bitácora todavía está vacía. Aquí quedará cada gasto creado, autorizado o pagado y cada cambio de configuración, con su usuario y su hora.'}
            </Vacio>
          ) : (
            <>
              <ContenedorTabla anchoMinimo={760} className={cn(consulta.isPlaceholderData && 'opacity-60')}>
                <Cabecera>
                  <th className={th}>Fecha y hora</th>
                  <th className={th}>Usuario</th>
                  <th className={th}>Acción</th>
                  <th className={th}>Entidad</th>
                  <th className={th}>Detalle</th>
                </Cabecera>
                <Cuerpo>
                  {consulta.data.eventos.map((a) => (
                    <tr key={a.id}>
                      <td className={cn(td, 'whitespace-nowrap')}>{fechaHora(a.ocurridoEn)}</td>
                      <td className={cn(td, 'whitespace-nowrap')}>{a.usuario.nombre}</td>
                      <td className={td}>
                        <Insignia tono={tonoAccion(a.accion)}>{a.accion.replaceAll('_', ' ')}</Insignia>
                      </td>
                      <td className={td}>{a.entidad}</td>
                      <td className={cn(td, 'max-w-md truncate')} title={a.detalle}>
                        {a.detalle}
                      </td>
                    </tr>
                  ))}
                </Cuerpo>
              </ContenedorTabla>
              {pag && (
                <PieTabla
                  desde={(pag.pagina - 1) * pag.porPagina + 1}
                  hasta={(pag.pagina - 1) * pag.porPagina + consulta.data.eventos.length}
                  total={pag.total}
                  nombre="eventos"
                >
                  <Paginacion pagina={pag.pagina} paginas={pag.totalPaginas} alCambiar={setPagina} ocupado={consulta.isFetching} />
                </PieTabla>
              )}
            </>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}
