// Conversión piezas -> m² a partir del nombre del formato del
// catálogo (ej. "600x1200"). Ref. 01-rol-responsable.md 3.9b.
//
// Réplica en Deno de lib/formato.ts (frontend) — mismo patrón de
// duplicación intencional que ya existe entre lib/normalizacion.ts y
// _shared/normalizacion.ts (edge functions y frontend son runtimes
// distintos, no se puede importar directamente entre ellos).

export function areaM2DeFormato(nombreFormato: string | null | undefined): number | null {
  if (!nombreFormato) return null;
  const match = nombreFormato.trim().toLowerCase().match(/^(\d+)\s*x\s*(\d+)$/);
  if (!match) return null;

  const anchoMm = Number(match[1]);
  const altoMm = Number(match[2]);
  if (!anchoMm || !altoMm) return null;

  return (anchoMm * altoMm) / 1_000_000;
}

export function m2DePiezas(piezas: number, nombreFormato: string | null | undefined): number {
  const area = areaM2DeFormato(nombreFormato);
  if (area === null) return 0;
  return piezas * area;
}
