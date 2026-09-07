// frontend/src/components/admin/ChatAccesoScreen.tsx
// Rejilla de control de acceso — sesión 07/09/2026. Qué rol puede ver
// (y, solo para el chat general, escribir) en cada uno de los 7
// "chats". Cada fila es un chat, expandible; dentro, un interruptor
// por rol. Los cambios se guardan al momento (sin botón "Guardar").

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  CHATS_CON_ESCRITURA,
  ETIQUETA_CHAT,
  ROLES,
  TIPOS_CHAT,
  guardarAcceso,
  listarAccesos,
  type AccesoFila,
  type Rol,
  type TipoChat,
} from "../../lib/chat-acceso";
import { MODELOS_FASE3_OPCIONES, establecerModeloActivo, listarModelosDesactivados } from "../../lib/ceria";

export function ChatAccesoScreen() {
  const [accesos, setAccesos] = useState<AccesoFila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<TipoChat | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  const [modelosDesactivados, setModelosDesactivados] = useState<Set<string> | null>(null);
  const [guardandoModelo, setGuardandoModelo] = useState<string | null>(null);

  useEffect(() => {
    listarAccesos()
      .then(setAccesos)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    listarModelosDesactivados()
      .then(setModelosDesactivados)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function cambiarModelo(modeloId: string, activo: boolean) {
    setGuardandoModelo(modeloId);
    const anterior = modelosDesactivados;
    setModelosDesactivados((prev) => {
      const nuevo = new Set(prev ?? []);
      if (activo) nuevo.delete(modeloId);
      else nuevo.add(modeloId);
      return nuevo;
    });
    try {
      await establecerModeloActivo(modeloId, activo);
    } catch (err) {
      setModelosDesactivados(anterior);
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio");
    } finally {
      setGuardandoModelo(null);
    }
  }

  function obtener(tipoChat: TipoChat, rol: Rol): { puedeVer: boolean; puedeEscribir: boolean } {
    const fila = accesos?.find((a) => a.tipoChat === tipoChat && a.rol === rol);
    return { puedeVer: fila?.puedeVer ?? false, puedeEscribir: fila?.puedeEscribir ?? false };
  }

  async function cambiar(tipoChat: TipoChat, rol: Rol, puedeVer: boolean, puedeEscribir: boolean) {
    const clave = `${tipoChat}:${rol}`;
    setGuardando(clave);
    const anterior = accesos;

    // Optimista: refleja el cambio ya, revierte si falla el guardado.
    setAccesos((prev) => {
      const sinEsta = (prev ?? []).filter((a) => !(a.tipoChat === tipoChat && a.rol === rol));
      if (!puedeVer) return sinEsta;
      return [...sinEsta, { tipoChat, rol, puedeVer, puedeEscribir }];
    });

    try {
      await guardarAcceso(tipoChat, rol, puedeVer, puedeEscribir);
    } catch (err) {
      setAccesos(anterior);
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio");
    } finally {
      setGuardando(null);
    }
  }

  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!accesos || !modelosDesactivados) return <div className="p-4 text-center text-sm text-slate-400">Cargando...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-2 p-4">
      <p className="mb-2 text-sm text-[var(--texto-secundario)]">
        Quién puede ver (y, en el chat general, escribir) en cada conversación. Los cambios se guardan al momento.
      </p>

      {TIPOS_CHAT.map((tipoChat) => {
        const abierto = expandido === tipoChat;
        const conEscritura = CHATS_CON_ESCRITURA.includes(tipoChat);
        const rolesConAcceso = ROLES.filter((r) => obtener(tipoChat, r.valor).puedeVer);

        return (
          <div key={tipoChat} className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)]">
            <button
              onClick={() => setExpandido(abierto ? null : tipoChat)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-[var(--texto)]">{ETIQUETA_CHAT[tipoChat]}</p>
                <p className="text-xs text-[var(--texto-secundario)]">
                  {rolesConAcceso.length === 0
                    ? "Sin acceso para ningún rol"
                    : rolesConAcceso.map((r) => r.etiqueta).join(", ")}
                </p>
              </div>
              {abierto ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
            </button>

            {abierto && (
              <div className="border-t border-[var(--borde)] p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ROLES.map((r) => {
                    const { puedeVer, puedeEscribir } = obtener(tipoChat, r.valor);
                    const clave = `${tipoChat}:${r.valor}`;
                    const enCurso = guardando === clave;

                    return (
                      <div
                        key={r.valor}
                        className="flex items-center justify-between rounded-lg bg-[var(--superficie-alt)] px-3 py-2"
                      >
                        <span className="text-sm text-[var(--texto)]">{r.etiqueta}</span>
                        <div className="flex items-center gap-3">
                          {enCurso && (
                            <Loader2 size={14} className="animate-spin text-[var(--texto-tenue)]" aria-hidden />
                          )}
                          <label className="flex items-center gap-1 text-xs text-[var(--texto-secundario)]">
                            Ver
                            <input
                              type="checkbox"
                              checked={puedeVer}
                              onChange={(e) => cambiar(tipoChat, r.valor, e.target.checked, puedeEscribir)}
                            />
                          </label>
                          {conEscritura && (
                            <label className="flex items-center gap-1 text-xs text-[var(--texto-secundario)]">
                              Escribir
                              <input
                                type="checkbox"
                                checked={puedeVer && puedeEscribir}
                                disabled={!puedeVer}
                                onChange={(e) => cambiar(tipoChat, r.valor, true, e.target.checked)}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-6 rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--texto)]">Modelos de Ceria (Fase 3 — redacción)</p>
        <div className="space-y-2">
          {MODELOS_FASE3_OPCIONES.map((m) => {
            const activo = !modelosDesactivados.has(m.id);
            return (
              <label
                key={m.id}
                className="flex items-center justify-between rounded-lg bg-[var(--superficie-alt)] px-3 py-2 text-sm text-[var(--texto)]"
              >
                {m.etiqueta}
                <div className="flex items-center gap-2">
                  {guardandoModelo === m.id && (
                    <Loader2 size={14} className="animate-spin text-[var(--texto-tenue)]" aria-hidden />
                  )}
                  <input type="checkbox" checked={activo} onChange={(e) => cambiarModelo(m.id, e.target.checked)} />
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}