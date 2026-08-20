// Funciones de datos para el rol OPERARIO. Ref. 03-rol-operario.md
// 5.X ("Mi línea"), 5.2 ("Historial"), 5.9/5.9a ("Limpieza").
//
// Deliberadamente separado de lib/parte.ts (que es del flujo de
// captura del RESPONSABLE) — el operario solo lee `parte` y escribe
// en sus propias columnas *_operario (verificación) o en
// `operario_checklist` (limpieza). Nunca toca piezas/tiempos.
//
// Gamificación (puntos/niveles/ranking) queda fuera a propósito —
// pospuesta hasta que el flujo de producción esté maduro (decisión
// de sesión 19/08/2026, ver 08-pendientes.md).

import { supabase } from "./supabase-client";
import { normalizarTexto } from "./normalizacion";
import type { DatosLoteComparacion, EstadoVerificacionCaja, EstadoVerificacionCodbar } from "./parte";

// ---------------------------------------------------------------
// Mi línea (5.X)
// ---------------------------------------------------------------

/**
 * Parte activo de una línea, visto desde el OPERARIO — a diferencia
 * de ParteResumen (lib/parte.ts), incluye las columnas de
 * verificación PROPIAS del operario (*_operario), no las del
 * responsable.
 *
 * FIX (sesión 19/08/2026, primer ajuste): la primera versión
 * reutilizaba ParteResumen/obtenerPartePendiente de lib/parte.ts, que
 * solo trae verificacion_caja_estado/verificacion_codbar_estado
 * (columnas del RESPONSABLE) — "Mi línea" mostraba siempre el
 * resultado que ya había dejado el responsable, y el operario nunca
 * veía el botón "Validar" porque, para el código, ya estaba validado
 * (por otra persona). Este tipo y la consulta que lo llena traen las
 * columnas correctas.
 */
export interface ParteParaOperario {
  id: string;
  tono: string;
  calibre: string | null;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  verificacionCajaEstadoOperario: EstadoVerificacionCaja | null;
  verificacionCodbarEstadoOperario: EstadoVerificacionCodbar | null;
}

const SELECT_PARTE_PARA_OPERARIO = `id, tono, calibre, linea_id,
  verificacion_caja_estado_operario, verificacion_codbar_estado_operario,
  linea:linea_id ( nombre ),
  lote:lote_id (
    numero_orden,
    producto:producto_id (
      formato:formato_id ( nombre ),
      modelo:modelo_id ( nombre ),
      marca:marca_id ( nombre )
    )
  )`;

function mapearFilaAParteParaOperario(fila: any): ParteParaOperario {
  const lote = Array.isArray(fila.lote) ? fila.lote[0] : fila.lote;
  const producto = Array.isArray(lote?.producto) ? lote.producto[0] : lote?.producto;
  const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;
  const marca = Array.isArray(producto?.marca) ? producto.marca[0] : producto?.marca;
  const formato = Array.isArray(producto?.formato) ? producto.formato[0] : producto?.formato;

  return {
    id: fila.id,
    tono: fila.tono,
    calibre: fila.calibre,
    numeroOrden: lote?.numero_orden ?? "",
    modeloNombre: modelo?.nombre ?? "",
    marcaNombre: marca?.nombre ?? "",
    formatoNombre: formato?.nombre ?? "",
    verificacionCajaEstadoOperario: (fila.verificacion_caja_estado_operario as EstadoVerificacionCaja | null) ?? null,
    verificacionCodbarEstadoOperario: (fila.verificacion_codbar_estado_operario as EstadoVerificacionCodbar | null) ?? null,
  };
}

export interface LineaAsignadaOperario {
  lineaId: string;
  lineaNombre: string;
  /** Siempre presente: solo se listan líneas con parte pendiente propio (ver comentario de la función). */
  parte: ParteParaOperario | null;
}

