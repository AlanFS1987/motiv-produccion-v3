// frontend/src/lib/admin-usuarios.ts
// Ajuste de letra de rotación (A/B/C/D) y de rol para responsables,
// operarios, suplente, jefe, producción y calidad — 'administrador'
// queda fuera aposta (además bloqueado en BD por trigger, defensa en
// profundidad: 20260821230000_bloquear_ascenso_admin.sql).
//
// Importante: cambiar la letra afecta a partir de ahora en adelante
// (qué turno le toca según fn_turno_de_letra) — NO reescribe nada de
// los partes ya creados, porque `parte.operario_id` es la fuente
// única de verdad para quién hizo qué.

import { supabase } from "./supabase-client";

export type Letra = "A" | "B" | "C" | "D";

export type RolAsignable =
  | "responsable" | "suplente" | "operario"
  | "jefe" | "produccion" | "calidad" | "jefe_rectificado";

const ROLES_CON_LETRA: RolAsignable[] = ["responsable", "operario"];

export interface UsuarioConLetra {
  id: string;
  username: string;
  rol: RolAsignable;
  letra: Letra | null;
}

export async function obtenerUsuariosConLetra(): Promise<UsuarioConLetra[]> {
  const { data, error } = await supabase
    .from("usuario")
    .select("id, username, rol, letra")
    .neq("rol", "administrador")
    .order("rol", { ascending: true })
    .order("username", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UsuarioConLetra[];
}

export async function actualizarLetra(usuarioId: string, letra: Letra | null): Promise<void> {
  const { error } = await supabase.from("usuario").update({ letra }).eq("id", usuarioId);
  if (error) throw new Error(error.message);
}

// Al cambiar a un rol sin letra (jefe/producción/calidad/suplente) se
// limpia `letra` en el mismo UPDATE.
export async function actualizarRol(usuarioId: string, rol: RolAsignable): Promise<void> {
  const payload = ROLES_CON_LETRA.includes(rol) ? { rol } : { rol, letra: null };
  const { error } = await supabase.from("usuario").update(payload).eq("id", usuarioId);
  if (error) throw new Error(error.message);
}