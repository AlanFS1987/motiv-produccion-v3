// frontend/src/components/alimentacion/FiltrosAlimentacion.tsx
// Filtros comunes a las tres gráficas: formato (obligatorio), líneas
// (máximo MAX_LINEAS) y periodo que abarcan las nubes de puntos. Los
// turnos con varios formatos NO entran (se cuentan aparte en el
// resumen del panel).

import { colorDeLinea } from "../../lib/alimentacion-calculos";

export const MAX_LINEAS = 4;
export const RANGOS_NUBES = [90, 180, 365] as const;
export type RangoNubes = (typeof RANGOS_NUBES)[number];

export interface LineaDisponible {
  id: string;
  nombre: string;
}

export function FiltrosAlimentacion({
  formatos,
  formato,
  onFormato,
  lineasDisponibles,
  lineasSeleccionadas,
  onToggleLinea,
  rango,
  onRango,
}: {
  formatos: string[];
  formato: string;
  onFormato: (f: string) => void;
  lineasDisponibles: LineaDisponible[];
  lineasSeleccionadas: string[];
  onToggleLinea: (id: string) => void;
  rango: RangoNubes;
  onRango: (r: RangoNubes) => void;
}) {
  const llenas = lineasSeleccionadas.length >= MAX_LINEAS;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-[var(--texto-secundario)]">
          Formato
          <select
            value={formato}
            onChange={(e) => onFormato(e.target.value)}
            className="rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1.5 text-sm text-[var(--texto)]"
          >
            {formatos.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--texto-secundario)]">
          Periodo de las nubes
          <select
            value={rango}
            onChange={(e) => onRango(Number(e.target.value) as RangoNubes)}
            className="rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1.5 text-sm text-[var(--texto)]"
          >
            {RANGOS_NUBES.map((r) => (
              <option key={r} value={r}>
                Últimos {r} días
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1 text-xs text-[var(--texto-secundario)]">
        <span>
          Líneas <span className="text-[var(--texto-tenue)]">(máximo {MAX_LINEAS})</span>
        </span>
        {lineasDisponibles.length === 0 ? (
          <span className="text-[var(--texto-tenue)]">Ninguna línea ha producido este formato en el periodo.</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lineasDisponibles.map((l) => {
              const activa = lineasSeleccionadas.includes(l.id);
              const bloqueada = !activa && llenas;
              return (
                <button
                  key={l.id}
                  onClick={() => onToggleLinea(l.id)}
                  disabled={bloqueada}
                  title={bloqueada ? `Ya hay ${MAX_LINEAS} líneas elegidas` : undefined}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                    activa
                      ? "border-[var(--acento)] text-[var(--texto)]"
                      : "border-[var(--borde)] text-[var(--texto-secundario)] disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: activa ? colorDeLinea(l.nombre) : "transparent", border: `1.5px solid ${colorDeLinea(l.nombre)}` }}
                  />
                  {l.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
