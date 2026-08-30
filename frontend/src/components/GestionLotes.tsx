// frontend/src/components/GestionLotes.tsx
//
// Pestaña "Lotes" (01-rol-responsable.md 3.10). Lista los últimos 15
// lotes por fecha de última actividad, con botón Finalizar/Reabrir.
// El estado NUNCA bloquea nada técnicamente (ver 05-modelo-de-datos.md
// 7.1) — es puramente una etiqueta de gestión, decisión siempre
// humana. Visible para cualquier responsable, no filtrado por turno
// (un lote puede producirse en varias líneas a la vez).
//
// Cada tarjeta muestra también el pendiente (m² y piezas que faltan
// por producir, ver lib/lote.ts / v_lote_pendiente) — null cuando el
// lote no tiene objetivo_m2 capturado, en cuyo caso no se pinta nada
// en vez de mostrar un "0" engañoso.

import { useEffect, useState } from "react";
import { Package, RotateCcw, Lock } from "lucide-react";
import { listarUltimosLotes, finalizarLote, reabrirLote, type LoteGestion } from "../lib/lote";

export function GestionLotes() {
  const [lotes, setLotes] = useState<LoteGestion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarUltimosLotes();
      setLotes(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }

  async function manejarFinalizar(loteId: string) {
    setProcesandoId(loteId);
    try {
      await finalizarLote(loteId);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcesandoId(null);
    }
  }

  async function manejarReabrir(loteId: string) {
    setProcesandoId(loteId);
    try {
      await reabrirLote(loteId);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcesandoId(null);
    }
  }

  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando lotes...</div>;
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <Package size={20} className="text-slate-400" aria-hidden />
        <h2 className="text-sm font-medium text-slate-700">Gestión de lotes</h2>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {lotes.length === 0 ? (
        <p className="text-center text-sm text-slate-400">Todavía no hay ningún lote con actividad.</p>
      ) : (
        <div className="space-y-3">
          {lotes.map((lote) => (
            <FilaLote
              key={lote.id}
              lote={lote}
              procesando={procesandoId === lote.id}
              onFinalizar={() => manejarFinalizar(lote.id)}
              onReabrir={() => manejarReabrir(lote.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** m² con 1 decimal, piezas como entero — mismo criterio que el resto de pantallas de producción. */
function formatPendiente(m2: number, piezas: number): string {
  const m2Fmt = m2.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const piezasFmt = Math.round(piezas).toLocaleString("es-ES");
  return `${m2Fmt} m² · ${piezasFmt} piezas`;
}

function FilaLote({
  lote,
  procesando,
  onFinalizar,
  onReabrir,
}: {
  lote: LoteGestion;
  procesando: boolean;
  onFinalizar: () => void;
  onReabrir: () => void;
}) {
  const finalizado = lote.estado === "finalizado";
  const tienePendiente = lote.m2Pendiente !== null && lote.piezasPendiente !== null;
  const completado = tienePendiente && lote.m2Pendiente === 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {lote.modeloNombre} · {lote.marcaNombre}
          </p>
          <p className="text-xs text-slate-400">Orden {lote.numeroOrden}</p>
          <p className="mt-1 text-xs text-slate-400">Última actividad: {formatFecha(lote.ultimaActividad)}</p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
            finalizado ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {finalizado ? "Finalizado" : "Iniciado"}
        </span>
      </div>

      {tienePendiente && (
        <p className={`mt-2 text-xs font-medium ${completado ? "text-emerald-600" : "text-amber-700"}`}>
          {completado
            ? "Objetivo completado"
            : `Pendiente: ${formatPendiente(lote.m2Pendiente as number, lote.piezasPendiente as number)}`}
        </p>
      )}

      <button
        type="button"
        disabled={procesando}
        onClick={finalizado ? onReabrir : onFinalizar}
        className={`mt-3 flex w-full items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium disabled:opacity-50 ${
          finalizado ? "border-slate-300 text-slate-600" : "border-red-300 text-red-700"
        }`}
      >
        {finalizado ? <RotateCcw size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
        {procesando ? "Guardando..." : finalizado ? "Reabrir" : "Finalizar"}
      </button>
    </div>
  );
}