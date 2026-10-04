// frontend/src/lib/lote-logica.ts
//
// Lógica pura de la pestaña Lotes (sin Supabase, testeable con
// node --test). Los números (pendiente, % del objetivo, última
// actividad, parte abierto) los calcula la vista v_lote_gestion; aquí
// solo se traducen a la forma de pantalla y se formatean.

export type EstadoLote = "iniciado" | "finalizado";

export interface LoteGestion {
  id: string;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  estado: EstadoLote;
  /** Fecha del último `parte` del lote — null si todavía no tiene ninguno. */
  ultimaActividad: string | null;
  /** m² que faltan por producir — null si el lote no tiene objetivo_m2 capturado. */
  m2Pendiente: number | null;
  /** Piezas que faltan por producir — null si el lote no tiene objetivo_m2 capturado. */
  piezasPendiente: number | null;
  /** Producido / objetivo (1 = 100 %) — null sin objetivo. */
  pctObjetivo: number | null;
  /** Hay un parte vigente sin completar (alguna línea está produciendo ahora). */
  tieneParteAbierto: boolean;
}

/** Fila tal cual la devuelve v_lote_gestion (numeric llega como number o string según el driver). */
export interface FilaLoteGestion {
  lote_id: string;
  numero_orden: string | null;
  estado: string;
  modelo: string | null;
  marca: string | null;
  formato: string | null;
  m2_pendiente: number | string | null;
  piezas_pendiente: number | string | null;
  pct_objetivo: number | string | null;
  ultima_actividad: string | null;
  tiene_parte_abierto: boolean | null;
}

function numeroOnull(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapearFilaGestion(f: FilaLoteGestion): LoteGestion {
  return {
    id: f.lote_id,
    numeroOrden: f.numero_orden ?? "",
    modeloNombre: f.modelo ?? "—",
    marcaNombre: f.marca ?? "—",
    formatoNombre: f.formato ?? "",
    estado: f.estado as EstadoLote,
    ultimaActividad: f.ultima_actividad,
    m2Pendiente: numeroOnull(f.m2_pendiente),
    piezasPendiente: numeroOnull(f.piezas_pendiente),
    pctObjetivo: numeroOnull(f.pct_objetivo),
    tieneParteAbierto: f.tiene_parte_abierto === true,
  };
}

const MS_DIA = 86_400_000;

/** "hoy" / "hace 1 día" / "hace N días" — días naturales completos transcurridos. */
export function textoHace(iso: string | null, ahora: Date = new Date()): string {
  if (!iso) return "sin actividad";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "sin actividad";
  const dias = Math.max(0, Math.floor((ahora.getTime() - t) / MS_DIA));
  if (dias === 0) return "hoy";
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** "73 %" — null sin objetivo. No se recorta a 100: un lote que se pasó enseña su valor real. */
export function textoPctObjetivo(ratio: number | null): string | null {
  if (ratio === null) return null;
  return `${Math.round(ratio * 100)} %`;
}

/** m² con 1 decimal, piezas como entero — mismo criterio que el resto de pantallas de producción. */
export function formatPendiente(m2: number, piezas: number): string {
  const m2Fmt = m2.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const piezasFmt = Math.round(piezas).toLocaleString("es-ES");
  return `${m2Fmt} m² · ${piezasFmt} piezas`;
}
