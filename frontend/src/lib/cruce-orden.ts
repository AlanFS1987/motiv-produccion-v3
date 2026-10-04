import { supabase } from "./supabase-client";

export interface CruceOrden {
  lote: { numero_orden: string; modelo: string } | null;
  programacion: { numero_orden: string; modelo: string } | null;
  parecidos: { numero_orden: string; modelo: string | null; origen: "lote" | "programacion" }[];
}

/** Cruza un Nº de orden válido contra lotes y programación (RPC cruzar_orden_captura). */
export async function cruzarOrden(numeroOrden: string): Promise<CruceOrden> {
  const { data, error } = await supabase.rpc("cruzar_orden_captura", { p_numero_orden: numeroOrden });
  if (error) throw new Error(error.message);
  return data as CruceOrden;
}
