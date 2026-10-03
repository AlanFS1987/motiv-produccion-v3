// frontend/src/components/admin/FrasesNotaScreen.tsx
//
// Pestaña "Frases" del admin: frases frecuentes del desplegable al añadir una nota a
// las órdenes de Programación (memorias/22, Mejora 4). Alta, edición, activar/desactivar
// y orden. Baja lógica (`activa`), nunca borrado: mismo patrón que PuntosEngraseScreen.tsx.
// Escritura solo por la RPC guardar_frase (solo administrador).

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus } from "lucide-react";
import { guardarFrase, listarFrases, type FraseNota } from "../../lib/programacion-notas";

const MAX_FRASE = 200;

function FilaFrase({ frase, onCambiada }: { frase: FraseNota; onCambiada: (f: FraseNota) => void }) {
  const [texto, setTexto] = useState(frase.texto);
  const [orden, setOrden] = useState(frase.orden);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cambios: Partial<Pick<FraseNota, "texto" | "orden" | "activa">>) {
    const nueva = { ...frase, ...cambios };
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await guardarFrase(frase.id, nueva.texto, nueva.activa, nueva.orden);
      onCambiada(nueva);
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
      setTexto(frase.texto);
      setOrden(frase.orden);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 ${!frase.activa ? "opacity-50" : ""}`}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => texto.trim() && texto.trim() !== frase.texto && guardar({ texto: texto.trim() })}
          maxLength={MAX_FRASE}
          disabled={guardando}
          aria-label="Texto de la frase"
          className="flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-slate-300"
        />
        <input
          type="number"
          value={orden}
          onChange={(e) => setOrden(Number(e.target.value))}
          onBlur={() => orden !== frase.orden && guardar({ orden })}
          disabled={guardando}
          className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
          title="Orden"
          aria-label="Orden"
        />
        <button
          type="button"
          onClick={() => guardar({ activa: !frase.activa })}
          disabled={guardando}
          className={`rounded-lg px-2 py-1 text-xs font-medium ${
            frase.activa ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {frase.activa ? "Activa" : "Inactiva"}
        </button>
        {guardando && <Loader2 size={14} className="animate-spin text-slate-400" aria-hidden />}
        {ok && <Check size={14} className="text-green-600" aria-hidden />}
        {error && (
          <span title={error}>
            <AlertTriangle size={14} className="text-red-500" aria-hidden />
          </span>
        )}
      </div>
      {error && <p className="px-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FormularioNuevaFrase({ onCreada }: { onCreada: () => void }) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      // activa/orden nulos: el servidor la deja activa y al final de la lista.
      await guardarFrase(null, texto.trim(), null, null);
      setTexto("");
      onCreada();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
          maxLength={MAX_FRASE}
          placeholder="Nueva frase (ej. guardar 2 palets y una caja)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={crear}
          disabled={!texto.trim() || guardando}
          className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus size={14} aria-hidden />
          Añadir
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FrasesNotaScreen() {
  const [frases, setFrases] = useState<FraseNota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    listarFrases(false)
      .then(setFrases)
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
        Estas son las frases del desplegable al añadir una nota a las órdenes de Programación. El jefe
        puede editar el texto (p. ej. cambiar la cantidad) antes de aplicarla, así que no hace falta una
        frase por cada cantidad. Desactivar una frase no borra las notas ya creadas con ella.
      </div>

      <FormularioNuevaFrase onCreada={cargar} />

      <div className="space-y-1.5">
        {frases.map((f) => (
          <FilaFrase
            key={f.id}
            frase={f}
            onCambiada={(nueva) => setFrases((prev) => prev.map((x) => (x.id === f.id ? nueva : x)))}
          />
        ))}
        {frases.length === 0 && <p className="text-sm text-slate-400">Todavía no hay ninguna frase.</p>}
      </div>
    </div>
  );
}
