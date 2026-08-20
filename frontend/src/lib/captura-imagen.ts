// Procesamiento de fotos en el cliente, antes de subir a Cloudinary.
// Ref. 01-rol-responsable.md 3.2/3.5/3.6 (preprocesado de imagen),
// decisión de sesión: 4 formas de foto con resolución fija cada una,
// recuadro-guía en pantalla que coincide con la proporción de recorte.
//
// Solo funciona en navegador (usa HTMLCanvasElement) — se integra en
// la pantalla de captura del responsable cuando construyamos el
// frontend.

/**
 * Las 4 formas físicas de foto del flujo de captura de parte.
 * "caja_superior" y "caja_lateral" son las dos caras de la Foto 2
 * (verificación de caja, 3.5) — se capturan por separado (cada una
 * con su propio recuadro-guía) pero se envían juntas a ocr-parte
 * como foto_tipo="caja".
 */
export type FormaFoto = "hoja_partida" | "caja_superior" | "caja_lateral" | "pantalla" | "limpieza";

export interface EspecificacionFoto {
  ancho: number;
  alto: number;
}

/**
 * Resolución final (tras recorte + escalado) de cada forma de foto.
 * "caja_lateral" es deliberadamente estrecha y alargada: en esa cara
 * de la caja casi todo el encuadre natural es fondo/suelo de fábrica,
 * así que un recuadro-guía alargado concentra los mismos píxeles en
 * la franja de texto real (01-rol-responsable.md 3.6).
 */
export const ESPECIFICACIONES_FOTO: Record<FormaFoto, EspecificacionFoto> = {
  hoja_partida: { ancho: 1600, alto: 1200 },
  caja_superior: { ancho: 1600, alto: 1200 },
  caja_lateral: { ancho: 1600, alto: 300 },
  pantalla: { ancho: 1600, alto: 1200 },
  limpieza: { ancho: 1600, alto: 1200 },
};

export function relacionAspecto(forma: FormaFoto): number {
  const spec = ESPECIFICACIONES_FOTO[forma];
  return spec.ancho / spec.alto;
}

/**
 * ocr-parte agrupa "caja_superior" y "caja_lateral" bajo un único
 * foto_tipo="caja" (puede recibir 1 o 2 imágenes juntas, según
 * formato — 01-rol-responsable.md 3.5). Este mapeo traduce la forma
 * de captura (más granular, por la UI/recuadro-guía) al foto_tipo que
 * entiende la Edge Function.
 */
export function formaAFotoTipoOcr(forma: FormaFoto): "hoja_partida" | "caja" | "pantalla" {
  if (forma === "caja_superior" || forma === "caja_lateral") return "caja";
  if (forma === "limpieza") {
    throw new Error('"limpieza" no pasa por OCR — no tiene foto_tipo asociado en ocr-parte');
  }
    return forma;
}

/**
 * Valor listo para usar en CSS (aspect-ratio: valor) al dibujar el
 * recuadro-guía de la cámara para una forma de foto dada.
 */
export function cssAspectRatio(forma: FormaFoto): string {
  const spec = ESPECIFICACIONES_FOTO[forma];
  return `${spec.ancho} / ${spec.alto}`;
}

