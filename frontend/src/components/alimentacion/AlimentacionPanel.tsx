// frontend/src/components/alimentacion/AlimentacionPanel.tsx
// Pestaña "Alimentación": relación entre la velocidad a la que
// trabaja cada línea (piezas/min a plena), el tiempo que pasa a plena
// y lo que realmente sale del turno. Pensado para encontrar el punto
// óptimo de alimentación.
//
// Componente autocontenido y sin props: se monta igual en JefeApp,
// AdminApp, ProduccionApp o donde haga falta (mismo patrón que
// InformesScreen). Tres gráficas con filtros comunes (formato,
// líneas, periodo): dos nubes de puntos y una evolución temporal.
//
// Reglas (memorias/21-alimentacion.md):
//  - Minutos REALES, sin el suelo de 480 del % de rendimiento oficial.
//  - Solo turnos+línea de UN único formato; los mixtos se cuentan aparte.
//  - "Consigna" = piezas ÷ minutos a plena (lo que la máquina consigue,
//    no lo que se le pidió: la consigna real no se captura).
//  - Al agrupar se suman piezas y minutos y se divide al final.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { clasificarTurnos, sumarDias } from "../../lib/alimentacion-calculos";
import {
  DIAS_MINIMOS_CARGA,
  obtenerFormatosAlimentacion,
  obtenerTurnosAlimentacion,
  RANGO_MINUTOS_VALIDOS,
  type TurnoLineaAlimentacion,
} from "../../lib/dashboard-alimentacion";
import { hoyLocalISO } from "../../lib/fechas";
import { FiltrosAlimentacion, MAX_LINEAS, type LineaDisponible, type RangoNubes } from "./FiltrosAlimentacion";
import { NubesAlimentacion } from "./NubesAlimentacion";
import { TemporalAlimentacion } from "./TemporalAlimentacion";

const FORMATO_POR_DEFECTO = "600x1200"; // el que más líneas comparte

/** Los errores de Supabase son objetos con `message`, no instancias de Error. */
function mensajeDeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : "No se pudieron cargar los datos";
}

export function AlimentacionPanel() {
  const [formatos, setFormatos] = useState<string[]>([]);
  const [formato, setFormato] = useState<string>("");
  const [rango, setRango] = useState<RangoNubes>(180);
  const [filas, setFilas] = useState<TurnoLineaAlimentacion[]>([]);
  const [lineasElegidas, setLineasElegidas] = useState<string[] | null>(null); // null = las primeras MAX_LINEAS
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Si se cambia de filtro con una carga en curso, solo vale la última.
  const peticionActual = useRef(0);

  // Catálogo de formatos (una vez).
  useEffect(() => {
    obtenerFormatosAlimentacion()
      .then((lista) => {
        setFormatos(lista);
        setFormato((actual) => actual || (lista.includes(FORMATO_POR_DEFECTO) ? FORMATO_POR_DEFECTO : (lista[0] ?? "")));
      })
      .catch((err) => {
        setError(mensajeDeError(err));
        setCargando(false);
      });
  }, []);

  const cargar = useCallback(async (f: string, r: RangoNubes) => {
    const numero = ++peticionActual.current;
    setCargando(true);
    setError(null);
    try {
      const desde = sumarDias(hoyLocalISO(), -Math.max(r, DIAS_MINIMOS_CARGA));
      const datos = await obtenerTurnosAlimentacion(f, desde);
      if (numero === peticionActual.current) setFilas(datos);
    } catch (err) {
      if (numero === peticionActual.current) setError(mensajeDeError(err));
    } finally {
      if (numero === peticionActual.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (formato) void cargar(formato, rango);
  }, [formato, rango, cargar]);

  // ── Derivados ──────────────────────────────────────────────────

  const lineasDisponibles = useMemo<LineaDisponible[]>(() => {
    const mapa = new Map<string, string>();
    for (const f of filas) mapa.set(f.lineaId, f.lineaNombre);
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  }, [filas]);

  const lineasActivas = useMemo<LineaDisponible[]>(() => {
    if (lineasElegidas === null) return lineasDisponibles.slice(0, MAX_LINEAS);
    return lineasDisponibles.filter((l) => lineasElegidas.includes(l.id));
  }, [lineasDisponibles, lineasElegidas]);

  const filasDeLineasActivas = useMemo(() => {
    const ids = new Set(lineasActivas.map((l) => l.id));
    return filas.filter((f) => ids.has(f.lineaId));
  }, [filas, lineasActivas]);

  // Temporal: todo lo cargado (≥ trimestre). Nubes y resumen: solo el rango elegido.
  const validosTemporal = useMemo(() => clasificarTurnos(filasDeLineasActivas).validos, [filasDeLineasActivas]);

  const clasificacionNubes = useMemo(() => {
    const desdeRango = sumarDias(hoyLocalISO(), -rango);
    return clasificarTurnos(filasDeLineasActivas.filter((f) => f.fecha >= desdeRango));
  }, [filasDeLineasActivas, rango]);

  // ── Handlers ───────────────────────────────────────────────────

  function cambiarFormato(f: string) {
    setLineasElegidas(null); // otro formato, otras líneas disponibles
    setFormato(f);
  }

  function alternarLinea(id: string) {
    const actuales = lineasActivas.map((l) => l.id);
    if (actuales.includes(id)) setLineasElegidas(actuales.filter((x) => x !== id));
    else if (actuales.length < MAX_LINEAS) setLineasElegidas([...actuales, id]);
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4">
      <FiltrosAlimentacion
        formatos={formatos}
        formato={formato}
        onFormato={cambiarFormato}
        lineasDisponibles={lineasDisponibles}
        lineasSeleccionadas={lineasActivas.map((l) => l.id)}
        onToggleLinea={alternarLinea}
        rango={rango}
        onRango={setRango}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--texto-tenue)]">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        !error && (
          <>
            <p className="text-xs text-[var(--texto-secundario)]">
              <strong className="text-[var(--texto)]">{clasificacionNubes.validos.length}</strong> turnos incluidos ·{" "}
              {clasificacionNubes.excluidosMezcla} excluidos por mezcla de formatos · {clasificacionNubes.excluidosMinutos} por minutos fuera de{" "}
              {RANGO_MINUTOS_VALIDOS.min}–{RANGO_MINUTOS_VALIDOS.max}. Minutos reales, sin suelo de 480; solo turnos de un único formato.
            </p>

            <NubesAlimentacion turnos={clasificacionNubes.validos} lineas={lineasActivas} />

            <TemporalAlimentacion turnosValidos={validosTemporal} lineas={lineasActivas} formato={formato} />
          </>
        )
      )}
    </div>
  );
}
