// Tipos y funciones del flujo de captura de `parte`, camino 3 (nuevo
// lote). Ref. 01-rol-responsable.md 3.2, 05-modelo-de-datos.md 7.1/7.4.
//
// Rediseño de sesión: el `parte` se crea INMEDIATAMENTE al resolver
// el lote (Foto 1), con piezas/tiempos a 0 y completado=false — no al
// final del wizard. Así el responsable puede dejarlo a medias (lote
// preparado, pendiente de producción real) y retomarlo más tarde
// desde la tarjeta de la línea. Foto 2 y Foto 3 pasan a ser UPDATEs
// sobre esa fila, no pasos obligatorios de un único INSERT final.

import { supabase } from "./supabase-client";

/** JSON que devuelve ocr-parte para foto_tipo="hoja_partida" (prompts.ts). */
export interface DatosOcrHojaPartida {
  modelo: string;
  marca: string;
  formato: string;
  acabado_codigo: string | null;
  acabado_tipo: string | null;
  acabado_nombre: string | null;
  espesor_mm: number | null;
  tono_ant: string | null;
  calibre: string | null;
  numero_orden: string;
  tipo_palet: string | null;
  pza_caja: number | null;
  /** Texto tal cual impreso en CTDAD — se parsea en el cliente, ver parsearNumeroEspanol. */
  objetivo_m2_texto: string | null;
  codbar_caja: string | null;
  codbar_pieza: string | null;
  cod_upec: string | null;
  codbar_saso: string | null;
  observaciones_material: string | null;
  observaciones_orden: string | null;
  confianza: "alta" | "media" | "baja";
}

/** Lo que necesitan Foto 2/3 para seguir el wizard sin volver a Supabase. */
export interface LoteResuelto {
  loteId: string;
  productoId: string;
  modeloId: string;
  marcaId: string;
  loteCreado: boolean;
  loteReabierto: boolean;
  formatoNombre: string;
  numeroOrden: string;
  tono: string;
  calibre: string;
  marcaTextoNormalizado: string;
  modeloTextoNormalizado: string;
  fotoHojaPartidaUrl: string;
}
/**
 * Subconjunto de LoteResuelto necesario para comparar contra la Foto 2
 * (caja) — permite reconstruirlo al retomar un parte pendiente, sin
 * tener el LoteResuelto completo que solo genera la Foto 1.
 */
export interface DatosLoteComparacion {
  formatoNombre: string;
  tono: string;
  calibre: string;
  marcaTextoNormalizado: string;
  modeloTextoNormalizado: string;
}

/** JSON que devuelve ocr-parte para foto_tipo="caja" (prompts.ts). */
export interface DatosOcrCaja {
  marca: string | null;
  modelo: string | null;
  tono: string | null;
  calibre: string | null;
  confianza_marca: "alta" | "media" | "baja";
  confianza_modelo: "alta" | "media" | "baja";
  confianza_tono: "alta" | "media" | "baja";
  confianza_calibre: "alta" | "media" | "baja";
}

/**
 * Estado guardado en `parte.verificacion_caja_estado`. Los tres
 * primeros vienen de comparar la Foto 2 vía OCR (lib/verificacion-
 * caja.ts); "verificado_manual" viene del checkbox cuando el
 * responsable confirma a mano, sin foto — se distinguen porque no es
 * lo mismo un fallo humano que uno de lectura OCR.
 */
export type EstadoVerificacionCaja = "correcto" | "incorrecto" | "no_verificable" | "verificado_manual";

/** JSON que devuelve ocr-parte para foto_tipo="pantalla" (prompts.ts). */
export interface DatosOcrPantalla {
  piezas_1a: number;
  piezas_comercial: number;
  piezas_eco: number;
  piezas_descuadre_com: number;
  piezas_planar_com: number;
  piezas_contenedor: number;
  cal_1: number;
  cal_2: number;
  cal_3: number;
  cal_4: number;
  cal_5: number;
  cal_6: number;
  cal_7: number;
  cal_8: number;
  piezas_entradas: number;
  minutos_total: number;
  minutos_plena: number;
  minutos_no_alimentada: number;
  minutos_saturacion: number;
  minutos_banco: number;
  minutos_maquina: number;
  hora_captura_pantalla: string | null;
  confianza: "alta" | "media" | "baja";
}

