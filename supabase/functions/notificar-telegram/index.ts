// supabase/functions/notificar-telegram/index.ts
//
// Recibe un aviso desde un trigger de Postgres (o desde una llamada de
// prueba manual) diciendo QUÉ pasó (tipo) y de QUÉ fila (id).
// Esta función busca los datos completos en Supabase (con la service
// role, no depende de que el que llama tenga permisos) y manda el
// mensaje a Telegram, al grupo que corresponda.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_CALIDAD = Deno.env.get("TELEGRAM_CHAT_CALIDAD")!;
const TELEGRAM_CHAT_PRODUCCION = Deno.env.get("TELEGRAM_CHAT_PRODUCCION")!;
const TELEGRAM_CHAT_NUEVOS_LOTES = Deno.env.get("TELEGRAM_CHAT_NUEVOS_LOTES")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Pequeña ayuda: en Supabase, una relación anidada a veces llega como
// objeto y a veces como array de 1 elemento (lección de sesión 15/08).
// Esta función siempre devuelve el objeto, sea como sea que llegó.
function uno<T>(valor: T | T[] | null): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid",
    hour: "2-digit", minute: "2-digit",
  });
}

async function buscarOperario(turnoId: number, lineaId: number | null): Promise<string> {
  if (!lineaId) return "—";
  const { data } = await supabase
    .from("asignacion_operario_linea")
    .select("operario:operario_id(username)")
    .eq("turno_id", turnoId)
    .eq("linea_id", lineaId)
    .maybeSingle();
  const operario = uno<{ username: string }>(data?.operario ?? null);
  return operario?.username ?? "—";
}

async function enviarTelegram(chatId: string, texto: string, fotos: string[]) {
  const base = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  if (fotos.length === 0) {
    await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "HTML" }),
    });
  } else if (fotos.length === 1) {
    await fetch(`${base}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: fotos[0], caption: texto, parse_mode: "HTML" }),
    });
  } else {
    const media = fotos.map((url, i) => ({
      type: "photo",
      media: url,
      ...(i === 0 ? { caption: texto, parse_mode: "HTML" } : {}),
    }));
    await fetch(`${base}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, media }),
    });
  }
}

