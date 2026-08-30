// Generación del PDF del informe de turno. Ref. conversación "Informe
// PDF de turno" (30/08/2026) — evolución del resumen de texto que ya
// manda generar-resumen-turno a Telegram.
//
// Se llama SOLO desde generar-resumen-turno, con los mismos datos que
// esa función ya calcula para el texto de Telegram (no vuelve a
// consultar la base de datos), más las fotos de las incidencias que
// el texto de Telegram no necesita pero el PDF sí.
//
// pdf-lib no maquetea solo (no es HTML/CSS): aquí se dibuja todo por
// coordenadas, controlando manualmente los saltos de página. Tablas
// (una de tiempos + una de partes por línea) en vez de frases largas,
// porque en columnas se lee de un vistazo — ver conversación previa.
//
// FOTOS: las fotos ya llegan desde Cloudinary en 1600×1200 WebP
// (captura-imagen.ts). pdf-lib solo sabe incrustar JPEG o PNG, no
// WebP, así que cada URL se pide reescrita con una transformación de
// Cloudinary (f_jpg + w_900) ANTES de descargarla — no se toca el
// archivo original en Cloudinary, es solo la URL de entrega la que
// cambia. De paso, pedir un ancho más pequeño que el original aligera
// la descarga y el PDF final. Layout: una foto debajo de otra (no en
// fila), a un ancho de recuadro amplio pero fijo, para que el alto se
// pueda calcular sin ambigüedad antes de decidir si cabe en la página.

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

const ANCHO_FOTO = 320;
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
  { titulo: "Plena", ancho: 70 },
  { titulo: "No aliment.", ancho: 75 },
  { titulo: "Saturación", ancho: 75 },
  { titulo: "Banco", ancho: 70 },
  { titulo: "Máquina", ancho: 75 },
  { titulo: "m² total", ancho: 90, alinearDerecha: true },
];

const COLUMNAS_PARTES: ColumnaTabla[] = [
  { titulo: "Modelo", ancho: 130 },
  { titulo: "Formato", ancho: 80 },
  { titulo: "Tono", ancho: 45 },
  { titulo: "1ª", ancho: 78, alinearDerecha: true },
  { titulo: "Comercial", ancho: 78, alinearDerecha: true },
  { titulo: "Contenedor", ancho: 78, alinearDerecha: true },
];

function filaTiempos(t: TiemposAgregadosPdf, m2Total: number): string[] {
  return [`${t.plena}m`, `${t.noAlimentada}m`, `${t.saturacion}m`, `${t.banco}m`, `${t.maquina}m`, formatearM2(m2Total)];
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
          formatearM2(p.m2_1a),
          formatearM2(p.m2Comercial),
          formatearM2(p.m2Contenedor),
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