// frontend/src/lib/chat-acceso.ts
// Control de acceso por rol para los 7 "chats" — sesión 07/09/2026.
// Esquema: 20260907180000_chat_acceso_por_rol.sql. Ausencia de fila
// en chat_acceso = sin acceso (deny-by-default) — al quitar el "ver"
// de un rol, se borra la fila en vez de dejarla con puede_ver=false.

import { supabase } from "./supabase-client";

export type TipoChat =
  | "incidencia_calidad"
  | "incidencia_produccion"
  | "nuevo_lote"
  | "resumen_turno"
  | "resumen_calidad"
  | "general"
  | "ceria";

export const TIPOS_CHAT: TipoChat[] = [
  "incidencia_calidad",
  "incidencia_produccion",
  "nuevo_lote",
  "resumen_turno",
  "resumen_calidad",
  "general",
  "ceria",
];

export const ETIQUETA_CHAT: Record<TipoChat, string> = {
  incidencia_calidad: "Incidencias de calidad",
  incidencia_produccion: "Incidencias de producción",
  nuevo_lote: "Nuevos lotes",
  resumen_turno: "Resumen de turno",
  resumen_calidad: "Resumen de calidad",
  general: "Chat general",
  ceria: "Ceria",
};

/** Solo 'general' distingue ver de escribir — en el resto es un único interruptor (ver = participar). */
export const CHATS_CON_ESCRITURA: TipoChat[] = ["general"];

export type Rol =
  | "responsable"
  | "suplente"
  | "operario"
  | "jefe"
  | "produccion"
  | "calidad"
  | "jefe_rectificado"
  | "administrador";

export const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: "responsable", etiqueta: "Responsable" },
  { valor: "suplente", etiqueta: "Suplente" },
  { valor: "operario", etiqueta: "Operario" },
  { valor: "jefe", etiqueta: "Jefe" },
  { valor: "produccion", etiqueta: "Producción" },
  { valor: "calidad", etiqueta: "Calidad" },
  { valor: "jefe_rectificado", etiqueta: "Jefe rectificado" },
  { valor: "administrador", etiqueta: "Administrador" },
];

export interface AccesoFila {
  tipoChat: TipoChat;
  rol: Rol;
  puedeVer: boolean;
  puedeEscribir: boolean;
}

/** Solo las filas del propio rol — para que un usuario normal sepa qué 7 chats le tocan, sin necesitar leer los de los demás roles. */
export async function listarAccesoPropio(rol: Rol): Promise<{ tipoChat: TipoChat; puedeVer: boolean; puedeEscribir: boolean }[]> {
  const { data, error } = await supabase
    .from("chat_acceso")
    .select("tipo_chat, puede_ver, puede_escribir")
    .eq("rol", rol);
  if (error) throw error;
  return (data ?? []).map((f) => ({
    tipoChat: f.tipo_chat as TipoChat,
    puedeVer: f.puede_ver as boolean,
    puedeEscribir: f.puede_escribir as boolean,
  }));
}

export async function listarAccesos(): Promise<AccesoFila[]> {
  const { data, error } = await supabase.from("chat_acceso").select("tipo_chat, rol, puede_ver, puede_escribir");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    tipoChat: f.tipo_chat as TipoChat,
    rol: f.rol as Rol,
    puedeVer: f.puede_ver as boolean,
    puedeEscribir: f.puede_escribir as boolean,
  }));
}

/** Si puedeVer=false, borra la fila (deny-by-default) en vez de guardarla con puede_ver=false. */
export async function guardarAcceso(
  tipoChat: TipoChat,
  rol: Rol,
  puedeVer: boolean,
  puedeEscribir: boolean,
): Promise<void> {
  if (!puedeVer) {
    const { error } = await supabase.from("chat_acceso").delete().eq("tipo_chat", tipoChat).eq("rol", rol);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("chat_acceso")
    .upsert({ tipo_chat: tipoChat, rol, puede_ver: puedeVer, puede_escribir: puedeEscribir });
  if (error) throw error;
}
