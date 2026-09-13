// frontend/src/components/pantalla/SlideProduccionCiclo.tsx
// Diapositiva 1 — REAL (v_produccion_turno + v_calidad_turno).
// Dos barras por día: metros (gruesa, azul, % del objetivo diario) y
// calidad (fina, % real de 1ª/comercial/descarte sobre el total
// producido ese día — independiente del % de objetivo de la barra
// de arriba, puede pasar de 100%).

import { useEffect, useState } from "react";
import { fechaISO, obtenerProduccionCicloActual, type ProduccionCiclo } from "../../lib/pantalla-carrusel";
import { SlideCargando, SlideError } from "./PantallaCompartido";

export function SlideProduccionCiclo() {
  const [datos, setDatos] = useState<ProduccionCiclo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerProduccionCicloActual()
      .then(setDatos)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando el ciclo"));
  }, []);

  if (error) return <SlideError mensaje={error} />;
  if (!datos) return <SlideCargando />;

  const columnaIzq = datos.dias.slice(0, 14);
  const columnaDer = datos.dias.slice(14, 28);
  const hoyISO = fechaISO(new Date());

  const Fila = ({ dia }: { dia: (typeof datos.dias)[number] }) => {
    const esHoy = dia.fecha === hoyISO;
    const [, mes, diaNum] = dia.fecha.split("-");
    const pctMetros = Math.min(100, dia.pct_objetivo);

    const tieneProduccion = dia.m2_total > 0;
    // % REAL de cada categoría sobre el total del día — independiente
    // del % de objetivo que marca el ancho de la barra de metros de
    // arriba (esa puede pasar de 100%; esta siempre es sobre el total
    // producido). No se calcula "descarte" por resta de las otras dos
    // para no atribuirle m² que en realidad sean de otra categoría
    // (p. ej. eco, que esta pantalla no desglosa aparte) — se usa el
    // dato real de m2_contenedor tal cual.
    const pct1aReal = tieneProduccion ? (dia.m2_1a / dia.m2_total) * 100 : 0;
    const pctComReal = tieneProduccion ? (dia.m2_comercial / dia.m2_total) * 100 : 0;
    const pctDescarteReal = tieneProduccion ? (dia.m2_contenedor / dia.m2_total) * 100 : 0;

    return (
      <div className="flex flex-col gap-1">
        {/* Barra de metros — gruesa, azul, ancho = % del objetivo diario */}
        <div className="flex items-center gap-3">
          <span
            className={`w-14 shrink-0 text-sm ${esHoy ? "font-bold text-sky-400" : "text-[var(--texto-secundario)]"}`}
          >
            {diaNum}/{mes}
          </span>
          <div className="relative h-6 flex-1 overflow-hidden rounded bg-[var(--superficie-alt)]">
            <div className="absolute inset-y-0 left-0 bg-sky-400" style={{ width: `${pctMetros}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-sm text-[var(--texto-secundario)]">
            {dia.m2_total > 0 ? `${(dia.m2_total / 1000).toFixed(1)}k` : "—"}
          </span>
        </div>
        {/* Barra de calidad — fina, 3 colores de siempre, % real sobre el total del día */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0" aria-hidden />
          <div className="relative h-2 flex-1 overflow-hidden rounded bg-[var(--superficie-alt)]">
            {tieneProduccion && (
              <>
                <div className="absolute inset-y-0 left-0 bg-green-500" style={{ width: `${pct1aReal}%` }} />
                <div
                  className="absolute inset-y-0 bg-orange-500"
                  style={{ left: `${pct1aReal}%`, width: `${pctComReal}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-slate-500"
                  style={{ left: `${pct1aReal + pctComReal}%`, width: `${pctDescarteReal}%` }}
                />
              </>
            )}
          </div>
          <span className="w-24 shrink-0 text-right text-sm">
            {tieneProduccion ? (
              <>
                <span className="font-bold text-green-500">{Math.round(pct1aReal)}</span>
                <span className="text-[var(--texto-tenue)]">
                  /{Math.round(pctComReal)}/{Math.round(pctDescarteReal)}
                </span>
              </>
            ) : (
              <span className="text-[var(--texto-secundario)]">—</span>
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <h2 className="text-lg font-semibold text-[var(--texto)]">
        Producción del ciclo <span className="text-[var(--texto-secundario)]">· {datos.fechaInicioCiclo} → {datos.fechaFinCiclo}</span>
      </h2>
      <div className="grid flex-1 grid-cols-2 gap-x-10 overflow-y-auto">
        <div className="flex h-full flex-col justify-between">
          {columnaIzq.map((d) => (
            <Fila key={d.fecha} dia={d} />
          ))}
        </div>
        <div className="flex h-full flex-col justify-between">
          {columnaDer.map((d) => (
            <Fila key={d.fecha} dia={d} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-[var(--borde)] pt-3">
        <span className="text-sm font-medium text-[var(--texto-secundario)]">Total ciclo</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded bg-[var(--superficie-alt)]">
          <div
            className="absolute inset-y-0 left-0 bg-sky-500"
            style={{ width: `${Math.min(100, datos.pctObjetivoCiclo)}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-[var(--texto)]">
          {(datos.m2TotalCiclo / 1000).toFixed(1)}k m² · {datos.pctObjetivoCiclo}%
        </span>
      </div>
    </div>
  );
}