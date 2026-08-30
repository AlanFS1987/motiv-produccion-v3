// frontend/src/lib/relevo.ts
//
// Datos para la pestaña "Relevo" del responsable (02-responsable.md):
// qué dejó el turno INMEDIATAMENTE anterior para quien entra ahora —
// lotes abiertos sin cerrar (con su pendiente de producir), el último
// lote cerrado por línea, e incidencias. Mismo criterio de "solo el
// turno justo antes, no rebuscar lo último que sea" que ya usa
// obtenerSugerenciasContinuarPorLinea (lib/parte.ts) para "Continuar
// mismo lote+tono".
//
// Diferencia deliberada con esa función: aquí el turno anterior se
// busca por fecha+tipo (fn_turno_de_letra ya resuelto en TurnoActual),
// no por created_at relativo a un turno_id actual — la pestaña Relevo
// tiene que poder abrirse ANTES de que nadie haya entrado en la
// pestaña Turno y creado la fila de hoy (ver obtenerOCrearTurno en
// lib/turno.ts), así que no puede depender de que esa fila ya exista.
//
// Partes pendientes: consulta PROPIA (no obtenerPartesPendientesPorLinea
// de lib/parte.ts) porque esa devuelve ParteResumen sin lote_id a
// nivel superior — aquí hace falta el lote_id para buscar su
// pendiente en v_lote_pendiente (lib/lote.ts). Resto de lo que no
// existía: "último completado por línea" de un turno_id ya conocido
// (no calculado a partir de otro turno) y las incidencias de calidad
// agrupadas por línea de un turno (esa tabla solo tiene parte_id, no
// turno_id directo).

import { supabase } from "./supabase-client";
import { listarLineas } from "./turno";
import { obtenerPendientePorLote } from "./lote";
import type { EstadoVerificacionCaja, EstadoVerificacionCodbar } from "./parte";
import {
  listarIncidenciasProduccionLinea,
  listarIncidenciasProduccionGenerales,
  type IncidenciaProduccion,
} from "./incidencias";
import type { TipoTurno } from "./rotacion";

/** m² y piezas que faltan por producir del lote — null si no tiene objetivo_m2 capturado (ver v_lote_pendiente). */
export interface PendienteLote {
  m2Pendiente: number | null;
  piezasPendiente: number | null;
}

export interface TurnoAnteriorInfo {
  id: string;
  fecha: string;
  tipo: TipoTurno;
  cerradoAt: string | null;
  comoCerro: "manual" | "automatico" | null;
}

/** Mismos campos que ParteResumen (lib/parte.ts) + loteId (hace falta para el pendiente) + pendiente ya resuelto. */
export interface ParteAbiertoRelevo {
  id: string;
  loteId: string;
  tono: string;
  calibre: string | null;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  verificacionCajaEstado: EstadoVerificacionCaja | null;
  verificacionCodbarEstado: EstadoVerificacionCodbar | null;
  pendiente: PendienteLote;
}

/** Último parte completado de una línea — mismos campos que SugerenciaContinuar (lib/parte.ts) + piezas/hora + pendiente. */
export interface UltimoCerrado {
  loteId: string;
  tono: string;
  calibre: string | null;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  numeroOrden: string;
  piezasEntradas: number;
  completadoAt: string | null;
  pendiente: PendienteLote;
}

export interface IncidenciaCalidadRelevo {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  createdAt: string;
  modeloNombre: string;
  tono: string;
}

export interface RelevoLinea {
  lineaId: string;
  lineaNombre: string;
  /** Parte sin completar que deja el turno anterior — lo que hay que retomar, con el pendiente de su lote. */
  parteAbierto: ParteAbiertoRelevo | null;
  /** Último parte que el turno anterior sí cerró en esta línea (aunque no haya nada pendiente). */
  ultimoCerrado: UltimoCerrado | null;
  incidenciasProduccion: IncidenciaProduccion[];
  incidenciasCalidad: IncidenciaCalidadRelevo[];
}