async function manejarIncidenciaCalidad(id: number) {
  const { data, error } = await supabase
    .from("incidencia_calidad")
    .select(`
      descripcion, fotos, created_at,
      parte:parte_id (
        tono, turno_id, linea_id,
        responsable:responsable_id ( username ),
        turno:turno_id ( fecha, tipo ),
        linea:linea_id ( nombre ),
        lote:lote_id (
          producto:producto_id (
            modelo:modelo_id ( nombre ),
            marca:marca_id ( nombre )
          )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) { console.error("incidencia_calidad no encontrada", error); return; }

  const parte = uno<any>(data.parte);
  const responsable = uno<any>(parte?.responsable);
  const turno = uno<any>(parte?.turno);
  const linea = uno<any>(parte?.linea);
  const lote = uno<any>(parte?.lote);
  const producto = uno<any>(lote?.producto);
  const modelo = uno<any>(producto?.modelo);

  const operario = await buscarOperario(parte.turno_id, parte.linea_id);

  const texto =
    `🔴 <b>INCIDENCIA DE CALIDAD</b>\n\n` +
    `${modelo?.nombre ?? "—"} · tono ${parte?.tono ?? "—"}\n` +
    `Turno ${turno?.tipo ?? "—"} · ${linea?.nombre ?? "—"}\n` +
    `Resp: ${responsable?.username ?? "—"} · Operario: ${operario}\n\n` +
    `"${data.descripcion}"\n\n` +
    `${formatFecha(data.created_at)}`;

  await enviarTelegram(TELEGRAM_CHAT_CALIDAD, texto, data.fotos ?? []);
}

async function manejarIncidenciaProduccion(id: number) {
  const { data, error } = await supabase
    .from("incidencia_produccion")
    .select(`
      descripcion, fotos, created_at, turno_id, linea_id,
      responsable:created_by ( username ),
      turno:turno_id ( fecha, tipo ),
      linea:linea_id ( nombre )
    `)
    .eq("id", id)
    .single();

  if (error || !data) { console.error("incidencia_produccion no encontrada", error); return; }

  const responsable = uno<any>(data.responsable);
  const turno = uno<any>(data.turno);
  const linea = uno<any>(data.linea);
  const operario = await buscarOperario(data.turno_id, data.linea_id);

  const texto =
    `🟠 <b>INCIDENCIA DE PRODUCCIÓN</b>\n\n` +
    `Turno ${turno?.tipo ?? "—"} · ${linea?.nombre ?? "Todo el turno"}\n` +
    `Resp: ${responsable?.username ?? "—"} · Operario: ${operario}\n\n` +
    `"${data.descripcion}"\n\n` +
    `${formatFecha(data.created_at)}`;

  await enviarTelegram(TELEGRAM_CHAT_PRODUCCION, texto, data.fotos ?? []);
}
const TEXTO_VERIFICACION: Record<string, string> = {
  correcto: "✅ OCR correcto",
  incorrecto: "❌ OCR incorrecto",
  no_verificable: "⚠️ No verificable",
  verificado_manual: "✍️ Verificado a mano",
};

async function manejarNuevoLote(id: number) {
  const { data, error } = await supabase
    .from("parte")
    .select(`
      tono, turno_id, linea_id, verificacion_caja_estado, verificacion_caja_detalle, fotos_caja, created_at,
      responsable:responsable_id ( username ),
      turno:turno_id ( fecha, tipo ),
      linea:linea_id ( nombre ),
      lote:lote_id (
        numero_orden,
        producto:producto_id (
          modelo:modelo_id ( nombre ),
          marca:marca_id ( nombre ),
          formato:formato_id ( nombre )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) { console.error("parte no encontrado (nuevo_lote)", error); return; }

  const responsable = uno<any>(data.responsable);
  const turno = uno<any>(data.turno);
  const linea = uno<any>(data.linea);
  const lote = uno<any>(data.lote);
  const producto = uno<any>(lote?.producto);
  const modelo = uno<any>(producto?.modelo);
  const marca = uno<any>(producto?.marca);
  const formato = uno<any>(producto?.formato);

  const operario = await buscarOperario(data.turno_id, data.linea_id);
  const ICONO_CAMPO: Record<string, string> = {
    correcto: "✅",
    incorrecto: "❌",
    no_verificable: "⚠️",
  };

  const detalle = Array.isArray(data.verificacion_caja_detalle) ? data.verificacion_caja_detalle : [];
  const lineasDetalle = detalle
    .map((c: any) => {
      const icono = ICONO_CAMPO[c.estado] ?? "•";
      if (c.estado === "correcto") {
        return `${icono} ${c.etiqueta}: ${c.valorLeido ?? "—"}`;
      }
      return `${icono} ${c.etiqueta}: esperado "${c.valorEsperado ?? "—"}", leído "${c.valorLeido ?? "—"}"`;
    })
    .join("\n");
  const verificacion =
    TEXTO_VERIFICACION[data.verificacion_caja_estado ?? ""] ?? (data.verificacion_caja_estado ?? "—");

  const texto =
    `📦 <b>NUEVO LOTE VERIFICADO</b>\n\n` +
    `Orden ${lote?.numero_orden ?? "—"} · ${modelo?.nombre ?? "—"} · ${marca?.nombre ?? "—"}\n` +
    `Formato ${formato?.nombre ?? "—"} · Tono ${data.tono ?? "—"}\n` +
    `Turno ${turno?.tipo ?? "—"} · ${linea?.nombre ?? "—"}\n` +
    `Resp: ${responsable?.username ?? "—"} · Operario: ${operario}\n` +
    `Verificación: ${verificacion}\n` +
    (lineasDetalle ? `${lineasDetalle}\n\n` : `\n`) +
    `${formatFecha(data.created_at)}`;

  await enviarTelegram(TELEGRAM_CHAT_NUEVOS_LOTES, texto, data.fotos_caja ?? []);
}

Deno.serve(async (req) => {
  // Comprobamos la "contraseña" compartida antes de hacer nada.
  const secretRecibido = req.headers.get("x-webhook-secret");
  if (secretRecibido !== WEBHOOK_SECRET) {
    return new Response("No autorizado", { status: 401 });
  }

  const { tipo, id } = await req.json();

  try {
    if (tipo === "incidencia_calidad") {
      await manejarIncidenciaCalidad(id);
    } else if (tipo === "incidencia_produccion") {
      await manejarIncidenciaProduccion(id);
    } else if (tipo === "nuevo_lote") {
      await manejarNuevoLote(id);  
    } else {
      return new Response(`Tipo desconocido: ${tipo}`, { status: 400 });
    }
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Error interno", { status: 500 });
  }
});