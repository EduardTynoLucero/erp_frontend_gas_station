'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, cx, Field, inputCls, PageHeader, TableWrap, td, th } from '../components/ui';
import { descargarCSV, fechaHora } from '../lib/format';
import { useCatalogos, useStore } from '../lib/store';

const TONO: Record<string, 'green' | 'red' | 'blue' | 'amber' | 'gray' | 'violet'> = {
  aprobado: 'green',
  rechazado: 'red',
  pagar: 'blue',
  crear: 'gray',
  configurar: 'violet',
  prorrateo: 'violet',
  hallazgo: 'amber',
};

export default function Auditoria() {
  const { db } = useStore();
  const c = useCatalogos();
  const [u, setU] = useState('');
  const [ent, setEnt] = useState('');
  const [acc, setAcc] = useState('');
  const [texto, setTexto] = useState('');
  const [limite, setLimite] = useState(60);

  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return db.auditoria
      .filter((a) => (!u || a.usuarioId === u) && (!ent || a.entidad === ent) && (!acc || a.accion === acc))
      .filter((a) => !t || a.detalle.toLowerCase().includes(t))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [db.auditoria, u, ent, acc, texto]);

  const entidades = [...new Set(db.auditoria.map((a) => a.entidad))].sort();
  const accionesLista = [...new Set(db.auditoria.map((a) => a.accion))].sort();

  return (
    <div>
      <PageHeader
        title="Auditoría y trazabilidad"
        description="Cada creación, autorización, pago y cambio de configuración queda registrado con usuario y hora. La bitácora no se puede editar."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              descargarCSV('bitacora.csv', [
                ['Fecha', 'Usuario', 'Acción', 'Entidad', 'Detalle'],
                ...filas.map((a) => [a.fecha, c.usrNombre(a.usuarioId), a.accion, a.entidad, a.detalle]),
              ])
            }
          >
            Exportar CSV
          </Button>
        }
      />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Usuario">
            <select className={inputCls} value={u} onChange={(e) => setU(e.target.value)}>
              <option value="">Todos</option>
              {db.usuarios.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Entidad">
            <select className={inputCls} value={ent} onChange={(e) => setEnt(e.target.value)}>
              <option value="">Todas</option>
              {entidades.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Acción">
            <select className={inputCls} value={acc} onChange={(e) => setAcc(e.target.value)}>
              <option value="">Todas</option>
              {accionesLista.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Buscar en detalle">
            <input className={inputCls} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Folio, monto…" />
          </Field>
        </div>
      </Card>
      <Card className="mt-4" subtitle={`${filas.length} eventos`} title="Bitácora">
        <TableWrap minWidth={760}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={th}>Fecha y hora</th>
              <th className={th}>Usuario</th>
              <th className={th}>Acción</th>
              <th className={th}>Entidad</th>
              <th className={th}>Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.slice(0, limite).map((a) => (
              <tr key={a.id}>
                <td className={cx(td, `whitespace-nowrap`)}>{fechaHora(a.fecha)}</td>
                <td className={cx(td, `whitespace-nowrap`)}>{c.usrNombre(a.usuarioId)}</td>
                <td className={td}>
                  <Badge tone={TONO[a.accion] ?? 'gray'}>{a.accion.replace('_', ' ')}</Badge>
                </td>
                <td className={td}>{a.entidad}</td>
                <td className={cx(td, `max-w-md truncate`)} title={a.detalle}>
                  {a.detalle}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {filas.length > limite && (
          <div className="mt-3 text-center">
            <Button variant="secondary" onClick={() => setLimite((l) => l + 60)}>
              Mostrar más
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
