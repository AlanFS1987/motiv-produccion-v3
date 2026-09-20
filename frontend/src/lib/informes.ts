// Listado de los PDF de informes para las pestañas "Informes" del jefe
// y del administrador (sesión 20/09/2026).
//
// Tres tipos de informe, todos ya generados por Edge Functions:
//   - DIARIO y SEMANAL: tabla `informe_periodo` (generar-informe-periodo,
//     ver 19-informes-periodo.md). El `resumen` (jsonb) trae los totales
//     con los que se pinta cada tarjeta sin abrir el PDF.
//   - DE TURNO: `turno.informe_pdf_url` (generar-resumen-turno).
//
// Solo lectura. La RLS de `informe_periodo` deja leer a jefe y
// administrador (20260920150000_informe_periodo_select_jefe.sql).

import { supabase } from "./supabase-client";

export type TipoInformePeriodo = "diario" | "semanal";
export type TipoTurnoLetra = "M" | "T" | "N";

/** Forma del jsonb `informe_periodo.resumen` (ver resumenDeInforme en la Edge Function). */
export interface ResumenInformePeriodo {
  turnos_registrados: number;
  turnos_esperados: number;
  turnos_sin_cerrar: number;
  turnos_faltantes: string[];
  m2_total: number;
  m2_1a: number;
  m2_comercial: number;
  m2_contenedor: number;
  lotes: number;
  incidencias: number;
}

export interface InformePeriodo {
  id: string;
  tipo: TipoInformePeriodo;
  desde: string; // AAAA-MM-DD, fecha de turno
  hasta: string;
  pdfUrl: string | null;
  resumen: ResumenInformePeriodo | null;
}

export interface InformeTurno {
  turnoId: string;
  fecha: string; // AAAA-MM-DD
  tipo: TipoTurnoLetra;
  pdfUrl: string;
}

const NOMBRE_TURNO: Record<TipoTurnoLetra, string> = { M: "Mañana", T: "Tarde", N: "Noche" };
// Dentro de un mismo día, el más reciente primero: Noche, Tarde, Mañana.
const ORDEN_TURNO: Record<TipoTurnoLetra, number> = { M: 0, T: 1, N: 2 };

// ---------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------

export async function listarInformesPeriodo(tipo: TipoInformePeriodo, limite = 30): Promise<InformePeriodo[]> {
  const { data, error } = await supabase
    .from("informe_periodo")
    .select("id, tipo, desde, hasta, pdf_url, resumen")
    .eq("tipo", tipo)
    .order("desde", { ascending: false })
    .limit(limite);
  if (error) throw error;

  // deno-lint-ignore no-explicit-any
  return (data ?? []).map((f: any) => ({
    id: f.id,
    tipo: f.tipo,
    desde: f.desde,
    hasta: f.hasta,
    pdfUrl: f.pdf_url ?? null,
    resumen: (f.resumen as ResumenInformePeriodo | null) ?? null,
  }));
}

export async function listarInformesTurno(limite = 45): Promise<InformeTurno[]> {
  // Se piden más filas de las necesarias por fecha y se ordena el
  // tipo de turno en cliente: alfabéticamente M < N < T, y aquí
  // interesa Noche > Tarde > Mañana dentro de cada día.
  const { data, error } = await supabase
    .from("turno")
    .select("id, fecha, tipo, informe_pdf_url")
    .not("informe_pdf_url", "is", null)
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) throw error;

  // deno-lint-ignore no-explicit-any
  const filas: InformeTurno[] = (data ?? []).map((f: any) => ({
    turnoId: f.id,
    fecha: f.fecha,
    tipo: f.tipo,
    pdfUrl: f.informe_pdf_url,
  }));
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || ORDEN_TURNO[b.tipo] - ORDEN_TURNO[a.tipo]);
}

// ---------------------------------------------------------------
// Formato (puro, sin React ni Supabase)
// ---------------------------------------------------------------

function partesFecha(fechaISO: string): { y: number; m: number; d: number } {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return { y, m, d };
}

/** "19/09/2026" */
export function formatearFechaCorta(fechaISO: string): string {
  const { y, m, d } = partesFecha(fechaISO);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "19/09" */
function formatearDiaMes(fechaISO: string): string {
  const { m, d } = partesFecha(fechaISO);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "sáb 19/09/2026" */
export function formatearFechaConDia(fechaISO: string): string {
  const { y, m, d } = partesFecha(fechaISO);
  const dia = new Date(y, m - 1, d).toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
  return `${dia} ${formatearFechaCorta(fechaISO)}`;
}

export function tituloInformePeriodo(i: Pick<InformePeriodo, "tipo" | "desde" | "hasta">): string {
  return i.tipo === "diario"
    ? formatearFechaConDia(i.desde)
    : `Semana ${formatearDiaMes(i.desde)} – ${formatearFechaCorta(i.hasta)}`;
}

export function tituloInformeTurno(i: Pick<InformeTurno, "fecha" | "tipo">): string {
  return `${NOMBRE_TURNO[i.tipo]} · ${formatearFechaConDia(i.fecha)}`;
}

function numero(valor: number, decimales: number): string {
  return valor.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** "39.967,4 m²" */
export function formatearM2(valor: number): string {
  return `${numero(valor, 1)} m²`;
}

/** "93,1 %" — "—" si el total es 0. */
export function formatearPorcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${numero((parte / total) * 100, 1)} %`;
}

/** Solo enlaces https: la URL viene de nuestra base de datos, pero no cuesta nada comprobarlo antes de pintar un <a>. */
export function urlPdfSegura(url: string | null | undefined): string | null {
  return url && /^https:\/\//i.test(url) ? url : null;
}
