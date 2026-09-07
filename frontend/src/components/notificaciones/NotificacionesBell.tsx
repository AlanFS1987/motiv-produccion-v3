// frontend/src/components/notificaciones/NotificacionesBell.tsx
// Rediseño 07/09/2026 — comportamiento de Telegram: la campana abre
// una lista de 5 canales (uno por tipo), cada uno con su último
// mensaje y sus no-leídas; tocas uno y entras a su historial completo
// scrolleable, con botón atrás para volver a la lista. Preferencias
// sigue siendo una pestaña aparte (silencio + interruptor por tipo,
// todavía sin efecto real hasta que exista push, Fase 7).

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronLeft, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  ETIQUETA_TIPO,
  TIPOS,
  guardarPreferencia,
  guardarSilencio,
  listarNotificacionesPorTipo,
  marcarCanalLeido,
  obtenerPreferencias,
  obtenerResumenCanales,
  obtenerSilencio,
  suscribirseANotificaciones,
  type Notificacion,
  type ResumenCanal,
  type SilencioHorario,
  type TipoNotificacion,
} from "../../lib/notificaciones";

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function primeraLinea(texto: string | null): string {
  if (!texto) return "";
  const linea = texto.split("\n")[0];
  return linea.length > 60 ? linea.slice(0, 60) + "…" : linea;
}

