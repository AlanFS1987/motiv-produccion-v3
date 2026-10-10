// frontend/src/components/alimentacion/BalanceHornoAlimentacion.tsx
// Balance horno vs clasificación del formato elegido: lo que sale de los
// hornos que cuecen ese formato (nominal: m²/día ÷ 3 por turno y horno, tabla
// horno_formato; qué horno cuece qué formato se INFIERE de lo clasificado,
// ver balance-horno-calculos.ts) frente a lo que clasifican TODAS las líneas
// juntas, en suma corrida.
// Pregunta que responde: ¿clasificación sostiene al horno o se está
// acumulando (o vaciando) material? Por turno suelto sale irregular por la
// rotación de líneas; lo que importa es la tendencia del acumulado.
// No depende del filtro de líneas: el balance es de la planta entera.

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fechaCorta } from "../../lib/alimentacion-calculos";
import { TURNOS_POR_DIA, type BalanceHorno, type TurnoBalance } from "../../lib/balance-horno-calculos";

const NOMBRE_TURNO = { M: "Mañana", T: "Tarde", N: "Noche" } as const;
const COLOR_HORNO = "#7e22ce";
const COLOR_CLASIFICADO = "#1f77b4";
const COLOR_DIFERENCIA = "#d62728";

const ent = (n: number) => Math.round(n).toLocaleString("es-ES");
const con1 = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const conSigno = (n: number) => `${n > 0 ? "+" : ""}${ent(n)}`;

function FichaTurno({ t }: { t: TurnoBalance }) {
  return (
    <div className="max-w-xs rounded-lg border border-[var(--borde)] bg-[var(--superficie)] px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-[var(--texto)]">
        {fechaCorta(t.fecha)} · {NOMBRE_TURNO[t.tipoTurno]}
      </div>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="text-[var(--texto-secundario)]">Clasificado (m²)</dt>
        <dd className="text-right tabular-nums text-[var(--texto)]">{ent(t.m2Clasificados)}</dd>
        <dt className="text-[var(--texto-secundario)]">Hornos con este formato (inferido)</dt>
        <dd className="text-right tabular-nums text-[var(--texto)]">{t.hornos}</dd>
        <dt className="text-[var(--texto-secundario)]">Salida del horno (m²)</dt>
        <dd className="text-right tabular-nums text-[var(--texto)]">{ent(t.m2Horno)}</dd>
        <dt className="text-[var(--texto-secundario)]">Diferencia del turno</dt>
        <dd className="text-right tabular-nums text-[var(--texto)]">{conSigno(t.diferencia)}</dd>
        <dt className="text-[var(--texto-secundario)]">Diferencia acumulada</dt>
        <dd className="text-right font-semibold tabular-nums text-[var(--texto)]">{conSigno(t.diferenciaAcumulada)}</dd>
        <dt className="text-[var(--texto-secundario)]">Líneas que clasificaron</dt>
        <dd className="text-right tabular-nums text-[var(--texto)]">{t.lineas}</dd>
        <dt className="text-[var(--texto-secundario)]">Piezas</dt>
        <dd className="text-right tabular-nums text-[var(--texto)]">{ent(t.piezas)}</dd>
      </dl>
    </div>
  );
}

