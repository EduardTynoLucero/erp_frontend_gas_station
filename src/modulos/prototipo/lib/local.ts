/**
 * Datos de las pantallas del prototipo que todavía no tienen tablas conectadas en el backend (caja chica, compras,
 * contratos, presupuestos…). Funciona como el modo "un solo archivo" del prototipo (LocalBackend de
 * Expenses_project/src/lib/backend.ts): la base simulada vive en el localStorage de este navegador y cada acción pasa
 * por las mismas reglas y permisos (acciones.ts). La primera vez arranca solo con los catálogos (data/seed.ts).
 *
 * Quién es el usuario lo decide el ERP, no el prototipo: la sesión real (/auth/me) se refleja en el usuario simulado
 * con el mismo nombre de usuario (rol, permisos, pantallas, estaciones, límite y alcance).
 */
import type { Perfil } from '@/api/tipos';
import type { DB, Permiso, Usuario } from '../types';
import { MODULOS } from './acceso';
import { auditar, ejecutar, marcaDeTiempo, type Accion } from './acciones';
import { PERMISOS } from './reglas';

export interface Archivo {
  nombre: string;
  data: string;
}

export interface Almacen {
  esquema: number;
  version: number;
  db: DB;
  /** Adjuntos de los gastos simulados (data URL), como en la versión de un solo archivo del prototipo */
  archivos: Record<string, Archivo>;
}

export type RespAccion = { ok: true; mensaje: string; id?: string } | { ok: false; error: string };
export type RespArchivo = { ok: true; id: string; nombre: string } | { ok: false; error: string };

const CLAVE = 'erp:prototipo:datos';
// 2: arranca en cero (solo catálogos). Lo guardado con el esquema 1 (los datos de demostración) se descarta solo
const ESQUEMA = 2;
const MAX_ARCHIVO = 1024 * 1024;
const SIN_ESPACIO = 'El navegador no tiene espacio para guardar más datos simulados (los adjuntos ocupan mucho).';

let memoria: Almacen | null = null;
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

const hora = () => new Date().toTimeString().slice(0, 8);
const avisarOyentes = () => oyentes.forEach((f) => f());

function leerDisco(): Almacen | null {
  try {
    const texto = localStorage.getItem(CLAVE);
    if (texto) {
      const d = JSON.parse(texto) as Almacen;
      if (d.esquema === ESQUEMA && d.db?.usuarios) return d;
    }
  } catch {
    // Sin acceso a localStorage o datos dañados: se empieza de nuevo (en memoria si no se puede guardar)
  }
  return null;
}

function guardar(d: Almacen): string | null {
  memoria = d;
  let error: string | null = null;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch {
    error = SIN_ESPACIO;
  }
  avisarOyentes();
  return error;
}

async function semilla(): Promise<DB> {
  const { cargarDatos } = await import('../data/seed');
  return cargarDatos();
}

/** Carga los datos guardados, o los iniciales del prototipo si es la primera vez en este navegador. */
export function iniciar(): void {
  if (memoria || cargando) return;
  const disco = leerDisco();
  if (disco) {
    memoria = disco;
    avisarOyentes();
    return;
  }
  cargando = semilla()
    .then((db) => {
      guardar({ esquema: ESQUEMA, version: 1, db, archivos: {} });
    })
    .finally(() => {
      cargando = null;
    });
}

/** Solo lo ya guardado en este navegador, sin cargar los datos iniciales (para los números del menú). */
export function cargarGuardado(): void {
  if (memoria) return;
  const disco = leerDisco();
  if (!disco) return;
  memoria = disco;
  avisarOyentes();
}

export function instantanea(): Almacen | null {
  return memoria;
}

export function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  // Otra pestaña cambió los datos: se recargan aquí también
  const alCambiar = (e: StorageEvent) => {
    if (e.key !== CLAVE) return;
    memoria = leerDisco();
    if (!memoria) iniciar();
    avisarOyentes();
  };
  window.addEventListener('storage', alCambiar);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener('storage', alCambiar);
  };
}

/** Ejecuta una acción del prototipo en nombre del usuario y la guarda. */
export function ejecutarAccion(usuarioId: string, accion: Accion): RespAccion {
  const d = memoria;
  if (!d) return { ok: false, error: 'Los datos simulados todavía se están cargando.' };
  const r = ejecutar(d.db, usuarioId, accion, hora());
  if (!r.ok) return r;
  const error = guardar({ ...d, db: r.db, version: d.version + 1 });
  if (error) return { ok: false, error };
  return { ok: true, mensaje: r.mensaje, id: r.id };
}

/** Agrega un evento a la bitácora simulada (por ejemplo, el restablecimiento simulado de una contraseña). */
export function registrarEvento(usuarioId: string, accion: string, entidad: string, detalle: string): void {
  const d = memoria;
  if (!d) return;
  guardar({ ...d, db: auditar(d.db, usuarioId, marcaDeTiempo(d.db, hora()), accion, entidad, detalle), version: d.version + 1 });
}

