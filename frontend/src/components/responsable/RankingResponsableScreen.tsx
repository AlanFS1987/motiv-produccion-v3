// frontend/src/components/responsable/RankingResponsableScreen.tsx
//
// Podio de los 4 responsables — mismo componente visual que el del
// operario (medallas 1º-3º + el resto listado debajo), pero aquí el
// podio SIEMPRE se llena entero (nunca hay "quedas fuera del top 5"
// porque solo hay 4 personas). Sin Reyes del formato — el
// responsable no tiene desglose por formato (decisión de sesión).

import { useCallback, useEffect, useState } from "react";
import { Crown, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  obtenerPodioResponsablesCicloActual,
  obtenerPodioResponsablesCicloAnterior,
  type Podio,
} from "../../lib/ranking";

const COLOR_MEDALLA: Record<number, string> = {
  1: "#EF9F27",
  2: "#F0997B",
  3: "#F0997B",
};

function Medalla({ entrada, tamano }: { entrada: Podio["top5"][number]; tamano: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative overflow-hidden rounded-full border-4 bg-[var(--superficie-alt)]"
        style={{ width: tamano, height: tamano, borderColor: COLOR_MEDALLA[entrada.posicion] ?? "var(--borde)" }}
      >
        {entrada.avatarUrl ? (
          <img src={entrada.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--texto-tenue)]">
            <User size={tamano * 0.4} aria-hidden />
          </div>
        )}
        {entrada.posicion === 1 && (
          <Crown size={18} className="absolute -top-1 left-1/2 -translate-x-1/2 text-amber-500" aria-hidden />
        )}
      </div>
      <p className="text-xs font-medium text-[var(--texto)]">{entrada.username}</p>
      <p className="text-[11px] text-[var(--texto-tenue)]">{entrada.puntos} pts</p>
      <p className="text-[10px] text-[var(--texto-tenue)]">
        {entrada.cantidad} turnos{entrada.ptsPromedio !== null ? ` · ${entrada.ptsPromedio.toFixed(1)} pts/t` : ""}
      </p>
    </div>
  );
}

export function RankingResponsableScreen() {
  const { usuario } = useAuth();
  const [toggle, setToggle] = useState<"actual" | "anterior">("actual");
  const [podio, setPodio] = useState<Podio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setError(null);
    try {
      const datos =
        toggle === "actual"
          ? await obtenerPodioResponsablesCicloActual(usuario.id)
          : await obtenerPodioResponsablesCicloAnterior(usuario.id);
      setPodio(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario, toggle]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return <div className="rounded-2xl bg-[var(--superficie)] p-6 text-center text-sm text-[var(--texto-tenue)] shadow-sm">Cargando ranking...</div>;
  }
  if (error) {
    return <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">{error}</div>;
  }

  const top3 = podio?.top5.slice(0, 3) ?? [];
  const resto = podio?.top5.slice(3) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-[var(--superficie)] p-1 shadow-sm">
        <button
          onClick={() => setToggle("actual")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            toggle === "actual" ? "bg-[var(--acento)] text-white" : "text-[var(--texto-secundario)]"
          }`}
        >
          Ciclo actual
        </button>
        <button
          onClick={() => setToggle("anterior")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            toggle === "anterior" ? "bg-[var(--acento)] text-white" : "text-[var(--texto-secundario)]"
          }`}
        >
          Ciclo anterior
        </button>
      </div>

      <div className="rounded-2xl bg-[var(--superficie)] p-4 shadow-sm">
        {!podio || podio.top5.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--texto-tenue)]">Todavía no hay puntos en este ciclo.</p>
        ) : (
          <>
            <div className="mb-4 flex items-end justify-center gap-3">
              {[2, 1, 3]
                .map((pos) => top3.find((e) => e.posicion === pos))
                .map((entrada, i) =>
                  entrada ? (
                    <Medalla key={entrada.operarioId} entrada={entrada} tamano={i === 1 ? 72 : 56} />
                  ) : (
                    <div key={i} style={{ width: i === 1 ? 72 : 56 }} />
                  ),
                )}
            </div>
            {resto.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[var(--borde)] pt-3">
                {resto.map((entrada) => (
                  <div key={entrada.operarioId} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--texto-secundario)]">
                        {entrada.posicion}º · {entrada.username}
                      </span>
                      <span className="font-medium text-[var(--texto)]">{entrada.puntos} pts</span>
                    </div>
                    <p className="text-right text-[11px] text-[var(--texto-tenue)]">
                      {entrada.cantidad} turnos{entrada.ptsPromedio !== null ? ` · ${entrada.ptsPromedio.toFixed(1)} pts/t` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}