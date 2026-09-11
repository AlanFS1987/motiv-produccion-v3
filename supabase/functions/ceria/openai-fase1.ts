// supabase/functions/ceria/openai-fase1.ts
//
// Llamada a OpenAI para Fase 1 (elegir herramienta, tool_choice
// "required") y para el caso especial get_identidad (redacción
// directa). Fijo en gpt-5-mini — NO intercambiable como Fase 3 (ver
// modelos.ts): aquí tool_choice:"required" de OpenAI ha sido 100%
// fiable en real, cambiar de proveedor es un experimento aparte más
// delicado (decisión 05/09/2026).

export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Modelo: gpt-5-mini (decisión de sesión — la empresa confía en GPT
// sobre otros proveedores). Cambiar aquí si se quiere comparar.
const MODEL = "gpt-5-mini";

// deno-lint-ignore no-explicit-any
export async function llamarOpenAI(
  body: Record<string, unknown>,
): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, ...body }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `OpenAI (${res.status}): ${errText}` };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "OpenAI no respondió a tiempo (timeout de 60s)" };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}