/** Vuelve a los datos iniciales del prototipo (solo los de este navegador). */
export async function restablecer(): Promise<string | null> {
  const db = await semilla();
  return guardar({ esquema: ESQUEMA, version: (memoria?.version ?? 0) + 1, db, archivos: {} });
}

export async function subirArchivo(archivo: File): Promise<RespArchivo> {
  const d = memoria;
  if (!d) return { ok: false, error: 'Los datos simulados todavía se están cargando.' };
  if (!/^(image\/|application\/pdf)/.test(archivo.type)) return { ok: false, error: 'Solo se aceptan fotos o PDF.' };
  if (archivo.size > MAX_ARCHIVO) return { ok: false, error: 'En los datos simulados el adjunto no puede pasar de 1 MB.' };
  const data = await new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(archivo);
  });
  const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const actual = memoria ?? d;
  const error = guardar({ ...actual, archivos: { ...actual.archivos, [id]: { nombre: archivo.name, data } } });
  if (error) return { ok: false, error };
  return { ok: true, id, nombre: archivo.name };
}

export function urlArchivo(id: string): string {
  return memoria?.archivos[id]?.data ?? '';
}

// ---------- Sesión del ERP → usuario simulado ----------

const PERMISOS_PROTOTIPO = PERMISOS.map(([p]) => p);
const PANTALLAS_PROTOTIPO = MODULOS.map((m) => m.ruta);

/**
 * El usuario simulado que corresponde a la sesión real: mismo nombre de usuario, y el rol, los permisos, las pantallas,
 * las estaciones, el límite y el alcance que da el backend (expresados como el rol más sus ajustes, igual que en el
 * prototipo). Si el usuario no existe en los datos simulados se agrega.
 */
export function usuarioSincronizado(db: DB, perfil: Perfil): Usuario {
  const nombreUsuario = perfil.usuario.usuario.toLowerCase();
  const actual = db.usuarios.find((u) => u.usuario.toLowerCase() === nombreUsuario);
  const rol =
    db.roles.find((r) => r.id === perfil.usuario.rol.codigo) ??
    db.roles.find((r) => r.id === actual?.rolId) ??
    db.roles.find((r) => r.id === 'SO') ??
    db.roles[0]!;

  const permisos = new Set(perfil.acceso.permisos);
  const pantallas = new Set(perfil.acceso.pantallas.map((p) => p.codigo));
  const lista = <T extends string>(xs: T[]) => (xs.length ? xs : undefined);
  const permisosExtra = lista(PERMISOS_PROTOTIPO.filter((p) => permisos.has(p) && !rol.permisos.includes(p)));
  const permisosQuitados = lista(PERMISOS_PROTOTIPO.filter((p): p is Permiso => !permisos.has(p) && rol.permisos.includes(p)));
  const pantallasExtra = lista(PANTALLAS_PROTOTIPO.filter((p) => pantallas.has(p) && !rol.pantallas.includes(p)));
  const pantallasQuitadas = lista(PANTALLAS_PROTOTIPO.filter((p) => !pantallas.has(p) && rol.pantallas.includes(p)));

  // Límite: null es "sin límite". Solo se guarda si es distinto del de su rol (y si autoriza).
  const limiteErp = perfil.acceso.limiteAutorizacion === null ? null : Number(perfil.acceso.limiteAutorizacion);
  const limiteAutorizacion = !permisos.has('aprobar') || limiteErp === rol.limiteAutorizacion ? undefined : limiteErp;
  const soloPropios = perfil.acceso.alcance.soloPropios === rol.soloPropios ? undefined : perfil.acceso.alcance.soloPropios;

  const codigos = new Set(perfil.acceso.alcance.estaciones.map((e) => e.codigo));
  return {
    id: actual?.id ?? `ERP-${perfil.usuario.usuario}`,
    nombre: perfil.usuario.nombre,
    usuario: actual?.usuario ?? perfil.usuario.usuario,
    rolId: rol.id,
    estaciones: db.estaciones.filter((e) => codigos.has(e.codigo)).map((e) => e.id),
    activo: true,
    permisosExtra,
    permisosQuitados,
    pantallasExtra,
    pantallasQuitadas,
    limiteAutorizacion,
    soloPropios,
  };
}

/** Refleja la sesión real en los datos simulados (solo escribe si algo cambió). Devuelve el id del usuario. */
export function sincronizarUsuario(perfil: Perfil): string | null {
  const d = memoria;
  if (!d) return null;
  const u = usuarioSincronizado(d.db, perfil);
  const previo = d.db.usuarios.find((x) => x.id === u.id);
  if (!previo || JSON.stringify(previo) !== JSON.stringify(u)) {
    const usuarios = previo ? d.db.usuarios.map((x) => (x.id === u.id ? u : x)) : [...d.db.usuarios, u];
    guardar({ ...d, db: { ...d.db, usuarios }, version: d.version + 1 });
  }
  return u.id;
}
