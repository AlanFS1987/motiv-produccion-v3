// Edge Function: generar-resumen-turno
// Ref. 01-rol-responsable.md 3.9b, 06-integraciones.md (grupo
// "Resumen de turno"), 11-esquema-supabase.md 13.7.
//
// NUNCA la llama el frontend directamente — solo la base de datos, vía
// pg_net, siempre a través del mismo disparo (fn_disparar_resumen_turno),
// activado por UN único trigger sobre `turno.cerrado_at` — lo único
// que cambia es CÓMO se llega a escribir esa columna:
//   1. Cierre manual: la app hace un simple UPDATE al pulsar "Cerrar
//      turno" (lib/turno.ts -> cerrarTurnoManualmente) — el propio
//      UPDATE dispara el trigger `trg_turno_resumen_cierre` (mismo
//      patrón que incidencia_calidad/incidencia_producción ->
//      notificar-telegram).
//   2. Cierre automático por reloj (nadie pulsa nada): el cron
//      `resumenes-turno-pendientes` (cada 15 min) es quien escribe
//      `cerrado_at` cuando corresponde — ese UPDATE dispara el MISMO
//      trigger. El cron también sirve de reintento si algún envío
//      quedó sin confirmar.
// Ver 20260816230000_resumen_turno_automatico.sql.
//
// Compila el mismo informe jerárquico que lib/resumen-turno.ts
// calcula en el frontend para la pestaña Resumen — se reimplementa
// aquí porque una Edge Function (Deno) no puede importar código del
// frontend (Vite/navegador), mismo patrón de duplicación intencional
// que ya existe entre lib/normalizacion.ts y _shared/normalizacion.ts.
//
// Marca `turno.resumen_enviado_at` tras un envío con éxito — es lo
// que evita que el cron reenvíe el mismo informe si el trigger ya lo
// mandó a tiempo.
//
// PDF (30/08/2026): al cerrar el turno, además de mandar el resumen a
// Telegram, se genera un PDF con el mismo informe (incluyendo fotos
// de las incidencias) y se sube a Cloudinary. La URL se guarda en
// turno.informe_pdf_url y se añade como último bloque del mensaje de
// Telegram. Si la generación/subida del PDF falla, NO se aborta el
// envío del resumen — se registra el error y el turno se queda con
// informe_pdf_url = null (ver paso 7b).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { m2DePiezas } from "../_shared/formato.ts";
import { generarPdfInformeTurno, type DatosInformeTurnoPdf } from "../_shared/pdf-informe-turno.ts";
import { subirInformePdfACloudinary, construirPublicIdInformeTurno } from "../_shared/cloudinary.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_RESUMEN_TURNO = Deno.env.get("TELEGRAM_CHAT_RESUMEN_TURNO");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NOMBRE_TIPO: Record<string, string> = { M: "Mañana", T: "Tarde", N: "Noche" };
// Margen por debajo del límite real de Telegram (4096 caracteres por
// mensaje) — deja hueco para no rozarlo por cuentas mal hechas.
const LIMITE_TELEGRAM = 3500;

interface TiemposAgregados {
  plena: number;
  noAlimentada: number;
  saturacion: number;
  banco: number;
  maquina: number;
}

function tiemposVacios(): TiemposAgregados {
  return { plena: 0, noAlimentada: 0, saturacion: 0, banco: 0, maquina: 0 };
}

