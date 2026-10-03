// frontend/src/components/jefe/programacion/DialogoAnadirNota.tsx
//
// Diálogo para escribir UNA nota y aplicarla a varias órdenes (todo o nada, vía la RPC
// anadir_nota_ordenes). Desplegable de frases activas + campo editable: elegir una frase
// la pone en el campo y el jefe puede cambiar la cantidad ("2 palets" -> "3 palets")
// antes de aplicar.

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { anadirNotaOrdenes, type FraseNota } from "../../../lib/programacion-notas";

const MAX_NOTA = 500;

interface Props {
  ordenes: string[];
  frases: FraseNota[];
  onCerrar: () => void;
  onHecho: (cuantas: number) => void;
}

export function DialogoAnadirNota({ ordenes, frases, onCerrar, onHecho }: Props) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aplicar() {
    setGuardando(true);
    setError(null);
    try {
      const n = await anadirNotaOrdenes(ordenes, texto);
      onHecho(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir la nota");
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Añadir nota"
    >
      <div className="w-full max-w-lg space-y-3 rounded-t-2xl bg-[var(--superficie)] p-4 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--texto)]">
            Añadir nota a {ordenes.length} {ordenes.length === 1 ? "orden" : "órdenes"}
          </h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={16} aria-hidden />
          </button>
        </div>

        <label className="block text-xs text-slate-500">
          Frase frecuente
          <select
            value=""
            onChange={(e) => e.target.value && setTexto(e.target.value)}
            disabled={frases.length === 0}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-[var(--texto)]"
          >
            <option value="">{frases.length === 0 ? "No hay frases activas" : "Elegir una frase…"}</option>
            {frases.map((f) => (
              <option key={f.id} value={f.texto}>
                {f.texto}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500">
          Texto de la nota (puedes editarlo)
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_NOTA}
            rows={3}
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[var(--texto)]"
          />
          <span className="block text-right text-[10px] text-slate-400">
            {texto.length}/{MAX_NOTA}
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={guardando || !texto.trim()}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {guardando && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Añadir a {ordenes.length}
          </button>
        </div>
      </div>
    </div>
  );
}