export interface RectanguloRecorte {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Calcula el rectángulo de recorte centrado, con la proporción exacta
 * del recuadro-guía de `forma`, más grande posible dentro de una
 * imagen de origen anchoOrigen x altoOrigen. Es la misma matemática
 * que "object-fit: cover" centrado.
 */
export function calcularRecorteCentrado(
  anchoOrigen: number,
  altoOrigen: number,
  forma: FormaFoto,
): RectanguloRecorte {
  if (anchoOrigen <= 0 || altoOrigen <= 0) {
    throw new Error(
      `Dimensiones de origen inválidas: ${anchoOrigen}x${altoOrigen}`,
    );
  }

  const objetivo = relacionAspecto(forma);
  const origenRatio = anchoOrigen / altoOrigen;

  let anchoRecorte: number;
  let altoRecorte: number;

  if (origenRatio > objetivo) {
    // el origen es más "ancho" que el objetivo -> sobran los lados
    altoRecorte = altoOrigen;
    anchoRecorte = altoOrigen * objetivo;
  } else {
    // el origen es más "alto"/estrecho que el objetivo -> sobra arriba/abajo
    anchoRecorte = anchoOrigen;
    altoRecorte = anchoOrigen / objetivo;
  }

  return {
    x: (anchoOrigen - anchoRecorte) / 2,
    y: (altoOrigen - altoRecorte) / 2,
    ancho: anchoRecorte,
    alto: altoRecorte,
  };
}

export interface ImagenProcesada {
  blob: Blob;
  ancho: number;
  alto: number;
  mediaType: "image/webp" | "image/jpeg";
}

const CALIDAD_COMPRESION = 0.85;

let _soportaWebPCache: boolean | null = null;

/**
 * Detecta si el navegador puede CODIFICAR WebP vía canvas (no solo
 * decodificarlo) — algunos navegadores antiguos (Safari viejo) no
 * pueden. Si no puede, procesarFoto() cae a JPEG automáticamente en
 * vez de fallar.
 */
export function soportaWebP(): boolean {
  if (_soportaWebPCache !== null) return _soportaWebPCache;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  _soportaWebPCache = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return _soportaWebPCache;
}

/**
 * Recorta la imagen capturada a la proporción del recuadro-guía de
 * `forma`, la escala a la resolución final de esa foto, y la
 * codifica (WebP si el navegador lo soporta, si no JPEG). Este es el
 * único sitio donde se decide resolución/formato — coherente con
 * 09-requisitos-no-funcionales.md 11.6 (WebP reduce almacenamiento en
 * Cloudinary sin afectar al OCR, que admite WebP de forma nativa).
 */
export async function procesarFoto(
  origen: HTMLImageElement | ImageBitmap,
  forma: FormaFoto,
): Promise<ImagenProcesada> {
  const anchoOrigen = "naturalWidth" in origen ? origen.naturalWidth : origen.width;
  const altoOrigen = "naturalHeight" in origen ? origen.naturalHeight : origen.height;

  const recorte = calcularRecorteCentrado(anchoOrigen, altoOrigen, forma);
  const { ancho, alto } = ESPECIFICACIONES_FOTO[forma];

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }

  ctx.drawImage(
    origen,
    recorte.x,
    recorte.y,
    recorte.ancho,
    recorte.alto,
    0,
    0,
    ancho,
    alto,
  );

  const mediaType: "image/webp" | "image/jpeg" = soportaWebP() ? "image/webp" : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mediaType, CALIDAD_COMPRESION),
  );

  if (!blob) {
    throw new Error(
      `No se pudo generar la imagen procesada (${mediaType}) — el navegador podría no soportar este formato en canvas.toBlob`,
    );
  }

  return { blob, ancho, alto, mediaType };
}

/**
 * Carga un File/Blob de la cámara/galería como HTMLImageElement, listo
 * para pasar a calcularRecorteCentrado()/procesarFoto(). Libera el
 * object URL temporal en cuanto la imagen termina de cargar.
 */
/**
 * Tope de la dimensión mayor al decodificar — de sobra para el
 * recorte/OCR posterior (que nunca pide más de 1600px), pero evita
 * que un móvil con cámara de muchos megapíxeles (ej. 108MP en según
 * qué Xiaomi) decodifique la foto "en el acto" a resolución completa
 * en memoria. Detectado en sesión: eso podía consumir 400MB+ y hacía
 * que el navegador matara la pestaña en silencio (sin ningún error
 * JS capturable) — se veía como "la app vuelve sola a la pantalla de
 * turno" al hacer la foto en directo, mientras que elegir de galería
 * sí funcionaba (el selector de Android ya suele devolver una versión
 * reducida).
 */
const MAX_DIMENSION_DECODE = 2400;

