// supabase/functions/ceria/tools/limits.ts
//
// Límites de filas para consultas de DETALLE (no agregadas). Las
// agregadas (get_produccion_turno, get_calidad_modelo,
// get_calidad_lote) devuelven una fila por grupo, no crecen con el
// volumen de partes — no necesitan este límite.

export const LIMITS: Record<string, number> = {
  get_partes: 300,
  get_incidencias_produccion: 300,
  get_incidencias_calidad: 300,
  get_produccion_turno: 90, // ~90 turnos = 30 días × 3 turnos, tope razonable
  get_calidad_turno: 90,
  get_calidad_modelo: 50,
  get_calidad_lote: 50,
  get_produccion_linea: 10, // como mucho 6 líneas, tope razonable
  get_calidad_linea: 10,
};
