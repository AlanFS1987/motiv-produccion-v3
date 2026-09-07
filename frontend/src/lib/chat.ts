// frontend/src/lib/chat.ts
// Fase 5 — capa de datos del canal de chat único.
// Esquema y RLS: 20260907150000_chat_esquema_rls_fase4.sql.

import { supabase } from "./supabase-client";

export interface MensajeChat {
  id: string;
  usuarioId: string;
  username: string;
  texto: string | null;
  fotos: string[] | null;
  createdAt: string;
  eliminado: boolean;
}

const MAX_MENSAJES = 50;

// Mapa id->username de todos los usuarios conocidos. Se carga una
// vez y se reutiliza para resolver el autor de los mensajes que
// llegan por Realtime (el payload de postgres_changes trae la fila
// cruda, sin el join que sí hace la carga inicial).
let cacheUsuarios: Map<string, string> | null = null;

async function obtenerMapaUsuarios(forzarRefresco = false): Promise<Map<string, string>> {
  if (cacheUsuarios && !forzarRefresco) return cacheUsuarios;
  const { data, error } = await supabase.from("usuario").select("id, username");
  if (error) throw error;
  cacheUsuarios = new Map((data ?? []).map((u) => [u.id as string, u.username as string]));
  return cacheUsuarios;
}

async function resolverUsername(usuarioId: string): Promise<string> {
  let mapa = await obtenerMapaUsuarios();
  if (!mapa.has(usuarioId)) {
    // Puede ser un usuario dado de alta después de cargar la caché —
    // se refresca una vez antes de rendirse.
    mapa = await obtenerMapaUsuarios(true);
  }
  return mapa.get(usuarioId) ?? "—";
}

// deno-lint-ignore no-explicit-any
async function mapearFila(fila: any): Promise<MensajeChat> {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    username: await resolverUsername(fila.usuario_id),
    texto: fila.texto,
    fotos: fila.fotos,
    createdAt: fila.created_at,
    eliminado: fila.eliminado,
  };
}

/** Últimos mensajes, orden cronológico ascendente (el más reciente al final, como cualquier chat). */
export async function listarMensajesRecientes(): Promise<MensajeChat[]> {
  await obtenerMapaUsuarios(); // precarga una vez, evita 1 consulta por fila al mapear
  const { data, error } = await supabase
    .from("chat_mensajes")
    .select("id, usuario_id, texto, fotos, created_at, eliminado")
    .order("created_at", { ascending: false })
    .limit(MAX_MENSAJES);

  if (error) throw error;
  const filas = (data ?? []).reverse();
  return Promise.all(filas.map(mapearFila));
}

/** Un mensaje necesita texto o fotos (mismo check que la BD) — se valida también aquí para no depender solo del error de Postgres. */
export async function enviarMensaje(usuarioId: string, texto: string | null, fotos: string[] | null): Promise<void> {
  const textoLimpio = texto?.trim() ? texto.trim() : null;
  const fotosLimpias = fotos && fotos.length > 0 ? fotos : null;
  if (!textoLimpio && !fotosLimpias) return;

  const { error } = await supabase.from("chat_mensajes").insert({
    usuario_id: usuarioId,
    texto: textoLimpio,
    fotos: fotosLimpias,
  });
  if (error) throw error;
}

/** Borrado suave — la política RLS ya exige ser el autor o administrador. */
export async function borrarMensaje(id: string, usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_mensajes")
    .update({ eliminado: true, borrado_por: usuarioId, borrado_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** INSERT (mensaje nuevo) y UPDATE (borrado suave) del mismo canal — el llamador decide qué hacer con cada uno mirando `eliminado`. */
/**
 * Reutiliza notificacion_estado_usuario con tipo='general' — misma
 * mecánica de "último leído" que los 5 canales automáticos, aplicada
 * al chat humano para que la lista maestra pueda mostrarle también
 * un contador de no-leídas. La columna `tipo` de esa tabla es texto
 * libre, no una enumeración cerrada, así que no hace falta tocar
 * esquema para esto.
 */
export async function obtenerEstadoGeneral(
  usuarioId: string,
): Promise<{ noLeidas: number; ultimoTexto: string | null; ultimaFecha: string | null }> {
  const { data: estado } = await supabase
    .from("notificacion_estado_usuario")
    .select("ultima_leida_at")
    .eq("usuario_id", usuarioId)
    .eq("tipo", "general")
    .maybeSingle();
  const ultimaLeidaAt = estado?.ultima_leida_at ?? null;

  const { data: ultimaFila } = await supabase
    .from("chat_mensajes")
    .select("texto, fotos, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase.from("chat_mensajes").select("id", { count: "exact", head: true });
  if (ultimaLeidaAt) query = query.gt("created_at", ultimaLeidaAt);
  const { count } = await query;

  return {
    noLeidas: count ?? 0,
    ultimoTexto: ultimaFila ? (ultimaFila.texto ?? (ultimaFila.fotos?.length ? "📷 Foto" : null)) : null,
    ultimaFecha: ultimaFila?.created_at ?? null,
  };
}

export async function marcarGeneralLeido(usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from("notificacion_estado_usuario")
    .upsert({ usuario_id: usuarioId, tipo: "general", ultima_leida_at: new Date().toISOString() });
  if (error) throw error;
}

let contadorCanalChat = 0;

// Mismo motivo que en notificaciones.ts: puede haber dos activas a
// la vez (la lista de Chat y la pantalla del chat general abierta al
// mismo tiempo).
export function suscribirseAChat(onCambio: (m: MensajeChat) => void): () => void {
  const canal = supabase
    .channel(`chat-mensajes-realtime-${contadorCanalChat++}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_mensajes" },
      // deno-lint-ignore no-explicit-any
      async (payload: any) => {
        if (!payload.new) return;
        onCambio(await mapearFila(payload.new));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
