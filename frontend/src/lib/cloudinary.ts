// Subida de fotos ya procesadas (recortadas + WebP) a Cloudinary.
// Ref. 06-integraciones.md 8. Sesión 15/08 tarde: se pasa de un único
// preset/carpeta compartido por todo, a un preset por categoría —
// cada uno con su "Asset folder" fijo en el propio preset (seguridad:
// el cliente no puede escribir en otra carpeta aunque quiera).
//
// "personajes" añadida 22/08/2026: reutiliza el MISMO preset unsigned
// que ya usa la Edge Function generar-personaje del lado servidor
// (CLOUDINARY_PRESET_PERSONAJES en los secrets de Supabase) — un
// preset unsigned no distingue quién sube, solo hace falta que el
// frontend también conozca su nombre (variable VITE_*, pública).

export type CategoriaCloudinary =
  | "partes"
  | "incidencias-calidad"
  | "incidencias-produccion"
  | "limpieza"
  | "personajes";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;

// Un preset por categoría — añade estas 3 variables nuevas a tu
// .env.local (la de "partes" ya existía, solo cambia de nombre si
// quieres, o déjala igual y ajusta el mapa de abajo).
const PRESETS: Record<CategoriaCloudinary, string | undefined> = {
  "partes": import.meta.env.VITE_CLOUDINARY_PRESET_PARTES as string | undefined,
  "incidencias-calidad": import.meta.env.VITE_CLOUDINARY_PRESET_INCIDENCIAS_CALIDAD as string | undefined,
  "incidencias-produccion": import.meta.env.VITE_CLOUDINARY_PRESET_INCIDENCIAS_PRODUCCION as string | undefined,
  "limpieza": import.meta.env.VITE_CLOUDINARY_PRESET_LIMPIEZA as string | undefined,
  "personajes": import.meta.env.VITE_CLOUDINARY_PRESET_PERSONAJES as string | undefined,
};

export interface ResultadoSubidaCloudinary {
  url: string;
  publicId: string;
  bytes: number;
  formato: string;
}

/**
 * Sube un blob ya procesado a Cloudinary con un public_id explícito,
 * usando el preset (y por tanto la carpeta) que corresponda a la
 * categoría indicada.
 */
export async function subirACloudinary(
  blob: Blob,
  publicId: string,
  categoria: CategoriaCloudinary,
): Promise<ResultadoSubidaCloudinary> {
  const uploadPreset = PRESETS[categoria];

  if (!CLOUD_NAME || !uploadPreset) {
    throw new Error(
      `Falta VITE_CLOUDINARY_CLOUD_NAME o el preset de la categoría "${categoria}" — revisa tu .env.local`,
    );
  }

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", uploadPreset);
  formData.append("public_id", publicId);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Error subiendo a Cloudinary (${res.status}): ${texto}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
    bytes: data.bytes as number,
    formato: data.format as string,
  };
}

/**
 * Nombre de archivo: {prefijo_}{identificador}_{timestamp}.
 * El prefijo es opcional y sirve para distinguir subtipos dentro de
 * una misma carpeta compartida (ej. "partes": hoja/caja/pantalla).
 * El timestamp es ordenable (AAAAMMDD-HHMMSS-ms) y evita choques
 * entre dos fotos del mismo identificador.
 */
export function construirPublicId(identificador: string, prefijo?: string): string {
  const idLimpio = identificador.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ahora = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const timestamp =
    `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}` +
    `-${pad(ahora.getHours())}${pad(ahora.getMinutes())}${pad(ahora.getSeconds())}` +
    `-${pad(ahora.getMilliseconds(), 3)}`;
  const base = `${idLimpio || "SINID"}_${timestamp}`;
  return prefijo ? `${prefijo}_${base}` : base;
}