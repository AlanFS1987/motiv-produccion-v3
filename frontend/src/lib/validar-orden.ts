// Validación de Nº de orden y objetivo (m²) de la hoja de partida (Foto 1).
// Datos reales: los lotes tienen 7 dígitos y empiezan por 11; el objetivo va de 100 a 50.000 m²,
// siempre entero. COPIA IDÉNTICA en supabase/functions/_shared/validacion-orden.ts (segunda
// barrera en resolver-catalogo): si cambias una, cambia la otra (tests/validar-orden.test.ts
// comprueba que ambas dan lo mismo).

export const PATRON_NUMERO_ORDEN = /^11\d{5}$/;
export const OBJETIVO_MIN_M2 = 100;
export const OBJETIVO_MAX_M2 = 50000;

export const MENSAJE_ORDEN_INVALIDA = "7 dígitos y empieza por 11";
export const MENSAJE_OBJETIVO_INVALIDO = "Entre 100 y 50.000 m² (número entero)";

export interface ResultadoCampo<T> {
  /** Valor ya normalizado; null si no es válido. */
  valor: T | null;
  /** true si el valor válido difiere de lo leído/escrito (se enseña en ámbar). */
  corregido: boolean;
  /** Texto de partida, tal cual. */
  original: string;
  /** Mensaje en rojo; null si es válido. */
  error: string | null;
}

/** Quita todo lo que no sea un dígito y exige /^11\d{5}$/. */
export function normalizarNumeroOrden(texto: string | null | undefined): ResultadoCampo<string> {
  const original = (texto ?? "").trim();
  const digitos = original.replace(/\D/g, "");
  if (!PATRON_NUMERO_ORDEN.test(digitos)) {
    return { valor: null, corregido: false, original, error: MENSAJE_ORDEN_INVALIDA };
  }
  return { valor: digitos, corregido: digitos !== original, original, error: null };
}

function enRango(n: number): boolean {
  return n >= OBJETIVO_MIN_M2 && n <= OBJETIVO_MAX_M2;
}

/**
 * Objetivo a partir de solo dígitos (enteros siempre): >= 1.000.000 se divide entre 1000 y se
 * redondea; entre 1 y 99 se multiplica por 1000; en ambos casos solo si cae en 100-50.000.
 * Devuelve null si no hay valor válido.
 */
export function objetivoDesdeDigitos(digitos: string): { valor: number; corregido: boolean } | null {
  if (digitos === "") return null;
  const n = parseInt(digitos, 10);
  if (enRango(n)) return { valor: n, corregido: false };
  if (n >= 1000000) {
    const r = Math.round(n / 1000);
    return enRango(r) ? { valor: r, corregido: true } : null;
  }
  if (n >= 1 && n <= 99) {
    const r = n * 1000;
    return enRango(r) ? { valor: r, corregido: true } : null;
  }
  return null;
}

function formatoMiles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Objetivo (m²) desde el texto leído por el OCR o escrito a mano. Primero se intenta el formato
 * español impreso en la hoja ("2.000,000" -> 2000: punto = miles, coma = decimales) y solo si no
 * da un entero en rango se limpia a dígitos y se aplican las correcciones de escala.
 */
export function normalizarObjetivoM2(texto: string | null | undefined): ResultadoCampo<number> {
  const original = (texto ?? "").trim();
  const invalido: ResultadoCampo<number> = { valor: null, corregido: false, original, error: MENSAJE_OBJETIVO_INVALIDO };

  const espanol = parseFloat(original.replace(/\./g, "").replace(",", "."));
  if (/^\d[\d.]*(,\d+)?$/.test(original) && Number.isInteger(espanol) && enRango(espanol)) {
    return { valor: espanol, corregido: false, original, error: null };
  }

  const r = objetivoDesdeDigitos(original.replace(/\D/g, ""));
  if (!r) return invalido;
  // Solo se enseña como corrección si cambia el número que el usuario ve (no los puntos de miles).
  return { valor: r.valor, corregido: r.corregido, original, error: null };
}

/** Texto ámbar de una corrección de objetivo: «Corregido: 11.000.000 -> 11.000». */
export function textoCorreccionObjetivo(original: string, valor: number): string {
  const antes = /^\d+$/.test(original) ? formatoMiles(Number(original)) : original;
  return `Corregido: ${antes} -> ${formatoMiles(valor)}`;
}

/** Validación del servidor: objetivo recibido como número (nunca texto). */
export function normalizarObjetivoNumero(n: unknown): ResultadoCampo<number> {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
    return { valor: null, corregido: false, original: String(n), error: MENSAJE_OBJETIVO_INVALIDO };
  }
  const r = objetivoDesdeDigitos(String(n));
  if (!r) return { valor: null, corregido: false, original: String(n), error: MENSAJE_OBJETIVO_INVALIDO };
  return { valor: r.valor, corregido: r.corregido, original: String(n), error: null };
}

/** Modelos «coincidentes»: normalizados y uno contenido en el otro (ninguno vacío). */
export function modelosCoinciden(a: string, b: string, normalizar: (t: string) => string): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x === "" || y === "") return false;
  return x.includes(y) || y.includes(x);
}
