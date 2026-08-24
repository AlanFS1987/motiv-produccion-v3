// frontend/src/lib/ranking.ts
//
// Datos de la pestaña Ranking (sesión de diseño 23/08/2026):
// - Podio (1º-2º-3º) + 4º-5º + "tu posición" si quedas fuera del
//   top 5, con toggle entre el ciclo actual (en vivo) y el anterior
//   (ya cerrado en historial_ciclos).
// - Reyes del formato: histórico (récord absoluto de un solo parte,
//   con empates) y actual (más piezas acumuladas en el ciclo en
//   curso), más "tu marca" en cada uno de los 7 formatos.
//
// El ranking se calcula ordenando en el CLIENTE tras traer todas las
// filas del ciclo — a la escala de una fábrica (decenas de
// operarios, no miles) esto es más simple que replicar un RANK() de
// SQL vía PostgREST, y sigue siendo una única consulta pequeña.

import { supabase } from "./supabase-client";
import { obtenerCicloActual, obtenerCicloAnterior } from "./ciclo";

export interface EntradaPodio {
  operarioId: string;
  username: string;
  avatarUrl: string | null;
  puntos: number;
  posicion: number; // 1-based
}

export interface Podio {
  top5: EntradaPodio[];
  /** Tu propia entrada — siempre presente si tienes puntos ese ciclo, tengas o no lugar en el top5. */
  tuEntrada: EntradaPodio | null;
  /** true si tuEntrada ya está incluida en top5 (para no duplicarla en la UI). */
  tuEntradaEnTop5: boolean;
}

/**
 * Avatar activo de cada usuario (v_avatar_activo_operario, migración
 * 24/08/2026) — se trae en paralelo a los puntos y se cruza en
 * cliente por operarioId, mismo patrón de varias consultas en
 * paralelo que ya usa obtenerReyesDelFormato más abajo en este
 * archivo. Una sola consulta por carga de podio (~30 usuarios como
 * mucho), no una por operario.
 */
async function obtenerAvataresActivos(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("v_avatar_activo_operario").select("usuario_id, imagen_url");
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((f: any) => [f.usuario_id as string, f.imagen_url as string]));
}

function construirPodio(
  filas: { operario_id: string; username: string; puntos: number; avatar_url: string | null }[],
  usuarioId: string,
): Podio {
  const ordenadas = [...filas].sort((a, b) => b.puntos - a.puntos);
  const conPosicion: EntradaPodio[] = ordenadas.map((f, i) => ({
    operarioId: f.operario_id,
    username: f.username,
    avatarUrl: f.avatar_url,
    puntos: f.puntos,
    posicion: i + 1,
  }));
  const top5 = conPosicion.slice(0, 5);
  const tuEntrada = conPosicion.find((e) => e.operarioId === usuarioId) ?? null;
  return {
    top5,
    tuEntrada,
    tuEntradaEnTop5: tuEntrada ? tuEntrada.posicion <= 5 : false,
  };
}

/**
 * Podio del ciclo EN CURSO — v_puntos_operario_ciclo.
 *
 * `username` se pide como columna PLANA, no como relación
 * (`usuario:operario_id(username)`) — v_puntos_operario_ciclo es una
 * VISTA sin foreign key propia, así que PostgREST no puede resolver
 * ese embed (error real visto 24/08/2026: "Could not find a
 * relationship... in the schema cache"). La vista ya expone
 * `username` directamente desde 24/08/2026 — ver migración
 * 20260824130000_fix_v_puntos_operario_ciclo_username.sql.
 */
/** Podio del ciclo EN CURSO — v_puntos_operario_ciclo + avatar (v_avatar_activo_operario). */
export async function obtenerPodioCicloActual(usuarioId: string): Promise<Podio> {
  const ciclo = await obtenerCicloActual();
  const [{ data, error }, avatares] = await Promise.all([
    supabase
      .from("v_puntos_operario_ciclo")
      .select("operario_id, puntos_ciclo, username")
      .eq("cycle_id", ciclo.cycleId),
    obtenerAvataresActivos(),
  ]);
  if (error) throw new Error(error.message);

  const filas = (data ?? []).map((f: any) => ({
    operario_id: f.operario_id,
    username: f.username ?? "—",
    avatar_url: avatares.get(f.operario_id as string) ?? null,
    puntos: f.puntos_ciclo ?? 0,
  }));
  return construirPodio(filas, usuarioId);
}

