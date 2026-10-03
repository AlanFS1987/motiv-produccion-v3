// frontend/src/lib/programacion-notas.ts
//
// Notas por orden de programación y frases frecuentes (memorias/22, Mejora 4).
//   - Lectura directa por RLS (jefe, responsable, produccion, administrador).
//   - Escritura SOLO por RPC (jefe/administrador; las frases, solo administrador).
// Las notas se referencian por numero_orden (sin FK): sobreviven si la orden sale
// de programación. El autor sale de usuario.username, como en el resto de la app.

import { supabase } from "./supabase-client";
import { uno } from "./supabase-relaciones";

export interface NotaOrden {
  id: string;
  numeroOrden: string;
  texto: string;
  autor: string | null;
  creadaEn: string;
  editadaEn: string;
}

export interface FraseNota {
  id: string;
  texto: string;
  activa: boolean;
  orden: number;
}

export async function listarNotasProgramacion(): Promise<Map<string, NotaOrden[]>> {
  const { data, error } = await supabase
    .from("programacion_nota")
    .select("id, numero_orden, texto, created_at, updated_at, autor:creado_por ( username )")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`programacion_nota: ${error.message}`);

  const porOrden = new Map<string, NotaOrden[]>();
  for (const n of data ?? []) {
    const nota: NotaOrden = {
      id: n.id as string,
      numeroOrden: n.numero_orden as string,
      texto: n.texto as string,
      autor: uno<{ username: string }>(n.autor as any)?.username ?? null,
      creadaEn: n.created_at as string,
      editadaEn: n.updated_at as string,
    };
    if (!porOrden.has(nota.numeroOrden)) porOrden.set(nota.numeroOrden, []);
    porOrden.get(nota.numeroOrden)!.push(nota);
  }
  return porOrden;
}

export async function listarFrases(soloActivas: boolean): Promise<FraseNota[]> {
  let consulta = supabase.from("programacion_nota_frase").select("id, texto, activa, orden");
  if (soloActivas) consulta = consulta.eq("activa", true);
  const { data, error } = await consulta.order("orden", { ascending: true }).order("texto", { ascending: true });
  if (error) throw new Error(`programacion_nota_frase: ${error.message}`);
  return (data ?? []) as FraseNota[];
}

/** Misma nota en varias órdenes, todo o nada. Devuelve cuántas notas se crearon. */
export async function anadirNotaOrdenes(ordenes: string[], texto: string): Promise<number> {
  const { data, error } = await supabase.rpc("anadir_nota_ordenes", { p_ordenes: ordenes, p_texto: texto });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function editarNota(id: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc("editar_nota", { p_id: id, p_texto: texto });
  if (error) throw new Error(error.message);
}

export async function borrarNota(id: string): Promise<void> {
  const { error } = await supabase.rpc("borrar_nota", { p_id: id });
  if (error) throw new Error(error.message);
}

/** Alta (id = null) o edición de una frase; baja lógica con activa = false. */
export async function guardarFrase(
  id: string | null,
  texto: string,
  activa: boolean | null,
  orden: number | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("guardar_frase", {
    p_id: id,
    p_texto: texto,
    p_activa: activa,
    p_orden: orden,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
