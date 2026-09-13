// frontend/src/components/pantalla/SlideReyesFormato.tsx
// Diapositiva 5 — Reyes del formato (histórico + ciclo actual), con
// avatar por rey — mismo 2:3 que el Ranking pero mucho más pequeño,
// porque aquí caben 7 tarjetas a la vez, no un podio de 5. Reutiliza
// obtenerReyesDelFormato + obtenerAvataresActivos tal cual las usa
// el operario (esta última era privada de lib/ranking.ts — hay que
// exportarla ahí para poder usarla aquí también).

import { useEffect, useState } from "react";
import { Crown, Trophy, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerReyesDelFormato, obtenerAvataresActivos, type FormatoRanking } from "../../lib/ranking";
import { SlideCargando, SlideError, SlideVacio } from "./PantallaCompartido";

const ANCHO_AVATAR = 103;
const ALTO_AVATAR = 155; // 2:3, igual que el Ranking

function AvatarMini({ url, colorBorde }: { url: string | null; colorBorde: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--superficie)]"
      style={{ width: ANCHO_AVATAR, height: ALTO_AVATAR, border: `2px solid ${colorBorde}` }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <User size={28} className="text-[var(--texto-tenue)]" aria-hidden />
      )}
    </div>
  );
}

export function SlideReyesFormato() {
  const { usuario } = useAuth();
  const [formatos, setFormatos] = useState<FormatoRanking[] | null>(null);
  const [avatares, setAvatares] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    Promise.all([obtenerReyesDelFormato(usuario.id), obtenerAvataresActivos()])
      .then(([f, a]) => {
        setFormatos(f);
        setAvatares(a);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando los reyes del formato"));
  }, [usuario]);

  if (error) return <SlideError mensaje={error} />;
  if (!formatos) return <SlideCargando />;
  if (formatos.length === 0) return <SlideVacio mensaje="Sin formatos registrados todavía." />;

  const nombres = (reyes: FormatoRanking["reyesHistorico"]) => reyes.map((r) => r.username).join(" / ");
  // Si hay empate se lista a todos en el texto, pero el avatar
  // muestra solo al primero — mostrar varios avatares por empate no
  // cabe con 7 tarjetas a la vez.
  const avatarDe = (reyes: FormatoRanking["reyesHistorico"]) => {
    const operarioId = reyes[0]?.operarioId;
    return operarioId ? (avatares.get(operarioId) ?? null) : null;
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <h2 className="text-3xl font-semibold text-[var(--texto)]">Reyes del formato</h2>
      <div className="grid flex-1 grid-cols-4 gap-6 overflow-y-auto">
        {formatos.map((f) => (
          <div key={f.formato} className="flex flex-col gap-4 rounded-xl bg-[var(--superficie-alt)] p-5">
            <p className="text-xl font-semibold text-[var(--texto)]">{f.formato}</p>
            <div className="flex items-center gap-3">
              <AvatarMini url={avatarDe(f.reyesHistorico)} colorBorde="#f59e0b" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-base font-medium text-[var(--texto)]">
                  <Crown size={18} className="shrink-0 text-amber-500" aria-hidden />
                  {f.reyesHistorico.length > 0 ? nombres(f.reyesHistorico) : "—"}
                </p>
                <p className="text-sm text-[var(--texto-secundario)]">
                  Récord histórico
                  {f.reyesHistorico[0] ? ` · ${f.reyesHistorico[0].piezas.toLocaleString("es-ES")} piezas` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AvatarMini url={avatarDe(f.reyesActual)} colorBorde="#38bdf8" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-base font-medium text-[var(--texto)]">
                  <Trophy size={18} className="shrink-0 text-sky-400" aria-hidden />
                  {f.reyesActual.length > 0 ? nombres(f.reyesActual) : "—"}
                </p>
                <p className="text-sm text-[var(--texto-secundario)]">
                  Ciclo actual
                  {f.reyesActual[0] ? ` · ${f.reyesActual[0].piezas.toLocaleString("es-ES")} piezas` : ""}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}