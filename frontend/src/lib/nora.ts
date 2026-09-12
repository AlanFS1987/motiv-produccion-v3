// frontend/src/lib/nora.ts
//
// Capa mínima para el experimento de NORA (voz, Realtime API de
// OpenAI) — ver memorias/16-copiloto-averias.md. Solo dos llamadas a
// la Edge Function `nora`: pedir el token efímero de sesión (que
// además trae TODA la configuración de comportamiento -- prompt, voz,
// sensibilidad al detectar turnos --, para no tener que tocar el
// frontend cuando se ajuste algo de eso), y la tool que el modelo
// llama durante la conversación para traer documentación de una
// submáquina. Sin logging todavía — el primer paso es solo comprobar
// si la latencia y la calidad de diagnóstico convencen, antes de
// construir el resto (esquema de conversaciones, pantalla definitiva,
// integración en chat_acceso/pestaña Chat).

import { supabase } from "./supabase-client";

export interface TokenNora {
  clientSecret: string;
  modelo: string;
  instrucciones: string;
  audioConfig: Record<string, unknown>;
}

export async function obtenerTokenNora(): Promise<TokenNora> {
  const { data, error } = await supabase.functions.invoke("nora", {
    body: { accion: "token" },
  });
  if (error) throw new Error(error.message ?? "No se pudo obtener el token de NORA");
  if (!data?.ok) throw new Error(data?.error ?? "No se pudo obtener el token de NORA");
  return {
    clientSecret: data.client_secret,
    modelo: data.modelo,
    instrucciones: data.instrucciones,
    audioConfig: data.audioConfig,
  };
}

export async function obtenerDocumentacionNora(maquina: string, submaquina: string | null): Promise<string> {
  const { data, error } = await supabase.functions.invoke("nora", {
    body: { accion: "documentacion", maquina, submaquina },
  });
  if (error) throw new Error(error.message ?? "Error consultando documentación");
  if (!data?.ok) throw new Error(data?.error ?? "Error consultando documentación");
  return data.contenido as string;
}