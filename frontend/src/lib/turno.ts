import { supabase } from "./supabase-client";
import type { TipoTurno } from "./rotacion";

export interface Linea {
  id: string;
  nombre: string;
}

export interface OperarioParaAsignar {
  id: string;
  username: string;
  letra: "A" | "B" | "C" | "D" | null;
}

export interface Asignacion {
  id: string;
  linea_id: string;
  operario_id: string;
}

/** Las 6 líneas fijas del catálogo. */
export async function listarLineas(): Promise<Linea[]> {
  const { data, error } = await supabase.from("linea").select("id, nombre").order("nombre");
  if (error) throw error;
  return data as Linea[];
}

/**
 * Operarios para el desplegable de asignación de línea: su grupo
 * habitual (misma letra que el responsable) + quien ya esté marcado
 * como refuerzo de ESTE turno (ver refuerzo_operario_turno, sesión
 * 19/08/2026).
 *
 * REVISADO (sesión 19/08/2026): antes traía "su grupo primero, luego
 * TODOS los demás operarios" — eso permitía asignar a una línea a
 * cualquier operario de cualquier letra sin ningún registro previo de
 * que estuviera presente ese turno. Ahora solo hay 2 caminos de
 * pertenencia a un turno: ser de la letra que toca, o estar dado de
 * alta como refuerzo. Un operario de otra letra que el responsable
 * quiera poner en una línea debe darse de alta antes en "Operarios de
 * refuerzo" — deja de aparecer aquí directamente.
 */
export async function listarOperariosParaAsignar(
  letraResponsable: string | null,
  turnoId: string,
): Promise<OperarioParaAsignar[]> {
  const [{ data: todos, error: errTodos }, refuerzos] = await Promise.all([
    supabase.from("usuario").select("id, username, letra").eq("rol", "operario").order("username"),
    listarRefuerzos(turnoId),
  ]);
  if (errTodos) throw errTodos;

  const operarios = todos as OperarioParaAsignar[];
  const idsRefuerzo = new Set(refuerzos.map((r) => r.id));

  const disponibles = operarios.filter((o) => o.letra === letraResponsable || idsRefuerzo.has(o.id));

  if (!letraResponsable) return disponibles;

  // Su grupo primero, refuerzo después — mismo criterio visual que
  // antes, ahora sobre un conjunto más pequeño.
  const mismaLetra = disponibles.filter((o) => o.letra === letraResponsable);
  const refuerzo = disponibles.filter((o) => o.letra !== letraResponsable);
  return [...mismaLetra, ...refuerzo];
}

/**
 * Candidatos para el desplegable de "Operarios de refuerzo" (sesión
 * 19/08/2026) — cualquier operario que NO sea de la letra del
 * responsable (los de su letra ya pertenecen al turno sin necesidad
 * de refuerzo).
 */