/** Podio del ciclo ANTERIOR (ya cerrado) — historial_ciclos + avatar (v_avatar_activo_operario). */
export async function obtenerPodioCicloAnterior(usuarioId: string): Promise<Podio> {
  const ciclo = await obtenerCicloAnterior();
  const [{ data, error }, avatares] = await Promise.all([
    supabase
      .from("historial_ciclos")
      .select("usuario_id, puntos_ciclo, usuario:usuario_id(username)")
      .eq("cycle_id", ciclo.cycleId)
      .eq("rol", "operario"),
    obtenerAvataresActivos(),
  ]);
  if (error) throw new Error(error.message);

  const filas = (data ?? []).map((f: any) => ({
    operario_id: f.usuario_id,
    username: (Array.isArray(f.usuario) ? f.usuario[0]?.username : f.usuario?.username) ?? "—",
    avatar_url: avatares.get(f.usuario_id as string) ?? null,
    puntos: f.puntos_ciclo ?? 0,
  }));
  return construirPodio(filas, usuarioId);
}

// ---------------------------------------------------------------
// Reyes del formato
// ---------------------------------------------------------------

export interface ReyFormato {
  operarioId: string | null;
  username: string;
  piezas: number;
  fecha?: string; // solo en histórico
  turnoTipo?: string;
  lineaNombre?: string;
}

export interface FormatoRanking {
  formato: string;
  reyesHistorico: ReyFormato[]; // varios si hay empate
  reyesActual: ReyFormato[];
  tuMejorParte: number | null; // histórico
  tuPiezasActual: number | null; // ciclo en curso
}

export async function obtenerReyesDelFormato(usuarioId: string): Promise<FormatoRanking[]> {
  const ciclo = await obtenerCicloActual();

  const [
    { data: historicoData, error: errorHistorico },
    { data: actualData, error: errorActual },
    { data: miMejorData, error: errorMiMejor },
    { data: miActualData, error: errorMiActual },
    { data: formatosData, error: errorFormatos },
  ] = await Promise.all([
    supabase.from("v_rey_formato_historico").select("formato, operario_id, operario_username, piezas_entradas, fecha, turno_tipo, linea_nombre"),
    supabase.from("v_rey_formato_actual").select("formato, operario_id, operario_username, piezas_formato"),
    supabase.from("v_mi_mejor_parte_por_formato").select("formato, mejor_parte").eq("operario_id", usuarioId),
    supabase.from("v_piezas_operario_formato_ciclo").select("formato, piezas_formato").eq("operario_id", usuarioId).eq("cycle_id", ciclo.cycleId),
    supabase.from("formato").select("nombre").order("nombre"),
  ]);

  if (errorHistorico) throw new Error(errorHistorico.message);
  if (errorActual) throw new Error(errorActual.message);
  if (errorMiMejor) throw new Error(errorMiMejor.message);
  if (errorMiActual) throw new Error(errorMiActual.message);
  if (errorFormatos) throw new Error(errorFormatos.message);

  const mejorPorFormato = new Map<string, number>((miMejorData ?? []).map((f: any) => [f.formato, f.mejor_parte]));
  const actualPorFormato = new Map<string, number>((miActualData ?? []).map((f: any) => [f.formato, f.piezas_formato]));

  return (formatosData ?? []).map((f: any) => {
    const formato = f.nombre as string;
    const reyesHistorico = (historicoData ?? [])
      .filter((h: any) => h.formato === formato)
      .map((h: any) => ({
        operarioId: h.operario_id,
        username: h.operario_username ?? "—",
        piezas: h.piezas_entradas,
        fecha: h.fecha,
        turnoTipo: h.turno_tipo,
        lineaNombre: h.linea_nombre,
      }));
    const reyesActual = (actualData ?? [])
      .filter((a: any) => a.formato === formato)
      .map((a: any) => ({
        operarioId: a.operario_id,
        username: a.operario_username ?? "—",
        piezas: a.piezas_formato,
      }));

    return {
      formato,
      reyesHistorico,
      reyesActual,
      tuMejorParte: mejorPorFormato.get(formato) ?? null,
      tuPiezasActual: actualPorFormato.get(formato) ?? null,
    };
  });
}