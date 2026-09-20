// PDF de los informes por periodo: DIARIO (los 3 turnos M+T+N de un
// día de producción) y SEMANAL (lunes M → domingo N). Mismos datos que
// el informe de turno, a otra granularidad: fusionar turnos da el día,
// fusionar días da la semana (decisión de sesión 20/09/2026).
//
// Estructura (idéntica en los dos):
//   1. Cabecera: periodo, turnos incluidos, totales.
//   2. Producción por línea (1ª / comercial / contenedor) — una fila
//      por línea + fila TOTAL.
//   3. Tiempos por línea — una fila por línea + fila TOTAL.
//   4. Producción por lote — una fila por lote con producción en el
//      periodo (tonos y calibres combinados solo como recuento).
//   5. Incidencias — diario con fotos, semanal solo texto.
//
// No hay detalle parte a parte: eso vive en el informe de turno.

import {
  asegurarEspacio,
  COLOR_INCIDENCIA_CALIDAD,
  COLOR_INCIDENCIA_PRODUCCION,
  COLOR_TEXTO,
  COLOR_TEXTO_SUAVE,
  ANCHO_PAGINA,
  MARGEN_X,
  crearContexto,
  dibujarBarra,
  dibujarIncidencia,
  dibujarTabla,
  dibujarTexto,
  formatearFecha,
  formatearM2,
  formatearPiezas,
  m2ConPiezas,
  minConPct,
  totalMinutos,
  type ColumnaTabla,
  type TiemposAgregadosPdf,
} from "./pdf-comun.ts";

export type TipoInformePeriodo = "diario" | "semanal";
export type TipoTurnoLetra = "M" | "T" | "N";

/** Producción y tiempos acumulados (una línea, o el total de todas). */
export interface AcumuladoPeriodoPdf {
  m2_1a: number;
  m2Comercial: number;
  m2Contenedor: number;
  m2Total: number;
  piezas1a: number;
  piezasComercial: number;
  piezasContenedor: number;
  tiempos: TiemposAgregadosPdf;
}

export interface LineaPeriodoPdf extends AcumuladoPeriodoPdf {
  nombre: string;
}

export interface LotePeriodoPdf {
  numeroOrden: string;
  modeloNombre: string;
  formatoNombre: string;
  m2_1a: number;
  m2Comercial: number;
  m2Contenedor: number;
  m2Total: number;
  piezas1a: number;
  piezasComercial: number;
  piezasContenedor: number;
  /** Nº de tonos distintos usados en el lote durante el periodo. */
  numTonos: number;
  /** Nº de calibres distintos (0 si ningún parte lo informó). */
  numCalibres: number;
}

export interface IncidenciaPeriodoPdf {
  origen: "calidad" | "produccion" | "general";
  fecha: string;
  tipoTurno: TipoTurnoLetra;
  lineaNombre: string | null;
  /** Solo calidad: "SL ORION MARFIL MT, tono M10". */
  contexto: string | null;
  descripcion: string;
  fotos: string[];
}

export interface DatosInformePeriodoPdf {
  tipo: TipoInformePeriodo;
  /** Primera fecha de turno incluida (YYYY-MM-DD). */
  desde: string;
  /** Última fecha de turno incluida (YYYY-MM-DD). */
  hasta: string;
  turnosEsperados: number;
  turnosRegistrados: number;
  turnosSinCerrar: number;
  /** "12/09 N" — turnos esperados que no existen. */
  turnosFaltantes: string[];
  /** Solo en el diario: quién abrió cada turno. */
  responsables: { tipoTurno: TipoTurnoLetra; username: string }[];
  lineas: LineaPeriodoPdf[];
  totales: AcumuladoPeriodoPdf;
  lotes: LotePeriodoPdf[];
  incidencias: IncidenciaPeriodoPdf[];
  incluirFotos: boolean;
}

const NOMBRE_TURNO: Record<TipoTurnoLetra, string> = { M: "Mañana", T: "Tarde", N: "Noche" };
const MAX_FALTANTES_LISTADOS = 12;

// ---------------------------------------------------------------
// Formato
// ---------------------------------------------------------------

