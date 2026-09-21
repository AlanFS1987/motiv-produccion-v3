// Recogida y agregación de datos de los informes DIARIO y SEMANAL.
// Ver pdf-informe-periodo.ts para la maquetación.
//
// Convención de fechas (la misma que el resto del proyecto): la
// `fecha` de un turno es el día en que EMPIEZA. Para el turno de
// noche eso significa que el N del día D termina a las 06:00 del D+1.
// Por eso:
//   - Informe DIARIO de D = turnos M, T y N con `fecha = D`.
//   - Informe SEMANAL que empieza el lunes L = turnos con fecha entre
//     L y L+6 (M del lunes … N del domingo, que acaba el lunes a las
//     06:00). 21 turnos.
//
// Criterio de partes: idéntico al informe de turno
// (generar-resumen-turno): solo `vigente`, `completado` y con
// `piezas_entradas > 0`. Así los números de los tres informes cuadran.
//
// Está partido en dos capas a propósito:
//   - cargarFilasPeriodo: consultas a Supabase (todo el I/O).
//   - construirDatosInformePeriodo: función PURA (filas → datos del
//     PDF), fácil de probar sin base de datos.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { m2DePiezas } from "./formato.ts";
import type {
  AcumuladoPeriodoPdf,
  DatosInformePeriodoPdf,
  FilaDesglosePdf,
  IncidenciaPeriodoPdf,
  LotePeriodoPdf,
  TiempoRegistroPdf,
  TipoInformePeriodo,
  TipoTurnoLetra,
} from "./pdf-informe-periodo.ts";

// ---------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------

export function sumarDiasISO(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Todas las fechas entre desde y hasta, ambas incluidas. */
export function listarFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDiasISO(f, 1)) fechas.push(f);
  return fechas;
}

/**
 * Valida `desde` y devuelve la ventana [desde, hasta] de fechas de turno.
 * Diario: un solo día. Semanal: 7 días y `desde` debe ser lunes.
 */
export function calcularVentana(tipo: TipoInformePeriodo, desde: string): { desde: string; hasta: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    throw new Error("`desde` debe tener formato AAAA-MM-DD");
  }
  const [y, m, d] = desde.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.toISOString().slice(0, 10) !== desde) {
    throw new Error(`Fecha no válida: ${desde}`);
  }
  if (tipo === "diario") return { desde, hasta: desde };
  if (f.getUTCDay() !== 1) {
    throw new Error(`El informe semanal debe empezar en lunes, y ${desde} no lo es`);
  }
  return { desde, hasta: sumarDiasISO(desde, 6) };
}

function fechaCorta(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

// ---------------------------------------------------------------
// Filas crudas (lo que devuelve la base de datos, ya aplanado)
// ---------------------------------------------------------------

export interface FilaTurno {
  id: string;
  fecha: string;
  tipo: TipoTurnoLetra;
  cerrado_at: string | null;
  responsable_username: string | null;
}

export interface FilaLinea {
  id: string;
  nombre: string;
}

export interface FilaParte {
  id: string;
  turno_id: string;
  linea_id: string;
  lote_id: string;
  tono: string;
  calibre: string | null;
  piezas_1a: number;
  piezas_comercial: number;
  piezas_contenedor: number;
  minutos_plena: number;
  minutos_no_alimentada: number;
  minutos_saturacion: number;
  minutos_banco: number;
  minutos_maquina: number;
  numero_orden: string;
  modelo_nombre: string | null;
  formato_nombre: string | null;
}

export interface FilaIncidenciaCalidad {
  parte_id: string;
  descripcion: string;
  fotos: string[] | null;
}

export interface FilaIncidenciaProduccion {
  turno_id: string;
  linea_id: string | null;
  descripcion: string;
  fotos: string[] | null;
}

export interface FilasPeriodo {
  turnos: FilaTurno[];
  lineas: FilaLinea[];
  partes: FilaParte[];
  incidenciasCalidad: FilaIncidenciaCalidad[];
  incidenciasProduccion: FilaIncidenciaProduccion[];
}

// ---------------------------------------------------------------
// Capa I/O
// ---------------------------------------------------------------

// PostgREST corta las respuestas en 1000 filas por petición.
const TAM_PAGINA = 1000;
// Las cláusulas `in (...)` van en la URL: se trocean para no pasarse
// de longitud con cientos de UUID (una semana puede tener 300+ partes).
const TAM_TROZO_IN = 80;

/** Supabase a veces devuelve una relación anidada como array de 1, a veces como objeto. */
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function trocear<T>(lista: T[], tamano: number): T[][] {
  const trozos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) trozos.push(lista.slice(i, i + tamano));
  return trozos;
}