/** Supabase a veces devuelve una relación anidada como array de 1, a veces como objeto. */
// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatearM2(valor: number): string {
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m²`;
}

function formatearTiempos(t: TiemposAgregados): string {
  return `Plena ${t.plena}m · No aliment. ${t.noAlimentada}m · Saturación ${t.saturacion}m · Banco ${t.banco}m · Máquina ${t.maquina}m`;
}

function formatearFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

/** Telegram con parse_mode HTML: escapar &, <, > en cualquier texto libre (descripciones de incidencias, nombres). */
function escapeHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Una incidencia con sus fotos (antes solo se guardaba la descripción). */
interface IncidenciaConFotos {
  descripcion: string;
  fotos: string[];
}

interface RequestBody {
  turno_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Método no permitido, usa POST", 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  const turnoId = body.turno_id;
  if (!turnoId) {
    return jsonError("Falta turno_id", 400);
  }

  try {
    // 1) Turno + responsable que lo abrió.
    const { data: turnoRow, error: turnoErr } = await supabase
      .from("turno")
      .select("fecha, tipo, responsable:abierto_por ( username )")
      .eq("id", turnoId)
      .single();
    if (turnoErr) throw turnoErr;
    // deno-lint-ignore no-explicit-any
    const responsable = uno<{ username: string }>(turnoRow.responsable as any);

    // 2) Las 6 líneas fijas, siempre en el mismo orden.
    const { data: lineasRows, error: lineasErr } = await supabase
      .from("linea")
      .select("id, nombre")
      .order("nombre");
    if (lineasErr) throw lineasErr;

    // 3) Operario asignado a cada línea en este turno.
    const { data: asignRows, error: asignErr } = await supabase
      .from("asignacion_operario_linea")
      .select("linea_id, operario:operario_id ( username )")
      .eq("turno_id", turnoId);
    if (asignErr) throw asignErr;
    const operarioPorLinea = new Map<string, string>();
    for (const a of asignRows ?? []) {
      // deno-lint-ignore no-explicit-any
      const op = uno<{ username: string }>(a.operario as any);
      if (op?.username) operarioPorLinea.set(a.linea_id, op.username);
    }

    // 4) Partes vigentes con PRODUCCIÓN REAL (se omiten los que están
    // a 0 o sin completar, 3.9b).
    const { data: partesRows, error: partesErr } = await supabase
      .from("parte")
      .select(
        `id, linea_id, tono, piezas_1a, piezas_comercial, piezas_contenedor, piezas_entradas,
         minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
         lote:lote_id (
           producto:producto_id (
             modelo:modelo_id ( nombre ),
             formato:formato_id ( nombre )
           )
         )`,
      )
      .eq("turno_id", turnoId)
      .eq("vigente", true)
      .eq("completado", true)
      .gt("piezas_entradas", 0)
      .order("created_at", { ascending: true });
    if (partesErr) throw partesErr;

    // deno-lint-ignore no-explicit-any
    const parteIds = (partesRows ?? []).map((p: any) => p.id as string);

    // 5) Incidencias de calidad colgadas de esos partes. Se pide
    // también "fotos" (antes solo "descripcion") para poder
    // incrustarlas en el PDF — ver paso 7b.
    const incidenciasCalidadPorParte = new Map<string, IncidenciaConFotos[]>();
    if (parteIds.length > 0) {
      const { data: icRows, error: icErr } = await supabase
        .from("incidencia_calidad")
        .select("parte_id, descripcion, fotos")
        .in("parte_id", parteIds);
      if (icErr) throw icErr;
      for (const ic of icRows ?? []) {
        const lista = incidenciasCalidadPorParte.get(ic.parte_id) ?? [];
        lista.push({ descripcion: ic.descripcion, fotos: ic.fotos ?? [] });
        incidenciasCalidadPorParte.set(ic.parte_id, lista);
      }
    }

    // 6) Incidencias de producción del turno — por línea, y generales.
    // Mismo cambio que el paso 5: ahora se pide también "fotos".
    const { data: ipRows, error: ipErr } = await supabase
      .from("incidencia_produccion")
      .select("linea_id, descripcion, fotos")
      .eq("turno_id", turnoId);
    if (ipErr) throw ipErr;
    const incidenciasProduccionPorLinea = new Map<string, IncidenciaConFotos[]>();
    const incidenciasGenerales: IncidenciaConFotos[] = [];
    for (const ip of ipRows ?? []) {
      const item: IncidenciaConFotos = { descripcion: ip.descripcion, fotos: ip.fotos ?? [] };
      if (ip.linea_id) {
        const lista = incidenciasProduccionPorLinea.get(ip.linea_id) ?? [];
        lista.push(item);
        incidenciasProduccionPorLinea.set(ip.linea_id, lista);
      } else {
        incidenciasGenerales.push(item);
      }
    }

    // 7) Agregar partes por línea: m² por categoría + tiempos.
    interface ParteInforme {
      modeloNombre: string;
      formatoNombre: string;
      tono: string;
      m2_1a: number;
      m2Comercial: number;
      m2Contenedor: number;
      piezas1a: number;
      piezasComercial: number;
      piezasContenedor: number;
      incidenciasCalidad: IncidenciaConFotos[];
    }
    interface AcumuladorLinea {
      m2: number;
      tiempos: TiemposAgregados;
      partes: ParteInforme[];
    }
    const acumPorLinea = new Map<string, AcumuladorLinea>();
    function obtenerAcum(lineaId: string): AcumuladorLinea {
      let a = acumPorLinea.get(lineaId);
      if (!a) {
        a = { m2: 0, tiempos: tiemposVacios(), partes: [] };
        acumPorLinea.set(lineaId, a);
      }
      return a;
    }

    const tiemposTotales = tiemposVacios();
    let m2TotalTurno = 0;

    for (const p of partesRows ?? []) {
      // deno-lint-ignore no-explicit-any
      const lote = uno<any>(p.lote);
      // deno-lint-ignore no-explicit-any
      const producto = uno<any>(lote?.producto);
      // deno-lint-ignore no-explicit-any
      const modelo = uno<any>(producto?.modelo);
      // deno-lint-ignore no-explicit-any
      const formato = uno<any>(producto?.formato);
      const formatoNombre = formato?.nombre ?? null;

      const m2_1a = m2DePiezas(p.piezas_1a, formatoNombre);
      const m2Comercial = m2DePiezas(p.piezas_comercial, formatoNombre);
      const m2Contenedor = m2DePiezas(p.piezas_contenedor, formatoNombre);
      const m2Parte = m2_1a + m2Comercial + m2Contenedor;

      const acum = obtenerAcum(p.linea_id);
      acum.partes.push({
        modeloNombre: modelo?.nombre ?? "—",
        formatoNombre: formatoNombre ?? "—",
        tono: p.tono,
        m2_1a,
        m2Comercial,
        m2Contenedor,
        piezas1a: p.piezas_1a,
        piezasComercial: p.piezas_comercial,
        piezasContenedor: p.piezas_contenedor,
        incidenciasCalidad: incidenciasCalidadPorParte.get(p.id) ?? [],
      });
      
      acum.m2 += m2Parte;
      acum.tiempos.plena += p.minutos_plena;
      acum.tiempos.noAlimentada += p.minutos_no_alimentada;
      acum.tiempos.saturacion += p.minutos_saturacion;
      acum.tiempos.banco += p.minutos_banco;
      acum.tiempos.maquina += p.minutos_maquina;

      m2TotalTurno += m2Parte;
      tiemposTotales.plena += p.minutos_plena;
      tiemposTotales.noAlimentada += p.minutos_no_alimentada;
      tiemposTotales.saturacion += p.minutos_saturacion;
      tiemposTotales.banco += p.minutos_banco;
      tiemposTotales.maquina += p.minutos_maquina;
    }

    // 7b) Generar el PDF con estos mismos datos y subirlo a
    // Cloudinary, ANTES de construir el texto de Telegram — así el
    // enlace ya está listo para meterlo en el último bloque. No es
    // fatal si falla: el aviso a Telegram no depende de que el PDF
    // exista (mismo criterio que la marca resumen_enviado_at del
    // paso 11 — un fallo aislado no debe tirar abajo todo el envío).
    // El responsable simplemente verá el resumen de texto sin
    // enlace esa vez, y turno.informe_pdf_url se queda en null.
    let pdfUrl: string | null = null;
    try {
      const datosPdf: DatosInformeTurnoPdf = {
        fecha: turnoRow.fecha,
        tipoNombre: NOMBRE_TIPO[turnoRow.tipo] ?? turnoRow.tipo,
        responsableUsername: responsable?.username ?? "—",
        m2Total: m2TotalTurno,
        tiempos: tiemposTotales,
        lineas: (lineasRows ?? []).map((linea: { id: string; nombre: string }) => {
          const acum = acumPorLinea.get(linea.id);
          return {
            nombre: linea.nombre,
            operario: operarioPorLinea.get(linea.id) ?? "",
            m2Total: acum?.m2 ?? 0,
            tiempos: acum?.tiempos ?? tiemposVacios(),
            incidenciasProduccion: incidenciasProduccionPorLinea.get(linea.id) ?? [],
            partes: acum?.partes ?? [],
          };
        }),
        incidenciasGenerales,
      };

      const pdfBytes = await generarPdfInformeTurno(datosPdf);
      const publicId = construirPublicIdInformeTurno(turnoRow.fecha, turnoRow.tipo);
      const subida = await subirInformePdfACloudinary(pdfBytes, publicId);
      pdfUrl = subida.url;
    } catch (err) {
      console.error("No se pudo generar/subir el PDF del informe de turno:", err);
    }

    // 8) Construir el texto en bloques (HTML, mismo parse_mode que
    // notificar-telegram) — un bloque por nivel del informe, para
    // poder partir en varios mensajes sin cortar a mitad de un <b>.
    const bloques: string[] = [];

    bloques.push(
      [
        `📋 <b>RESUMEN DE TURNO — ${NOMBRE_TIPO[turnoRow.tipo] ?? turnoRow.tipo}, ${formatearFecha(turnoRow.fecha)}</b>`,
        `Responsable: ${escapeHtml(responsable?.username ?? "—")}`,
        `m² totales: ${formatearM2(m2TotalTurno)}`,
        formatearTiempos(tiemposTotales),
      ].join("\n"),
    );

    for (const linea of lineasRows ?? []) {
      const acum = acumPorLinea.get(linea.id);
      const partes = acum?.partes ?? [];

      const lineasTexto: string[] = [
        `<b>${escapeHtml(linea.nombre)}</b>`,
        `Operario: ${escapeHtml(operarioPorLinea.get(linea.id) ?? "Sin asignar")}`,
        `m²: ${formatearM2(acum?.m2 ?? 0)} · ${formatearTiempos(acum?.tiempos ?? tiemposVacios())}`,
      ];

      for (const inc of incidenciasProduccionPorLinea.get(linea.id) ?? []) {
        lineasTexto.push(`⚠️ Incidencia de producción: "${escapeHtml(inc.descripcion)}"`);
      }

      if (partes.length === 0) {
        lineasTexto.push("Sin producción real registrada este turno.");
      } else {
        for (const p of partes) {
          lineasTexto.push(`  • ${escapeHtml(p.modeloNombre)} (${escapeHtml(p.formatoNombre)}) — Tono ${escapeHtml(p.tono)}`);
          lineasTexto.push(
            `    1ª: ${formatearM2(p.m2_1a)} · Comercial: ${formatearM2(p.m2Comercial)} · Contenedor: ${formatearM2(p.m2Contenedor)}`,
          );
          for (const inc of p.incidenciasCalidad) {
            lineasTexto.push(`    🔴 Incidencia de calidad: "${escapeHtml(inc.descripcion)}"`);
          }
        }
      }

      bloques.push(lineasTexto.join("\n"));
    }

    if (incidenciasGenerales.length > 0) {
      bloques.push(
        [`<b>Incidencias generales del turno</b>`, ...incidenciasGenerales.map((inc) => `- "${escapeHtml(inc.descripcion)}"`)].join(
          "\n",
        ),
      );
    }

    if (pdfUrl) {
      bloques.push(`📄 <a href="${pdfUrl}">Informe completo en PDF</a>`);
    }

    const textoCompleto = bloques.join("\n\n");

    // 9) Partir en varios mensajes si hace falta, SIEMPRE en un
    // límite de bloque completo (nunca a mitad de uno) — así ningún
    // <b> queda abierto sin cerrar dentro de un mismo mensaje.
    // Nota: si algún día una sola línea tuviera tantos partes que ese
    // bloque por sí solo superase LIMITE_TELEGRAM, este algoritmo no
    // lo trocea más — caso extremo no cubierto todavía.
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

    // 10) Enviar a Telegram — si faltan las variables de entorno, se
    // avisa con un error claro (igual que anthropic.ts) en vez de
    // fallar con un mensaje críptico de fetch.
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_RESUMEN_TURNO) {
      throw new Error(
        "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_RESUMEN_TURNO en los secrets de la Edge Function " +
          "(configúralos con: supabase secrets set TELEGRAM_CHAT_RESUMEN_TURNO=...)",
      );
    }

    for (const texto of mensajes) {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_RESUMEN_TURNO, text: texto, parse_mode: "HTML" }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error enviando a Telegram (${res.status}): ${errText}`);
      }
    }

    // 11) Marcar el turno como "ya enviado" — SOLO si todos los
    // mensajes salieron bien. Esto es lo que evita que el cron de
    // seguridad (20260816230000_resumen_turno_automatico.sql) lo
    // vuelva a mandar duplicado, y también sirve de "ya está hecho"
    // si esta misma función se llama dos veces para el mismo turno
    // (botón manual + cron casi a la vez, caso raro pero posible).
    // También guarda la URL del PDF (null si el paso 7b falló).
    const { error: marcarErr } = await supabase
      .from("turno")
      .update({
        resumen_enviado_at: new Date().toISOString(),
        informe_pdf_url: pdfUrl,
      })
      .eq("id", turnoId);
    if (marcarErr) {
      // El envío a Telegram ya salió bien — no se revierte nada por
      // esto, pero se avisa en logs: sin esta marca, el cron podría
      // reenviar el mismo informe más adelante.
      console.error("Resumen enviado, pero no se pudo marcar resumen_enviado_at:", marcarErr);
    }

    return jsonOk({ texto: textoCompleto, mensajes_enviados: mensajes.length, informe_pdf_url: pdfUrl });
  } catch (err) {
    console.error("Error en generar-resumen-turno:", err);
    return jsonError(
      err instanceof Error ? err.message : "Error desconocido generando el resumen de turno",
      500,
    );
  }
});