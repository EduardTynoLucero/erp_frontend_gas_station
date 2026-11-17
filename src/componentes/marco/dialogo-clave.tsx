'use client';

/**
 * «Cambiar contraseña» del menú del usuario: POST /api/v1/auth/clave. Pide la contraseña actual y la nueva dos veces.
 * Al guardarla, el backend cierra las demás sesiones del usuario y esta sigue abierta.
 */
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, ErrorApi, mensajeDeError, pedir } from '@/api/cliente';
import { Aviso } from '@/componentes/ui/aviso';
import { Boton } from '@/componentes/ui/boton';
import { Campo, Entrada } from '@/componentes/ui/campos';
import { Modal } from '@/componentes/ui/modal';

/** El mínimo que exige el backend (iam: LARGO_MINIMO_CLAVE); aquí solo adelanta el aviso */
const LARGO_MINIMO = 8;

type Errores = Partial<Record<'actual' | 'nueva' | 'repetida', string>>;

export function DialogoClave({ abierto, obligatorio = false, alCerrar }: { abierto: boolean; obligatorio?: boolean; alCerrar: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cerrar() {
    if (guardando) return;
    setActual('');
    setNueva('');
    setRepetida('');
    setErrores({});
    setGeneral(null);
    alCerrar();
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const faltan: Errores = {};
    if (!actual) faltan.actual = 'Escriba su contraseña actual.';
    if (nueva.length < LARGO_MINIMO) faltan.nueva = `La contraseña nueva debe tener al menos ${LARGO_MINIMO} caracteres.`;
    else if (nueva === actual) faltan.nueva = 'La contraseña nueva debe ser distinta de la actual.';
    if (repetida !== nueva) faltan.repetida = 'No coincide con la contraseña nueva.';
    setErrores(faltan);
    setGeneral(null);
    if (Object.keys(faltan).length > 0) return;

    setGuardando(true);
    try {
      const r = await pedir(api.POST('/api/v1/auth/clave', { body: { actual, nueva } }));
      toast.success(r.mensaje);
      setGuardando(false);
      setActual('');
      setNueva('');
      setRepetida('');
      alCerrar();
    } catch (error) {
      setGuardando(false);
      // Los errores por campo (contraseña actual incorrecta, nueva que no cumple) van junto a su campo
      const porCampo: Errores = {};
      if (error instanceof ErrorApi) {
        for (const x of error.errores) if (x.campo === 'actual' || x.campo === 'nueva') porCampo[x.campo] = x.mensaje;
      }
      setErrores(porCampo);
      if (Object.keys(porCampo).length === 0) setGeneral(mensajeDeError(error));
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      titulo="Cambiar contraseña"
      descripcion="Al cambiarla se cierran sus otras sesiones abiertas; esta sigue activa."
      pie={
        <>
          <Boton variante="secondary" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="formulario-clave" cargando={guardando}>
            Cambiar contraseña
          </Boton>
        </>
      }
    >
      <form id="formulario-clave" onSubmit={guardar} className="space-y-[10px]" noValidate>
        {obligatorio && <Aviso tono="amber">Su contraseña la asignó un administrador. Cámbiela por una que solo usted conozca.</Aviso>}
        <Campo etiqueta="Contraseña actual" htmlFor="clave-actual" error={errores.actual}>
          <Entrada
            id="clave-actual"
            type="password"
            autoComplete="current-password"
            autoFocus
            invalido={Boolean(errores.actual)}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Contraseña nueva" htmlFor="clave-nueva" error={errores.nueva} pista={`Al menos ${LARGO_MINIMO} caracteres.`}>
          <Entrada
            id="clave-nueva"
            type="password"
            autoComplete="new-password"
            invalido={Boolean(errores.nueva)}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Repita la contraseña nueva" htmlFor="clave-repetida" error={errores.repetida}>
          <Entrada
            id="clave-repetida"
            type="password"
            autoComplete="new-password"
            invalido={Boolean(errores.repetida)}
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </Campo>
        {general && <Aviso tono="red">{general}</Aviso>}
      </form>
    </Modal>
  );
}
