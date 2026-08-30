// Subida a Cloudinary desde una Edge Function (Deno), para imágenes
// que no pasan por el navegador (generadas por IA en el propio
// servidor). Mismo patrón que frontend/src/lib/cloudinary.ts —
// unsigned + preset con carpeta fija — pero recibiendo la imagen ya
// en base64 en vez de un Blob, porque aquí no hay <input type=file>.
//
// Requiere un preset NUEVO en Cloudinary para esta categoría
// (mismo proceso que los de partes/incidencias/limpieza, ver
// 05-automatismos.md): "Asset folder" fijo en el preset, unsigned,
// formatos permitidos jpg/png/webp. Nombre sugerido:
// `motiv_v3_personajes` → carpeta `motiv-produccion/personajes`.

const CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
const UPLOAD_PRESET_PERSONAJES = Deno.env.get("CLOUDINARY_PRESET_PERSONAJES");

export interface ResultadoSubidaCloudinary {
  url: string;
  publicId: string;
  bytes: number;
  formato: string;
}

/**
 * Sube una imagen en base64 (sin el prefijo data:, se añade aquí) a
 * la carpeta de personajes. `publicId` debe venir ya construido
 * (usuario + timestamp) para que cada generación quede como un
 * archivo propio, nunca sobrescribiendo la anterior.
 */
export async function subirPersonajeACloudinary(
  base64: string,
  publicId: string,
  mediaType: "image/png" | "image/jpeg" = "image/png",
): Promise<ResultadoSubidaCloudinary> {
  if (!CLOUD_NAME || !UPLOAD_PRESET_PERSONAJES) {
    throw new Error(
      "Faltan CLOUDINARY_CLOUD_NAME o CLOUDINARY_PRESET_PERSONAJES en los " +
        "secrets de la Edge Function (supabase secrets set ...)",
    );
  }

  const formData = new FormData();
  formData.append("file", `data:${mediaType};base64,${base64}`);
  formData.append("upload_preset", UPLOAD_PRESET_PERSONAJES);
  formData.append("public_id", publicId);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Error subiendo el personaje a Cloudinary (${res.status}): ${texto}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
    bytes: data.bytes as number,
    formato: data.format as string,
  };
}

/** Mismo criterio de nombre que construirPublicId del frontend. */
export function construirPublicIdPersonaje(usuarioId: string): string {
  const ahora = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const timestamp =
    `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}` +
    `-${pad(ahora.getHours())}${pad(ahora.getMinutes())}${pad(ahora.getSeconds())}` +
    `-${pad(ahora.getMilliseconds(), 3)}`;
  return `personaje_${usuarioId}_${timestamp}`;
}
// --- AÑADIR a supabase/functions/_shared/cloudinary.ts -----------
//
// Sube el PDF del informe de turno (30/08/2026). Mismo patrón que
// subirPersonajeACloudinary, pero resource_type "raw" (no es una
// imagen) y con un preset propio, acotado a esta carpeta y a
// formato pdf — es lo que permite activar "PDF and ZIP files
// delivery" en Cloudinary (Settings → Security) sin abrir esa puerta
// a cualquier otra carpeta: el riesgo que motivó desactivarlo
// (servir archivos arbitrarios) no aplica aquí porque solo esta
// Edge Function sube a este preset, nunca el navegador.
//
// Preset nuevo a crear en Cloudinary (unsigned, igual que los demás):
//   Nombre sugerido: motiv_v3_informes_turno
//   Asset folder: motiv-produccion/informes-turno
//   Allowed formats: pdf
//   Resource type del preset: raw (o "auto", pero fijar pdf en
//   Allowed formats de todas formas)
//
// Variable de entorno nueva en los secrets de la Edge Function:
//   CLOUDINARY_PRESET_INFORMES_TURNO

const UPLOAD_PRESET_INFORMES_TURNO = Deno.env.get("CLOUDINARY_PRESET_INFORMES_TURNO");

/**
 * Sube el PDF ya generado (bytes) a la carpeta de informes de turno.
 * `publicId` debe venir ya construido (fecha + tipo de turno) para
 * que el nombre del archivo sea legible si alguien lo descarga.
 */
export async function subirInformePdfACloudinary(
  pdfBytes: Uint8Array,
  publicId: string,
): Promise<ResultadoSubidaCloudinary> {
  if (!CLOUD_NAME || !UPLOAD_PRESET_INFORMES_TURNO) {
    throw new Error(
      "Faltan CLOUDINARY_CLOUD_NAME o CLOUDINARY_PRESET_INFORMES_TURNO en los " +
        "secrets de la Edge Function (supabase secrets set ...)",
    );
  }

  const formData = new FormData();
  // Blob binario directo (no base64 — evita +33% de tamaño en la
  // subida, sin problema porque aquí no hay <input type=file> que
  // fuerce pasar por FileReader como en el frontend).
  formData.append("file", new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }), `${publicId}.pdf`);
  formData.append("upload_preset", UPLOAD_PRESET_INFORMES_TURNO);
  formData.append("public_id", publicId);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Error subiendo el informe PDF a Cloudinary (${res.status}): ${texto}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
    bytes: data.bytes as number,
    formato: (data.format as string) ?? "pdf",
  };
}

/** Nombre de archivo legible: informe_turno_{fecha}_{tipo}, ej. informe_turno_20260830_M. */
export function construirPublicIdInformeTurno(fechaISO: string, tipo: string): string {
  const fechaCompacta = fechaISO.replace(/-/g, "");
  const sufijo = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `informe_turno_${fechaCompacta}_${tipo}_${sufijo}`;
}