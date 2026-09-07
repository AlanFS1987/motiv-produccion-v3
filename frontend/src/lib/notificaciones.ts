// frontend/src/lib/notificaciones.ts
// Rediseño 07/09/2026 — notificaciones organizadas como canales por
// tipo (comportamiento de Telegram: lista de chats -> entras en uno
// -> historial completo), no como un feed único plano.
// Esquema: 20260907170000_notificaciones_canal_por_tipo_esquema.sql.
// El contenido completo de cada notificación lo escriben las Edge
// Functions (notificar-telegram, generar-resumen-turno,
// notificar-telegram-resumen-calidad) — esta capa solo lee/organiza.

import { supabase } from "./supabase-client";

export type TipoNotificacion =
  | "incidencia_calidad"
  | "incidencia_produccion"
  | "nuevo_lote"
  | "resumen_turno"
  | "resumen_calidad";

export const TIPOS: TipoNotificacion[] = [
  "incidencia_calidad",
  "incidencia_produccion",
  "nuevo_lote",
  "resumen_turno",
  "resumen_calidad",
];

export const ETIQUETA_TIPO: Record<TipoNotificacion, string> = {
  incidencia_calidad: "Incidencias de calidad",
  incidencia_produccion: "Incidencias de producción",
  nuevo_lote: "Nuevos lotes",
  resumen_turno: "Resumen de turno",
  resumen_calidad: "Resumen de calidad",
};

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string | null;
  referenciaId: string | null;
  createdAt: string;
}

export interface ResumenCanal {
  tipo: TipoNotificacion;
  ultimoTitulo: string | null;
  ultimaFecha: string | null;
  noLeidas: number;
}

const MAX_POR_CANAL = 100;

// deno-lint-ignore no-explicit-any
function mapearNotificacion(fila: any): Notificacion {
  return {
    id: fila.id,
    tipo: fila.tipo,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    referenciaId: fila.referencia_id,
    createdAt: fila.created_at,
  };
}

async function obtenerUltimaLeidaMapa(usuarioId: string): Promise<Map<TipoNotificacion, string>> {
  const { data, error } = await supabase
    .from("notificacion_estado_usuario")
    .select("tipo, ultima_leida_at")
    .eq("usuario_id", usuarioId);
  if (error) throw error;
  return new Map((data ?? []).map((f) => [f.tipo as TipoNotificacion, f.ultima_leida_at as string]));
}

/** Un resumen por cada uno de los 5 canales (último mensaje + no-leídas) — para el modo lista de la campana. */
export async function obtenerResumenCanales(usuarioId: string): Promise<ResumenCanal[]> {
  const mapaLeidas = await obtenerUltimaLeidaMapa(usuarioId);

  return Promise.all(
    TIPOS.map(async (tipo) => {
      const ultimaLeidaAt = mapaLeidas.get(tipo) ?? null;

      const { data: ultimaFila } = await supabase
        .from("notificaciones")
        .select("titulo, created_at")
        .eq("tipo", tipo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let query = supabase.from("notificaciones").select("id", { count: "exact", head: true }).eq("tipo", tipo);
      if (ultimaLeidaAt) query = query.gt("created_at", ultimaLeidaAt);
      const { count } = await query;

      return {
        tipo,
        ultimoTitulo: ultimaFila?.titulo ?? null,
        ultimaFecha: ultimaFila?.created_at ?? null,
        noLeidas: count ?? 0,
      };
    }),
  );
}

/** Historial completo de un canal, orden cronológico ascendente (como cualquier chat). */
export async function listarNotificacionesPorTipo(tipo: TipoNotificacion): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, cuerpo, referencia_id, created_at")
    .eq("tipo", tipo)
    .order("created_at", { ascending: false })
    .limit(MAX_POR_CANAL);

  if (error) throw error;
  return (data ?? []).reverse().map(mapearNotificacion);
}

/** Marca un canal concreto como leído hasta ahora — no afecta a los otros 4. */
export async function marcarCanalLeido(usuarioId: string, tipo: TipoNotificacion): Promise<void> {
  const { error } = await supabase
    .from("notificacion_estado_usuario")
    .upsert({ usuario_id: usuarioId, tipo, ultima_leida_at: new Date().toISOString() });
  if (error) throw error;
}

// -------------------------------------------------------------
// Preferencias por tipo (Fase 7, push) y horario de silencio — sin
// cambios respecto a la versión anterior.
// -------------------------------------------------------------
export async function obtenerPreferencias(usuarioId: string): Promise<Record<TipoNotificacion, boolean>> {
  const { data, error } = await supabase
    .from("notificacion_preferencias")
    .select("tipo, push_activo")
    .eq("usuario_id", usuarioId);
  if (error) throw error;

  const base: Record<TipoNotificacion, boolean> = {
    incidencia_calidad: true,
    incidencia_produccion: true,
    nuevo_lote: true,
    resumen_turno: true,
    resumen_calidad: true,
  };
  for (const fila of data ?? []) base[fila.tipo as TipoNotificacion] = fila.push_activo;
  return base;
}

export async function guardarPreferencia(usuarioId: string, tipo: TipoNotificacion, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from("notificacion_preferencias")
    .upsert({ usuario_id: usuarioId, tipo, push_activo: activo });
  if (error) throw error;
}

export interface SilencioHorario {
  activo: boolean;
  horaInicio: string;
  horaFin: string;
}

const SILENCIO_DEFECTO: SilencioHorario = { activo: false, horaInicio: "22:00", horaFin: "07:00" };

export async function obtenerSilencio(usuarioId: string): Promise<SilencioHorario> {
  const { data, error } = await supabase
    .from("notificacion_silencio")
    .select("activo, hora_inicio, hora_fin")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return SILENCIO_DEFECTO;
  return {
    activo: data.activo,
    horaInicio: (data.hora_inicio as string).slice(0, 5),
    horaFin: (data.hora_fin as string).slice(0, 5),
  };
}

export async function guardarSilencio(usuarioId: string, silencio: SilencioHorario): Promise<void> {
  const { error } = await supabase.from("notificacion_silencio").upsert({
    usuario_id: usuarioId,
    activo: silencio.activo,
    hora_inicio: silencio.horaInicio,
    hora_fin: silencio.horaFin,
  });
  if (error) throw error;
}

// -------------------------------------------------------------
// Realtime
// -------------------------------------------------------------
export function suscribirseANotificaciones(onNueva: (n: Notificacion) => void): () => void {
  const canal = supabase
    .channel("notificaciones-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificaciones" },
      // deno-lint-ignore no-explicit-any
      (payload: any) => onNueva(mapearNotificacion(payload.new)),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}