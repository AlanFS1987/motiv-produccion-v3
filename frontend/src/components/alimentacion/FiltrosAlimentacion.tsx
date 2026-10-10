// frontend/src/components/alimentacion/FiltrosAlimentacion.tsx
// Filtros comunes a todas las gráficas de la pestaña: formato
// (obligatorio), líneas, periodo y "solo turnos comparables". Los turnos
// con varios formatos NO entran (se cuentan aparte en el resumen).

import { colorDeLinea, REGLAS_TURNOS } from "../../lib/alimentacion-calculos";

export const MAX_LINEAS = 6; // todas las líneas de la planta
export const RANGOS_DIAS = [90, 180, 365] as const;
export type RangoDias = (typeof RANGOS_DIAS)[number];

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
  soloComparables,
  onSoloComparables,
}: {
  formatos: string[];
  formato: string;
  onFormato: (f: string) => void;
  lineasDisponibles: LineaDisponible[];
  lineasSeleccionadas: string[];
  onToggleLinea: (id: string) => void;
  rango: RangoDias;
  onRango: (r: RangoDias) => void;
  soloComparables: boolean;
  onSoloComparables: (v: boolean) => void;
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
          Periodo
          <select
            value={rango}
            onChange={(e) => onRango(Number(e.target.value) as RangoDias)}
            className="rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1.5 text-sm text-[var(--texto)]"
          >
            {RANGOS_DIAS.map((r) => (
              <option key={r} value={r}>
                Últimos {r} días
              </option>
            ))}
          </select>
        </label>

        <label
          className="flex items-center gap-2 pb-1.5 text-sm text-[var(--texto)]"
          title={`Turnos de ${REGLAS_TURNOS.comparable.minTotal} a ${REGLAS_TURNOS.comparable.maxTotal} min registrados y como máximo ${REGLAS_TURNOS.comparable.maxBancoMasMaquina} min entre banco y máquina`}
        >
          <input type="checkbox" checked={soloComparables} onChange={(e) => onSoloComparables(e.target.checked)} />
          Solo turnos comparables
          <span className="text-xs text-[var(--texto-tenue)]">
            ({REGLAS_TURNOS.comparable.minTotal}–{REGLAS_TURNOS.comparable.maxTotal} min, banco+máquina ≤ {REGLAS_TURNOS.comparable.maxBancoMasMaquina})
          </span>
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
