// frontend/src/components/alimentacion/CurvaVelocidadAlimentacion.tsx
// Curva de velocidad conseguida (piezas/min a plena) frente a:
//   - Piezas por turno alimentable: lo que saldría en 480 min
//     alimentables a ese ritmo (piezas × 480 ÷ tiempo alimentable).
//   - % a plena sobre el tiempo alimentable.
// Todas las líneas juntas (la línea es solo el color) y una línea negra
// con los tramos de 0,5 piezas/min, calculada sumando piezas y minutos.
// Pregunta que responde: ¿a partir de qué velocidad conseguida deja de
// salir más producción? (memorias/21-alimentacion.md). No usa la consigna
// (aún no se registra): la velocidad es la CONSEGUIDA, no la pedida.
//
// Cada punto es un turno real; el equivalente a 480 min es un cálculo y
// la ficha enseña siempre las piezas reales y de dónde sale. Los turnos
// con poco tiempo alimentable se dibujan pálidos porque su equivalente
// es una extrapolación grande.

import { useMemo } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import {
  agruparPorTramoVelocidad,
  colorDeLinea,
  REGLAS_TURNOS,
  type ClasificacionAlimentable,
  type TramoVelocidad,
  type TurnoAlimentable,
} from "../../lib/alimentacion-calculos";
import { REFERENCIAS_PIEZAS_MIN } from "../../lib/dashboard-alimentacion";
import { FichaAlimentable, FichaTramo } from "./TooltipAlimentacion";

const ent = (n: number) => Math.round(n).toLocaleString("es-ES");

interface LineaSeleccionada {
  id: string;
  nombre: string;
}

interface PuntoTurno {
  x: number;
  y: number;
  t: TurnoAlimentable;
}

interface PuntoTramo {
  x: number;
  y: number;
  tramo: TramoVelocidad;
}

interface RefHorizontal {
  valor: number;
  etiqueta: string;
  color: string;
  lado: "arriba" | "abajo";
}

function Curva({
  titulo,
  ejeY,
  turnos,
  tramos,
  lineas,
  campo,
  pasoDominio,
  atenuarPocoAlimentable,
  referenciasY,
}: {
  titulo: string;
  ejeY: string;
  turnos: TurnoAlimentable[];
  tramos: TramoVelocidad[];
  lineas: LineaSeleccionada[];
  campo: "piezasTurnoAlimentable" | "pctPlenaAlimentable";
  pasoDominio: number;
  atenuarPocoAlimentable: boolean;
  referenciasY: RefHorizontal[];
}) {
  const { series, puntosTramo } = useMemo(() => {
    const series = lineas.map((l) => ({
      linea: l,
      datos: turnos.filter((t) => t.turno.lineaId === l.id).map<PuntoTurno>((t) => ({ x: t.velocidad, y: t[campo], t })),
    }));
    const puntosTramo = tramos.map<PuntoTramo>((tr) => ({ x: tr.centro, y: campo === "piezasTurnoAlimentable" ? tr.piezasTurno : tr.pctPlena, tramo: tr }));
    return { series, puntosTramo };
  }, [turnos, tramos, lineas, campo]);

  const hayDatos = series.some((s) => s.datos.length > 0);
  const hayPalidos = atenuarPocoAlimentable && turnos.some((t) => t.tiempoAlimentable < REGLAS_TURNOS.minAlimentableFiable);

  return (
    <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
      <h3 className="mb-2 text-sm font-semibold text-[var(--texto)]">
        {titulo}
        <span className="ml-2 font-normal text-[var(--texto-tenue)]">{turnos.length} turnos</span>
      </h3>

      {!hayDatos ? (
        <p className="py-16 text-center text-sm text-[var(--texto-tenue)]">Sin turnos válidos con este filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              type="number"
              dataKey="x"
              name="Velocidad conseguida"
              domain={([min, max]: readonly [number, number]) => [Math.floor(min * 2) / 2 - 0.5, Math.ceil(max * 2) / 2 + 0.5]}
              tick={{ fontSize: 11, fill: "var(--texto-secundario)" }}
              label={{ value: "Velocidad conseguida (piezas/min a plena)", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--texto-secundario)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={ejeY}
              width={48}
              tickFormatter={(v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
              domain={([min, max]: readonly [number, number]) => [Math.floor(min / pasoDominio) * pasoDominio, Math.ceil(max / pasoDominio) * pasoDominio]}
              tick={{ fontSize: 11, fill: "var(--texto-secundario)" }}
            />
            {referenciasY.map((r) => (
              <ReferenceLine
                key={r.etiqueta}
                y={r.valor}
                stroke={r.color}
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{
                  value: r.etiqueta,
                  // En una línea horizontal, "insideBottom*" escribe SOBRE la línea e "insideTop*" DEBAJO.
                  position: r.lado === "arriba" ? "insideBottomLeft" : "insideTopLeft",
                  fontSize: 10,
                  fill: r.color,
                }}
              />
            ))}
            <ReferenceLine
              x={REFERENCIAS_PIEZAS_MIN.consignaPropuesta}
              stroke="#16a34a"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              label={{ value: `Consigna propuesta (${REFERENCIAS_PIEZAS_MIN.consignaPropuesta.toLocaleString("es-ES")})`, position: "insideTopRight", fontSize: 10, fill: "#16a34a" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as (Partial<PuntoTurno> & Partial<PuntoTramo>) | undefined) : undefined;
                if (!p) return null;
                if (p.tramo) return <FichaTramo tramo={p.tramo} />;
                if (p.t) return <FichaAlimentable t={p.t} color={colorDeLinea(p.t.turno.lineaNombre)} />;
                return null;
              }}
            />
            {series.map((s) => {
              const color = colorDeLinea(s.linea.nombre);
              return (
                <Scatter
                  key={s.linea.id}
                  name={s.linea.nombre}
                  data={s.datos}
                  isAnimationActive={false}
                  shape={(props: { cx?: number; cy?: number; payload?: PuntoTurno }) => {
                    const palido = atenuarPocoAlimentable && (props.payload?.t.tiempoAlimentable ?? Infinity) < REGLAS_TURNOS.minAlimentableFiable;
                    return <circle cx={props.cx} cy={props.cy} r={4} fill={color} fillOpacity={palido ? 0.12 : 0.55} stroke={color} strokeOpacity={palido ? 0.5 : 0} />;
                  }}
                />
              );
            })}
            <Scatter name="Tramos" data={puntosTramo} fill="var(--texto)" stroke="var(--texto)" line={{ strokeWidth: 2 }} shape="circle" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--texto-secundario)]">
        {lineas.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorDeLinea(l.nombre) }} />
            {l.nombre}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: "var(--texto)" }} />
          Tramos de 0,5 (todas las líneas)
        </span>
        {hayPalidos && <span>○ pálido: menos de {REGLAS_TURNOS.minAlimentableFiable} min alimentables (equivalente poco fiable)</span>}
      </div>
    </div>
  );
}