/**
 * Las líneas donde el operario logueado tiene un parte PENDIENTE
 * (`completado = false`, `vigente = true`) en este turno.
 *
 * FIX (sesión 19/08/2026, segundo ajuste — fuente única del
 * operario): antes se listaban las líneas de
 * `asignacion_operario_linea` y, para cada una, se buscaba aparte el
 * parte pendiente de esa línea+turno (sin filtrar por operario) — esa
 * tabla es la que edita el responsable "en vivo" y podía divergir de
 * `parte.operario_id` si reasignaba la línea a mitad de turno (bug
 * conocido, ver `07-pendientes.md` #5). Ahora `asignacion_operario_
 * linea` NO se consulta aquí en absoluto: es solo la semilla que usa
 * el responsable para rellenar `operario_id` al crear cada parte. La
 * única fuente de "qué líneas son mías" es `parte.operario_id = yo`.
 *
 * Consecuencia: si el responsable te asigna a una línea pero todavía
 * no hay ningún parte creado en ella (turno recién abierto, entre
 * lotes), esa línea no aparece hasta que exista el primer parte con
 * tu `operario_id` — no hay un estado "asignado sin parte" que
 * representar, es la ausencia natural de resultado en la consulta.
 * Igualmente, si el responsable reasigna la línea a otro operario a
 * mitad de turno, el parte que ya tenías abierto sigue siendo tuyo
 * (no se toca retroactivamente): lo sigues viendo y pudiendo
 * verificar aquí hasta que lo completes.
 */
