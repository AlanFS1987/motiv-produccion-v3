// frontend/src/components/chat/ChatHomeScreen.tsx
// Lista maestra de la pestaña "Chat" — sesión 07/09/2026. Muestra
// solo los chats a los que el rol del usuario tiene acceso (tabla
// chat_acceso, editable por el admin), con último mensaje/no-leídas
// donde aplica. Tocas uno y entras a pantalla completa:
//  - Los 5 automáticos: historial de solo lectura (reutiliza la
//    misma consulta que ya usaba la campana).
//  - 'general': la pantalla de chat humano ya existente, tal cual.
//  - 'ceria': la pantalla de Ceria ya existente, tal cual (sin
//    contador de no-leídas — no le pega, solo tú le hablas).

import { useEffect, useState } from "react";
import { ChevronLeft, Bot } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ChatScreen } from "./ChatScreen";
import { CeriaScreen } from "../ceria/CeriaScreen";
import {
  ETIQUETA_TIPO,
  listarNotificacionesPorTipo,
  marcarCanalLeido,
  obtenerResumenCanales,
  suscribirseANotificaciones,
  type Notificacion,
  type TipoNotificacion,
} from "../../lib/notificaciones";
import { obtenerEstadoGeneral, marcarGeneralLeido, suscribirseAChat } from "../../lib/chat";
import { listarAccesoPropio, type Rol } from "../../lib/chat-acceso";

type ClaveChat = TipoNotificacion | "general" | "ceria";

