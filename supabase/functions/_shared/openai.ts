// Llamada a la API de OpenAI (GPT) para OCR estructurado.
// Mismo contrato que _shared/anthropic.ts (extraerConClaude) para que
// ocr-parte/index.ts pueda usar uno como principal y el otro como
// fallback sin cambiar el resto del flujo.
//
// EN PRUEBA (20/08/2026): GPT como principal, Haiku (anthropic.ts)
// como fallback — objetivo: comparar coste y calidad de lectura antes
// de decidir cuál queda como principal en firme. Ver memorias/07-pendientes.md.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Modelo de OCR: ajustar aquí si se quiere comparar contra otro
// modelo de OpenAI durante la prueba.
const MODEL = "gpt-4o-mini";

export interface ImagenInput {
  /**
   * Preferido: URL pública (ej. de Cloudinary). GPT la descarga
   * directamente, igual que hace Claude con `source: { type: "url" }`.
   */
  url?: string;
  /**
   * Alternativa: imagen en base64 — se envía como data URI
   * (`data:{mediaType};base64,{base64}`), que es el formato que
   * espera la API de OpenAI para imágenes inline.
   */
  base64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

/**
 * Envía 1+ imágenes junto a un prompt de extracción estructurada, y
 * devuelve el JSON ya parseado. Lanza un Error si la API falla o si
 * la respuesta no es JSON válido (nunca inventa un resultado) —
 * mismo comportamiento que extraerConClaude, para que el fallback en
 * index.ts sea un simple try/catch.
 */
export async function extraerConGPT(
  prompt: string,
  imagenes: ImagenInput[],
): Promise<unknown> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY en la Edge Function " +
        "(configúrala con: supabase secrets set OPENAI_API_KEY=...)",
    );
  }
  if (!imagenes || imagenes.length === 0) {
    throw new Error("No se recibió ninguna imagen para procesar");
  }

  // deno-lint-ignore no-explicit-any
  const contenidoImagenes: any[] = imagenes.map((img, i) => {
    if (img.url) {
      return { type: "image_url", image_url: { url: img.url } };
    }
    if (img.base64 && img.mediaType) {
      return {
        type: "image_url",
        image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
      };
    }
    throw new Error(
      `La imagen en la posición ${i} no trae ni "url" ni ("base64" + "mediaType")`,
    );
  });

  // Timeout explícito: sin esto, un fetch que se queda colgado (red,
  // OpenAI sin responder) nunca llega a rechazar la promesa, así que
  // el try/catch de index.ts no salta al fallback de Claude y la app
  // se queda esperando indefinidamente (visto en real 20/08/2026).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...contenidoImagenes],
          },
        ],
        // Fuerza JSON puro, igual de estricto que parsearJsonSeguro().
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("La API de OpenAI no respondió a tiempo (timeout de 25 s)");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error de la API de OpenAI (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const texto = data.choices?.[0]?.message?.content;
  if (!texto) {
    throw new Error("La respuesta de GPT no contiene ningún bloque de texto");
  }

  return parsearJsonSeguro(texto);
}

function parsearJsonSeguro(texto: string): unknown {
  const limpio = texto.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(limpio);
  } catch {
    throw new Error(
      `No se pudo interpretar la respuesta de GPT como JSON. ` +
        `Primeros 500 caracteres: ${limpio.slice(0, 500)}`,
    );
  }
}