function sumarDiasISO(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

function fechaCorta(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

/** "78,4 %" — proporción de una parte sobre el total; "—" si el total es 0. */
export function formatearPorcentaje(parte: number, total: number, compacto = false): string {
  if (total <= 0) return "—";
  const pct = (parte / total) * 100;
  const n = pct.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return compacto ? `${n}%` : `${n} %`;
}

/** m² con un decimal y sin unidad (para celdas estrechas). */
function numero1(valor: number): string {
  return valor.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function m2Corto(m2: number, piezas: number): string {
  return `${numero1(m2)} (${formatearPiezas(piezas)})`;
}

function tituloInforme(d: DatosInformePeriodoPdf): string {
  return d.tipo === "diario"
    ? `INFORME DIARIO — ${formatearFecha(d.desde)}`
    : `INFORME SEMANAL — ${formatearFecha(d.desde)} al ${formatearFecha(d.hasta)}`;
}

function subtituloInforme(d: DatosInformePeriodoPdf): string {
  const finReal = sumarDiasISO(d.hasta, 1);
  if (d.tipo === "diario") {
    return (
      `Turnos de mañana, tarde y noche del ${formatearFecha(d.desde)} ` +
      `(de 06:00 del ${fechaCorta(d.desde)} a 06:00 del ${fechaCorta(finReal)}).`
    );
  }
  return (
    `Del lunes ${fechaCorta(d.desde)} (turno de mañana) al domingo ${fechaCorta(d.hasta)} ` +
    `(turno de noche, hasta las 06:00 del ${fechaCorta(finReal)}).`
  );
}

// ---------------------------------------------------------------
// Columnas
// ---------------------------------------------------------------

const COLUMNAS_PRODUCCION_LINEA: ColumnaTabla[] = [
  { titulo: "Línea", ancho: 55 },
  { titulo: "1ª", ancho: 115, alinearDerecha: true },
  { titulo: "Comercial", ancho: 115, alinearDerecha: true },
  { titulo: "Contenedor", ancho: 115, alinearDerecha: true },
  { titulo: "m² total", ancho: 115, alinearDerecha: true },
];

const COLUMNAS_TIEMPOS_LINEA: ColumnaTabla[] = [
  { titulo: "Línea", ancho: 65 },
  { titulo: "Plena", ancho: 90, alinearDerecha: true },
  { titulo: "No aliment.", ancho: 90, alinearDerecha: true },
  { titulo: "Saturación", ancho: 90, alinearDerecha: true },
  { titulo: "Banco", ancho: 90, alinearDerecha: true },
  { titulo: "Máquina", ancho: 90, alinearDerecha: true },
];

const COLUMNAS_LOTES: ColumnaTabla[] = [
  { titulo: "Orden", ancho: 48 },
  { titulo: "Modelo", ancho: 80 },
  { titulo: "Formato", ancho: 48 },
  { titulo: "1ª", ancho: 74, alinearDerecha: true },
  { titulo: "Comercial", ancho: 68, alinearDerecha: true },
  { titulo: "Contenedor", ancho: 64, alinearDerecha: true },
  { titulo: "m² total", ancho: 50, alinearDerecha: true },
  { titulo: "% 1ª", ancho: 34, alinearDerecha: true },
  { titulo: "Ton / Cal", ancho: 49, alinearDerecha: true },
];

function filaProduccion(nombre: string, a: AcumuladoPeriodoPdf): string[] {
  return [
    nombre,
    m2ConPiezas(a.m2_1a, a.piezas1a),
    m2ConPiezas(a.m2Comercial, a.piezasComercial),
    m2ConPiezas(a.m2Contenedor, a.piezasContenedor),
    formatearM2(a.m2Total),
  ];
}

function filaTiemposLinea(nombre: string, t: TiemposAgregadosPdf): string[] {
  const total = totalMinutos(t);
  return [
    nombre,
    minConPct(t.plena, total),
    minConPct(t.noAlimentada, total),
    minConPct(t.saturacion, total),
    minConPct(t.banco, total),
    minConPct(t.maquina, total),
  ];
}

function etiquetaOrigen(i: IncidenciaPeriodoPdf): string {
  const cuando = `${fechaCorta(i.fecha)} · ${NOMBRE_TURNO[i.tipoTurno]}`;
  const donde = i.lineaNombre ?? "General del turno";
  if (i.origen === "calidad") {
    return `${cuando} · ${donde} · Calidad${i.contexto ? ` (${i.contexto})` : ""}`;
  }
  if (i.origen === "produccion") return `${cuando} · ${donde} · Producción`;
  return `${cuando} · ${donde}`;
}

// ---------------------------------------------------------------
// Generador
// ---------------------------------------------------------------

export async function generarPdfInformePeriodo(datos: DatosInformePeriodoPdf): Promise<Uint8Array> {
  const ctx = await crearContexto();
  const titulo = tituloInforme(datos);
  ctx.pdfDoc.setTitle(titulo);

  // ---- Cabecera ----
  dibujarBarra(ctx, titulo, 28);
  dibujarTexto(ctx, subtituloInforme(datos), { tamano: 9, color: COLOR_TEXTO_SUAVE });

  dibujarTexto(ctx, `Turnos incluidos: ${datos.turnosRegistrados} de ${datos.turnosEsperados}`, {
    tamano: 10,
    negrita: true,
  });
  if (datos.turnosFaltantes.length > 0) {
    const listados = datos.turnosFaltantes.slice(0, MAX_FALTANTES_LISTADOS).join(", ");
    const resto = datos.turnosFaltantes.length - MAX_FALTANTES_LISTADOS;
    dibujarTexto(ctx, `Sin turno registrado: ${listados}${resto > 0 ? ` y ${resto} más` : ""}.`, {
      tamano: 9,
      color: COLOR_INCIDENCIA_PRODUCCION,
    });
  }
  if (datos.turnosSinCerrar > 0) {
    dibujarTexto(
      ctx,
      `${datos.turnosSinCerrar} turno${datos.turnosSinCerrar > 1 ? "s" : ""} sin cerrar en el momento de generar el informe.`,
      { tamano: 9, color: COLOR_INCIDENCIA_PRODUCCION },
    );
  }

  if (datos.tipo === "diario" && datos.responsables.length > 0) {
    const texto = (["M", "T", "N"] as TipoTurnoLetra[])
      .map((t) => `${NOMBRE_TURNO[t]}: ${datos.responsables.find((r) => r.tipoTurno === t)?.username ?? "—"}`)
      .join(" · ");
    dibujarTexto(ctx, `Responsables — ${texto}`, { tamano: 9.5 });
  }

  ctx.y -= 2;
  dibujarTexto(ctx, `m² totales: ${formatearM2(datos.totales.m2Total)}`, { tamano: 11, negrita: true });
  const t = datos.totales;
  dibujarTexto(
    ctx,
    `1ª ${formatearM2(t.m2_1a)} (${formatearPorcentaje(t.m2_1a, t.m2Total)}) · ` +
      `Comercial ${formatearM2(t.m2Comercial)} (${formatearPorcentaje(t.m2Comercial, t.m2Total)}) · ` +
      `Contenedor ${formatearM2(t.m2Contenedor)} (${formatearPorcentaje(t.m2Contenedor, t.m2Total)})`,
    { tamano: 9.5 },
  );
  ctx.y -= 6;

  // ---- 2. Producción por línea ----
  asegurarEspacio(ctx, 90); // el título de sección nunca queda solo al final de una página
  dibujarBarra(ctx, "Producción por línea");
  dibujarTabla(ctx, COLUMNAS_PRODUCCION_LINEA, [
    ...datos.lineas.map((l) => filaProduccion(l.nombre, l)),
    filaProduccion("TOTAL", datos.totales),
  ]);

  // ---- 3. Tiempos por línea ----
  asegurarEspacio(ctx, 90); // el título de sección nunca queda solo al final de una página
  dibujarBarra(ctx, "Tiempos por línea");
  dibujarTabla(ctx, COLUMNAS_TIEMPOS_LINEA, [
    ...datos.lineas.map((l) => filaTiemposLinea(l.nombre, l.tiempos)),
    filaTiemposLinea("TOTAL", datos.totales.tiempos),
  ]);

  // ---- 4. Producción por lote ----
  asegurarEspacio(ctx, 90); // el título de sección nunca queda solo al final de una página
  dibujarBarra(ctx, `Producción por lote (${datos.lotes.length})`);
  if (datos.lotes.length === 0) {
    dibujarTexto(ctx, "Sin producción registrada en el periodo.", { tamano: 9, color: COLOR_TEXTO_SUAVE });
  } else {
    dibujarTabla(
      ctx,
      COLUMNAS_LOTES,
      datos.lotes.map((l) => [
        l.numeroOrden,
        l.modeloNombre,
        l.formatoNombre,
        m2Corto(l.m2_1a, l.piezas1a),
        m2Corto(l.m2Comercial, l.piezasComercial),
        m2Corto(l.m2Contenedor, l.piezasContenedor),
        numero1(l.m2Total),
        formatearPorcentaje(l.m2_1a, l.m2Total, true),
        `${l.numTonos} / ${l.numCalibres > 0 ? l.numCalibres : "—"}`,
      ]),
    );
    dibujarTexto(
      ctx,
      "1ª, Comercial y Contenedor: m² (piezas). Ton / Cal: nº de tonos y de calibres distintos que se " +
        "combinaron en el lote durante el periodo. Solo cuenta la producción del periodo, no el " +
        "acumulado del lote.",
      { tamano: 8, color: COLOR_TEXTO_SUAVE },
    );
    ctx.y -= 6;
  }

  // ---- 5. Incidencias ----
  ctx.y -= 2;
  asegurarEspacio(ctx, 90); // el título de sección nunca queda solo al final de una página
  dibujarBarra(ctx, `Incidencias (${datos.incidencias.length})`);
  if (datos.incidencias.length === 0) {
    dibujarTexto(ctx, "Sin incidencias en el periodo.", { tamano: 9, color: COLOR_TEXTO_SUAVE });
  } else {
    for (const inc of datos.incidencias) {
      const color =
        inc.origen === "calidad"
          ? COLOR_INCIDENCIA_CALIDAD
          : inc.origen === "produccion"
            ? COLOR_INCIDENCIA_PRODUCCION
            : COLOR_TEXTO;
      await dibujarIncidencia(
        ctx,
        etiquetaOrigen(inc),
        { descripcion: inc.descripcion, fotos: inc.fotos },
        color,
        datos.incluirFotos,
      );
      ctx.y -= 3;
    }
  }

  // ---- Pie con numeración de páginas ----
  const paginas = ctx.pdfDoc.getPages();
  paginas.forEach((pagina, i) => {
    pagina.drawText(`Motiv · ${titulo} · Página ${i + 1} de ${paginas.length}`, {
      x: MARGEN_X,
      y: 22,
      size: 7.5,
      font: ctx.fuente,
      color: COLOR_TEXTO_SUAVE,
      maxWidth: ANCHO_PAGINA - MARGEN_X * 2,
    });
  });

  return ctx.pdfDoc.save();
}
