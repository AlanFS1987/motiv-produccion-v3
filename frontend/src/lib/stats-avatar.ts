// frontend/src/lib/stats-avatar.ts
//
// Datos de la pestaña Stats+Avatar (sesión de diseño 23/08/2026):
// las 4 barras (fuerza/resistencia/velocidad/vida) SIEMPRE en vivo
// (decisión de sesión: para poder comparar lo que tenías con lo que
// tienes ahora, aunque tu carta activa sea de un nivel anterior),
// más la gestión del avatar (listar los ya generados, elegir cuál es
// el activo, generar uno nuevo).
//
// La generación en sí sigue siendo generarPersonaje() de
// lib/gamificacion.ts (sin tocar) — este archivo solo añade lo que
// faltaba: stats en vivo, listar avatares, y elegir uno ya generado.

import { supabase } from "./supabase-client";
import type { PersonajeInfo } from "./gamificacion";

export interface StatsEnVivo {
  fuerza: number;
  resistencia: number;
  velocidad: number | null; // null si todavía no hay tiempo_plena registrado
  vida: number;
}

/**
 * Fuerza/resistencia/velocidad de v_stats_vida + vida (= puntos
 * totales de la vista que toque según el rol, misma fuente que usa
 * fn_nivel_actual en BD).
 */
export async function obtenerStatsEnVivo(
  usuarioId: string,
  rol: "operario" | "responsable",
): Promise<StatsEnVivo> {
  const vistaPuntos = rol === "operario" ? "v_puntos_operario_total_vida" : "v_puntos_responsable_total_vida";
  const columnaId = rol === "operario" ? "operario_id" : "responsable_id";

  const [{ data: statsData, error: errorStats }, { data: puntosData, error: errorPuntos }] = await Promise.all([
    supabase.from("v_stats_vida").select("fuerza, resistencia, velocidad").eq("usuario_id", usuarioId).eq("rol", rol).maybeSingle(),
    supabase.from(vistaPuntos).select("puntos_totales").eq(columnaId, usuarioId).maybeSingle(),
  ]);

  if (errorStats) throw new Error(errorStats.message);
  if (errorPuntos) throw new Error(errorPuntos.message);

  return {
    fuerza: (statsData?.fuerza as number | undefined) ?? 0,
    resistencia: (statsData?.resistencia as number | undefined) ?? 0,
    velocidad: (statsData?.velocidad as number | null | undefined) ?? null,
    vida: (puntosData?.puntos_totales as number | undefined) ?? 0,
  };
}

/** El personaje actualmente seleccionado (o null si no ha generado ninguno). */
export async function obtenerPersonajeActivo(usuarioId: string): Promise<PersonajeInfo | null> {
  const { data, error } = await supabase
    .from("personaje_rpg")
    .select("id, imagen_url, historia, created_at")
    .eq("usuario_id", usuarioId)
    .eq("seleccionada", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PersonajeInfo | null) ?? null;
}

/** Todos los personajes generados por el usuario, más recientes primero — para el picker "Elegir avatar". */
export async function listarPersonajes(usuarioId: string): Promise<(PersonajeInfo & { seleccionada: boolean })[]> {
  const { data, error } = await supabase
    .from("personaje_rpg")
    .select("id, imagen_url, historia, created_at, seleccionada")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as (PersonajeInfo & { seleccionada: boolean })[];
}

/** Cambia cuál es el avatar activo entre los ya generados — atómico (fn_seleccionar_personaje, ver migración). */
export async function seleccionarPersonaje(personajeId: string): Promise<PersonajeInfo> {
  const { data, error } = await supabase.rpc("fn_seleccionar_personaje", { p_personaje_id: personajeId });
  if (error) throw new Error(error.message);
  return data as PersonajeInfo;
}

export async function obtenerGeneracionesDisponibles(usuarioId: string): Promise<number> {
  const { data, error } = await supabase
    .from("usuario")
    .select("generaciones_disponibles")
    .eq("id", usuarioId)
    .single();
  if (error) throw new Error(error.message);
  return (data?.generaciones_disponibles as number | undefined) ?? 0;
}

// ---------------------------------------------------------------
// Generaciones POR NIVEL (sesión 23/08/2026) — sustituye al contador
// plano de arriba para el flujo real de "Generar avatar": cada nivel
// alcanzado tiene sus propias 3 generaciones, y solo permiten generar
// LA CARTA DE ESE NIVEL (con sus stats congeladas), no el nivel
// actual en vivo. obtenerGeneracionesDisponibles() de arriba queda
// sin uso en este flujo — se deja por si algo más la necesitara.
// ---------------------------------------------------------------

export interface NivelDisponibleGenerar {
  nivelId: string;
  nivelNombre: string;
  nivelOrden: number;
  generacionesRestantes: number;
  yaGenerado: boolean;
}

/** Niveles alcanzados con generaciones > 0 — para el selector de "para qué nivel generar". */
export async function obtenerNivelesDisponiblesParaGenerar(usuarioId: string): Promise<NivelDisponibleGenerar[]> {
  const { data, error } = await supabase
    .from("v_niveles_disponibles_generar")
    .select("nivel_id, nivel_nombre, nivel_orden, generaciones_restantes, ya_generado")
    .eq("usuario_id", usuarioId)
    .gt("generaciones_restantes", 0)
    .order("nivel_orden", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((f: any) => ({
    nivelId: f.nivel_id,
    nivelNombre: f.nivel_nombre,
    nivelOrden: f.nivel_orden,
    generacionesRestantes: f.generaciones_restantes,
    yaGenerado: f.ya_generado,
  }));
}

export interface RespuestaGenerarPersonajeNivel {
  ok: true;
  personaje: PersonajeInfo;
  nivel: { id: string; nombre: string };
  historia_pendiente: boolean;
}

/** Genera la carta de un nivel concreto (elegido por el operario, ver obtenerNivelesDisponiblesParaGenerar). */
export async function generarPersonajeParaNivel(
  nivelId: string,
  imagenReferenciaUrl: string,
  promptOperario?: string,
): Promise<RespuestaGenerarPersonajeNivel> {
  const { data, error } = await supabase.functions.invoke<RespuestaGenerarPersonajeNivel>("generar-personaje", {
    body: {
      nivel_id: nivelId,
      imagen_referencia_url: imagenReferenciaUrl,
      prompt_operario: promptOperario,
    },
  });
  if (error) {
    let mensaje = error.message ?? "Error llamando a generar-personaje";
    try {
      // deno-lint-ignore no-explicit-any
      const cuerpo = await (error as any).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      // sin cuerpo JSON legible, nos quedamos con error.message
    }
    throw new Error(mensaje);
  }
  return data as RespuestaGenerarPersonajeNivel;
}