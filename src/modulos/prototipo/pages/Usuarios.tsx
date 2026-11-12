'use client';

import { useState, type ReactNode } from 'react';
import { Aviso, Badge, Button, Card, cx, Field, inputCls, Modal, PageHeader, TableWrap, Tabs, td, tdR, th, thR } from '../components/ui';
import type { DatosUsuario } from '../lib/acciones';
import { administra, administraRol, GRUPOS, MODULOS, nombrePantalla, pantallasDe } from '../lib/acceso';
import { q } from '../lib/format';
import { limiteDe, nombrePermiso, PERMISOS, permisosDe, rolDe, soloPropios, tiene, tieneAjustes } from '../lib/reglas';
import { useCatalogos, useStore } from '../lib/store';
import type { Permiso, Rol, Usuario } from '../types';

const limiteTexto = (r?: Rol) =>
  !r || !r.permisos.includes('aprobar') ? 'No autoriza' : r.limiteAutorizacion === null ? 'Sin límite' : q(r.limiteAutorizacion);

const limiteUsuario = (lim: number | null) => (lim === null ? 'Sin límite' : lim === 0 ? 'No autoriza' : q(lim));

/** El usuario tal como quedaría con lo que hay en el formulario (para mostrar sus permisos y pantallas). */
const comoUsuario = (f: DatosUsuario): Usuario => ({ ...f });

type ModoLimite = 'rol' | 'propio' | 'sin';
type ModoAlcance = 'rol' | 'todo' | 'propios';
type Pestana = 'usuarios' | 'pantallas' | 'permisos' | 'roles';

const Si = () => <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓</span>;
const No = () => <span className="text-slate-300 dark:text-slate-600">–</span>;
const Agregado = () => (
  <span className="rounded bg-brand-50 dark:bg-brand-500/15 px-1 font-semibold text-brand-700 dark:text-brand-300" title="Agregado a esta persona">
    +✓
  </span>
);
const Quitado = () => (
  <span className="font-semibold text-red-600 dark:text-red-400" title="Quitado a esta persona">
    ✕
  </span>
);

/** Celda de la matriz por persona: del rol, agregado, quitado o sin acceso. */
function Marca({ delRol, agregado, quitado }: { delRol: boolean; agregado: boolean; quitado: boolean }) {
  if (quitado && delRol) return <Quitado />;
  if (agregado && !delRol) return <Agregado />;
  return delRol ? <Si /> : <No />;
}

const Leyenda = () => (
  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
    <Si /> por su rol · <Agregado /> agregado a la persona · <Quitado /> quitado a la persona · <No /> sin acceso
  </p>
);

/** Lista de casillas: marca lo que tendrá la persona, con la etiqueta de lo que difiere de su rol. */
function Casillas({
  items,
  delRol,
  marcado,
  puedeDar,
  onChange,
}: {
  items: [string, ReactNode][];
  delRol: (k: string) => boolean;
  marcado: (k: string) => boolean;
  puedeDar: (k: string) => boolean;
  onChange: (k: string, v: boolean) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {items.map(([k, label]) => {
        const m = marcado(k);
        const bloqueado = !m && !puedeDar(k);
        return (
          <label key={k} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 dark:border-slate-700" checked={m} disabled={bloqueado} onChange={(ev) => onChange(k, ev.target.checked)} />
            <span className={bloqueado ? 'text-slate-400 dark:text-slate-500' : ''}>{label}</span>
            {delRol(k) !== m && <Badge tone={m ? 'blue' : 'red'}>{m ? 'agregado' : 'quitado'}</Badge>}
          </label>
        );
      })}
    </div>
  );
}

