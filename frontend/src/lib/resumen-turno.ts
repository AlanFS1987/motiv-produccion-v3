// Informe de cierre de turno. Ref. 01-rol-responsable.md 3.9b,
// 06-integraciones.md (grupo "Resumen de turno").
//
// Estructura jerárquica de 3 niveles (cabecera de turno -> por línea
// -> por parte con producción real), sin fotos, pensado para copiar
// a mano en WhatsApp o mandarse automáticamente a Telegram.
//
// Este archivo solo genera los DATOS y el texto para el botón
// "Copiar" del cliente (formato plano, estilo WhatsApp). El envío
// automático a Telegram vive en la Edge Function `generar-resumen-
// turno` (pendiente de construir, ver 11-esquema-supabase.md 13.7) —
// esa función reimplementa su propio formateo en Deno/TS, mismo
// patrón de duplicación intencional que ya existe entre
// lib/normalizacion.ts (frontend) y _shared/normalizacion.ts (edge
// function).

import { supabase } from "./supabase-client";
import { m2DePiezas } from "./formato";
import type { TipoTurno } from "./rotacion";

export interface IncidenciaResumen {
  descripcion: string;
  createdAt: string;
}

export interface TiemposAgregados {
  plena: number;
  noAlimentada: number;
  saturacion: number;
  banco: number;
  maquina: number;
}

export interface ParteResumenInforme {
  modeloNombre: string;
  formatoNombre: string;
  tono: string;
  m2_1a: number;
  m2Comercial: number;
  m2Contenedor: number;
  incidenciasCalidad: IncidenciaResumen[];
}

export interface LineaResumen {
  lineaId: string;
  lineaNombre: string;
  operarioUsername: string | null;
  m2Total: number;
  tiempos: TiemposAgregados;
  incidenciasProduccion: IncidenciaResumen[];
  partes: ParteResumenInforme[];
}

export interface ResumenTurno {
  fecha: string;
  tipo: TipoTurno;
  responsableUsername: string;
  m2Total: number;
  tiempos: TiemposAgregados;
  lineas: LineaResumen[];
  incidenciasGenerales: IncidenciaResumen[];
}

/** Supabase a veces devuelve una relación anidada como array de 1, a veces como objeto — se normaliza. */
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function tiemposVacios(): TiemposAgregados {
  return { plena: 0, noAlimentada: 0, saturacion: 0, banco: 0, maquina: 0 };
}

/**
 * Busca el turno de (fecha, tipo) SIN crearlo — a diferencia de
 * `obtenerOCrearTurno` (lib/turno.ts), la pantalla de Resumen no debe
 * crear un turno solo porque alguien entró a mirar.
 */
