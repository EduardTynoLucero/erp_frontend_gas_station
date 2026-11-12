'use client';

import { Fuel } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type { Perfil } from '@/api/tipos';
import { BotonTema } from '@/componentes/marco/tema';
import { Aviso } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada } from '@/componentes/ui/campos';
import { NOMBRE_APP, VERSION } from '@/lib/marca';
import { destinoSeguro, inicioDe } from '@/lib/rutas';

/** Usuarios de la semilla del backend (npm run db:semilla): uno por puesto, en el orden de roles del prototipo. */
const USUARIOS_DEMO = [
  { usuario: 'admin', nombre: 'Administrador del sistema', rol: 'Super administrador', estaciones: 'Todas' },
  { usuario: 'ana.morales', nombre: 'Ana Morales', rol: 'Gerencia general', estaciones: 'Todas' },
  { usuario: 'luis.perez', nombre: 'Luis Pérez', rol: 'Contador corporativo', estaciones: 'Todas' },
  { usuario: 'carmen.ruiz', nombre: 'Carmen Ruiz', rol: 'Tesorería', estaciones: 'Todas' },
  { usuario: 'karla.mendez', nombre: 'Karla Méndez', rol: 'Gerente de estación', estaciones: 'PCONC' },
  { usuario: 'maria.lopez', nombre: 'María López', rol: 'Encargado de caja chica', estaciones: 'PCONC' },
  { usuario: 'pedro.gomez', nombre: 'Pedro Gómez', rol: 'Solicitante', estaciones: 'PCONC' },
  { usuario: 'jorge.herrera', nombre: 'Jorge Herrera', rol: 'Auditor', estaciones: 'Todas' },
];

/**
 * Solo en desarrollo: la lista de usuarios de demostración (con su contraseña) y las notas del entorno local. En la
 * compilación de producción no se muestran: publicarían en internet la contraseña de prueba de todos los puestos.
 */
const ES_DESARROLLO = process.env.NODE_ENV !== 'production';

const MOTIVOS: Record<string, string> = {
  sesion: 'Su sesión terminó. Inicie sesión de nuevo.',
  'sin-conexion': ES_DESARROLLO
    ? 'No hay conexión con el backend (http://localhost:4000). ¿Está encendido con npm run dev?'
    : 'No hay conexión con el servidor. Intente de nuevo en unos minutos; si continúa, avise a soporte.',
  error: 'No se pudo validar la sesión. Inicie sesión de nuevo.',
};

export function FormularioIngreso({ destino, motivo }: { destino?: string | undefined; motivo?: string | undefined }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(motivo ? (MOTIVOS[motivo] ?? null) : null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(u: string, c: string) {
    if (!u.trim() || !c) {
      setError('Escriba su usuario y contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: u.trim(), clave: c }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { data?: Perfil; detail?: string } | null;
      if (!respuesta.ok || !cuerpo?.data) {
        setError(cuerpo?.detail ?? 'No se pudo iniciar sesión.');
        setEnviando(false);
        return;
      }
      // Navegación completa: el proxy valida la sesión nueva y arma el menú desde /auth/me
      window.location.assign(destinoSeguro(destino) ?? inicioDe(cuerpo.data) ?? '/sin-acceso');
    } catch {
      setError('No hay conexión con el servidor. Revise que el backend esté encendido.');
      setEnviando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void entrar(usuario, clave);
  }

  return (
    <div className="min-h-screen bg-fondo px-[12px] py-[28px] sm:py-[48px]">
      <div className="fixed right-[12px] top-[12px]">
        <BotonTema />
      </div>
      <div className={ES_DESARROLLO ? 'mx-auto grid max-w-[960px] gap-[10px] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]' : 'mx-auto grid max-w-[360px]'}>
        <div className="self-start rounded-[2px] border border-borde border-t-[3px] border-t-primario bg-superficie p-[18px]">
          <div className="mb-[16px] flex items-center gap-[10px]">
            <span className="grid size-[38px] place-items-center rounded-[2px] bg-primario text-white">
              <Fuel className="size-[20px]" />
            </span>
            <div>
              <h1 className="text-[16px] font-bold leading-[1.2] text-tinta">{NOMBRE_APP}</h1>
              <p className="text-[11px] text-tenue">Gastos, ventas e indicadores de la estación</p>
            </div>
          </div>
          <form onSubmit={enviar} className="space-y-[10px]" noValidate>
            <Campo etiqueta="Usuario" htmlFor="usuario">
              <Entrada
                id="usuario"
                autoComplete="username"
                autoCapitalize="none"
                placeholder="ej. karla.mendez"
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Contraseña" htmlFor="clave">
              <Entrada id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            </Campo>
            {error && <Aviso tono="red">{error}</Aviso>}
            <Boton type="submit" className="h-[34px] w-full text-[13px]" cargando={enviando}>
              {enviando ? 'Entrando…' : 'Iniciar sesión'}
            </Boton>
          </form>
          {ES_DESARROLLO && (
            <p className="mt-[14px] text-[11px] leading-[1.4] text-tenue">
              Entorno local: la sesión usa cookies httpOnly emitidas por el backend en http://localhost:4000.
            </p>
          )}
          <p className="mt-[8px] border-t border-borde-suave pt-[6px] text-[11px] font-semibold text-tinta-suave">Versión {VERSION}</p>
        </div>

        {ES_DESARROLLO && (
          <div className="rounded-[2px] border border-borde bg-superficie">
            <div className="border-b border-borde bg-barra px-[10px] py-[7px] text-[11px] leading-[1.4] text-tinta-suave">
              <span className="font-bold text-tinta">Usuarios de demostración.</span> Contraseña de todos:{' '}
              <span className="font-mono font-semibold text-tinta">demo123</span>. Toque uno para entrar con ese rol.
            </div>
            <ul className={enviando ? 'pointer-events-none opacity-60' : ''}>
              {USUARIOS_DEMO.map((u) => (
                <li key={u.usuario} className="border-b border-borde-suave last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setUsuario(u.usuario);
                      setClave('demo123');
                      void entrar(u.usuario, 'demo123');
                    }}
                    className="group flex w-full cursor-pointer items-center justify-between gap-[10px] px-[10px] py-[6px] text-left transition-colors hover:bg-primario-suave focus:outline-none focus-visible:bg-primario-suave"
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-tinta group-hover:text-primario-tinta">{u.rol}</span>
                      <span className="block text-[11px] text-tenue">
                        {u.nombre} · <span className="font-mono">{u.usuario}</span>
                      </span>
                    </span>
                    <span className="text-[11px] text-tenue">{u.estaciones}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
