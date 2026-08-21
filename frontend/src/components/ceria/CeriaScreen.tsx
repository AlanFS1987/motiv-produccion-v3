// frontend/src/components/ceria/CeriaScreen.tsx
// Chat de Ceria para el jefe de planta. 5 accesos rápidos (chips) +
// input libre. Renderiza imágenes en markdown (![desc](url)) que
// Ceria puede incluir para incidencias con fotos — sin añadir ninguna
// librería de markdown nueva, solo un regex simple para ese único caso.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, Loader2, MessageSquarePlus, Send, User } from "lucide-react";
import { cargarConversacion, preguntarCeria, type FilaInfoCeria } from "../../lib/ceria";

const CLAVE_LOCALSTORAGE = "ceria_conversacion_id";

const MENSAJE_BIENVENIDA: Mensaje = {
  id: "bienvenida",
  role: "assistant",
  contenido:
    "Hola, soy Ceria. Puedes preguntarme por producción, calidad o incidencias, o usar los accesos rápidos de abajo.",
};

interface Mensaje {
  id: string;
  role: "user" | "assistant";
  contenido: string;
  filasInfo?: FilaInfoCeria[];
}

const CHIPS: { etiqueta: string; pregunta: string }[] = [
  { etiqueta: "Fin de semana", pregunta: "¿Qué tal fue el fin de semana?" },
  { etiqueta: "Ayer", pregunta: "¿Cómo fue la producción de ayer?" },
  { etiqueta: "Alertas calidad", pregunta: "¿Qué incidencias de calidad ha habido esta semana?" },
  { etiqueta: "Incidencias", pregunta: "¿Qué incidencias de producción ha habido esta semana?" },
  { etiqueta: "Resumen semanal", pregunta: "Dame un resumen de la producción de esta semana" },
];

/** Divide un texto en trozos, separando las imágenes markdown ![desc](url) del resto. */
function partesConImagenes(texto: string): { tipo: "texto" | "imagen"; contenido: string; alt?: string }[] {
  const regex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const partes: { tipo: "texto" | "imagen"; contenido: string; alt?: string }[] = [];
  let ultimoIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimoIndex) {
      partes.push({ tipo: "texto", contenido: texto.slice(ultimoIndex, match.index) });
    }
    partes.push({ tipo: "imagen", contenido: match[2], alt: match[1] });
    ultimoIndex = match.index + match[0].length;
  }
  if (ultimoIndex < texto.length) {
    partes.push({ tipo: "texto", contenido: texto.slice(ultimoIndex) });
  }
  return partes;
}

function ContenidoMensaje({ texto }: { texto: string }) {
  const partes = partesConImagenes(texto);
  return (
    <div className="space-y-2">
      {partes.map((p, i) =>
        p.tipo === "imagen" ? (
          <img key={i} src={p.contenido} alt={p.alt || ""} className="max-h-64 rounded-lg border border-slate-200" />
        ) : (
          <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
            {p.contenido}
          </p>
        ),
      )}
    </div>
  );
}

export function CeriaScreen() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([MENSAJE_BIENVENIDA]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  // Al montar: si la pestaña se recargó sola (Chrome "Ahorro de
  // memoria" descargando pestañas inactivas, o el sistema operativo
  // en móvil) pero ya había una conversación en curso, la recuperamos
  // de Supabase en vez de empezar de cero — el `conversacion_id` vive
  // en localStorage para sobrevivir a esa recarga completa.
  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_LOCALSTORAGE);
    if (!guardado) {
      setCargandoHistorial(false);
      return;
    }
    cargarConversacion(guardado)
      .then((mensajesGuardados) => {
        if (mensajesGuardados.length === 0) {
          // El id apuntaba a una conversación vacía o ya inexistente
          // (ej. borrada a mano) — se limpia y se empieza de cero.
          localStorage.removeItem(CLAVE_LOCALSTORAGE);
          return;
        }
        setConversacionId(guardado);
        setMensajes([
          MENSAJE_BIENVENIDA,
          ...mensajesGuardados.map((m) => ({ id: crypto.randomUUID(), role: m.role, contenido: m.contenido })),
        ]);
      })
      .catch(() => {
        // Si falla (id inválido, sin permisos, etc.) simplemente se
        // empieza de cero — no bloqueamos el chat por esto.
        localStorage.removeItem(CLAVE_LOCALSTORAGE);
      })
      .finally(() => setCargandoHistorial(false));
  }, []);

  useEffect(() => {
    if (conversacionId) localStorage.setItem(CLAVE_LOCALSTORAGE, conversacionId);
  }, [conversacionId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  async function enviar(pregunta: string) {
    const preguntaLimpia = pregunta.trim();
    if (!preguntaLimpia || cargando) return;

    setError(null);
    setInput("");
    setMensajes((prev) => [...prev, { id: crypto.randomUUID(), role: "user", contenido: preguntaLimpia }]);
    setCargando(true);

    try {
      const res = await preguntarCeria(preguntaLimpia, conversacionId);
      setConversacionId(res.conversacion_id);
      setMensajes((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", contenido: res.respuesta, filasInfo: res.filas_info },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al preguntar a Ceria");
    } finally {
      setCargando(false);
    }
  }

  function nuevaConversacion() {
    localStorage.removeItem(CLAVE_LOCALSTORAGE);
    setConversacionId(null);
    setMensajes([MENSAJE_BIENVENIDA]);
    setError(null);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      {/* Historial de mensajes */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {cargandoHistorial && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Recuperando conversación...
          </div>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <Bot size={16} aria-hidden />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                m.role === "user" ? "bg-slate-900 text-white" : "bg-white text-slate-900"
              }`}
            >
              <ContenidoMensaje texto={m.contenido} />
              {m.filasInfo?.some((f) => f.limitado) && (
                <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle size={12} aria-hidden />
                  Algunos datos están limitados a las filas más recientes.
                </p>
              )}
            </div>
            {m.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <User size={16} aria-hidden />
              </div>
            )}
          </div>
        ))}

        {cargando && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Ceria está pensando...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div ref={finRef} />
      </div>

      {/* Accesos rápidos + nueva conversación */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        {CHIPS.map((chip) => (
          <button
            key={chip.etiqueta}
            type="button"
            disabled={cargando}
            onClick={() => enviar(chip.pregunta)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            {chip.etiqueta}
          </button>
        ))}
        <button
          type="button"
          onClick={nuevaConversacion}
          disabled={cargando}
          title="Empezar una conversación nueva"
          className="ml-auto flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <MessageSquarePlus size={14} aria-hidden />
          Nueva
        </button>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta algo... ej: ¿Cómo fue la producción este fin de semana?"
          disabled={cargando}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={cargando || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40"
        >
          <Send size={18} aria-hidden />
        </button>
      </form>
    </div>
  );
}