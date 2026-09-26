// frontend/src/lib/admin-notas.ts
//
// Capa de datos de la tabla `admin_notas` (espacio de trabajo libre
// del administrador). Dos bloques de funciones sobre la misma tabla,
// distinguidos por `tipo`:
//   - Programación: una fila por fecha (tipo='programacion').
//   - Notas: sin fecha obligatoria (tipo='nota').
//
// Sustituye a `admin-programacion.ts` (que usaba `configuracion`) —
// bórralo si lo tenías ya copiado.

import { supabase } from "./supabase-client";

export interface ProgramacionHistorico {
  id: string;
  fecha: string; // YYYY-MM-DD
  numFilas: number | null;
  createdAt: string;
}

export interface Nota {
  id: string;
  titulo: string | null;
  contenido: string;
  fecha: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fechaDeHoyISO(): string {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function idUsuarioActual(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------
// Programación
// ---------------------------------------------------------------

export async function listarProgramacionHistorico(limite = 15): Promise<ProgramacionHistorico[]> {
  const { data, error } = await supabase
    .from("admin_notas")
    .select("id, fecha, num_filas, created_at")
    .eq("tipo", "programacion")
    .order("fecha", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);

  return (data ?? []).map((f) => ({
    id: f.id as string,
    fecha: f.fecha as string,
    numFilas: (f.num_filas as number | null) ?? null,
    createdAt: f.created_at as string,
  }));
}

// Select-then-write en vez de un upsert de PostgREST: el índice único
// de `fecha` es PARCIAL (solo tipo='programacion'), y Postgres exige
// que el ON CONFLICT de un upsert repita el predicado del índice
// parcial para poder usarlo como arbiter — más simple y explícito
// hacerlo a mano, mismo espíritu que el resto de pantallas de admin
// (guardado inmediato por fila, sin upsert "mágico").
export async function guardarProgramacion(fecha: string, csvTexto: string): Promise<void> {
  const numFilas = csvTexto.trim().split("\n").length;
  const creadoPor = await idUsuarioActual();

  const { data: existente, error: errorBusqueda } = await supabase
    .from("admin_notas")
    .select("id")
    .eq("tipo", "programacion")
    .eq("fecha", fecha)
    .maybeSingle();

  if (errorBusqueda) throw new Error(errorBusqueda.message);

  if (existente) {
    const { error } = await supabase
      .from("admin_notas")
      .update({
        contenido: csvTexto,
        num_filas: numFilas,
        creado_por: creadoPor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("admin_notas").insert({
    tipo: "programacion",
    fecha,
    contenido: csvTexto,
    num_filas: numFilas,
    creado_por: creadoPor,
  });
  if (error) throw new Error(error.message);
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
