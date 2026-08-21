// frontend/src/components/admin/AjustarLetrasScreen.tsx
// Ajustar la letra de rotación (A/B/C/D) de responsables y
// operarios — hoy solo se podía hacer por SQL a mano. Cambio
// inmediato por fila (sin formulario de "guardar todo"), con
// indicador de guardado por fila para que quede claro qué se aplicó.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  actualizarLetra,
  obtenerUsuariosConLetra,
  type Letra,
  type UsuarioConLetra,
} from "../../lib/admin-usuarios";

const LETRAS: Letra[] = ["A", "B", "C", "D"];

function FilaUsuario({
  usuario,
  onGuardado,
}: {
  usuario: UsuarioConLetra;
  onGuardado: (id: string, letra: Letra | null) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function cambiar(nuevaLetra: string) {
    const letra = (nuevaLetra || null) as Letra | null;
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await actualizarLetra(usuario.id, letra);
      onGuardado(usuario.id, letra);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div>
        <p className="text-sm font-medium text-slate-800">{usuario.username}</p>
        <p className="text-xs text-slate-400">{usuario.rol === "responsable" ? "Responsable" : "Operario"}</p>
      </div>
      <div className="flex items-center gap-2">
        {guardando && <Loader2 size={14} className="animate-spin text-slate-400" aria-hidden />}
        {ok && <Check size={14} className="text-green-600" aria-hidden />}
        {error && <AlertTriangle size={14} className="text-red-500" aria-hidden />}
        <select
          value={usuario.letra ?? ""}
          disabled={guardando}
          onChange={(e) => cambiar(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="">Sin letra</option>
          {LETRAS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function AjustarLetrasScreen() {
  const [usuarios, setUsuarios] = useState<UsuarioConLetra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerUsuariosConLetra()
      .then(setUsuarios)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando usuarios"))
      .finally(() => setCargando(false));
  }, []);

  function marcarGuardado(id: string, letra: Letra | null) {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, letra } : u)));
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando usuarios...
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

  const responsables = usuarios.filter((u) => u.rol === "responsable");
  const operarios = usuarios.filter((u) => u.rol === "operario");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        Cambiar la letra afecta a qué turno le toca a partir de ahora — no reescribe partes ya
        creados (esos siguen atribuidos a quien realmente los hizo, según <code>parte.operario_id</code>).
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Responsables ({responsables.length})</h2>
        <div className="space-y-1.5">
          {responsables.map((u) => (
            <FilaUsuario key={u.id} usuario={u} onGuardado={marcarGuardado} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Operarios ({operarios.length})</h2>
        <div className="space-y-1.5">
          {operarios.map((u) => (
            <FilaUsuario key={u.id} usuario={u} onGuardado={marcarGuardado} />
          ))}
        </div>
      </section>
    </div>
  );
}