export async function obtenerTurnoPorFechaTipo(
  fecha: string,
  tipo: TipoTurno,
): Promise<{ id: string; cerrado_at: string | null } | null> {
  const { data, error } = await supabase
    .from("turno")
    .select("id, cerrado_at")
    .eq("fecha", fecha)
    .eq("tipo", tipo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Compila el informe jerárquico completo de un turno (3.9b). No
 * distingue si el turno ya está cerrado o sigue abierto — quien
 * llama decide si avisar de que es una vista provisional.
 */
export async function generarResumenTurno(turnoId: string): Promise<ResumenTurno> {
  // 1) Turno + responsable que lo abrió.
  const { data: turnoRow, error: turnoErr } = await supabase
    .from("turno")
    .select("fecha, tipo, responsable:abierto_por ( username )")
    .eq("id", turnoId)
    .single();
  if (turnoErr) throw turnoErr;
  const responsable = uno<{ username: string }>(turnoRow.responsable as any);

  // 2) Las 6 líneas fijas, siempre en el mismo orden — aparecen todas
  // en el informe tengan o no operario/producción (3.9b).
  const { data: lineasRows, error: lineasErr } = await supabase
    .from("linea")
    .select("id, nombre")
    .order("nombre");
  if (lineasErr) throw lineasErr;

  // 3) Operario asignado a cada línea en este turno.
  const { data: asignRows, error: asignErr } = await supabase
    .from("asignacion_operario_linea")
    .select("linea_id, operario:operario_id ( username )")
    .eq("turno_id", turnoId);
  if (asignErr) throw asignErr;
  const operarioPorLinea = new Map<string, string>();
  for (const a of asignRows ?? []) {
    const op = uno<{ username: string }>(a.operario as any);
    if (op?.username) operarioPorLinea.set(a.linea_id, op.username);
  }

  // 4) Partes vigentes con PRODUCCIÓN REAL — se omiten los que están
  // a 0 o sin completar (3.9b: "un lote preparado esperando material"
  // no debe aparecer en el informe).
  const { data: partesRows, error: partesErr } = await supabase
    .from("parte")
    .select(
      `id, linea_id, tono, piezas_1a, piezas_comercial, piezas_contenedor, piezas_entradas,
       minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
       lote:lote_id (
         producto:producto_id (
           modelo:modelo_id ( nombre ),
           formato:formato_id ( nombre )
         )
       )`,
    )
    .eq("turno_id", turnoId)
    .eq("vigente", true)
    .eq("completado", true)
    .gt("piezas_entradas", 0)
    .order("created_at", { ascending: true });
  if (partesErr) throw partesErr;

  const parteIds = (partesRows ?? []).map((p) => p.id);

  // 5) Incidencias de calidad colgadas de esos partes.
  const incidenciasCalidadPorParte = new Map<string, IncidenciaResumen[]>();
  if (parteIds.length > 0) {
    const { data: icRows, error: icErr } = await supabase
      .from("incidencia_calidad")
      .select("parte_id, descripcion, created_at")
      .in("parte_id", parteIds);
    if (icErr) throw icErr;
    for (const ic of icRows ?? []) {
      const lista = incidenciasCalidadPorParte.get(ic.parte_id) ?? [];
      lista.push({ descripcion: ic.descripcion, createdAt: ic.created_at });
      incidenciasCalidadPorParte.set(ic.parte_id, lista);
    }
  }

  // 6) Incidencias de producción del turno — por línea, y generales
  // (linea_id null) para el bloque final (3.9b).
  const { data: ipRows, error: ipErr } = await supabase
    .from("incidencia_produccion")
    .select("linea_id, descripcion, created_at")
    .eq("turno_id", turnoId);
  if (ipErr) throw ipErr;
  const incidenciasProduccionPorLinea = new Map<string, IncidenciaResumen[]>();
  const incidenciasGenerales: IncidenciaResumen[] = [];
  for (const ip of ipRows ?? []) {
    const item: IncidenciaResumen = { descripcion: ip.descripcion, createdAt: ip.created_at };
    if (ip.linea_id) {
      const lista = incidenciasProduccionPorLinea.get(ip.linea_id) ?? [];
      lista.push(item);
      incidenciasProduccionPorLinea.set(ip.linea_id, lista);
    } else {
      incidenciasGenerales.push(item);
    }
  }

  // 7) Agregar partes por línea: m² por categoría (fórmula del
  // formato) + tiempos, acumulando también el total del turno.
  interface AcumuladorLinea {
    m2: number;
    tiempos: TiemposAgregados;
    partes: ParteResumenInforme[];
  }
  const acumPorLinea = new Map<string, AcumuladorLinea>();
  function obtenerAcum(lineaId: string): AcumuladorLinea {
    let a = acumPorLinea.get(lineaId);
    if (!a) {
      a = { m2: 0, tiempos: tiemposVacios(), partes: [] };
      acumPorLinea.set(lineaId, a);
    }
    return a;
  }

  const tiemposTotales = tiemposVacios();
  let m2TotalTurno = 0;

  for (const p of partesRows ?? []) {
    const lote = uno<any>(p.lote);
    const producto = uno<any>(lote?.producto);
    const modelo = uno<any>(producto?.modelo);
    const formato = uno<any>(producto?.formato);
    const formatoNombre = formato?.nombre ?? null;

    const m2_1a = m2DePiezas(p.piezas_1a, formatoNombre);
    const m2Comercial = m2DePiezas(p.piezas_comercial, formatoNombre);
    const m2Contenedor = m2DePiezas(p.piezas_contenedor, formatoNombre);
    const m2Parte = m2_1a + m2Comercial + m2Contenedor;

    const item: ParteResumenInforme = {
      modeloNombre: modelo?.nombre ?? "—",
      formatoNombre: formatoNombre ?? "—",
      tono: p.tono,
      m2_1a,
      m2Comercial,
      m2Contenedor,
      incidenciasCalidad: incidenciasCalidadPorParte.get(p.id) ?? [],
    };

    const acum = obtenerAcum(p.linea_id);
    acum.partes.push(item);
    acum.m2 += m2Parte;
    acum.tiempos.plena += p.minutos_plena;
    acum.tiempos.noAlimentada += p.minutos_no_alimentada;
    acum.tiempos.saturacion += p.minutos_saturacion;
    acum.tiempos.banco += p.minutos_banco;
    acum.tiempos.maquina += p.minutos_maquina;

    m2TotalTurno += m2Parte;
    tiemposTotales.plena += p.minutos_plena;
    tiemposTotales.noAlimentada += p.minutos_no_alimentada;
    tiemposTotales.saturacion += p.minutos_saturacion;
    tiemposTotales.banco += p.minutos_banco;
    tiemposTotales.maquina += p.minutos_maquina;
  }

  const lineas: LineaResumen[] = (lineasRows ?? []).map((linea) => {
    const acum = acumPorLinea.get(linea.id);
    return {
      lineaId: linea.id,
      lineaNombre: linea.nombre,
      operarioUsername: operarioPorLinea.get(linea.id) ?? null,
      m2Total: acum?.m2 ?? 0,
      tiempos: acum?.tiempos ?? tiemposVacios(),
      incidenciasProduccion: incidenciasProduccionPorLinea.get(linea.id) ?? [],
      partes: acum?.partes ?? [],
    };
  });

  return {
    fecha: turnoRow.fecha,
    tipo: turnoRow.tipo,
    responsableUsername: responsable?.username ?? "—",
    m2Total: m2TotalTurno,
    tiempos: tiemposTotales,
    lineas,
    incidenciasGenerales,
  };
}

const NOMBRE_TIPO: Record<TipoTurno, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function formatearM2(valor: number): string {
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m²`;
}

function formatearTiempos(t: TiemposAgregados): string {
  return `Plena ${t.plena}m · No aliment. ${t.noAlimentada}m · Saturación ${t.saturacion}m · Banco ${t.banco}m · Máquina ${t.maquina}m`;
}

function formatearFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Texto plano estilo WhatsApp (asteriscos para negrita, sin HTML) —
 * es lo que copia el botón "Copiar" (3.9b: "se descarta el botón
 * Compartir nativo porque WhatsApp trunca textos largos al
 * compartir directamente", así que se pega a mano).
 */
export function formatearResumenTurnoTexto(r: ResumenTurno): string {
  const lineas: string[] = [];

  lineas.push(`*RESUMEN DE TURNO — ${NOMBRE_TIPO[r.tipo]}, ${formatearFecha(r.fecha)}*`);
  lineas.push(`Responsable: ${r.responsableUsername}`);
  lineas.push(`m² totales: ${formatearM2(r.m2Total)}`);
  lineas.push(formatearTiempos(r.tiempos));
  lineas.push("");

  for (const linea of r.lineas) {
    lineas.push(`*${linea.lineaNombre}*`);
    lineas.push(`Operario: ${linea.operarioUsername ?? "Sin asignar"}`);
    lineas.push(`m²: ${formatearM2(linea.m2Total)} · ${formatearTiempos(linea.tiempos)}`);

    for (const ip of linea.incidenciasProduccion) {
      lineas.push(`⚠️ Incidencia de producción: "${ip.descripcion}"`);
    }

    if (linea.partes.length === 0) {
      lineas.push("Sin producción real registrada este turno.");
    }
    for (const p of linea.partes) {
      lineas.push(`  • ${p.modeloNombre} (${p.formatoNombre}) — Tono ${p.tono}`);
      lineas.push(
        `    1ª: ${formatearM2(p.m2_1a)} · Comercial: ${formatearM2(p.m2Comercial)} · Contenedor: ${formatearM2(p.m2Contenedor)}`,
      );
      for (const ic of p.incidenciasCalidad) {
        lineas.push(`    🔴 Incidencia de calidad: "${ic.descripcion}"`);
      }
    }
    lineas.push("");
  }

  if (r.incidenciasGenerales.length > 0) {
    lineas.push("*Incidencias generales del turno*");
    for (const ig of r.incidenciasGenerales) {
      lineas.push(`- "${ig.descripcion}"`);
    }
  }

  return lineas.join("\n").trimEnd();
}