export interface DatosRelevo {
  /** null si el turno inmediatamente anterior nunca llegó a abrirse (sin fila en `turno`) — no se rebusca más atrás. */
  turnoAnterior: TurnoAnteriorInfo | null;
  incidenciasGenerales: IncidenciaProduccion[];
  lineas: RelevoLinea[];
}

/** Slot M/T/N inmediatamente anterior al dado, con cruce de medianoche para M -> N de ayer. */
function fechaTipoAnterior(fecha: string, tipo: TipoTurno): { fecha: string; tipo: TipoTurno } {
  if (tipo === "T") return { fecha, tipo: "M" };
  if (tipo === "N") return { fecha, tipo: "T" };
  // tipo === "M": el anterior es la N del día de antes.
  const [y, m, d] = fecha.split("-").map(Number);
  const ayer = new Date(y, m - 1, d - 1);
  const yy = ayer.getFullYear();
  const mm = String(ayer.getMonth() + 1).padStart(2, "0");
  const dd = String(ayer.getDate()).padStart(2, "0");
  return { fecha: `${yy}-${mm}-${dd}`, tipo: "N" };
}

const SELECT_PARTE_ABIERTO_RELEVO = `id, linea_id, lote_id, tono, calibre, verificacion_caja_estado, verificacion_codbar_estado,
  lote:lote_id (
    numero_orden,
    producto:producto_id (
      formato:formato_id ( nombre ),
      modelo:modelo_id ( nombre ),
      marca:marca_id ( nombre )
    )
  )`;

/**
 * Partes pendientes (completado=false, vigente) por línea de un
 * turno_id ya conocido, CON lote_id — a diferencia de
 * obtenerPartesPendientesPorLinea (lib/parte.ts), que no lo trae a
 * nivel superior. Se necesita para buscar el pendiente de cada lote
 * en v_lote_pendiente.
 */
