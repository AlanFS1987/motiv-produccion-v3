// Normalización y validación de texto libre del flujo de captura de
// parte. Ref. 01-rol-responsable.md 3.2, 05-modelo-de-datos.md 7.4
// (Paso 1bis).
//
// Dos usos distintos, ambos client-side:
// 1. Comparar Foto 2 (caja) contra lo ya resuelto en Foto 1, sin ida
//    y vuelta a Supabase (verificación de caja, 3.5).
// 2. Validar/formatear lo que el responsable escribe a mano (tono,
//    calibre) antes de guardar.
//
// La normalización "oficial" de modelo/marca contra el catálogo
// (pg_trgm, creación/fusión) vive en resolver-catalogo — este archivo
// NO decide qué se guarda en `modelo`/`marca`, solo ayuda a comparar
// texto en el cliente.

/**
 * Normaliza texto libre (modelo, marca, acabado) para comparación:
 * mayúsculas; conserva letras (con acentos y Ñ), números, espacios y
 * los símbolos - / . &; el resto de caracteres especiales se
 * sustituye por espacio; espacios múltiples colapsados; recortado.
 * Ver regla completa en 01-rol-responsable.md 3.2.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/[^\p{L}0-9\s\-/.&]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TonoDescompuesto {
  /** Prefijo de fábrica, si lo había (ej. "5" en "5M10"). null si no. */
  prefijo: string | null;
  /** Tono real, letra + dígitos, sin prefijo (ej. "M10"). */
  tonoReal: string;
}

const PATRON_TONO = /^(\d*)([A-Za-zÑñ])([0-9OoIil]+)$/;

/**
 * Separa el prefijo de fábrica (si existe) del tono real. La ficha de
 * partida (Foto 1) nunca trae prefijo; la caja/pieza sí puede traerlo
 * (ej. "5M10" = fábrica 5 + tono M10). Ver 01-rol-responsable.md 3.2
 * ("Formato de tono").
 *
 * Corrige además confusiones típicas del OCR en la zona de dígitos
 * (letra "O" leída en vez de "0", "I"/"L" en vez de "1") — solo ahí,
 * nunca en la letra de tono en sí, que sí puede ser cualquier letra
 * real (sesión 15/08 tarde, defecto real detectado: "M01" vs "5MO1").
 *
 * Si `tono` no encaja con el patrón letra+dígitos, se devuelve tal
 * cual (mayúsculas) como tonoReal, sin prefijo — mejor no bloquear
 * que forzar un formato que a veces tiene excepciones reales.
 */
export function normalizarTono(tono: string): TonoDescompuesto {
  const limpio = tono.trim().toUpperCase();
  const match = PATRON_TONO.exec(limpio);
  if (!match) {
    return { prefijo: null, tonoReal: limpio };
  }
  const [, prefijo, letra, digitosBrutos] = match;
  const digitos = digitosBrutos.replace(/O/g, "0").replace(/[IL]/g, "1");
  return {
    prefijo: prefijo.length > 0 ? prefijo : null,
    tonoReal: `${letra}${digitos}`,
  };
}

/**
 * Compara dos tonos ignorando el prefijo de fábrica de cada uno —
 * uso típico: comparar el tono de Foto 1 (sin prefijo) contra el
 * leído en la caja de Foto 2 (con prefijo).
 */
export function compararTono(tonoA: string, tonoB: string): boolean {
  return normalizarTono(tonoA).tonoReal === normalizarTono(tonoB).tonoReal;
}

/**
 * Compara dos calibres ignorando ceros a la izquierda — la hoja de
 * partida puede traer "03" y la caja "3", mismo valor real (sesión
 * 15/08 tarde, defecto real detectado). Si alguno de los dos no es
 * puramente numérico (caso raro pero posible en calibre, a diferencia
 * de tono), cae a comparación de texto normal como red de seguridad.
 */
