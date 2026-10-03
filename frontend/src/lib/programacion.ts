// frontend/src/lib/programacion.ts
//
// Programación diaria de producción (4 hornos). Dos flujos:
//   - Revisar/confirmar (rol jefe/administrador): lee el CSV pegado
//     en admin_notas (tipo='programacion') vía RPC diff_programacion,
//     se muestra editable, y al confirmar se llama a
//     confirmar_programacion con el estado final aprobado.
//   - Consultar (cualquier rol con acceso: jefe, responsable,
//     produccion, administrador): lee la vista programacion_con_estado,
//     que ya trae el estado pendiente/iniciado/finalizado vía JOIN
//     contra `lote` (no se guarda, siempre en vivo).
//
// Ver migraciones: create_programacion_orden,
// seguridad_y_confirmacion_editable_programacion,
// fix_parse_diff_programacion_plpgsql, create_confirmar_programacion.

import { supabase } from "./supabase-client";

// cambia_horno: la orden ya existía en otro horno. La clave es solo
// numero_orden; en ese caso la posición no es comparable entre hornos.
export type CambioDiff = "nuevo" | "eliminado" | "reordenado" | "sin_cambios" | "cambia_horno";
export type Estado = "pendiente" | "iniciado" | "finalizado";

export interface FilaDiff {
  cambio: CambioDiff;
  horno: number;
  numeroOrden: string;
  modelo: string | null;
  metros: number | null;
  acabado: string | null;
  cep: boolean;
  caja: string | null;
  posicionActual: number | null;
  posicionNueva: number | null;
  // horno guardado hoy / horno según el CSV nuevo (null si no existe en ese lado).
  hornoActual: number | null;
  hornoNuevo: number | null;
  // true = el mismo numero_orden aparece más de una vez en el CSV pegado.
  // El diff solo devuelve una de las apariciones; confirmar debe quedar bloqueado.
  repetida: boolean;
}

export interface FilaConEstado {
  id: string;
  horno: number;
  posicion: number;
  numeroOrden: string;
  modelo: string | null;
  metros: number | null;
  acabado: string | null;
  cep: boolean;
  caja: string | null;
  tono: string | null;
  calibre: string | null;
  estado: Estado;
  // Día en que la orden entró en programación (null en las filas anteriores
  // al 02/10/2026: la UI muestra "—" y no las marca como nuevas).
  fechaAlta: string | null;
}

// Fila final que se manda a confirmar_programacion. Es lo que
// realmente queda guardado en programacion_orden para esa fecha —
// construida a partir del diff, con las ediciones del jefe ya
// aplicadas (excluir eliminados que quiere conservar, tono/calibre
// de las nuevas...).
export interface FilaAConfirmar {
  horno: number;
  numero_orden: string;
  modelo: string | null;
  metros: number | null;
  acabado: string | null;
  cep: boolean;
  caja: string | null;
  posicion: number;
  tono?: string | null;
  calibre?: string | null;
}

import { hoyLocalISO } from "./fechas";

function hoyISO(): string {
  return hoyLocalISO();
}

