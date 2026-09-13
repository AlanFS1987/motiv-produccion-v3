// frontend/src/components/pantalla/SlideRanking.tsx
// Diapositiva 4 — Ranking de operarios: los DOS ciclos a la vez,
// ciclo anterior a la izquierda y ciclo actual a la derecha (mismo
// criterio cronológico que Últimos turnos). Reutiliza
// obtenerPodioCicloActual/Anterior tal cual los usa el operario — el
// usuarioId solo sirve para calcular "tu posición", que aquí siempre
// sale null (la cuenta 'pantalla' no es un operario), así que
// directamente no se pinta esa parte.
//
// Todos los tamaños de esta diapositiva están al doble de la versión
// anterior (avatares, texto, iconos, espaciados) — pedido en sesión.

import { useEffect, useState } from "react";
import { Crown, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerPodioCicloActual, obtenerPodioCicloAnterior, type Podio } from "../../lib/ranking";
import { SlideCargando, SlideError, SlideVacio } from "./PantallaCompartido";

const COLOR_MEDALLA: Record<number, string> = { 1: "#EF9F27", 2: "#F0997B", 3: "#F0997B" };

// Los avatares RPG se generan siempre a 672×1008 (ratio 2:3, retrato
// vertical completo — ver 04-gamificacion.md). El marco respeta ese
// mismo 2:3, así que object-cover encaja la imagen entera sin
// recortarla ni deformarla.
const ANCHO_AVATAR: Record<number, number> = { 1: 220, 2: 170, 3: 170 };
const ALTO_AVATAR: Record<number, number> = { 1: 330, 2: 254, 3: 254 };

// Medio ranking (podio + resto) para UN ciclo — se pinta dos veces,
// una por cada mitad de la diapositiva.
function PodioCiclo({ titulo, podio }: { titulo: string; podio: Podio }) {
  if (podio.top5.length === 0) {
    return (
      <div className="flex h-full flex-col items-center gap-8">
        <h3 className="text-2xl font-semibold text-[var(--texto-secundario)]">{titulo}</h3>
        <div className="flex flex-1 items-center justify-center text-2xl text-[var(--texto-tenue)]">
          Todavía no hay puntos.
        </div>
      </div>
    );
  }

  const top3 = [2, 1, 3].map((pos) => podio.top5.find((e) => e.posicion === pos));
  const resto = podio.top5.filter((e) => e.posicion > 3);

  return (
    <div className="flex h-full flex-col items-center gap-8">
      <h3 className="text-2xl font-semibold text-[var(--texto-secundario)]">{titulo}</h3>
      <div className="flex flex-1 flex-col items-center justify-center gap-16">
        <div className="flex items-end justify-center gap-10">
          {top3.map((entrada, i) =>
            entrada ? (
              <div key={entrada.operarioId} className="flex flex-col items-center gap-4">
                <div
                  className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--superficie-alt)]"
                  style={{
                    width: ANCHO_AVATAR[entrada.posicion],
                    height: ALTO_AVATAR[entrada.posicion],
                    border: `6px solid ${COLOR_MEDALLA[entrada.posicion] ?? "var(--borde)"}`,
                  }}
                >
                  {entrada.avatarUrl ? (
                    <img src={entrada.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User size={entrada.posicion === 1 ? 80 : 60} className="text-[var(--texto-tenue)]" aria-hidden />
                  )}
                  {entrada.posicion === 1 && (
                    <Crown
                      size={48}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500"
                      aria-hidden
                    />
                  )}
                </div>
                <p className="text-2xl font-semibold text-[var(--texto)]">{entrada.username}</p>
                <p className="text-xl text-[var(--texto-secundario)]">{entrada.puntos.toLocaleString("es-ES")} pts</p>
                <p className="text-lg text-[var(--texto-tenue)]">
                  {entrada.cantidad} partes
                  {entrada.ptsPromedio !== null ? ` · ${entrada.ptsPromedio.toFixed(1)} pts/p` : ""}
                </p>
              </div>
            ) : (
              <div key={i} style={{ width: ANCHO_AVATAR[i === 1 ? 1 : 2] }} />
            ),
          )}
        </div>
        {resto.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {resto.map((entrada) => (
              <div
                key={entrada.operarioId}
                className="flex items-center gap-4 rounded-xl bg-[var(--superficie-alt)] px-6 py-3"
              >
                <span className="text-xl font-semibold text-[var(--texto-tenue)]">{entrada.posicion}º</span>
                <span className="text-xl font-medium text-[var(--texto)]">{entrada.username}</span>
                <span className="text-xl text-[var(--texto-secundario)]">
                  {entrada.puntos.toLocaleString("es-ES")} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SlideRanking() {
  const { usuario } = useAuth();
  const [actual, setActual] = useState<Podio | null>(null);
  const [anterior, setAnterior] = useState<Podio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    Promise.all([obtenerPodioCicloActual(usuario.id), obtenerPodioCicloAnterior(usuario.id)])
      .then(([a, b]) => {
        setActual(a);
        setAnterior(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando el ranking"));
  }, [usuario]);

  if (error) return <SlideError mensaje={error} />;
  if (!actual || !anterior) return <SlideCargando />;
  if (actual.top5.length === 0 && anterior.top5.length === 0) {
    return <SlideVacio mensaje="Todavía no hay puntos ni en este ciclo ni en el anterior." />;
  }

  return (
    <div className="flex h-full flex-col gap-8 p-8">
      <h2 className="text-4xl font-semibold text-[var(--texto)]">Ranking de operarios</h2>
      <div className="grid flex-1 grid-cols-2 divide-x divide-[var(--borde)]">
        <div className="pr-12">
          <PodioCiclo titulo="Ciclo anterior" podio={anterior} />
        </div>
        <div className="pl-12">
          <PodioCiclo titulo="Ciclo actual" podio={actual} />
        </div>
      </div>
    </div>
  );
}