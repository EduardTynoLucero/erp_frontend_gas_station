'use client';

import { Fuel } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type { Perfil } from '@/api/tipos';
import { BotonTema } from '@/componentes/marco/tema';
import { Aviso } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada } from '@/componentes/ui/campos';
import { MENSAJE_SIN_CONEXION } from '@/lib/entorno';
import { NOMBRE_APP, VERSION } from '@/lib/marca';
import { destinoSeguro, inicioDe } from '@/lib/rutas';

const MOTIVOS: Record<string, string> = {
  sesion: 'Su sesión terminó. Inicie sesión de nuevo.',
  'sin-conexion': MENSAJE_SIN_CONEXION,
  error: 'No se pudo validar la sesión. Inicie sesión de nuevo.',
};

/**
 * Inicio de sesión: usuario y contraseña contra el backend (POST /api/v1/auth/login). No lleva usuarios ni contraseñas
 * escritos en el código: los usuarios se administran en «Usuarios y roles» y viven en la base.
 */
export function FormularioIngreso({ destino, motivo }: { destino?: string | undefined; motivo?: string | undefined }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(motivo ? (MOTIVOS[motivo] ?? null) : null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !clave) {
      setError('Escriba su usuario y contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.trim(), clave }),
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
      setError(MENSAJE_SIN_CONEXION);
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-fondo px-[12px] py-[28px] sm:py-[48px]">
      <div className="fixed right-[12px] top-[12px]">
        <BotonTema />
      </div>
      <div className="mx-auto grid max-w-[360px]">
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
          <form onSubmit={entrar} className="space-y-[10px]" noValidate>
            <Campo etiqueta="Usuario" htmlFor="usuario">
              <Entrada
                id="usuario"
                autoComplete="username"
                autoCapitalize="none"
                placeholder="nombre.apellido"
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
          <p className="mt-[14px] border-t border-borde-suave pt-[6px] text-[11px] font-semibold text-tinta-suave">Versión {VERSION}</p>
        </div>
      </div>
    </div>
  );
}
