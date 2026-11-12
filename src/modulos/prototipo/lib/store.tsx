'use client';

/**
 * Estado de las pantallas del prototipo (Expenses_project/src/lib/store.tsx) dentro del ERP. Mismo useStore() que
 * usaban las pantallas, con tres diferencias:
 *   - la sesión es la del ERP (no hay inicio de sesión propio): el usuario simulado es el de la sesión real;
 *   - el filtro de estación es el del encabezado del ERP (el mismo para todas las pantallas);
 *   - los datos son los simulados de este navegador (local.ts) y los avisos salen con las notificaciones del ERP.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { TODAS, useErp } from '@/componentes/marco/contexto';
import { EsqueletoTabla } from '@/componentes/ui/aviso';
import type { Categoria, CentroCosto, Config, Contrato, Cotizacion, DB, Documento, EstadoHallazgo, MovimientoCaja, Pago, Proveedor, Recurrente, Rol, Usuario } from '../types';
import { administra, puedeVerModulo } from './acceso';
import { vistaPara, type Accion, type DatosEstacion, type DatosRequerimiento, type DatosUsuario, type NuevoGasto } from './acciones';
import * as local from './local';
import { rolDe, tiene } from './reglas';

export type { NuevoGasto } from './acciones';

function crearAcciones(enviar: (a: Accion) => Promise<local.RespAccion>) {
  const ok = async (a: Accion) => (await enviar(a)).ok;
  const conId = async (a: Accion) => {
    const r = await enviar(a);
    return r.ok ? (r.id ?? '') : null;
  };
  return {
    crearGasto: (datos: NuevoGasto, enviarA: boolean) => conId({ tipo: 'crearGasto', datos, enviar: enviarA }),
    editarGasto: (id: string, datos: NuevoGasto, enviarA: boolean) => ok({ tipo: 'editarGasto', id, datos, enviar: enviarA }),
    eliminarBorrador: (id: string) => ok({ tipo: 'eliminarBorrador', id }),
    reabrirGasto: (id: string) => ok({ tipo: 'reabrirGasto', id }),
    enviarGasto: (id: string) => ok({ tipo: 'enviarGasto', id }),
    aprobarGasto: (id: string, comentario = '') => ok({ tipo: 'aprobarGasto', id, comentario }),
    rechazarGasto: (id: string, comentario: string) => ok({ tipo: 'rechazarGasto', id, comentario }),
    pagarGasto: (id: string, pago: Omit<Pago, 'usuarioId'>) => ok({ tipo: 'pagarGasto', id, pago }),
    registrarComprobante: (id: string, doc: Documento) => ok({ tipo: 'registrarComprobante', id, doc }),
    verificarComprobante: (id: string) => ok({ tipo: 'verificarComprobante', id }),
    desembolsoCaja: (cajaId: string, mov: Omit<MovimientoCaja, 'id' | 'tipo'>) => ok({ tipo: 'desembolsoCaja', cajaId, mov }),
    liquidarCaja: (cajaId: string) => ok({ tipo: 'liquidarCaja', cajaId }),
    generarRecurrentes: (ids: string[]) => ok({ tipo: 'generarRecurrentes', ids }),
    guardarRecurrente: (r: Recurrente) => ok({ tipo: 'guardarRecurrente', r }),
    toggleRecurrente: (id: string) => ok({ tipo: 'toggleRecurrente', id }),
    cambiarEstadoHallazgo: (id: string, estado: EstadoHallazgo) => ok({ tipo: 'cambiarEstadoHallazgo', id, estado }),
    guardarPresupuesto: (periodo: string, estacionId: string, categoriaId: string, monto: number) =>
      ok({ tipo: 'guardarPresupuesto', periodo, estacionId, categoriaId, monto }),
    copiarPresupuestos: (desde: string, hacia: string) => ok({ tipo: 'copiarPresupuestos', desde, hacia }),
    guardarProveedor: (p: Proveedor) => ok({ tipo: 'guardarProveedor', p }),
    toggleProveedor: (id: string) => ok({ tipo: 'toggleProveedor', id }),
    guardarUsuario: (u: DatosUsuario, clave?: string) => ok({ tipo: 'guardarUsuario', u, clave }),
    toggleUsuario: (id: string) => ok({ tipo: 'toggleUsuario', id }),
    guardarRol: (rol: Rol) => ok({ tipo: 'guardarRol', rol }),
    guardarConfig: (cfg: Config) => ok({ tipo: 'guardarConfig', cfg }),
    guardarCategoria: (c: Categoria, nueva: boolean) => ok({ tipo: 'guardarCategoria', c, nueva }),
    guardarCentro: (c: CentroCosto, nuevo: boolean) => ok({ tipo: 'guardarCentro', c, nuevo }),
    guardarEstacion: (e: DatosEstacion) => ok({ tipo: 'guardarEstacion', e }),
    crearRequerimiento: (datos: DatosRequerimiento) => conId({ tipo: 'crearRequerimiento', datos }),
    agregarCotizacion: (ocId: string, cot: Cotizacion) => ok({ tipo: 'agregarCotizacion', ocId, cot }),
    emitirOrden: (ocId: string, idx: number) => ok({ tipo: 'emitirOrden', ocId, idx }),
    recibirOrden: (ocId: string, doc: Documento) => ok({ tipo: 'recibirOrden', ocId, doc }),
    cancelarOrden: (ocId: string) => ok({ tipo: 'cancelarOrden', ocId }),
    guardarContrato: (c: Contrato) => ok({ tipo: 'guardarContrato', c }),
    renovarContrato: (id: string, meses: number) => ok({ tipo: 'renovarContrato', id, meses }),
    aplicarProrrateo: (periodo: string, criterio: Config['criterioProrrateo']) => ok({ tipo: 'aplicarProrrateo', periodo, criterio }),
    quitarProrrateo: (periodo: string) => ok({ tipo: 'quitarProrrateo', periodo }),
  };
}

export type Acciones = ReturnType<typeof crearAcciones>;

interface Contexto {
  db: DB;
  usuario: Usuario;
  rol: Rol;
  /** Siempre 'local': los datos simulados se guardan en este navegador */
  modo: 'local';
  ocupado: boolean;
  estacionFiltro: string;
  setEstacionFiltro: (id: string) => void;
  acciones: Acciones;
  avisar: (texto: string, tipo?: 'ok' | 'error') => void;
  cerrarSesion: () => Promise<void>;
  cambiarClave: (datos: { usuarioId?: string; actual?: string; nueva: string }) => Promise<boolean>;
  restablecer: () => Promise<boolean>;
  subirArchivo: (archivo: File) => Promise<{ id: string; nombre: string } | null>;
  urlArchivo: (id: string) => string;
}

