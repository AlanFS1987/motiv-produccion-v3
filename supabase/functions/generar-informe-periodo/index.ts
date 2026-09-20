// Edge Function: generar-informe-periodo
//
// Genera el informe DIARIO (turnos M+T+N de un día) o SEMANAL (lunes M
// -> domingo N), sube el PDF a Cloudinary, lo registra en
// `informe_periodo` y, si se pide, avisa por Telegram con el enlace.
// Diseño y estructura del PDF: pdf-informe-periodo.ts; consultas y
// agregación: informe-periodo-datos.ts. Sesión 20/09/2026.
//
// LLAMADA (POST, JSON):
//   { "tipo": "diario" | "semanal",
//     "desde": "AAAA-MM-DD",     // fecha de turno; en semanal, un lunes
//     "enviar": true,            // opcional, por defecto false
//     "regenerar": true }        // opcional: rehace el PDF aunque exista
//
//   - "diario": desde = la fecha del día de producción (M, T y N con esa
//     fecha; el N acaba a las 06:00 del día siguiente).
//   - "semanal": desde = el lunes; incluye hasta el domingo (7 días).
//
// IDEMPOTENTE: (tipo, desde) es único en `informe_periodo`. Si el PDF
// ya existe se reutiliza (salvo `regenerar`), y el aviso a Telegram no
// se repite si ya salió (salvo `regenerar`): el envío se reclama con un
// UPDATE atómico sobre `enviado_at`, así que aunque el trigger y el cron
// de respaldo lo pidan a la vez, solo uno manda el mensaje.
//
// AUTENTICACIÓN: se despliega con --no-verify-jwt (para que pueda
// llamarla la base de datos vía pg_net, como generar-resumen-turno) y
// se comprueba aquí dentro que la petición trae o bien el secreto
// compartido (cabecera x-webhook-secret, el mismo de
// app_secrets.telegram_webhook_secret) o bien la service_role key como
// Bearer. Nunca la llama el navegador.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
// TELEGRAM_CHAT_RESUMEN_TURNO (o TELEGRAM_CHAT_INFORMES si se quiere un
// grupo distinto para estos informes), CLOUDINARY_CLOUD_NAME y
// CLOUDINARY_PRESET_INFORMES_TURNO (el mismo preset que los informes de
// turno).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { formatearFecha, formatearM2 } from "../_shared/pdf-comun.ts";
import {
  calcularVentana,
  cargarFilasPeriodo,
  construirDatosInformePeriodo,
  resumenDeInforme,
} from "../_shared/informe-periodo-datos.ts";
import {
  formatearPorcentaje,
  generarPdfInformePeriodo,
  type TipoInformePeriodo,
} from "../_shared/pdf-informe-periodo.ts";
import { construirPublicIdInformePeriodo, subirInformePdfACloudinary } from "../_shared/cloudinary.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_INFORMES =
  Deno.env.get("TELEGRAM_CHAT_INFORMES") ?? Deno.env.get("TELEGRAM_CHAT_RESUMEN_TURNO");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RequestBody {
  tipo?: string;
  desde?: string;
  enviar?: boolean;
  regenerar?: boolean;
}

type ResumenInforme = ReturnType<typeof resumenDeInforme>;

async function peticionAutorizada(req: Request): Promise<boolean> {
  if (req.headers.get("Authorization") === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) return true;

  const secretoRecibido = req.headers.get("x-webhook-secret");
  if (!secretoRecibido) return false;
  const { data, error } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("key", "telegram_webhook_secret")
    .maybeSingle();
  if (error) {
    console.error("No se pudo leer app_secrets para validar la petición:", error);
    return false;
  }
  return !!data?.value && data.value === secretoRecibido;
}

/** Mensaje corto de Telegram (HTML): totales + enlace. El detalle va en el PDF. */
function textoTelegram(
  tipo: TipoInformePeriodo,
  desde: string,
  hasta: string,
  r: ResumenInforme,
  pdfUrl: string,
): string {
  const titulo =
    tipo === "diario"
      ? `📊 <b>INFORME DIARIO — ${formatearFecha(desde)}</b>`
      : `📊 <b>INFORME SEMANAL — ${formatearFecha(desde)} al ${formatearFecha(hasta)}</b>`;

  const lineas = [
    titulo,
    `Turnos incluidos: ${r.turnos_registrados} de ${r.turnos_esperados}`,
    `m² totales: <b>${formatearM2(r.m2_total)}</b>`,
    `1ª ${formatearM2(r.m2_1a)} (${formatearPorcentaje(r.m2_1a, r.m2_total)}) · ` +
      `Comercial ${formatearM2(r.m2_comercial)} (${formatearPorcentaje(r.m2_comercial, r.m2_total)}) · ` +
      `Contenedor ${formatearM2(r.m2_contenedor)} (${formatearPorcentaje(r.m2_contenedor, r.m2_total)})`,
    `Lotes con producción: ${r.lotes} · Incidencias: ${r.incidencias}`,
  ];
  if (r.turnos_faltantes.length > 0) {
    const listados = r.turnos_faltantes.slice(0, 10).join(", ");
    const resto = r.turnos_faltantes.length - 10;
    lineas.push(`⚠️ Sin turno registrado: ${listados}${resto > 0 ? ` y ${resto} más` : ""}`);
  }
  if (r.turnos_sin_cerrar > 0) {
    lineas.push(`⚠️ ${r.turnos_sin_cerrar} turno(s) sin cerrar al generar el informe`);
  }
  lineas.push(`📄 <a href="${pdfUrl}">Informe completo en PDF</a>`);
  return lineas.join("\n");
}

