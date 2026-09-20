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
//
// Refactor 20/09/2026: las utilidades de dibujo (tablas, barras,
// fotos, formato) pasaron a `pdf-comun.ts` para compartirlas con los
// informes diario y semanal (`pdf-informe-periodo.ts`). La maquetación
// de este informe no cambia.

import {
  COLOR_INCIDENCIA_CALIDAD,
  COLOR_INCIDENCIA_PRODUCCION,
  COLOR_TEXTO,
  COLOR_TEXTO_SUAVE,
  crearContexto,
  dibujarBarra,
  dibujarIncidencia,
  dibujarTabla,
  dibujarTexto,
  formatearFecha,
  formatearM2,
  m2ConPiezas,
  minConPct,
  totalMinutos,
  type ColumnaTabla,
  type IncidenciaConFotosPdf,
  type TiemposAgregadosPdf,
} from "./pdf-comun.ts";

// Se re-exportan por si algún otro módulo los importaba desde aquí.
export type { IncidenciaConFotosPdf, TiemposAgregadosPdf };

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

export async function generarPdfInformeTurno(datos: DatosInformeTurnoPdf): Promise<Uint8Array> {
  const ctx = await crearContexto();
  ctx.pdfDoc.setTitle(`Informe de turno — ${datos.tipoNombre} ${formatearFecha(datos.fecha)}`);

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

  return ctx.pdfDoc.save();
}
