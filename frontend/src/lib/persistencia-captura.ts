// Persistencia local del progreso del wizard de captura de parte.
// Ref. 01-rol-responsable.md 3.1 ("autoguardado... si el responsable
// cierra la app a medias y la vuelve a abrir, retoma exactamente
// donde lo dejó").
//
// El INSERT real en Supabase solo ocurre al final (ver lib/parte.ts,
// crearParte) — antes de eso, el único sitio donde "no se pierde
// nada" es el propio navegador. Esto complementa el guardado en BD,
// no lo sustituye.

import type { LoteResuelto } from "./parte";
import type { EstadoCampo } from "./verificacion-caja";

export interface ProgresoCapturaParte {
  paso: "hoja" | "caja" | "pantalla";
  lote: LoteResuelto | null;
  estadoVerificacionCaja: EstadoCampo | null;
  guardadoEn: string;
}

const PREFIJO = "motiv:captura-parte:";
/** Progreso más viejo que esto se ignora — casi seguro es de otro turno/día. */
const MAX_ANTIGUEDAD_MS = 12 * 60 * 60 * 1000;

function claveStorage(turnoId: string, lineaId: string): string {
  return `${PREFIJO}${turnoId}:${lineaId}`;
}

export function guardarProgreso(
  turnoId: string,
  lineaId: string,
  progreso: Omit<ProgresoCapturaParte, "guardadoEn">,
): void {
  try {
    const conFecha: ProgresoCapturaParte = { ...progreso, guardadoEn: new Date().toISOString() };
    localStorage.setItem(claveStorage(turnoId, lineaId), JSON.stringify(conFecha));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — no debe
    // romper la captura, solo se pierde la recuperación si pasa.
  }
}

export function leerProgreso(turnoId: string, lineaId: string): ProgresoCapturaParte | null {
  try {
    const bruto = localStorage.getItem(claveStorage(turnoId, lineaId));
    if (!bruto) return null;
    const progreso = JSON.parse(bruto) as ProgresoCapturaParte;
    const antiguedad = Date.now() - new Date(progreso.guardadoEn).getTime();
    if (antiguedad > MAX_ANTIGUEDAD_MS) {
      limpiarProgreso(turnoId, lineaId);
      return null;
    }
    return progreso;
  } catch {
    return null;
  }
}

export function limpiarProgreso(turnoId: string, lineaId: string): void {
  try {
    localStorage.removeItem(claveStorage(turnoId, lineaId));
  } catch {
    // ignorar
  }
}