// Tope de seguridad: si por algún motivo el servidor ignorase la paginación
// y devolviera siempre páginas llenas, esto cortaría en vez de girar sin fin.
const MAX_PAGINAS = 100;

// deno-lint-ignore no-explicit-any
async function leerTodo<T>(construir: () => any): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    if (pagina >= MAX_PAGINAS) {
      throw new Error(`Más de ${MAX_PAGINAS * TAM_PAGINA} filas en una consulta del informe: se aborta`);
    }
    const desde = pagina * TAM_PAGINA;
    const { data, error } = await construir().range(desde, desde + TAM_PAGINA - 1);
    if (error) throw error;
    const bloque = (data ?? []) as T[];
    todas.push(...bloque);
    if (bloque.length < TAM_PAGINA) break;
  }
  return todas;
}

export async function cargarFilasPeriodo(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
): Promise<FilasPeriodo> {
  // 1) Turnos de la ventana + responsable que abrió cada uno.
  const { data: turnosRaw, error: turnosErr } = await supabase
    .from("turno")
    .select("id, fecha, tipo, cerrado_at, responsable:abierto_por ( username )")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("tipo");
  if (turnosErr) throw turnosErr;
  // deno-lint-ignore no-explicit-any
  const turnos: FilaTurno[] = (turnosRaw ?? []).map((t: any) => ({
    id: t.id,
    fecha: t.fecha,
    tipo: t.tipo,
    cerrado_at: t.cerrado_at ?? null,
    responsable_username: uno<{ username: string }>(t.responsable)?.username ?? null,
  }));

  // 2) Las líneas fijas, siempre en el mismo orden.
  const { data: lineasRaw, error: lineasErr } = await supabase.from("linea").select("id, nombre").order("nombre");
  if (lineasErr) throw lineasErr;
  const lineas = (lineasRaw ?? []) as FilaLinea[];

  if (turnos.length === 0) {
    return { turnos, lineas, partes: [], incidenciasCalidad: [], incidenciasProduccion: [] };
  }
  const turnoIds = turnos.map((t) => t.id);

  // 3) Partes vigentes con producción real, de todos esos turnos.
  // deno-lint-ignore no-explicit-any
  const partesRaw = await leerTodo<any>(() =>
    supabase
      .from("parte")
      .select(
        `id, turno_id, linea_id, lote_id, tono, calibre,
         piezas_1a, piezas_comercial, piezas_contenedor,
         minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
         lote:lote_id (
           numero_orden,
           producto:producto_id (
             modelo:modelo_id ( nombre ),
             formato:formato_id ( nombre )
           )
         )`,
      )
      .in("turno_id", turnoIds)
      .eq("vigente", true)
      .eq("completado", true)
      .gt("piezas_entradas", 0)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
  );
  const partes: FilaParte[] = partesRaw.map((p) => {
    // deno-lint-ignore no-explicit-any
    const lote = uno<any>(p.lote);
    // deno-lint-ignore no-explicit-any
    const producto = uno<any>(lote?.producto);
    return {
      id: p.id,
      turno_id: p.turno_id,
      linea_id: p.linea_id,
      lote_id: p.lote_id,
      tono: p.tono,
      calibre: p.calibre ?? null,
      piezas_1a: p.piezas_1a ?? 0,
      piezas_comercial: p.piezas_comercial ?? 0,
      piezas_contenedor: p.piezas_contenedor ?? 0,
      minutos_plena: p.minutos_plena ?? 0,
      minutos_no_alimentada: p.minutos_no_alimentada ?? 0,
      minutos_saturacion: p.minutos_saturacion ?? 0,
      minutos_banco: p.minutos_banco ?? 0,
      minutos_maquina: p.minutos_maquina ?? 0,
      numero_orden: lote?.numero_orden ?? "—",
      modelo_nombre: uno<{ nombre: string }>(producto?.modelo)?.nombre ?? null,
      formato_nombre: uno<{ nombre: string }>(producto?.formato)?.nombre ?? null,
    };
  });

  // 4) Incidencias de calidad de esos partes (en trozos, ver TAM_TROZO_IN).
  const incidenciasCalidad: FilaIncidenciaCalidad[] = [];
  for (const trozo of trocear(
    partes.map((p) => p.id),
    TAM_TROZO_IN,
  )) {
    const filas = await leerTodo<FilaIncidenciaCalidad>(() =>
      supabase
        .from("incidencia_calidad")
        .select("parte_id, descripcion, fotos")
        .in("parte_id", trozo)
        .order("id", { ascending: true })
    );
    incidenciasCalidad.push(...filas);
  }

  // 5) Incidencias de producción de los turnos (por línea o generales).
  const incidenciasProduccion = await leerTodo<FilaIncidenciaProduccion>(() =>
    supabase
      .from("incidencia_produccion")
      .select("turno_id, linea_id, descripcion, fotos")
      .in("turno_id", turnoIds)
      .order("id", { ascending: true })
  );

  return { turnos, lineas, partes, incidenciasCalidad, incidenciasProduccion };
}

