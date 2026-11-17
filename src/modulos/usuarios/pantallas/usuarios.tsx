'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ErrorApi, mensajeDeError } from '@/api/cliente';
import { Aviso, EsqueletoTabla } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada, Seleccion } from '@/componentes/ui/campos';
import { Insignia } from '@/componentes/ui/insignia';
import { Modal } from '@/componentes/ui/modal';
import { Pestanas } from '@/componentes/ui/pestanas';
import { Cuerpo, ContenedorTabla, td, tdR, th, thR } from '@/componentes/ui/tabla';
import { EncabezadoPagina, Tarjeta } from '@/componentes/ui/tarjeta';
import { fechaHora, q } from '@/lib/formato';
import { cn } from '@/lib/utilidades';
import {
  type AdministracionUsuarios,
  type RolAdministrado,
  type UsuarioAdministrado,
  useAdministracionUsuarios,
  useCambiarEstadoUsuario,
  useGuardarRol,
  useGuardarUsuario,
  useRestablecerClave,
} from '../datos';

type Pestana = 'usuarios' | 'pantallas' | 'permisos' | 'roles';
type ModoLimite = 'ROL' | 'MONTO' | 'SIN_LIMITE';
type Grupo = readonly [string, { codigo: string; nombre: string }[]];

interface FormUsuario {
  id: string;
  nombre: string;
  usuario: string;
  correo: string;
  rolId: string;
  estaciones: string[];
  activo: boolean;
  permisosExtra: string[];
  permisosQuitados: string[];
  pantallasExtra: string[];
  pantallasQuitadas: string[];
  modoLimite: ModoLimite;
  monto: string;
  soloPropios: boolean | null;
  clave: string;
}

interface FormRol {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
  pantallas: string[];
  limite: string;
  soloPropios: boolean;
  esNivel: boolean;
}

function errorDe(error: unknown, campo: string): string | undefined {
  return error instanceof ErrorApi ? error.errores.find((e) => e.campo === campo || e.campo.startsWith(`${campo}.`))?.mensaje : undefined;
}

/** Tope como texto: null = sin límite; "0" o "0.00" = no autoriza. */
const textoLimite = (lim: string | null) => (lim === null ? 'Sin límite' : /^0+(\.0+)?$/.test(lim.trim()) ? 'No autoriza' : q(lim));

const Si = () => <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓</span>;
const No = () => <span className="text-slate-300 dark:text-slate-600">–</span>;
const Agregado = () => (
  <span className="rounded-[2px] bg-primario-suave px-1 font-semibold text-primario-tinta" title="Agregado a esta persona">
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
  <p className="mt-3 text-[11px] text-tenue">
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
          <label key={k} className="flex items-center gap-2 text-[12px] text-tinta">
            <input type="checkbox" className="size-4" checked={m} disabled={bloqueado} onChange={(ev) => onChange(k, ev.target.checked)} />
            <span className={bloqueado ? 'text-tenue' : ''}>{label}</span>
            {delRol(k) !== m && <Insignia tono={m ? 'blue' : 'red'}>{m ? 'agregado' : 'quitado'}</Insignia>}
          </label>
        );
      })}
    </div>
  );
}

/** Encabezado de sección dentro de una matriz. */
function FilasGrupo({ grupo, columnas, children }: { grupo: string; columnas: number; children: ReactNode }) {
  return (
    <>
      <tr className="bg-fondo">
        <td colSpan={columnas} className="px-[10px] py-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">
          {grupo}
        </td>
      </tr>
      {children}
    </>
  );
}

function gruposDe(d: AdministracionUsuarios): Grupo[] {
  const grupos: Grupo[] = [];
  for (const p of d.pantallas) {
    const g = grupos.find(([n]) => n === p.grupo);
    if (g) g[1].push(p);
    else grupos.push([p.grupo, [p]]);
  }
  return grupos;
}

