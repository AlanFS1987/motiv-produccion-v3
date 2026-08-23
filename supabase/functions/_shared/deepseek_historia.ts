// supabase/functions/_shared/deepseek_historia.ts
//
// Genera la historia de origen del personaje RPG con DeepSeek.
// Mismo patrón que _shared/openai_images.ts (constantes de config al
// principio, una función exportada), pero con una diferencia
// deliberada: esta función NUNCA lanza. Si algo falla (falta la key,
// timeout, respuesta rara), devuelve `null` y quien la llama decide
// qué hacer — la generación del personaje (imagen ya generada) no
// debe fallar por culpa de la historia. El fallo se notifica al
// operario en el frontend ("tu historia se está preparando") y el
// administrador la rellena a mano en la BD mientras no haya un
// mecanismo de reintento automático.

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const REQUEST_TIMEOUT_MS = 30_000;

// Prompt de contexto/lore — heredado de v2, con el límite de frases
// corregido (v2 tenía una contradicción real: el system decía 6
// frases y el mensaje user decía 3 — nos quedamos con 3, ver sesión
// de diseño 23/08/2026) y una instrucción explícita añadida para que
// no corte una frase a medias.
const SYSTEM_PROMPT_HISTORIA = `Crea historias de origen para los operarios con las siguientes reglas:

- MÁXIMO 3 frases. Las 3 frases deben quedar completas — nunca cortes una a medias; si hace falta, usa menos frases pero que estén enteras.
- Cada frase, corta y directa: máximo unas 20-25 palabras. Nada de encadenar varias ideas con comas, "y", "pero" o "aunque" dentro de la misma frase — si una frase necesita más de una coma para explicarse, son DOS frases, no una.
- NO cuentes una historia con principio-nudo-desenlace. No es una narración continua: son 3 pinceladas sueltas e independientes sobre el operario, cada una podría borrarse sin que las otras dos dejen de tener sentido.
- Menciona como mucho UNA máquina o UN problema por frase — no acumules varios en la misma frase para intentar meter más contenido.
- Estilo: natural, divertido, con un punto de humor de fábrica. Ocasionalmente puede ser un poco cachondo pero sin pasarse (nada guarro).

Contexto de máquinas y problemas comunes que puedes mencionar:

- La empaquetadora: mete azulejos en cajas. Problemas: se engancha el cartón, tira mal la cola, las ventosas no chupan, las cajas salen rotas, más cola en las cadenas de tracción que en el calderín de la cola, cartón muy doblado hay que hacer papiroflexia.
- El acoplador: acopla cajas creando paquetes. Problemas: se bloquea, dispara el variador, se caen las cajas, mezcla códigos.
- El paletizador: coge paquetes y los pone en palets. Problemas: monta mal los palets, catapulta paquetes con el volteador, los paquetes de 60x120 que van en vertical se caen, monta los paquetes fuera del palet, el espesor del material es tan grueso que no caben los paquetes en el palet.
- La línea: por donde los azulejos viajan. Problemas: se engancha el girador creando una montaña de azulejos, pierde códigos, falla el calibre.
- Los apiladores: apilan azulejos. Problemas: se enganchan, fallan ventosas, rompen azulejos, pierden piezas.
- La Qualitron: inspecciona calidad. Problemas: falsea y tira material bueno al rompedor, o envía el malo a la caja, una gota solo visible por el ojo humano hizo que el material se clasificara a mano.
- El rompedor: tritura material defectuoso. Problemas: se engancha y bloquea cuando el material es muy malo y rompe demasiado, hace mucho ruido, saltan tiestos disparados, paradas para cambiar calderos cada 5 minutos por material muy defectuoso, dos piezas una sobre otra entraron al rompedor y se enganchó.
- Las impresoras: imprimen en el cartón modelo, características y marca. Problemas: cajas sin imprimir, mal impresas, tono o nombre de modelo mal, operario lleno de tinta, tinta por el suelo, una caja rota se lleva por delante los cabezales de impresión y los destruye.`;

export interface DatosHistoriaOperario {
  nombreOperario: string;
  nivelNombre: string;
  nivelOrden: number;
  nivelPromptBase: string | null;
  nivelPromptImagen: string | null;
  fuerza: number | null;
  resistencia: number | null;
  velocidad: number | null;
  vida: number | null;
  textoOperario?: string | null;
}

function formatearStat(valor: number | null): string {
  if (valor === null || valor === undefined) return "sin datos";
  return valor.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function construirMensajeUsuario(d: DatosHistoriaOperario): string {
  return `Crea la historia de origen de este operario en máximo 3 frases:
Nombre: ${d.nombreOperario}
Rango: ${d.nivelNombre} (Nivel ${d.nivelOrden})
Descripción del rango: ${d.nivelPromptBase ?? "(sin descripción)"}
Ambientación visual de su nivel: ${d.nivelPromptImagen ?? "(sin descripción)"}
Stats acumulados: Fuerza ${formatearStat(d.fuerza)}, Resistencia ${formatearStat(d.resistencia)}, Velocidad ${formatearStat(d.velocidad)}, Vida ${formatearStat(d.vida)}
Descripción que dejó el propio operario: ${d.textoOperario?.trim() || "(no escribió nada)"}`;
}

/**
 * Llama a DeepSeek para generar la historia. Nunca lanza: cualquier
 * fallo (falta la key, timeout, HTTP no-ok, respuesta sin contenido)
 * se registra en consola y devuelve `null`. Quien llama decide qué
 * hacer con ese `null` (ver cabecera del archivo).
 */
export async function generarHistoriaOperario(
  datos: DatosHistoriaOperario,
): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) {
    console.error(
      "Falta DEEPSEEK_API_KEY — no se puede generar la historia " +
      "(configúrala con: supabase secrets set DEEPSEEK_API_KEY=...)",
    );
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_HISTORIA },
          { role: "user", content: construirMensajeUsuario(datos) },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error de la API de DeepSeek (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    const historia = data?.choices?.[0]?.message?.content;

    if (typeof historia !== "string" || historia.trim().length === 0) {
      console.error("La respuesta de DeepSeek no contiene ninguna historia");
      return null;
    }

    return historia.trim();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`DeepSeek no respondió a tiempo (timeout de ${REQUEST_TIMEOUT_MS / 1000}s)`);
    } else {
      console.error(`Error de conexión con DeepSeek: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}