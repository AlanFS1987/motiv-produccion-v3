// frontend/src/components/alimentacion/TemporalAlimentacion.tsx
// Gráfica temporal: por cada periodo y línea, DOS puntos con la misma
// x unidos por una raya vertical:
//   - arriba (relleno): piezas/min a plena  = lo que hace la línea cuando corre
//   - abajo (hueco):    piezas/min del turno = lo que realmente sale
// La raya es lo que se pierde por el tiempo que no está a plena.
// Granularidad: 3 días (por turno), semana (por día), mes y trimestre
// (por semana, lunes a domingo). Al agrupar se suman piezas y minutos
// y se divide al final (alimentacion-calculos.ts).

import { useMemo, useState } from "react";
import { CartesianGrid, ErrorBar, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import {
  AYUDA_GRANULARIDAD,
  agregarPorBucket,
  colorDeLinea,
  ETIQUETA_GRANULARIDAD,
  type Granularidad,
  type PuntoBucket,
} from "../../lib/alimentacion-calculos";
import { REFERENCIAS_PIEZAS_MIN, type TurnoLineaAlimentacion } from "../../lib/dashboard-alimentacion";
import { hoyLocalISO } from "../../lib/fechas";
import type { LineaSeleccionada } from "./NubesAlimentacion";
import { FichaBucket } from "./TooltipAlimentacion";

const GRANULARIDADES: Granularidad[] = ["3dias", "semana", "mes", "trimestre"];

interface PuntoGrafica {
  x: number;
  y: number;
  /** Para la raya: [cuánto hay que bajar hasta el punto de abajo, 0]. */
  raya: [number, number];
  punto: PuntoBucket;
}

export function TemporalAlimentacion({
  turnosValidos,
  lineas,
  formato,
}: {
  turnosValidos: TurnoLineaAlimentacion[];
  lineas: LineaSeleccionada[];
  formato: string;
}) {
  const [gran, setGran] = useState<Granularidad>("semana");
  const hoy = hoyLocalISO();

  const { etiquetas, porLinea } = useMemo(() => {
    const idsSeleccionados = new Set(lineas.map((l) => l.id));
    const serie = agregarPorBucket(
      turnosValidos.filter((t) => idsSeleccionados.has(t.lineaId)),
      gran,
      hoy,
    );
    const indice = new Map(serie.buckets.map((b, i) => [b.clave, i]));
    // Desplazamiento horizontal por línea para que no se tapen entre sí.
    const paso = lineas.length > 1 ? 0.7 / (lineas.length - 1) : 0;

    const porLinea = lineas.map((l, idxLinea) => {
      const desplazamiento = (idxLinea - (lineas.length - 1) / 2) * paso;
      const delaLinea = serie.puntos.filter((p) => p.lineaId === l.id);
      const arriba: PuntoGrafica[] = [];
      const abajo: PuntoGrafica[] = [];
      for (const p of delaLinea) {
        const i = indice.get(p.bucketClave);
        if (i === undefined) continue;
        const x = i + desplazamiento;
        arriba.push({ x, y: p.piezasMinPlena, raya: [Math.max(0, p.piezasMinPlena - p.piezasMinTurno), 0], punto: p });
        abajo.push({ x, y: p.piezasMinTurno, raya: [0, 0], punto: p });
      }
      return { linea: l, arriba, abajo };
    });

    return { etiquetas: serie.buckets.map((b) => (b.incompleta ? `${b.etiqueta}*` : b.etiqueta)), porLinea };
  }, [turnosValidos, lineas, gran, hoy]);

  const hayDatos = porLinea.some((s) => s.arriba.length > 0);

  return (
    <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--texto)]">
          Evolución <span className="font-normal text-[var(--texto-tenue)]">· {AYUDA_GRANULARIDAD[gran]}</span>
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-[var(--borde)] text-xs">
          {GRANULARIDADES.map((g) => (
            <button
              key={g}
              onClick={() => setGran(g)}
              className={`px-3 py-1.5 ${gran === g ? "bg-[var(--acento)] font-medium text-white" : "text-[var(--texto-secundario)] hover:text-[var(--texto)]"}`}
            >
              {ETIQUETA_GRANULARIDAD[g]}
            </button>
          ))}
        </div>
      </div>

      {!hayDatos ? (
        <p className="py-16 text-center text-sm text-[var(--texto-tenue)]">Sin turnos válidos en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[-0.5, etiquetas.length - 0.5]}
              ticks={etiquetas.map((_, i) => i)}
              tickFormatter={(v: number) => etiquetas[v] ?? ""}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--texto-secundario)" }}
              allowDecimals={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              width={40}
              domain={([min, max]: readonly [number, number]) => [Math.floor(min * 2) / 2 - 0.5, Math.ceil(max * 2) / 2 + 0.5]}
              tick={{ fontSize: 11, fill: "var(--texto-secundario)" }}
            />
            <ReferenceLine
              y={REFERENCIAS_PIEZAS_MIN.limiteGriffon}
              stroke="#f59e0b"
              strokeWidth={1.5}
              label={{ value: `Límite Griffon (${REFERENCIAS_PIEZAS_MIN.limiteGriffon.toLocaleString("es-ES")})`, position: "insideTopLeft", fontSize: 10, fill: "#f59e0b" }} // debajo de su línea
            />
            <ReferenceLine
              y={REFERENCIAS_PIEZAS_MIN.hornoNecesario}
              stroke="#7e22ce"
              strokeWidth={1.5}
              label={{ value: `Necesario horno (${REFERENCIAS_PIEZAS_MIN.hornoNecesario.toLocaleString("es-ES")})`, position: "insideBottomLeft", fontSize: 10, fill: "#7e22ce" }} // encima de su línea
            />
            <Tooltip
              cursor={false}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as PuntoGrafica | undefined) : undefined;
                if (!p?.punto) return null;
                return <FichaBucket punto={p.punto} color={colorDeLinea(p.punto.lineaNombre)} formato={formato} />;
              }}
            />
            {porLinea.map(({ linea, arriba, abajo }) => {
              const color = colorDeLinea(linea.nombre);
              return [
                <Scatter key={`${linea.id}-arriba`} name={`${linea.nombre} · a plena`} data={arriba} fill={color} isAnimationActive={false}>
                  <ErrorBar dataKey="raya" direction="y" width={0} stroke={color} strokeWidth={2} />
                </Scatter>,
                <Scatter
                  key={`${linea.id}-abajo`}
                  name={`${linea.nombre} · del turno`}
                  data={abajo}
                  isAnimationActive={false}
                  shape={(props: { cx?: number; cy?: number }) => (
                    <circle cx={props.cx} cy={props.cy} r={5} fill="var(--superficie)" stroke={color} strokeWidth={2} />
                  )}
                />,
              ];
            })}
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--texto-secundario)]">
        {lineas.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorDeLinea(l.nombre) }} />
            {l.nombre}
          </span>
        ))}
        <span>● arriba: a plena · ○ abajo: del turno</span>
        {(gran === "mes" || gran === "trimestre") && <span>* semana en curso</span>}
      </div>
    </div>
  );
}