interface FilaLista {
  clave: ClaveChat;
  etiqueta: string;
  subtitulo: string | null;
  fecha: string | null;
  noLeidas: number;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function primeraLinea(texto: string | null): string {
  if (!texto) return "";
  const linea = texto.split("\n")[0];
  return linea.length > 60 ? linea.slice(0, 60) + "…" : linea;
}

export function ChatHomeScreen() {
  const { usuario } = useAuth();
  const [filas, setFilas] = useState<FilaLista[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<ClaveChat | null>(null);
  const [mensajesCanal, setMensajesCanal] = useState<Notificacion[]>([]);
  const [cargandoCanal, setCargandoCanal] = useState(false);

  async function cargarLista() {
    if (!usuario) return;
    setCargando(true);
    setError(null);
    try {
      const accesos = await listarAccesoPropio(usuario.rol as Rol);
      const tiposAccesibles = new Set(accesos.filter((a) => a.puedeVer).map((a) => a.tipoChat));

      const nuevasFilas: FilaLista[] = [];

      if (
        ["incidencia_calidad", "incidencia_produccion", "nuevo_lote", "resumen_turno", "resumen_calidad"].some((t) =>
          tiposAccesibles.has(t as TipoNotificacion),
        )
      ) {
        const resumenes = await obtenerResumenCanales(usuario.id);
        for (const r of resumenes) {
          if (!tiposAccesibles.has(r.tipo)) continue;
          nuevasFilas.push({
            clave: r.tipo,
            etiqueta: ETIQUETA_TIPO[r.tipo],
            subtitulo: primeraLinea(r.ultimoTitulo) || "Sin mensajes todavía",
            fecha: r.ultimaFecha,
            noLeidas: r.noLeidas,
          });
        }
      }

      if (tiposAccesibles.has("general")) {
        const estado = await obtenerEstadoGeneral(usuario.id);
        nuevasFilas.push({
          clave: "general",
          etiqueta: "Chat general",
          subtitulo: primeraLinea(estado.ultimoTexto) || "Sin mensajes todavía",
          fecha: estado.ultimaFecha,
          noLeidas: estado.noLeidas,
        });
      }

      if (tiposAccesibles.has("ceria")) {
        nuevasFilas.push({
          clave: "ceria",
          etiqueta: "Ceria",
          subtitulo: "Tu asistente de producción",
          fecha: null,
          noLeidas: 0,
        });
      }

      setFilas(nuevasFilas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de chats");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // Realtime: mientras se ve la lista, sube el contador del chat que
  // corresponda sin tener que recargar entero.
  useEffect(() => {
    if (!usuario) return;
    const cancelarNotif = suscribirseANotificaciones((n) => {
      setFilas((prev) =>
        prev
          ? prev.map((f) =>
              f.clave === n.tipo
                ? { ...f, subtitulo: primeraLinea(n.titulo), fecha: n.createdAt, noLeidas: f.noLeidas + 1 }
                : f,
            )
          : prev,
      );
    });
    const cancelarChat = suscribirseAChat((m) => {
      setFilas((prev) =>
        prev
          ? prev.map((f) =>
              f.clave === "general"
                ? {
                    ...f,
                    subtitulo: primeraLinea(m.texto ?? (m.fotos?.length ? "📷 Foto" : null)),
                    fecha: m.createdAt,
                    noLeidas: f.noLeidas + 1,
                  }
                : f,
            )
          : prev,
      );
    });
    return () => {
      cancelarNotif();
      cancelarChat();
    };
  }, [usuario]);

  async function abrir(clave: ClaveChat) {
    setAbierto(clave);
    if (!usuario) return;

    if (clave === "general") {
      await marcarGeneralLeido(usuario.id);
      setFilas((prev) => (prev ? prev.map((f) => (f.clave === "general" ? { ...f, noLeidas: 0 } : f)) : prev));
      return;
    }
    if (clave === "ceria") return;

    setCargandoCanal(true);
    try {
      setMensajesCanal(await listarNotificacionesPorTipo(clave));
      await marcarCanalLeido(usuario.id, clave);
      setFilas((prev) => (prev ? prev.map((f) => (f.clave === clave ? { ...f, noLeidas: 0 } : f)) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
    } finally {
      setCargandoCanal(false);
    }
  }

  function volver() {
    setAbierto(null);
    setMensajesCanal([]);
  }

  if (!usuario) return null;

  // --- Vista: conversación abierta ---
  if (abierto) {
    const etiqueta = abierto === "general" ? "Chat general" : abierto === "ceria" ? "Ceria" : ETIQUETA_TIPO[abierto];

    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--borde)] px-2 py-2">
          <button onClick={volver} className="text-[var(--texto-secundario)]" aria-label="Volver">
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="text-sm font-medium text-[var(--texto)]">{etiqueta}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {abierto === "general" ? (
            <ChatScreen />
          ) : abierto === "ceria" ? (
            <CeriaScreen />
          ) : cargandoCanal ? (
            <p className="p-4 text-center text-sm text-[var(--texto-tenue)]">Cargando...</p>
          ) : mensajesCanal.length === 0 ? (
            <p className="p-4 text-center text-sm text-[var(--texto-tenue)]">Sin mensajes todavía.</p>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {mensajesCanal.map((n) => (
                <div key={n.id} className="rounded-xl bg-[var(--superficie-alt)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--texto)]">{n.titulo}</p>
                  {n.cuerpo && <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--texto-secundario)]">{n.cuerpo}</p>}
                  {n.data?.fotos && n.data.fotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.data.fotos.map((url) => (
                        <img key={url} src={url} alt="" className="max-h-48 rounded-lg" />
                      ))}
                    </div>
                  )}
                  {n.data?.pdfUrl && (
                    <a
                      href={n.data.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-[var(--acento)] underline"
                    >
                      Ver informe completo en PDF
                    </a>
                  )}
                  <p className="mt-2 text-xs text-[var(--texto-tenue)]">{formatFecha(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Vista: lista ---
  return (
    <div className="mx-auto max-w-2xl space-y-1 p-2">
      {error && <div className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {cargando ? (
        <p className="p-4 text-center text-sm text-[var(--texto-tenue)]">Cargando...</p>
      ) : !filas || filas.length === 0 ? (
        <p className="p-4 text-center text-sm text-[var(--texto-tenue)]">No tienes ningún chat disponible.</p>
      ) : (
        filas.map((f) => (
          <button
            key={f.clave}
            onClick={() => abrir(f.clave)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-[var(--superficie-alt)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              {f.clave === "ceria" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--acento)] text-[var(--acento-texto)]">
                  <Bot size={16} aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--texto)]">{f.etiqueta}</p>
                <p className="truncate text-xs text-[var(--texto-secundario)]">{f.subtitulo}</p>
              </div>
            </div>
            <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
              {f.fecha && <span className="text-[10px] text-[var(--texto-tenue)]">{formatFecha(f.fecha)}</span>}
              {!!f.noLeidas && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                  {f.noLeidas > 9 ? "9+" : f.noLeidas}
                </span>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
