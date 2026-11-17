/**
 * Tema claro u oscuro. La elección va en una cookie: es lo único de la interfaz que se recuerda
 * en el navegador, porque tiene que aplicarse antes de iniciar sesión y antes de que la página se pinte. Las demás
 * preferencias de interfaz viven en la base, por usuario (componentes/marco/preferencias).
 *
 * Este archivo no es de cliente a propósito: el guion lo usa el layout raíz, que se arma en el servidor.
 */
export type Tema = 'light' | 'dark' | 'system';

export const COOKIE_TEMA = 'erp_tema';

/**
 * Corre en <head>, antes del primer pintado: lee la cookie y pone (o quita) la clase `dark` en <html>, así la página
 * nunca parpadea con el tema equivocado. Es la técnica de la guía de Next.js «Preventing flash before hydration».
 */
export const GUION_TEMA =
  `(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIE_TEMA}=(light|dark|system)/);var t=m?m[1]:"system";` +
  `var o=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);` +
  `var r=document.documentElement;r.classList.toggle("dark",o);r.style.colorScheme=o?"dark":"light"}catch(e){}})()`;
