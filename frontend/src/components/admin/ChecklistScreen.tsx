// frontend/src/components/admin/ChecklistScreen.tsx
// "Checklist de limpieza" (09-administrador.md — pendiente).
// Activar/desactivar ítems y ajustar sus puntos. Un ítem desactivado
// deja de aparecer en la pantalla de Limpieza del operario
// (obtenerLineasParaLimpieza filtra activo=true), sin borrar el
// histórico de operario_checklist ya registrado con ese ítem.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  actualizarActivoItem,
  actualizarPuntosItem,
  obtenerChecklistItems,
  type ChecklistItem,
} from "../../lib/admin-checklist";

function FilaItem({
  item,
  onCambiado,
}: {
  item: ChecklistItem;
  onCambiado: (id: string, cambios: Partial<ChecklistItem>) => void;
}) {
  const [puntosLocal, setPuntosLocal] = useState(String(item.puntos));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardarPuntos() {
    const valor = parseInt(puntosLocal, 10);
    if (isNaN(valor) || valor < 0) {
      setError("Puntos inválidos");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await actualizarPuntosItem(item.id, valor);
      onCambiado(item.id, { puntos: valor });
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo() {
    setGuardando(true);
    setError(null);
    try {
      await actualizarActivoItem(item.id, !item.activo);
      onCambiado(item.id, { activo: !item.activo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div>
        <p className={`text-sm font-medium ${item.activo ? "text-slate-800" : "text-slate-400 line-through"}`}>
          {item.nombre}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {guardando && <Loader2 size={14} className="animate-spin text-slate-400" aria-hidden />}
        {ok && <Check size={14} className="text-green-600" aria-hidden />}
        {error && <AlertTriangle size={14} className="text-red-500" aria-hidden />}

        <input
          type="number"
          min={0}
          value={puntosLocal}
          disabled={guardando}
          onChange={(e) => setPuntosLocal(e.target.value)}
          onBlur={guardarPuntos}
          className="w-16 rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        />

        <button
          onClick={toggleActivo}
          disabled={guardando}
          className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            item.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {item.activo ? "Activo" : "Inactivo"}
        </button>
      </div>
    </div>
  );
}

export function ChecklistScreen() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerChecklistItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando"))
      .finally(() => setCargando(false));
  }, []);

  function marcarCambio(id: string, cambios: Partial<ChecklistItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...cambios } : i)));
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        Un ítem desactivado deja de aparecer en la pantalla de Limpieza del operario
        — el historial ya registrado no se toca.
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <FilaItem key={item.id} item={item} onCambiado={marcarCambio} />
        ))}
      </div>
    </div>
  );
}