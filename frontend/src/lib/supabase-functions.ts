// Cliente ligero para llamar a las Edge Functions de Supabase.
// No usamos el SDK completo de supabase-js aquí porque, de momento,
// solo necesitamos invocar funciones — cuando añadamos login/consultas
// a tablas sí incorporaremos el cliente completo (con manejo de sesión).
import { supabase } from "./supabase-client";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

async function llamarEdgeFunction<T>(nombre: string, body: unknown): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY — revisa tu archivo .env.local",
    );
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${nombre}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? `Error llamando a ${nombre} (HTTP ${res.status})`);
  }
  return data as T;
}

export type FotoTipoOcr = "hoja_partida" | "caja" | "pantalla";

export interface RespuestaOcrParte {
  ok: true;
  foto_tipo: FotoTipoOcr;
  datos: Record<string, unknown>;
}

export async function ocrParte(
  fotoTipo: FotoTipoOcr,
  imagenes: { url: string }[],
): Promise<RespuestaOcrParte> {
  const { data, error } = await supabase.functions.invoke<RespuestaOcrParte>("ocr-parte", {
    body: { foto_tipo: fotoTipo, imagenes },
  });

  if (error) {
    let mensaje = error.message ?? "Error llamando a ocr-parte";
    try {
      const cuerpo = await (error as any).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      // sin cuerpo JSON legible, nos quedamos con error.message
    }
    throw new Error(mensaje);
  }

  return data as RespuestaOcrParte;
}

export interface RespuestaResolverCatalogo {
  ok: true;
  modelo_id: string;
  marca_id: string;
  producto_id: string;
  lote_id: string;
  lote_creado: boolean;
  lote_reabierto: boolean;
}

export interface DatosResolverCatalogo {
  modelo_texto: string;
  marca_texto: string;
  formato_nombre: string;
  numero_orden: string;
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

export async function resolverCatalogo(
  datos: DatosResolverCatalogo,
): Promise<RespuestaResolverCatalogo> {
  const { data, error } = await supabase.functions.invoke<RespuestaResolverCatalogo>("resolver-catalogo", {
    body: datos,
  });

  if (error) {
    let mensaje = error.message ?? "Error llamando a resolver-catalogo";
    try {
      const cuerpo = await (error as any).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      // sin cuerpo JSON legible, nos quedamos con error.message
    }
    throw new Error(mensaje);
  }

  return data as RespuestaResolverCatalogo;
}

export interface RespuestaGenerarResumenTurno {
  ok: true;
  texto: string;
  mensajes_enviados: number;
}

/**
 * Dispara la Edge Function que compila el informe de cierre de turno
 * (01-rol-responsable.md 3.9b) y lo manda al grupo de Telegram
 * "Resumen de turno". Se llama justo después de cerrar el turno
 * (`cerrarTurnoManualmente`) — quien llama debe capturar el error y
 * NO bloquear el cierre si esto falla (Telegram caído, etc.): el
 * turno ya quedó cerrado, y el informe se puede seguir viendo/
 * copiando desde la pestaña Resumen en cualquier momento.
 */
export function generarResumenTurnoRemoto(turnoId: string): Promise<RespuestaGenerarResumenTurno> {
  return llamarEdgeFunction<RespuestaGenerarResumenTurno>("generar-resumen-turno", { turno_id: turnoId });
}
