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