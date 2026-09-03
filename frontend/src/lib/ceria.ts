// frontend/src/lib/ceria.ts
// Capa de datos para el chat de Ceria — llama a la Edge Function
// `ceria` (3 fases: elegir herramienta -> ejecutar -> redactar).
// Mismo patrón de manejo de errores que ocrParte en
// lib/supabase-functions.ts: si supabase.functions.invoke trae un
// error con cuerpo JSON legible, se usa ese mensaje en vez del
// genérico de la librería.

import { supabase } from "./supabase-client";

export interface FilaInfoCeria {
  herramienta: string;
  filas: number;
  filas_totales?: number;
  limitado?: boolean;
}

export interface RespuestaCeria {
  respuesta: string;
  tool_usada?: string;
  filas_info?: FilaInfoCeria[];
  conversacion_id: string;
}

/**
 * Carga los mensajes ya guardados de una conversación existente —
 * usado para reconstruir el chat visualmente cuando la pestaña se
 * recarga sola (Chrome "Ahorro de memoria" descarga pestañas
 * inactivas; en móvil el sistema operativo hace lo mismo) y se pierde
 * el estado de React, aunque la conversación siga intacta en BD.
 */
export async function cargarConversacion(
  conversacionId: string,
): Promise<{ role: "user" | "assistant"; contenido: string }[]> {
  const { data, error } = await supabase
    .from("ceria_mensajes")
    .select("role, contenido")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as { role: "user" | "assistant"; contenido: string }[];
}

export interface ConversacionCeria {
  id: string;
  titulo: string;
  created_at: string;
}

/**
 * Lista las conversaciones del jefe logueado, más recientes primero
 * (RLS ya filtra a solo las suyas — no hace falta pasar user_id).
 */
export async function listarConversaciones(): Promise<ConversacionCeria[]> {
  const { data, error } = await supabase
    .from("ceria_conversaciones")
    .select("id, titulo, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as ConversacionCeria[];
}

/** Borra una conversación entera (los mensajes caen en cascada). */
export async function eliminarConversacion(conversacionId: string): Promise<void> {
  const { error } = await supabase.from("ceria_conversaciones").delete().eq("id", conversacionId);
  if (error) throw new Error(error.message);
}
/**
 * Envía una pregunta a Ceria. `conversacionId` es null en el primer
 * mensaje de una conversación nueva — la Edge Function crea una fila
 * en `ceria_conversaciones` y devuelve su id, que hay que reenviar en
 * las siguientes preguntas para mantener el hilo (Ceria reutiliza el
 * historial guardado para no repetir consultas ya hechas).
 */
export async function preguntarCeria(
  pregunta: string,
  conversacionId: string | null,
): Promise<RespuestaCeria> {
  const { data, error } = await supabase.functions.invoke<RespuestaCeria>("ceria", {
    body: { pregunta, conversacion_id: conversacionId },
  });

  if (error) {
    let mensaje = error.message ?? "Error llamando a Ceria";
    try {
      // deno-lint-ignore no-explicit-any
      const cuerpo = await (error as any).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      // sin cuerpo JSON legible, nos quedamos con error.message
    }
    throw new Error(mensaje);
  }

  return data as RespuestaCeria;
}