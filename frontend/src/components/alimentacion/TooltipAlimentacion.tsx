// frontend/src/components/alimentacion/TooltipAlimentacion.tsx
// Fichas que salen al pasar el ratón (escritorio) o tocar (móvil) un
// punto: dato del turno o del periodo al que pertenece.

import type { ReactNode } from "react";
import { fechaCorta, type PuntoBucket } from "../../lib/alimentacion-calculos";
import type { TurnoLineaAlimentacion } from "../../lib/dashboard-alimentacion";

const NOMBRE_TURNO = { M: "Mañana", T: "Tarde", N: "Noche" } as const;

const num = (n: number, dec = 2) => n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const ent = (n: number) => Math.round(n).toLocaleString("es-ES");

function Ficha({ titulo, subtitulo, color, filas }: { titulo: string; subtitulo?: string; color: string; filas: [string, ReactNode][] }) {
  return (
    <div className="rounded-lg border border-[var(--borde)] bg-[var(--superficie)] px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2 font-semibold text-[var(--texto)]">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {titulo}
      </div>
      {subtitulo && <div className="mb-1 text-[var(--texto-tenue)]">{subtitulo}</div>}
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--texto-secundario)]">{k}</dt>
            <dd className="text-right tabular-nums text-[var(--texto)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ficha de un turno+línea (nubes de puntos). */
export function FichaTurno({ turno, color }: { turno: TurnoLineaAlimentacion; color: string }) {
  const pctSat = turno.minutosTotal > 0 ? (100 * turno.minutosSaturacion) / turno.minutosTotal : 0;
  const pctNoAl = turno.minutosTotal > 0 ? (100 * turno.minutosNoAlimentada) / turno.minutosTotal : 0;
  return (
    <Ficha
      color={color}
      titulo={`${turno.lineaNombre} · ${turno.formatos.join(", ")}`}
      subtitulo={`${fechaCorta(turno.fecha)} · ${NOMBRE_TURNO[turno.tipoTurno]}`}
      filas={[
        ["Piezas", ent(turno.piezasTotal)],
        ["Min. a plena / total", `${ent(turno.minutosPlena)} / ${ent(turno.minutosTotal)}`],
        ["% a plena", `${num(turno.pctPlena ?? 0, 1)} %`],
        ["Piezas/min a plena", num(turno.piezasMinPlena ?? 0)],
        ["Piezas/min del turno", num(turno.piezasMinTurno ?? 0)],
        ["Saturación", `${ent(turno.minutosSaturacion)} min (${num(pctSat, 1)} %)`],
        ["No alimentada", `${ent(turno.minutosNoAlimentada)} min (${num(pctNoAl, 1)} %)`],
      ]}
    />
  );
}

/** Ficha de un periodo agrupado (gráfica temporal). */
export function FichaBucket({ punto, color, formato }: { punto: PuntoBucket; color: string; formato: string }) {
  return (
    <Ficha
      color={color}
      titulo={`${punto.lineaNombre} · ${formato}`}
      subtitulo={`${punto.etiqueta}${punto.incompleta ? " (periodo en curso)" : ""}`}
      filas={[
        ["Turnos incluidos", ent(punto.turnosIncluidos)],
        ["Piezas", ent(punto.piezas)],
        ["Min. a plena / total", `${ent(punto.minutosPlena)} / ${ent(punto.minutosTotal)}`],
        ["% a plena", `${num(punto.pctPlena, 1)} %`],
        ["Piezas/min a plena", num(punto.piezasMinPlena)],
        ["Piezas/min del turno", num(punto.piezasMinTurno)],
        ["Saturación", `${num(punto.pctSaturacion, 1)} %`],
        ["No alimentada", `${num(punto.pctNoAlimentada, 1)} %`],
      ]}
    />
  );
}
