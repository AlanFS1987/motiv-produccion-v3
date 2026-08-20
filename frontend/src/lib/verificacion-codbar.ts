// Verificación de códigos de barras por escaneo en vivo. Ref.
// 01-rol-responsable.md 3.8.
//
// A diferencia de verificacion-caja.ts, aquí no existe "incorrecto":
// un código escaneado o coincide exactamente con uno de los valores
// esperados del lote, o no coincide con ninguno — en ese caso se
// ignora en silencio (no se compara campo a campo por posición, como
// sí pasa con marca/modelo/tono/calibre de la caja). El "código
// leído" que se muestra en vivo en pantalla es lo que le permite al
// responsable notar si algo no cuadra (código borroso, mal impreso),
// sin que la base de datos tenga que modelar esa ambigüedad.

export type CampoCodigoBarras = "codbar_caja" | "codbar_pieza" | "cod_upec" | "codbar_saso";

/** Subconjunto de LoteCompleto (lib/parte.ts) con solo los 4 campos que interesan aquí. */
export interface CodigosBarrasLote {
  codbarCaja: string | null;
  codbarPieza: string | null;
  codUpec: string | null;
  codbarSaso: string | null;
}

export interface CampoEscaneado {
  campo: CampoCodigoBarras;
  etiqueta: string;
  valorEsperado: string;
  verificado: boolean;
}

/** Guardado en parte.verificacion_codbar_estado. */
export type EstadoVerificacionCodbar = "completo" | "parcial" | "manual" | "no_realizada";

const ETIQUETAS: Record<CampoCodigoBarras, string> = {
  codbar_caja: "Código de caja",
  codbar_pieza: "Código de pieza",
  cod_upec: "Código UPEC",
  codbar_saso: "Código SASO",
};

/**
 * Lista inicial de campos a verificar — solo incluye los que
 * realmente vienen rellenos en el lote (si un lote no tiene, por
 * ejemplo, codbar_saso, no tiene sentido pedir que se escanee).
 */
export function construirListaCampos(codigos: CodigosBarrasLote): CampoEscaneado[] {
  const pares: [CampoCodigoBarras, string | null][] = [
    ["codbar_caja", codigos.codbarCaja],
    ["codbar_pieza", codigos.codbarPieza],
    ["cod_upec", codigos.codUpec],
    ["codbar_saso", codigos.codbarSaso],
  ];
  return pares
    .filter(([, valor]) => valor !== null && valor.trim() !== "")
    .map(([campo, valor]) => ({
      campo,
      etiqueta: ETIQUETAS[campo],
      valorEsperado: valor!.trim(),
      verificado: false,
    }));
}

/**
 * Compara un código recién escaneado contra la lista de campos.
 * Devuelve el campo que coincide, o null si el símbolo escaneado no
 * corresponde a ninguno de los esperados — se ignora en silencio,
 * como se decidió en sesión (evita ruido/fricción si el responsable
 * enfoca sin querer otra etiqueta de la caja, ej. logística interna).
 */
export function encontrarCampoCoincidente(codigoLeido: string, campos: CampoEscaneado[]): CampoCodigoBarras | null {
  const normalizado = codigoLeido.trim();
  const encontrado = campos.find((c) => c.valorEsperado === normalizado);
  return encontrado ? encontrado.campo : null;
}

/** Estado general derivado de cuántos de los N campos esperados quedaron verificados. */
export function calcularEstadoGeneral(campos: CampoEscaneado[]): EstadoVerificacionCodbar {
  if (campos.length === 0) return "no_realizada";
  const verificados = campos.filter((c) => c.verificado).length;
  if (verificados === 0) return "no_realizada";
  if (verificados === campos.length) return "completo";
  return "parcial";
}