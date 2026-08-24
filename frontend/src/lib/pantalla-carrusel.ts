// frontend/src/lib/pantalla-carrusel.ts
// Datos para el carrusel de la pantalla de fábrica (rol 'pantalla').
// Tres bloques con datos reales ya calculables hoy (Producción del
// ciclo, Últimos modelos, Últimos turnos KPI1/KPI2); Ranking y Reyes
// del formato dependen de piezas que no existen aún (cerrar-ciclo,
// gamificación) — sus pantallas quedan como placeholder.

import { supabase } from "./supabase-client";

// ── Producción del ciclo ──────────────────────────────────────────

export interface DiaCiclo {
  fecha: string;
  m2_total: number;
  m2_1a: number;
  m2_comercial: number;
  pct_objetivo: number; // m2_total / objetivo, puede superar 100
}

export interface ProduccionCiclo {
  fechaInicioCiclo: string;
  fechaFinCiclo: string;
  objetivoDiario: number;
  dias: DiaCiclo[];
  m2TotalCiclo: number;
  pctObjetivoCiclo: number;
}

async function obtenerObjetivoDiario(): Promise<number> {
  const { data } = await supabase.from("configuracion").select("valor").eq("clave", "objetivo_m2_dia").maybeSingle();
  const valor = data?.valor ? Number(data.valor) : NaN;
  return Number.isFinite(valor) && valor > 0 ? valor : 35000;
}

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ciclo actual = 28 días desde `configuracion.fecha_inicio_rotacion`,
 * igual que `fn_ciclo_id`/`fn_ciclo_rango` en BD — replicado aquí en
 * JS porque es solo para pintar fechas, no para ningún cálculo de
 * puntos (eso sigue siendo SQL siempre).
 */
export async function obtenerProduccionCicloActual(): Promise<ProduccionCiclo> {
  const [{ data: configInicio }, objetivoDiario] = await Promise.all([
    supabase.from("configuracion").select("valor").eq("clave", "fecha_inicio_rotacion").maybeSingle(),
    obtenerObjetivoDiario(),
  ]);

  const inicioRotacion = new Date(`${configInicio?.valor ?? "2026-02-16"}T00:00:00`);
  const hoy = new Date();
  const diasDesdeInicio = Math.floor((hoy.getTime() - inicioRotacion.getTime()) / 86_400_000);
  const cicloActual = Math.floor(diasDesdeInicio / 28);
  const fechaInicioCiclo = new Date(inicioRotacion.getTime() + cicloActual * 28 * 86_400_000);
  const fechaFinCiclo = new Date(fechaInicioCiclo.getTime() + 27 * 86_400_000);

  const desde = fechaISO(fechaInicioCiclo);
  const hasta = fechaISO(fechaFinCiclo);

  const [{ data: produccion, error: errorProd }, { data: calidad, error: errorCal }] = await Promise.all([
    supabase.from("v_produccion_turno").select("fecha, m2_total").gte("fecha", desde).lte("fecha", hasta),
    supabase.from("v_calidad_turno").select("fecha, m2_1a, m2_comercial").gte("fecha", desde).lte("fecha", hasta),
  ]);
  if (errorProd) throw new Error(`v_produccion_turno: ${errorProd.message}`);
  if (errorCal) throw new Error(`v_calidad_turno: ${errorCal.message}`);

  const porDia = new Map<string, { m2_total: number; m2_1a: number; m2_comercial: number }>();
  for (const p of produccion ?? []) {
    const actual = porDia.get(p.fecha as string) ?? { m2_total: 0, m2_1a: 0, m2_comercial: 0 };
    actual.m2_total += (p.m2_total as number) ?? 0;
    porDia.set(p.fecha as string, actual);
  }
  for (const c of calidad ?? []) {
    const actual = porDia.get(c.fecha as string) ?? { m2_total: 0, m2_1a: 0, m2_comercial: 0 };
    actual.m2_1a += (c.m2_1a as number) ?? 0;
    actual.m2_comercial += (c.m2_comercial as number) ?? 0;
    porDia.set(c.fecha as string, actual);
  }

  const dias: DiaCiclo[] = [];
  for (let i = 0; i < 28; i++) {
    const f = fechaISO(new Date(fechaInicioCiclo.getTime() + i * 86_400_000));
    const d = porDia.get(f) ?? { m2_total: 0, m2_1a: 0, m2_comercial: 0 };
    dias.push({
      fecha: f,
      m2_total: Math.round(d.m2_total * 10) / 10,
      m2_1a: Math.round(d.m2_1a * 10) / 10,
      m2_comercial: Math.round(d.m2_comercial * 10) / 10,
      pct_objetivo: Math.round((d.m2_total / objetivoDiario) * 1000) / 10,
    });
  }

  const m2TotalCiclo = dias.reduce((acc, d) => acc + d.m2_total, 0);
  const objetivoCiclo = objetivoDiario * 28;

  return {
    fechaInicioCiclo: desde,
    fechaFinCiclo: hasta,
    objetivoDiario,
    dias,
    m2TotalCiclo: Math.round(m2TotalCiclo * 10) / 10,
    pctObjetivoCiclo: Math.round((m2TotalCiclo / objetivoCiclo) * 1000) / 10,
  };
}

