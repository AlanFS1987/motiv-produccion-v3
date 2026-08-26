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
  /** Partes completados (operario) o turnos trabajados (responsable). */
  cantidad: number;
  /** puntos / cantidad — null si cantidad es 0 (evita división por cero). */
  ptsPromedio: number | null;
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

async function obtenerUsernames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("usuario").select("id, username").in("id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((u: any) => [u.id as string, u.username as string]));
}

function construirPodio(
  filas: { operario_id: string; username: string; puntos: number; avatar_url: string | null; cantidad: number }[],
  usuarioId: string,
): Podio {
  const ordenadas = [...filas].sort((a, b) => b.puntos - a.puntos);
  const conPosicion: EntradaPodio[] = ordenadas.map((f, i) => ({
    operarioId: f.operario_id,
    username: f.username,
    avatarUrl: f.avatar_url,
    puntos: f.puntos,
    posicion: i + 1,
    cantidad: f.cantidad,
    ptsPromedio: f.cantidad > 0 ? f.puntos / f.cantidad : null,
  }));
  const top5 = conPosicion.slice(0, 5);
  const tuEntrada = conPosicion.find((e) => e.operarioId === usuarioId) ?? null;
  return {
    top5,
    tuEntrada,
    tuEntradaEnTop5: tuEntrada ? tuEntrada.posicion <= 5 : false,
  };
}

/** Podio del ciclo EN CURSO — v_puntos_operario_ciclo + v_partes_operario_ciclo + avatar. */
export async function obtenerPodioCicloActual(usuarioId: string): Promise<Podio> {
  const ciclo = await obtenerCicloActual();
  const [{ data, error }, { data: partesData, error: errorPartes }, avatares] = await Promise.all([
    supabase
      .from("v_puntos_operario_ciclo")
      .select("operario_id, puntos_ciclo, username")
      .eq("cycle_id", ciclo.cycleId),
    supabase.from("v_partes_operario_ciclo").select("operario_id, partes_completados").eq("cycle_id", ciclo.cycleId),
    obtenerAvataresActivos(),
  ]);
  if (error) throw new Error(error.message);
  if (errorPartes) throw new Error(errorPartes.message);

  const partesPorOperario = new Map((partesData ?? []).map((p: any) => [p.operario_id as string, p.partes_completados as number]));

  const filas = (data ?? []).map((f: any) => ({
    operario_id: f.operario_id,
    username: f.username ?? "—",
    avatar_url: avatares.get(f.operario_id as string) ?? null,
    puntos: f.puntos_ciclo ?? 0,
    cantidad: partesPorOperario.get(f.operario_id as string) ?? 0,
  }));
  return construirPodio(filas, usuarioId);
}

/** Podio del ciclo ANTERIOR (ya cerrado) — historial_ciclos (incluye partes_completados) + avatar. */
export async function obtenerPodioCicloAnterior(usuarioId: string): Promise<Podio> {
  const ciclo = await obtenerCicloAnterior();
  const [{ data, error }, avatares] = await Promise.all([
    supabase
      .from("historial_ciclos")
      .select("usuario_id, puntos_ciclo, partes_completados, usuario:usuario_id(username)")
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
    cantidad: f.partes_completados ?? 0,
  }));
  return construirPodio(filas, usuarioId);
}

// ---------------------------------------------------------------
// RESPONSABLE — Ranking de responsables (sub-vista de Progreso,
// sesión 25/08/2026). Reutiliza EntradaPodio/Podio/construirPodio
// tal cual. "cantidad" aquí es turnos_trabajados, no partes. Sin
// Reyes del formato: el responsable no tiene desglose por formato.
// ---------------------------------------------------------------

export async function obtenerPodioResponsablesCicloActual(usuarioId: string): Promise<Podio> {
  const ciclo = await obtenerCicloActual();
  const [{ data, error }, { data: turnosData, error: errorTurnos }] = await Promise.all([
    supabase
      .from("v_puntos_responsable_ciclo")
      .select("responsable_id, puntos_ciclo")
      .eq("cycle_id", ciclo.cycleId),
    supabase.from("v_turnos_responsable_ciclo").select("responsable_id, turnos_trabajados").eq("cycle_id", ciclo.cycleId),
  ]);
  if (error) throw new Error(error.message);
  if (errorTurnos) throw new Error(errorTurnos.message);

  const filas = data ?? [];
  const ids = filas.map((f: any) => f.responsable_id as string);
  const [avatares, usernames] = await Promise.all([obtenerAvataresActivos(), obtenerUsernames(ids)]);
  const turnosPorResponsable = new Map((turnosData ?? []).map((t: any) => [t.responsable_id as string, t.turnos_trabajados as number]));

  const construidas = filas.map((f: any) => ({
    operario_id: f.responsable_id as string,
    username: usernames.get(f.responsable_id as string) ?? "",
    puntos: f.puntos_ciclo as number,
    avatar_url: avatares.get(f.responsable_id as string) ?? null,
    cantidad: turnosPorResponsable.get(f.responsable_id as string) ?? 0,
  }));
  return construirPodio(construidas, usuarioId);
}

export async function obtenerPodioResponsablesCicloAnterior(usuarioId: string): Promise<Podio> {
  const ciclo = await obtenerCicloAnterior();
  const { data, error } = await supabase
    .from("historial_ciclo_responsable")
    .select("usuario_id, puntos_ciclo, turnos_trabajados")
    .eq("cycle_id", ciclo.cycleId);
  if (error) throw new Error(error.message);

  const filas = data ?? [];
  const ids = filas.map((f: any) => f.usuario_id as string);
  const [avatares, usernames] = await Promise.all([obtenerAvataresActivos(), obtenerUsernames(ids)]);

  const construidas = filas.map((f: any) => ({
    operario_id: f.usuario_id as string,
    username: usernames.get(f.usuario_id as string) ?? "",
    puntos: f.puntos_ciclo as number,
    avatar_url: avatares.get(f.usuario_id as string) ?? null,
    cantidad: f.turnos_trabajados ?? 0,
  }));
  return construirPodio(construidas, usuarioId);
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