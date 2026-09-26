// frontend/src/components/admin/NotasScreen.tsx
//
// Pestaña "Notas": notas sueltas del admin sobre cualquier cosa de la
// app (no ligadas a un turno/parte/lote). Misma tabla que
// Programación (`admin_notas`, tipo='nota') — ver lib/admin-notas.ts.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Trash2 } from "lucide-react";
import {
  actualizarNota,
  crearNota,
  eliminarNota,
  listarNotas,
  type Nota,
} from "../../lib/admin-notas";

function FormularioNuevaNota({ onCreada }: { onCreada: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!contenido.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await crearNota(titulo, contenido.trim());
      setTitulo("");
      setContenido("");
      onCreada();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando la nota");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título (opcional)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={4}
        placeholder="Escribe la nota..."
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={crear}
          disabled={!contenido.trim() || guardando}
          className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
          Añadir nota
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function TarjetaNota({ nota, onCambiada, onBorrada }: { nota: Nota; onCambiada: (n: Nota) => void; onBorrada: (id: string) => void }) {
  const [titulo, setTitulo] = useState(nota.titulo ?? "");
  const [contenido, setContenido] = useState(nota.contenido);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarCambio(cambios: { titulo?: string | null; contenido?: string }) {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await actualizarNota(nota.id, cambios);
      onCambiada({ ...nota, ...cambios } as Nota);
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!confirm("¿Borrar esta nota? No se puede deshacer.")) return;
    setBorrando(true);
    try {
      await eliminarNota(nota.id);
      onBorrada(nota.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error borrando");
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo !== (nota.titulo ?? "") && guardarCambio({ titulo: titulo.trim() || null })}
          placeholder="(sin título)"
          disabled={guardando || borrando}
          className="flex-1 rounded border border-transparent px-2 py-1 text-sm font-semibold hover:border-slate-200 focus:border-slate-300"
        />
        <button
          type="button"
          onClick={borrar}
          disabled={borrando}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Borrar nota"
        >
          {borrando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
        </button>
      </div>
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        onBlur={() => contenido !== nota.contenido && guardarCambio({ contenido })}
        rows={3}
        disabled={guardando || borrando}
        className="w-full resize-y rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-slate-300"
      />
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>{new Date(nota.createdAt).toLocaleString("es-ES")}</span>
        {guardando && <Loader2 size={12} className="animate-spin" aria-hidden />}
        {ok && <Check size={12} className="text-green-600" aria-hidden />}
        {error && (
          <span className="flex items-center gap-1 text-red-500">
            <AlertTriangle size={12} aria-hidden /> {error}
          </span>
        )}
      </div>
    </div>
  );
}

export function NotasScreen() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    listarNotas()
      .then(setNotas)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando"))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <FormularioNuevaNota onCreada={cargar} />

      <div className="space-y-2">
        {notas.map((n) => (
          <TarjetaNota
            key={n.id}
            nota={n}
            onCambiada={(actualizada) => setNotas((prev) => prev.map((x) => (x.id === n.id ? actualizada : x)))}
            onBorrada={(id) => setNotas((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
        {notas.length === 0 && <p className="text-sm text-slate-400">Todavía no hay ninguna nota.</p>}
      </div>
    </div>
  );
}
