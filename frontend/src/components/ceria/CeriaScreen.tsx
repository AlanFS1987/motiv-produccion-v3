// frontend/src/components/ceria/CeriaScreen.tsx
// Chat de Ceria para el jefe de planta. 5 accesos rápidos (chips) +
// input libre. Renderiza imágenes en markdown (![desc](url)) que
// Ceria puede incluir para incidencias con fotos — sin añadir ninguna
// librería de markdown nueva, solo un regex simple para ese único caso.

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  cargarConversacion,
  eliminarConversacion,
  listarConversaciones,
  listarModelosDesactivados,
  preguntarCeria,
  MODELOS_FASE3_OPCIONES,
  type ConversacionCeria,
  type FilaInfoCeria,
} from "../../lib/ceria";

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
  modeloFase3Usado?: string;
}

const CHIPS: { etiqueta: string; pregunta: string }[] = [
  { etiqueta: "Fin de semana", pregunta: "¿Qué tal fue el fin de semana?" },
  { etiqueta: "Ayer", pregunta: "¿Cómo fue la producción de ayer?" },
  { etiqueta: "Alertas calidad", pregunta: "¿Qué incidencias de calidad ha habido esta semana?" },
  { etiqueta: "Incidencias", pregunta: "¿Qué incidencias de producción ha habido esta semana?" },
  { etiqueta: "Resumen semanal", pregunta: "Dame un resumen de la producción de esta semana" },
];

interface ParteMensaje {
  tipo: "texto" | "imagen" | "tabla";
  contenido?: string;
  alt?: string;
  cabeceras?: string[];
  filas?: string[][];
}

const REGEX_IMAGEN = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
const REGEX_FILA_TABLA = /^\|(.+)\|\s*$/;
const REGEX_SEPARADOR_TABLA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function partirCeldas(linea: string): string[] {
  return linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Primer paso: separa bloques de tabla markdown (cabecera + separador --- + filas) del resto. */
function extraerTablas(texto: string): ParteMensaje[] {
  const lineas = texto.split("\n");
  const partes: ParteMensaje[] = [];
  let bufferTexto: string[] = [];
  let i = 0;

  const flushTexto = () => {
    const contenido = bufferTexto.join("\n").trim();
    if (contenido) partes.push({ tipo: "texto", contenido });
    bufferTexto = [];
  };

  while (i < lineas.length) {
    const linea = lineas[i];
    const siguiente = lineas[i + 1];
    if (linea && REGEX_FILA_TABLA.test(linea) && siguiente && REGEX_SEPARADOR_TABLA.test(siguiente)) {
      flushTexto();
      const cabeceras = partirCeldas(linea);
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && REGEX_FILA_TABLA.test(lineas[i])) {
        filas.push(partirCeldas(lineas[i]));
        i++;
      }
      partes.push({ tipo: "tabla", cabeceras, filas });
      continue;
    }
    bufferTexto.push(linea);
    i++;
  }
  flushTexto();
  return partes;
}

/** Segundo paso: dentro de cada trozo de texto que quedó, separa imágenes markdown (igual que antes). */
function partesDeMensaje(texto: string): ParteMensaje[] {
  const resultado: ParteMensaje[] = [];
  for (const parte of extraerTablas(texto)) {
    if (parte.tipo !== "texto" || !parte.contenido) {
      resultado.push(parte);
      continue;
    }
    const contenido = parte.contenido;
    const regex = new RegExp(REGEX_IMAGEN);
    let ultimoIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(contenido)) !== null) {
      if (match.index > ultimoIndex) {
        resultado.push({ tipo: "texto", contenido: contenido.slice(ultimoIndex, match.index) });
      }
      resultado.push({ tipo: "imagen", contenido: match[2], alt: match[1] });
      ultimoIndex = match.index + match[0].length;
    }
    if (ultimoIndex < contenido.length) {
      resultado.push({ tipo: "texto", contenido: contenido.slice(ultimoIndex) });
    }
  }
  return resultado;
}