/** Resumen de un parte pendiente, para la tarjeta de línea. */
export interface ParteResumen {
  id: string;
  tono: string;
  calibre: string | null;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  verificacionCajaEstado: EstadoVerificacionCaja | null;
  verificacionCodbarEstado: EstadoVerificacionCodbar | null;
  completado: boolean;
}

/** Reutilizado por obtenerPartePendiente y obtenerPartesPendientesPorLinea. */
function mapearFilaAParteResumen(fila: any): ParteResumen {
  // Supabase a veces devuelve las relaciones anidadas como array en
  // vez de objeto según la versión — se normaliza por si acaso.
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
    verificacionCajaEstado: (fila.verificacion_caja_estado as EstadoVerificacionCaja | null) ?? null,
    verificacionCodbarEstado: (fila.verificacion_codbar_estado as EstadoVerificacionCodbar | null) ?? null,
    completado: fila.completado,
  };
}

const SELECT_PARTE_RESUMEN = `id, linea_id, tono, calibre, verificacion_caja_estado, verificacion_codbar_estado, completado, created_at,
  lote:lote_id (
    numero_orden,
    producto:producto_id (
      formato:formato_id ( nombre ),
      modelo:modelo_id ( nombre ),
      marca:marca_id ( nombre )
    )
  )`;

/**
 * Crea el `parte` justo al resolver el lote (Foto 1) — piezas/minutos
 * a 0 provisionalmente, completado=false.
 */
