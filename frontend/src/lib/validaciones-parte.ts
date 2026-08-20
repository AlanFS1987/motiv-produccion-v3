// Reglas de validación de un `parte` antes de guardarlo. Ref.
// 01-rol-responsable.md 3.3.
//
// Dos reglas bloqueantes (no se puede guardar si fallan) y una de
// aviso no bloqueante (se guarda igual, marcado como atípico).

export interface DatosValidacionParte {
  piezas_1a: number;
  piezas_comercial: number;
  piezas_eco: number;
  piezas_contenedor: number;
  piezas_entradas: number;
  minutos_total: number;
  minutos_plena: number;
  minutos_no_alimentada: number;
  minutos_saturacion: number;
  minutos_banco: number;
  minutos_maquina: number;
}

export interface ResultadoValidacion {
  bloqueante: boolean;
  mensaje: string;
}

const MARGEN_CALIDAD_MIN_PCT = 98;
const MARGEN_CALIDAD_MAX_PCT = 102;
const MARGEN_TIEMPOS = 0.02;

/**
 * [SUPUESTO A CONFIRMAR] 3.3 dice "si minutos_total excede
 * ampliamente lo esperable" sin fijar un número. Uso 600 min (~25%
 * sobre un turno estándar de 480) como umbral de aviso. Cambia esta
 * constante si el umbral real acordado es otro.
 */
const UMBRAL_MINUTOS_ATIPICO = 600;

/** Regla 1 — coherencia interna de calidad (bloqueante). */
export function validarCoherenciaCalidad(d: DatosValidacionParte): ResultadoValidacion {
  if (d.piezas_entradas === 0) {
    return { bloqueante: true, mensaje: "Piezas entradas no puede ser 0." };
  }
  const suma = d.piezas_1a + d.piezas_comercial + d.piezas_eco + d.piezas_contenedor;
  const pct = (suma / d.piezas_entradas) * 100;
  if (pct < MARGEN_CALIDAD_MIN_PCT || pct > MARGEN_CALIDAD_MAX_PCT) {
    return {
      bloqueante: true,
      mensaje: `1ª + comercial + eco + contenedor (${suma}) es el ${pct.toFixed(1)}% de piezas entradas (${d.piezas_entradas}) — debe estar entre 98% y 102%.`,
    };
  }
  return { bloqueante: false, mensaje: "" };
}

/** Regla 2 — coherencia interna de tiempos (bloqueante). */
export function validarCoherenciaTiempos(d: DatosValidacionParte): ResultadoValidacion {
  if (d.minutos_total === 0) {
    return { bloqueante: true, mensaje: "Minutos total no puede ser 0." };
  }
  const suma =
    d.minutos_plena + d.minutos_no_alimentada + d.minutos_saturacion + d.minutos_banco + d.minutos_maquina;
  const diferenciaRelativa = Math.abs(suma - d.minutos_total) / d.minutos_total;
  if (diferenciaRelativa > MARGEN_TIEMPOS) {
    return {
      bloqueante: true,
      mensaje: `La suma de tiempos detallados (${suma} min) no cuadra con minutos total (${d.minutos_total} min) — margen permitido ±2%.`,
    };
  }
  return { bloqueante: false, mensaje: "" };
}

/** Regla 3 — duración atípica del tramo (aviso, no bloqueante). */
export function validarDuracionEsperada(d: DatosValidacionParte): ResultadoValidacion {
  if (d.minutos_total > UMBRAL_MINUTOS_ATIPICO) {
    return {
      bloqueante: false,
      mensaje: `Minutos total (${d.minutos_total}) es muy superior a un turno estándar — probablemente el contador no se reseteó. Se guarda igual, marcado como atípico.`,
    };
  }
  return { bloqueante: false, mensaje: "" };
}

export interface ValidacionCompleta {
  calidad: ResultadoValidacion;
  tiempos: ResultadoValidacion;
  duracion: ResultadoValidacion;
  puedeGuardar: boolean;
  esAtipico: boolean;
}

export function validarParte(d: DatosValidacionParte): ValidacionCompleta {
  const calidad = validarCoherenciaCalidad(d);
  const tiempos = validarCoherenciaTiempos(d);
  const duracion = validarDuracionEsperada(d);
  return {
    calidad,
    tiempos,
    duracion,
    puedeGuardar: !calidad.bloqueante && !tiempos.bloqueante,
    esAtipico: duracion.mensaje !== "",
  };
}

/** calibre_com_pct / calibre_std_pct — 01-rol-responsable.md 3.2/3.3. */
export function calcularCalibrePct(
  piezasDescuadreCom: number,
  piezasEntradas: number,
): { calibreComPct: number | null; calibreStdPct: number | null } {
  if (piezasEntradas === 0) return { calibreComPct: null, calibreStdPct: null };
  const calibreComPct = (piezasDescuadreCom / piezasEntradas) * 100;
  return { calibreComPct, calibreStdPct: 100 - calibreComPct };
}