function ContenidoMensaje({ texto }: { texto: string }) {
  const partes = partesDeMensaje(texto);
  return (
    <div className="space-y-2">
      {partes.map((p, i) => {
        if (p.tipo === "imagen") {
          return <img key={i} src={p.contenido} alt={p.alt || ""} className="max-h-64 rounded-lg border border-slate-200" />;
        }
        if (p.tipo === "tabla") {
          return (
            <div key={i} className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {p.cabeceras!.map((c, j) => (
                      <th key={j} className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.filas!.map((fila, fi) => (
                    <tr key={fi} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                      {fila.map((celda, ci) => (
                        <td key={ci} className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                          {celda}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
            {p.contenido}
          </p>
        );
      })}
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
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [conversaciones, setConversaciones] = useState<ConversacionCeria[]>([]);
  const [cargandoConversaciones, setCargandoConversaciones] = useState(false);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [logsAbiertos, setLogsAbiertos] = useState<Set<string>>(new Set());
  const [modeloFase3, setModeloFase3] = useState<string>("gpt-5-mini");
  const [modelosDesactivados, setModelosDesactivados] = useState<Set<string>>(new Set());

  // Si el admin apaga el modelo que tenías seleccionado mientras lo
  // tenías puesto, vuelve al de por defecto en vez de dejarte con uno
  // que ya no va a funcionar en el servidor.
  useEffect(() => {
    listarModelosDesactivados()
      .then((desactivados) => {
        setModelosDesactivados(desactivados);
        if (desactivados.has(modeloFase3)) setModeloFase3("gpt-5-mini");
      })
      .catch(() => {
        // Si falla la consulta, se deja el desplegable completo — no
        // bloquea el chat por esto.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      const res = await preguntarCeria(preguntaLimpia, conversacionId, modeloFase3);
      setConversacionId(res.conversacion_id);
      setMensajes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          contenido: res.respuesta,
          filasInfo: res.filas_info,
          modeloFase3Usado: res.modelo_fase3_usado,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al preguntar a Ceria");
    } finally {
      setCargando(false);
    }
  }
    function toggleLog(id: string) {
    setLogsAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function nuevaConversacion() {
    localStorage.removeItem(CLAVE_LOCALSTORAGE);
    setConversacionId(null);
    setMensajes([MENSAJE_BIENVENIDA]);
    setError(null);
  }
    async function abrirHistorial() {
    setHistorialAbierto(true);
    setCargandoConversaciones(true);
    try {
      setConversaciones(await listarConversaciones());
    } catch {
      setConversaciones([]);
    } finally {
      setCargandoConversaciones(false);
    }
  }

  async function continuarConversacion(id: string) {
    setHistorialAbierto(false);
    setCargandoHistorial(true);
    setError(null);
    try {
      const mensajesGuardados = await cargarConversacion(id);
      setConversacionId(id);
      setMensajes([
        MENSAJE_BIENVENIDA,
        ...mensajesGuardados.map((m) => ({ id: crypto.randomUUID(), role: m.role, contenido: m.contenido })),
      ]);
    } catch {
      setError("No se pudo cargar esa conversación");
    } finally {
      setCargandoHistorial(false);
    }
  }

  async function borrarConversacion(id: string) {
    if (!confirm("¿Borrar esta conversación? No se puede deshacer.")) return;
    setBorrandoId(id);
    try {
      await eliminarConversacion(id);
      setConversaciones((prev) => prev.filter((c) => c.id !== id));
      if (id === conversacionId) nuevaConversacion();
    } catch {
      setError("No se pudo borrar la conversación");
    } finally {
      setBorrandoId(null);
    }
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
              {m.filasInfo && m.filasInfo.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => toggleLog(m.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    {logsAbiertos.has(m.id) ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                    {logsAbiertos.has(m.id) ? "Ocultar detalles" : "Ver qué hizo Ceria"}
                  </button>
                  {logsAbiertos.has(m.id) && (
                    <div className="mt-1 space-y-0.5 rounded-lg bg-slate-900 p-2 font-mono text-[11px] text-slate-200">
                      {m.filasInfo.map((f, i) => (
                        <p key={i}>
                          → {f.herramienta} · {f.filas} fila{f.filas === 1 ? "" : "s"}
                          {f.filas_totales && f.limitado ? ` (de ${f.filas_totales})` : ""}
                          {f.duracion_ms != null ? ` · ${f.duracion_ms}ms` : ""}
                        </p>
                      ))}
                      {m.modeloFase3Usado && <p className="text-slate-400">Redactado por: {m.modeloFase3Usado}</p>}
                    </div>
                  )}
                </div>
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
                <select
          value={modeloFase3}
          onChange={(e) => setModeloFase3(e.target.value)}
          title="Modelo que redacta la respuesta (Fase 3) — solo para pruebas"
          className="rounded-full border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-500"
        >
          {MODELOS_FASE3_OPCIONES.filter((m) => !modelosDesactivados.has(m.id)).map((m) => (
            <option key={m.id} value={m.id}>
              {m.etiqueta}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={abrirHistorial}
          disabled={cargando}
          title="Ver conversaciones anteriores"
          className="ml-auto flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <History size={14} aria-hidden />
          Historial
        </button>
        <button
          type="button"
          onClick={nuevaConversacion}
          disabled={cargando}
          title="Empezar una conversación nueva"
          className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <MessageSquarePlus size={14} aria-hidden />
          Nueva
        </button>
      </div>

      {historialAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setHistorialAbierto(false)}
        >
          <div
            className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Conversaciones anteriores</h2>
              <button
                type="button"
                onClick={() => setHistorialAbierto(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              {cargandoConversaciones && (
                <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Cargando...
                </div>
              )}
              {!cargandoConversaciones && conversaciones.length === 0 && (
                <p className="p-4 text-sm text-slate-400">Todavía no tienes conversaciones guardadas.</p>
              )}
              {conversaciones.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => continuarConversacion(c.id)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                    c.id === conversacionId ? "bg-slate-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-900">{c.titulo}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      borrarConversacion(c.id);
                    }}
                    className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    title="Borrar conversación"
                  >
                    {borrandoId === c.id ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 size={16} aria-hidden />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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