export function compararCalibre(calibreA: string, calibreB: string): boolean {
  // Se extraen solo los dígitos, descartando cualquier palabra que
  // venga pegada al número (ej. OCR devolviendo "CALIBRE 3" en vez
  // de "3") — así el número real siempre se compara limpio, tanto si
  // solo llegan dígitos como si llega texto de más.
  const soloDigitos = (valor: string) => valor.replace(/\D/g, "");
  const a = soloDigitos(calibreA);
  const b = soloDigitos(calibreB);
  if (a !== "" && b !== "") return parseInt(a, 10) === parseInt(b, 10);
  return limpiarEntradaTonoCalibre(calibreA) === limpiarEntradaTonoCalibre(calibreB);
}

/**
 * Calcula la sugerencia de tono real = tono_ant + 1 (01-rol-
 * responsable.md 3.2). Devuelve null si `tonoAnt` viene vacío o no
 * tiene forma letra+dígitos — en ese caso el responsable escribe el
 * tono directamente, sin sugerencia de partida.
 *
 * Nota: si el incremento hace que el nº de dígitos crezca (ej. "M99"
 * -> "M100"), se deja crecer sin recortar — mejor un tono de 3 dígitos
 * real que uno de 2 dígitos truncado.
 */
export function sugerirTonoSiguiente(tonoAnt: string | null | undefined): string | null {
  if (!tonoAnt || tonoAnt.trim() === "") return null;
  const limpio = tonoAnt.trim().toUpperCase();
  const match = /^([A-ZÑ])(\d+)$/.exec(limpio);
  if (!match) return null;
  const [, letra, digitos] = match;
  const siguiente = parseInt(digitos, 10) + 1;
  const digitosSiguiente = String(siguiente).padStart(digitos.length, "0");
  return `${letra}${digitosSiguiente}`;
}

const PATRON_VALIDO_TONO_CALIBRE = /^[A-ZÑ0-9]+$/;

/**
 * Valida tono/calibre tal como los guarda la app: solo mayúsculas,
 * sin espacios, sin caracteres especiales, un único token (01-rol-
 * responsable.md 3.2).
 */
export function esTonoCalibreValido(valor: string): boolean {
  return PATRON_VALIDO_TONO_CALIBRE.test(valor.trim());
}

/**
 * Para usar en el onChange de un <input> de tono/calibre: fuerza
 * mayúsculas y descarta sobre la marcha cualquier carácter que no
 * vaya a pasar esTonoCalibreValido, así el campo nunca llega a un
 * estado inválido mientras el responsable escribe.
 */
export function limpiarEntradaTonoCalibre(valor: string): string {
  return valor.toUpperCase().replace(/[^A-ZÑ0-9]/g, "");
}

/**
 * El "modelo" en la hoja de partida es un código de producto completo
 * (ej. "SL IRON DARK (PRC)60X120RC/MYK2_S"), pero solo la parte antes
 * del paréntesis es el nombre real del modelo — el resto es un código
 * técnico interno. Corte determinista, no delegado al OCR.
 */
export function extraerModeloVisible(modeloCompleto: string): string {
  const indiceParentesis = modeloCompleto.indexOf("(");
  if (indiceParentesis === -1) return modeloCompleto.trim();
  return modeloCompleto.slice(0, indiceParentesis).trim();
}

/**
 * Parsea un número en formato español (punto = miles, coma =
 * decimales) tal como aparece impreso en la hoja de partida (ej.
 * "2.000,000" -> 2000). Se usa en vez de pedirle a Claude que
 * interprete el formato — falla con frecuencia en esa interpretación
 * (ver sesión real: "2.000,000" leído como 2000000).
 */
export function parsearNumeroEspanol(texto: string | null): number | null {
  if (!texto || texto.trim() === "") return null;
  const sinMiles = texto.trim().replace(/\./g, "");
  const conPuntoDecimal = sinMiles.replace(",", ".");
  const numero = parseFloat(conPuntoDecimal);
  return isNaN(numero) ? null : numero;
}