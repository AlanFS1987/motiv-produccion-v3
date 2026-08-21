// frontend/src/components/pantalla/PantallaCarrusel.tsx
// Pantalla de fábrica (rol 'pantalla', CON login — decisión de
// sesión: no se puede abrir la URL desde cualquier sitio y ver datos
// de producción sin autenticarse). Carrusel a pantalla completa,
// rotación automática, tema oscuro (para TV/monitor de planta).
//
// 5 diapositivas:
//   1. Producción del ciclo — REAL (v_produccion_turno + v_calidad_turno)
//   2. Últimos modelos — REAL (v_calidad_modelo)
//   3. Últimos turnos KPI1/KPI2 — REAL (v_produccion_turno, calculado aquí)
//   4. Ranking de operarios — PLACEHOLDER (bloqueado por cerrar-ciclo,
//      historial_ciclos, personaje_rpg — nada de eso existe aún)
//   5. Reyes del formato — PLACEHOLDER (sin capturas de referencia)

import { useEffect, useState } from "react";
import { Construction, LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import {
  obtenerProduccionCicloActual,
  obtenerUltimosModelos,
  obtenerUltimosTurnosKpi,
  type ModeloReciente,
  type ProduccionCiclo,
  type TurnoKpi,
} from "../../lib/pantalla-carrusel";

const DURACION_SLIDE_MS = 12_000;
const NOMBRE_TURNO: Record<string, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

// ── Reloj en vivo de la cabecera ──────────────────────────────────
function useRelojEnVivo() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

// ── Donut SVG simple (2-3 segmentos), sin librería externa ────────
function Donut({
  segmentos,
  size = 90,
}: {
  segmentos: { valor: number; color: string }[];
  size?: number;
}) {
  const radio = size / 2 - 8;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radio} fill="none" stroke="#1e293b" strokeWidth={10} />
      {segmentos.map((s, i) => {
        const largo = (s.valor / 100) * circunferencia;
        const dasharray = `${largo} ${circunferencia - largo}`;
        const offset = -((acumulado / 100) * circunferencia);
        acumulado += s.valor;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radio}
            fill="none"
            stroke={s.color}
            strokeWidth={10}
            strokeDasharray={dasharray}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}

// ── Slide 1: Producción del ciclo ─────────────────────────────────
function SlideProduccionCiclo() {
  const [datos, setDatos] = useState<ProduccionCiclo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerProduccionCicloActual()
      .then(setDatos)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando el ciclo"));
  }, []);

  if (error) return <SlideError mensaje={error} />;
  if (!datos) return <SlideCargando />;

  const columnaIzq = datos.dias.slice(0, 14);
  const columnaDer = datos.dias.slice(14, 28);
  const hoyISO = new Date().toISOString().slice(0, 10);

  const Fila = ({ dia }: { dia: (typeof datos.dias)[number] }) => {
    const esHoy = dia.fecha === hoyISO;
    const [, mes, diaNum] = dia.fecha.split("-");
    const pct = Math.min(100, dia.pct_objetivo);
    const pct1a = dia.m2_total > 0 ? (dia.m2_1a / dia.m2_total) * pct : 0;
    const pctCom = dia.m2_total > 0 ? (dia.m2_comercial / dia.m2_total) * pct : 0;
    return (
      <div className="flex items-center gap-3">
        <span className={`w-10 shrink-0 text-xs ${esHoy ? "font-bold text-sky-400" : "text-[var(--texto-secundario)]"}`}>
          {diaNum}/{mes}
        </span>
        <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--superficie-alt)]">
          <div className="absolute inset-y-0 left-0 bg-green-500" style={{ width: `${pct1a}%` }} />
          <div className="absolute inset-y-0 bg-orange-500" style={{ left: `${pct1a}%`, width: `${pctCom}%` }} />
        </div>
        <span className="w-16 shrink-0 text-right text-xs text-slate-300">
          {dia.m2_total > 0 ? `${(dia.m2_total / 1000).toFixed(1)}k` : "—"}
        </span>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <h2 className="text-lg font-semibold text-[var(--texto)]">
        Producción del ciclo <span className="text-[var(--texto-secundario)]">· {datos.fechaInicioCiclo} → {datos.fechaFinCiclo}</span>
      </h2>
      <div className="grid flex-1 grid-cols-2 gap-x-10 gap-y-2 overflow-y-auto">
        <div className="space-y-2">
          {columnaIzq.map((d) => (
            <Fila key={d.fecha} dia={d} />
          ))}
        </div>
        <div className="space-y-2">
          {columnaDer.map((d) => (
            <Fila key={d.fecha} dia={d} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-700 pt-3">
        <span className="text-sm font-medium text-slate-300">Total ciclo</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded bg-[var(--superficie-alt)]">
          <div
            className="absolute inset-y-0 left-0 bg-sky-500"
            style={{ width: `${Math.min(100, datos.pctObjetivoCiclo)}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-[var(--texto)]">
          {(datos.m2TotalCiclo / 1000).toFixed(1)}k m² · {datos.pctObjetivoCiclo}%
        </span>
      </div>
    </div>
  );
}

// ── Slide 2: Últimos modelos ──────────────────────────────────────
function SlideUltimosModelos() {
  const [modelos, setModelos] = useState<ModeloReciente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerUltimosModelos(9)
      .then(setModelos)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando modelos"));
  }, []);

  if (error) return <SlideError mensaje={error} />;
  if (!modelos) return <SlideCargando />;
  if (modelos.length === 0) return <SlideVacio mensaje="Sin producción registrada todavía." />;

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <h2 className="text-lg font-semibold text-[var(--texto)]">Últimos {modelos.length} modelos en producción</h2>
      <div className="grid flex-1 grid-cols-3 gap-4 overflow-y-auto">
        {modelos.map((m) => (
          <div key={m.producto_id} className="rounded-xl bg-[var(--superficie-alt)] p-4">
            <p className="truncate text-sm font-semibold text-[var(--texto)]">{m.modelo_nombre}</p>
            <p className="text-xs text-[var(--texto-secundario)]">{m.formato_nombre}</p>
            <p className="mt-1 text-sm text-sky-400">{Math.round(m.m2_total).toLocaleString("es-ES")} m²</p>
            <div className="mt-3 flex items-center justify-around">
              <div className="flex flex-col items-center gap-1">
                <Donut
                  size={70}
                  segmentos={[
                    { valor: m.pct_1a_completa ?? 0, color: "#22c55e" },
                    { valor: m.pct_comercial_completa ?? 0, color: "#f97316" },
                    { valor: m.pct_contenedor_completa ?? 0, color: "#64748b" },
                  ]}
                />
                <span className="text-[10px] text-[var(--texto-secundario)]">Total {m.pct_1a_completa ?? 0}%</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Donut
                  size={70}
                  segmentos={[
                    { valor: m.pct_1a_oficial ?? 0, color: "#22c55e" },
                    { valor: m.pct_comercial_oficial ?? 0, color: "#f97316" },
                  ]}
                />
                <span className="text-[10px] text-[var(--texto-secundario)]">Oficial {m.pct_1a_oficial ?? 0}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 text-[11px] text-[var(--texto-secundario)]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> 1ª calidad
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> 2ª calidad
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-500" /> Contenedor · Oficial = sin contenedor
        </span>
      </div>
    </div>
  );
}

// ── Slide 3: Últimos turnos KPI1/KPI2 ─────────────────────────────
function SlideUltimosTurnos() {
  const [turnos, setTurnos] = useState<TurnoKpi[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerUltimosTurnosKpi(6)
      .then(setTurnos)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando turnos"));
  }, []);

  if (error) return <SlideError mensaje={error} />;
  if (!turnos) return <SlideCargando />;
  if (turnos.length === 0) return <SlideVacio mensaje="Sin turnos registrados todavía." />;

  const BarraKpi = ({ segmentos }: { segmentos: { valor: number; color: string; etiqueta: string }[] }) => (
    <div className="flex h-40 w-14 flex-col-reverse overflow-hidden rounded-md">
      {segmentos.map((s, i) => (
        <div key={i} className="flex items-end justify-center" style={{ height: `${s.valor}%`, background: s.color }}>
          {s.valor >= 8 && <span className="mb-1 text-[10px] font-semibold text-[var(--texto)]">{s.valor}%</span>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <h2 className="text-lg font-semibold text-[var(--texto)]">Últimos {turnos.length} turnos — KPI1 &amp; KPI2</h2>
      <div className="grid flex-1 grid-cols-6 gap-3 overflow-y-auto">
        {turnos.map((t) => (
          <div key={t.turno_id} className="flex flex-col items-center gap-2 rounded-xl bg-[var(--superficie-alt)] p-3">
            <div className="text-center">
              <p className="text-xs font-semibold text-sky-400">{NOMBRE_TURNO[t.tipo_turno]}</p>
              <p className="text-[10px] text-[var(--texto-secundario)]">{t.fecha}</p>
              {t.responsable_username && <p className="text-[10px] text-[var(--texto-tenue)]">{t.responsable_username}</p>}
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col items-center gap-1">
                <BarraKpi
                  segmentos={
                    t.kpi1_pct_plena != null
                      ? [
                          { valor: t.kpi1_pct_plena, color: "#22c55e", etiqueta: "Plena" },
                          { valor: t.kpi1_pct_alarma ?? 0, color: "#ef4444", etiqueta: "Alarma" },
                        ]
                      : []
                  }
                />
                <span className="text-[9px] text-[var(--texto-tenue)]">KPI1</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <BarraKpi
                  segmentos={[
                    { valor: t.kpi2_pct_plena, color: "#22c55e", etiqueta: "Plena" },
                    { valor: t.kpi2_pct_alarma, color: "#ef4444", etiqueta: "Alarma" },
                    { valor: t.kpi2_pct_no_alimentada, color: "#64748b", etiqueta: "No alim." },
                    { valor: t.kpi2_pct_fuera_produccion, color: "#a855f7", etiqueta: "Fuera prod." },
                  ]}
                />
                <span className="text-[9px] text-[var(--texto-tenue)]">KPI2</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-[11px] text-[var(--texto-secundario)]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Plena</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Alarma (saturación+banco+máquina)</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" /> No alimentada</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> Fuera de producción</span>
      </div>
    </div>
  );
}

// ── Slides 4 y 5: placeholders ("zona en obras") ──────────────────
function SlideEnObras({ titulo, motivo }: { titulo: string; motivo: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Construction size={48} className="text-amber-500" aria-hidden />
      <h2 className="text-lg font-semibold text-[var(--texto)]">{titulo}</h2>
      <p className="max-w-md text-sm text-[var(--texto-secundario)]">{motivo}</p>
    </div>
  );
}

function SlideCargando() {
  return <div className="flex h-full items-center justify-center text-[var(--texto-tenue)]">Cargando...</div>;
}
function SlideError({ mensaje }: { mensaje: string }) {
  return <div className="flex h-full items-center justify-center px-8 text-center text-red-400">{mensaje}</div>;
}
function SlideVacio({ mensaje }: { mensaje: string }) {
  return <div className="flex h-full items-center justify-center text-[var(--texto-tenue)]">{mensaje}</div>;
}

const SLIDES = [
  { componente: SlideProduccionCiclo },
  { componente: SlideUltimosModelos },
  { componente: SlideUltimosTurnos },
  {
    componente: () => (
      <SlideEnObras
        titulo="Ranking de operarios"
        motivo="Pendiente del cierre de ciclo (cerrar-ciclo, historial_ciclos, personaje RPG) — todavía no construido."
      />
    ),
  },
  {
    componente: () => (
      <SlideEnObras titulo="Reyes del formato" motivo="Zona en obras — pendiente de diseño." />
    ),
  },
];

export function PantallaCarrusel({ username }: { username: string }) {
  const [slideActual, setSlideActual] = useState(0);
  const ahora = useRelojEnVivo();

  useEffect(() => {
    const id = setInterval(() => setSlideActual((i) => (i + 1) % SLIDES.length), DURACION_SLIDE_MS);
    return () => clearInterval(id);
  }, []);

  const SlideComponente = SLIDES[slideActual].componente;

  return (
    <div className="flex h-screen flex-col bg-[var(--fondo)] text-[var(--texto)]">
      <header className="flex items-center justify-between border-b border-[var(--borde)] px-6 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-[var(--acento)]">MOTIV</span>
          <span className="text-sm tracking-wide text-[var(--texto-secundario)]">PRODUCCIÓN</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--texto-secundario)]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {ahora.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })} —{" "}
            {ahora.toLocaleTimeString("es-ES")}
          </span>
          <ThemeSwitcher />
          <button
            onClick={() => cerrarSesion()}
            className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--superficie-alt)]"
            title={`Conectado como ${username}`}
          >
            <LogOut size={14} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <SlideComponente />
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-[var(--borde)] py-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlideActual(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === slideActual ? "w-8 bg-[var(--acento)]" : "w-1.5 bg-[var(--borde)]"
            }`}
            aria-label={`Ir a la diapositiva ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}