export function BalanceHornoAlimentacion({ formato, balance, aviso }: { formato: string; balance: BalanceHorno | null; aviso: string | null }) {
  // Una marca en el eje por día (cada TURNOS_POR_DIA turnos), con la fecha.
  const marcasDia = useMemo(() => (balance ? balance.turnos.filter((t) => t.indice % TURNOS_POR_DIA === 0).map((t) => t.indice) : []), [balance]);
  const pasoMarca = Math.max(1, Math.ceil(marcasDia.length / 8));
  const marcas = marcasDia.filter((_, i) => i % pasoMarca === 0);
  const etiquetaX = (i: number) => {
    const t = balance?.turnos[i];
    return t ? fechaCorta(t.fecha) : "";
  };

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold text-[var(--texto)]">Balance horno vs clasificación · {formato}</h2>
        <p className="text-xs text-[var(--texto-secundario)]">
          Suma corrida de lo clasificado por todas las líneas frente a lo que sacan los hornos que cuecen este formato (m²/día ÷ {TURNOS_POR_DIA} por turno y horno, tabla de hornos).
          Si la línea de clasificación se queda por debajo de la del horno, se acumula material; si va por encima, se vacía stock. Por turno suelto es irregular por la rotación
          de líneas: fíjate en la tendencia. No depende del filtro de líneas.
        </p>
      </div>

      {aviso && <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso}</p>}

      {balance && (
        <>
          <p className="text-xs text-[var(--texto-secundario)]">
            Del {fechaCorta(balance.desde)} al {fechaCorta(balance.hasta)} · clasificado <strong className="text-[var(--texto)]">{ent(balance.m2Clasificados)} m²</strong> · horno{" "}
            <strong className="text-[var(--texto)]">{ent(balance.m2Horno)} m²</strong> · clasificado/horno{" "}
            <strong className="text-[var(--texto)]">{con1(balance.pctClasificadoSobreHorno)} %</strong> · diferencia{" "}
            <strong className="text-[var(--texto)]">{conSigno(balance.diferencia)} m²</strong> · {balance.turnosConHorno} de {balance.turnos.length} turnos con horno en este formato.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
              <h3 className="mb-2 text-sm font-semibold text-[var(--texto)]">Clasificado y horno, acumulado (m²)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={balance.turnos} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="indice" type="number" domain={[0, Math.max(1, balance.turnos.length - 1)]} ticks={marcas} tickFormatter={etiquetaX} tick={{ fontSize: 11, fill: "var(--texto-secundario)" }} />
                  <YAxis width={64} tickFormatter={(v: number) => ent(v)} tick={{ fontSize: 11, fill: "var(--texto-secundario)" }} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      const t = active ? (payload?.[0]?.payload as TurnoBalance | undefined) : undefined;
                      return t ? <FichaTurno t={t} /> : null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="hornoAcumulado" name="Horno (nominal)" stroke={COLOR_HORNO} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="clasificadoAcumulado" name="Clasificado (todas las líneas)" stroke={COLOR_CLASIFICADO} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
              <h3 className="mb-2 text-sm font-semibold text-[var(--texto)]">Diferencia acumulada: clasificado − horno (m²)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={balance.turnos} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="indice" type="number" domain={[0, Math.max(1, balance.turnos.length - 1)]} ticks={marcas} tickFormatter={etiquetaX} tick={{ fontSize: 11, fill: "var(--texto-secundario)" }} />
                  <YAxis width={64} tickFormatter={(v: number) => ent(v)} tick={{ fontSize: 11, fill: "var(--texto-secundario)" }} />
                  <ReferenceLine y={0} stroke="var(--texto-tenue)" strokeWidth={1.5} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      const t = active ? (payload?.[0]?.payload as TurnoBalance | undefined) : undefined;
                      return t ? <FichaTurno t={t} /> : null;
                    }}
                  />
                  <Line type="monotone" dataKey="diferenciaAcumulada" name="Diferencia acumulada" stroke={COLOR_DIFERENCIA} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-1 text-xs text-[var(--texto-secundario)]">Por debajo de 0: se acumula material sin clasificar. Por encima: se está vaciando stock.</p>
            </div>
          </div>

          <p className="text-xs text-[var(--texto-tenue)]">
            Hornos inferidos, no registrados: el grande cuece 900x900 o 1200x1200; el flexible, 200x1200 o 300x1200 (y a veces 600x1200); los otros dos, 600x1200. Cada horno sigue con su
            formato hasta que se clasifica otro de su familia (así se detecta el cambio) y el flexible cuece 600x1200 los días en que este supera 2,5 hornos equivalentes. Lo que aún se
            clasifica de un formato cuyo horno ya cambió es vaciado de stock. Se descartan los días de los extremos con datos parciales. La serie parte de 0, sin stock previo.
          </p>
        </>
      )}
    </section>
  );
}
