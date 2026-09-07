// frontend/src/components/chat/ChatScreen.tsx
// Fase 5 — canal de chat único. Mismo patrón visual de burbujas que
// CeriaScreen.tsx, adaptado de "usuario vs IA" a "usuario vs usuario":
// avatar con inicial + username real en vez del icono de bot fijo, y
// Realtime en vez de esperar la respuesta de una Edge Function.
// Reutiliza SelectorFotosMultiple tal cual (misma subida a Cloudinary
// que incidencias) — solo hace falta la categoría "chat" nueva en
// lib/cloudinary.ts (ver nota al pie de la Fase 5).

import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SelectorFotosMultiple } from "../incidencias/SelectorFotosMultiple";
import {
  borrarMensaje,
  enviarMensaje,
  listarMensajesRecientes,
  suscribirseAChat,
  type MensajeChat,
} from "../../lib/chat";

interface FotoSubida {
  url: string;
  previsualizacion: string;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ username }: { username: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--acento)] text-xs font-semibold text-[var(--acento-texto)]">
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function ChatScreen() {
  const { usuario } = useAuth();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<FotoSubida[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarMensajesRecientes()
      .then((m) => {
        if (!cancelado) setMensajes(m);
      })
      .catch((err) => !cancelado && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelado && setCargando(false));

    const cancelarSuscripcion = suscribirseAChat((m) => {
      setMensajes((prev) => {
        const existe = prev.some((x) => x.id === m.id);
        if (existe) return prev.map((x) => (x.id === m.id ? m : x)); // borrado suave (UPDATE)
        return [...prev, m]; // mensaje nuevo (INSERT)
      });
    });

    return () => {
      cancelado = true;
      cancelarSuscripcion();
    };
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  async function manejarEnviar() {
    if (!usuario || enviando) return;
    if (!texto.trim() && fotos.length === 0) return;

    setEnviando(true);
    setError(null);
    try {
      await enviarMensaje(usuario.id, texto, fotos.map((f) => f.url));
      // No se añade a mano al estado local — Realtime lo trae también
      // para el propio remitente, evitando el mensaje duplicado.
      setTexto("");
      setFotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setEnviando(false);
    }
  }

  async function manejarBorrar(id: string) {
    if (!usuario) return;
    if (!confirm("¿Eliminar este mensaje? No se puede deshacer.")) return;
    try {
      await borrarMensaje(id, usuario.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el mensaje");
    }
  }

  if (!usuario) return null;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {cargando && <p className="text-center text-sm text-[var(--texto-tenue)]">Cargando chat...</p>}

        {!cargando && mensajes.length === 0 && (
          <p className="text-center text-sm text-[var(--texto-tenue)]">Sin mensajes todavía — el primero es tuyo.</p>
        )}

        {mensajes.map((m) => {
          const esPropio = m.usuarioId === usuario.id;
          const puedeBorrar = !m.eliminado && (esPropio || usuario.rol === "administrador");

          return (
            <div key={m.id} className={`flex gap-2 ${esPropio ? "flex-row-reverse" : "flex-row"}`}>
              <Avatar username={m.username} />
              <div className={`group max-w-[75%] ${esPropio ? "items-end" : "items-start"} flex flex-col`}>
                {!esPropio && <span className="mb-0.5 px-1 text-xs text-[var(--texto-secundario)]">{m.username}</span>}
                <div
                  className={`rounded-2xl px-4 py-2 shadow-sm ${
                    esPropio ? "bg-[var(--acento)] text-[var(--acento-texto)]" : "bg-[var(--superficie-alt)] text-[var(--texto)]"
                  }`}
                >
                  {m.eliminado ? (
                    <p className="text-sm italic opacity-70">Mensaje eliminado</p>
                  ) : (
                    <>
                      {m.texto && <p className="whitespace-pre-wrap text-sm">{m.texto}</p>}
                      {m.fotos && m.fotos.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.fotos.map((url) => (
                            <img key={url} src={url} alt="" className="max-h-48 rounded-lg" />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 px-1">
                  <span className="text-[10px] text-[var(--texto-tenue)]">{formatFecha(m.createdAt)}</span>
                  {puedeBorrar && (
                    <button
                      onClick={() => manejarBorrar(m.id)}
                      className="text-[var(--texto-tenue)] opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      aria-label="Eliminar mensaje"
                    >
                      <Trash2 size={12} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {error && <div className="mx-4 mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      <div className="border-t border-[var(--borde)] p-3">
        {fotos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {fotos.map((f) => (
              <img key={f.url} src={f.previsualizacion} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <SelectorFotosMultiple fotos={fotos} onCambiar={setFotos} publicIdPrefijo="CHAT" categoria="chat" maxFotos={4} />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manejarEnviar()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-xl border border-[var(--borde)] bg-[var(--fondo)] px-3 py-2 text-sm text-[var(--texto)]"
          />
          <button
            onClick={manejarEnviar}
            disabled={enviando || (!texto.trim() && fotos.length === 0)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--acento)] text-[var(--acento-texto)] disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
