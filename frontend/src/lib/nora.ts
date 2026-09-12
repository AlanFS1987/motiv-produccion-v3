// frontend/src/lib/nora.ts
//
// Capa mínima para el experimento de NORA (voz, Realtime API de
// OpenAI) — ver memorias/16-copiloto-averias.md. Solo dos llamadas a
// la Edge Function `nora`: pedir el token efímero de sesión, y la
// tool que el modelo llama durante la conversación para traer
// documentación de una submáquina. Sin logging todavía — el primer
// paso es solo comprobar si la latencia y la calidad de diagnóstico
// convencen, antes de construir el resto (esquema de conversaciones,
// pantalla definitiva, integración en chat_acceso/pestaña Chat).

import { supabase } from "./supabase-client";

export interface TokenNora {
  clientSecret: string;
  modelo: string;
}

export async function obtenerTokenNora(): Promise<TokenNora> {
  const { data, error } = await supabase.functions.invoke("nora", {
    body: { accion: "token" },
  });
  if (error) throw new Error(error.message ?? "No se pudo obtener el token de NORA");
  if (!data?.ok) throw new Error(data?.error ?? "No se pudo obtener el token de NORA");
  return { clientSecret: data.client_secret, modelo: data.modelo };
}

export async function obtenerDocumentacionNora(maquina: string, submaquina: string | null): Promise<string> {
  const { data, error } = await supabase.functions.invoke("nora", {
    body: { accion: "documentacion", maquina, submaquina },
  });
  if (error) throw new Error(error.message ?? "Error consultando documentación");
  if (!data?.ok) throw new Error(data?.error ?? "Error consultando documentación");
  return data.contenido as string;
}

// Índice de máquinas/submáquinas disponible hoy (ver 11-ceria.md,
// "Documentación de máquinas") — fijo en código para este
// experimento. Cuando se documenten más máquinas (Griffón,
// Qualitron...) o cambie el desglose, actualizar esta lista a mano;
// más adelante puede sustituirse por una consulta real a
// ceria_documentacion_maquina si merece la pena automatizarlo.
export const INDICE_MAQUINAS: Record<string, string[]> = {
  BS08: [
    "Divisor",
    "Escuadrador",
    "Elevador",
    "Sacabandejas",
    "Empujador de bandejas",
    "Mandril",
    "Jaula",
    "Cabezales de impresión",
  ],
};
