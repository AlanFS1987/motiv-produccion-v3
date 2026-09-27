// frontend/src/lib/supabase-relaciones.ts
//
// PostgREST devuelve una relación embebida como array o como objeto
// suelto según el tipo de join que infiere — este helper normaliza
// ambos casos al primer resultado. Antes duplicado localmente en
// varios lib/*.ts (admin-partes.ts, almacen.ts, dashboard-detallada.ts,
// dashboard-incidencias.ts, lote.ts, mecanico-engrase.ts,
// mecanico-incidencias.ts, resumen-turno.ts) — consolidado aquí.

export function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}
