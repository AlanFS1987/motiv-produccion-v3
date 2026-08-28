// Procesamiento de fotos en el cliente, antes de subir a Cloudinary.
// Ref. 01-rol-responsable.md 3.2/3.5/3.6 (preprocesado de imagen).
//
// REPARTO HÍBRIDO DE CÁMARA (sesión 28/08/2026): no todas las fotos
// usan el mismo mecanismo.
// - Hoja (Foto 1), Pantalla (Foto 3) y Limpieza: cámara NATIVA
//   (<input capture="environment">) + galería. Sin vista previa en
//   directo, así que usan procesarFotoLibre (solo redimensiona, NUNCA
//   recorta) — con cámara nativa no hay forma de garantizar que un
//   recorte centrado a ciegas no corte contenido importante.
// - Caja (Foto 2a/2b): cámara EN VIVO (useCamaraLive/getUserMedia),
//   porque el recuadro-guía en pantalla en tiempo real sí permite un
//   recorte fiable — crítico en "caja_lateral", que es una franja muy
//   estrecha y alargada (1600x300). Usa procesarFoto/
//   capturarFotogramaVideo (con recorte).
//
// Solo funciona en navegador (usa HTMLCanvasElement).

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
 * Resolución de referencia de cada forma de foto. Para hoja/pantalla/
 * limpieza es solo el ancho de destino del recuadro-guía visual (ya
 * no fuerza recorte). Para caja_superior/caja_lateral SÍ es la
 * resolución final real, porque ahí sigue habiendo recorte.
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

export function formaAFotoTipoOcr(forma: FormaFoto): "hoja_partida" | "caja" | "pantalla" {
  if (forma === "caja_superior" || forma === "caja_lateral") return "caja";
  if (forma === "limpieza") {
    throw new Error('"limpieza" no pasa por OCR — no tiene foto_tipo asociado en ocr-parte');
  }
  return forma;
}

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

export function calcularRecorteCentrado(
  anchoOrigen: number,
  altoOrigen: number,
  forma: FormaFoto,
): RectanguloRecorte {
  if (anchoOrigen <= 0 || altoOrigen <= 0) {
    throw new Error(`Dimensiones de origen inválidas: ${anchoOrigen}x${altoOrigen}`);
  }

  const objetivo = relacionAspecto(forma);
  const origenRatio = anchoOrigen / altoOrigen;

  let anchoRecorte: number;
  let altoRecorte: number;

  if (origenRatio > objetivo) {
    altoRecorte = altoOrigen;
    anchoRecorte = altoOrigen * objetivo;
  } else {
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

export function soportaWebP(): boolean {
  if (_soportaWebPCache !== null) return _soportaWebPCache;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  _soportaWebPCache = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return _soportaWebPCache;
}

/**
 * Recorta la imagen a la proporción del recuadro-guía de `forma` y la
 * escala a su resolución de referencia. Usada por el flujo de CAJA
 * (cámara en vivo), donde el recuadro en pantalla garantiza que el
 * recorte coincide con lo que el usuario ve.
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

  ctx.drawImage(origen, recorte.x, recorte.y, recorte.ancho, recorte.alto, 0, 0, ancho, alto);

  const mediaType: "image/webp" | "image/jpeg" = soportaWebP() ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mediaType, CALIDAD_COMPRESION));
  if (!blob) {
    throw new Error(`No se pudo generar la imagen procesada (${mediaType}) — el navegador podría no soportar este formato en canvas.toBlob`);
  }

  return { blob, ancho, alto, mediaType };
}

const MAX_DIMENSION_DECODE = 2400;

/**
 * FIX (28/08/2026): imageOrientation "from-image" — sin esto,
 * createImageBitmap ignora la rotación EXIF de las fotos de cámara.
 */
export async function cargarImagenDesdeArchivo(archivo: File | Blob): Promise<HTMLImageElement | ImageBitmap> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(archivo, {
        resizeWidth: MAX_DIMENSION_DECODE,
        resizeQuality: "medium",
        imageOrientation: "from-image",
      });
    } catch {
      // cae al camino de siempre
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
 * Sin recorte forzado — solo redimensiona y codifica. Usada por Hoja,
 * Pantalla y Limpieza (cámara nativa, sin vista previa en directo).
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
 * Captura el fotograma actual de un <video> en vivo, recortado.
 * Usada por CamaraEnVivo / useCamaraLive (flujo de CAJA).
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
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mediaType, CALIDAD_COMPRESION));
  if (!blob) {
    throw new Error(`No se pudo generar la imagen procesada (${mediaType}) — el navegador podría no soportar este formato en canvas.toBlob`);
  }

  return { blob, ancho, alto, mediaType };
}