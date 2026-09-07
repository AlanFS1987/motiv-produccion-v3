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
export function suscribirseAChat(onCambio: (m: MensajeChat) => void): () => void {
  const canal = supabase
    .channel("chat-mensajes-realtime")
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
