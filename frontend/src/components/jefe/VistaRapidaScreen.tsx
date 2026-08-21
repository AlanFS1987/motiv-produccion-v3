// frontend/src/components/jefe/VistaRapidaScreen.tsx
// Vista Rápida del dashboard del jefe — últimos 7 días. Sin
// gamificación (el jefe no la usa). Dos ejes SEPARADOS (producción y
// calidad), alineados visualmente por fecha+turno pero nunca
// mezclados en una sola cifra ni con relación causal implícita.
//
// Gráfica: la MISMA vista lógica (7 días x 3 turnos = hasta 21
// barras), pero con dos formas de mostrarla según el ancho de
// pantalla vía CSS (Tailwind), no JS de detección — más robusto
// ante cambios de tamaño de ventana:
//   - Desktop (md:flex): semana completa de una vez.
//   - Móvil (md:hidden): un día a la vez, con flechas para navegar.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  calcularKpis,
  obtenerSerieUltimosDias,
  type KpisPeriodo,
  type TipoTurno,
  type TurnoCombinado,
} from "../../lib/dashboard-jefe";

const NOMBRE_TURNO: Record<TipoTurno, string> = { M: "Mañana", T: "Tarde", N: "Noche" };
const ORDEN_TURNO: TipoTurno[] = ["M", "T", "N"];

const COLORES_TIEMPO = {
  plena: "#16a34a",
  no_alimentada: "#94a3b8",
  saturacion: "#dc2626",
  banco: "#f59e0b",
  maquina: "#eab308",
  sin_reportar: "#e2e8f0",
} as const;

function formatearFechaCorta(fechaISO: string): string {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function agruparPorFecha(turnos: TurnoCombinado[]): { fecha: string; porTurno: Map<TipoTurno, TurnoCombinado> }[] {
  const mapa = new Map<string, Map<TipoTurno, TurnoCombinado>>();
  for (const t of turnos) {
    if (!mapa.has(t.fecha)) mapa.set(t.fecha, new Map());
    mapa.get(t.fecha)!.set(t.tipo_turno, t);
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, porTurno]) => ({ fecha, porTurno }));
}

/** Una barra apilada de tiempos de un turno, con m² y calidad debajo. */
function BarraTurno({ turno, tipo }: { turno: TurnoCombinado | undefined; tipo: TipoTurno }) {
  if (!turno?.produccion) {
    return (
      <div className="flex w-16 flex-col items-center gap-1">
        <div className="flex h-32 w-10 items-end justify-center rounded-md bg-slate-100 text-[10px] text-slate-300">
          —
        </div>
        <span className="text-[11px] text-slate-400">{NOMBRE_TURNO[tipo].slice(0, 1)}</span>
      </div>
    );
  }

  const p = turno.produccion;
  const denom = p.rendimiento_denominador || 480;
  const segmentos: { valor: number; color: string }[] = [
    { valor: p.minutos_plena ?? 0, color: COLORES_TIEMPO.plena },
    { valor: p.minutos_no_alimentada ?? 0, color: COLORES_TIEMPO.no_alimentada },
    { valor: p.minutos_saturacion ?? 0, color: COLORES_TIEMPO.saturacion },
    { valor: p.minutos_banco ?? 0, color: COLORES_TIEMPO.banco },
    { valor: p.minutos_maquina ?? 0, color: COLORES_TIEMPO.maquina },
  ];
  const sumaSegmentos = segmentos.reduce((acc, s) => acc + s.valor, 0);
  const restante = Math.max(0, denom - sumaSegmentos);

  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <span className="text-[11px] font-medium text-slate-600">{p.pct_rendimiento ?? "—"}%</span>
      <div className="flex h-32 w-10 flex-col-reverse overflow-hidden rounded-md border border-slate-200">
        {segmentos.map((s, i) => (
          <div key={i} style={{ height: `${(s.valor / denom) * 100}%`, background: s.color }} />
        ))}
        {restante > 0 && (
          <div style={{ height: `${(restante / denom) * 100}%`, background: COLORES_TIEMPO.sin_reportar }} />
        )}
      </div>
      <span className="text-[11px] font-semibold text-slate-700">{NOMBRE_TURNO[tipo].slice(0, 1)}</span>
      <span className="text-[10px] text-slate-400">{Math.round(p.m2_total)} m²</span>
      {turno.calidad?.pct_1a_oficial != null && (
        <span className="text-[10px] font-medium text-blue-600">1ª ofi. {turno.calidad.pct_1a_oficial}%</span>
      )}
    </div>
  );
}

