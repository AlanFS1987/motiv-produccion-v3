// frontend/src/components/responsable/EquipoScreen.tsx
import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, UserCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerEquipo, type MiembroEquipo } from "../../lib/equipo";

const COLOR_STAT: Record<"fuerza" | "resistencia" | "velocidad" | "vida", string> = {
  fuerza: "#E24B4A",
  resistencia: "#BA7517",
  velocidad: "#378ADD",
  vida: "#639922",
};

// Barras en miniatura SOBRE la imagen — franja semitransparente en
// la parte inferior de la carta, 4 barras muy finas. Solo se pintan
// si hay datos congelados (fuerza no es null); si el nivel de la
// carta activa todavía no tiene fila en personaje_stats_nivel, se
// trata igual que "sin avatar" (mismo criterio que TarjetaMiembro).
function BarritasOverlay({ miembro }: { miembro: MiembroEquipo }) {
  if (miembro.fuerza === null) return null;
  const stats: { clave: "fuerza" | "resistencia" | "velocidad" | "vida"; valor: number }[] = [
    { clave: "fuerza", valor: miembro.fuerza ?? 0 },
    { clave: "resistencia", valor: miembro.resistencia ?? 0 },
    { clave: "velocidad", valor: miembro.velocidad ?? 0 },
    { clave: "vida", valor: miembro.vida ?? 0 },
  ];
  // Escala logarítmica sencilla (mismos tramos de orden de magnitud
  // que StatsAvatarOperarioScreen) — aquí no hace falta la precisión
  // de barras por tramos, es un vistazo rápido en miniatura.
  const maxTramos = 1_000_000;
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[2px] bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
      {stats.map((s) => (
        <div key={s.clave} className="h-1 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (Math.log10(s.valor + 1) / Math.log10(maxTramos)) * 100)}%`,
              backgroundColor: COLOR_STAT[s.clave],
            }}
          />
        </div>
      ))}
    </div>
  );
}

function TarjetaMiembro({ miembro }: { miembro: MiembroEquipo }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[var(--superficie-alt)] shadow-sm">
        {miembro.avatarUrl ? (
          <>
            <img src={miembro.avatarUrl} alt="" className="h-full w-full object-cover" />
            <BarritasOverlay miembro={miembro} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--texto-tenue)]">
            <UserCircle2 size={36} aria-hidden />
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-[var(--texto)]">
        {miembro.username}
        {miembro.esResponsable && " 👑"}
      </p>
      <p className="text-[10px] text-[var(--texto-tenue)]">{miembro.nivelNombre ?? "Sin nivel"}</p>
    </div>
  );
}

export function EquipoScreen() {
  const { usuario } = useAuth();
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setError(null);
    try {
      setMiembros(await obtenerEquipo(usuario.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--texto-tenue)]">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando equipo...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {error}
      </div>
    );
  }

  if (miembros.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--borde)] p-8 text-center text-sm text-[var(--texto-tenue)]">
        No hay operarios en tu letra todavía.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {miembros.map((m) => (
        <TarjetaMiembro key={m.usuarioId} miembro={m} />
      ))}
    </div>
  );
}
