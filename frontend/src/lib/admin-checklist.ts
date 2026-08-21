// frontend/src/lib/admin-checklist.ts
// Activar/desactivar ítems de limpieza y ajustar sus puntos
// (09-administrador.md). Tabla ya sembrada con 6 filas; esto solo
// gestiona lo que ya existe, sin alta/baja de ítems.

import { supabase } from "./supabase-client";

export interface ChecklistItem {
  id: string;
  nombre: string;
  puntos: number;
  activo: boolean;
}

export async function obtenerChecklistItems(): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("id, nombre, puntos, activo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function actualizarPuntosItem(id: string, puntos: number): Promise<void> {
  const { error } = await supabase.from("checklist_items").update({ puntos }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function actualizarActivoItem(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("checklist_items").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
}