export default function Usuarios() {
  const { db, usuario, acciones, cambiarClave } = useStore();
  const c = useCatalogos();
  const admin = tiene(db, usuario, 'usuarios');
  const [pestana, setPestana] = useState<Pestana>('usuarios');
  const [form, setForm] = useState<DatosUsuario | null>(null);
  const [claveNueva, setClaveNueva] = useState('');
  const [reset, setReset] = useState<{ id: string; nombre: string } | null>(null);
  const [claveReset, setClaveReset] = useState('');
  const [rolForm, setRolForm] = useState<Rol | null>(null);
  const misPermisos = permisosDe(db, usuario);
  const misPantallas = pantallasDe(db, usuario);

  const guardarUsuario = async () => {
    if (!form) return;
    if (await acciones.guardarUsuario(form, form.id ? undefined : claveNueva)) {
      setForm(null);
      setClaveNueva('');
    }
  };
  const guardarReset = async () => {
    if (reset && (await cambiarClave({ usuarioId: reset.id, nueva: claveReset }))) {
      setReset(null);
      setClaveReset('');
    }
  };
  const guardarRol = async () => {
    if (rolForm && (await acciones.guardarRol(rolForm))) setRolForm(null);
  };

  const editar = (u: Usuario) =>
    setForm({
      id: u.id,
      nombre: u.nombre,
      usuario: u.usuario,
      rolId: u.rolId,
      estaciones: [...u.estaciones],
      activo: u.activo,
      permisosExtra: [...(u.permisosExtra ?? [])],
      permisosQuitados: [...(u.permisosQuitados ?? [])],
      pantallasExtra: [...(u.pantallasExtra ?? [])],
      pantallasQuitadas: [...(u.pantallasQuitadas ?? [])],
      limiteAutorizacion: u.limiteAutorizacion,
      soloPropios: u.soloPropios,
    });

  const rolDeForm = form ? db.roles.find((r) => r.id === form.rolId) : undefined;
  const propio = !!form && form.id === usuario.id;
  const activos = db.usuarios.filter((u) => u.activo);

  // ---- Formulario: se guarda solo la diferencia con el rol ----
  const alternar = (lista: string[] | undefined, k: string, poner: boolean) => {
    const sin = (lista ?? []).filter((x) => x !== k);
    return poner ? [...sin, k] : sin;
  };
  const cambiarPermiso = (p: string, activo: boolean) => {
    if (!form) return;
    const delRol = rolDeForm?.permisos.includes(p as Permiso) ?? false;
    setForm({
      ...form,
      permisosExtra: alternar(form.permisosExtra, p, !delRol && activo) as Permiso[],
      permisosQuitados: alternar(form.permisosQuitados, p, delRol && !activo) as Permiso[],
    });
  };
  const cambiarPantalla = (r: string, activo: boolean) => {
    if (!form) return;
    const delRol = rolDeForm?.pantallas.includes(r) ?? false;
    setForm({
      ...form,
      pantallasExtra: alternar(form.pantallasExtra, r, !delRol && activo),
      pantallasQuitadas: alternar(form.pantallasQuitadas, r, delRol && !activo),
    });
  };
  const modoLimite: ModoLimite = form?.limiteAutorizacion === undefined ? 'rol' : form.limiteAutorizacion === null ? 'sin' : 'propio';
  const modoAlcance: ModoAlcance = form?.soloPropios === undefined ? 'rol' : form.soloPropios ? 'propios' : 'todo';
  const conAjustes = (f: DatosUsuario) =>
    !!(f.permisosExtra?.length || f.permisosQuitados?.length || f.pantallasExtra?.length || f.pantallasQuitadas?.length || f.limiteAutorizacion !== undefined || f.soloPropios !== undefined);

  const pantallasPorGrupo = GRUPOS.map((g) => [g, MODULOS.filter((m) => m.grupo === g)] as const);

  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        description="Cada usuario entra con su contraseña. Su rol le da un paquete de pantallas y permisos; a cada persona se le pueden agregar o quitar pantallas y permisos, darle otro límite o limitarla a lo que ella registra."
        actions={
          admin && (
            <Button
              onClick={() => {
                setClaveNueva('');
                setForm({ id: '', nombre: '', usuario: '', rolId: 'SO', estaciones: [db.estaciones[0]?.id ?? ''], activo: true, permisosExtra: [], permisosQuitados: [], pantallasExtra: [], pantallasQuitadas: [] });
              }}
            >
              + Nuevo usuario
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Aviso tone="amber">
          Simulación: los usuarios, roles y contraseñas con los que se entra al ERP los administra el backend. Lo que cambie aquí
          queda en los datos simulados de este navegador y no cambia el acceso real de nadie.
        </Aviso>
      </div>
      <Tabs
        value={pestana}
        onChange={setPestana}
        tabs={[
          { id: 'usuarios', label: 'Usuarios' },
          { id: 'pantallas', label: 'Qué ve cada persona' },
          { id: 'permisos', label: 'Qué puede hacer cada persona' },
          { id: 'roles', label: 'Roles' },
        ]}
      />

      {pestana === 'usuarios' && (
        <Card title="Usuarios" subtitle="Solo puede administrar usuarios que no tengan más pantallas ni permisos que usted">
          <TableWrap minWidth={980}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Usuario</th>
                <th className={th}>Rol</th>
                <th className={th}>Estaciones</th>
                <th className={th}>Ajustes propios</th>
                <th className={thR}>Pantallas</th>
                <th className={thR}>Autoriza hasta</th>
                <th className={th}>Estado</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {db.usuarios.map((u) => {
                const rol = rolDe(db, u);
                const maneja = u.id === usuario.id || administra(db, usuario, u).ok;
                return (
                  <tr key={u.id} className={u.activo ? '' : 'opacity-60'}>
                    <td className={td}>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {u.nombre} {u.id === usuario.id && <Badge tone="blue">Usted</Badge>}
                      </p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{u.usuario}</p>
                    </td>
                    <td className={td}>{rol.nombre}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {tiene(db, u, 'ver_todo') ? <Badge tone="blue">Todas</Badge> : u.estaciones.map((e) => <Badge key={e}>{c.estCodigo(e)}</Badge>)}
                      </div>
                    </td>
                    <td className={td}>
                      {tieneAjustes(u) ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {(u.pantallasExtra ?? []).map((p) => (
                            <Badge key={p} tone="blue">
                              + {nombrePantalla(p)}
                            </Badge>
                          ))}
                          {(u.pantallasQuitadas ?? []).map((p) => (
                            <Badge key={p} tone="red">
                              − {nombrePantalla(p)}
                            </Badge>
                          ))}
                          {(u.permisosExtra ?? []).map((p) => (
                            <Badge key={p} tone="blue">
                              + {nombrePermiso(p)}
                            </Badge>
                          ))}
                          {(u.permisosQuitados ?? []).map((p) => (
                            <Badge key={p} tone="red">
                              − {nombrePermiso(p)}
                            </Badge>
                          ))}
                          {u.limiteAutorizacion !== undefined && <Badge tone="violet">Límite propio</Badge>}
                          {u.soloPropios !== undefined && <Badge tone="amber">{u.soloPropios ? 'Solo lo que registra' : 'Todo lo de sus estaciones'}</Badge>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">Los de su rol</span>
                      )}
                    </td>
                    <td className={tdR}>{pantallasDe(db, u).length}</td>
                    <td className={tdR}>{limiteUsuario(limiteDe(db, u))}</td>
                    <td className={td}>{u.activo ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    <td className={tdR}>
                      {admin && maneja && (
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => editar(u)}>
                            Editar
                          </Button>
                          {u.id !== usuario.id && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setReset({ id: u.id, nombre: u.nombre })}>
                                Contraseña
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => acciones.toggleUsuario(u.id)}>
                                {u.activo ? 'Desactivar' : 'Activar'}
                              </Button>
                            </>
                          )}
                        </span>
                      )}
                      {admin && !maneja && <span className="text-xs text-slate-400 dark:text-slate-500">Tiene más acceso que usted</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>
      )}

      {pestana === 'pantallas' && (
        <Card title="Qué ve cada persona" subtitle="Pantallas del menú que tiene cada usuario activo. Lo que no tiene, no lo ve en el menú, no puede abrirlo y el servidor no le envía esos datos.">
          <TableWrap minWidth={1100}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Pantalla</th>
                {activos.map((u) => (
                  <th key={u.id} className={cx(th, `text-center`)}>
                    <span className="block normal-case">{u.nombre.split(' ')[0]}</span>
                    <span className="block font-normal normal-case text-slate-400 dark:text-slate-500">{rolDe(db, u).nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pantallasPorGrupo.map(([grupo, mods]) => (
                <FilasGrupo key={grupo} grupo={grupo} columnas={activos.length + 1}>
                  {mods.map((m) => (
                    <tr key={m.ruta}>
                      <td className={cx(td, `min-w-[13rem]`)}>{m.label}</td>
                      {activos.map((u) => (
                        <td key={u.id} className={cx(td, `text-center`)}>
                          <Marca
                            delRol={rolDe(db, u).pantallas.includes(m.ruta)}
                            agregado={(u.pantallasExtra ?? []).includes(m.ruta)}
                            quitado={(u.pantallasQuitadas ?? []).includes(m.ruta)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </FilasGrupo>
              ))}
              <tr>
                <td className={cx(td, `font-medium`)}>Total de pantallas</td>
                {activos.map((u) => (
                  <td key={u.id} className={cx(td, `tabular-nums text-center font-medium`)}>
                    {pantallasDe(db, u).length}
                  </td>
                ))}
              </tr>
            </tbody>
          </TableWrap>
          <Leyenda />
        </Card>
      )}

      {pestana === 'permisos' && (
        <Card title="Qué puede hacer cada persona" subtitle="Acciones que cada usuario puede hacer: las de su rol con sus ajustes propios. El servidor valida cada acción con esta tabla.">
          <TableWrap minWidth={1100}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}>Permiso</th>
                {activos.map((u) => (
                  <th key={u.id} className={cx(th, `text-center`)}>
                    <span className="block normal-case">{u.nombre.split(' ')[0]}</span>
                    <span className="block font-normal normal-case text-slate-400 dark:text-slate-500">{rolDe(db, u).nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {PERMISOS.map(([p, label]) => (
                <tr key={p}>
                  <td className={cx(td, `min-w-[13rem]`)}>{label}</td>
                  {activos.map((u) => (
                    <td key={u.id} className={cx(td, `text-center`)}>
                      <Marca delRol={rolDe(db, u).permisos.includes(p)} agregado={(u.permisosExtra ?? []).includes(p)} quitado={(u.permisosQuitados ?? []).includes(p)} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className={td}>Solo ve lo que él mismo registra</td>
                {activos.map((u) => (
                  <td key={u.id} className={cx(td, `text-center`)}>
                    {soloPropios(db, u) ? u.soloPropios !== undefined ? <Agregado /> : <Si /> : <No />}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={cx(td, `font-medium`)}>Autoriza hasta</td>
                {activos.map((u) => (
                  <td key={u.id} className={cx(td, `tabular-nums whitespace-nowrap text-center ${u.limiteAutorizacion !== undefined ? 'font-semibold text-emerald-700 dark:text-emerald-300' : ''}`)}>
                    {limiteUsuario(limiteDe(db, u))}
                  </td>
                ))}
              </tr>
            </tbody>
          </TableWrap>
          <Leyenda />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Límite en verde</span> = límite propio de la persona.
          </p>
        </Card>
      )}

      {pestana === 'roles' && (
        <Card
          title="Roles"
          subtitle="El paquete base de cada puesto. Si cambia un rol, cambia para todos sus usuarios (menos los ajustes propios de cada uno)."
          actions={
            admin && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRolForm({ id: '', nombre: '', descripcion: '', permisos: ['registrar'], pantallas: ['mis-solicitudes', 'gastos'], limiteAutorizacion: 0, soloPropios: false })}
              >
                + Nuevo rol
              </Button>
            )
          }
        >
          <TableWrap minWidth={1100}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={th}></th>
                {db.roles.map((r) => (
                  <th key={r.id} className={cx(th, `text-center`)}>
                    {r.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pantallasPorGrupo.map(([grupo, mods]) => (
                <FilasGrupo key={grupo} grupo={`Pantallas · ${grupo}`} columnas={db.roles.length + 1}>
                  {mods.map((m) => (
                    <tr key={m.ruta}>
                      <td className={cx(td, `min-w-[13rem]`)}>{m.label}</td>
                      {db.roles.map((r) => (
                        <td key={r.id} className={cx(td, `text-center`)}>
                          {r.pantallas.includes(m.ruta) ? <Si /> : <No />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </FilasGrupo>
              ))}
              <FilasGrupo grupo="Permisos" columnas={db.roles.length + 1}>
                {PERMISOS.map(([p, label]) => (
                  <tr key={p}>
                    <td className={td}>{label}</td>
                    {db.roles.map((r) => (
                      <td key={r.id} className={cx(td, `text-center`)}>
                        {r.permisos.includes(p) ? <Si /> : <No />}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className={td}>Solo ve lo que él mismo registra</td>
                  {db.roles.map((r) => (
                    <td key={r.id} className={cx(td, `text-center`)}>
                      {r.soloPropios ? <Si /> : <No />}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={cx(td, `font-medium`)}>Límite de autorización</td>
                  {db.roles.map((r) => (
                    <td key={r.id} className={cx(td, `tabular-nums text-center`)}>
                      {limiteTexto(r)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={cx(td, `font-medium`)}>Usuarios activos</td>
                  {db.roles.map((r) => (
                    <td key={r.id} className={cx(td, `tabular-nums text-center`)}>
                      {db.usuarios.filter((u) => u.rolId === r.id && u.activo).length}
                    </td>
                  ))}
                </tr>
              </FilasGrupo>
              {admin && (
                <tr>
                  <td className={td}></td>
                  {db.roles.map((r) => (
                    <td key={r.id} className={cx(td, `text-center`)}>
                      {administraRol(db, usuario, r).ok && (
                        <Button size="sm" variant="ghost" onClick={() => setRolForm({ ...r, permisos: [...r.permisos], pantallas: [...r.pantallas] })}>
                          Editar
                        </Button>
                      )}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </TableWrap>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {db.roles.map((r) => (
              <p key={r.id} className="text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-800 dark:text-slate-100">{r.nombre}:</span> {r.descripcion}
              </p>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar ${form.nombre}` : 'Nuevo usuario'}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarUsuario}>Guardar</Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            {propio && (
              <div className="sm:col-span-2">
                <Aviso tone="amber">Puede cambiar su nombre y usuario. Su rol, pantallas, permisos, límite y estaciones los cambia otro administrador.</Aviso>
              </div>
            )}
            <Field label="Nombre completo" className="sm:col-span-2">
              <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Field>
            <Field label="Usuario" hint="Minúsculas, sin espacios. Ej. ana.lopez">
              <input className={`${inputCls} font-mono`} autoCapitalize="none" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
            </Field>
            {!form.id ? (
              <Field label="Contraseña inicial" hint="Al menos 6 caracteres">
                <input className={inputCls} type="text" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} />
              </Field>
            ) : (
              <Field label="Estado">
                <select className={inputCls} value={form.activo ? '1' : '0'} disabled={propio} onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </Field>
            )}
            <Field label="Rol" className="sm:col-span-2" hint={rolDeForm?.descripcion}>
              <select className={inputCls} value={form.rolId} disabled={propio} onChange={(e) => setForm({ ...form, rolId: e.target.value })}>
                {db.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="sm:col-span-2" disabled={propio}>
              <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Estaciones</legend>
              {permisosDe(db, comoUsuario(form)).includes('ver_todo') && (
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Tiene "Ver todas las estaciones"; la selección aplica si se le quita ese permiso.</p>
              )}
              <div className="grid gap-1.5 sm:grid-cols-2">
                {db.estaciones.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                      checked={form.estaciones.includes(e.id)}
                      onChange={(ev) =>
                        setForm({ ...form, estaciones: ev.target.checked ? [...form.estaciones, e.id] : form.estaciones.filter((x) => x !== e.id) })
                      }
                    />
                    {e.codigo} · {e.nombre}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Marcado = lo que tendrá esta persona. Solo puede dar pantallas y permisos que usted tiene.</p>
              {conAjustes(form) && !propio && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-brand-600 dark:text-brand-300 hover:underline"
                  onClick={() =>
                    setForm({ ...form, permisosExtra: [], permisosQuitados: [], pantallasExtra: [], pantallasQuitadas: [], limiteAutorizacion: undefined, soloPropios: undefined })
                  }
                >
                  Dejar solo lo de su rol
                </button>
              )}
            </div>

            <fieldset className="sm:col-span-2" disabled={propio}>
              <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Pantallas que ve</legend>
              <div className="space-y-3">
                {pantallasPorGrupo.map(([grupo, mods]) => (
                  <div key={grupo}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{grupo}</p>
                    <Casillas
                      items={mods.map((m) => [m.ruta, m.label])}
                      delRol={(r) => rolDeForm?.pantallas.includes(r) ?? false}
                      marcado={(r) => pantallasDe(db, comoUsuario(form)).includes(r)}
                      puedeDar={(r) => misPantallas.includes(r)}
                      onChange={cambiarPantalla}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="sm:col-span-2" disabled={propio}>
              <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Qué puede hacer</legend>
              <Casillas
                items={PERMISOS}
                delRol={(p) => rolDeForm?.permisos.includes(p as Permiso) ?? false}
                marcado={(p) => permisosDe(db, comoUsuario(form)).includes(p as Permiso)}
                puedeDar={(p) => misPermisos.includes(p as Permiso)}
                onChange={cambiarPermiso}
              />
            </fieldset>

            <Field label="Límite de autorización" hint={`El de su rol: ${limiteTexto(rolDeForm)}`}>
              <select
                className={inputCls}
                value={modoLimite}
                disabled={propio}
                onChange={(e) => {
                  const m = e.target.value as ModoLimite;
                  setForm({
                    ...form,
                    limiteAutorizacion: m === 'rol' ? undefined : m === 'sin' ? null : (rolDeForm?.limiteAutorizacion ?? 0) || 1000,
                  });
                }}
              >
                <option value="rol">El de su rol</option>
                <option value="propio">Límite propio</option>
                <option value="sin">Sin límite</option>
              </select>
            </Field>
            {modoLimite === 'propio' ? (
              <Field label="Límite propio (Q)" hint="Autoriza gastos y órdenes hasta este monto">
                <input
                  type="number"
                  min="0"
                  className={`${inputCls} tabular-nums`}
                  disabled={propio}
                  value={form.limiteAutorizacion ?? 0}
                  onChange={(e) => setForm({ ...form, limiteAutorizacion: Number(e.target.value) })}
                />
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Field label="Qué gastos ve" className="sm:col-span-2">
              <select
                className={inputCls}
                value={modoAlcance}
                disabled={propio}
                onChange={(e) => {
                  const m = e.target.value as ModoAlcance;
                  setForm({ ...form, soloPropios: m === 'rol' ? undefined : m === 'propios' });
                }}
              >
                <option value="rol">Como su rol ({rolDeForm?.soloPropios ? 'solo lo que registra' : 'todo lo de sus estaciones'})</option>
                <option value="todo">Todo lo de sus estaciones</option>
                <option value="propios">Solo lo que él mismo registra</option>
              </select>
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title={`Restablecer contraseña de ${reset?.nombre ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReset(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarReset}>Guardar</Button>
          </>
        }
      >
        <Field label="Contraseña nueva" hint="Al menos 6 caracteres. Comuníquela al usuario; podrá cambiarla desde su menú.">
          <input className={inputCls} type="text" value={claveReset} onChange={(e) => setClaveReset(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={!!rolForm}
        onClose={() => setRolForm(null)}
        title={rolForm?.id ? `Editar rol ${rolForm.nombre}` : 'Nuevo rol'}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setRolForm(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarRol}>Guardar</Button>
          </>
        }
      >
        {rolForm && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del rol">
              <input className={inputCls} value={rolForm.nombre} onChange={(e) => setRolForm({ ...rolForm, nombre: e.target.value })} />
            </Field>
            <Field label="Límite de autorización (Q)" hint="Vacío = sin límite. Solo aplica si el rol autoriza.">
              <input
                type="number"
                min="0"
                className={`${inputCls} tabular-nums`}
                value={rolForm.limiteAutorizacion ?? ''}
                placeholder="Sin límite"
                onChange={(e) => setRolForm({ ...rolForm, limiteAutorizacion: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <input className={inputCls} value={rolForm.descripcion} onChange={(e) => setRolForm({ ...rolForm, descripcion: e.target.value })} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Pantallas que ve</legend>
              <div className="space-y-3">
                {pantallasPorGrupo.map(([grupo, mods]) => (
                  <div key={grupo}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{grupo}</p>
                    <Casillas
                      items={mods.map((m) => [m.ruta, m.label])}
                      delRol={(r) => rolForm.pantallas.includes(r)}
                      marcado={(r) => rolForm.pantallas.includes(r)}
                      puedeDar={(r) => misPantallas.includes(r)}
                      onChange={(r, v) => setRolForm({ ...rolForm, pantallas: v ? [...rolForm.pantallas, r] : rolForm.pantallas.filter((x) => x !== r) })}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Qué puede hacer</legend>
              <Casillas
                items={PERMISOS}
                delRol={(p) => rolForm.permisos.includes(p as Permiso)}
                marcado={(p) => rolForm.permisos.includes(p as Permiso)}
                puedeDar={(p) => misPermisos.includes(p as Permiso)}
                onChange={(p, v) =>
                  setRolForm({ ...rolForm, permisos: v ? [...rolForm.permisos, p as Permiso] : rolForm.permisos.filter((x) => x !== p) })
                }
              />
              <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                  checked={rolForm.soloPropios}
                  onChange={(ev) => setRolForm({ ...rolForm, soloPropios: ev.target.checked })}
                />
                Solo ve lo que él mismo registra
              </label>
            </fieldset>
            {rolForm.id && db.config.niveles.some((n) => n.rolId === rolForm.id) && (
              <div className="sm:col-span-2">
                <Aviso>Este rol es un nivel de la política de autorización; su límite también se actualiza en Configuración.</Aviso>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Encabezado de sección dentro de una matriz. */
function FilasGrupo({ grupo, columnas, children }: { grupo: string; columnas: number; children: ReactNode }) {
  return (
    <>
      <tr className="bg-slate-50 dark:bg-slate-800/40">
        <td colSpan={columnas} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {grupo}
        </td>
      </tr>
      {children}
    </>
  );
}
