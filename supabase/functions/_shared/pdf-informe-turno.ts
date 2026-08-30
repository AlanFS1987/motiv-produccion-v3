// Generación del PDF del informe de turno. Ref. conversación "Informe
// PDF de turno" (30/08/2026) — evolución del resumen de texto que ya
// manda generar-resumen-turno a Telegram.
//
// Revisión 30/08/2026 (tras ver el primer PDF real): fotos más
// pequeñas, piezas junto a los m² en la tabla de partes, % junto a
// los minutos en las tablas de tiempos, y una tabla comparativa
// nueva (una fila por línea) justo después de la cabecera, para
// poder comparar las 6 líneas de un vistazo sin entrar en el detalle
// de cada una.

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, RGB } from "npm:pdf-lib@1.17.1";

export interface TiemposAgregadosPdf {
  plena: number;
  noAlimentada: number;
  saturacion: number;
  banco: number;
  maquina: number;
}

export interface IncidenciaConFotosPdf {
  descripcion: string;
  fotos: string[];
}

export interface ParteInformePdf {
  modeloNombre: string;
  formatoNombre: string;
  tono: string;
  m2_1a: number;
  m2Comercial: number;
  m2Contenedor: number;
  piezas1a: number;
  piezasComercial: number;
  piezasContenedor: number;
  incidenciasCalidad: IncidenciaConFotosPdf[];
}

export interface LineaInformePdf {
  nombre: string;
  operario: string;
  m2Total: number;
  tiempos: TiemposAgregadosPdf;
  incidenciasProduccion: IncidenciaConFotosPdf[];
  partes: ParteInformePdf[];
}

export interface DatosInformeTurnoPdf {
  fecha: string;
  tipoNombre: string;
  responsableUsername: string;
  m2Total: number;
  tiempos: TiemposAgregadosPdf;
  lineas: LineaInformePdf[];
  incidenciasGenerales: IncidenciaConFotosPdf[];
}

const ANCHO_PAGINA = 595.28;
const ALTO_PAGINA = 841.89;
const MARGEN_X = 40;
const MARGEN_SUP = 40;
const MARGEN_INF = 44;
const ANCHO_CONTENIDO = ANCHO_PAGINA - MARGEN_X * 2;

// Antes 320 — bajado a 200 tras ver el primer PDF real (demasiado
// grandes, tapaban más de media página cada una).
const ANCHO_FOTO = 200;
const ANCHO_DESCARGA_FOTO = 900;

const COLOR_MARCA: RGB = rgb(20 / 255, 99 / 255, 110 / 255);
const COLOR_TEXTO: RGB = rgb(0.13, 0.13, 0.13);
const COLOR_TEXTO_SUAVE: RGB = rgb(0.42, 0.42, 0.42);
const COLOR_BORDE: RGB = rgb(0.82, 0.82, 0.82);
const COLOR_FONDO_CABECERA_TABLA: RGB = rgb(0.94, 0.94, 0.94);
const COLOR_BLANCO: RGB = rgb(1, 1, 1);
const COLOR_INCIDENCIA_CALIDAD: RGB = rgb(0.64, 0.18, 0.18);
const COLOR_INCIDENCIA_PRODUCCION: RGB = rgb(0.64, 0.42, 0.08);

interface Contexto {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  fuente: PDFFont;
  fuenteNegrita: PDFFont;
}

function nuevaPagina(ctx: Contexto): void {
  ctx.page = ctx.pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  ctx.y = ALTO_PAGINA - MARGEN_SUP;
}

function asegurarEspacio(ctx: Contexto, alto: number): void {
  if (ctx.y - alto < MARGEN_INF) {
    nuevaPagina(ctx);
  }
}

