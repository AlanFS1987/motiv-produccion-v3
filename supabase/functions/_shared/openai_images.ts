const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Mantener el modelo en una única constante para poder cambiarlo
// cuando OpenAI publique una versión superior.
const MODEL = "gpt-image-2";
const IMAGE_SIZE = "672x1008";
const IMAGE_QUALITY = "medium";

const OPENAI_URL = "https://api.openai.com/v1/images/edits";
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Genera una imagen nueva a partir de:
 * - un prompt
 * - una imagen de referencia accesible mediante URL pública
 *
 * Devuelve la imagen generada como base64 (b64_json).
 */
export async function editarImagenPersonaje(
  prompt: string,
  imagenReferenciaUrl: string,
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY en la Edge Function " +
      "(configúrala con: supabase secrets set OPENAI_API_KEY=...)",
    );
  }

  if (!prompt?.trim()) {
    throw new Error(
      "No se recibió ningún prompt para generar la imagen del personaje",
    );
  }

  if (!imagenReferenciaUrl?.trim()) {
    throw new Error(
      "Falta la imagen de referencia (imagen_referencia_url)",
    );
  }

  // ------------------------------------------------------------
  // 1. Descargar la imagen de referencia
  // ------------------------------------------------------------

  const imagenController = new AbortController();
  const imagenTimeoutId = setTimeout(
    () => imagenController.abort(),
    15_000,
  );

  let imgRes: Response;

  try {
    imgRes = await fetch(imagenReferenciaUrl, {
      signal: imagenController.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "La descarga de la imagen de referencia ha agotado el tiempo de espera",
      );
    }

    throw new Error(
      `No se pudo descargar la imagen de referencia: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    clearTimeout(imagenTimeoutId);
  }

  if (!imgRes.ok) {
    throw new Error(
      `No se pudo descargar la imagen de referencia (${imgRes.status})`,
    );
  }

  const contentType =
    imgRes.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `La URL de referencia no devuelve una imagen válida ` +
      `(content-type: ${contentType || "desconocido"})`,
    );
  }

  const imagenBlob = await imgRes.blob();

  if (imagenBlob.size === 0) {
    throw new Error("La imagen de referencia está vacía");
  }

  // ------------------------------------------------------------
  // 2. Preparar multipart/form-data
  // ------------------------------------------------------------

  const extension = extensionDesdeMime(contentType);

  const form = new FormData();

  form.append("model", MODEL);
  form.append("prompt", prompt.trim());
  form.append("size", IMAGE_SIZE);
  form.append("quality", IMAGE_QUALITY);
  form.append(
    "image",
    imagenBlob,
    `referencia.${extension}`,
  );

  // ------------------------------------------------------------
  // 3. Llamar a OpenAI
  // ------------------------------------------------------------

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  let res: Response;

  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `La API de imágenes de OpenAI no respondió a tiempo ` +
        `(timeout de ${REQUEST_TIMEOUT_MS / 1000} s)`,
      );
    }

    throw new Error(
      `Error de conexión con la API de imágenes de OpenAI: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // ------------------------------------------------------------
  // 4. Procesar error HTTP
  // ------------------------------------------------------------

  if (!res.ok) {
    const errText = await res.text();

    throw new Error(
      `Error de la API de imágenes de OpenAI (${res.status}): ${errText}`,
    );
  }

  // ------------------------------------------------------------
  // 5. Extraer imagen
  // ------------------------------------------------------------

  const data = await res.json();

  const b64 = data?.data?.[0]?.b64_json;

  if (typeof b64 !== "string" || b64.length === 0) {
    throw new Error(
      "La respuesta de la API de imágenes no contiene ningún b64_json",
    );
  }

  return b64;
}

/**
 * Obtiene una extensión razonable a partir del MIME de la imagen.
 */
function extensionDesdeMime(contentType: string): string {
  switch (contentType.split(";")[0].trim()) {
    case "image/jpeg":
      return "jpg";

    case "image/webp":
      return "webp";

    case "image/gif":
      return "gif";

    case "image/png":
    default:
      return "png";
  }
}