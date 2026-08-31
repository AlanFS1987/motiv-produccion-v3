// Edge Function: resolver-catalogo
// Ref. 05-modelo-de-datos.md 7.4, 11-esquema-supabase.md 13.7.
//
// Se llama justo después de ocr-parte (solo en el camino 3 — nuevo
// lote, ver 01-rol-responsable.md 3.2) con los campos ya extraídos de
// la hoja de partida. Resuelve modelo → producto → lote contra lo ya
// existente en Supabase, creando lo que falte — NUNCA bloquea la
// captura, coherente con el pilar de velocidad (00-vision-general.md).
//
// Usa el service_role key (bypassa RLS) porque la auto-creación de
// catálogo no es una operación que deba depender del rol del usuario
// final que está delante de la app en ese momento.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import {
  espesorATexto,
  limpiarNombreModelo,
  normalizarFormato,
  normalizarTexto,
} from "../_shared/normalizacion.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Umbral de similitud (pg_trgm) por debajo del cual se crea un
// registro nuevo en vez de enlazar. Validado localmente: coincidencia
// exacta = 1.0, typo típico de OCR ("Nues" por "Nuez") ≈ 0.71,
// producto sin relación ≈ 0.08 — 0.4 separa bien ambos casos.
// Ajustar aquí si, con datos reales, se ven falsos positivos/negativos.
const UMBRAL_SIMILITUD = 0.4;

