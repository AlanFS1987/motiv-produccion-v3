// frontend/src/components/rectificado/VistaRapidaRectificadoScreen.tsx
//
// Mismo patrón que jefe/VistaRapidaScreen.tsx: responsive por CSS
// (escritorio ve hasta 21 turnos, móvil 3 con flechas ← →), pero con
// 3 bloques de tiempo (pleno / paradas propias / paradas ajenas) en
// vez de 5, y calidad de calibre (com/std) en vez de 1ª/comercial/
// eco/contenedor. Sin gamificación, sin incidencias.

import { useEffect, useMemo, useState } from "react";
import {
  obtenerSerieRectificadoUltimosTurnos,
  type TurnoRectificado,
} from "../../lib/dashboard-rectificado";

const NOMBRE_TURNO: Record<"M" | "T" | "N", string> = { M: "M", T: "T", N: "N" };

const COLORES_TIEMPO = {
  pleno: "#16a34a",
  propias: "#dc2626",
  ajenas: "#f59e0b",
};

function agruparPorFecha(turnos: TurnoRectificado[]) {
  const mapa = new Map<string, TurnoRectificado[]>();
  for (const t of turnos) {
    const clave = `${t.fecha}_${t.tipoTurno}`;
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave)!.push(t);
  }
  return Array.from(mapa.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([clave, lineas]) => ({ clave, fecha: lineas[0].fecha, tipoTurno: lineas[0].tipoTurno, lineas }));
}

function TarjetaKpi({ etiqueta, valor, sufijo }: { etiqueta: string; valor: string; sufijo?: string }) {
  return (
    <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-[var(--texto-tenue)]">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--texto)]">
        {valor}
        {sufijo && <span className="ml-0.5 text-sm font-normal text-[var(--texto-tenue)]">{sufijo}</span>}
      </p>
    </div>
  );
}

function BarraLinea({ linea }: { linea: TurnoRectificado }) {
  const denom = Math.max(480, linea.minutosTotal);
  const segmentos = [
    { valor: linea.minutosPlenoRendimiento, color: COLORES_TIEMPO.pleno },
    { valor: linea.minutosParadasPropias, color: COLORES_TIEMPO.propias },
    { valor: linea.minutosParadasAjenas, color: COLORES_TIEMPO.ajenas },
  ];
  const suma = segmentos.reduce((acc, s) => acc + s.valor, 0);
  const restante = Math.max(0, denom - suma);

  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <span className="text-[11px] font-medium text-[var(--texto-secundario)]">{linea.pctRendimiento ?? "—"}%</span>
      <div className="flex h-32 w-10 flex-col-reverse overflow-hidden rounded-md border border-[var(--borde)]">
        {segmentos.map((s, i) => (
          <div key={i} style={{ height: `${(s.valor / denom) * 100}%`, background: s.color }} />
        ))}
        {restante > 0 && <div style={{ height: `${(restante / denom) * 100}%`, background: "#e2e8f0" }} />}
      </div>
      <span className="text-[11px] font-semibold text-[var(--texto)]">{NOMBRE_TURNO[linea.tipoTurno].slice(0, 1)}</span>
      <span className="text-[10px] text-[var(--texto-tenue)]">{Math.round(linea.m2Total)} m²</span>
      {linea.pctCalibreStd != null && (
        <span className="text-[10px] font-medium text-blue-600">std {linea.pctCalibreStd}%</span>
      )}
    </div>
  );
}

export function VistaRapidaRectificadoScreen() {
  const [turnos, setTurnos] = useState<TurnoRectificado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaIndex, setDiaIndex] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerSerieRectificadoUltimosTurnos(21)
      .then((data) => {
        if (!activo) return;
        setTurnos(data);
        setError(null);
      })
      .catch((err) => activo && setError(err instanceof Error ? err.message : "Error cargando datos"))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  const dias = useMemo(() => agruparPorFecha(turnos), [turnos]);

  useEffect(() => {
    setDiaIndex(Math.max(0, dias.length - 1));
  }, [dias.length]);

  if (cargando) return <p className="text-sm text-[var(--texto-secundario)]">Cargando…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const totalPiezas = turnos.reduce((acc, t) => acc + t.piezasTotal, 0);
  const totalM2 = turnos.reduce((acc, t) => acc + t.m2Total, 0);
  const numDenomRendimiento = turnos.reduce(
    (acc, t) => {
      acc.num += (t.minutosPlenoRendimiento + t.minutosParadasPropias);
      acc.denom += t.denominadorRendimiento;
      return acc;
    },
    { num: 0, denom: 0 },
  );
  const pctRendimientoGlobal = numDenomRendimiento.denom > 0
    ? Math.round((numDenomRendimiento.num / numDenomRendimiento.denom) * 10000) / 100
    : null;
  const totalDescuadre = turnos.reduce((acc, t) => acc + t.piezasDescuadreCom, 0);
  const pctCalibreStdGlobal = totalPiezas > 0
    ? Math.round((100 - (100 * totalDescuadre) / totalPiezas) * 100) / 100
    : null;
  const piezasMinutoGlobal = numDenomRendimiento.num > 0
    ? Math.round((totalPiezas / turnos.reduce((acc, t) => acc + t.minutosPlenoRendimiento, 0)) * 100) / 100
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <TarjetaKpi etiqueta="Rendimiento" valor={`${pctRendimientoGlobal ?? "—"}`} sufijo="%" />
        <TarjetaKpi etiqueta="m²" valor={Math.round(totalM2).toLocaleString("es-ES")} />
        <TarjetaKpi etiqueta="Piezas" valor={totalPiezas.toLocaleString("es-ES")} />
        <TarjetaKpi etiqueta="Piezas/min" valor={`${piezasMinutoGlobal ?? "—"}`} />
        <TarjetaKpi etiqueta="Calibre std." valor={`${pctCalibreStdGlobal ?? "—"}`} sufijo="%" />
      </div>

      {/* Escritorio: todos los días juntos */}
      <div className="hidden gap-4 overflow-x-auto sm:flex">
        {dias.map((d) => (
          <div key={d.clave} className="flex flex-col items-center gap-1">
            <span className="text-xs text-[var(--texto-tenue)]">{d.fecha}</span>
            <div className="flex gap-2">
              {d.lineas.map((l) => (
                <BarraLinea key={l.lineaId} linea={l} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Móvil: un día a la vez, con flechas */}
      <div className="flex flex-col items-center gap-2 sm:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDiaIndex((i) => Math.max(0, i - 1))}
            disabled={diaIndex <= 0}
            className="rounded-full border border-[var(--borde)] px-2 py-1 text-sm disabled:opacity-30"
          >
            ←
          </button>
          <span className="text-sm text-[var(--texto-secundario)]">{dias[diaIndex]?.fecha ?? ""}</span>
          <button
            onClick={() => setDiaIndex((i) => Math.min(dias.length - 1, i + 1))}
            disabled={diaIndex >= dias.length - 1}
            className="rounded-full border border-[var(--borde)] px-2 py-1 text-sm disabled:opacity-30"
          >
            →
          </button>
        </div>
        <div className="flex gap-2">
          {dias[diaIndex]?.lineas.map((l) => (
            <BarraLinea key={l.lineaId} linea={l} />
          ))}
        </div>
      </div>
    </div>
  );
}