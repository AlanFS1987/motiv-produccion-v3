import { supabase } from "./supabase-client";

export interface CierreFabrica {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export async function listarCierres(): Promise<CierreFabrica[]> {
  const { data, error } = await supabase
    .from("cierre_fabrica")
    .select("id, fecha_inicio, fecha_fin")
    .order("fecha_inicio", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearCierre(fechaInicio: string, fechaFin: string): Promise<void> {
  const { error } = await supabase
    .from("cierre_fabrica")
    .insert({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  if (error) throw new Error(error.message);
}

export async function eliminarCierre(id: string): Promise<void> {
  const { error } = await supabase.from("cierre_fabrica").delete().eq("id", id);
  if (error) throw new Error(error.message);
}