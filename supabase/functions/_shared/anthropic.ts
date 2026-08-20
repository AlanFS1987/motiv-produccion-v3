// Llamada a la API de Anthropic (Claude) para OCR estructurado.
// Ref. 06-integraciones.md 8, 11-esquema-supabase.md 13.7 (ocr-parte).

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_VERSION = "2023-06-01";

// Modelo de OCR: Haiku, decisión basada en 5 meses de uso real en
// producción (v2) — sin fallos salvo en casos donde Sonnet también
// fallaría (reflejo en pantalla ilegible ni para un humano). Cambiar
// aquí si en el futuro se quiere comparar contra otro modelo.
const MODEL = "claude-haiku-4-5-20251001";

export interface ImagenInput {
  /**
   * Preferido: URL pública (ej. de Cloudinary, ya subida por el
   * cliente tras redimensionar/recortar — ver 01-rol-responsable.md
   * 3.6). Claude la descarga directamente, sin pasar el peso de la
   * imagen por esta Edge Function.
   */
  url?: string;
  /**
   * Alternativa: imagen en base64, para cuando no hay (o no conviene)
   * subir antes a Cloudinary — ej. pruebas manuales, o un futuro
   * camino sin almacenamiento externo. Requiere mediaType.
   */
  base64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

/**
 * Envía 1+ imágenes junto a un prompt de extracción estructurada, y
 * devuelve el JSON ya parseado. Lanza un Error si la API falla o si
 * la respuesta no es JSON válido (nunca inventa un resultado).
 */
export async function extraerConClaude(
  prompt: string,
  imagenes: ImagenInput[],
): Promise<unknown> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta la variable de entorno ANTHROPIC_API_KEY en la Edge Function " +
        "(configúrala con: supabase secrets set ANTHROPIC_API_KEY=...)",
    );
  }
  if (!imagenes || imagenes.length === 0) {
    throw new Error("No se recibió ninguna imagen para procesar");
  }

  // deno-lint-ignore no-explicit-any
  const content: any[] = imagenes.map((img, i) => {
    if (img.url) {
      return { type: "image", source: { type: "url", url: img.url } };
    }
    if (img.base64 && img.mediaType) {
      return {
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      };
    }
    throw new Error(
      `La imagen en la posición ${i} no trae ni "url" ni ("base64" + "mediaType")`,
    );
  });
  content.push({ type: "text", text: prompt });

  // Mismo motivo que en openai.ts: sin timeout, un fetch colgado deja
  // la Edge Function esperando indefinidamente y el responsable se
  // queda mirando el spinner sin ningún error al que reaccionar.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("La API de Anthropic no respondió a tiempo (timeout de 25 s)");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error de la API de Anthropic (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const bloqueTexto = data.content?.find(
    // deno-lint-ignore no-explicit-any
    (b: any) => b.type === "text",
  );
  if (!bloqueTexto) {
    throw new Error("La respuesta de Claude no contiene ningún bloque de texto");
  }

  return parsearJsonSeguro(bloqueTexto.text);
}

function parsearJsonSeguro(texto: string): unknown {
  const limpio = texto.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(limpio);
  } catch {
    throw new Error(
      `No se pudo interpretar la respuesta de Claude como JSON. ` +
        `Primeros 500 caracteres: ${limpio.slice(0, 500)}`,
    );
  }
}