const Ctx = createContext<Contexto | null>(null);

const avisar = (texto: string, tipo: 'ok' | 'error' = 'ok') => {
  if (tipo === 'error') toast.error(texto);
  else toast.success(texto);
};

function Cargando() {
  return (
    <div role="status" className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">Cargando los datos simulados…</p>
      <EsqueletoTabla filas={5} />
    </div>
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { perfil, estaciones, estacionFiltro: filtroErp, fijarEstacionFiltro } = useErp();
  const almacen = useSyncExternalStore(local.suscribir, local.instantanea, () => null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    local.iniciar();
  }, []);

  // La sesión real manda: se refleja en el usuario simulado cada vez que cambian el perfil o los datos
  useEffect(() => {
    if (almacen) local.sincronizarUsuario(perfil);
  }, [almacen, perfil]);

  const completa = almacen?.db;
  const usuarioId = useMemo(() => (completa ? local.usuarioSincronizado(completa, perfil).id : null), [completa, perfil]);
  const usuario = completa?.usuarios.find((u) => u.id === usuarioId);
  const db = useMemo(() => (completa && usuario ? vistaPara(completa, usuario) : null), [completa, usuario]);

  // Filtro de estación: el del encabezado del ERP, traducido por código (PCONC, PDEM1…) a la estación simulada
  const estacionFiltro = useMemo(() => {
    if (!completa || filtroErp === TODAS) return 'ALL';
    const codigo = estaciones.find((e) => e.id === filtroErp)?.codigo;
    return completa.estaciones.find((e) => e.codigo === codigo)?.id ?? 'ALL';
  }, [completa, filtroErp, estaciones]);

  const setEstacionFiltro = useCallback(
    (id: string) => {
      const codigo = completa?.estaciones.find((e) => e.id === id)?.codigo;
      fijarEstacionFiltro(estaciones.find((e) => e.codigo === codigo)?.id ?? TODAS);
    },
    [completa, estaciones, fijarEstacionFiltro],
  );

  const enviar = useCallback(
    async (a: Accion): Promise<local.RespAccion> => {
      if (!usuarioId) return { ok: false, error: 'Los datos simulados todavía se están cargando.' };
      const r = local.ejecutarAccion(usuarioId, a);
      if (r.ok) {
        if (r.mensaje) avisar(r.mensaje);
      } else {
        avisar(r.error, 'error');
      }
      return r;
    },
    [usuarioId],
  );

  const acciones = useMemo(() => crearAcciones(enviar), [enviar]);

  if (!db || !usuario) return <Cargando />;

  const value: Contexto = {
    db,
    usuario,
    rol: rolDe(db, usuario),
    modo: 'local',
    ocupado,
    estacionFiltro,
    setEstacionFiltro,
    acciones,
    avisar,
    cerrarSesion: async () => {
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } finally {
        window.location.assign('/login');
      }
    },
    // Las contraseñas reales las administra el backend: aquí solo se simula el restablecimiento (queda en la bitácora)
    cambiarClave: async ({ usuarioId: objetivo, nueva }) => {
      if (nueva.length < 6) {
        avisar('La contraseña debe tener al menos 6 caracteres.', 'error');
        return false;
      }
      const completo = local.instantanea()?.db;
      const otro = completo?.usuarios.find((x) => x.id === objetivo);
      if (!completo || !otro || otro.id === usuario.id) {
        avisar('Su contraseña del ERP no se cambia desde los datos simulados.', 'error');
        return false;
      }
      if (!tiene(completo, usuario, 'usuarios') || !puedeVerModulo(completo, usuario, 'usuarios')) {
        avisar('Su usuario no puede cambiar contraseñas de otros usuarios.', 'error');
        return false;
      }
      const v = administra(completo, usuario, otro);
      if (!v.ok) {
        avisar(`No puede cambiar la contraseña de ${otro.nombre}: ${v.motivo}`, 'error');
        return false;
      }
      local.registrarEvento(usuario.id, 'contraseña', 'Usuario', `Restableció la contraseña de ${otro.usuario} (simulado)`);
      avisar(`Contraseña de ${otro.nombre} restablecida en los datos simulados. Su contraseña real del ERP no cambia.`);
      return true;
    },
    restablecer: async () => {
      const completo = local.instantanea()?.db;
      if (!completo || !tiene(completo, usuario, 'configurar') || !puedeVerModulo(completo, usuario, 'configuracion')) {
        avisar('Solo el super administrador restablece los datos.', 'error');
        return false;
      }
      const error = await local.restablecer();
      if (error) {
        avisar(error, 'error');
        return false;
      }
      avisar('Datos simulados restablecidos: quedan solo los catálogos.');
      return true;
    },
    subirArchivo: async (archivo) => {
      setOcupado(true);
      try {
        const r = await local.subirArchivo(archivo);
        if (!r.ok) {
          avisar(r.error, 'error');
          return null;
        }
        return { id: r.id, nombre: r.nombre };
      } finally {
        setOcupado(false);
      }
    },
    urlArchivo: local.urlArchivo,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore fuera de StoreProvider');
  return c;
}

