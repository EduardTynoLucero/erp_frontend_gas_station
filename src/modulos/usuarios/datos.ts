'use client';

/** Usuarios y roles: quién entra, con qué rol, y qué ve y hace cada persona (acceso real del ERP). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, pedir } from '@/api/cliente';
import type { components } from '@/api/tipos';

export type AdministracionUsuarios = components['schemas']['AdministracionUsuarios'];
export type UsuarioAdministrado = components['schemas']['UsuarioAdministrado'];
export type RolAdministrado = components['schemas']['RolAdministrado'];
export type CuerpoUsuarioNuevo = components['schemas']['NuevoUsuarioInput'];
export type CuerpoUsuarioEditado = components['schemas']['EditarUsuarioInput'];
export type CuerpoRol = components['schemas']['RolEntradaInput'];

export function useAdministracionUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => (await pedir(api.GET('/api/v1/usuarios'))).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

/** Tras un cambio de acceso: estas consultas, las de otras pantallas y el perfil que entrega el servidor. */
function useInvalidar() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['usuarios'] }),
      qc.invalidateQueries({ queryKey: ['estaciones'] }),
      qc.invalidateQueries({ queryKey: ['configuracion'] }),
      qc.invalidateQueries({ queryKey: ['gastos'] }),
      qc.invalidateQueries({ queryKey: ['contadores'] }),
    ]);
    router.refresh();
  };
}

export function useGuardarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { nuevo: true; cuerpo: CuerpoUsuarioNuevo } | { nuevo: false; id: string; cuerpo: CuerpoUsuarioEditado }) =>
      v.nuevo
        ? pedir(api.POST('/api/v1/usuarios', { body: v.cuerpo }))
        : pedir(api.PUT('/api/v1/usuarios/{id}', { params: { path: { id: v.id } }, body: v.cuerpo })),
    onSuccess: () => invalidar(),
  });
}

export function useCambiarEstadoUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; activo: boolean }) =>
      pedir(api.POST('/api/v1/usuarios/{id}/estado', { params: { path: { id: v.id } }, body: { activo: v.activo } })),
    onSuccess: () => invalidar(),
  });
}

export function useRestablecerClave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; nueva: string }) =>
      pedir(api.POST('/api/v1/usuarios/{id}/clave', { params: { path: { id: v.id } }, body: { nueva: v.nueva } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useGuardarRol() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { nuevo: true; cuerpo: CuerpoRol } | { nuevo: false; id: string; cuerpo: CuerpoRol }) =>
      v.nuevo
        ? pedir(api.POST('/api/v1/usuarios/roles', { body: v.cuerpo }))
        : pedir(api.PUT('/api/v1/usuarios/roles/{id}', { params: { path: { id: v.id } }, body: v.cuerpo })),
    onSuccess: () => invalidar(),
  });
}
