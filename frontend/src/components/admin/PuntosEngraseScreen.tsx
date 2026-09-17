// frontend/src/components/admin/PuntosEngraseScreen.tsx
//
// Pestaña "Engrase" del admin: crear/editar/desactivar los puntos de
// la checklist de engrase — misma lista para todas las líneas, la
// usa el rol mecánico. Guardado inmediato por fila, mismo patrón que
// AjustarLetrasScreen.tsx.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus } from "lucide-react";
import {
  actualizarPuntoEngrase,
  crearPuntoEngrase,
  listarPuntosEngraseAdmin,
  type PuntoEngraseAdmin,
} from "../../lib/admin-engrase";

function FilaPunto({ punto, onCambiado }: { punto: PuntoEngraseAdmin; onCambiado: (p: PuntoEngraseAdmin) => void }) {
  const [nombre, setNombre] = useState(punto.nombre);
  const [orden, setOrden] = useState(punto.orden);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarCambio(cambios: Partial<PuntoEngraseAdmin>) {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await actualizarPuntoEngrase(punto.id, cambios);
      onCambiado({ ...punto, ...cambios });
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 ${!punto.activo ? "opacity-50" : ""}`}>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => nombre.trim() !== punto.nombre && guardarCambio({ nombre: nombre.trim() })}
        disabled={guardando}
        className="flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-slate-300"
      />
      <input
        type="number"
        value={orden}
        onChange={(e) => setOrden(Number(e.target.value))}
        onBlur={() => orden !== punto.orden && guardarCambio({ orden })}
        disabled={guardando}
        className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
        title="Orden"
      />
      <button
        type="button"
        onClick={() => guardarCambio({ activo: !punto.activo })}
        disabled={guardando}
        className={`rounded-lg px-2 py-1 text-xs font-medium ${
          punto.activo ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {punto.activo ? "Activo" : "Inactivo"}
      </button>
      {guardando && <Loader2 size={14} className="animate-spin text-slate-400" aria-hidden />}
      {ok && <Check size={14} className="text-green-600" aria-hidden />}
      {error && (
        <span title={error}>
          <AlertTriangle size={14} className="text-red-500" aria-hidden />
        </span>
      )}
    </div>
  );
}

function FormularioNuevoPunto({ siguienteOrden, onCreado }: { siguienteOrden: number; onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await crearPuntoEngrase(nombre, siguienteOrden);
      setNombre("");
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && crear()}
        placeholder="Nuevo punto (ej. Rodillo tensor izquierdo)"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={crear}
        disabled={!nombre.trim() || guardando}
        className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        <Plus size={14} aria-hidden />
        Añadir
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function PuntosEngraseScreen() {
  const [puntos, setPuntos] = useState<PuntoEngraseAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    listarPuntosEngraseAdmin()
      .then(setPuntos)
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
        Esta es la checklist que ven los mecánicos al crear un parte de engrase — es la misma para
        todas las líneas. Desactivar un punto no borra los partes antiguos que ya lo tenían marcado.
      </div>

      <FormularioNuevoPunto siguienteOrden={puntos.length} onCreado={cargar} />

      <div className="space-y-1.5">
        {puntos.map((p) => (
          <FilaPunto key={p.id} punto={p} onCambiado={(actualizado) => setPuntos((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)))} />
        ))}
        {puntos.length === 0 && <p className="text-sm text-slate-400">Todavía no hay ningún punto en la checklist.</p>}
      </div>
    </div>
  );
}