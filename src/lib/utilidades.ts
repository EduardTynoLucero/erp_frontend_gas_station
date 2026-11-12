import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo conflictos (la última gana). */
export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases));
}

/** Iniciales de las dos primeras palabras del nombre (Karla Méndez → KM). */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
