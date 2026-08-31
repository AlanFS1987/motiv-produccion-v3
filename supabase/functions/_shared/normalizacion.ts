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
export function esTokenValido(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return /^[A-ZÑ0-9]+$/.test(valor);
}

/**
 * El "modelo" en la hoja de partida es un código de producto completo
 * (ej. "SL ORION MARFIL MT(PRC)60X120RC/CIF2_S"), pero solo la parte
 * antes del paréntesis es el nombre real del modelo — el resto es un
 * código técnico interno. Regla confirmada por el cliente con una
 * hoja real: "SL ORION MARFIL MT(PRC)60X120RC/CIF2_S" →
 * "SL ORION MARFIL MT".
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

/**
 * Convierte el espesor detectado (número en mm) al formato de columna
 * de `lote.espesor` (04-rol-administrador.md 6.1: solo 9mm u 11mm).
 */
export function espesorATexto(espesorMm: number | null | undefined): string | null {
  if (espesorMm === 9) return "9mm";
  if (espesorMm === 11) return "11mm";
  return null;
}

// ─────────────────────────────────────────────────────────────────
// NUEVO — normalización de formato a mm (sesión 31/08/2026).
//
// La hoja de partida imprime la medida en cm en dos sitios distintos
// según el estilo de ficha: FORMATO ("20x120 SL RC") o DIMENSIONES
// ("600X1200", ya en mm — o a veces ni siquiera trae una medida, ej.
// "SIN PICOS EN 1A", caso real confirmado con fotos). El catálogo
// cerrado de `formato` vive siempre en mm (los 7 valores de
// 01-dominio.md). Tabla explícita en vez de heurística "×10" para que
// sea auditable a simple vista y no adivine con medidas que no son
// las 7 reales de fábrica.
// ─────────────────────────────────────────────────────────────────
const MAPA_FORMATO_A_MM: Record<string, string> = {
  "30x60": "300x600",
  "60x60": "600x600",
  "20x120": "200x1200",
  "30x120": "300x1200",
  "60x120": "600x1200",
  "90x90": "900x900",
  "120x120": "1200x1200",
  // Ya en mm — quedan igual si llegan tal cual (algunas fichas sí
  // imprimen la medida correcta en DIMENSIONES).
  "300x600": "300x600",
  "600x600": "600x600",
  "200x1200": "200x1200",
  "300x1200": "300x1200",
  "600x1200": "600x1200",
  "900x900": "900x900",
  "1200x1200": "1200x1200",
};

/** Extrae el primer "NNxNN" de un texto libre, ignorando sufijos como " SL RC". */
function extraerParNumerico(texto: string): string | null {
  const match = /(\d+)\s*x\s*(\d+)/i.exec(texto.trim());
  return match ? `${match[1]}x${match[2]}` : null;
}

/**
 * Normaliza el texto de formato (venga del campo DIMENSIONES o del
 * campo FORMATO de la hoja de partida) al nombre exacto del catálogo
 * cerrado, en mm. Acepta tanto el valor ya en mm como en cm (las 7
 * combinaciones reales de fábrica) y tolera sufijos tipo "60x120 SL
 * RC". Devuelve null si no reconoce ningún par numérico o si el par
 * no está en la tabla — quien llame decide si intentar el otro campo
 * como respaldo antes de dar el 422.
 */
export function normalizarFormato(textoBruto: string | null | undefined): string | null {
  if (!textoBruto) return null;
  const par = extraerParNumerico(textoBruto.toLowerCase());
  if (!par) return null;
  return MAPA_FORMATO_A_MM[par] ?? null;
}