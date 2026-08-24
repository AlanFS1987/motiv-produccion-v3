// frontend/src/lib/admin-gamificacion.ts
//
// Vista de usuarios del admin — puntos totales, nivel actual/siguiente
// y botón "otorgar generaciones" (07-pendientes.md #18, sesión
// 24/08/2026). Toda la parte de BD (v_admin_usuarios_gamificacion,
// fn_otorgar_bonus_nivel) ya existía desde el 23/08/2026
// (20260823100000_personaje_stats_nivel_bonus.sql) — esto es solo la
// capa de datos + pantalla que faltaba.
//
// v_admin_usuarios_gamificacion no trae username (solo usuario_id) —
// se cruza en cliente con una consulta aparte a `usuario`, mismo
// patrón de varias consultas en paralelo que ya usa
// obtenerReyesDelFormato en lib/ranking.ts. No hace falta preocuparse
// de RLS aquí: quien llama esta pantalla es siempre administrador,
// que ya tiene SELECT completo sobre `usuario` (usuario_select_propio).

import { supabase } from "./supabase-client";

export interface UsuarioGamificacion {
  usuarioId: string;
  username: string;
  rol: "operario" | "responsable";
  puntosTotales: number;
  nivelActualNombre: string;
  nivelActualOrden: number;
  siguienteNivelNombre: string | null;
  puntosParaSiguienteNivel: number | null;
  /** true = fn_otorgar_bonus_nivel ya se llamó para el nivel actual de este usuario — botón deshabilitado. */
  bonusNivelActualOtorgado: boolean;
}

export async function obtenerUsuariosGamificacion(): Promise<UsuarioGamificacion[]> {
  const [{ data: gamData, error: errorGam }, { data: usuariosData, error: errorUsuarios }] = await Promise.all([
    supabase
      .from("v_admin_usuarios_gamificacion")
      .select(
        "usuario_id, rol, puntos_totales, nivel_actual_nombre, nivel_actual_orden, siguiente_nivel_nombre, puntos_para_siguiente_nivel, bonus_nivel_actual_otorgado",
      ),
    supabase.from("usuario").select("id, username").in("rol", ["operario", "responsable"]),
  ]);
  if (errorGam) throw new Error(errorGam.message);
  if (errorUsuarios) throw new Error(errorUsuarios.message);

  const nombrePorId = new Map((usuariosData ?? []).map((u: any) => [u.id as string, u.username as string]));

  return (gamData ?? [])
    .map((f: any) => ({
      usuarioId: f.usuario_id as string,
      username: nombrePorId.get(f.usuario_id as string) ?? "—",
      rol: f.rol as "operario" | "responsable",
      puntosTotales: (f.puntos_totales as number) ?? 0,
      nivelActualNombre: f.nivel_actual_nombre as string,
      nivelActualOrden: f.nivel_actual_orden as number,
      siguienteNivelNombre: (f.siguiente_nivel_nombre as string | null) ?? null,
      puntosParaSiguienteNivel: (f.puntos_para_siguiente_nivel as number | null) ?? null,
      bonusNivelActualOtorgado: Boolean(f.bonus_nivel_actual_otorgado),
    }))
    .sort((a: UsuarioGamificacion, b: UsuarioGamificacion) => a.username.localeCompare(b.username));
}

export interface ResultadoOtorgarBonus {
  otorgado: boolean;
  nivelNombre: string;
}

/**
 * Llama a fn_otorgar_bonus_nivel — idempotente en BD (si el nivel
 * actual ya tenía snapshot en personaje_stats_nivel, devuelve
 * otorgado=false sin tocar nada, ver comentario de la función). La
 * función devuelve `table(...)`, así que PostgREST lo entrega como
 * array de 1 fila.
 */
export async function otorgarBonusNivel(usuarioId: string): Promise<ResultadoOtorgarBonus> {
  const { data, error } = await supabase.rpc("fn_otorgar_bonus_nivel", { p_usuario_id: usuarioId });
  if (error) throw new Error(error.message);
  const fila = Array.isArray(data) ? data[0] : data;
  return {
    otorgado: Boolean(fila?.otorgado),
    nivelNombre: (fila?.nivel_nombre as string) ?? "",
  };
}