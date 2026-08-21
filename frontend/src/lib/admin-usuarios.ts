// frontend/src/lib/admin-usuarios.ts
// Ajuste de letra de rotación (A/B/C/D) para responsables y
// operarios. Simple UPDATE sobre `usuario.letra` — la política RLS
// `usuario_update_admin` ya permite esto al rol administrador, no
// hace falta ninguna Edge Function ni migración nueva.
//
// Importante: cambiar la letra afecta a partir de ahora en adelante
// (qué turno le toca según fn_turno_de_letra) — NO reescribe nada de
// los partes ya creados, porque `parte.operario_id` es la fuente
// única de verdad para quién hizo qué (decisión de sesión 19/08), la
// letra del operario en `usuario` no interviene en ningún cálculo
// retroactivo.

import { supabase } from "./supabase-client";

export type Letra = "A" | "B" | "C" | "D";

export interface UsuarioConLetra {
  id: string;
  username: string;
  rol: "responsable" | "operario";
  letra: Letra | null;
}

export async function obtenerUsuariosConLetra(): Promise<UsuarioConLetra[]> {
  const { data, error } = await supabase
    .from("usuario")
    .select("id, username, rol, letra")
    .in("rol", ["responsable", "operario"])
    .order("rol", { ascending: true })
    .order("username", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UsuarioConLetra[];
}

export async function actualizarLetra(usuarioId: string, letra: Letra | null): Promise<void> {
  const { error } = await supabase.from("usuario").update({ letra }).eq("id", usuarioId);
  if (error) throw new Error(error.message);
}