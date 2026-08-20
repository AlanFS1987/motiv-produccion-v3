// Verificación de caja impresa (nuevo lote, obligatoria). Ref.
// 01-rol-responsable.md 3.5.
//
// Compara lo leído en la Foto 2 (caja) contra lo ya resuelto en la
// Foto 1 (lote), campo a campo — sin ida y vuelta a Supabase, todo en
// el cliente. Resultado global de 3 estados (correcto/incorrecto/no
// verificable) más el detalle de qué campo concreto cayó en cada uno.

import { normalizarTexto, compararTono, compararCalibre } from "./normalizacion";
import type { DatosLoteComparacion, DatosOcrCaja } from "./parte";

/** Formatos que necesitan 2 fotos de caja (superior + lateral). */
export const FORMATOS_GRANDES = ["600x1200", "1200x1200", "900x900", "300x600", "600x600"] as const;
/** Formatos que necesitan solo 1 foto de caja (toda la info arriba). */
export const FORMATOS_PEQUENOS = ["300x1200", "200x1200"] as const;

function normalizarFormato(formato: string): string {
  return formato.trim().toUpperCase().replace(/\s+/g, "");
}

export function requiereDosFotosCaja(formatoNombre: string): boolean {
  const normalizado = normalizarFormato(formatoNombre);
  return FORMATOS_GRANDES.some((f) => f.toUpperCase() === normalizado);
}

export type EstadoCampo = "correcto" | "incorrecto" | "no_verificable";
export type EstadoGeneral = EstadoCampo;

export interface CampoVerificacion {
  campo: "marca" | "modelo" | "tono" | "calibre";
  etiqueta: string;
  estado: EstadoCampo;
  valorLeido: string | null;
  valorEsperado: string;
}

export interface ResultadoVerificacionCaja {
  estadoGeneral: EstadoGeneral;
  campos: CampoVerificacion[];
}

function evaluarCampo(
  campo: CampoVerificacion["campo"],
  etiqueta: string,
  valorLeido: string | null,
  confianza: "alta" | "media" | "baja",
  valorEsperado: string,
  coincide: (leido: string, esperado: string) => boolean,
): CampoVerificacion {
  // Sin lectura, o lectura poco fiable -> no forzamos correcto/incorrecto,
  // es "revísalo tú" (evita falsos positivos, 3.5).
  if (!valorLeido || valorLeido.trim() === "" || confianza === "baja") {
    return { campo, etiqueta, estado: "no_verificable", valorLeido, valorEsperado };
  }
  return {
    campo,
    etiqueta,
    estado: coincide(valorLeido, valorEsperado) ? "correcto" : "incorrecto",
    valorLeido,
    valorEsperado,
  };
}

/**
 * Compara los 4 campos de la Foto 2 (caja) contra lo ya resuelto en
 * la Foto 1 (lote). Cada campo se evalúa de forma independiente —
 * el resultado global es "incorrecto" si CUALQUIERA lo está,
 * "no_verificable" si ninguno está mal pero alguno no se pudo leer
 * con confianza, y "correcto" solo si los 4 coinciden con confianza.
 */
export function evaluarVerificacionCaja(datosCaja: DatosOcrCaja, lote: DatosLoteComparacion): ResultadoVerificacionCaja {
  const campos: CampoVerificacion[] = [
    evaluarCampo(
      "marca",
      "Marca",
      datosCaja.marca,
      datosCaja.confianza_marca,
      lote.marcaTextoNormalizado,
      (leido, esperado) => normalizarTexto(leido) === esperado,
    ),
    evaluarCampo(
      "modelo",
      "Modelo",
      datosCaja.modelo,
      datosCaja.confianza_modelo,
      lote.modeloTextoNormalizado,
      (leido, esperado) => normalizarTexto(leido) === esperado,
    ),
    evaluarCampo(
      "tono",
      "Tono",
      datosCaja.tono,
      datosCaja.confianza_tono,
      lote.tono,
      (leido, esperado) => compararTono(leido, esperado),
    ),
    evaluarCampo(
      "calibre",
      "Calibre",
      datosCaja.calibre,
      datosCaja.confianza_calibre,
      lote.calibre,
      (leido, esperado) => compararCalibre(leido, esperado),
    ),
  ];

  const hayIncorrecto = campos.some((c) => c.estado === "incorrecto");
  const hayNoVerificable = campos.some((c) => c.estado === "no_verificable");

  const estadoGeneral: EstadoGeneral = hayIncorrecto
    ? "incorrecto"
    : hayNoVerificable
      ? "no_verificable"
      : "correcto";

  return { estadoGeneral, campos };
}