function TarjetaKpi({ etiqueta, valor, sufijo }: { etiqueta: string; valor: string; sufijo?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        {valor}
        {sufijo && <span className="ml-0.5 text-sm font-normal text-slate-400">{sufijo}</span>}
      </p>
    </div>
  );
}

export function VistaRapidaScreen() {
  const [turnos, setTurnos] = useState<TurnoCombinado[]>([]);
  const [kpis, setKpis] = useState<KpisPeriodo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaIndex, setDiaIndex] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerSerieUltimosDias(7)
      .then((data) => {
        if (!activo) return;
        setTurnos(data);
        setKpis(calcularKpis(data));
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
    // Al cargar datos nuevos, sitúa la navegación móvil en el último día disponible.
    if (dias.length > 0) setDiaIndex(dias.length - 1);
  }, [dias.length]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando producción de los últimos 7 días...
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {error}
      </div>
    );
  }

  const diaActual = dias[diaIndex];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <TarjetaKpi etiqueta="Rendimiento" valor={kpis?.pct_rendimiento?.toString() ?? "—"} sufijo="%" />
        <TarjetaKpi etiqueta="M² producidos" valor={Math.round(kpis?.m2_total ?? 0).toLocaleString("es-ES")} />
        <TarjetaKpi etiqueta="Piezas" valor={(kpis?.piezas_total ?? 0).toLocaleString("es-ES")} />
        <TarjetaKpi etiqueta="1ª completa" valor={kpis?.pct_1a_completa?.toString() ?? "—"} sufijo="%" />
        <TarjetaKpi etiqueta="1ª oficial" valor={kpis?.pct_1a_oficial?.toString() ?? "—"} sufijo="%" />
      </div>

      {turnos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No hay producción registrada en los últimos 7 días.
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {/* Desktop: semana completa */}
          <div className="hidden gap-4 overflow-x-auto md:flex">
            {dias.map(({ fecha, porTurno }) => (
              <div key={fecha} className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{formatearFechaCorta(fecha)}</span>
                <div className="flex gap-2">
                  {ORDEN_TURNO.map((tipo) => (
                    <BarraTurno key={tipo} turno={porTurno.get(tipo)} tipo={tipo} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Móvil: un día a la vez, con navegación */}
          <div className="flex flex-col items-center gap-3 md:hidden">
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => setDiaIndex((i) => Math.max(0, i - 1))}
                disabled={diaIndex === 0}
                className="rounded-full p-2 text-slate-500 disabled:opacity-30"
                aria-label="Día anterior"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <span className="text-sm font-medium text-slate-700">
                {diaActual ? formatearFechaCorta(diaActual.fecha) : "—"}
              </span>
              <button
                type="button"
                onClick={() => setDiaIndex((i) => Math.min(dias.length - 1, i + 1))}
                disabled={diaIndex >= dias.length - 1}
                className="rounded-full p-2 text-slate-500 disabled:opacity-30"
                aria-label="Día siguiente"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
            <div className="flex gap-3">
              {ORDEN_TURNO.map((tipo) => (
                <BarraTurno key={tipo} turno={diaActual?.porTurno.get(tipo)} tipo={tipo} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {Object.entries({
          Plena: COLORES_TIEMPO.plena,
          "No alimentada": COLORES_TIEMPO.no_alimentada,
          Saturación: COLORES_TIEMPO.saturacion,
          Banco: COLORES_TIEMPO.banco,
          Máquina: COLORES_TIEMPO.maquina,
        }).map(([nombre, color]) => (
          <span key={nombre} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {nombre}
          </span>
        ))}
      </div>
    </div>
  );
}