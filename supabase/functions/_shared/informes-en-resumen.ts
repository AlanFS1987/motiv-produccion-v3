// Informes DIARIO / SEMANAL dentro del resumen de turno (21/09/2026).
//
// Cuando se cierra un turno de NOCHE, el resumen de ese turno
// (generar-resumen-turno) añade al final del mensaje de Telegram el
// enlace al informe del día y, si esa noche es de domingo, al de la
// semana. En vez de mandarlos como mensajes sueltos, van dentro del
// mismo mensaje.
//
// Este módulo solo hace dos cosas: decidir qué informes corresponden a
// un cierre y pedírselos a la Edge Function generar-informe-periodo con
// `enviar: false` (que los genera si no existen, o devuelve el ya
// generado — es idempotente). La petición va por HTTP y no importando
// el generador a propósito: cada Edge Function tiene su propio
// presupuesto de CPU, y así el PDF del turno y los del periodo no
// compiten dentro de una sola invocación.
//
// NUNCA lanza excepción: si un informe falla o tarda demasiado, el
// resumen del turno se envía igualmente sin ese enlace, y el cron de
// respaldo de informes (fn_encolar_informes_periodo_pendientes) lo
// mandará como mensaje suelto.

import { sumarDiasISO } from "./informe-periodo-datos.ts";

export type TipoInformeCierre = "diario" | "semanal";

export interface PeriodoPedido {
  tipo: TipoInformeCierre;
  desde: string;
}

export interface InformePeriodoIncluido {
  tipo: TipoInformeCierre;
  desde: string;
  hasta: string;
  pdfUrl: string;
  m2Total: number;
}

/**
 * Qué informes corresponden al cierre del turno N de `fechaTurnoN`:
 * el diario de esa fecha y, si esa fecha es domingo, el semanal que
 * empieza el lunes anterior (fecha - 6).
 */
export function periodosDelCierre(fechaTurnoN: string): PeriodoPedido[] {
  const periodos: PeriodoPedido[] = [{ tipo: "diario", desde: fechaTurnoN }];
  const [y, m, d] = fechaTurnoN.split("-").map(Number);
  const esDomingo = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
  if (esDomingo) periodos.push({ tipo: "semanal", desde: sumarDiasISO(fechaTurnoN, -6) });
  return periodos;
}

interface OpcionesPedido {
  timeoutMs?: number;
  /** Solo para pruebas. */
  fetchImpl?: typeof fetch;
}

async function pedirInforme(
  baseUrl: string,
  serviceRoleKey: string,
  periodo: PeriodoPedido,
  opciones: OpcionesPedido,
): Promise<InformePeriodoIncluido | null> {
  const hacerFetch = opciones.fetchImpl ?? fetch;
  try {
    const res = await hacerFetch(`${baseUrl}/functions/v1/generar-informe-periodo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      // enviar:false — el aviso lo manda el propio resumen de turno.
      body: JSON.stringify({ tipo: periodo.tipo, desde: periodo.desde, enviar: false }),
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 60_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = await res.json();
    // `omitido`: la ventana no tiene ningún turno (cierre de fábrica).
    if (json.omitido || typeof json.pdf_url !== "string") return null;
    return {
      tipo: periodo.tipo,
      desde: json.desde ?? periodo.desde,
      hasta: json.hasta ?? periodo.desde,
      pdfUrl: json.pdf_url,
      m2Total: Number(json.resumen?.m2_total ?? 0),
    };
  } catch (err) {
    console.error(`No se pudo obtener el informe ${periodo.tipo} de ${periodo.desde} para el resumen de turno:`, err);
    return null;
  }
}

/** Pide (en paralelo) los informes de un cierre de turno N. Nunca lanza. */
export async function pedirInformesDelCierre(
  baseUrl: string,
  serviceRoleKey: string,
  fechaTurnoN: string,
  opciones: OpcionesPedido = {},
): Promise<InformePeriodoIncluido[]> {
  const resultados = await Promise.all(
    periodosDelCierre(fechaTurnoN).map((p) => pedirInforme(baseUrl, serviceRoleKey, p, opciones)),
  );
  return resultados.filter((r): r is InformePeriodoIncluido => r !== null);
}