export async function crearParteInicial(
  turnoId: string,
  lineaId: string,
  responsableId: string,
  lote: LoteResuelto,
): Promise<{ id: string }> {
  const { data: asignacion, error: asignacionError } = await supabase
    .from("asignacion_operario_linea")
    .select("operario_id")
    .eq("turno_id", turnoId)
    .eq("linea_id", lineaId)
    .maybeSingle();
  if (asignacionError) throw asignacionError;

  const { data, error } = await supabase
    .from("parte")
    .insert({
      turno_id: turnoId,
      linea_id: lineaId,
      lote_id: lote.loteId,
      responsable_id: responsableId,
      operario_id: asignacion?.operario_id ?? null,
      tono: lote.tono,
      calibre: lote.calibre || null,
      piezas_1a: 0,
      piezas_comercial: 0,
      piezas_eco: 0,
      piezas_descuadre_com: 0,
      piezas_planar_com: 0,
      piezas_contenedor: 0,
      piezas_entradas: 0,
      minutos_total: 0,
      minutos_plena: 0,
      minutos_no_alimentada: 0,
      minutos_saturacion: 0,
      minutos_banco: 0,
      minutos_maquina: 0,
      completado: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

/** Foto 2 (OCR) o checkbox manual — ambos caminos escriben aquí. */
export async function actualizarVerificacionCaja(
  parteId: string,
  estado: EstadoVerificacionCaja,
  fotos?: string[],
  detalle?: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("parte")
    .update({
      verificacion_caja_estado: estado,
      fotos_caja: fotos ?? null,
      verificacion_caja_detalle: detalle ?? null,
    })
    .eq("id", parteId);
  if (error) throw error;
}

/** Subconjunto de LoteCompleto con los 4 campos de código de barras (3.8). */
export interface CodigosBarrasLote {
  codbarCaja: string | null;
  codbarPieza: string | null;
  codUpec: string | null;
  codbarSaso: string | null;
}

/** Códigos de barras esperados del lote de este parte, para la pantalla de escaneo (3.8). */
export async function obtenerCodigosBarrasParaParte(parteId: string): Promise<CodigosBarrasLote> {
  const { data, error } = await supabase
    .from("parte")
    .select("lote:lote_id ( codbar_caja, codbar_pieza, cod_upec, codbar_saso )")
    .eq("id", parteId)
    .single();
  if (error) throw error;
  const lote = Array.isArray(data.lote) ? data.lote[0] : data.lote;
  return {
    codbarCaja: lote?.codbar_caja ?? null,
    codbarPieza: lote?.codbar_pieza ?? null,
    codUpec: lote?.cod_upec ?? null,
    codbarSaso: lote?.codbar_saso ?? null,
  };
}

/** Guardado en parte.verificacion_codbar_estado — ver migración 20260818100000. */
export type EstadoVerificacionCodbar = "completo" | "parcial" | "manual" | "no_realizada";

/** Pantalla de escaneo de códigos de barras (3.8) — escáner o manual, ambos escriben aquí. */
export async function actualizarVerificacionCodbar(
  parteId: string,
  estado: EstadoVerificacionCodbar,
  detalle?: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("parte")
    .update({
      verificacion_codbar_estado: estado,
      verificacion_codbar_detalle: detalle ?? null,
    })
    .eq("id", parteId);
  if (error) throw error;
}

export interface CompletarParteInput {
  parteId: string;
  datosPantalla: DatosOcrPantalla;
  horaCapturaPantallaIso: string | null;
  horaCapturaPantallaTextoCrudo: string | null;
  calibreComPct: number | null;
  calibreStdPct: number | null;
}

/** Foto 3 confirmada — rellena piezas/tiempos reales y cierra el parte. */
export async function completarParte(input: CompletarParteInput): Promise<void> {
  const { parteId, datosPantalla, horaCapturaPantallaIso, horaCapturaPantallaTextoCrudo, calibreComPct } = input;

  const { error } = await supabase
    .from("parte")
    .update({
      piezas_1a: datosPantalla.piezas_1a,
      piezas_comercial: datosPantalla.piezas_comercial,
      piezas_eco: datosPantalla.piezas_eco,
      piezas_descuadre_com: datosPantalla.piezas_descuadre_com,
      piezas_planar_com: datosPantalla.piezas_planar_com,
      piezas_contenedor: datosPantalla.piezas_contenedor,
      piezas_entradas: datosPantalla.piezas_entradas,
      cal_1: datosPantalla.cal_1,
      cal_2: datosPantalla.cal_2,
      cal_3: datosPantalla.cal_3,
      cal_4: datosPantalla.cal_4,
      cal_5: datosPantalla.cal_5,
      cal_6: datosPantalla.cal_6,
      cal_7: datosPantalla.cal_7,
      cal_8: datosPantalla.cal_8,
      minutos_total: datosPantalla.minutos_total,
      minutos_plena: datosPantalla.minutos_plena,
      minutos_no_alimentada: datosPantalla.minutos_no_alimentada,
      minutos_saturacion: datosPantalla.minutos_saturacion,
      minutos_banco: datosPantalla.minutos_banco,
      minutos_maquina: datosPantalla.minutos_maquina,
      hora_captura_pantalla: horaCapturaPantallaIso,
      hora_captura_pantalla_texto_crudo: horaCapturaPantallaTextoCrudo,
      calibre_com_pct: calibreComPct,
      completado: true,
      completado_at: new Date().toISOString(),
    })
    .eq("id", parteId);

  if (error) throw error;
}

/**
 * Cierra un parte pendiente sin producción real (lote cancelado/
 * movido de línea, o línea equivocada por error) — piezas/minutos se
 * quedan como estaban. Sin borrado, igual de auditable que el resto
 * de la app.
 */
export async function cerrarSinProduccion(parteId: string): Promise<void> {
  const { error } = await supabase.from("parte").update({ completado: true, completado_at: new Date().toISOString() }).eq("id", parteId);
  if (error) throw error;
}

/**
 * Parte pendiente (completado=false, vigente) para esta línea+turno,
 * si existe — para que la tarjeta de línea muestre "Continuar parte"
 * en vez de "Nuevo lote".
 */
export async function obtenerPartePendiente(turnoId: string, lineaId: string): Promise<ParteResumen | null> {
  const { data, error } = await supabase
    .from("parte")
    .select(SELECT_PARTE_RESUMEN)
    .eq("turno_id", turnoId)
    .eq("linea_id", lineaId)
    .eq("vigente", true)
    .eq("completado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapearFilaAParteResumen(data);
}

/**
 * Partes pendientes (completado=false, vigente) de TODAS las líneas
 * de un turno, en una sola consulta — para pintar el resumen en cada
 * tarjeta de línea de TurnoScreen sin hacer 6 llamadas.
 */
export async function obtenerPartesPendientesPorLinea(turnoId: string): Promise<Record<string, ParteResumen>> {
  const { data, error } = await supabase
    .from("parte")
    .select(SELECT_PARTE_RESUMEN)
    .eq("turno_id", turnoId)
    .eq("vigente", true)
    .eq("completado", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const resultado: Record<string, ParteResumen> = {};
  for (const fila of data ?? []) {
    // Si hubiera más de uno por línea (no debería, la UI lo evita),
    // nos quedamos con el más reciente — ya vienen ordenados.
    if (!resultado[fila.linea_id]) {
      resultado[fila.linea_id] = mapearFilaAParteResumen(fila);
    }
  }
  return resultado;
}
/** Detalle completo de un parte ya cerrado, para la vista de revisión/corrección. */
export interface ParteDetalle {
  id: string;
  turnoId: string;
  lineaId: string;
  loteId: string;
  responsableId: string;
  tono: string;
  calibre: string | null;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  verificacionCajaEstado: EstadoVerificacionCaja | null;
  piezas1a: number;
  piezasComercial: number;
  piezasEco: number;
  piezasDescuadreCom: number;
  piezasPlanarCom: number;
  piezasContenedor: number;
  piezasEntradas: number;
  cal1: number;
  cal2: number;
  cal3: number;
  cal4: number;
  cal5: number;
  cal6: number;
  cal7: number;
  cal8: number;
  minutosTotal: number;
  minutosPlena: number;
  minutosNoAlimentada: number;
  minutosSaturacion: number;
  minutosBanco: number;
  minutosMaquina: number;
  horaCapturaPantalla: string | null;
  completadoAt: string | null;
  dentroDeVentanaCorreccion: boolean;
}

const SELECT_PARTE_DETALLE = `id, turno_id, linea_id, lote_id, responsable_id, tono, calibre, verificacion_caja_estado, completado_at,
  piezas_1a, piezas_comercial, piezas_eco, piezas_descuadre_com, piezas_planar_com, piezas_contenedor, piezas_entradas,
  cal_1, cal_2, cal_3, cal_4, cal_5, cal_6, cal_7, cal_8,
  minutos_total, minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
  hora_captura_pantalla,
  lote:lote_id (
    numero_orden,
    producto:producto_id ( modelo:modelo_id ( nombre ), marca:marca_id ( nombre ), formato:formato_id ( nombre ) )
  )`;

const VENTANA_CORRECCION_MS = 60 * 60 * 1000;

function mapearFilaAParteDetalle(fila: any): ParteDetalle {
  const lote = Array.isArray(fila.lote) ? fila.lote[0] : fila.lote;
  const producto = Array.isArray(lote?.producto) ? lote.producto[0] : lote?.producto;
  const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;
  const marca = Array.isArray(producto?.marca) ? producto.marca[0] : producto?.marca;
  const formato = Array.isArray(producto?.formato) ? producto.formato[0] : producto?.formato;

  const dentroDeVentana = fila.completado_at
    ? Date.now() - new Date(fila.completado_at).getTime() < VENTANA_CORRECCION_MS
    : false;

  return {
    id: fila.id,
    turnoId: fila.turno_id,
    lineaId: fila.linea_id,
    loteId: fila.lote_id,
    responsableId: fila.responsable_id,
    tono: fila.tono,
    calibre: fila.calibre,
    numeroOrden: lote?.numero_orden ?? "",
    modeloNombre: modelo?.nombre ?? "",
    marcaNombre: marca?.nombre ?? "",
    formatoNombre: formato?.nombre ?? "",
    verificacionCajaEstado: (fila.verificacion_caja_estado as EstadoVerificacionCaja | null) ?? null,
    piezas1a: fila.piezas_1a,
    piezasComercial: fila.piezas_comercial,
    piezasEco: fila.piezas_eco,
    piezasDescuadreCom: fila.piezas_descuadre_com,
    piezasPlanarCom: fila.piezas_planar_com,
    piezasContenedor: fila.piezas_contenedor,
    piezasEntradas: fila.piezas_entradas,
    cal1: fila.cal_1,
    cal2: fila.cal_2,
    cal3: fila.cal_3,
    cal4: fila.cal_4,
    cal5: fila.cal_5,
    cal6: fila.cal_6,
    cal7: fila.cal_7,
    cal8: fila.cal_8,
    minutosTotal: fila.minutos_total,
    minutosPlena: fila.minutos_plena,
    minutosNoAlimentada: fila.minutos_no_alimentada,
    minutosSaturacion: fila.minutos_saturacion,
    minutosBanco: fila.minutos_banco,
    minutosMaquina: fila.minutos_maquina,
    horaCapturaPantalla: fila.hora_captura_pantalla,
    completadoAt: fila.completado_at,
    dentroDeVentanaCorreccion: dentroDeVentana,
  };
}

/** Partes ya cerrados hoy (vigente=true, completado=true) de una línea+turno, más recientes primero. */
export async function obtenerPartesCompletadosHoy(turnoId: string, lineaId: string): Promise<ParteDetalle[]> {
  const { data, error } = await supabase
    .from("parte")
    .select(SELECT_PARTE_DETALLE)
    .eq("turno_id", turnoId)
    .eq("linea_id", lineaId)
    .eq("vigente", true)
    .eq("completado", true)
    .order("completado_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapearFilaAParteDetalle);
}

export interface DatosCorreccionParte {
  tono: string;
  calibre: string | null;
  verificacionCajaEstado: EstadoVerificacionCaja | null;
  piezas1a: number;
  piezasComercial: number;
  piezasEco: number;
  piezasDescuadreCom: number;
  piezasPlanarCom: number;
  piezasContenedor: number;
  piezasEntradas: number;
  cal1: number;
  cal2: number;
  cal3: number;
  cal4: number;
  cal5: number;
  cal6: number;
  cal7: number;
  cal8: number;
  minutosTotal: number;
  minutosPlena: number;
  minutosNoAlimentada: number;
  minutosSaturacion: number;
  minutosBanco: number;
  minutosMaquina: number;
  horaCapturaPantallaIso: string | null;
  horaCapturaPantallaTextoCrudo: string | null;
  calibreComPct: number | null;
}

export async function corregirParte(
  parteOriginalId: string,
  contexto: { turnoId: string; lineaId: string; loteId: string; responsableId: string },
  datos: DatosCorreccionParte,
): Promise<{ id: string }> {
  const { data: nuevo, error: errorInsert } = await supabase
    .from("parte")
    .insert({
      turno_id: contexto.turnoId,
      linea_id: contexto.lineaId,
      lote_id: contexto.loteId,
      responsable_id: contexto.responsableId,
      corrige_a_parte_id: parteOriginalId,
      vigente: true,
      completado: true,
      completado_at: new Date().toISOString(),
      tono: datos.tono,
      calibre: datos.calibre,
      verificacion_caja_estado: datos.verificacionCajaEstado,
      piezas_1a: datos.piezas1a,
      piezas_comercial: datos.piezasComercial,
      piezas_eco: datos.piezasEco,
      piezas_descuadre_com: datos.piezasDescuadreCom,
      piezas_planar_com: datos.piezasPlanarCom,
      piezas_contenedor: datos.piezasContenedor,
      piezas_entradas: datos.piezasEntradas,
      cal_1: datos.cal1,
      cal_2: datos.cal2,
      cal_3: datos.cal3,
      cal_4: datos.cal4,
      cal_5: datos.cal5,
      cal_6: datos.cal6,
      cal_7: datos.cal7,
      cal_8: datos.cal8,
      minutos_total: datos.minutosTotal,
      minutos_plena: datos.minutosPlena,
      minutos_no_alimentada: datos.minutosNoAlimentada,
      minutos_saturacion: datos.minutosSaturacion,
      minutos_banco: datos.minutosBanco,
      minutos_maquina: datos.minutosMaquina,
      hora_captura_pantalla: datos.horaCapturaPantallaIso,
      hora_captura_pantalla_texto_crudo: datos.horaCapturaPantallaTextoCrudo,
      calibre_com_pct: datos.calibreComPct,
    })
    .select("id")
    .single();

  if (errorInsert) throw errorInsert;

  // NO se hace un UPDATE manual de vigente=false aquí: el trigger
  // trg_parte_corregir (fn_marcar_corregido_no_vigente, 0004_core.sql)
  // ya lo hace automáticamente al insertar. Repetirlo a mano era
  // redundante — y, además, engañoso: esa función NO es
  // `security definer`, corre con los permisos de quien llama, así
  // que está sujeta a las mismas políticas RLS que un UPDATE manual
  // (responsable_id = auth.uid() y dentro de la ventana de 1h). Si
  // algún día esta función se llama fuera de esas condiciones (ej.
  // un futuro panel de administrador corrigiendo el parte de otro
  // responsable), NI el trigger NI el UPDATE manual podrían marcar el
  // original — y PostgREST no da error cuando un UPDATE no afecta
  // ninguna fila por RLS, así que el `if (errorUpdate)` de antes
  // nunca lo habría detectado. Se verifica aquí de verdad, leyendo el
  // resultado en vez de confiar en que un segundo UPDATE lo repare.
  const { data: verificacion, error: errorVerificacion } = await supabase
    .from("parte")
    .select("vigente")
    .eq("id", parteOriginalId)
    .single();

  if (errorVerificacion) {
    throw new Error(
      `Se creó el parte corregido (${nuevo.id}) pero no se pudo comprobar si el original quedó marcado como no vigente: ${errorVerificacion.message}. Revísalo a mano.`,
    );
  }
  if (verificacion?.vigente) {
    throw new Error(
      `Se creó el parte corregido (${nuevo.id}) pero el original (${parteOriginalId}) sigue marcado como vigente — ` +
        `probablemente no tienes permiso para corregir ese parte (no eres su responsable, o ya pasó la ventana de 1h). ` +
        `Ahora mismo hay DOS partes vigentes para el mismo tramo: revísalo con el administrador.`,
    );
  }

  return nuevo as { id: string };
}
/** Cuántos partes completados hoy tiene cada línea de este turno — para el botón "Ver partes de hoy (N)". */
export async function contarPartesCompletadosPorLinea(turnoId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("parte")
    .select("linea_id")
    .eq("turno_id", turnoId)
    .eq("vigente", true)
    .eq("completado", true);

  if (error) throw error;

  const resultado: Record<string, number> = {};
  for (const fila of data ?? []) {
    resultado[fila.linea_id] = (resultado[fila.linea_id] ?? 0) + 1;
  }
  return resultado;
}
/** Todos los campos de `lote` + nombres de modelo/marca/formato, para la pantalla de "nuevo tono, mismo lote". */
export interface LoteCompleto {
  loteId: string;
  productoId: string;
  modeloId: string;
  marcaId: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  numeroOrden: string;
  acabadoCodigo: string | null;
  acabadoTipo: string | null;
  acabadoNombre: string | null;
  espesor: string | null;
  tipoPalet: string | null;
  pzaCaja: number | null;
  objetivoM2: number | null;
  codbarCaja: string | null;
  codbarPieza: string | null;
  codUpec: string | null;
  codbarSaso: string | null;
  observacionesMaterial: string | null;
  observacionesOrden: string | null;
}

/** Datos del lote de un parte de origen, para precargar la pantalla de "nuevo tono, mismo lote". */
export async function obtenerLoteCompleto(loteId: string): Promise<LoteCompleto> {
  const { data, error } = await supabase
    .from("lote")
    .select(
      `id, producto_id, numero_orden, acabado_codigo, acabado_tipo, acabado_nombre, espesor,
       tipo_palet, pza_caja, objetivo_m2, codbar_caja, codbar_pieza, cod_upec, codbar_saso,
       observaciones_material, observaciones_orden,
       producto:producto_id (
         formato:formato_id ( nombre ),
         modelo:modelo_id ( id, nombre ),
         marca:marca_id ( id, nombre )
       )`,
    )
    .eq("id", loteId)
    .single();

  if (error) throw error;

  const producto = Array.isArray(data.producto) ? data.producto[0] : data.producto;
  const modelo = Array.isArray(producto?.modelo) ? producto.modelo[0] : producto?.modelo;
  const marca = Array.isArray(producto?.marca) ? producto.marca[0] : producto?.marca;
  const formato = Array.isArray(producto?.formato) ? producto.formato[0] : producto?.formato;

  return {
    loteId: data.id,
    productoId: data.producto_id,
    modeloId: modelo?.id ?? "",
    marcaId: marca?.id ?? "",
    modeloNombre: modelo?.nombre ?? "",
    marcaNombre: marca?.nombre ?? "",
    formatoNombre: formato?.nombre ?? "",
    numeroOrden: data.numero_orden,
    acabadoCodigo: data.acabado_codigo,
    acabadoTipo: data.acabado_tipo,
    acabadoNombre: data.acabado_nombre,
    espesor: data.espesor,
    tipoPalet: data.tipo_palet,
    pzaCaja: data.pza_caja,
    objetivoM2: data.objetivo_m2,
    codbarCaja: data.codbar_caja,
    codbarPieza: data.codbar_pieza,
    codUpec: data.cod_upec,
    codbarSaso: data.codbar_saso,
    observacionesMaterial: data.observaciones_material,
    observacionesOrden: data.observaciones_orden,
  };
}
/** Detalle de un parte por su id directamente — para "Ver-editar" desde la lista desplegada. */
export async function obtenerParteDetalle(parteId: string): Promise<ParteDetalle> {
  const { data, error } = await supabase.from("parte").select(SELECT_PARTE_DETALLE).eq("id", parteId).single();
  if (error) throw error;
  return mapearFilaAParteDetalle(data);
}
export interface SugerenciaContinuar {
  loteId: string;
  tono: string;
  calibre: string | null;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  numeroOrden: string;
}

/**
 * "Continuar mismo lote+tono" (01-rol-responsable.md 3.1/3.2): solo
 * mira el turno INMEDIATAMENTE anterior de esta línea — si ese turno
 * no tiene nada, no hay sugerencia (decisión de sesión: no rebuscar
 * "lo último que sea", para no sugerir algo de hace días que ya no
 * esté activo).
 */
export async function obtenerSugerenciasContinuarPorLinea(
  turnoActualId: string,
): Promise<Record<string, SugerenciaContinuar>> {
  const { data: turnoActual, error: errorTurnoActual } = await supabase
    .from("turno")
    .select("created_at")
    .eq("id", turnoActualId)
    .single();
  if (errorTurnoActual) throw errorTurnoActual;

  const { data: turnoAnterior, error: errorAnterior } = await supabase
    .from("turno")
    .select("id")
    .lt("created_at", turnoActual.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorAnterior) throw errorAnterior;
  if (!turnoAnterior) return {};

  const { data, error } = await supabase
    .from("parte")
    .select(SELECT_PARTE_DETALLE)
    .eq("turno_id", turnoAnterior.id)
    .eq("vigente", true)
    .eq("completado", true)
    .order("completado_at", { ascending: false });
  if (error) throw error;

  const resultado: Record<string, SugerenciaContinuar> = {};
  for (const fila of data ?? []) {
    if (resultado[fila.linea_id]) continue;
    const detalle = mapearFilaAParteDetalle(fila);
    resultado[fila.linea_id] = {
      loteId: detalle.loteId,
      tono: detalle.tono,
      calibre: detalle.calibre,
      modeloNombre: detalle.modeloNombre,
      marcaNombre: detalle.marcaNombre,
      formatoNombre: detalle.formatoNombre,
      numeroOrden: detalle.numeroOrden,
    };
  }
  return resultado;
}