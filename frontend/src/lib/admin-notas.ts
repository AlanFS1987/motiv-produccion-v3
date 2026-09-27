// frontend/src/lib/admin-notas.ts
//
// Capa de datos de la tabla `admin_notas` (espacio de trabajo libre
// del administrador) para las Notas sueltas (tipo='nota'). La misma
// tabla también guarda el CSV de Programación (tipo='programacion'),
// pero desde que el admin usa la pantalla completa compartida con el
// jefe (jefe/programacion/), esas filas se escriben vía la RPC
// `guardar_programacion_csv` (lib/programacion.ts), no desde aquí —
// las funciones de Programación que vivían en este archivo se
// borraron por quedar sin uso.

import { supabase } from "./supabase-client";

export interface Nota {
  id: string;
  titulo: string | null;
  contenido: string;
  fecha: string | null;
  createdAt: string;
  updatedAt: string;
}

async function idUsuarioActual(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------
// Notas
// ---------------------------------------------------------------

export async function listarNotas(): Promise<Nota[]> {
  const { data, error } = await supabase
    .from("admin_notas")
    .select("id, titulo, contenido, fecha, created_at, updated_at")
    .eq("tipo", "nota")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((f) => ({
    id: f.id as string,
    titulo: (f.titulo as string | null) ?? null,
    contenido: f.contenido as string,
    fecha: (f.fecha as string | null) ?? null,
    createdAt: f.created_at as string,
    updatedAt: f.updated_at as string,
  }));
}

export async function crearNota(titulo: string, contenido: string, fecha: string | null = null): Promise<void> {
  const creadoPor = await idUsuarioActual();

  const { error } = await supabase.from("admin_notas").insert({
    tipo: "nota",
    titulo: titulo.trim() || null,
    contenido,
    fecha,
    creado_por: creadoPor,
  });
  if (error) throw new Error(error.message);
}

export async function actualizarNota(
  id: string,
  cambios: { titulo?: string | null; contenido?: string; fecha?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("admin_notas")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tipo", "nota");
  if (error) throw new Error(error.message);
}

export async function eliminarNota(id: string): Promise<void> {
  const { error } = await supabase.from("admin_notas").delete().eq("id", id).eq("tipo", "nota");
  if (error) throw new Error(error.message);
}