// ── Últimos modelos en producción ─────────────────────────────────

export interface ModeloReciente {
  producto_id: string;
  modelo_nombre: string;
  formato_nombre: string;
  m2_total: number;
  pct_1a_completa: number | null;
  pct_comercial_completa: number | null;
  pct_contenedor_completa: number | null;
  pct_1a_oficial: number | null;
  pct_comercial_oficial: number | null;
}

/** Los N productos con producción más reciente (por última_produccion de v_calidad_modelo). */
export async function obtenerUltimosModelos(cantidad = 9): Promise<ModeloReciente[]> {
  const { data, error } = await supabase
    .from("v_calidad_modelo")
    .select(
      "producto_id, modelo_nombre, formato_nombre, m2_total, pct_1a_completa, pct_comercial_completa, pct_contenedor_completa, pct_1a_oficial, pct_comercial_oficial, ultima_produccion",
    )
    .order("ultima_produccion", { ascending: false, nullsFirst: false })
    .limit(cantidad);
  if (error) throw new Error(`v_calidad_modelo: ${error.message}`);
  return (data ?? []) as ModeloReciente[];
}

// ── Últimos turnos — KPI1 & KPI2 ──────────────────────────────────

export interface TurnoKpi {
  turno_id: string;
  fecha: string;
  tipo_turno: "M" | "T" | "N";
  responsable_username: string | null;
  kpi1_pct_plena: number | null;
  kpi1_pct_alarma: number | null;
  kpi2_pct_plena: number;
  kpi2_pct_alarma: number;
  kpi2_pct_no_alimentada: number;
  kpi2_pct_fuera_produccion: number;
}

export async function obtenerUltimosTurnosKpi(cantidad = 6): Promise<TurnoKpi[]> {
  const { data, error } = await supabase
    .from("v_produccion_turno")
    .select(
      "turno_id, fecha, tipo_turno, minutos_total, minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina",
    )
    .order("fecha", { ascending: false })
    .limit(cantidad * 2);

  if (error) throw new Error(`v_produccion_turno: ${error.message}`);

  const turnoIds = (data ?? []).map((t) => t.turno_id as string);
  const { data: turnosInfo } = await supabase
    .from("turno")
    .select("id, responsable:abierto_por ( username )")
    .in("id", turnoIds);

  // deno-lint-ignore no-explicit-any
  const responsablePorTurno = new Map<string, string | null>();
  for (const t of (turnosInfo ?? []) as any[]) {
    const resp = Array.isArray(t.responsable) ? t.responsable[0] : t.responsable;
    responsablePorTurno.set(t.id, resp?.username ?? null);
  }

  // deno-lint-ignore no-explicit-any
  const resultado: TurnoKpi[] = ((data ?? []) as any[]).slice(0, cantidad).map((t) => {
    const plena = t.minutos_plena ?? 0;
    const noAlimentada = t.minutos_no_alimentada ?? 0;
    const saturacion = t.minutos_saturacion ?? 0;
    const banco = t.minutos_banco ?? 0;
    const maquina = t.minutos_maquina ?? 0;
    const total = t.minutos_total ?? 0;
    const alarma = saturacion + banco + maquina;
    const fueraProduccion = Math.max(0, total - (plena + noAlimentada + alarma));

    const denomKpi1 = plena + alarma;
    const denomKpi2 = total || plena + noAlimentada + alarma + fueraProduccion;

    return {
      turno_id: t.turno_id,
      fecha: t.fecha,
      tipo_turno: t.tipo_turno,
      responsable_username: responsablePorTurno.get(t.turno_id) ?? null,
      kpi1_pct_plena: denomKpi1 > 0 ? Math.round((plena / denomKpi1) * 1000) / 10 : null,
      kpi1_pct_alarma: denomKpi1 > 0 ? Math.round((alarma / denomKpi1) * 1000) / 10 : null,
      kpi2_pct_plena: denomKpi2 > 0 ? Math.round((plena / denomKpi2) * 1000) / 10 : 0,
      kpi2_pct_alarma: denomKpi2 > 0 ? Math.round((alarma / denomKpi2) * 1000) / 10 : 0,
      kpi2_pct_no_alimentada: denomKpi2 > 0 ? Math.round((noAlimentada / denomKpi2) * 1000) / 10 : 0,
      kpi2_pct_fuera_produccion: denomKpi2 > 0 ? Math.round((fueraProduccion / denomKpi2) * 1000) / 10 : 0,
    };
  });

  return resultado;
}