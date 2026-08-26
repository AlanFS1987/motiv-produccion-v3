// frontend/src/lib/equipo.ts
//
// Datos de la pestaña "Equipo" (sub-vista de Progreso, sesión
// 25/08/2026). "Tus operarios" = los de tu MISMA LETRA fija
// (A/B/C/D), no los del turno de hoy — decisión de sesión, la letra
// es estable, el turno cambia a diario. El responsable aparece él
// mismo a la cabeza de la lista.

import { supabase } from "./supabase-client";

export interface MiembroEquipo {
  usuarioId: string;
  username: string;
  esResponsable: boolean;
  avatarUrl: string | null;
  nivelNombre: string | null;
  colorMarco: string | null;
  fuerza: number | null;
  resistencia: number | null;
  velocidad: number | null;
  vida: number | null;
}

export async function obtenerEquipo(responsableId: string): Promise<MiembroEquipo[]> {
  const { data: miUsuario, error: errorMiUsuario } = await supabase
    .from("usuario")
    .select("letra")
    .eq("id", responsableId)
    .maybeSingle();
  if (errorMiUsuario) throw new Error(errorMiUsuario.message);

  const miLetra = (miUsuario as any)?.letra ?? null;
  if (!miLetra) return [];

  const { data: miembros, error: errorMiembros } = await supabase
    .from("usuario")
    .select("id, username, rol")
    .eq("letra", miLetra)
    .in("rol", ["responsable", "operario"])
    .order("username");
  if (errorMiembros) throw new Error(errorMiembros.message);

  const ids = (miembros ?? []).map((m: any) => m.id as string);
  const { data: avatares, error: errorAvatares } = await supabase
    .from("v_equipo_avatar_stats")
    .select("usuario_id, imagen_url, nivel_nombre, color_marco, fuerza, resistencia, velocidad, vida")
    .in("usuario_id", ids);
  if (errorAvatares) throw new Error(errorAvatares.message);

  const porUsuario = new Map((avatares ?? []).map((a: any) => [a.usuario_id as string, a]));

  const lista: MiembroEquipo[] = (miembros ?? []).map((m: any) => {
    const a = porUsuario.get(m.id as string);
    return {
      usuarioId: m.id as string,
      username: m.username as string,
      esResponsable: m.rol === "responsable",
      avatarUrl: a?.imagen_url ?? null,
      nivelNombre: a?.nivel_nombre ?? null,
      colorMarco: a?.color_marco ?? null,
      fuerza: a?.fuerza ?? null,
      resistencia: a?.resistencia ?? null,
      velocidad: a?.velocidad ?? null,
      vida: a?.vida ?? null,
    };
  });

  // El responsable siempre a la cabeza, el resto por username (ya
  // viene ordenado así de la consulta, .sort aquí solo lo garantiza
  // explícitamente en vez de depender del orden implícito).
  return lista.sort((a, b) => {
    if (a.esResponsable !== b.esResponsable) return a.esResponsable ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
}