/** Atajos de búsqueda por id para las vistas. */
export function useCatalogos() {
  const { db } = useStore();
  return useMemo(() => {
    const m = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
    const est = m(db.estaciones);
    const cat = m(db.categorias);
    const prov = m(db.proveedores);
    const usr = m(db.usuarios);
    const cc = m(db.centrosCosto);
    const uni = m(db.unidades);
    return {
      estacion: (id: string) => est.get(id),
      estCodigo: (id: string) => est.get(id)?.codigo ?? id,
      categoria: (id: string | null) => (id ? cat.get(id) : undefined),
      catNombre: (id: string | null) => (id ? (cat.get(id)?.nombre ?? id) : '—'),
      proveedor: (id: string | null) => (id ? prov.get(id) : undefined),
      provNombre: (id: string | null) => (id ? (prov.get(id)?.nombre ?? id) : 'Ajuste interno'),
      usuario: (id: string) => usr.get(id),
      usrNombre: (id: string) => usr.get(id)?.nombre ?? id,
      centro: (id: string) => cc.get(id),
      ccNombre: (id: string) => cc.get(id)?.nombre ?? id,
      unidad: (id: string) => uni.get(id),
      uniNombre: (id: string) => uni.get(id)?.nombre ?? id,
    };
  }, [db.estaciones, db.categorias, db.proveedores, db.usuarios, db.centrosCosto, db.unidades]);
}
