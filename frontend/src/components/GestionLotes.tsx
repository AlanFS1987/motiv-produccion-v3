// frontend/src/components/GestionLotes.tsx
//
// Pestaña "Lotes" (01-rol-responsable.md 3.10). Lista TODOS los lotes
// iniciados (v_lote_gestion), con la actividad más reciente primero.
// Un lote se finaliza solo cuando se completa su último parte y se
// alcanza el objetivo (trigger en BD) y se reabre solo si entra un
// parte nuevo; aquí queda el Finalizar manual, con confirmación, para
// órdenes que se produjeron por debajo de lo programado. El estado
// NUNCA bloquea nada técnicamente (ver 05-modelo-de-datos.md 7.1).
// Visible para cualquier responsable, no filtrado por turno (un lote
// puede producirse en varias líneas a la vez).
//
// Pendiente y % del objetivo son null cuando el lote no tiene
// objetivo_m2 capturado — en ese caso no se pinta nada en vez de
// mostrar un "0" engañoso.

import { useEffect, useState } from "react";
import { Package, Lock } from "lucide-react";
import { listarLotesAbiertos, finalizarLote } from "../lib/lote";
import { formatPendiente, textoHace, textoPctObjetivo, type LoteGestion } from "../lib/lote-logica";

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
      setLotes(await listarLotesAbiertos());
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

  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando lotes...</div>;
  }

  return (
    <div className="mx-auto max-w-md pb-6">
      <div className="mb-4 flex items-center gap-2">
        <Package size={20} className="text-slate-400" aria-hidden />
        <h2 className="text-sm font-medium text-slate-700">Lotes abiertos ({lotes.length})</h2>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {lotes.length === 0 ? (
        <p className="text-center text-sm text-slate-400">No hay ningún lote abierto.</p>
      ) : (
        <div className="space-y-3">
          {lotes.map((lote) => (
            <FilaLote
              key={lote.id}
              lote={lote}
              procesando={procesandoId === lote.id}
              onFinalizar={() => manejarFinalizar(lote.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaLote({
  lote,
  procesando,
  onFinalizar,
}: {
  lote: LoteGestion;
  procesando: boolean;
  onFinalizar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const tienePendiente = lote.m2Pendiente !== null && lote.piezasPendiente !== null;
  const pct = textoPctObjetivo(lote.pctObjetivo);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {lote.modeloNombre} · {lote.marcaNombre}
          </p>
          <p className="text-xs text-slate-400">Orden {lote.numeroOrden}</p>
        </div>

        {lote.tieneParteAbierto && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            En producción
          </span>
        )}
      </div>

      {tienePendiente && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Pendiente: {formatPendiente(lote.m2Pendiente as number, lote.piezasPendiente as number)}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        {pct !== null && <>{pct} del objetivo · </>}
        {textoHace(lote.ultimaActividad)}
      </p>

      {confirmando ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={procesando}
            onClick={() => setConfirmando(false)}
            className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={procesando}
            onClick={onFinalizar}
            className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {procesando ? "Guardando..." : "Sí, finalizar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-red-300 py-2 text-xs font-medium text-red-700"
        >
          <Lock size={14} aria-hidden />
          Finalizar
        </button>
      )}
    </div>
  );
}
