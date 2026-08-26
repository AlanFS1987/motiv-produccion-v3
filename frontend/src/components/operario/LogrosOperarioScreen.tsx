// frontend/src/components/operario/LogrosOperarioScreen.tsx
import { useCallback, useEffect, useState } from "react";
import { Lock, Award } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerLogros, type LogroResuelto } from "../../lib/logros";

export function LogrosOperarioScreen() {
  const { usuario } = useAuth();
  const [logros, setLogros] = useState<LogroResuelto[]>([]);
  const [desbloqueados, setDesbloqueados] = useState(0);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setError(null);
    try {
      const resumen = await obtenerLogros(usuario.id, usuario.rol as "operario" | "responsable");
      setLogros(resumen.logros);
      setDesbloqueados(resumen.desbloqueados);
      setTotal(resumen.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Cargando logros...</div>;
  if (error) return <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">{error}</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xl font-medium text-slate-900">
          {desbloqueados} <span className="text-sm font-normal text-slate-500">/ {total} desbloqueados</span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900"
            style={{ width: `${total > 0 ? (desbloqueados / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Todavía no hay logros configurados.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {logros.map((l) => (
            <TarjetaLogro key={l.id} logro={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaLogro({ logro }: { logro: LogroResuelto }) {
  if (!logro.desbloqueado) {
    return (
      <div className="rounded-xl bg-white p-3 opacity-55 shadow-sm">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg grayscale">
          {logro.icono ?? <Lock size={18} className="text-slate-400" aria-hidden />}
        </div>
        <p className="mb-1 text-xs font-medium text-slate-900">{logro.nombre}</p>
        <p className="text-xs text-slate-400">???</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-400 bg-white p-3 shadow-sm">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-lg">
        {logro.icono ?? <Award size={18} className="text-emerald-700" aria-hidden />}
      </div>
      <p className="mb-1 text-xs font-medium text-slate-900">{logro.nombre}</p>
      {logro.descripcion && <p className="mb-2 text-xs leading-relaxed text-slate-500">{logro.descripcion}</p>}

      {logro.progreso ? (
        <>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600">×{logro.veces}</span>
            <span className="text-[10px] text-slate-400">
              {logro.progreso.actual.toLocaleString("es-ES")} / {logro.progreso.objetivo.toLocaleString("es-ES")}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${logro.progreso.pct}%` }} />
          </div>
        </>
      ) : (
        <span className="text-xs font-medium text-blue-600">
          ×{logro.veces} {logro.veces === 1 ? "ciclo" : "ciclos"}
        </span>
      )}
    </div>
  );
}