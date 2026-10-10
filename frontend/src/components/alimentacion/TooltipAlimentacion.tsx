// frontend/src/components/alimentacion/TooltipAlimentacion.tsx
// Fichas que salen al pasar el ratón (escritorio) o tocar (móvil) un
// punto de la curva de velocidad conseguida: el turno real y, en cada
// cifra derivada, de dónde sale (para que ningún punto parezca inventado).

import type { ReactNode } from "react";
import { fechaCorta, REGLAS_TURNOS, type TramoVelocidad, type TurnoAlimentable } from "../../lib/alimentacion-calculos";

const NOMBRE_TURNO = { M: "Mañana", T: "Tarde", N: "Noche" } as const;

const num = (n: number, dec = 2) => n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const ent = (n: number) => Math.round(n).toLocaleString("es-ES");

function Ficha({ titulo, subtitulo, color, filas, nota }: { titulo: string; subtitulo?: string; color: string; filas: [string, ReactNode][]; nota?: string }) {
  return (
    <div className="max-w-xs rounded-lg border border-[var(--borde)] bg-[var(--superficie)] px-3 py-2 text-xs shadow-md">
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
      {nota && <p className="mt-1.5 text-[var(--texto-tenue)]">{nota}</p>}
    </div>
  );
}

/** Ficha de un turno en la base de tiempo alimentable (curva de velocidad conseguida). */
export function FichaAlimentable({ t, color }: { t: TurnoAlimentable; color: string }) {
  const turno = t.turno;
  const noFiable = t.tiempoAlimentable < REGLAS_TURNOS.minAlimentableFiable;
  return (
    <Ficha
      color={color}
      titulo={`${turno.lineaNombre} · ${turno.formatos.join(", ")}`}
      subtitulo={`${fechaCorta(turno.fecha)} · ${NOMBRE_TURNO[turno.tipoTurno]}`}
      filas={[
        ["Piezas reales", ent(turno.piezasTotal)],
        ["Minutos totales", ent(turno.minutosTotal)],
        ["Banco + máquina", `${ent(turno.minutosBanco + turno.minutosMaquina)} min (descontados)`],
        ["Tiempo alimentable", `${ent(t.tiempoAlimentable)} min`],
        ["Min. a plena", ent(turno.minutosPlena)],
        ["Velocidad conseguida", `${num(t.velocidad)} piezas/min`],
        ["% a plena (alimentable)", `${num(t.pctPlenaAlimentable, 1)} %`],
        [`Equivale a ${REGLAS_TURNOS.minutosTurnoEquivalente} min alimentables`, `${ent(t.piezasTurnoAlimentable)} piezas`],
        ["Saturación", `${ent(turno.minutosSaturacion)} min`],
        ["No alimentada", `${ent(turno.minutosNoAlimentada)} min`],
      ]}
      nota={
        noFiable
          ? `Menos de ${REGLAS_TURNOS.minAlimentableFiable} min alimentables: el equivalente es una extrapolación poco fiable.`
          : `Equivalente = piezas reales × ${REGLAS_TURNOS.minutosTurnoEquivalente} ÷ tiempo alimentable.`
      }
    />
  );
}

/** Ficha de un tramo de velocidad (línea de la curva). */
export function FichaTramo({ tramo }: { tramo: TramoVelocidad }) {
  return (
    <Ficha
      color="var(--texto)"
      titulo={`Tramo ${tramo.etiqueta} piezas/min`}
      subtitulo="Todas las líneas juntas"
      filas={[
        ["Turnos", ent(tramo.turnos)],
        ["% a plena (alimentable)", `${num(tramo.pctPlena, 1)} %`],
        [`Piezas por ${REGLAS_TURNOS.minutosTurnoEquivalente} min alimentables`, ent(tramo.piezasTurno)],
      ]}
      nota="Suma de piezas y minutos de los turnos del tramo, no media de porcentajes."
    />
  );
}