export async function obtenerMisLineasAsignadas(
  turnoId: string,
  operarioId: string,
): Promise<LineaAsignadaOperario[]> {
  const { data, error } = await supabase
    .from("parte")
    .select(SELECT_PARTE_PARA_OPERARIO)
    .eq("turno_id", turnoId)
    .eq("operario_id", operarioId)
    .eq("vigente", true)
    .eq("completado", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const filas = (data ?? []) as any[];
  const porLinea = new Map<string, LineaAsignadaOperario>();

  for (const fila of filas) {
    // No debería haber más de un parte pendiente por línea+turno,
    // pero si lo hubiera, nos quedamos con el más reciente (ya vienen
    // ordenados desc por created_at).
    if (porLinea.has(fila.linea_id)) continue;

    const linea = Array.isArray(fila.linea) ? fila.linea[0] : fila.linea;
    porLinea.set(fila.linea_id, {
      lineaId: fila.linea_id,
      lineaNombre: linea?.nombre ?? "—",
      parte: mapearFilaAParteParaOperario(fila),
    });
  }

  // Orden estable por nombre de línea ("Línea 1", "Línea 2"...).
  return Array.from(porLinea.values()).sort((a, b) => a.lineaNombre.localeCompare(b.lineaNombre));
}

/**
 * Reconstruye los datos de comparación (marca/modelo normalizados +
 * tono/calibre/formato) a partir de un ParteParaOperario ya cargado —
 * el mismo formato que espera evaluarVerificacionCaja (lib/
 * verificacion-caja.ts). El operario no tiene acceso al LoteResuelto
 * original (eso solo existe en memoria durante la captura del
 * responsable), así que se reconstruye desde lo ya guardado en
 * `parte`/`lote`.
 */
export function construirDatosComparacion(parte: ParteParaOperario): DatosLoteComparacion {
  return {
    formatoNombre: parte.formatoNombre,
    tono: parte.tono,
    calibre: parte.calibre ?? "",
    marcaTextoNormalizado: normalizarTexto(parte.marcaNombre),
    modeloTextoNormalizado: normalizarTexto(parte.modeloNombre),
  };
}

/**
 * Verificación de caja hecha por el OPERARIO (columnas *_operario) —
 * capa independiente y voluntaria de la que ya hace el responsable
 * (3.5). Sin opción de confirmación manual (5.X): el operario está
 * físicamente delante de la caja, así que solo hay OCR o "sin
 * verificar".
 */
export async function actualizarVerificacionCajaOperario(
  parteId: string,
  estado: EstadoVerificacionCaja,
  fotos: string[],
  detalle: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("parte")
    .update({
      verificacion_caja_estado_operario: estado,
      fotos_caja_operario: fotos,
      verificacion_caja_detalle_operario: detalle ?? null,
    })
    .eq("id", parteId);
  if (error) throw error;
}

/** Igual que la anterior, para códigos de barras (columnas *_operario). */
export async function actualizarVerificacionCodbarOperario(
  parteId: string,
  estado: EstadoVerificacionCodbar,
  detalle?: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("parte")
    .update({
      verificacion_codbar_estado_operario: estado,
      verificacion_codbar_detalle_operario: detalle ?? null,
    })
    .eq("id", parteId);
  if (error) throw error;
}

// ---------------------------------------------------------------
// Historial (5.2)
// ---------------------------------------------------------------

export interface ParteHistorialItem {
  id: string;
  modeloNombre: string;
  formatoNombre: string;
  tono: string;
  piezasEntradas: number;
  minutosTotal: number;
  completadoAt: string | null;
}

export interface LineaHistorialItem {
  lineaId: string;
  lineaNombre: string;
  partes: ParteHistorialItem[];
}

export interface TurnoHistorialItem {
  turnoId: string;
  fecha: string;
  tipo: "M" | "T" | "N";
  lineas: LineaHistorialItem[];
}

const DIAS_HISTORIAL = 15;

/**
 * Partes completados del operario en los últimos 15 días (5.2),
 * agrupados turno → línea → partes. Se trae todo lo del operario
 * ordenado por fecha y se agrupa en el cliente (mismo patrón que
 * resumen-turno.ts) — el volumen por operario/15 días es pequeño, no
 * hace falta una vista SQL para esto. Ya usaba `parte.operario_id`
 * directamente (sin pasar por `asignacion_operario_linea`), así que
 * no necesita ningún cambio con la decisión de fuente única.
 */
export async function obtenerHistorialOperario(operarioId: string): Promise<TurnoHistorialItem[]> {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - DIAS_HISTORIAL);
  const fechaLimiteStr = fechaLimite.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("parte")
    .select(
      `id, linea_id, tono, piezas_entradas, minutos_total, completado_at,
       turno:turno_id ( id, fecha, tipo ),
       linea:linea_id ( nombre ),
       lote:lote_id (
         producto:producto_id (
           modelo:modelo_id ( nombre ),
           formato:formato_id ( nombre )
         )
       )`,
    )
    .eq("operario_id", operarioId)
    .eq("vigente", true)
    .eq("completado", true)
    .order("completado_at", { ascending: false });

  if (error) throw error;

  const turnos = new Map<string, TurnoHistorialItem>();

  for (const fila of (data ?? []) as any[]) {
    const turno = Array.isArray(fila.turno) ? fila.turno[0] : fila.turno;
    if (!turno || turno.fecha < fechaLimiteStr) continue;

    const linea = Array.isArray(fila.linea) ? fila.linea[0] : fila.linea;
    const lote = Array.isArray(fila.lote) ? fila.lote[0] : fila.lote;
    const producto = Array.isArray(lote?.producto) ? lote.producto[0] : lote?.producto;
    const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;
    const formato = Array.isArray(producto?.formato) ? producto.formato[0] : producto?.formato;

    let turnoItem = turnos.get(turno.id);
    if (!turnoItem) {
      turnoItem = { turnoId: turno.id, fecha: turno.fecha, tipo: turno.tipo, lineas: [] };
      turnos.set(turno.id, turnoItem);
    }

    let lineaItem = turnoItem.lineas.find((l) => l.lineaId === fila.linea_id);
    if (!lineaItem) {
      lineaItem = { lineaId: fila.linea_id, lineaNombre: linea?.nombre ?? "—", partes: [] };
      turnoItem.lineas.push(lineaItem);
    }

    lineaItem.partes.push({
      id: fila.id,
      modeloNombre: modelo?.nombre ?? "—",
      formatoNombre: formato?.nombre ?? "—",
      tono: fila.tono,
      piezasEntradas: fila.piezas_entradas ?? 0,
      minutosTotal: fila.minutos_total ?? 0,
      completadoAt: fila.completado_at,
    });
  }

  return Array.from(turnos.values()).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

// ---------------------------------------------------------------
// Limpieza (5.9 / 5.9a)
// ---------------------------------------------------------------
// Sin relación con la asignación de línea ni con `parte.operario_id`:
// cualquier operario del turno puede limpiar cualquier línea, esté o
// no asignado a ella. No le afecta la decisión de fuente única.

export interface LineaChecklistResumen {
  lineaId: string;
  lineaNombre: string;
  hechos: number;
  total: number;
}

/**
 * Las 6 líneas de la sección, cada una con "X/6" ítems ya hechos ese
 * turno (5.9a) — cualquier operario del turno puede limpiar cualquier
 * línea, así que aquí SIEMPRE se listan las 6, no solo las asignadas.
 */
export async function obtenerLineasParaLimpieza(turnoId: string): Promise<LineaChecklistResumen[]> {
  const [{ data: lineas, error: errLineas }, { data: items, error: errItems }, { data: hechos, error: errHechos }] =
    await Promise.all([
      supabase.from("linea").select("id, nombre").order("nombre"),
      supabase.from("checklist_items").select("id").eq("activo", true),
      supabase.from("operario_checklist").select("linea_id, checklist_item_id").eq("turno_id", turnoId),
    ]);

  if (errLineas) throw errLineas;
  if (errItems) throw errItems;
  if (errHechos) throw errHechos;

  const totalItems = (items ?? []).length;
  const hechosPorLinea = new Map<string, Set<string>>();
  for (const fila of hechos ?? []) {
    const set = hechosPorLinea.get(fila.linea_id) ?? new Set<string>();
    set.add(fila.checklist_item_id);
    hechosPorLinea.set(fila.linea_id, set);
  }

  return (lineas ?? []).map((l) => ({
    lineaId: l.id,
    lineaNombre: l.nombre,
    hechos: hechosPorLinea.get(l.id)?.size ?? 0,
    total: totalItems,
  }));
}

export interface ChecklistItemEstado {
  id: string;
  nombre: string;
  puntos: number;
  hecho: boolean;
  operarioUsername: string | null;
  hora: string | null;
}

/** Detalle de los 6 ítems de una línea concreta, con quién/cuándo si ya está hecho (5.9a). */
export async function obtenerChecklistDeLinea(turnoId: string, lineaId: string): Promise<ChecklistItemEstado[]> {
  const [{ data: items, error: errItems }, { data: hechos, error: errHechos }] = await Promise.all([
    supabase.from("checklist_items").select("id, nombre, puntos").eq("activo", true).order("nombre"),
    supabase
      .from("operario_checklist")
      .select("checklist_item_id, created_at, operario:operario_id ( username )")
      .eq("turno_id", turnoId)
      .eq("linea_id", lineaId),
  ]);

  if (errItems) throw errItems;
  if (errHechos) throw errHechos;

  const hechosPorItem = new Map<string, { username: string | null; hora: string }>();
  for (const fila of (hechos ?? []) as any[]) {
    const operario = Array.isArray(fila.operario) ? fila.operario[0] : fila.operario;
    hechosPorItem.set(fila.checklist_item_id, {
      username: operario?.username ?? null,
      hora: fila.created_at,
    });
  }

  return (items ?? []).map((item) => {
    const hecho = hechosPorItem.get(item.id);
    return {
      id: item.id,
      nombre: item.nombre,
      puntos: item.puntos,
      hecho: !!hecho,
      operarioUsername: hecho?.username ?? null,
      hora: hecho?.hora ?? null,
    };
  });
}

/**
 * Error específico de carrera de concurrencia (5.9: "si otro operario
 * ya marcó el mismo ítem mientras tanto") — distinto de un error
 * genérico, para que la pantalla pueda mostrar un mensaje claro sin
 * parsear el texto de Postgres.
 */
export class ItemYaMarcadoError extends Error {
  constructor() {
    super("Este ítem ya lo ha marcado un compañero. Se actualiza la lista.");
    this.name = "ItemYaMarcadoError";
  }
}

const CODIGO_UNIQUE_VIOLATION = "23505";

/**
 * Marca un ítem de limpieza como hecho — foto de antes y después
 * obligatorias (5.9). La concurrencia la resuelve la restricción
 * UNIQUE(linea_id, turno_id, checklist_item_id) en base de datos: si
 * dos operarios llegan casi a la vez, el segundo INSERT falla y aquí
 * se traduce a ItemYaMarcadoError.
 */
export async function marcarItemChecklist(
  turnoId: string,
  lineaId: string,
  checklistItemId: string,
  operarioId: string,
  fotosAntes: string[],
  fotosDespues: string[],
): Promise<void> {
  const { error } = await supabase.from("operario_checklist").insert({
    turno_id: turnoId,
    linea_id: lineaId,
    checklist_item_id: checklistItemId,
    operario_id: operarioId,
    fotos_antes: fotosAntes,
    fotos_despues: fotosDespues,
  });

  if (error) {
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      throw new ItemYaMarcadoError();
    }
    throw error;
  }
}