function formatearM2(valor: number): string {
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m²`;
}

function formatearPiezas(valor: number): string {
  return valor.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function formatearFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

function envolverTexto(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(candidato, tamano) > anchoMax && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [""];
}

function dibujarTexto(
  ctx: Contexto,
  texto: string,
  opciones: { x?: number; tamano?: number; negrita?: boolean; color?: RGB; anchoMax?: number } = {},
): void {
  const x = opciones.x ?? MARGEN_X;
  const tamano = opciones.tamano ?? 10;
  const fuente = opciones.negrita ? ctx.fuenteNegrita : ctx.fuente;
  const color = opciones.color ?? COLOR_TEXTO;
  const anchoMax = opciones.anchoMax ?? ANCHO_PAGINA - MARGEN_X - x;

  const lineas = envolverTexto(texto, fuente, tamano, anchoMax);
  for (const linea of lineas) {
    asegurarEspacio(ctx, tamano + 4);
    ctx.page.drawText(linea, { x, y: ctx.y - tamano, size: tamano, font: fuente, color });
    ctx.y -= tamano + 4;
  }
}

function dibujarBarra(ctx: Contexto, texto: string, altoBarra = 22): void {
  asegurarEspacio(ctx, altoBarra + 6);
  const yBarra = ctx.y - altoBarra;
  ctx.page.drawRectangle({
    x: MARGEN_X,
    y: yBarra,
    width: ANCHO_CONTENIDO,
    height: altoBarra,
    color: COLOR_MARCA,
  });
  ctx.page.drawText(texto, {
    x: MARGEN_X + 8,
    y: yBarra + altoBarra / 2 - 4,
    size: 11,
    font: ctx.fuenteNegrita,
    color: COLOR_BLANCO,
  });
  ctx.y = yBarra - 10;
}

interface ColumnaTabla {
  titulo: string;
  ancho: number;
  alinearDerecha?: boolean;
}

function dibujarTabla(ctx: Contexto, columnas: ColumnaTabla[], filas: string[][]): void {
  const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
  const altoCabecera = 16;
  const tamanoCelda = 8.5;
  const padCelda = 4;

  function dibujarCabecera(): void {
    asegurarEspacio(ctx, altoCabecera + 2);
    const yFila = ctx.y - altoCabecera;
    ctx.page.drawRectangle({
      x: MARGEN_X,
      y: yFila,
      width: anchoTotal,
      height: altoCabecera,
      color: COLOR_FONDO_CABECERA_TABLA,
    });
    let x = MARGEN_X;
    for (const col of columnas) {
      const anchoTexto = ctx.fuenteNegrita.widthOfTextAtSize(col.titulo, tamanoCelda);
      const tx = col.alinearDerecha ? x + col.ancho - padCelda - anchoTexto : x + padCelda;
      ctx.page.drawText(col.titulo, {
        x: tx,
        y: yFila + altoCabecera / 2 - tamanoCelda / 2 + 1,
        size: tamanoCelda,
        font: ctx.fuenteNegrita,
        color: COLOR_TEXTO_SUAVE,
      });
      x += col.ancho;
    }
    ctx.y = yFila;
  }

  dibujarCabecera();

  for (const fila of filas) {
    const celdasEnvueltas = fila.map((valor, i) =>
      envolverTexto(valor, ctx.fuente, tamanoCelda, columnas[i].ancho - padCelda * 2),
    );
    const numLineas = Math.max(...celdasEnvueltas.map((l) => l.length));
    const altoFila = numLineas * (tamanoCelda + 3) + padCelda;

    if (ctx.y - altoFila < MARGEN_INF) {
      nuevaPagina(ctx);
      dibujarCabecera();
    }

    const yFila = ctx.y - altoFila;
    let x = MARGEN_X;
    for (let i = 0; i < columnas.length; i++) {
      const col = columnas[i];
      const lineasCelda = celdasEnvueltas[i];
      lineasCelda.forEach((linea, idx) => {
        const anchoTexto = ctx.fuente.widthOfTextAtSize(linea, tamanoCelda);
        const tx = col.alinearDerecha ? x + col.ancho - padCelda - anchoTexto : x + padCelda;
        ctx.page.drawText(linea, {
          x: tx,
          y: yFila + altoFila - padCelda / 2 - (idx + 1) * (tamanoCelda + 3) + 2,
          size: tamanoCelda,
          font: ctx.fuente,
          color: COLOR_TEXTO,
        });
      });
      x += col.ancho;
    }
    ctx.page.drawLine({
      start: { x: MARGEN_X, y: yFila },
      end: { x: MARGEN_X + anchoTotal, y: yFila },
      thickness: 0.5,
      color: COLOR_BORDE,
    });
    ctx.y = yFila;
  }

  ctx.y -= 10;
}

const COLUMNAS_TIEMPOS: ColumnaTabla[] = [
  { titulo: "Plena", ancho: 78 },
  { titulo: "No aliment.", ancho: 83 },
  { titulo: "Saturación", ancho: 83 },
  { titulo: "Banco", ancho: 78 },
  { titulo: "Máquina", ancho: 83 },
  { titulo: "m² total", ancho: 90, alinearDerecha: true },
];

const COLUMNAS_PARTES: ColumnaTabla[] = [
  { titulo: "Modelo", ancho: 120 },
  { titulo: "Formato", ancho: 75 },
  { titulo: "Tono", ancho: 40 },
  { titulo: "1ª", ancho: 93, alinearDerecha: true },
  { titulo: "Comercial", ancho: 93, alinearDerecha: true },
  { titulo: "Contenedor", ancho: 93, alinearDerecha: true },
];

// Tabla comparativa nueva: una fila por línea, tiempos con % ya
// incluido en la misma celda (igual criterio que COLUMNAS_TIEMPOS)
// para no duplicar columnas — cabe justo en el ancho de contenido.
const COLUMNAS_COMPARATIVA: ColumnaTabla[] = [
  { titulo: "Línea", ancho: 60 },
  { titulo: "Operario", ancho: 75 },
  { titulo: "m²", ancho: 60, alinearDerecha: true },
  { titulo: "Plena", ancho: 64, alinearDerecha: true },
  { titulo: "No aliment.", ancho: 64, alinearDerecha: true },
  { titulo: "Saturación", ancho: 64, alinearDerecha: true },
  { titulo: "Banco", ancho: 64, alinearDerecha: true },
  { titulo: "Máquina", ancho: 64, alinearDerecha: true },
];

/** "75m (89%)" — minutos de una categoría junto a su % sobre el total de las 5. */
function minConPct(minutos: number, totalMinutos: number): string {
  if (totalMinutos <= 0) return `${minutos}m`;
  const pct = Math.round((minutos / totalMinutos) * 100);
  return `${minutos}m (${pct}%)`;
}

function totalMinutos(t: TiemposAgregadosPdf): number {
  return t.plena + t.noAlimentada + t.saturacion + t.banco + t.maquina;
}

function filaTiempos(t: TiemposAgregadosPdf, m2Total: number): string[] {
  const total = totalMinutos(t);
  return [
    minConPct(t.plena, total),
    minConPct(t.noAlimentada, total),
    minConPct(t.saturacion, total),
    minConPct(t.banco, total),
    minConPct(t.maquina, total),
    formatearM2(m2Total),
  ];
}

/** "326,2 m² (1.234 pz)" — m² junto al número de piezas de esa categoría. */
function m2ConPiezas(m2: number, piezas: number): string {
  return `${formatearM2(m2)} (${formatearPiezas(piezas)} pz)`;
}

function urlFotoParaPdf(url: string): string {
  const marcador = "/upload/";
  const i = url.indexOf(marcador);
  if (i === -1) return url;
  const inicio = i + marcador.length;
  return `${url.slice(0, inicio)}f_jpg,q_auto,w_${ANCHO_DESCARGA_FOTO}/${url.slice(inicio)}`;
}

async function embeberFoto(ctx: Contexto, urlOriginal: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(urlFotoParaPdf(urlOriginal));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await ctx.pdfDoc.embedJpg(bytes);
  } catch (err) {
    console.error(`No se pudo incrustar la foto ${urlOriginal} en el informe:`, err);
    return null;
  }
}

async function dibujarFotosIncidencia(ctx: Contexto, fotos: string[]): Promise<void> {
  for (const url of fotos) {
    const imagen = await embeberFoto(ctx, url);
    if (!imagen) continue;

    const escala = ANCHO_FOTO / imagen.width;
    const alto = imagen.height * escala;

    asegurarEspacio(ctx, alto + 6);
    ctx.page.drawImage(imagen, {
      x: MARGEN_X,
      y: ctx.y - alto,
      width: ANCHO_FOTO,
      height: alto,
    });
    ctx.y -= alto + 8;
  }
}

async function dibujarIncidencia(
  ctx: Contexto,
  prefijo: string,
  incidencia: IncidenciaConFotosPdf,
  color: RGB,
): Promise<void> {
  dibujarTexto(ctx, `${prefijo}: "${incidencia.descripcion}"`, { tamano: 9, color });
  if (incidencia.fotos.length > 0) {
    await dibujarFotosIncidencia(ctx, incidencia.fotos);
  }
}

export async function generarPdfInformeTurno(datos: DatosInformeTurnoPdf): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Informe de turno — ${datos.tipoNombre} ${formatearFecha(datos.fecha)}`);
  pdfDoc.setProducer("Motiv");

  const fuente = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Contexto = {
    pdfDoc,
    page: pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]),
    y: ALTO_PAGINA - MARGEN_SUP,
    fuente,
    fuenteNegrita,
  };

  dibujarBarra(ctx, `INFORME DE TURNO — ${datos.tipoNombre.toUpperCase()}, ${formatearFecha(datos.fecha)}`, 28);
  dibujarTexto(ctx, `Responsable: ${datos.responsableUsername}`, { tamano: 10.5 });
  dibujarTexto(ctx, `m² totales del turno: ${formatearM2(datos.m2Total)}`, { tamano: 10.5, negrita: true });
  ctx.y -= 4;
  dibujarTabla(ctx, COLUMNAS_TIEMPOS, [filaTiempos(datos.tiempos, datos.m2Total)]);

  // ---- Tabla comparativa: una fila por línea, para ver las 6 de
  // un vistazo antes de entrar en el detalle de cada una ----
  ctx.y -= 4;
  dibujarBarra(ctx, "Comparativa por línea");
  dibujarTabla(
    ctx,
    COLUMNAS_COMPARATIVA,
    datos.lineas.map((linea) => {
      const total = totalMinutos(linea.tiempos);
      return [
        linea.nombre,
        linea.operario || "Sin asignar",
        formatearM2(linea.m2Total),
        minConPct(linea.tiempos.plena, total),
        minConPct(linea.tiempos.noAlimentada, total),
        minConPct(linea.tiempos.saturacion, total),
        minConPct(linea.tiempos.banco, total),
        minConPct(linea.tiempos.maquina, total),
      ];
    }),
  );

  for (const linea of datos.lineas) {
    ctx.y -= 4;
    dibujarBarra(ctx, `${linea.nombre} — Operario: ${linea.operario || "Sin asignar"}`);

    dibujarTabla(ctx, COLUMNAS_TIEMPOS, [filaTiempos(linea.tiempos, linea.m2Total)]);

    for (const inc of linea.incidenciasProduccion) {
      await dibujarIncidencia(ctx, "Incidencia de producción", inc, COLOR_INCIDENCIA_PRODUCCION);
    }

    if (linea.partes.length === 0) {
      dibujarTexto(ctx, "Sin producción real registrada este turno.", { tamano: 9, color: COLOR_TEXTO_SUAVE });
    } else {
      dibujarTabla(
        ctx,
        COLUMNAS_PARTES,
        linea.partes.map((p) => [
          p.modeloNombre,
          p.formatoNombre,
          p.tono,
          m2ConPiezas(p.m2_1a, p.piezas1a),
          m2ConPiezas(p.m2Comercial, p.piezasComercial),
          m2ConPiezas(p.m2Contenedor, p.piezasContenedor),
        ]),
      );
      for (const p of linea.partes) {
        for (const inc of p.incidenciasCalidad) {
          await dibujarIncidencia(
            ctx,
            `Incidencia de calidad (${p.modeloNombre}, tono ${p.tono})`,
            inc,
            COLOR_INCIDENCIA_CALIDAD,
          );
        }
      }
    }
  }

  if (datos.incidenciasGenerales.length > 0) {
    ctx.y -= 4;
    dibujarBarra(ctx, "Incidencias generales del turno");
    for (const inc of datos.incidenciasGenerales) {
      await dibujarIncidencia(ctx, "-", inc, COLOR_TEXTO);
    }
  }

  return pdfDoc.save();
}