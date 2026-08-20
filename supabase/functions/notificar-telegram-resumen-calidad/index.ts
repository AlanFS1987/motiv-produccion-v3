// supabase/functions/notificar-telegram-resumen-calidad/index.ts
//
// Grupo "Resúmenes calidad" (06-integraciones.md, grupo 2). Digest de
// todos los lotes marcados `finalizado` desde el último envío, con su
// desglose de m² por categoría (1ª / comercial / contenedor).
//
// NUNCA la llama el frontend — solo pg_net desde dentro de Postgres,
// vía fn_disparar_resumen_calidad, disparada por el cron
// 'resumen-calidad-diario' (20260817140000_resumen_calidad_diario.sql),
// 3 veces al día (7:00/15:00/23:00 Madrid, mismas franjas que los
// cambios de turno).
//
// Si no hay ningún lote pendiente de enviar, no se manda mensaje —
// mismo criterio que 06-integraciones.md.
//
// Reimplementa areaM2DeFormato/m2DePiezas (ya existen en
// _shared/formato.ts) para el cálculo de m² por categoría.

import { createClient } from "npm:@supabase/supabase-js@2";
import { m2DePiezas } from "../_shared/formato.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_RESUMEN_CALIDAD = Deno.env.get("TELEGRAM_CHAT_RESUMEN_CALIDAD");
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Margen por debajo del límite real de Telegram (4096 caracteres),
// mismo patrón que generar-resumen-turno.
const LIMITE_TELEGRAM = 3500;

// Supabase a veces devuelve una relación anidada como array de 1, a
// veces como objeto — mismo patrón que el resto del proyecto.
// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatearM2(m2: number): string {
  return `${m2.toFixed(2)} m²`;
}
function formatearPct(numerador: number, denominador: number): string {
  if (denominador <= 0) return "—";
  return `${((numerador / denominador) * 100).toFixed(1)}%`;
}

interface LotePendiente {
  id: string;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
}

async function buscarLotesPendientes(): Promise<LotePendiente[]> {
  const { data, error } = await supabase
    .from("lote")
    .select(`
      id, numero_orden,
      producto:producto_id (
        modelo:modelo_id ( nombre ),
        marca:marca_id ( nombre ),
        formato:formato_id ( nombre )
      )
    `)
    .eq("estado", "finalizado")
    .is("resumen_calidad_enviado_at", null);

  if (error) throw error;

  return (data ?? []).map((fila: any) => {
    const producto = uno<any>(fila.producto);
    const modelo = uno<any>(producto?.modelo);
    const marca = uno<any>(producto?.marca);
    const formato = uno<any>(producto?.formato);
    return {
      id: fila.id,
      numeroOrden: fila.numero_orden ?? "—",
      modeloNombre: modelo?.nombre ?? "—",
      marcaNombre: marca?.nombre ?? "—",
      formatoNombre: formato?.nombre ?? "—",
    };
  });
}

interface DesgloseM2 {
  m2_1a: number;
  m2Comercial: number;
  m2Contenedor: number;
  tonos: string[];
}

async function calcularDesgloseLote(loteId: string, formatoNombre: string): Promise<DesgloseM2> {
  const { data, error } = await supabase
    .from("parte")
    .select("piezas_1a, piezas_comercial, piezas_contenedor, tono")
    .eq("lote_id", loteId)
    .eq("vigente", true);

  if (error) throw error;

  let piezas1a = 0;
  let piezasComercial = 0;
  let piezasContenedor = 0;
  const tonosSet = new Set<string>();
  for (const fila of data ?? []) {
    piezas1a += fila.piezas_1a ?? 0;
    piezasComercial += fila.piezas_comercial ?? 0;
    piezasContenedor += fila.piezas_contenedor ?? 0;
    if (fila.tono) tonosSet.add(fila.tono);
  }

  return {
    m2_1a: m2DePiezas(piezas1a, formatoNombre),
    m2Comercial: m2DePiezas(piezasComercial, formatoNombre),
    m2Contenedor: m2DePiezas(piezasContenedor, formatoNombre),
    tonos: Array.from(tonosSet),
  };
}