// ---------------------------------------------------------------
// Capa pura: filas -> datos del PDF
// ---------------------------------------------------------------

const ORDEN_TURNO: Record<TipoTurnoLetra, number> = { M: 0, T: 1, N: 2 };
const NOMBRE_TURNO: Record<TipoTurnoLetra, string> = { M: "Mañana", T: "Tarde", N: "Noche" };
// Minutos que dura un turno por línea (8 h): el mismo suelo de 480 que
// usan las vistas de rendimiento (v_produccion_turno).
const MINUTOS_LINEA_TURNO = 480;
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "lun 07/09" — con tabla propia en vez de toLocaleDateString para no depender del ICU del servidor. */
function etiquetaDia(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const dia = DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function acumuladoVacio(): AcumuladoPeriodoPdf {
  return {
    m2_1a: 0,
    m2Comercial: 0,
    m2Contenedor: 0,
    m2Total: 0,
    piezas1a: 0,
    piezasComercial: 0,
    piezasContenedor: 0,
    tiempos: { plena: 0, noAlimentada: 0, saturacion: 0, banco: 0, maquina: 0 },
  };
}

interface ParteCalculada {
  m2_1a: number;
  m2Comercial: number;
  m2Contenedor: number;
}

function sumarEn(a: AcumuladoPeriodoPdf, p: FilaParte, m2: ParteCalculada): void {
  a.m2_1a += m2.m2_1a;
  a.m2Comercial += m2.m2Comercial;
  a.m2Contenedor += m2.m2Contenedor;
  a.m2Total += m2.m2_1a + m2.m2Comercial + m2.m2Contenedor;
  a.piezas1a += p.piezas_1a;
  a.piezasComercial += p.piezas_comercial;
  a.piezasContenedor += p.piezas_contenedor;
  a.tiempos.plena += p.minutos_plena;
  a.tiempos.noAlimentada += p.minutos_no_alimentada;
  a.tiempos.saturacion += p.minutos_saturacion;
  a.tiempos.banco += p.minutos_banco;
  a.tiempos.maquina += p.minutos_maquina;
}

/**
 * El calibre es texto libre pero se compara numéricamente (`03` = `3`,
 * ver 01-dominio.md): se normaliza igual para no contar dos veces el
 * mismo calibre escrito de dos formas.
 */
function normalizarCalibre(calibre: string | null): string | null {
  const c = (calibre ?? "").trim().toUpperCase();
  if (!c) return null;
  return /^\d+$/.test(c) ? String(Number(c)) : c;
}

interface AcumuladorLote {
  base: AcumuladoPeriodoPdf;
  numeroOrden: string;
  modeloNombre: string;
  formatoNombre: string;
  tonos: Set<string>;
  calibres: Set<string>;
}

export function construirDatosInformePeriodo(
  tipo: TipoInformePeriodo,
  desde: string,
  hasta: string,
  filas: FilasPeriodo,
): DatosInformePeriodoPdf {
  const turnoPorId = new Map(filas.turnos.map((t) => [t.id, t]));
  const nombreLinea = new Map(filas.lineas.map((l) => [l.id, l.nombre]));

  // ---- Turnos esperados / registrados / faltantes ----
  const existentes = new Set(filas.turnos.map((t) => `${t.fecha}|${t.tipo}`));
  const turnosFaltantes: string[] = [];
  let turnosEsperados = 0;
  for (const fecha of listarFechas(desde, hasta)) {
    for (const t of ["M", "T", "N"] as TipoTurnoLetra[]) {
      turnosEsperados++;
      if (!existentes.has(`${fecha}|${t}`)) turnosFaltantes.push(`${fechaCorta(fecha)} ${t}`);
    }
  }
  const turnosSinCerrar = filas.turnos.filter((t) => !t.cerrado_at).length;

  const responsables =
    tipo === "diario"
      ? [...filas.turnos]
          .sort((a, b) => ORDEN_TURNO[a.tipo] - ORDEN_TURNO[b.tipo])
          .filter((t) => t.responsable_username)
          .map((t) => ({ tipoTurno: t.tipo, username: t.responsable_username as string }))
      : [];

  // ---- Producción y tiempos por línea / total / lote ----
  const porLinea = new Map<string, AcumuladoPeriodoPdf>(filas.lineas.map((l) => [l.id, acumuladoVacio()]));
  const totales = acumuladoVacio();
  const porLote = new Map<string, AcumuladorLote>();

  // Desglose temporal: diario -> una fila por turno (M/T/N); semanal ->
  // una por día. Se crean SIEMPRE todas las filas (aunque no haya
  // producción ni turno) para que los huecos se vean, no se omitan.
  const claves: string[] = tipo === "diario" ? ["M", "T", "N"] : listarFechas(desde, hasta);
  const claveDeTurno = (t: FilaTurno): string => (tipo === "diario" ? t.tipo : t.fecha);
  const porClave = new Map<string, AcumuladoPeriodoPdf>(claves.map((c) => [c, acumuladoVacio()]));

  for (const p of filas.partes) {
    const m2: ParteCalculada = {
      m2_1a: m2DePiezas(p.piezas_1a, p.formato_nombre),
      m2Comercial: m2DePiezas(p.piezas_comercial, p.formato_nombre),
      m2Contenedor: m2DePiezas(p.piezas_contenedor, p.formato_nombre),
    };

    const linea = porLinea.get(p.linea_id);
    if (linea) sumarEn(linea, p, m2);
    sumarEn(totales, p, m2);

    const turnoDelParte = turnoPorId.get(p.turno_id);
    const fila = turnoDelParte ? porClave.get(claveDeTurno(turnoDelParte)) : undefined;
    if (fila) sumarEn(fila, p, m2);

    let lote = porLote.get(p.lote_id);
    if (!lote) {
      lote = {
        base: acumuladoVacio(),
        numeroOrden: p.numero_orden,
        modeloNombre: p.modelo_nombre ?? "—",
        formatoNombre: p.formato_nombre ?? "—",
        tonos: new Set(),
        calibres: new Set(),
      };
      porLote.set(p.lote_id, lote);
    }
    sumarEn(lote.base, p, m2);
    if (p.tono) lote.tonos.add(p.tono.trim().toUpperCase());
    const cal = normalizarCalibre(p.calibre);
    if (cal) lote.calibres.add(cal);
  }

  const desglose: FilaDesglosePdf[] = claves.map((clave) => {
    let nota: string | null = null;
    if (tipo === "diario") {
      const turno = filas.turnos.find((t) => t.tipo === clave);
      nota = !turno ? "sin turno" : !turno.cerrado_at ? "sin cerrar" : null;
    } else {
      // "2/3" = turnos registrados ese día de los 3 esperados (el PDF
      // lo explica en una nota al pie de la tabla).
      const n = filas.turnos.filter((t) => t.fecha === clave).length;
      nota = n < 3 ? `${n}/3` : null;
    }
    return {
      etiqueta: tipo === "diario" ? NOMBRE_TURNO[clave as TipoTurnoLetra] : etiquetaDia(clave),
      nota,
      ...(porClave.get(clave) ?? acumuladoVacio()),
    };
  });

  // Tiempo máximo = turnos esperados × líneas × 480 (8.640 al día, 60.480 a
  // la semana con 6 líneas). Se calcula solo a nivel de periodo, no por
  // línea: así los pequeños descuadres entre partes se compensan.
  const numLineas = filas.lineas.length;
  const maximo = turnosEsperados * numLineas * MINUTOS_LINEA_TURNO;
  const t5 = totales.tiempos;
  const registrado = t5.plena + t5.noAlimentada + t5.saturacion + t5.banco + t5.maquina;
  const sinRegistrar = Math.max(0, maximo - registrado);
  const tiempoRegistro: TiempoRegistroPdf = {
    turnos: turnosEsperados,
    lineas: numLineas,
    maximo,
    registrado,
    sinRegistrar,
    sinRegistrarPorTurnosFaltantes: Math.min(sinRegistrar, turnosFaltantes.length * numLineas * MINUTOS_LINEA_TURNO),
  };

  const lineas = filas.lineas.map((l) => ({ nombre: l.nombre, ...(porLinea.get(l.id) ?? acumuladoVacio()) }));

  const lotes: LotePeriodoPdf[] = [...porLote.values()]
    .map((l) => ({
      numeroOrden: l.numeroOrden,
      modeloNombre: l.modeloNombre,
      formatoNombre: l.formatoNombre,
      m2_1a: l.base.m2_1a,
      m2Comercial: l.base.m2Comercial,
      m2Contenedor: l.base.m2Contenedor,
      m2Total: l.base.m2Total,
      piezas1a: l.base.piezas1a,
      piezasComercial: l.base.piezasComercial,
      piezasContenedor: l.base.piezasContenedor,
      numTonos: l.tonos.size,
      numCalibres: l.calibres.size,
    }))
    .sort((a, b) => b.m2Total - a.m2Total || a.numeroOrden.localeCompare(b.numeroOrden));

  // ---- Incidencias (calidad + producción + generales) ----
  const parteAContexto = new Map(filas.partes.map((p) => [p.id, p]));
  const incidencias: IncidenciaPeriodoPdf[] = [];

  for (const ic of filas.incidenciasCalidad) {
    const parte = parteAContexto.get(ic.parte_id);
    const turno = parte ? turnoPorId.get(parte.turno_id) : undefined;
    if (!parte || !turno) continue;
    incidencias.push({
      origen: "calidad",
      fecha: turno.fecha,
      tipoTurno: turno.tipo,
      lineaNombre: nombreLinea.get(parte.linea_id) ?? null,
      contexto: `${parte.modelo_nombre ?? "—"}, tono ${parte.tono}`,
      descripcion: ic.descripcion,
      fotos: ic.fotos ?? [],
    });
  }
  for (const ip of filas.incidenciasProduccion) {
    const turno = turnoPorId.get(ip.turno_id);
    if (!turno) continue;
    incidencias.push({
      origen: ip.linea_id ? "produccion" : "general",
      fecha: turno.fecha,
      tipoTurno: turno.tipo,
      lineaNombre: ip.linea_id ? (nombreLinea.get(ip.linea_id) ?? null) : null,
      contexto: null,
      descripcion: ip.descripcion,
      fotos: ip.fotos ?? [],
    });
  }
  incidencias.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      ORDEN_TURNO[a.tipoTurno] - ORDEN_TURNO[b.tipoTurno] ||
      (a.lineaNombre ?? "~").localeCompare(b.lineaNombre ?? "~"),
  );

  return {
    tipo,
    desde,
    hasta,
    turnosEsperados,
    turnosRegistrados: filas.turnos.length,
    turnosSinCerrar,
    turnosFaltantes,
    responsables,
    desglose,
    tiempoRegistro,
    lineas,
    totales,
    lotes,
    incidencias,
    // El diario lleva las fotos; el semanal solo texto (decisión 20/09/2026).
    incluirFotos: tipo === "diario",
  };
}

/** Resumen compacto para guardar en informe_periodo.resumen y componer el aviso de Telegram. */
export function resumenDeInforme(d: DatosInformePeriodoPdf) {
  return {
    turnos_registrados: d.turnosRegistrados,
    turnos_esperados: d.turnosEsperados,
    turnos_sin_cerrar: d.turnosSinCerrar,
    turnos_faltantes: d.turnosFaltantes,
    m2_total: d.totales.m2Total,
    m2_1a: d.totales.m2_1a,
    m2_comercial: d.totales.m2Comercial,
    m2_contenedor: d.totales.m2Contenedor,
    lotes: d.lotes.length,
    incidencias: d.incidencias.length,
  };
}