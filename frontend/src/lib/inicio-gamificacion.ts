// frontend/src/lib/inicio-gamificacion.ts
//
// Datos de la tarjeta resumen de Inicio (sesión de diseño 23/08/2026)
// — sustituye a la parte de `lib/gamificacion.ts` que alimentaba
// <GamificacionCard /> en InicioOperarioScreen.tsx. La generación de
// personaje se movió entera a la pestaña Avatar/Stats (ver
// lib/stats-avatar.ts); esta tarjeta ahora es de SOLO LECTURA:
// avatar mini, nivel, nombre+grupo, puntos totales, progreso, puntos
// de ciclo/piezas/rendimiento/limpieza (piezas/rendimiento/limpieza
// SON de por vida, no del ciclo — solo "puntos ciclo" es del ciclo
// en curso), metros totales y tiempo en plena producción de por vida.
//
// Por ahora solo operario (mismo alcance que el resto de gamificación
// construida) — el mismo patrón sirve para responsable el día que se
// construya su Inicio (ver 07-pendientes.md #3), pasando rol
// distinto a obtenerResumenInicio.

import { supabase } from "./supabase-client";
import { obtenerCicloActual } from "./ciclo";
import type { NivelInfo } from "./gamificacion";

export interface ResumenInicio {
  nombreOperario: string;
  grupo: string | null; // letra de turno (A/B/C/D)
  avatarUrl: string | null;
  nivelActual: NivelInfo;
  siguienteNivel: NivelInfo | null;
  puntosTotales: number;
  puntosCiclo: number;
  puntosPiezasTotales: number;
  puntosRendimientoTotales: number;
  puntosLimpiezaTotales: number;
  metrosTotales: number;
  horasPlenaTotales: number;
}

export async function obtenerResumenInicio(
  usuarioId: string,
  rol: "operario" | "responsable",
): Promise<ResumenInicio> {
  if (rol !== "operario") {
    throw new Error("obtenerResumenInicio: solo hay datos de por vida por categoría para operario todavía");
  }

  const ciclo = await obtenerCicloActual();

  const [
    { data: usuarioFila, error: errorUsuario },
    { data: nivelesData, error: errorNiveles },
    { data: personajeData },
    { data: puntosTotalesData, error: errorPuntosTotales },
    { data: puntosCicloData },
    { data: puntosPiezasData },
    { data: puntosRendimientoData },
    { data: puntosLimpiezaData },
    { data: statsVidaData },
  ] = await Promise.all([
    supabase.from("usuario").select("username, letra").eq("id", usuarioId).single(),
    supabase
      .from("niveles")
      .select("id, nombre, descripcion, color_marco, estrellas, efecto_aura, orden, umbral_min, umbral_max")
      .order("orden", { ascending: true }),
    supabase
      .from("personaje_rpg")
      .select("imagen_url")
      .eq("usuario_id", usuarioId)
      .eq("seleccionada", true)
      .maybeSingle(),
    supabase.from("v_puntos_operario_total_vida").select("puntos_totales").eq("operario_id", usuarioId).maybeSingle(),
    supabase
      .from("v_puntos_operario_ciclo")
      .select("puntos_ciclo")
      .eq("operario_id", usuarioId)
      .eq("cycle_id", ciclo.cycleId)
      .maybeSingle(),
    supabase
      .from("v_puntos_piezas_operario_total_vida")
      .select("puntos_piezas_totales")
      .eq("operario_id", usuarioId)
      .maybeSingle(),
    supabase
      .from("v_puntos_rendimiento_operario_total_vida")
      .select("puntos_rendimiento_totales")
      .eq("operario_id", usuarioId)
      .maybeSingle(),
    supabase
      .from("v_puntos_limpieza_operario_total_vida")
      .select("puntos_limpieza_totales")
      .eq("operario_id", usuarioId)
      .maybeSingle(),
    supabase
      .from("v_stats_vida")
      .select("m2_total_vida, horas_plena_vida")
      .eq("usuario_id", usuarioId)
      .eq("rol", "operario")
      .maybeSingle(),
  ]);

  if (errorUsuario) throw new Error(errorUsuario.message);
  if (errorNiveles) throw new Error(errorNiveles.message);
  if (errorPuntosTotales) throw new Error(errorPuntosTotales.message);

  const niveles = (nivelesData ?? []) as unknown as NivelInfo[];
  if (niveles.length === 0) throw new Error("No hay niveles configurados en la base de datos");

  const puntosTotales = (puntosTotalesData?.puntos_totales as number | undefined) ?? 0;

  let indiceActual = 0;
  for (let i = 0; i < niveles.length; i++) {
    if (puntosTotales >= niveles[i].umbral_min) indiceActual = i;
  }
  const nivelActual = niveles[indiceActual];
  const siguienteNivel = niveles[indiceActual + 1] ?? null;

  return {
    nombreOperario: usuarioFila?.username ?? "",
    grupo: (usuarioFila?.letra as string | null) ?? null,
    avatarUrl: (personajeData?.imagen_url as string | undefined) ?? null,
    nivelActual,
    siguienteNivel,
    puntosTotales,
    puntosCiclo: (puntosCicloData?.puntos_ciclo as number | undefined) ?? 0,
    puntosPiezasTotales: (puntosPiezasData?.puntos_piezas_totales as number | undefined) ?? 0,
    puntosRendimientoTotales: (puntosRendimientoData?.puntos_rendimiento_totales as number | undefined) ?? 0,
    puntosLimpiezaTotales: (puntosLimpiezaData?.puntos_limpieza_totales as number | undefined) ?? 0,
    metrosTotales: (statsVidaData?.m2_total_vida as number | undefined) ?? 0,
    horasPlenaTotales: (statsVidaData?.horas_plena_vida as number | undefined) ?? 0,
  };
}