Deno.serve(async (req) => {
  const secretRecibido = req.headers.get("x-webhook-secret");
  if (secretRecibido !== WEBHOOK_SECRET) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const lotes = await buscarLotesPendientes();

    // Sin lotes pendientes -> no se manda mensaje (06-integraciones.md).
    if (lotes.length === 0) {
      return new Response(JSON.stringify({ ok: true, mensaje: "Sin lotes pendientes, no se envía nada." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_RESUMEN_CALIDAD) {
      throw new Error(
        "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_RESUMEN_CALIDAD en los secrets de la Edge Function " +
          "(configúralos con: supabase secrets set TELEGRAM_CHAT_RESUMEN_CALIDAD=...)",
      );
    }

    const bloques: string[] = [
      `📊 <b>RESUMEN DE CALIDAD — ${lotes.length} lote${lotes.length === 1 ? "" : "s"} finalizado${lotes.length === 1 ? "" : "s"}</b>`,
    ];

    const loteIdsEnviados: string[] = [];

    for (const lote of lotes) {
      const desglose = await calcularDesgloseLote(lote.id, lote.formatoNombre);
      const totalOficial = desglose.m2_1a + desglose.m2Comercial;
      const totalCompleta = desglose.m2_1a + desglose.m2Comercial + desglose.m2Contenedor;
      const tonosTexto = desglose.tonos.length > 0 ? desglose.tonos.join(", ") : "—";

      bloques.push(
        [
          `Orden ${lote.numeroOrden}`,
          `${lote.marcaNombre} ${lote.formatoNombre}`,
          `<b>${lote.modeloNombre}</b> Tono ${tonosTexto}`,
          ``,
          `<b>Calidad oficial</b>`,
          `1ª: ${formatearPct(desglose.m2_1a, totalOficial)} · ${formatearM2(desglose.m2_1a)}`,
          `Comercial: ${formatearPct(desglose.m2Comercial, totalOficial)} · ${formatearM2(desglose.m2Comercial)}`,
          ``,
          `<b>Calidad completa</b>`,
          `1ª: ${formatearPct(desglose.m2_1a, totalCompleta)} · ${formatearM2(desglose.m2_1a)}`,
          `Comercial: ${formatearPct(desglose.m2Comercial, totalCompleta)} · ${formatearM2(desglose.m2Comercial)}`,
          `Descarte: ${formatearPct(desglose.m2Contenedor, totalCompleta)} · ${formatearM2(desglose.m2Contenedor)}`,
        ].join("\n"),
      );
      loteIdsEnviados.push(lote.id);
    }

    // Partir en varios mensajes si hace falta, siempre en un límite de
    // bloque completo — mismo patrón que generar-resumen-turno.
    const mensajes: string[] = [];
    let actual = "";
    for (const bloque of bloques) {
      const candidato = actual ? `${actual}\n\n${bloque}` : bloque;
      if (candidato.length > LIMITE_TELEGRAM && actual) {
        mensajes.push(actual);
        actual = bloque;
      } else {
        actual = candidato;
      }
    }
    if (actual) mensajes.push(actual);

    for (const texto of mensajes) {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_RESUMEN_CALIDAD, text: texto, parse_mode: "HTML" }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error enviando a Telegram (${res.status}): ${errText}`);
      }
    }

    // Marcar SOLO tras un envío con éxito — evita que un lote se
    // repita en un futuro digest, y si algo falla a mitad, ningún
    // lote queda marcado como enviado sin haberlo estado de verdad.
    const { error: marcarErr } = await supabase
      .from("lote")
      .update({ resumen_calidad_enviado_at: new Date().toISOString() })
      .in("id", loteIdsEnviados);
    if (marcarErr) {
      console.error("Digest enviado, pero no se pudo marcar resumen_calidad_enviado_at:", marcarErr);
    }

    return new Response(
      JSON.stringify({ ok: true, lotes_enviados: loteIdsEnviados.length, mensajes_enviados: mensajes.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error en notificar-telegram-resumen-calidad:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});