async function obtenerPartesAbiertosPorLinea(turnoId: string): Promise<Record<string, Omit<ParteAbiertoRelevo, "pendiente">>> {
  const { data, error } = await supabase
    .from("parte")
    .select(SELECT_PARTE_ABIERTO_RELEVO)
    .eq("turno_id", turnoId)
    .eq("vigente", true)
    .eq("completado", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const resultado: Record<string, Omit<ParteAbiertoRelevo, "pendiente">> = {};
  for (const fila of (data ?? []) as any[]) {
    if (resultado[fila.linea_id]) continue; // no debería haber más de uno por línea, pero por si acaso: el más reciente
    const lote = Array.isArray(fila.lote) ? fila.lote[0] : fila.lote;
    const producto = Array.isArray(lote?.producto) ? lote.producto[0] : lote?.producto;
    const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;
    const marca = Array.isArray(producto?.marca) ? producto.marca[0] : producto?.marca;
    const formato = Array.isArray(producto?.formato) ? producto.formato[0] : producto?.formato;
    resultado[fila.linea_id] = {
      id: fila.id,
      loteId: fila.lote_id,
      tono: fila.tono,
      calibre: fila.calibre,
      numeroOrden: lote?.numero_orden ?? "—",
      modeloNombre: modelo?.nombre ?? "—",
      marcaNombre: marca?.nombre ?? "—",
      formatoNombre: formato?.nombre ?? "—",
      verificacionCajaEstado: (fila.verificacion_caja_estado as EstadoVerificacionCaja | null) ?? null,
      verificacionCodbarEstado: (fila.verificacion_codbar_estado as EstadoVerificacionCodbar | null) ?? null,
    };
  }
  return resultado;
}

/**
 * Último parte completado (vigente) por línea de un turno_id ya
 * conocido. A propósito NO reutiliza obtenerSugerenciasContinuarPorLinea
 * (esa recibe un turno ACTUAL y calcula ella misma cuál es el
 * anterior por created_at) — aquí el turno anterior ya se ha resuelto
 * por fecha+tipo, pasar su id por ese otro camino encontraría el
 * turno DOS relevos atrás.
 */
async function obtenerUltimosCerradosPorLinea(turnoId: string): Promise<Record<string, Omit<UltimoCerrado, "pendiente">>> {
  const { data, error } = await supabase
    .from("parte")
    .select(
      `linea_id, lote_id, tono, calibre, piezas_entradas, completado_at,
       lote:lote_id (
         numero_orden,
         producto:producto_id ( modelo:modelo_id ( nombre ), marca:marca_id ( nombre ), formato:formato_id ( nombre ) )
       )`,
    )
    .eq("turno_id", turnoId)
    .eq("vigente", true)
    .eq("completado", true)
    .order("completado_at", { ascending: false });

  if (error) throw error;

  const resultado: Record<string, Omit<UltimoCerrado, "pendiente">> = {};
  for (const fila of (data ?? []) as any[]) {
    if (resultado[fila.linea_id]) continue; // ya vienen ordenados desc: solo el más reciente por línea
    const lote = Array.isArray(fila.lote) ? fila.lote[0] : fila.lote;
    const producto = Array.isArray(lote?.producto) ? lote.producto[0] : lote?.producto;
    const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;
    const marca = Array.isArray(producto?.marca) ? producto.marca[0] : producto?.marca;
    const formato = Array.isArray(producto?.formato) ? producto.formato[0] : producto?.formato;
    resultado[fila.linea_id] = {
      loteId: fila.lote_id,
      tono: fila.tono,
      calibre: fila.calibre,
      modeloNombre: modelo?.nombre ?? "—",
      marcaNombre: marca?.nombre ?? "—",
      formatoNombre: formato?.nombre ?? "—",
      numeroOrden: lote?.numero_orden ?? "—",
      piezasEntradas: fila.piezas_entradas ?? 0,
      completadoAt: fila.completado_at,
    };
  }
  return resultado;
}

/**
 * Incidencias de calidad de un turno, agrupadas por línea — no existía
 * en lib/incidencias.ts (esa solo indexa por parte_id, para la
 * pantalla de captura). incidencia_calidad no tiene turno_id propio,
 * solo parte_id; parte sí tiene turno_id+linea_id, de ahí el join.
 */
async function obtenerIncidenciasCalidadPorLinea(turnoId: string): Promise<Record<string, IncidenciaCalidadRelevo[]>> {
  const { data, error } = await supabase
    .from("incidencia_calidad")
    .select(
      `id, descripcion, fotos, created_at,
       parte:parte_id (
         turno_id, linea_id, tono,
         lote:lote_id ( producto:producto_id ( modelo:modelo_id ( nombre ) ) )
       )`,
    )
    .eq("parte.turno_id", turnoId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const resultado: Record<string, IncidenciaCalidadRelevo[]> = {};
  for (const fila of (data ?? []) as any[]) {
    const parte = Array.isArray(fila.parte) ? fila.parte[0] : fila.parte;
    // El filtro .eq("parte.turno_id", ...) actúa sobre el recurso
    // embebido — se re-comprueba aquí por si acaso, mismo cuidado que
    // dashboard-incidencias.ts con filtros sobre relaciones anidadas.
    if (!parte || parte.turno_id !== turnoId || !parte.linea_id) continue;
    const lote = Array.isArray(parte.lote) ? parte.lote[0] : parte.lote;
    const producto = Array.isArray(lote?.producto) ? lote.producto[0] : lote?.producto;
    const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;

    const item: IncidenciaCalidadRelevo = {
      id: fila.id,
      descripcion: fila.descripcion,
      fotos: fila.fotos,
      createdAt: fila.created_at,
      modeloNombre: modelo?.nombre ?? "—",
      tono: parte.tono,
    };
    const lista = resultado[parte.linea_id] ?? [];
    lista.push(item);
    resultado[parte.linea_id] = lista;
  }
  return resultado;
}

function conPendiente<T extends { loteId: string }>(
  mapa: Record<string, T>,
  pendientePorLote: Record<string, { m2: number | null; piezas: number | null }>,
): Record<string, T & { pendiente: PendienteLote }> {
  const resultado: Record<string, T & { pendiente: PendienteLote }> = {};
  for (const [clave, valor] of Object.entries(mapa)) {
    const p = pendientePorLote[valor.loteId];
    resultado[clave] = { ...valor, pendiente: { m2Pendiente: p?.m2 ?? null, piezasPendiente: p?.piezas ?? null } };
  }
  return resultado;
}

/**
 * Todos los datos de la Vista de Relevo, a partir de la fecha+tipo
 * del turno que le toca AHORA al responsable (fecha/tipo de
 * TurnoActual, ya calculado por quien llama con calcularTurnoActual /
 * calcularTurnoActualSuplente — no se recalcula aquí para no duplicar
 * la llamada a fn_turno_de_letra).
 */
export async function obtenerDatosRelevo(fechaActual: string, tipoActual: TipoTurno): Promise<DatosRelevo> {
  const anterior = fechaTipoAnterior(fechaActual, tipoActual);

  const { data: turnoAnteriorRow, error: errorAnterior } = await supabase
    .from("turno")
    .select("id, fecha, tipo, cerrado_at, como_cerro")
    .eq("fecha", anterior.fecha)
    .eq("tipo", anterior.tipo)
    .maybeSingle();
  if (errorAnterior) throw errorAnterior;

  // Turno anterior nunca abierto (nadie entró en la pestaña Turno en
  // esa franja) — no hay nada que relevar, no se rebusca más atrás.
  if (!turnoAnteriorRow) {
    return { turnoAnterior: null, incidenciasGenerales: [], lineas: [] };
  }

  const turnoAnteriorId = turnoAnteriorRow.id as string;
  const lineas = await listarLineas();

  const [partesAbiertosSinPendiente, ultimosCerradosSinPendiente, incidenciasCalidadPorLinea, incidenciasGenerales] = await Promise.all([
    obtenerPartesAbiertosPorLinea(turnoAnteriorId),
    obtenerUltimosCerradosPorLinea(turnoAnteriorId),
    obtenerIncidenciasCalidadPorLinea(turnoAnteriorId),
    listarIncidenciasProduccionGenerales(turnoAnteriorId),
  ]);

  // Un solo viaje a v_lote_pendiente para TODOS los lotes que
  // aparecen en el relevo (abiertos + últimos cerrados), acotado por
  // id — nunca consultar la vista entera.
  const loteIds = Array.from(
    new Set([
      ...Object.values(partesAbiertosSinPendiente).map((p) => p.loteId),
      ...Object.values(ultimosCerradosSinPendiente).map((c) => c.loteId),
    ]),
  );
  const pendientePorLote = await obtenerPendientePorLote(loteIds);

  const partesAbiertos = conPendiente(partesAbiertosSinPendiente, pendientePorLote);
  const ultimosCerrados = conPendiente(ultimosCerradosSinPendiente, pendientePorLote);

  const lineasRelevo: RelevoLinea[] = await Promise.all(
    lineas.map(async (linea) => ({
      lineaId: linea.id,
      lineaNombre: linea.nombre,
      parteAbierto: partesAbiertos[linea.id] ?? null,
      ultimoCerrado: ultimosCerrados[linea.id] ?? null,
      incidenciasProduccion: await listarIncidenciasProduccionLinea(turnoAnteriorId, linea.id),
      incidenciasCalidad: incidenciasCalidadPorLinea[linea.id] ?? [],
    })),
  );

  return {
    turnoAnterior: {
      id: turnoAnteriorId,
      fecha: turnoAnteriorRow.fecha,
      tipo: turnoAnteriorRow.tipo as TipoTurno,
      cerradoAt: turnoAnteriorRow.cerrado_at,
      comoCerro: turnoAnteriorRow.como_cerro as "manual" | "automatico" | null,
    },
    incidenciasGenerales,
    lineas: lineasRelevo,
  };
}