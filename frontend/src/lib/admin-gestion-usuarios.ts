// frontend/src/lib/admin-gestion-usuarios.ts
//
// Crear usuarios nuevos (no-admin) y cambiar contraseñas (de todos
// menos de cuentas administrador) — llama a las Edge Functions
// admin-crear-usuario / admin-cambiar-password, que son las únicas
// piezas que tocan auth.admin.* con la service_role key (ver 09).
//
// supabase.functions.invoke() añade automáticamente el Authorization
// del usuario con sesión activa (supabase-client.ts) — no hace falta
// pasar el JWT a mano.

import { supabase } from "./supabase-client";
import type { RolAsignable, Letra } from "./admin-usuarios";

export interface UsuarioCreado {
  id: string;
  username: string;
  rol: RolAsignable;
  letra: Letra | null;
}

// El error de supabase.functions.invoke() no trae el mensaje real del
// body — hay que leerlo aparte de error.context (la Response cruda),
// mismo patrón ya usado en lib/supabase-functions.ts.
async function manejarError(error: { message?: string; context?: Response } | null, porDefecto: string): Promise<never> {
  let mensaje = error?.message ?? porDefecto;
  try {
    const cuerpo = await error?.context?.json();
    if (cuerpo?.error) mensaje = cuerpo.error;
  } catch {
    // sin cuerpo JSON legible, nos quedamos con el mensaje que había
  }
  throw new Error(mensaje);
}

export async function crearUsuario(params: {
  username: string;
  password: string;
  rol: RolAsignable;
  letra?: Letra | null;
}): Promise<UsuarioCreado> {
  const { data, error } = await supabase.functions.invoke<UsuarioCreado & { ok: true }>(
    "admin-crear-usuario",
    { body: params },
  );
  if (error) await manejarError(error as any, "Error creando el usuario");
  return data as UsuarioCreado;
}

export async function cambiarPasswordUsuario(usuarioId: string, password: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-cambiar-password", {
    body: { usuario_id: usuarioId, password },
  });
  if (error) await manejarError(error as any, "Error cambiando la contraseña");
}