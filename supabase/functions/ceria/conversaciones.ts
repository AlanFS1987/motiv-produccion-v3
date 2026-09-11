// supabase/functions/ceria/conversaciones.ts
//
// Persistencia de conversaciones y mensajes de Ceria
// (ceria_conversaciones, ceria_mensajes) — creación, guardado, y
// carga del historial ya "limpio" en el formato genérico
// { role, content } que consumen Fase 1 y Fase 3.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function crearConversacion(
  userId: string,
  primerMensaje: string,
  supabase: SupabaseClient,
): Promise<string> {
  const titulo = primerMensaje.length <= 60 ? primerMensaje : primerMensaje.slice(0, 57) + "...";
  const { data, error } = await supabase
    .from("ceria_conversaciones")
    .insert({ user_id: userId, titulo })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear la conversación: ${error?.message}`);
  return data.id as string;
}

export async function guardarMensaje(
  conversacionId: string,
  role: "user" | "assistant",
  contenido: string,
  toolUsada: string | null,
  supabase: SupabaseClient,
  datos: unknown = null,
): Promise<void> {
  const { error } = await supabase
    .from("ceria_mensajes")
    .insert({ conversacion_id: conversacionId, role, contenido, tool_usada: toolUsada, datos });
  if (error) console.error(`[ceria] error guardando mensaje (${role}):`, error);
}

export async function cargarHistorial(
  conversacionId: string,
  supabase: SupabaseClient,
): Promise<{ role: string; content: string }[]> {
  const { data, error } = await supabase
    .from("ceria_mensajes")
    .select("role, contenido, tool_usada, datos")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error || !data) return [];
  return data.map((m) => {
    if (m.role === "assistant" && m.datos) {
      return {
        role: m.role,
        content: `${m.contenido}\n\n[DATOS_DISPONIBLES:${m.tool_usada}]\n${JSON.stringify(m.datos)}\n[/DATOS_DISPONIBLES]`,
      };
    }
    return { role: m.role, content: m.contenido as string };
  });
}
