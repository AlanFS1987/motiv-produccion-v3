// Conversión piezas -> m² a partir del nombre del formato del
// catálogo (ej. "600x1200"). Ref. conversación de sesión: el nombre
// del formato SON las medidas de la pieza en milímetros (ancho x
// alto) — área de una pieza = ancho_mm * alto_mm, convertida a m².
//
// Resuelve el placeholder que dejó 0009_vistas.sql ("no hay en la
// spec una fórmula piezas→m²") para el informe de cierre de turno
// (01-rol-responsable.md 3.9b) — antes de esto, m2_total quedaba
// siempre en null a propósito.

/**
 * Área de una pieza, en m², a partir del nombre del formato del
 * catálogo cerrado (ver 11-esquema-supabase.md 13.1: "200x1200",
 * "300x1200", "600x1200", "1200x1200", "300x600", "600x600",
 * "900x900"). Devuelve `null` si el nombre no tiene la forma
 * "NNNxNNN" esperada — nunca inventa un área.
 */
export function areaM2DeFormato(nombreFormato: string | null | undefined): number | null {
  if (!nombreFormato) return null;
  const match = nombreFormato.trim().toLowerCase().match(/^(\d+)\s*x\s*(\d+)$/);
  if (!match) return null;

  const anchoMm = Number(match[1]);
  const altoMm = Number(match[2]);
  if (!anchoMm || !altoMm) return null;

  // mm² -> m²: 1 m² = 1.000.000 mm²
  return (anchoMm * altoMm) / 1_000_000;
}

/**
 * m² totales de un número de piezas de un formato dado. Si el
 * formato no se puede interpretar, devuelve 0 en vez de lanzar —
 * un informe con un formato raro no debe romperse entero por eso,
 * mejor mostrar 0 m² para esa fila que tumbar el resto del informe.
 */
export function m2DePiezas(piezas: number, nombreFormato: string | null | undefined): number {
  const area = areaM2DeFormato(nombreFormato);
  if (area === null) return 0;
  return piezas * area;
}