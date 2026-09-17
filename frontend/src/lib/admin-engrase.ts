// frontend/src/lib/admin-engrase.ts
//
// Gestión de la checklist de engrase (17-rol-mecanico-plan.md, bloque
// 4) — "editable, solo por el admin". Baja lógica (`activo`), nunca
// DELETE de verdad: un punto desactivado no debe romper los partes de
// engrase antiguos que lo referencian (06-esquema-bd.md).

import { supabase } from "./supabase-client";

export interface PuntoEngraseAdmin {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export async function listarPuntosEngraseAdmin(): Promise<PuntoEngraseAdmin[]> {
  const { data, error } = await supabase.from("engrase_punto").select("id, nombre, orden, activo").order("orden");
  if (error) throw new Error(`engrase_punto: ${error.message}`);
  return data as PuntoEngraseAdmin[];
}

export async function crearPuntoEngrase(nombre: string, orden: number): Promise<void> {
  const { error } = await supabase.from("engrase_punto").insert({ nombre: nombre.trim(), orden, activo: true });
  if (error) throw new Error(`No se pudo crear el punto: ${error.message}`);
}

export async function actualizarPuntoEngrase(
  id: string,
  cambios: Partial<Pick<PuntoEngraseAdmin, "nombre" | "orden" | "activo">>,
): Promise<void> {
  const { error } = await supabase.from("engrase_punto").update(cambios).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el punto: ${error.message}`);
}