/** Nivel medio de piezas por línea y turno que sostiene el horno (tabla horno_formato). */
export interface ReferenciaHorno {
  piezasTurnoPorLinea: number;
  lineas: number;
  hornos: number;
}

export function CurvaVelocidadAlimentacion({
  clasificacion,
  lineas,
  referenciaHorno,
}: {
  clasificacion: ClasificacionAlimentable;
  lineas: LineaSeleccionada[];
  referenciaHorno: ReferenciaHorno | null;
}) {
  const tramos = useMemo(() => agruparPorTramoVelocidad(clasificacion.turnos), [clasificacion.turnos]);
  const minutosEq = REGLAS_TURNOS.minutosTurnoEquivalente;

  // Nivel MEDIO que sostiene el horno (las líneas rotan de modelo): no es un umbral turno a turno.
  const referenciasPiezas: RefHorizontal[] = referenciaHorno
    ? [
        {
          valor: referenciaHorno.piezasTurnoPorLinea,
          etiqueta: `Nivel medio para el horno (${ent(referenciaHorno.piezasTurnoPorLinea)} piezas/turno por línea, ${referenciaHorno.hornos} horno${referenciaHorno.hornos === 1 ? "" : "s"} / ${referenciaHorno.lineas} línea${referenciaHorno.lineas === 1 ? "" : "s"})`,
          color: "#7e22ce",
          lado: "arriba",
        },
      ]
    : [];

  const c = clasificacion;
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold text-[var(--texto)]">Velocidad conseguida y producción (tiempo alimentable)</h2>
        <p className="text-xs text-[var(--texto-secundario)]">
          Tiempo alimentable = total registrado − banco − máquina. Cada punto es un turno real; las piezas por turno alimentable son las que saldrían en{" "}
          {minutosEq} min alimentables a su ritmo (piezas × {minutosEq} ÷ tiempo alimentable). La velocidad es la conseguida, no la consigna pedida.
        </p>
        <p className="text-xs text-[var(--texto-secundario)]">
          <strong className="text-[var(--texto)]">{c.turnos.length}</strong> turnos incluidos · {c.excluidosMezcla} excluidos por mezcla de formatos ·{" "}
          {c.excluidosExcedidos} por exceder {REGLAS_TURNOS.maxMinutosTotal} min
          {c.excluidosNoComparables > 0 && <> · {c.excluidosNoComparables} por no ser comparables</>} · {c.excluidosSinDatos} sin tiempo a plena o alimentable.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Curva
          titulo={`Velocidad conseguida vs piezas por turno alimentable (${minutosEq} min)`}
          ejeY="Piezas por turno alimentable"
          turnos={c.turnos}
          tramos={tramos}
          lineas={lineas}
          campo="piezasTurnoAlimentable"
          pasoDominio={100}
          atenuarPocoAlimentable
          referenciasY={referenciasPiezas}
        />
        <Curva
          titulo="Velocidad conseguida vs % a plena (alimentable)"
          ejeY="% a plena"
          turnos={c.turnos}
          tramos={tramos}
          lineas={lineas}
          campo="pctPlenaAlimentable"
          pasoDominio={10}
          atenuarPocoAlimentable={false}
          referenciasY={[]}
        />
      </div>
    </section>
  );
}
