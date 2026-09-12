// frontend/src/components/nora/NoraScreen.tsx
//
// Experimento mínimo de NORA — copiloto de averías por voz. Sin
// pantalla definitiva, sin historial, sin logging: solo conectar,
// hablar, y comprobar si Realtime + tool calling contra
// ceria_documentacion_maquina funciona con la latencia que buscamos
// (ver memorias/16-copiloto-averias.md). Si esto convence, se monta
// alrededor el resto (esquema de logging, integración en la pestaña
// Chat vía chat_acceso, pantalla definitiva).
//
// Requiere `npm install @openai/agents zod` en frontend/ (ver nota
// en la respuesta del chat sobre el nombre exacto del paquete de
// voz — confirmar al instalar, la documentación de OpenAI no es
// 100% consistente entre @openai/agents/realtime y
// @openai/agents-realtime).

import { useRef, useState } from "react";
import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { z } from "zod";
import { obtenerDocumentacionNora, obtenerTokenNora, INDICE_MAQUINAS } from "../../lib/nora";

type Estado = "desconectado" | "conectando" | "escuchando" | "error";

const indiceTexto = Object.entries(INDICE_MAQUINAS)
  .map(([maquina, submaquinas]) => `${maquina}: ${submaquinas.join(", ")}`)
  .join("\n");

const INSTRUCCIONES = `Eres NORA (Navegación, Orientación y Resolución de Averías), \
copiloto de voz para un mecánico que está delante de la máquina, con \
las manos ocupadas. Hablas español, con frases cortas -- esto es una \
conversación de voz, no un informe escrito.

Máquinas y submáquinas disponibles hoy:
${indiceTexto}

Cuando el mecánico describa un problema, identifica tú mismo la \
máquina/submáquina más probable (pregunta UNA cosa corta solo si de \
verdad no puedes deducirlo) y llama a la herramienta \
obtener_documentacion con esos datos ANTES de intentar diagnosticar \
nada -- nunca inventes procedimientos, alarmas o piezas que no estén \
en lo que te devuelva la herramienta. Puedes llamar a la herramienta \
varias veces si el problema resulta estar en otra submáquina distinta \
a la que pensabas al principio, o si hace falta cruzar información de \
más de una -- no descartes lo ya consultado, sigue teniéndolo en \
cuenta. Una vez tengas la documentación, guía al mecánico con \
preguntas cortas, una detrás de otra (estilo socrático), hasta llegar \
a una causa y una solución concreta.`;

const herramientaDocumentacion = tool({
  name: "obtener_documentacion",
  description:
    "Trae la documentación técnica (proceso, piezas, sensores, alarmas, diagnóstico, mantenimiento) de una máquina o submáquina concreta. Llámala antes de diagnosticar nada.",
  parameters: z.object({
    maquina: z.string().describe("Nombre de la máquina, p. ej. 'BS08'"),
    submaquina: z
      .string()
      .nullable()
      .describe(
        "Nombre de la submáquina, p. ej. 'Divisor'. Usa null solo para datos generales de la máquina completa.",
      ),
  }),
  execute: async ({ maquina, submaquina }) => {
    return await obtenerDocumentacionNora(maquina, submaquina);
  },
});

export function NoraScreen() {
  const [estado, setEstado] = useState<Estado>("desconectado");
  const [error, setError] = useState<string | null>(null);
  const sesionRef = useRef<RealtimeSession | null>(null);

  async function conectar() {
    setError(null);
    setEstado("conectando");
    try {
      const { clientSecret, modelo } = await obtenerTokenNora();

      const agente = new RealtimeAgent({
        name: "NORA",
        instructions: INSTRUCCIONES,
        tools: [herramientaDocumentacion],
      });

      const sesion = new RealtimeSession(agente, { model: modelo });
      await sesion.connect({ apiKey: clientSecret });

      sesionRef.current = sesion;
      setEstado("escuchando");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido conectando con NORA");
      setEstado("error");
    }
  }

  function colgar() {
    sesionRef.current?.close();
    sesionRef.current = null;
    setEstado("desconectado");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">NORA (experimento)</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Navegación, Orientación y Resolución de Averías — prueba de voz, sin pantalla definitiva todavía.
      </p>

      {estado === "desconectado" && (
        <button onClick={conectar} className="rounded-full bg-slate-900 px-6 py-3 text-white">
          Hablar con NORA
        </button>
      )}

      {estado === "conectando" && <p className="text-sm text-slate-500">Conectando...</p>}

      {estado === "escuchando" && (
        <>
          <p className="text-sm text-emerald-600">Escuchando — habla cuando quieras</p>
          <button onClick={colgar} className="rounded-full bg-red-600 px-6 py-3 text-white">
            Colgar
          </button>
        </>
      )}

      {estado === "error" && (
        <>
          <p className="max-w-sm text-sm text-red-600">{error}</p>
          <button onClick={conectar} className="rounded-full bg-slate-900 px-6 py-3 text-white">
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
