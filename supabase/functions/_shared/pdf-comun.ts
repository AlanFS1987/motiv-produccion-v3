// Utilidades de dibujo comunes a todos los PDF de informes (turno,
// diario, semanal) — extraídas de pdf-informe-turno.ts (20/09/2026)
// para no duplicar la maquetación cuando se añadieron los informes
// por periodo. El dibujo es el mismo que ya funcionaba en el informe
// de turno; solo se han añadido dos cosas:
//   - limpiarParaPdf: las fuentes estándar de pdf-lib (Helvetica) solo
//     codifican WinAnsi, y una descripción de incidencia con un emoji
//     (lo normal escribiendo desde un móvil) hacía fallar TODO el PDF
//     con "WinAnsi cannot encode". Ahora el carácter no soportado se
//     sustituye por "?" y el PDF se genera igualmente.
//   - dibujarIncidencia con `incluirFotos` (el semanal va solo en texto).

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

export const ANCHO_PAGINA = 595.28;
export const ALTO_PAGINA = 841.89;
export const MARGEN_X = 40;
export const MARGEN_SUP = 40;
export const MARGEN_INF = 44;
export const ANCHO_CONTENIDO = ANCHO_PAGINA - MARGEN_X * 2;

// Antes 320 — bajado a 200 tras ver el primer PDF real (demasiado
// grandes, tapaban más de media página cada una).
const ANCHO_FOTO = 200;
const ANCHO_DESCARGA_FOTO = 900;

export const COLOR_MARCA: RGB = rgb(20 / 255, 99 / 255, 110 / 255);
export const COLOR_TEXTO: RGB = rgb(0.13, 0.13, 0.13);
export const COLOR_TEXTO_SUAVE: RGB = rgb(0.42, 0.42, 0.42);
export const COLOR_BORDE: RGB = rgb(0.82, 0.82, 0.82);
export const COLOR_FONDO_CABECERA_TABLA: RGB = rgb(0.94, 0.94, 0.94);
export const COLOR_BLANCO: RGB = rgb(1, 1, 1);
export const COLOR_INCIDENCIA_CALIDAD: RGB = rgb(0.64, 0.18, 0.18);
export const COLOR_INCIDENCIA_PRODUCCION: RGB = rgb(0.64, 0.42, 0.08);

export interface Contexto {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  fuente: PDFFont;
  fuenteNegrita: PDFFont;
}

/** Documento nuevo con Helvetica/Helvetica-Bold y la primera página ya añadida. */
export async function crearContexto(): Promise<Contexto> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer("Motiv");
  const fuente = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return {
    pdfDoc,
    page: pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]),
    y: ALTO_PAGINA - MARGEN_SUP,
    fuente,
    fuenteNegrita,
  };
}

export function nuevaPagina(ctx: Contexto): void {
  ctx.page = ctx.pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  ctx.y = ALTO_PAGINA - MARGEN_SUP;
}

export function asegurarEspacio(ctx: Contexto, alto: number): void {
  if (ctx.y - alto < MARGEN_INF) {
    nuevaPagina(ctx);
  }
}

