// frontend/src/components/operario/RankingOperarioScreen.tsx
import { useCallback, useEffect, useState } from "react";
import { Crown, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  obtenerPodioCicloActual,
  obtenerPodioCicloAnterior,
  obtenerReyesDelFormato,
  type Podio,
  type FormatoRanking,
} from "../../lib/ranking";

const COLOR_MEDALLA: Record<number, string> = {
  1: "#EF9F27",
  2: "#F0997B",
  3: "#F0997B",
};

export function RankingOperarioScreen() {
  const { usuario } = useAuth();
  const [toggle, setToggle] = useState<"actual" | "anterior">("actual");
  const [podio, setPodio] = useState<Podio | null>(null);
  const [formatos, setFormatos] = useState<FormatoRanking[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setError(null);
    try {
      const [podioData, formatosData] = await Promise.all([
        toggle === "actual" ? obtenerPodioCicloActual(usuario.id) : obtenerPodioCicloAnterior(usuario.id),
        obtenerReyesDelFormato(usuario.id),
      ]);
      setPodio(podioData);
      setFormatos(formatosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario, toggle]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Cargando ranking...</div>;
  if (error) return <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">{error}</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        <button
          onClick={() => setToggle("actual")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${toggle === "actual" ? "bg-slate-900 text-white" : "text-slate-500"}`}
        >
          Ciclo actual
        </button>
        <button
          onClick={() => setToggle("anterior")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${toggle === "anterior" ? "bg-slate-900 text-white" : "text-slate-500"}`}
        >
          Ciclo anterior
        </button>
      </div>

      {podio && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {podio.top5.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todavía no hay puntos en este ciclo.</p>
          ) : (
            <>
              <div className="mb-4 flex items-end justify-center gap-2">
                {[2, 1, 3]
                  .map((pos) => podio.top5.find((e) => e.posicion === pos))
                  .map((entrada, i) =>
                    entrada ? (
                      <div key={entrada.operarioId} className="flex flex-col items-center">
                        <div
                          className="mb-1 flex items-center justify-center overflow-hidden rounded-xl bg-slate-100"
                          style={{
                            width: entrada.posicion === 1 ? 56 : 46,
                            height: entrada.posicion === 1 ? 84 : 69,
                            border: entrada.posicion === 1 ? `2px solid ${COLOR_MEDALLA[1]}` : undefined,
                          }}
                        >
                          {entrada.avatarUrl ? (
                            <img
                              src={entrada.avatarUrl}
                              alt={entrada.username}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User size={entrada.posicion === 1 ? 24 : 20} className="text-slate-400" aria-hidden />
                          )}
                        </div>
                        <p className="text-center text-xs font-medium text-slate-900">{entrada.username}</p>
                        <p className="mb-1 text-[11px] text-slate-500">{entrada.puntos.toLocaleString("es-ES")} pts</p>
                        <div
                          className="flex items-center justify-center rounded-t-md text-sm font-medium"
                          style={{
                            width: 60,
                            height: entrada.posicion === 1 ? 60 : entrada.posicion === 2 ? 40 : 28,
                            backgroundColor: COLOR_MEDALLA[entrada.posicion],
                            color: "#4A1B0C",
                          }}
                        >
                          {entrada.posicion}
                        </div>
                      </div>
                    ) : (
                      <div key={i} style={{ width: 60 }} />
                    ),
                  )}
              </div>

              <div className="border-t border-slate-100 pt-2">
                {podio.top5
                  .filter((e) => e.posicion > 3)
                  .map((e) => (
                    <div key={e.operarioId} className="flex items-center justify-between px-1 py-1.5 text-sm">
                      <span className="text-slate-600">
                        {e.posicion}º {e.username}
                      </span>
                      <span className="font-medium text-slate-900">{e.puntos.toLocaleString("es-ES")} pts</span>
                    </div>
                  ))}
              </div>

              {podio.tuEntrada && !podio.tuEntradaEnTop5 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 p-2 text-sm">
                  <span className="font-medium text-blue-700">Tú · {podio.tuEntrada.posicion}º</span>
                  <span className="font-medium text-blue-700">{podio.tuEntrada.puntos.toLocaleString("es-ES")} pts</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-1 text-sm font-medium text-slate-900">Reyes del formato</p>
        <p className="mb-3 text-xs text-slate-400">Actual = piezas en este ciclo. Histórico = récord de un solo parte.</p>

        {formatos.map((f) => (
          <div key={f.formato} className="border-b border-slate-100 py-2.5 last:border-b-0">
            <p className="mb-1.5 text-xs font-medium text-slate-500">{f.formato}</p>

            {f.reyesActual.map((r, i) => (
              <FilaRey key={`actual-${i}`} nombre={r.username} etiqueta="actual" piezas={r.piezas} color="text-slate-400" />
            ))}
            {f.reyesHistorico.map((r, i) => (
              <FilaRey
                key={`historico-${i}`}
                nombre={r.username}
                etiqueta={`histórico${r.fecha ? `, ${new Date(r.fecha).toLocaleDateString("es-ES")}` : ""}`}
                piezas={r.piezas}
                color="text-amber-500"
              />
            ))}

            <div className="mt-1 flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1.5 text-sm">
              <User size={14} className="shrink-0 text-blue-600" aria-hidden />
              <span className="flex-1 text-blue-700">Tú</span>
              <span className="font-medium text-blue-700">
                {f.tuPiezasActual ?? 0} actual{f.tuMejorParte ? ` · ${f.tuMejorParte} mejor parte` : " · sin partes de este formato"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilaRey({ nombre, etiqueta, piezas, color }: { nombre: string; etiqueta: string; piezas: number; color: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-sm">
      <Crown size={16} className={`shrink-0 ${color}`} aria-hidden />
      <span className="flex-1 text-slate-700">
        {nombre} <span className="text-slate-400">{etiqueta}</span>
      </span>
      <span className="font-medium text-slate-900">{piezas}</span>
    </div>
  );
}