export async function cargarImagenDesdeArchivo(archivo: File | Blob): Promise<HTMLImageElement | ImageBitmap> {
  if ("createImageBitmap" in window) {
    try {
      // Fijar solo resizeWidth conserva la proporción original — vale
      // igual para fotos en horizontal o vertical, el resultado queda
      // acotado en ambas dimensiones porque la relación de aspecto de
      // una foto normal nunca es extrema.
      return await createImageBitmap(archivo, {
        resizeWidth: MAX_DIMENSION_DECODE,
        resizeQuality: "medium",
      });
    } catch {
      // Si falla por lo que sea (navegador raro, formato no
      // soportado), cae al camino de siempre.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen capturada"));
    };
    img.src = url;
  });
}
/**
 * Procesa una foto SIN recorte forzado (a diferencia de procesarFoto,
 * pensada para las fotos guiadas del OCR) — solo reduce a un ancho
 * máximo y codifica a WebP/JPEG. Para fotos de documentación libre
 * (incidencias de calidad/producción), donde no hay un encuadre fijo
 * que respetar.
 */
export async function procesarFotoLibre(
  origen: HTMLImageElement | ImageBitmap,
  anchoMaximo = 1600,
): Promise<ImagenProcesada> {
  const anchoOrigen = "naturalWidth" in origen ? origen.naturalWidth : origen.width;
  const altoOrigen = "naturalHeight" in origen ? origen.naturalHeight : origen.height;

  const escala = Math.min(1, anchoMaximo / anchoOrigen);
  const ancho = Math.round(anchoOrigen * escala);
  const alto = Math.round(altoOrigen * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  ctx.drawImage(origen, 0, 0, ancho, alto);

  const mediaType: "image/webp" | "image/jpeg" = soportaWebP() ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mediaType, CALIDAD_COMPRESION));
  if (!blob) {
    throw new Error(`No se pudo generar la imagen procesada (${mediaType})`);
  }

  return { blob, ancho, alto, mediaType };
}
/**
 * Captura el fotograma actual de un <video> en vivo, recortado a la
 * proporción del recuadro-guía de `forma` (misma matemática que
 * calcularRecorteCentrado/procesarFoto) y ya codificado como Blob
 * final — usado por CamaraEnVivo.tsx en vez de <input capture>, que
 * delega en la app de Cámara nativa del sistema.
 *
 * Motivo del cambio (sesión 18/08/2026): en varios Xiaomi (Redmi Note
 * 12 Pro+ y 8 Pro probados), al volver de la app de Cámara nativa,
 * Chrome recargaba la pestaña entera en vez de devolver el foco
 * (confirmado con DevTools remoto: "the tab is inactive" al abrir la
 * cámara, recarga completa de la página al volver) — esto perdía
 * todo el progreso de la captura del parte, sin ningún error JS
 * capturable (no es un fallo de nuestro código, es un comportamiento
 * del navegador). Al capturar el fotograma sin salir nunca de la
 * página (getUserMedia en vez de <input capture>), la pestaña nunca
 * pierde el foco y el problema desaparece de raíz.
 */
export async function capturarFotogramaVideo(
  video: HTMLVideoElement,
  forma: FormaFoto,
): Promise<ImagenProcesada> {
  const anchoOrigen = video.videoWidth;
  const altoOrigen = video.videoHeight;

  const recorte = calcularRecorteCentrado(anchoOrigen, altoOrigen, forma);
  const { ancho, alto } = ESPECIFICACIONES_FOTO[forma];

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }

  ctx.drawImage(video, recorte.x, recorte.y, recorte.ancho, recorte.alto, 0, 0, ancho, alto);

  const mediaType: "image/webp" | "image/jpeg" = soportaWebP() ? "image/webp" : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mediaType, CALIDAD_COMPRESION),
  );

  if (!blob) {
    throw new Error(
      `No se pudo generar la imagen procesada (${mediaType}) — el navegador podría no soportar este formato en canvas.toBlob`,
    );
  }

  return { blob, ancho, alto, mediaType };
}