// frontend/src/components/pantalla/SlideUltimosTurnos.tsx
// Diapositiva 3 — REAL (v_produccion_turno para KPI1/KPI2 + v_calidad_turno
// para el rosco de calidad de cada turno, por turno_id exacto).
// Tarjetas a toda la altura disponible (antes se quedaban arriba con
// medio slide vacío debajo) y en orden cronológico de izquierda a
// derecha (más antiguo → más reciente — decisión de sesión).

import { useEffect, useState } from "react";
import { obtenerUltimosTurnosKpi, type TurnoKpi } from "../../lib/pantalla-carrusel";
import { Donut, SlideCargando, SlideError, SlideVacio } from "./PantallaCompartido";

const NOMBRE_TURNO: Record<string, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

export function SlideUltimosTurnos() {
  const [turnos, setTurnos] = useState<TurnoKpi[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerUltimosTurnosKpi(6)
      .then(setTurnos)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando turnos"));
  }, []);

  if (error) return <SlideError mensaje={error} />;
  if (!turnos) return <SlideCargando />;
  if (turnos.length === 0) return <SlideVacio mensaje="Sin turnos registrados todavía." />;

  const BarraKpi = ({ segmentos }: { segmentos: { valor: number; color: string; etiqueta: string }[] }) => (
    <div className="flex h-56 w-16 flex-col-reverse overflow-hidden rounded-md">
      {segmentos.map((s, i) => (
        <div key={i} className="flex items-end justify-center" style={{ height: `${s.valor}%`, background: s.color }}>
          {s.valor >= 8 && <span className="mb-1 text-xs font-semibold text-[var(--texto)]">{s.valor}%</span>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <h2 className="text-lg font-semibold text-[var(--texto)]">Últimos {turnos.length} turnos — KPI1, KPI2 y calidad</h2>
      <div className="flex flex-1 gap-3">
        {turnos.map((t) => (
          <div
            key={t.turno_id}
            className="flex flex-1 flex-col items-center justify-between rounded-xl bg-[var(--superficie-alt)] p-4"
          >
            <div className="text-center">
              <p className="text-sm font-semibold text-sky-400">{NOMBRE_TURNO[t.tipo_turno]}</p>
              <p className="text-xs text-[var(--texto-secundario)]">{t.fecha}</p>
              {t.responsable_username && (
                <p className="text-xs text-[var(--texto-tenue)]">{t.responsable_username}</p>
              )}
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                {t.kpi1_pct_plena != null ? (
                  <BarraKpi
                    segmentos={[
                      { valor: t.kpi1_pct_plena, color: "#22c55e", etiqueta: "Plena" },
                      { valor: t.kpi1_pct_alarma ?? 0, color: "#ef4444", etiqueta: "Alarma" },
                    ]}
                  />
                ) : (
                  <div className="flex h-56 w-16 items-center justify-center rounded-md bg-[var(--superficie)] px-1 text-center text-[10px] text-[var(--texto-tenue)]">
                    Sin datos
                  </div>
                )}
                <span className="text-[10px] text-[var(--texto-tenue)]">KPI1</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <BarraKpi
                  segmentos={[
                    { valor: t.kpi2_pct_plena, color: "#22c55e", etiqueta: "Plena" },
                    { valor: t.kpi2_pct_alarma, color: "#ef4444", etiqueta: "Alarma" },
                    { valor: t.kpi2_pct_no_alimentada, color: "#64748b", etiqueta: "No alim." },
                    { valor: t.kpi2_pct_fuera_produccion, color: "#a855f7", etiqueta: "Fuera prod." },
                  ]}
                />
                <span className="text-[10px] text-[var(--texto-tenue)]">KPI2</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              {t.pct_1a_completa != null ? (
                <Donut
                  size={90}
                  segmentos={[
                    { valor: t.pct_1a_completa, color: "#22c55e" },
                    { valor: t.pct_comercial_completa ?? 0, color: "#f97316" },
                    { valor: t.pct_descarte_completa ?? 0, color: "#64748b" },
                  ]}
                />
              ) : (
                <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full bg-[var(--superficie)] text-center text-[10px] text-[var(--texto-tenue)]">
                  Sin datos
                </div>
              )}
              <span className="text-xs text-[var(--texto-secundario)]">
                Calidad{t.pct_1a_completa != null ? ` · ${Math.round(t.pct_1a_completa)}% 1ª` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-[11px] text-[var(--texto-secundario)]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Plena / 1ª calidad</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Alarma (saturación+banco+máquina)</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> 2ª calidad</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" /> No alimentada / Descarte (contenedor+eco)</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> Fuera de producción</span>
      </div>
    </div>
  );
}
