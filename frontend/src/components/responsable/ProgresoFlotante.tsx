// frontend/src/components/responsable/ProgresoFlotante.tsx
//
// Botón flotante "Progreso" (sesión de diseño 25/08/2026) — primer
// patrón de navegación de la app que no es una pestaña fija arriba.
// Un toque lo abre (aparece el panel con las 5 sub-vistas justo
// encima del botón), puedes cambiar de sub-vista sin que se cierre,
// y otro toque en el propio botón lo colapsa.
//
// "abierto" pasó a ser prop controlada por App.tsx (sesión
// 28/08/2026) — antes vivía como useState local aquí, pero eso
// impedía que tocar una pestaña de trabajo (Turno/Resumen/Lotes/
// Historial) cerrara el panel: App.tsx no tenía forma de tocar este
// estado interno. Ahora App.tsx cierra el panel en el mismo gesto
// que cambia de pestaña (ver irAPestana en App.tsx).

import { useState } from "react";
import { Sparkles, X, Trophy, Crown, BarChart3, Users, Award } from "lucide-react";
import { RankingOperarioScreen } from "../operario/RankingOperarioScreen";
import { StatsAvatarOperarioScreen } from "../operario/StatsAvatarOperarioScreen";
import { LogrosOperarioScreen } from "../operario/LogrosOperarioScreen";
import { RankingResponsableScreen } from "./RankingResponsableScreen";
import { EquipoScreen } from "./EquipoScreen";

type SubVista = "ranking-operarios" | "ranking-responsables" | "stats" | "equipo" | "logros";

const SUBVISTAS: { id: SubVista; etiqueta: string; icono: React.ReactNode }[] = [
  { id: "ranking-operarios", etiqueta: "Ranking", icono: <Trophy size={16} aria-hidden /> },
  { id: "ranking-responsables", etiqueta: "Ranking resp.", icono: <Crown size={16} aria-hidden /> },
  { id: "stats", etiqueta: "Stats", icono: <BarChart3 size={16} aria-hidden /> },
  { id: "equipo", etiqueta: "Equipo", icono: <Users size={16} aria-hidden /> },
  { id: "logros", etiqueta: "Logros", icono: <Award size={16} aria-hidden /> },
];

export function ProgresoFlotante({
  abierto,
  onAbrirCambio,
}: {
  abierto: boolean;
  onAbrirCambio: (v: boolean) => void;
}) {
  const [subVista, setSubVista] = useState<SubVista>("ranking-operarios");

  return (
    <>
      {abierto && (
        <div className="absolute inset-0 z-40 flex flex-col bg-[var(--fondo)]">
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--borde)] bg-[var(--superficie)] p-1.5">
            {SUBVISTAS.map((sv) => (
              <button
                key={sv.id}
                onClick={() => setSubVista(sv.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  subVista === sv.id
                    ? "bg-[var(--acento)] text-white"
                    : "text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
                }`}
              >
                {sv.icono}
                {sv.etiqueta}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 pb-24">
            {subVista === "ranking-operarios" && <RankingOperarioScreen />}
            {subVista === "ranking-responsables" && <RankingResponsableScreen />}
            {subVista === "stats" && <StatsAvatarOperarioScreen />}
            {subVista === "equipo" && <EquipoScreen />}
            {subVista === "logros" && <LogrosOperarioScreen />}
          </div>
        </div>
      )}

      <button
        onClick={() => onAbrirCambio(!abierto)}
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--acento)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
      >
        {abierto ? <X size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
        Progreso
      </button>
    </>
  );
}