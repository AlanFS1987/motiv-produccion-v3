// frontend/src/components/alimentacion/NubesAlimentacion.tsx
// Las dos nubes de puntos (una fila por turno+línea):
//   - Izquierda: piezas/min del turno  vs % a plena
//   - Derecha:   piezas/min a plena    vs % a plena
// La segunda es la primera dividida entre el % a plena, por eso se
// leen juntas. Sin zoom (fase 2, solo escritorio). Los filtros de
// formato/líneas/periodo los pone el panel padre.

import { useMemo } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { colorDeLinea, regresionLineal } from "../../lib/alimentacion-calculos";
import { REFERENCIAS_PIEZAS_MIN, type TurnoLineaAlimentacion } from "../../lib/dashboard-alimentacion";
import { FichaTurno } from "./TooltipAlimentacion";

export interface LineaSeleccionada {
  id: string;
  nombre: string;
}

interface Referencia {
  valor: number;
  etiqueta: string;
  color: string;
  /** Dónde se escribe la etiqueta respecto a su línea (dos líneas casi iguales no deben pisarse). */
  lado: "arriba" | "abajo";
}

interface PuntoNube {
  x: number;
  y: number;
  turno: TurnoLineaAlimentacion;
}

function NubeScatter({
  titulo,
  turnos,
  lineas,
  campoY,
  referencias,
  conTendencia,
}: {
  titulo: string;
  turnos: TurnoLineaAlimentacion[];
  lineas: LineaSeleccionada[];
  campoY: "piezasMinTurno" | "piezasMinPlena";
  referencias: Referencia[];
  conTendencia: boolean;
}) {
  const { series, regresion, xMin, xMax, dominioX, ticksX } = useMemo(() => {
    const porLinea = lineas.map((l) => ({
      linea: l,
      datos: turnos
        .filter((t) => t.lineaId === l.id && t.pctPlena !== null && t[campoY] !== null)
        .map<PuntoNube>((t) => ({ x: t.pctPlena as number, y: t[campoY] as number, turno: t })),
    }));
    const todos = porLinea.flatMap((s) => s.datos);
    const xs = todos.map((p) => p.x);
    const ys = todos.map((p) => p.y);
    const xMin = xs.length ? Math.min(...xs) : 0;
    const xMax = xs.length ? Math.max(...xs) : 100;
    const lo = Math.max(0, Math.floor(xMin / 5) * 5 - 5);
    const hi = Math.min(100, Math.ceil(xMax / 5) * 5 + 5);
    const paso = hi - lo > 40 ? 10 : 5;
    const ticksX: number[] = [];
    for (let v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) ticksX.push(v);
    return { series: porLinea, regresion: regresionLineal(xs, ys), xMin, xMax, dominioX: [lo, hi] as [number, number], ticksX };
  }, [turnos, lineas, campoY]);

  const hayDatos = series.some((s) => s.datos.length > 0);

  return (
    <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
      <h3 className="mb-2 text-sm font-semibold text-[var(--texto)]">
        {titulo}
        <span className="ml-2 font-normal text-[var(--texto-tenue)]">
          {regresion ? `r = ${regresion.r.toFixed(2)} · ${regresion.n} turnos` : "datos insuficientes"}
        </span>
      </h3>

      {!hayDatos ? (
        <p className="py-16 text-center text-sm text-[var(--texto-tenue)]">Sin turnos válidos con este filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              type="number"
              dataKey="x"
              name="% a plena"
              domain={dominioX}
              ticks={ticksX}
              tick={{ fontSize: 11, fill: "var(--texto-secundario)" }}
              label={{ value: "% del turno a plena", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--texto-secundario)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="piezas/min"
              width={40}
              domain={([min, max]: readonly [number, number]) => [Math.floor(min * 2) / 2 - 0.5, Math.ceil(max * 2) / 2 + 0.5]}
              tick={{ fontSize: 11, fill: "var(--texto-secundario)" }}
            />
            {referencias.map((r) => (
              <ReferenceLine
                key={r.etiqueta}
                y={r.valor}
                stroke={r.color}
                strokeWidth={1.5}
                label={{
                  value: `${r.etiqueta} (${r.valor.toLocaleString("es-ES")})`,
                  // En una línea horizontal, "insideBottom*" escribe SOBRE la línea e "insideTop*" DEBAJO.
                  position: r.lado === "arriba" ? "insideBottomLeft" : "insideTopLeft",
                  fontSize: 10,
                  fill: r.color,
                }}
              />
            ))}
            {conTendencia && regresion && (
              <ReferenceLine
                segment={[
                  { x: xMin, y: regresion.pendiente * xMin + regresion.ordenada },
                  { x: xMax, y: regresion.pendiente * xMax + regresion.ordenada },
                ]}
                stroke="var(--texto-secundario)"
                strokeDasharray="5 4"
              />
            )}
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const punto = active ? (payload?.[0]?.payload as PuntoNube | undefined) : undefined;
                if (!punto?.turno) return null;
                return <FichaTurno turno={punto.turno} color={colorDeLinea(punto.turno.lineaNombre)} />;
              }}
            />
            {series.map((s) => (
              <Scatter
                key={s.linea.id}
                name={s.linea.nombre}
                data={s.datos}
                fill={colorDeLinea(s.linea.nombre)}
                fillOpacity={0.75}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <Leyenda lineas={lineas} />
    </div>
  );
}

function Leyenda({ lineas }: { lineas: LineaSeleccionada[] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--texto-secundario)]">
      {lineas.map((l) => (
        <span key={l.id} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorDeLinea(l.nombre) }} />
          {l.nombre}
        </span>
      ))}
    </div>
  );
}

export function NubesAlimentacion({ turnos, lineas }: { turnos: TurnoLineaAlimentacion[]; lineas: LineaSeleccionada[] }) {
  const { hornoNecesario, limiteGriffon, consignaPropuesta } = REFERENCIAS_PIEZAS_MIN;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NubeScatter
        titulo="Producción del turno vs % a plena"
        turnos={turnos}
        lineas={lineas}
        campoY="piezasMinTurno"
        conTendencia
        referencias={[
          { valor: hornoNecesario, etiqueta: "Necesario para el horno", color: "#7e22ce", lado: "arriba" },
          { valor: limiteGriffon, etiqueta: "Límite Griffon", color: "#f59e0b", lado: "abajo" },
        ]}
      />
      <NubeScatter
        titulo="Piezas/min a plena vs % a plena"
        turnos={turnos}
        lineas={lineas}
        campoY="piezasMinPlena"
        conTendencia={false}
        referencias={[
          { valor: consignaPropuesta, etiqueta: "Consigna propuesta", color: "#16a34a", lado: "arriba" },
          { valor: limiteGriffon, etiqueta: "Límite Griffon", color: "#f59e0b", lado: "abajo" },
        ]}
      />
    </div>
  );
}