export async function existeCsvHoy(fecha: string = hoyISO()): Promise<boolean> {
  const { data, error } = await supabase.rpc("existe_csv_programacion", { p_fecha: fecha });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function guardarProgramacionCsv(fecha: string, contenido: string): Promise<void> {
  const { error } = await supabase.rpc("guardar_programacion_csv", {
    p_fecha: fecha,
    p_contenido: contenido,
  });
  if (error) throw new Error(error.message);
}

export async function deshacerUltimaProgramacion(): Promise<{ filasRestauradas: number; snapshotDe: string }> {
  const { data, error } = await supabase.rpc("deshacer_ultima_programacion");
  if (error) throw new Error(error.message);
  const fila = data?.[0];
  return { filasRestauradas: fila?.filas_restauradas ?? 0, snapshotDe: fila?.snapshot_de ?? "" };
}

// ---------------------------------------------------------------
// Revisión (diff editable)
// ---------------------------------------------------------------

export async function obtenerDiffProgramacion(fecha: string = hoyISO()): Promise<FilaDiff[]> {
  const { data, error } = await supabase.rpc("diff_programacion", { p_fecha: fecha });
  if (error) throw new Error(error.message);

  return (data ?? []).map((f: any) => ({
    cambio: f.cambio as CambioDiff,
    horno: f.horno as number,
    numeroOrden: f.numero_orden as string,
    modelo: f.modelo as string | null,
    metros: f.metros !== null ? Number(f.metros) : null,
    acabado: f.acabado as string | null,
    cep: f.cep as boolean,
    caja: f.caja as string | null,
    posicionActual: f.posicion_actual as number | null,
    posicionNueva: f.posicion_nueva as number | null,
    hornoActual: (f.horno_actual ?? null) as number | null,
    hornoNuevo: (f.horno_nuevo ?? null) as number | null,
    repetida: Boolean(f.repetida),
  }));
}

// Construye el payload final a partir del diff ya editado en la UI
// (después de que el jefe haya podido excluir eliminaciones, corregir
// filas y rellenar tono/calibre de las nuevas) y lo confirma.
//
// `filasFinales` debe incluir TODAS las filas que se quieren
// conservar para ese día — es un reemplazo completo, no un parche:
// cualquier (horno, numero_orden) que ya estuviera en la tabla y no
// venga aquí, se borra.
export async function confirmarProgramacion(
  fecha: string,
  filasFinales: FilaAConfirmar[],
): Promise<{ nuevos: number; eliminados: number; actualizados: number }> {
  const { data, error } = await supabase.rpc("confirmar_programacion", {
    p_fecha: fecha,
    p_filas: filasFinales,
  });
  if (error) throw new Error(error.message);
  const fila = data?.[0] ?? { nuevos: 0, eliminados: 0, actualizados: 0 };
  return { nuevos: fila.nuevos, eliminados: fila.eliminados, actualizados: fila.actualizados };
}

// ---------------------------------------------------------------
// Consulta (vista móvil, estado en vivo)
// ---------------------------------------------------------------

export async function listarProgramacionConEstado(): Promise<FilaConEstado[]> {
  const { data, error } = await supabase
    .from("programacion_con_estado")
    .select("id, horno, posicion, numero_orden, modelo, metros, acabado, cep, caja, tono, calibre, estado, fecha_alta")
    .order("horno", { ascending: true })
    .order("posicion", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((f: any) => ({
    id: f.id as string,
    horno: f.horno as number,
    posicion: f.posicion as number,
    numeroOrden: f.numero_orden as string,
    modelo: f.modelo as string | null,
    metros: f.metros !== null ? Number(f.metros) : null,
    acabado: f.acabado as string | null,
    cep: f.cep as boolean,
    caja: f.caja as string | null,
    tono: f.tono as string | null,
    calibre: f.calibre as string | null,
    estado: f.estado as Estado,
    fechaAlta: (f.fecha_alta ?? null) as string | null,
  }));
}

// Edición directa de tono/calibre desde Consultar (jefe/administrador). Identifica la
// orden por numero_orden (los id cambian al deshacer). Texto vacío = sin valor.
export async function actualizarTonoCalibre(
  numeroOrden: string,
  tono: string,
  calibre: string,
): Promise<{ tono: string | null; calibre: string | null }> {
  const { data, error } = await supabase.rpc("actualizar_tono_calibre", {
    p_numero_orden: numeroOrden,
    p_tono: tono,
    p_calibre: calibre,
  });
  if (error) throw new Error(error.message);
  const fila = data?.[0];
  return { tono: (fila?.tono ?? null) as string | null, calibre: (fila?.calibre ?? null) as string | null };
}

export function agruparPorHorno<T extends { horno: number }>(filas: T[]): Map<number, T[]> {
  const mapa = new Map<number, T[]>();
  for (const f of filas) {
    if (!mapa.has(f.horno)) mapa.set(f.horno, []);
    mapa.get(f.horno)!.push(f);
  }
  return mapa;
}

export { hoyISO };