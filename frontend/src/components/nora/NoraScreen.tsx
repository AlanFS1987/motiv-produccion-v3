// frontend/src/components/nora/NoraScreen.tsx
//
// Experimento mínimo de NORA — copiloto de averías por voz. Sin
// pantalla definitiva, sin historial, sin logging: solo conectar,
// hablar, y comprobar si Realtime + tool calling contra
// ceria_documentacion_maquina funciona con la latencia que buscamos
// (ver memorias/16-copiloto-averias.md). Si esto convence, se monta
// alrededor el resto (esquema de logging, pantalla definitiva).
//
// Importante: las instrucciones (tono, brevedad, despedida), la voz y
// la sensibilidad al detectar turnos vienen del backend
// (obtenerTokenNora(), que llama a supabase/functions/nora) -- este
// archivo no las construye. Para ajustar cómo se comporta NORA, edita
// supabase/functions/nora/index.ts y despliega esa función; no hace
// falta tocar ni volver a publicar la web. Lo único que sí vive aquí
// es la propia tool (su ejecución real contra Supabase), porque tiene
// que correr en el navegador.
//
// Requiere `npm install @openai/agents zod` en frontend/ (ver nota
// en la respuesta del chat sobre el nombre exacto del paquete de
// voz — confirmar al instalar, la documentación de OpenAI no es
// 100% consistente entre @openai/agents/realtime y
// @openai/agents-realtime).

import { useRef, useState } from "react";
import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { z } from "zod";
import { obtenerDocumentacionNora, obtenerTokenNora } from "../../lib/nora";

type Estado = "desconectado" | "conectando" | "escuchando" | "error";

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
      const { clientSecret, modelo, instrucciones, voz } = await obtenerTokenNora();

      const agente = new RealtimeAgent({
        name: "NORA",
        instructions: instrucciones,
        tools: [herramientaDocumentacion],
      });

      const sesion = new RealtimeSession(agente, {
        model: modelo,
        config: {
          audio: {
            input: {
              // Coherente con lo que ya se pidió al crear el token en
              // el backend -- si alguna de las dos capas no lo
              // reconoce, la sesión sigue funcionando con los valores
              // por defecto de OpenAI, no rompe la conexión.
              turnDetection: {
                type: "semantic_vad",
                interruptResponse: true,
                createResponse: true,
              },
              transcription: { model: "gpt-4o-mini-transcribe" },
            },
            output: { voice: voz },
          },
        },
      });
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="max-w-sm text-sm text-[var(--texto-secundario)]">
        Navegación, Orientación y Resolución de Averías — prueba de voz, sin historial todavía.
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