export async function listarOperariosOtrasLetras(letraResponsable: string | null): Promise<OperarioParaAsignar[]> {
  let query = supabase.from("usuario").select("id, username, letra").eq("rol", "operario").order("username");
  if (letraResponsable) {
    query = query.neq("letra", letraResponsable);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as OperarioParaAsignar[];
}

/** Operarios actualmente marcados como refuerzo de este turno. */
export async function listarRefuerzos(turnoId: string): Promise<OperarioParaAsignar[]> {
  const { data, error } = await supabase
    .from("refuerzo_operario_turno")
    .select("operario:operario_id ( id, username, letra )")
    .eq("turno_id", turnoId);
  if (error) throw error;

  return ((data ?? []) as any[])
    .map((fila) => (Array.isArray(fila.operario) ? fila.operario[0] : fila.operario))
    .filter(Boolean) as OperarioParaAsignar[];
}

/** Da de alta a un operario como refuerzo de este turno (idempotente — UNIQUE(turno_id, operario_id)). */
export async function marcarRefuerzo(turnoId: string, operarioId: string, habilitadoPor: string): Promise<void> {
  const { error } = await supabase
    .from("refuerzo_operario_turno")
    .upsert({ turno_id: turnoId, operario_id: operarioId, habilitado_por: habilitadoPor }, { onConflict: "turno_id,operario_id" });
  if (error) throw error;
}

/**
 * Quita a un operario de refuerzo. Deliberadamente NO comprueba si
 * sigue asignado a alguna línea de este turno — si el responsable lo
 * quita de refuerzo teniendo todavía una línea asignada, esa
 * asignación queda "huérfana" (el operario deja de aparecer en el
 * desplegable, pero la fila de asignacion_operario_linea sigue
 * existiendo). Aceptable: es responsabilidad del responsable quitar
 * primero la línea si corresponde: no se automatiza para no borrar
 * datos de producción ya escritos sin que el responsable lo pida
 * explícitamente.
 */
export async function quitarRefuerzo(turnoId: string, operarioId: string): Promise<void> {
  const { error } = await supabase
    .from("refuerzo_operario_turno")
    .delete()
    .eq("turno_id", turnoId)
    .eq("operario_id", operarioId);
  if (error) throw error;
}

/** ¿Este operario está marcado como refuerzo de este turno? — usado por OperarioApp para resolver pertenencia. */
export async function esRefuerzo(turnoId: string, operarioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("refuerzo_operario_turno")
    .select("id")
    .eq("turno_id", turnoId)
    .eq("operario_id", operarioId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Busca el turno de (fecha, tipo). Si no existe, lo crea con
 * abierto_por = usuario actual. Es idempotente: si dos personas
 * (titular + suplente relevándose) llaman a esto casi a la vez, la
 * unicidad de turno no está forzada por constraint en BD más allá de
 * unique(fecha, tipo) — ese unique ya evita duplicados; si la
 * creación choca, simplemente se relee la fila ya creada por la otra.
 */
export async function obtenerOCrearTurno(
  fecha: string,
  tipo: TipoTurno,
  abiertoPor: string,
): Promise<{ id: string; cerrado_at: string | null }> {
  const { data: existente, error: selError } = await supabase
    .from("turno")
    .select("id, cerrado_at")
    .eq("fecha", fecha)
    .eq("tipo", tipo)
    .maybeSingle();
  if (selError) throw selError;
  if (existente) return existente;

  const { data: nuevo, error: insError } = await supabase
    .from("turno")
    .insert({ fecha, tipo, abierto_por: abiertoPor })
    .select("id, cerrado_at")
    .single();

  if (insError) {
    // Carrera con otra apertura simultánea (unique(fecha,tipo)) — se
    // relee en vez de fallar, el turno ya existe igualmente.
    const { data: reintento, error: reintentoError } = await supabase
      .from("turno")
      .select("id, cerrado_at")
      .eq("fecha", fecha)
      .eq("tipo", tipo)
      .single();
    if (reintentoError) throw insError;
    return reintento;
  }

  return nuevo;
}

export async function listarAsignaciones(turnoId: string): Promise<Asignacion[]> {
  const { data, error } = await supabase
    .from("asignacion_operario_linea")
    .select("id, linea_id, operario_id")
    .eq("turno_id", turnoId);
  if (error) throw error;
  return data as Asignacion[];
}

/**
 * Asigna (o reasigna) un operario a una línea de este turno. `null`
 * en operarioId retira la asignación (línea fuera de producción).
 */
export async function asignarOperario(
  turnoId: string,
  lineaId: string,
  operarioId: string | null,
): Promise<void> {
  if (operarioId === null) {
    const { error } = await supabase
      .from("asignacion_operario_linea")
      .delete()
      .eq("turno_id", turnoId)
      .eq("linea_id", lineaId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("asignacion_operario_linea")
    .upsert(
      { turno_id: turnoId, linea_id: lineaId, operario_id: operarioId },
      { onConflict: "turno_id,linea_id" },
    );
  if (error) throw error;
}

/**
 * Cierre manual anticipado del turno (01-rol-responsable.md 3.1).
 * Escribe `cerrado_at`/`como_cerro='manual'` — ese UPDATE es lo único
 * que hace falta: dispara solo el envío del resumen a Telegram, vía
 * el trigger `trg_turno_resumen_cierre`
 * (20260816230000_resumen_turno_automatico.sql), no esta función. El
 * resto del estado (`Abierto`/`En revisión`/`Cerrado`) sigue
 * calculándose, nunca se guarda a mano salvo este momento concreto de
 * cierre (11-esquema-supabase.md 13.2).
 *
 * `is("cerrado_at", null)` en el filtro evita pisar un cierre ya
 * registrado (ej. doble clic, o dos pestañas abiertas del mismo
 * turno, o que el cron automático ya lo haya marcado un segundo
 * antes) — si la fila ya estaba cerrada, esto no hace nada y no es un
 * error, simplemente no afecta ninguna fila.
 */
export async function cerrarTurnoManualmente(turnoId: string): Promise<void> {
  const { error } = await supabase
    .from("turno")
    .update({ cerrado_at: new Date().toISOString(), como_cerro: "manual" })
    .eq("id", turnoId)
    .is("cerrado_at", null);
  if (error) throw error;
}