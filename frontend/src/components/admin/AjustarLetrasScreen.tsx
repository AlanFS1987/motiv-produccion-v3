// frontend/src/components/admin/AjustarLetrasScreen.tsx
// Ajustar la letra de rotación (A/B/C/D) y el rol de cualquier
// usuario (excepto administrador). Cambio inmediato por fila (sin
// formulario de "guardar todo"), con indicador de guardado por fila.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  actualizarLetra,
  actualizarRol,
  obtenerUsuariosConLetra,
  type Letra,
  type RolAsignable,
  type UsuarioConLetra,
} from "../../lib/admin-usuarios";

const LETRAS: Letra[] = ["A", "B", "C", "D"];

const ROLES: { valor: RolAsignable; etiqueta: string }[] = [
  { valor: "responsable", etiqueta: "Responsable" },
  { valor: "suplente", etiqueta: "Suplente" },
  { valor: "operario", etiqueta: "Operario" },
  { valor: "jefe", etiqueta: "Jefe" },
  { valor: "produccion", etiqueta: "Producción" },
  { valor: "calidad", etiqueta: "Calidad" },
];

function FilaUsuario({
  usuario,
  onGuardado,
  onRolGuardado,
}: {
  usuario: UsuarioConLetra;
  onGuardado: (id: string, letra: Letra | null) => void;
  onRolGuardado: (id: string, rol: RolAsignable) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const tieneLetra = usuario.rol === "responsable" || usuario.rol === "operario";

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

  async function cambiarRol(nuevoRol: string) {
    const rol = nuevoRol as RolAsignable;
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await actualizarRol(usuario.id, rol);
      onRolGuardado(usuario.id, rol);
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
      </div>
      <div className="flex items-center gap-2">
        {guardando && <Loader2 size={14} className="animate-spin text-slate-400" aria-hidden />}
        {ok && <Check size={14} className="text-green-600" aria-hidden />}
        {error && <AlertTriangle size={14} className="text-red-500" aria-hidden />}
        <select
          value={usuario.rol}
          disabled={guardando}
          onChange={(e) => cambiarRol(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </select>
        {tieneLetra && (
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
        )}
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

  function marcarRolGuardado(id: string, rol: RolAsignable) {
    setUsuarios((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, rol, letra: rol === "responsable" || rol === "operario" ? u.letra : null }
          : u
      )
    );
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        Cambiar la letra afecta a qué turno le toca a partir de ahora — no reescribe partes ya
        creados (esos siguen atribuidos a quien realmente los hizo, según <code>parte.operario_id</code>).
        No es posible asignar el rol administrador desde aquí.
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Usuarios ({usuarios.length})</h2>
        <div className="space-y-1.5">
          {usuarios.map((u) => (
            <FilaUsuario key={u.id} usuario={u} onGuardado={marcarGuardado} onRolGuardado={marcarRolGuardado} />
          ))}
        </div>
      </section>
    </div>
  );
}