interface RequestBody {
  modelo_texto: string;
  marca_texto: string;
  formato_nombre: string;
  numero_orden: string;
  // NUEVO — respaldo cuando DIMENSIONES no trae una medida legible
  // (ver comentario junto a normalizarFormato en _shared/normalizacion.ts).
  formato_alternativo_texto?: string | null;
  acabado_codigo?: string | null;
  acabado_tipo?: string | null;
  acabado_nombre?: string | null;
  espesor_mm?: number | null;
  tipo_palet?: string | null;
  pza_caja?: number | null;
  objetivo_m2?: number | null;
  codbar_caja?: string | null;
  codbar_pieza?: string | null;
  cod_upec?: string | null;
  codbar_saso?: string | null;
  observaciones_material?: string | null;
  observaciones_orden?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return jsonError("Falta la sesión del usuario", 401);
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return jsonError("Sesión no válida — vuelve a iniciar sesión", 401);
  }
  const created_by = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  const {
    modelo_texto,
    marca_texto,
    formato_nombre,
    numero_orden,
    formato_alternativo_texto = null,
    acabado_codigo = null,
    acabado_tipo = null,
    acabado_nombre = null,
    espesor_mm = null,
    tipo_palet = null,
    pza_caja = null,
    objetivo_m2 = null,
    codbar_caja = null,
    codbar_pieza = null,
    cod_upec = null,
    codbar_saso = null,
    observaciones_material = null,
    observaciones_orden = null,
  } = body;

  if (!modelo_texto || !marca_texto || !formato_nombre || !numero_orden) {
    return jsonError(
      "Faltan campos obligatorios: modelo_texto, marca_texto, formato_nombre, numero_orden",
      400,
    );
  }

  try {
    // ---- Paso 1/2 — resolver o crear modelo ----
    // El texto crudo (modelo_texto) puede venir como un código
    // compuesto tipo "SL ORION MARFIL MT(PRC)60X120RC/CIF2_S" — se
    // limpia con la regla del paréntesis antes de tocar el catálogo,
    // pero el crudo completo se guarda igualmente en
    // lote.texto_crudo_modelo para auditoría de fusiones.
    const modeloLimpio = limpiarNombreModelo(modelo_texto);
    if (!modeloLimpio) {
      return jsonError(
        `modelo_texto="${modelo_texto}" no dejó ningún nombre de modelo tras limpiar el paréntesis`,
        422,
      );
    }
    const modeloId = await resolverOCrear("modelo", modeloLimpio);

    // ---- Paso 2 — resolver o crear marca ----
    const marcaId = await resolverOCrear("marca", marca_texto);

    // ---- formato — catálogo cerrado, coincidencia EXACTA en mm.
    // Normaliza tanto DIMENSIONES (formato_nombre) como, si esa no
    // resuelve, el campo FORMATO crudo (formato_alternativo_texto) —
    // acepta cm o mm y sufijos tipo "SL RC" (ver normalizarFormato). ----
    const formatoResuelto =
      normalizarFormato(formato_nombre) ?? normalizarFormato(formato_alternativo_texto);
    if (!formatoResuelto) {
      return jsonError(
        `No se pudo reconocer el formato ni en DIMENSIONES ("${formato_nombre}") ` +
          `ni en FORMATO ("${formato_alternativo_texto ?? "—"}") — formatos válidos: ` +
          `200x1200, 300x1200, 600x1200, 1200x1200, 300x600, 600x600, 900x900`,
        422,
      );
    }
    const { data: formatoRow, error: formatoErr } = await supabase
      .from("formato")
      .select("id")
      .eq("nombre", formatoResuelto)
      .maybeSingle();
    if (formatoErr) throw formatoErr;
    if (!formatoRow) {
      return jsonError(
        `"${formatoResuelto}" se normalizó correctamente pero no existe en la tabla formato — revisar catálogo en BD`,
        422,
      );
    }
    const formatoId = formatoRow.id as string;

    // ---- Paso 3 — resolver o crear producto (modelo+marca+formato) ----
    let productoId: string;
    const { data: productoRow, error: productoSelErr } = await supabase
      .from("producto")
      .select("id")
      .eq("modelo_id", modeloId)
      .eq("marca_id", marcaId)
      .eq("formato_id", formatoId)
      .maybeSingle();
    if (productoSelErr) throw productoSelErr;

    if (productoRow) {
      productoId = productoRow.id as string;
    } else {
      const { data: nuevoProducto, error: prodInsErr } = await supabase
        .from("producto")
        .insert({ modelo_id: modeloId, marca_id: marcaId, formato_id: formatoId })
        .select("id")
        .single();
      if (prodInsErr) throw prodInsErr;
      productoId = nuevoProducto.id as string;
    }

    // ---- Paso 4 — resolver o crear lote, por numero_orden EXACTO ----
    let loteId: string;
    let loteCreado = false;
    let loteReabierto = false;

    const { data: loteExistente, error: loteSelErr } = await supabase
      .from("lote")
      .select("id, estado")
      .eq("numero_orden", numero_orden)
      .maybeSingle();
    if (loteSelErr) throw loteSelErr;

    if (loteExistente) {
      loteId = loteExistente.id as string;
      if (loteExistente.estado === "finalizado") {
        const { error: reabrirErr } = await supabase
          .from("lote")
          .update({ estado: "iniciado" })
          .eq("id", loteId);
        if (reabrirErr) throw reabrirErr;
        loteReabierto = true;
      }
    } else {
      const espesorTexto = espesorATexto(espesor_mm);
      if (!espesorTexto) {
        return jsonError(
          `espesor_mm="${espesor_mm}" no es válido para crear un lote nuevo ` +
            `(el OCR debe devolver 9 u 11 — revisar Foto 1)`,
          422,
        );
      }

      const { data: nuevoLote, error: loteInsErr } = await supabase
        .from("lote")
        .insert({
          numero_orden,
          producto_id: productoId,
          acabado_codigo,
          acabado_tipo,
          acabado_nombre,
          espesor: espesorTexto,
          tipo_palet,
          pza_caja,
          objetivo_m2,
          codbar_caja,
          codbar_pieza,
          cod_upec,
          codbar_saso,
          observaciones_material,
          observaciones_orden,
          texto_crudo_modelo: modelo_texto,
          texto_crudo_marca: marca_texto,
          created_by,
        })
        .select("id")
        .single();
      if (loteInsErr) throw loteInsErr;
      loteId = nuevoLote.id as string;
      loteCreado = true;
    }

    return jsonOk({
      modelo_id: modeloId,
      marca_id: marcaId,
      producto_id: productoId,
      lote_id: loteId,
      lote_creado: loteCreado,
      lote_reabierto: loteReabierto,
    });
  } catch (err) {
    console.error("Error en resolver-catalogo:", err);
    return jsonError(
      err instanceof Error ? err.message : "Error desconocido resolviendo el catálogo",
      500,
    );
  }
});

/**
 * Busca por similitud (pg_trgm) en `modelo` o `marca`; si hay una
 * coincidencia clara (>= UMBRAL_SIMILITUD) enlaza con ella, si no,
 * crea un registro nuevo. Nunca bloquea (05-modelo-de-datos.md 7.4).
 */
async function resolverOCrear(
  tabla: "modelo" | "marca",
  nombreCrudo: string,
): Promise<string> {
  const nombreNormalizado = normalizarTexto(nombreCrudo);
  const rpcName = tabla === "modelo" ? "fn_buscar_modelo_similar" : "fn_buscar_marca_similar";

  const { data: candidatos, error: rpcErr } = await supabase.rpc(rpcName, {
    p_nombre_normalizado: nombreNormalizado,
  });
  if (rpcErr) throw rpcErr;

  if (candidatos && candidatos.length > 0 && candidatos[0].similitud >= UMBRAL_SIMILITUD) {
    return candidatos[0].id as string;
  }

  const { data: nuevo, error: insErr } = await supabase
    .from(tabla)
    .insert({ nombre: nombreCrudo })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return nuevo.id as string;
}