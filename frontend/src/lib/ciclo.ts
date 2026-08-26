// frontend/src/lib/ciclo.ts
//
// Cálculo del ciclo actual en el CLIENTE — misma fórmula que
// fn_ciclo_id en BD (28 días desde configuracion.fecha_inicio_rotacion),
// replicada aquí por el mismo motivo que ya documentaba
// lib/pantalla-carrusel.ts: es solo para saber A QUÉ cycle_id filtrar
// una consulta, nunca para calcular puntos (eso siempre es SQL).
//
// Antes de este archivo, pantalla-carrusel.ts tenía su propia copia
// de esta fórmula. Se consolida aquí para que Inicio/Ranking/Logros
// no la vuelvan a duplicar una tercera vez — pantalla-carrusel.ts
// puede migrarse a este helper más adelante si se quiere (no es
// urgente, no es un bug, es limpieza).

import { supabase } from "./supabase-client";

export interface CicloActual {
  cycleId: number;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
}

let cacheFechaInicioRotacion: string | null = null;

async function obtenerFechaInicioRotacion(): Promise<string> {
  if (cacheFechaInicioRotacion) return cacheFechaInicioRotacion;
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "fecha_inicio_rotacion")
    .maybeSingle();
  cacheFechaInicioRotacion = (data?.valor as string | undefined) ?? "2026-02-16";
  return cacheFechaInicioRotacion;
}

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Ciclo que está pasando ahora mismo. */
export async function obtenerCicloActual(): Promise<CicloActual> {
  const inicioRotacion = new Date(`${await obtenerFechaInicioRotacion()}T00:00:00`);
  const hoy = new Date();
  const diasDesdeInicio = Math.floor((hoy.getTime() - inicioRotacion.getTime()) / 86_400_000);
  const cycleId = Math.floor(diasDesdeInicio / 28);
  const fechaInicioCiclo = new Date(inicioRotacion.getTime() + cycleId * 28 * 86_400_000);
  const fechaFinCiclo = new Date(fechaInicioCiclo.getTime() + 27 * 86_400_000);
  return { cycleId, fechaInicio: fechaISO(fechaInicioCiclo), fechaFin: fechaISO(fechaFinCiclo) };
}

/** El ciclo inmediatamente anterior al actual (para el toggle de Ranking). */
export async function obtenerCicloAnterior(): Promise<CicloActual> {
  const actual = await obtenerCicloActual();
  const fechaInicioActual = new Date(`${actual.fechaInicio}T00:00:00`);
  const fechaFinAnterior = new Date(fechaInicioActual.getTime() - 86_400_000);
  const fechaInicioAnterior = new Date(fechaInicioActual.getTime() - 28 * 86_400_000);
  return {
    cycleId: actual.cycleId - 1,
    fechaInicio: fechaISO(fechaInicioAnterior),
    fechaFin: fechaISO(fechaFinAnterior),
  };
}