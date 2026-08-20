// Normalización de modelo/marca/acabado, y separación del prefijo de
// fábrica en el tono. Ref. 01-rol-responsable.md 3.2,
// 05-modelo-de-datos.md 7.4.
//
// Espejo funcional de fn_normalizar_texto() en la BD (0003_catalogos.sql)
// — se reimplementa aquí porque la Edge Function necesita el valor
// normalizado ANTES de llamar a la BD (para construir la llamada RPC de
// similitud), no después.

/**
 * Mayúsculas; conserva letras (incl. Ñ), números, espacios y los
 * símbolos - / . & ; el resto de caracteres especiales se sustituye
 * por un espacio (no se pegan palabras); espacios múltiples colapsados.
 */
export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return "";
  let t = texto.toUpperCase();
  t = t.replace(/[^A-ZÑÁÉÍÓÚÜ0-9\s\-\/.&]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * El tono real tal y como aparece en caja/pieza lleva un prefijo de
 * fábrica (ej. "5M10" -> fábrica "5" + tono "M10"). En la ficha de
 * partida (Foto 1) el campo TONO ANT. aparece SIN ese prefijo
 * (ej. "M09"). Esta función separa ambas partes para poder comparar
 * siempre solo letra+2 dígitos.
 *
 * Si el texto no cumple el formato esperado (letra + 2 dígitos, con
 * o sin prefijo numérico delante), se devuelve tal cual en `tonoReal`
 * para que el responsable lo revise a mano — nunca se descarta el dato.
 */
export function separarPrefijoTono(
  tonoCrudo: string | null | undefined,
): { prefijo: string | null; tonoReal: string | null } {
  if (!tonoCrudo) return { prefijo: null, tonoReal: null };
  const t = tonoCrudo.toUpperCase().replace(/\s/g, "");
  const match = t.match(/^(\d*)([A-ZÑ]\d{2})$/);
  if (!match) return { prefijo: null, tonoReal: t };
  const [, prefijo, tonoReal] = match;
  return { prefijo: prefijo || null, tonoReal };
}

/**
 * Validación de tono/calibre (01-rol-responsable.md 3.2): solo
 * mayúsculas, sin caracteres especiales, sin espacios — un único token.
 */
/**
 * Limpia el nombre de modelo tal como se lee de la hoja de partida:
 * el nombre real es todo lo que hay ANTES del primer paréntesis de
 * apertura — se descarta el paréntesis y todo lo que le sigue
 * (formato/sufijos internos pegados al código). Regla confirmada por
 * el cliente con una hoja real: "SL ORION MARFIL MT(PRC)60X120RC/CIF2_S"
 * → "SL ORION MARFIL MT".
 *
 * Se implementa como función determinista en código (no se le pide a
 * Haiku que la aplique él) porque es una operación 100% mecánica —
 * más fiable en código que confiando en que el modelo corte el texto
 * exactamente en el carácter correcto cada vez.
 */
export function limpiarNombreModelo(bruto: string | null | undefined): string {
  if (!bruto) return "";
  const idx = bruto.indexOf("(");
  const limpio = idx === -1 ? bruto : bruto.slice(0, idx);
  return limpio.trim();
}

export function esTokenValido(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return /^[A-ZÑ0-9]+$/.test(valor);
}

/**
 * Convierte el espesor detectado (número en mm) al formato de columna
 * de `lote.espesor` (04-rol-administrador.md 6.1: solo 9mm u 11mm).
 */
export function espesorATexto(espesorMm: number | null | undefined): string | null {
  if (espesorMm === 9) return "9mm";
  if (espesorMm === 11) return "11mm";
  return null;
}