export function formatearM2(valor: number): string {
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m²`;
}

export function formatearPiezas(valor: number): string {
  return valor.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

export function formatearFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------
// Saneado de texto para WinAnsi
// ---------------------------------------------------------------

// Caracteres invisibles que acompañan a los emojis (selector de
// variación, unión de emoji, espacios de ancho cero): se eliminan en
// vez de convertirse en "?".
const CARACTERES_IGNORABLES = new Set(["\uFE0F", "\uFE0E", "\u200D", "\u200B", "\u200C", "\u2060", "\uFEFF"]);

const cacheCaracteres = new Map<string, boolean>();

function caracterSoportado(fuente: PDFFont, ch: string): boolean {
  let ok = cacheCaracteres.get(ch);
  if (ok === undefined) {
    try {
      fuente.encodeText(ch);
      ok = true;
    } catch {
      ok = false;
    }
    cacheCaracteres.set(ch, ok);
  }
  return ok;
}

/**
 * Sustituye por "?" cualquier carácter que la fuente estándar no pueda
 * codificar (emojis, flechas, "≥"...). Trabaja por puntos de código
 * (un emoji cuenta como uno). No debe recibir saltos de línea: se
 * usa palabra a palabra desde envolverTexto, que ya normaliza los
 * espacios en blanco.
 */
export function limpiarParaPdf(texto: string, fuente: PDFFont): string {
  let salida = "";
  for (const ch of texto) {
    if (CARACTERES_IGNORABLES.has(ch)) continue;
    salida += caracterSoportado(fuente, ch) ? ch : "?";
  }
  return salida;
}

/**
 * Parte por caracteres una palabra más ancha que el hueco disponible
 * (un número de orden largo sin espacios, por ejemplo) para que no se
 * salga de su celda y se pinte encima de la siguiente columna.
 */
function partirPalabraLarga(palabra: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  if (fuente.widthOfTextAtSize(palabra, tamano) <= anchoMax) return [palabra];
  const trozos: string[] = [];
  let actual = "";
  for (const ch of palabra) {
    if (actual && fuente.widthOfTextAtSize(actual + ch, tamano) > anchoMax) {
      trozos.push(actual);
      actual = ch;
    } else {
      actual += ch;
    }
  }
  if (actual) trozos.push(actual);
  return trozos;
}

export function envolverTexto(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  const palabras = texto
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => limpiarParaPdf(p, fuente))
    .filter(Boolean)
    .flatMap((p) => partirPalabraLarga(p, fuente, tamano, anchoMax));
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

export function dibujarTexto(
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

export function dibujarBarra(ctx: Contexto, texto: string, altoBarra = 22): void {
  asegurarEspacio(ctx, altoBarra + 6);
  const yBarra = ctx.y - altoBarra;
  ctx.page.drawRectangle({
    x: MARGEN_X,
    y: yBarra,
    width: ANCHO_CONTENIDO,
    height: altoBarra,
    color: COLOR_MARCA,
  });
  ctx.page.drawText(limpiarParaPdf(texto.replace(/\s+/g, " "), ctx.fuenteNegrita), {
    x: MARGEN_X + 8,
    y: yBarra + altoBarra / 2 - 4,
    size: 11,
    font: ctx.fuenteNegrita,
    color: COLOR_BLANCO,
  });
  ctx.y = yBarra - 10;
}

export interface ColumnaTabla {
  titulo: string;
  ancho: number;
  alinearDerecha?: boolean;
}

export function dibujarTabla(ctx: Contexto, columnas: ColumnaTabla[], filas: string[][]): void {
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

// ---------------------------------------------------------------
// Tiempos
// ---------------------------------------------------------------

/** "75m (89%)" — minutos de una categoría junto a su % sobre el total de las 5. */
export function minConPct(minutos: number, totalMinutos: number): string {
  const texto = `${minutos.toLocaleString("es-ES")}m`;
  if (totalMinutos <= 0) return texto;
  const pct = Math.round((minutos / totalMinutos) * 100);
  return `${texto} (${pct}%)`;
}

export function totalMinutos(t: TiemposAgregadosPdf): number {
  return t.plena + t.noAlimentada + t.saturacion + t.banco + t.maquina;
}

/** "326,2 m² (1.234 pz)" — m² junto al número de piezas de esa categoría. */
export function m2ConPiezas(m2: number, piezas: number): string {
  return `${formatearM2(m2)} (${formatearPiezas(piezas)} pz)`;
}

// ---------------------------------------------------------------
// Fotos e incidencias
// ---------------------------------------------------------------

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

async function dibujarFotosIncidencia(
  ctx: Contexto,
  fotos: string[],
  primeraPrecargada?: PDFImage | null,
): Promise<void> {
  for (let i = 0; i < fotos.length; i++) {
    // La primera ya se cargó antes de dibujar el texto (ver
    // dibujarIncidencia): `null` significa que falló, no se reintenta.
    const imagen = i === 0 && primeraPrecargada !== undefined ? primeraPrecargada : await embeberFoto(ctx, fotos[i]);
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

/**
 * Dibuja una incidencia: `prefijo: "descripción"` y, si `incluirFotos`
 * (por defecto sí), sus fotos debajo. Con `incluirFotos = false` (informe
 * semanal) solo el texto, avisando de cuántas fotos existen.
 */
export async function dibujarIncidencia(
  ctx: Contexto,
  prefijo: string,
  incidencia: IncidenciaConFotosPdf,
  color: RGB,
  incluirFotos = true,
): Promise<void> {
  let texto = `${prefijo}: "${incidencia.descripcion}"`;
  if (!incluirFotos && incidencia.fotos.length > 0) {
    const n = incidencia.fotos.length;
    texto += ` (${n} foto${n > 1 ? "s" : ""} en el informe del turno)`;
  }

  const conFotos = incluirFotos && incidencia.fotos.length > 0;
  let primera: PDFImage | null | undefined = undefined;
  if (conFotos) {
    // Se carga la primera foto ANTES de dibujar el texto para reservar
    // sitio para las dos cosas: sin esto, el texto podía quedarse al
    // final de una página con su foto en la siguiente.
    primera = await embeberFoto(ctx, incidencia.fotos[0]);
    if (primera) {
      const altoFoto = primera.height * (ANCHO_FOTO / primera.width);
      const lineasTexto = envolverTexto(texto, ctx.fuente, 9, ANCHO_PAGINA - MARGEN_X * 2).length;
      asegurarEspacio(ctx, lineasTexto * 13 + altoFoto + 6);
    }
  }

  dibujarTexto(ctx, texto, { tamano: 9, color });
  if (conFotos) {
    await dibujarFotosIncidencia(ctx, incidencia.fotos, primera);
  }
}
