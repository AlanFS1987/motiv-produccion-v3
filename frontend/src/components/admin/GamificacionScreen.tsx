// frontend/src/components/admin/GamificacionScreen.tsx
// "Gamificación" — 07-pendientes.md #18 (cerrado 24/08/2026). Lista
// de operarios/responsables con puntos totales, nivel actual,
// progreso al siguiente nivel, y el botón "otorgar generaciones"
// (fn_otorgar_bonus_nivel) — sin ventana de tiempo: queda disponible
// indefinidamente hasta que se pulsa (04-gamificacion.md, "el
// administrador es el disparador manual").
//
// Mismo patrón de estado por fila (loading/error/ok) que
// admin/ChecklistScreen.tsx.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Gift, Loader2 } from "lucide-react";
import {
  obtenerUsuariosGamificacion,
  otorgarBonusNivel,
  type UsuarioGamificacion,
} from "../../lib/admin-gamificacion";

type FiltroRol = "todos" | "operario" | "responsable";

export function GamificacionScreen() {
  const [usuarios, setUsuarios] = useState<UsuarioGamificacion[]>([]);
  const [filtro, setFiltro] = useState<FiltroRol>("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    setError(null);
    try {
      setUsuarios(await obtenerUsuariosGamificacion());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando");
    }
  }

  useEffect(() => {
    recargar().finally(() => setCargando(false));
  }, []);

  const visibles = usuarios.filter((u) => filtro === "todos" || u.rol === filtro);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        "Otorgar generaciones" persiste el snapshot de stats del nivel
        actual y da +3 generaciones de avatar la PRIMERA vez para ese
        nivel — no hace nada si ya se otorgó (botón deshabilitado). No
        hay ninguna ventana de tiempo: un usuario puede subir de nivel
        y esperar días sin perder el bonus.
      </div>

      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {(["todos", "operario", "responsable"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              filtro === f ? "bg-slate-900 text-white" : "text-slate-500"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle size={12} aria-hidden />
          {error}
        </p>
      )}

      {cargando ? (
        <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Cargando...
        </div>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-slate-400">Sin usuarios para este filtro.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {visibles.map((u) => (
            <FilaUsuario key={u.usuarioId} usuario={u} onOtorgado={recargar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaUsuario({
  usuario,
  onOtorgado,
}: {
  usuario: UsuarioGamificacion;
  onOtorgado: () => void;
}) {
  const [otorgando, setOtorgando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function manejarOtorgar() {
    setOtorgando(true);
    setError(null);
    setOk(null);
    try {
      const resultado = await otorgarBonusNivel(usuario.usuarioId);
      setOk(
        resultado.otorgado
          ? `+3 generaciones (${resultado.nivelNombre})`
          : "Ya estaba otorgado para este nivel",
      );
      onOtorgado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error otorgando");
    } finally {
      setOtorgando(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-800">{usuario.username}</p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-500">
            {usuario.rol}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {usuario.puntosTotales.toLocaleString("es-ES")} pts · Nivel {usuario.nivelActualOrden} ·{" "}
          {usuario.nivelActualNombre}
          {usuario.siguienteNivelNombre && usuario.puntosParaSiguienteNivel !== null && (
            <>
              {" "}
              · faltan {usuario.puntosParaSiguienteNivel.toLocaleString("es-ES")} para{" "}
              {usuario.siguienteNivelNombre}
            </>
          )}
        </p>
        {error && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-red-600">
            <AlertTriangle size={10} aria-hidden />
            {error}
          </p>
        )}
        {ok && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-green-600">
            <Check size={10} aria-hidden />
            {ok}
          </p>
        )}
      </div>

      <button
        onClick={manejarOtorgar}
        disabled={usuario.bonusNivelActualOtorgado || otorgando}
        className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
          usuario.bonusNivelActualOtorgado
            ? "bg-slate-100 text-slate-500"
            : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {otorgando ? (
          <Loader2 size={12} className="animate-spin" aria-hidden />
        ) : usuario.bonusNivelActualOtorgado ? (
          <Check size={12} aria-hidden />
        ) : (
          <Gift size={12} aria-hidden />
        )}
        {usuario.bonusNivelActualOtorgado ? "Ya otorgado" : "Otorgar generaciones"}
      </button>
    </li>
  );
}