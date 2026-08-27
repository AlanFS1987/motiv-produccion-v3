// frontend/src/components/admin/GestionUsuariosScreen.tsx
//
// Pestaña "Gestión" del admin: crear cuentas nuevas (no-admin) y
// cambiar la contraseña de cualquier cuenta que no sea administrador.
// Sin migrar al sistema de temas (12-temas.md) — mismo estado que
// AjustarLetrasScreen.tsx, colores slate-* fijos.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, KeyRound, Loader2, UserPlus } from "lucide-react";
import {
  obtenerUsuariosConLetra,
  type Letra,
  type RolAsignable,
  type UsuarioConLetra,
} from "../../lib/admin-usuarios";
import { crearUsuario, cambiarPasswordUsuario } from "../../lib/admin-gestion-usuarios";

const LETRAS: Letra[] = ["A", "B", "C", "D"];

const ROLES: { valor: RolAsignable; etiqueta: string }[] = [
  { valor: "responsable", etiqueta: "Responsable" },
  { valor: "suplente", etiqueta: "Suplente" },
  { valor: "operario", etiqueta: "Operario" },
  { valor: "jefe", etiqueta: "Jefe" },
  { valor: "produccion", etiqueta: "Producción" },
  { valor: "calidad", etiqueta: "Calidad" },
];

const ROLES_CON_LETRA: RolAsignable[] = ["responsable", "operario"];

// ═══════════════════════════ Crear usuario ═══════════════════════════

function FormularioCrearUsuario({ onCreado }: { onCreado: (u: UsuarioConLetra) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<RolAsignable>("operario");
  const [letra, setLetra] = useState<Letra | "">("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const tieneLetra = ROLES_CON_LETRA.includes(rol);

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setEnviando(true);
    try {
      const creado = await crearUsuario({
        username,
        password,
        rol,
        letra: tieneLetra ? (letra || null) : null,
      });
      onCreado({ id: creado.id, username: creado.username, rol: creado.rol, letra: creado.letra });
      setUsername("");
      setPassword("");
      setRol("operario");
      setLetra("");
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando el usuario");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <UserPlus size={16} aria-hidden />
        Crear usuario nuevo
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="p.ej. jgarcia"
            disabled={enviando}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Contraseña inicial</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
            disabled={enviando}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Rol</label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as RolAsignable)}
            disabled={enviando}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </div>
        {tieneLetra && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Letra de rotación</label>
            <select
              value={letra}
              onChange={(e) => setLetra(e.target.value as Letra | "")}
              disabled={enviando}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
            >
              <option value="">Sin letra</option>
              {LETRAS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={enviando || !username || !password}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {enviando && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Crear usuario
        </button>
        {ok && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check size={14} aria-hidden /> Creado
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <AlertTriangle size={14} aria-hidden /> {error}
          </span>
        )}
      </div>
    </form>
  );
}

// ═══════════════════════════ Cambiar contraseña ═══════════════════════════

function FilaCambiarPassword({ usuario }: { usuario: UsuarioConLetra }) {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await cambiarPasswordUsuario(usuario.id, password);
      setOk(true);
      setPassword("");
      setTimeout(() => {
        setOk(false);
        setAbierto(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cambiando la contraseña");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{usuario.username}</p>
          <p className="text-xs text-slate-500">{usuario.rol}{usuario.letra ? ` · letra ${usuario.letra}` : ""}</p>
        </div>
        <button
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <KeyRound size={14} aria-hidden />
          Cambiar contraseña
        </button>
      </div>

      {abierto && (
        <form onSubmit={manejarEnvio} className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña (mínimo 6)"
            disabled={enviando}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={enviando || password.length < 6}
            className="flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {enviando && <Loader2 size={12} className="animate-spin" aria-hidden />}
            Guardar
          </button>
          {ok && <Check size={14} className="text-green-600" aria-hidden />}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </form>
      )}
    </div>
  );
}

// ═══════════════════════════ Pantalla ═══════════════════════════

export function GestionUsuariosScreen() {
  const [usuarios, setUsuarios] = useState<UsuarioConLetra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    obtenerUsuariosConLetra()
      .then(setUsuarios)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando usuarios"))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <FormularioCrearUsuario onCreado={(u) => setUsuarios((prev) => [...prev, u])} />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Cambiar contraseña</h3>
        {cargando && <p className="text-sm text-slate-400">Cargando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-2">
          {usuarios.map((u) => (
            <FilaCambiarPassword key={u.id} usuario={u} />
          ))}
        </div>
      </div>
    </div>
  );
}