async function enviarATelegram(texto: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_INFORMES) {
    throw new Error(
      "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_INFORMES / TELEGRAM_CHAT_RESUMEN_TURNO en los secrets " +
        "de la Edge Function (supabase secrets set ...)",
    );
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_INFORMES, text: texto, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    throw new Error(`Error enviando a Telegram (${res.status}): ${await res.text()}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Método no permitido, usa POST", 405);
  }
  if (!(await peticionAutorizada(req))) {
    return jsonError("No autorizado", 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  if (body.tipo !== "diario" && body.tipo !== "semanal") {
    return jsonError('`tipo` debe ser "diario" o "semanal"', 400);
  }
  const tipo: TipoInformePeriodo = body.tipo;
  if (!body.desde) {
    return jsonError("Falta `desde` (AAAA-MM-DD)", 400);
  }

  let ventana: { desde: string; hasta: string };
  try {
    ventana = calcularVentana(tipo, body.desde);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Fecha no válida", 400);
  }

  const enviar = body.enviar === true;
  const regenerar = body.regenerar === true;

  try {
    // 1) ¿Ya existe este informe?
    const { data: existente, error: existenteErr } = await supabase
      .from("informe_periodo")
      .select("pdf_url, resumen, enviado_at")
      .eq("tipo", tipo)
      .eq("desde", ventana.desde)
      .maybeSingle();
    if (existenteErr) throw existenteErr;

    let pdfUrl: string | null = existente?.pdf_url ?? null;
    let resumen: ResumenInforme | null = (existente?.resumen as ResumenInforme | null) ?? null;
    let generado = false;

    // 2) Generar PDF y subirlo (si no existe o se pide rehacerlo).
    if (!pdfUrl || !resumen || regenerar) {
      const filas = await cargarFilasPeriodo(supabase, ventana.desde, ventana.hasta);
      if (filas.turnos.length === 0) {
        // Cierre de fábrica o ventana sin ningún turno: no hay nada que informar.
        return jsonOk({
          omitido: true,
          motivo: "No hay ningún turno registrado en el periodo",
          tipo,
          desde: ventana.desde,
          hasta: ventana.hasta,
        });
      }

      const datos = construirDatosInformePeriodo(tipo, ventana.desde, ventana.hasta, filas);
      const pdfBytes = await generarPdfInformePeriodo(datos);
      const subida = await subirInformePdfACloudinary(
        pdfBytes,
        construirPublicIdInformePeriodo(tipo, ventana.desde),
      );
      pdfUrl = subida.url;
      resumen = resumenDeInforme(datos);

      const { error: guardarErr } = await supabase.from("informe_periodo").upsert(
        {
          tipo,
          desde: ventana.desde,
          hasta: ventana.hasta,
          pdf_url: pdfUrl,
          resumen,
          generado_at: new Date().toISOString(),
        },
        { onConflict: "tipo,desde" },
      );
      if (guardarErr) throw guardarErr;
      generado = true;
    }

    // 3) Aviso a Telegram. Una sola vez: el derecho a enviar se RECLAMA
    // de forma atómica (UPDATE ... WHERE enviado_at IS NULL), de modo que
    // si el disparo por trigger y el cron de respaldo coinciden, solo uno
    // de los dos manda el mensaje. Con `regenerar` se libera antes la
    // marca para poder volver a enviar a propósito.
    let enviado = false;
    if (enviar) {
      if (regenerar) {
        const { error: liberarErr } = await supabase
          .from("informe_periodo")
          .update({ enviado_at: null })
          .eq("tipo", tipo)
          .eq("desde", ventana.desde);
        if (liberarErr) throw liberarErr;
      }

      const { data: reclamado, error: reclamarErr } = await supabase
        .from("informe_periodo")
        .update({ enviado_at: new Date().toISOString() })
        .eq("tipo", tipo)
        .eq("desde", ventana.desde)
        .is("enviado_at", null)
        .select("id");
      if (reclamarErr) throw reclamarErr;

      if ((reclamado?.length ?? 0) > 0) {
        try {
          await enviarATelegram(textoTelegram(tipo, ventana.desde, ventana.hasta, resumen!, pdfUrl!));
          enviado = true;
        } catch (err) {
          // El aviso no salió: se suelta la marca para que un reintento
          // (el cron de respaldo) pueda volver a intentarlo.
          await supabase
            .from("informe_periodo")
            .update({ enviado_at: null })
            .eq("tipo", tipo)
            .eq("desde", ventana.desde);
          throw err;
        }
      }
    }

    return jsonOk({
      tipo,
      desde: ventana.desde,
      hasta: ventana.hasta,
      pdf_url: pdfUrl,
      generado,
      enviado,
      resumen,
    });
  } catch (err) {
    console.error("Error en generar-informe-periodo:", err);
    // Los errores de Supabase son objetos con `message`, no instancias de Error.
    const mensaje =
      err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Error desconocido";
    return jsonError(mensaje, 500);
  }
});