export function PantallaUsuarios() {
  const consulta = useAdministracionUsuarios();
  const estado = useCambiarEstadoUsuario();
  const d = consulta.data;
  const admin = d?.puedeAdministrar ?? false;
  const [pestana, setPestana] = useState<Pestana>('usuarios');
  const [form, setForm] = useState<FormUsuario | null>(null);
  const [reset, setReset] = useState<{ id: string; nombre: string } | null>(null);
  const [rolForm, setRolForm] = useState<FormRol | null>(null);

  const nuevoUsuario = (datos: AdministracionUsuarios) => {
    const rol = datos.roles.find((r) => r.maneja.ok) ?? datos.roles[0];
    setForm({
      id: '',
      nombre: '',
      usuario: '',
      correo: '',
      rolId: rol?.id ?? '',
      estaciones: datos.estaciones.filter((e) => e.activa).slice(0, 1).map((e) => e.id),
      activo: true,
      permisosExtra: [],
      permisosQuitados: [],
      pantallasExtra: [],
      pantallasQuitadas: [],
      modoLimite: 'ROL',
      monto: '',
      soloPropios: null,
      clave: '',
    });
  };
  const editar = (u: UsuarioAdministrado) =>
    setForm({
      id: u.id,
      nombre: u.nombre,
      usuario: u.usuario,
      correo: u.correo ?? '',
      rolId: u.rol.id,
      estaciones: u.estaciones.map((e) => e.id),
      activo: u.activo,
      permisosExtra: [...u.ajustes.permisosExtra],
      permisosQuitados: [...u.ajustes.permisosQuitados],
      pantallasExtra: [...u.ajustes.pantallasExtra],
      pantallasQuitadas: [...u.ajustes.pantallasQuitadas],
      modoLimite: u.ajustes.limite.modo,
      monto: u.ajustes.limite.monto ?? '',
      soloPropios: u.ajustes.soloPropios,
      clave: '',
    });
  const nuevoRol = (datos: AdministracionUsuarios) =>
    setRolForm({
      id: '',
      nombre: '',
      descripcion: '',
      permisos: datos.permisos.map((p) => p.codigo).filter((c) => c === 'registrar' && datos.yo.permisos.includes(c)),
      pantallas: datos.pantallas.map((p) => p.codigo).filter((c) => (c === 'mis-solicitudes' || c === 'gastos') && datos.yo.pantallas.includes(c)),
      limite: '0',
      soloPropios: false,
      esNivel: false,
    });
  const editarRol = (r: RolAdministrado) =>
    setRolForm({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: [...r.permisos],
      pantallas: [...r.pantallas],
      limite: r.limiteAutorizacion ?? '',
      soloPropios: r.soloPropios,
      esNivel: r.esNivel,
    });

  async function alternarEstado(u: UsuarioAdministrado) {
    try {
      const r = await estado.mutateAsync({ id: u.id, activo: !u.activo });
      toast.success(r.mensaje);
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Usuarios y roles"
        descripcion="Cada usuario entra con su contraseña. Su rol le da un paquete de pantallas y permisos; a cada persona se le pueden agregar o quitar pantallas y permisos, darle otro límite o limitarla a lo que ella registra."
        acciones={d && admin && <Boton onClick={() => nuevoUsuario(d)}>+ Nuevo usuario</Boton>}
      />
      <Pestanas
        valor={pestana}
        alCambiar={setPestana}
        pestanas={[
          { valor: 'usuarios', etiqueta: 'Usuarios' },
          { valor: 'pantallas', etiqueta: 'Qué ve cada persona' },
          { valor: 'permisos', etiqueta: 'Qué puede hacer cada persona' },
          { valor: 'roles', etiqueta: 'Roles' },
        ]}
      />

      {consulta.isPending ? (
        <EsqueletoTabla />
      ) : consulta.isError ? (
        <Aviso tono="red">{mensajeDeError(consulta.error)}</Aviso>
      ) : (
        <Contenido
          d={consulta.data}
          pestana={pestana}
          admin={admin}
          editar={editar}
          resetear={(u) => setReset({ id: u.id, nombre: u.nombre })}
          alternarEstado={alternarEstado}
          cambiandoEstado={estado.isPending ? estado.variables?.id : undefined}
          nuevoRol={() => nuevoRol(consulta.data)}
          editarRol={editarRol}
        />
      )}

      {form && d && <DialogoUsuario form={form} setForm={setForm} d={d} />}
      {reset && d && <DialogoClave usuario={reset} minima={d.claveMinima} cerrar={() => setReset(null)} />}
      {rolForm && d && <DialogoRol form={rolForm} setForm={setRolForm} d={d} />}
    </div>
  );
}

function Contenido({
  d,
  pestana,
  admin,
  editar,
  resetear,
  alternarEstado,
  cambiandoEstado,
  nuevoRol,
  editarRol,
}: {
  d: AdministracionUsuarios;
  pestana: Pestana;
  admin: boolean;
  editar: (u: UsuarioAdministrado) => void;
  resetear: (u: UsuarioAdministrado) => void;
  alternarEstado: (u: UsuarioAdministrado) => void;
  cambiandoEstado: string | undefined;
  nuevoRol: () => void;
  editarRol: (r: RolAdministrado) => void;
}) {
  const yo = d.yo.id;
  const activos = d.usuarios.filter((u) => u.activo);
  const rolDe = (u: UsuarioAdministrado) => d.roles.find((r) => r.id === u.rol.id);
  const nombrePantalla = (c: string) => d.pantallas.find((p) => p.codigo === c)?.nombre ?? c;
  const nombrePermiso = (c: string) => d.permisos.find((p) => p.codigo === c)?.nombre ?? c;
  const grupos = gruposDe(d);
  const encabezadoPersonas = activos.map((u) => (
    <th key={u.id} className={cn(th, 'text-center')}>
      <span className="block normal-case">{u.nombre.split(' ')[0]}</span>
      <span className="block font-normal normal-case text-tenue">{u.rol.nombre}</span>
    </th>
  ));

  if (pestana === 'usuarios')
    return (
      <Tarjeta titulo="Usuarios" subtitulo="Solo puede administrar usuarios que no tengan más pantallas ni permisos que usted">
        <ContenedorTabla anchoMinimo={980}>
          <thead>
            <tr>
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
          <Cuerpo>
            {d.usuarios.map((u) => {
              const maneja = u.id === yo || u.maneja.ok;
              const a = u.ajustes;
              return (
                <tr key={u.id} className={u.activo ? '' : 'opacity-60'}>
                  <td className={td}>
                    <p className="font-medium text-tinta">
                      {u.nombre} {u.id === yo && <Insignia tono="blue">Usted</Insignia>}
                    </p>
                    <p className="font-mono text-[11px] text-tenue">{u.usuario}</p>
                    {u.correo && <p className="text-[11px] text-tenue">{u.correo}</p>}
                    <p className="text-[10px] text-tenue">
                      Último acceso: {u.ultimoAccesoEn ? fechaHora(u.ultimoAccesoEn) : 'nunca'}
                      {u.debeCambiarClave && ' · debe cambiar su contraseña'}
                    </p>
                  </td>
                  <td className={td}>{u.rol.nombre}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {u.verTodo ? <Insignia tono="blue">Todas</Insignia> : u.estaciones.map((e) => <Insignia key={e.id}>{e.codigo}</Insignia>)}
                    </div>
                  </td>
                  <td className={td}>
                    {u.tieneAjustes ? (
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {a.pantallasExtra.map((p) => (
                          <Insignia key={`pe-${p}`} tono="blue">
                            + {nombrePantalla(p)}
                          </Insignia>
                        ))}
                        {a.pantallasQuitadas.map((p) => (
                          <Insignia key={`pq-${p}`} tono="red">
                            − {nombrePantalla(p)}
                          </Insignia>
                        ))}
                        {a.permisosExtra.map((p) => (
                          <Insignia key={`ke-${p}`} tono="blue">
                            + {nombrePermiso(p)}
                          </Insignia>
                        ))}
                        {a.permisosQuitados.map((p) => (
                          <Insignia key={`kq-${p}`} tono="red">
                            − {nombrePermiso(p)}
                          </Insignia>
                        ))}
                        {a.limite.modo !== 'ROL' && <Insignia tono="violet">Límite propio</Insignia>}
                        {a.soloPropios !== null && <Insignia tono="amber">{a.soloPropios ? 'Solo lo que registra' : 'Todo lo de sus estaciones'}</Insignia>}
                      </div>
                    ) : (
                      <span className="text-[11px] text-tenue">Los de su rol</span>
                    )}
                  </td>
                  <td className={tdR}>{u.pantallas.length}</td>
                  <td className={tdR}>{textoLimite(u.limiteEfectivo)}</td>
                  <td className={td}>{u.activo ? <Insignia tono="green">Activo</Insignia> : <Insignia>Inactivo</Insignia>}</td>
                  <td className={tdR}>
                    {admin && maneja && (
                      <span className="inline-flex gap-1">
                        <Boton tamano="sm" variante="ghost" onClick={() => editar(u)}>
                          Editar
                        </Boton>
                        {u.id !== yo && (
                          <>
                            <Boton tamano="sm" variante="ghost" onClick={() => resetear(u)}>
                              Contraseña
                            </Boton>
                            <Boton tamano="sm" variante="ghost" cargando={cambiandoEstado === u.id} onClick={() => alternarEstado(u)}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </Boton>
                          </>
                        )}
                      </span>
                    )}
                    {admin && !maneja && (
                      <span className="text-[11px] text-tenue" title={u.maneja.motivo}>
                        Tiene más acceso que usted
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Cuerpo>
        </ContenedorTabla>
      </Tarjeta>
    );

  if (pestana === 'pantallas')
    return (
      <Tarjeta
        titulo="Qué ve cada persona"
        subtitulo="Pantallas del menú que tiene cada usuario activo. Lo que no tiene, no lo ve en el menú, no puede abrirlo y el servidor no le envía esos datos."
      >
        <ContenedorTabla anchoMinimo={1100}>
          <thead>
            <tr>
              <th className={th}>Pantalla</th>
              {encabezadoPersonas}
            </tr>
          </thead>
          <Cuerpo>
            {grupos.map(([grupo, mods]) => (
              <FilasGrupo key={grupo} grupo={grupo} columnas={activos.length + 1}>
                {mods.map((m) => (
                  <tr key={m.codigo}>
                    <td className={cn(td, 'min-w-[13rem]')}>{m.nombre}</td>
                    {activos.map((u) => (
                      <td key={u.id} className={cn(td, 'text-center')}>
                        <Marca
                          delRol={rolDe(u)?.pantallas.includes(m.codigo) ?? false}
                          agregado={u.ajustes.pantallasExtra.includes(m.codigo)}
                          quitado={u.ajustes.pantallasQuitadas.includes(m.codigo)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </FilasGrupo>
            ))}
            <tr>
              <td className={cn(td, 'font-medium')}>Total de pantallas</td>
              {activos.map((u) => (
                <td key={u.id} className={cn(td, 'text-center font-medium tabular-nums')}>
                  {u.pantallas.length}
                </td>
              ))}
            </tr>
          </Cuerpo>
        </ContenedorTabla>
        <Leyenda />
      </Tarjeta>
    );

  if (pestana === 'permisos')
    return (
      <Tarjeta
        titulo="Qué puede hacer cada persona"
        subtitulo="Acciones que cada usuario puede hacer: las de su rol con sus ajustes propios. El servidor valida cada acción con esta tabla."
      >
        <ContenedorTabla anchoMinimo={1100}>
          <thead>
            <tr>
              <th className={th}>Permiso</th>
              {encabezadoPersonas}
            </tr>
          </thead>
          <Cuerpo>
            {d.permisos.map((p) => (
              <tr key={p.codigo}>
                <td className={cn(td, 'min-w-[13rem]')}>{p.nombre}</td>
                {activos.map((u) => (
                  <td key={u.id} className={cn(td, 'text-center')}>
                    <Marca
                      delRol={rolDe(u)?.permisos.includes(p.codigo) ?? false}
                      agregado={u.ajustes.permisosExtra.includes(p.codigo)}
                      quitado={u.ajustes.permisosQuitados.includes(p.codigo)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={td}>Solo ve lo que él mismo registra</td>
              {activos.map((u) => (
                <td key={u.id} className={cn(td, 'text-center')}>
                  {u.soloPropios ? u.ajustes.soloPropios !== null ? <Agregado /> : <Si /> : <No />}
                </td>
              ))}
            </tr>
            <tr>
              <td className={cn(td, 'font-medium')}>Autoriza hasta</td>
              {activos.map((u) => (
                <td
                  key={u.id}
                  className={cn(td, 'whitespace-nowrap text-center tabular-nums', u.ajustes.limite.modo !== 'ROL' && 'font-semibold text-emerald-700 dark:text-emerald-300')}
                >
                  {textoLimite(u.limiteEfectivo)}
                </td>
              ))}
            </tr>
          </Cuerpo>
        </ContenedorTabla>
        <Leyenda />
        <p className="mt-1 text-[11px] text-tenue">
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">Límite en verde</span> = límite propio de la persona.
        </p>
      </Tarjeta>
    );

  return (
    <Tarjeta
      titulo="Roles"
      subtitulo="El paquete base de cada puesto. Si cambia un rol, cambia para todos sus usuarios (menos los ajustes propios de cada uno)."
      acciones={
        admin && (
          <Boton tamano="sm" variante="secondary" onClick={nuevoRol}>
            + Nuevo rol
          </Boton>
        )
      }
    >
      <ContenedorTabla anchoMinimo={1100}>
        <thead>
          <tr>
            <th className={th}></th>
            {d.roles.map((r) => (
              <th key={r.id} className={cn(th, 'text-center')}>
                {r.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <Cuerpo>
          {grupos.map(([grupo, mods]) => (
            <FilasGrupo key={grupo} grupo={`Pantallas · ${grupo}`} columnas={d.roles.length + 1}>
              {mods.map((m) => (
                <tr key={m.codigo}>
                  <td className={cn(td, 'min-w-[13rem]')}>{m.nombre}</td>
                  {d.roles.map((r) => (
                    <td key={r.id} className={cn(td, 'text-center')}>
                      {r.pantallas.includes(m.codigo) ? <Si /> : <No />}
                    </td>
                  ))}
                </tr>
              ))}
            </FilasGrupo>
          ))}
          <FilasGrupo grupo="Permisos" columnas={d.roles.length + 1}>
            {d.permisos.map((p) => (
              <tr key={p.codigo}>
                <td className={td}>{p.nombre}</td>
                {d.roles.map((r) => (
                  <td key={r.id} className={cn(td, 'text-center')}>
                    {r.permisos.includes(p.codigo) ? <Si /> : <No />}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={td}>Solo ve lo que él mismo registra</td>
              {d.roles.map((r) => (
                <td key={r.id} className={cn(td, 'text-center')}>
                  {r.soloPropios ? <Si /> : <No />}
                </td>
              ))}
            </tr>
            <tr>
              <td className={cn(td, 'font-medium')}>Límite de autorización</td>
              {d.roles.map((r) => (
                <td key={r.id} className={cn(td, 'text-center tabular-nums')}>
                  {textoLimite(r.limiteAutorizacion)}
                </td>
              ))}
            </tr>
            <tr>
              <td className={cn(td, 'font-medium')}>Usuarios activos</td>
              {d.roles.map((r) => (
                <td key={r.id} className={cn(td, 'text-center tabular-nums')}>
                  {r.usuariosActivos}
                </td>
              ))}
            </tr>
          </FilasGrupo>
          {admin && (
            <tr>
              <td className={td}></td>
              {d.roles.map((r) => (
                <td key={r.id} className={cn(td, 'text-center')}>
                  {r.maneja.ok ? (
                    <Boton tamano="sm" variante="ghost" onClick={() => editarRol(r)}>
                      Editar
                    </Boton>
                  ) : (
                    <span className="text-[10px] text-tenue" title={r.maneja.motivo}>
                      —
                    </span>
                  )}
                </td>
              ))}
            </tr>
          )}
        </Cuerpo>
      </ContenedorTabla>
      <div className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
        {d.roles.map((r) => (
          <p key={r.id} className="text-tenue">
            <span className="font-medium text-tinta">{r.nombre}:</span> {r.descripcion}
          </p>
        ))}
      </div>
    </Tarjeta>
  );
}

const alternar = (lista: string[], k: string, poner: boolean) => {
  const sin = lista.filter((x) => x !== k);
  return poner ? [...sin, k] : sin;
};

function DialogoUsuario({ form, setForm, d }: { form: FormUsuario; setForm: (f: FormUsuario | null) => void; d: AdministracionUsuarios }) {
  const guardar = useGuardarUsuario();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  const nuevo = !form.id;
  const propio = form.id === d.yo.id;
  const rol = d.roles.find((r) => r.id === form.rolId);
  const grupos = gruposDe(d);

  const tienePermiso = (p: string) => ((rol?.permisos.includes(p) ?? false) && !form.permisosQuitados.includes(p)) || form.permisosExtra.includes(p);
  const tienePantalla = (p: string) => ((rol?.pantallas.includes(p) ?? false) && !form.pantallasQuitadas.includes(p)) || form.pantallasExtra.includes(p);
  const verTodo = d.permisos.some((p) => p.codigo === 'ver_todo') && tienePermiso('ver_todo');
  const conAjustes =
    form.permisosExtra.length + form.permisosQuitados.length + form.pantallasExtra.length + form.pantallasQuitadas.length > 0 ||
    form.modoLimite !== 'ROL' ||
    form.soloPropios !== null;

  const cambiarPermiso = (p: string, activo: boolean) => {
    const delRol = rol?.permisos.includes(p) ?? false;
    setForm({ ...form, permisosExtra: alternar(form.permisosExtra, p, !delRol && activo), permisosQuitados: alternar(form.permisosQuitados, p, delRol && !activo) });
  };
  const cambiarPantalla = (p: string, activo: boolean) => {
    const delRol = rol?.pantallas.includes(p) ?? false;
    setForm({ ...form, pantallasExtra: alternar(form.pantallasExtra, p, !delRol && activo), pantallasQuitadas: alternar(form.pantallasQuitadas, p, delRol && !activo) });
  };

  async function confirmar() {
    const base = {
      usuario: form.usuario,
      nombre: form.nombre,
      correo: form.correo.trim() || null,
      rolId: form.rolId,
      estaciones: form.estaciones,
      activo: form.activo,
      permisosExtra: form.permisosExtra,
      permisosQuitados: form.permisosQuitados,
      pantallasExtra: form.pantallasExtra,
      pantallasQuitadas: form.pantallasQuitadas,
      limite: form.modoLimite === 'MONTO' ? { modo: form.modoLimite, monto: form.monto.trim() } : { modo: form.modoLimite, monto: null },
      soloPropios: form.soloPropios,
    };
    try {
      const r = nuevo
        ? await guardar.mutateAsync({ nuevo: true, cuerpo: { ...base, clave: form.clave } })
        : await guardar.mutateAsync({ nuevo: false, id: form.id, cuerpo: base });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  const alcanceRol = rol?.soloPropios ? 'solo lo que registra' : 'todo lo de sus estaciones';
  return (
    <Modal
      abierto
      ancho
      alCerrar={cerrar}
      titulo={nuevo ? 'Nuevo usuario' : `Editar ${form.nombre}`}
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
        {propio && (
          <Aviso tono="amber" className="sm:col-span-2">
            Puede cambiar su nombre, usuario y correo. Su rol, pantallas, permisos, límite y estaciones los cambia otro administrador.
          </Aviso>
        )}
        <Campo etiqueta="Nombre completo" className="sm:col-span-2" htmlFor="usr-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="usr-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Usuario" pista="Minúsculas, sin espacios. Ej. ana.lopez" htmlFor="usr-usuario" error={errorDe(e, 'usuario')}>
          <Entrada id="usr-usuario" className="font-mono" autoCapitalize="none" value={form.usuario} onChange={(ev) => setForm({ ...form, usuario: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Correo" pista="Opcional" htmlFor="usr-correo" error={errorDe(e, 'correo')}>
          <Entrada id="usr-correo" type="email" value={form.correo} onChange={(ev) => setForm({ ...form, correo: ev.target.value })} />
        </Campo>
        {nuevo ? (
          <Campo etiqueta="Contraseña inicial" pista={`Al menos ${d.claveMinima} caracteres. Al entrar, la persona deberá cambiarla.`} htmlFor="usr-clave" error={errorDe(e, 'clave')}>
            <Entrada id="usr-clave" type="text" autoComplete="new-password" value={form.clave} onChange={(ev) => setForm({ ...form, clave: ev.target.value })} />
          </Campo>
        ) : (
          <Campo etiqueta="Estado" htmlFor="usr-activo" error={errorDe(e, 'activo')}>
            <Seleccion id="usr-activo" value={form.activo ? '1' : '0'} disabled={propio} onChange={(ev) => setForm({ ...form, activo: ev.target.value === '1' })}>
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </Seleccion>
          </Campo>
        )}
        <Campo etiqueta="Rol" pista={rol?.descripcion} htmlFor="usr-rol" error={errorDe(e, 'rolId')}>
          <Seleccion id="usr-rol" value={form.rolId} disabled={propio} onChange={(ev) => setForm({ ...form, rolId: ev.target.value })}>
            {d.roles.map((r) => (
              <option key={r.id} value={r.id} disabled={!r.maneja.ok && r.id !== form.rolId}>
                {r.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <fieldset className="sm:col-span-2" disabled={propio}>
          <legend className="mb-1 text-[11px] font-medium text-tenue">Estaciones</legend>
          {verTodo && <p className="mb-2 text-[11px] text-tenue">Tiene «Ver todas las estaciones»; la selección aplica si se le quita ese permiso.</p>}
          <div className="grid gap-1.5 sm:grid-cols-2">
            {d.estaciones.map((x) => (
              <label key={x.id} className="flex items-center gap-2 text-[12px] text-tinta">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={form.estaciones.includes(x.id)}
                  onChange={(ev) => setForm({ ...form, estaciones: alternar(form.estaciones, x.id, ev.target.checked) })}
                />
                {x.codigo} · {x.nombre}
                {!x.activa && <Insignia>Inactiva</Insignia>}
              </label>
            ))}
          </div>
          {errorDe(e, 'estaciones') && <p className="mt-1 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'estaciones')}</p>}
        </fieldset>

        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <p className="text-[11px] text-tenue">Marcado = lo que tendrá esta persona. Solo puede dar pantallas y permisos que usted tiene.</p>
          {conAjustes && !propio && (
            <button
              type="button"
              className="shrink-0 text-[11px] font-medium text-primario-tinta hover:underline"
              onClick={() =>
                setForm({ ...form, permisosExtra: [], permisosQuitados: [], pantallasExtra: [], pantallasQuitadas: [], modoLimite: 'ROL', monto: '', soloPropios: null })
              }
            >
              Dejar solo lo de su rol
            </button>
          )}
        </div>

        <fieldset className="sm:col-span-2" disabled={propio}>
          <legend className="mb-1 text-[11px] font-medium text-tenue">Pantallas que ve</legend>
          <div className="space-y-3">
            {grupos.map(([grupo, mods]) => (
              <div key={grupo}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">{grupo}</p>
                <Casillas
                  items={mods.map((m) => [m.codigo, m.nombre])}
                  delRol={(p) => rol?.pantallas.includes(p) ?? false}
                  marcado={tienePantalla}
                  puedeDar={(p) => d.yo.pantallas.includes(p)}
                  onChange={cambiarPantalla}
                />
              </div>
            ))}
          </div>
          {(errorDe(e, 'pantallasExtra') ?? errorDe(e, 'pantallasQuitadas')) && (
            <p className="mt-1 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'pantallasExtra') ?? errorDe(e, 'pantallasQuitadas')}</p>
          )}
        </fieldset>

        <fieldset className="sm:col-span-2" disabled={propio}>
          <legend className="mb-1 text-[11px] font-medium text-tenue">Qué puede hacer</legend>
          <Casillas
            items={d.permisos.map((p) => [p.codigo, p.nombre])}
            delRol={(p) => rol?.permisos.includes(p) ?? false}
            marcado={tienePermiso}
            puedeDar={(p) => d.yo.permisos.includes(p)}
            onChange={cambiarPermiso}
          />
          {(errorDe(e, 'permisosExtra') ?? errorDe(e, 'permisosQuitados')) && (
            <p className="mt-1 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'permisosExtra') ?? errorDe(e, 'permisosQuitados')}</p>
          )}
        </fieldset>

        <Campo etiqueta="Límite de autorización" pista={`El de su rol: ${rol ? textoLimite(rol.limiteAutorizacion) : '—'}`} htmlFor="usr-modo" error={errorDe(e, 'limite.modo')}>
          <Seleccion
            id="usr-modo"
            value={form.modoLimite}
            disabled={propio}
            onChange={(ev) => {
              const modo = ev.target.value as ModoLimite;
              setForm({ ...form, modoLimite: modo, monto: modo === 'MONTO' ? form.monto || rol?.limiteAutorizacion || '' : form.monto });
            }}
          >
            <option value="ROL">El de su rol</option>
            <option value="MONTO">Límite propio</option>
            <option value="SIN_LIMITE">Sin límite</option>
          </Seleccion>
        </Campo>
        {form.modoLimite === 'MONTO' ? (
          <Campo etiqueta="Límite propio (Q)" pista="Autoriza gastos y órdenes hasta este monto" htmlFor="usr-monto" error={errorDe(e, 'limite.monto') ?? errorDe(e, 'limite')}>
            <Entrada id="usr-monto" inputMode="decimal" className="tabular-nums" disabled={propio} value={form.monto} onChange={(ev) => setForm({ ...form, monto: ev.target.value })} />
          </Campo>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Campo etiqueta="Qué gastos ve" className="sm:col-span-2" htmlFor="usr-alcance" error={errorDe(e, 'soloPropios')}>
          <Seleccion
            id="usr-alcance"
            value={form.soloPropios === null ? 'rol' : form.soloPropios ? 'propios' : 'todo'}
            disabled={propio}
            onChange={(ev) => setForm({ ...form, soloPropios: ev.target.value === 'rol' ? null : ev.target.value === 'propios' })}
          >
            <option value="rol">Como su rol ({alcanceRol})</option>
            <option value="todo">Todo lo de sus estaciones</option>
            <option value="propios">Solo lo que él mismo registra</option>
          </Seleccion>
        </Campo>
      </div>
    </Modal>
  );
}

function DialogoClave({ usuario, minima, cerrar }: { usuario: { id: string; nombre: string }; minima: number; cerrar: () => void }) {
  const restablecer = useRestablecerClave();
  const [clave, setClave] = useState('');
  async function confirmar() {
    try {
      const r = await restablecer.mutateAsync({ id: usuario.id, nueva: clave });
      toast.success(r.mensaje);
      cerrar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }
  return (
    <Modal
      abierto
      alCerrar={cerrar}
      titulo={`Restablecer contraseña de ${usuario.nombre}`}
      pie={
        <>
          <Boton variante="ghost" onClick={cerrar} disabled={restablecer.isPending}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={restablecer.isPending}>
            Guardar
          </Boton>
        </>
      }
    >
      <Campo
        etiqueta="Contraseña nueva"
        pista={`Al menos ${minima} caracteres. Se cierran sus sesiones abiertas. Comuníquela al usuario; podrá cambiarla desde su menú.`}
        htmlFor="clave-nueva"
        error={errorDe(restablecer.error, 'nueva')}
      >
        <Entrada id="clave-nueva" type="text" autoComplete="new-password" value={clave} onChange={(ev) => setClave(ev.target.value)} />
      </Campo>
    </Modal>
  );
}

function DialogoRol({ form, setForm, d }: { form: FormRol; setForm: (f: FormRol | null) => void; d: AdministracionUsuarios }) {
  const guardar = useGuardarRol();
  const e = guardar.error;
  const cerrar = () => setForm(null);
  const grupos = gruposDe(d);
  async function confirmar() {
    const cuerpo = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      permisos: form.permisos,
      pantallas: form.pantallas,
      limiteAutorizacion: form.limite.trim() === '' ? null : form.limite.trim(),
      soloPropios: form.soloPropios,
    };
    try {
      const r = form.id ? await guardar.mutateAsync({ nuevo: false, id: form.id, cuerpo }) : await guardar.mutateAsync({ nuevo: true, cuerpo });
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
      titulo={form.id ? `Editar rol ${form.nombre}` : 'Nuevo rol'}
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
        <Campo etiqueta="Nombre del rol" htmlFor="rol-nombre" error={errorDe(e, 'nombre')}>
          <Entrada id="rol-nombre" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Límite de autorización (Q)" pista="Vacío = sin límite; 0 = no autoriza. Solo aplica si el rol autoriza." htmlFor="rol-limite" error={errorDe(e, 'limiteAutorizacion')}>
          <Entrada id="rol-limite" inputMode="decimal" className="tabular-nums" placeholder="Sin límite" value={form.limite} onChange={(ev) => setForm({ ...form, limite: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Descripción" className="sm:col-span-2" htmlFor="rol-desc" error={errorDe(e, 'descripcion')}>
          <Entrada id="rol-desc" value={form.descripcion} onChange={(ev) => setForm({ ...form, descripcion: ev.target.value })} />
        </Campo>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[11px] font-medium text-tenue">Pantallas que ve</legend>
          <div className="space-y-3">
            {grupos.map(([grupo, mods]) => (
              <div key={grupo}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">{grupo}</p>
                <Casillas
                  items={mods.map((m) => [m.codigo, m.nombre])}
                  delRol={(p) => form.pantallas.includes(p)}
                  marcado={(p) => form.pantallas.includes(p)}
                  puedeDar={(p) => d.yo.pantallas.includes(p)}
                  onChange={(p, v) => setForm({ ...form, pantallas: alternar(form.pantallas, p, v) })}
                />
              </div>
            ))}
          </div>
          {errorDe(e, 'pantallas') && <p className="mt-1 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'pantallas')}</p>}
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[11px] font-medium text-tenue">Qué puede hacer</legend>
          <Casillas
            items={d.permisos.map((p) => [p.codigo, p.nombre])}
            delRol={(p) => form.permisos.includes(p)}
            marcado={(p) => form.permisos.includes(p)}
            puedeDar={(p) => d.yo.permisos.includes(p)}
            onChange={(p, v) => setForm({ ...form, permisos: alternar(form.permisos, p, v) })}
          />
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-tinta">
            <input type="checkbox" className="size-4" checked={form.soloPropios} onChange={(ev) => setForm({ ...form, soloPropios: ev.target.checked })} />
            Solo ve lo que él mismo registra
          </label>
          {errorDe(e, 'permisos') && <p className="mt-1 text-[11px] font-medium text-[#a51d17] dark:text-red-400">{errorDe(e, 'permisos')}</p>}
        </fieldset>
        {form.esNivel && (
          <Aviso className="sm:col-span-2">Este rol es un nivel de la política de autorización; su límite también se actualiza en Configuración.</Aviso>
        )}
      </div>
    </Modal>
  );
}
