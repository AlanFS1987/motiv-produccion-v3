// frontend/src/components/alimentacion/AlimentacionPanel.tsx
// Pestaña "Alimentación": relación entre la velocidad conseguida a
// plena de cada línea, el tiempo que pasa a plena y lo que sale por
// turno, para encontrar el punto óptimo de alimentación.
//
// Componente autocontenido y sin props: se monta igual en JefeApp,
// AdminApp, ProduccionApp o donde haga falta (mismo patrón que
// InformesScreen). Filtros comunes (formato, líneas, periodo, solo
// turnos comparables) y la curva de velocidad conseguida.
//
// Reglas (memorias/21-alimentacion.md):
//  - Base de TIEMPO ALIMENTABLE = total − banco − máquina; las reglas de
//    qué turnos entran viven en REGLAS_TURNOS (alimentacion-calculos.ts).
//  - Solo turnos+línea de UN único formato; los mixtos se cuentan aparte.
//  - "Velocidad conseguida" = piezas ÷ minutos a plena (lo que la máquina
//    consigue, no lo que se le pidió: la consigna real no se captura).
//  - Al agrupar se suman piezas y minutos y se divide al final.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { clasificarAlimentables, sumarDias } from "../../lib/alimentacion-calculos";
import { construirBalance, nivelHornoPorLinea } from "../../lib/balance-horno-calculos";
import { listarHornoFormato, obtenerClasificadoPlanta, type ClasificadoTurnoFormato, type HornoFormato } from "../../lib/horno-formato";
import { obtenerFormatosAlimentacion, obtenerTurnosAlimentacion, type TurnoLineaAlimentacion } from "../../lib/dashboard-alimentacion";
import { hoyLocalISO } from "../../lib/fechas";
import { FiltrosAlimentacion, MAX_LINEAS, type LineaDisponible, type RangoDias } from "./FiltrosAlimentacion";
import { CurvaVelocidadAlimentacion } from "./CurvaVelocidadAlimentacion";
import { BalanceHornoAlimentacion } from "./BalanceHornoAlimentacion";

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
  const [rango, setRango] = useState<RangoDias>(180);
  const [filas, setFilas] = useState<TurnoLineaAlimentacion[]>([]);
  const [soloComparables, setSoloComparables] = useState(false);
  const [hornos, setHornos] = useState<HornoFormato[]>([]);
  const [clasificadoPlanta, setClasificadoPlanta] = useState<ClasificadoTurnoFormato[]>([]); // todos los formatos
  // Los datos del horno son un complemento: si fallan (p. ej. migración sin aplicar) no tumban la curva.
  const [avisoHorno, setAvisoHorno] = useState<string | null>(null);
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

  // Parámetros de los hornos por formato (una vez).
  useEffect(() => {
    listarHornoFormato()
      .then(setHornos)
      .catch((err) => setAvisoHorno(`No se pudo cargar la tabla de hornos: ${mensajeDeError(err)}`));
  }, []);

  const cargar = useCallback(async (f: string, r: RangoDias) => {
    const numero = ++peticionActual.current;
    setCargando(true);
    setError(null);
    try {
      const desde = sumarDias(hoyLocalISO(), -r);
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

  // Clasificado de TODA la planta (todos los formatos) para el balance: la inferencia de qué formato
  // cuece cada horno los necesita juntos. Solo depende del periodo, no del formato elegido.
  useEffect(() => {
    let vigente = true;
    setClasificadoPlanta([]);
    obtenerClasificadoPlanta(sumarDias(hoyLocalISO(), -rango))
      .then((d) => vigente && setClasificadoPlanta(d))
      .catch((err) => vigente && setAvisoHorno(`No se pudo cargar el clasificado de la planta: ${mensajeDeError(err)}`));
    return () => {
      vigente = false;
    };
  }, [rango]);

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

  // Curva de velocidad conseguida: base de tiempo alimentable, dentro del periodo elegido.
  const clasificacionAlimentable = useMemo(() => {
    const desdeRango = sumarDias(hoyLocalISO(), -rango);
    return clasificarAlimentables(
      filasDeLineasActivas.filter((f) => f.fecha >= desdeRango),
      soloComparables,
    );
  }, [filasDeLineasActivas, rango, soloComparables]);

  // Nivel medio de piezas por línea y turno que sostiene el horno (fecha de hoy).
  const referenciaHorno = useMemo(() => {
    const n = formato ? nivelHornoPorLinea(hornos, formato, hoyLocalISO()) : null;
    return n ? { piezasTurnoPorLinea: n.piezasTurnoPorLinea, lineas: n.parametros.lineas, hornos: n.parametros.hornos } : null;
  }, [hornos, formato]);

  // Balance horno vs clasificación: toda la planta (no depende del filtro de líneas).
  const balance = useMemo(() => (formato ? construirBalance(clasificadoPlanta, hornos, formato) : null), [clasificadoPlanta, hornos, formato]);
  const avisoBalance = useMemo(() => {
    if (avisoHorno) return avisoHorno;
    if (cargando || !formato || clasificadoPlanta.length === 0) return null;
    if (!balance) return `Sin clasificación de ${formato} en el periodo, o falta su horno en la tabla de hornos (pestaña Hornos del administrador).`;
    return null;
  }, [avisoHorno, cargando, formato, clasificadoPlanta, balance]);

  // ── Handlers ───────────────────────────────────────────────────

  function cambiarFormato(f: string) {
    setLineasElegidas(null); // otro formato, otras líneas disponibles
    setAvisoHorno(null);
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
        soloComparables={soloComparables}
        onSoloComparables={setSoloComparables}
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
            <CurvaVelocidadAlimentacion clasificacion={clasificacionAlimentable} lineas={lineasActivas} referenciaHorno={referenciaHorno} />
            <BalanceHornoAlimentacion formato={formato} balance={balance} aviso={avisoBalance} />
          </>
        )
      )}
    </div>
  );
}