export function NotificacionesBell() {
  const { usuario } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"canales" | "preferencias">("canales");
  const [canalAbierto, setCanalAbierto] = useState<TipoNotificacion | null>(null);

  const [resumenCanales, setResumenCanales] = useState<ResumenCanal[] | null>(null);
  const [mensajesCanal, setMensajesCanal] = useState<Notificacion[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [cargandoCanal, setCargandoCanal] = useState(false);

  const [preferencias, setPreferencias] = useState<Record<TipoNotificacion, boolean> | null>(null);
  const [silencio, setSilencio] = useState<SilencioHorario | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  // Carga silenciosa al montar, solo para tener el badge total listo
  // desde el arranque sin necesidad de abrir el panel.
  useEffect(() => {
    if (!usuario) return;
    obtenerResumenCanales(usuario.id).then(setResumenCanales).catch(() => {});
  }, [usuario]);

  // Realtime: si el panel está cerrado (o abierto en otro canal),
  // solo sube el contador de ese canal. Si se está viendo justo ese
  // canal en directo, se añade al hilo y se marca leído al momento.
  useEffect(() => {
    if (!usuario) return;
    const cancelar = suscribirseANotificaciones((n) => {
      const viendoEsteCanal = abierto && vista === "canales" && canalAbierto === n.tipo;

      setResumenCanales((prev) => {
        if (!prev) return prev;
        return prev.map((c) =>
          c.tipo === n.tipo
            ? { ...c, ultimoTitulo: n.titulo, ultimaFecha: n.createdAt, noLeidas: viendoEsteCanal ? 0 : c.noLeidas + 1 }
            : c,
        );
      });

      if (viendoEsteCanal) {
        setMensajesCanal((prev) => [...prev, n]);
        marcarCanalLeido(usuario.id, n.tipo).catch(() => {});
      }
    });
    return cancelar;
  }, [usuario, abierto, vista, canalAbierto]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajesCanal.length]);

  // Cierra el panel al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [abierto]);

  async function abrirPanel() {
    setAbierto(true);
    irALista();
    if (!usuario) return;
    setCargandoLista(true);
    try {
      setResumenCanales(await obtenerResumenCanales(usuario.id));
    } catch {
      // se queda con lo que ya hubiera cargado antes
    } finally {
      setCargandoLista(false);
    }
  }

  function irALista() {
    setVista("canales");
    setCanalAbierto(null);
    setMensajesCanal([]);
  }

  async function abrirCanal(tipo: TipoNotificacion) {
    if (!usuario) return;
    setCanalAbierto(tipo);
    setCargandoCanal(true);
    try {
      setMensajesCanal(await listarNotificacionesPorTipo(tipo));
      await marcarCanalLeido(usuario.id, tipo);
      setResumenCanales((prev) => (prev ? prev.map((c) => (c.tipo === tipo ? { ...c, noLeidas: 0 } : c)) : prev));
    } catch {
      // el usuario puede volver atrás e intentarlo de nuevo
    } finally {
      setCargandoCanal(false);
    }
  }

  async function abrirPreferencias() {
    setVista("preferencias");
    setCanalAbierto(null);
    if (!usuario || preferencias) return;
    const [p, s] = await Promise.all([obtenerPreferencias(usuario.id), obtenerSilencio(usuario.id)]);
    setPreferencias(p);
    setSilencio(s);
  }

  async function cambiarPreferencia(tipo: TipoNotificacion, activo: boolean) {
    if (!usuario || !preferencias) return;
    const anterior = preferencias;
    setPreferencias({ ...preferencias, [tipo]: activo });
    try {
      await guardarPreferencia(usuario.id, tipo, activo);
    } catch {
      setPreferencias(anterior);
    }
  }

  async function cambiarSilencio(nuevo: SilencioHorario) {
    if (!usuario) return;
    const anterior = silencio;
    setSilencio(nuevo);
    try {
      await guardarSilencio(usuario.id, nuevo);
    } catch {
      setSilencio(anterior);
    }
  }

  if (!usuario) return null;

  const totalNoLeidas = resumenCanales?.reduce((acc, c) => acc + c.noLeidas, 0) ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => (abierto ? setAbierto(false) : abrirPanel())}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
        aria-label="Notificaciones"
      >
        <Bell size={18} aria-hidden />
        {totalNoLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {totalNoLeidas > 9 ? "9+" : totalNoLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-10 z-50 flex h-[28rem] w-80 max-w-[90vw] flex-col rounded-xl border border-[var(--borde)] bg-[var(--superficie)] shadow-lg">
          <div className="border-b border-[var(--borde)]">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex gap-1">
                <button
                  onClick={irALista}
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    vista === "canales" ? "bg-[var(--superficie-alt)] text-[var(--texto)]" : "text-[var(--texto-secundario)]"
                  }`}
                >
                  Notificaciones
                </button>
                <button
                  onClick={abrirPreferencias}
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    vista === "preferencias" ? "bg-[var(--superficie-alt)] text-[var(--texto)]" : "text-[var(--texto-secundario)]"
                  }`}
                >
                  Preferencias
                </button>
              </div>
              <button onClick={() => setAbierto(false)} className="text-[var(--texto-secundario)]" aria-label="Cerrar">
                <X size={16} aria-hidden />
              </button>
            </div>

            {vista === "canales" && canalAbierto && (
              <div className="flex items-center gap-2 border-t border-[var(--borde)] px-3 py-1.5">
                <button onClick={irALista} className="text-[var(--texto-secundario)]" aria-label="Volver">
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="text-xs font-medium text-[var(--texto)]">{ETIQUETA_TIPO[canalAbierto]}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {vista === "canales" && !canalAbierto && (
              cargandoLista ? (
                <p className="p-3 text-center text-xs text-[var(--texto-tenue)]">Cargando...</p>
              ) : (
                <div className="space-y-1">
                  {TIPOS.map((tipo) => {
                    const resumen = resumenCanales?.find((c) => c.tipo === tipo);
                    return (
                      <button
                        key={tipo}
                        onClick={() => abrirCanal(tipo)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-[var(--superficie-alt)]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--texto)]">{ETIQUETA_TIPO[tipo]}</p>
                          <p className="truncate text-xs text-[var(--texto-secundario)]">
                            {primeraLinea(resumen?.ultimoTitulo ?? null) || "Sin mensajes todavía"}
                          </p>
                        </div>
                        <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                          {resumen?.ultimaFecha && (
                            <span className="text-[10px] text-[var(--texto-tenue)]">{formatFecha(resumen.ultimaFecha)}</span>
                          )}
                          {!!resumen?.noLeidas && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                              {resumen.noLeidas > 9 ? "9+" : resumen.noLeidas}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {vista === "canales" && canalAbierto && (
              cargandoCanal ? (
                <p className="p-3 text-center text-xs text-[var(--texto-tenue)]">Cargando...</p>
              ) : mensajesCanal.length === 0 ? (
                <p className="p-3 text-center text-xs text-[var(--texto-tenue)]">Sin mensajes todavía.</p>
              ) : (
                <div className="space-y-2">
                  {mensajesCanal.map((n) => (
                    <div key={n.id} className="rounded-lg bg-[var(--superficie-alt)] px-3 py-2">
                      <p className="text-sm font-medium text-[var(--texto)]">{n.titulo}</p>
                      {n.cuerpo && (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-[var(--texto-secundario)]">{n.cuerpo}</p>
                      )}
                      <p className="mt-1 text-[10px] text-[var(--texto-tenue)]">{formatFecha(n.createdAt)}</p>
                    </div>
                  ))}
                  <div ref={finRef} />
                </div>
              )
            )}

            {vista === "preferencias" && (
              !preferencias || !silencio ? (
                <p className="p-3 text-center text-xs text-[var(--texto-tenue)]">Cargando...</p>
              ) : (
                <div className="space-y-4 p-1">
                  <div>
                    <p className="mb-2 text-xs font-medium text-[var(--texto-secundario)]">
                      Avisos por tipo (aplica cuando haya push)
                    </p>
                    <div className="space-y-2">
                      {TIPOS.map((tipo) => (
                        <label key={tipo} className="flex items-center justify-between text-sm text-[var(--texto)]">
                          {ETIQUETA_TIPO[tipo]}
                          <input
                            type="checkbox"
                            checked={preferencias[tipo]}
                            onChange={(e) => cambiarPreferencia(tipo, e.target.checked)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[var(--borde)] pt-3">
                    <label className="flex items-center justify-between text-sm text-[var(--texto)]">
                      Silenciar por horario
                      <input
                        type="checkbox"
                        checked={silencio.activo}
                        onChange={(e) => cambiarSilencio({ ...silencio, activo: e.target.checked })}
                      />
                    </label>
                    {silencio.activo && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--texto-secundario)]">
                        <input
                          type="time"
                          value={silencio.horaInicio}
                          onChange={(e) => cambiarSilencio({ ...silencio, horaInicio: e.target.value })}
                          className="rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1"
                        />
                        <span>a</span>
                        <input
                          type="time"
                          value={silencio.horaFin}
                          onChange={(e) => cambiarSilencio({ ...silencio, horaFin: e.target.value })}
                          className="rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}