import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { iniciarSesion } from "../lib/auth";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const resultado = await iniciarSesion(username, password);
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo iniciar sesión");
    }
    // Si ok, AuthContext se entera solo vía onAuthStateChange — no
    // hace falta redirigir a mano aquí.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={manejarEnvio}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm"
      >
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-900">
          App de Producción
        </h1>

        <label className="mb-1 block text-sm font-medium text-slate-600">Usuario</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-base"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-base"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          <LogIn size={20} aria-hidden />
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
