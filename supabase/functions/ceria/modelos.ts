// supabase/functions/ceria/modelos.ts
//
// Selector de modelo para FASE 3 de Ceria (redactar la respuesta
// final). Fase 1 (elegir herramienta) y Fase 2 (ejecutar) NO se
// tocan aquí — siguen fijas en GPT-5-mini vía llamarOpenAI en
// index.ts, porque ahí el tool_choice:"required" de OpenAI ha sido
// 100% fiable y cambiarlo es un experimento aparte, más delicado
// (sesión 05/09/2026).
//
// Fase 3 solo necesita: "aquí tienes contexto en texto, escribe una
// respuesta en español" — ningún proveedor necesita tool-calling
// aquí (las herramientas ya se ejecutaron en Fase 2), así que los
// mensajes que le pasamos son SIEMPRE genéricos { role: "user"|
// "assistant", content: string }, sin el andamiaje de tool_calls/
// tool messages específico de OpenAI que tenía la versión anterior.
// Esto es lo que permite intercambiar de proveedor sin duplicar
// lógica de conversión por cada uno.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const TIMEOUT_MS = 45_000;

export type Proveedor = "openai" | "anthropic" | "deepseek";

export interface MensajeGenerico {
  role: "user" | "assistant";
  content: string;
}

export interface ModeloFase3 {
  id: string;
  etiqueta: string;
  proveedor: Proveedor;
  modelo: string;
}

// Catálogo — el id es lo que viaja en el body de la petición
// (`modelo_fase3`) y en el selector del frontend. "gpt-5-mini" es el
// que se usaba fijo hasta el 05/09/2026: se deja como opción 0/por
// defecto para no romper nada si el frontend no manda el campo.
export const MODELOS_FASE3: ModeloFase3[] = [
  { id: "gpt-5-mini", etiqueta: "GPT-5-mini (actual)", proveedor: "openai", modelo: "gpt-5-mini" },
  { id: "gpt-5.6-luna", etiqueta: "GPT-5.6 Luna", proveedor: "openai", modelo: "gpt-5.6-luna" },
  { id: "gpt-5.4-mini", etiqueta: "GPT-5.4 Mini", proveedor: "openai", modelo: "gpt-5.4-mini" },
  {
    id: "claude-haiku-4.5",
    etiqueta: "Claude Haiku 4.5",
    proveedor: "anthropic",
    modelo: "claude-haiku-4-5-20251001",
  },
  {
    id: "claude-sonnet-4.6",
    etiqueta: "Claude Sonnet 4.6",
    proveedor: "anthropic",
    modelo: "claude-sonnet-4-6",
  },
  { id: "deepseek-v4-flash", etiqueta: "DeepSeek V4 Flash", proveedor: "deepseek", modelo: "deepseek-v4-flash" },
  { id: "deepseek-v4-pro", etiqueta: "DeepSeek V4 Pro", proveedor: "deepseek", modelo: "deepseek-v4-pro" },
];

const MODELO_DEFECTO = MODELOS_FASE3[0];

/** Resuelve el id recibido del frontend a su config; si no existe o viene vacío, usa el de siempre (gpt-5-mini). */
export function resolverModeloFase3(id: string | null | undefined): ModeloFase3 {
  if (!id) return MODELO_DEFECTO;
  return MODELOS_FASE3.find((m) => m.id === id) ?? MODELO_DEFECTO;
}

type ResultadoLlamada = { ok: true; texto: string } | { ok: false; error: string };

/** Punto de entrada único — despacha al proveedor correcto según el modelo elegido. */
export async function llamarFase3(
  modeloConfig: ModeloFase3,
  systemPrompt: string,
  mensajes: MensajeGenerico[],
): Promise<ResultadoLlamada> {
  if (modeloConfig.proveedor === "anthropic") {
    return llamarAnthropic(modeloConfig, systemPrompt, mensajes);
  }
  return llamarEstiloOpenAI(modeloConfig, systemPrompt, mensajes);
}

async function llamarAnthropic(
  modeloConfig: ModeloFase3,
  systemPrompt: string,
  mensajes: MensajeGenerico[],
): Promise<ResultadoLlamada> {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, error: "Falta ANTHROPIC_API_KEY en la Edge Function" };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: modeloConfig.modelo,
        system: systemPrompt,
        max_tokens: 3000,
        messages: mensajes,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Anthropic (${res.status}): ${errText}` };
    }
    const data = await res.json();
    // deno-lint-ignore no-explicit-any
    const bloqueTexto = data.content?.find((b: any) => b.type === "text");
    if (!bloqueTexto?.text) {
      return { ok: false, error: "Anthropic no devolvió ningún bloque de texto" };
    }
    return { ok: true, texto: bloqueTexto.text };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: `Anthropic no respondió a tiempo (timeout de ${TIMEOUT_MS / 1000}s)` };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Cubre OpenAI y DeepSeek — ambos hablan el mismo formato /chat/completions. */
async function llamarEstiloOpenAI(
  modeloConfig: ModeloFase3,
  systemPrompt: string,
  mensajes: MensajeGenerico[],
): Promise<ResultadoLlamada> {
  const esDeepSeek = modeloConfig.proveedor === "deepseek";
  const url = esDeepSeek ? DEEPSEEK_URL : OPENAI_URL;
  const apiKey = esDeepSeek ? DEEPSEEK_API_KEY : OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: `Falta la clave de API de ${modeloConfig.proveedor} en la Edge Function` };
  }

  const body: Record<string, unknown> = {
    model: modeloConfig.modelo,
    messages: [{ role: "system", content: systemPrompt }, ...mensajes],
  };

  if (esDeepSeek) {
    body.max_tokens = 3000;
    // Fase 3 es redacción simple, no necesita el modo de pensamiento
    // visible de DeepSeek — más rápido y barato desactivado.
    body.thinking = { type: "disabled" };
  } else {
    // Familia GPT de razonamiento (gpt-5-mini, gpt-5.4-mini,
    // gpt-5.6-luna): mismo ajuste que ya usa Fase 1/Fase 3 hoy —
    // "low" evita que gaste de más pensando antes de responder.
    body.max_completion_tokens = 3000;
    body.reasoning_effort = "low";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `${modeloConfig.proveedor} (${res.status}): ${errText}` };
    }
    const data = await res.json();
    const texto = data.choices?.[0]?.message?.content;
    if (!texto) {
      return { ok: false, error: `${modeloConfig.proveedor} no devolvió ningún texto` };
    }
    return { ok: true, texto };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: `${modeloConfig.proveedor} no respondió a tiempo (timeout de ${TIMEOUT_MS / 1000}s)`,
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}