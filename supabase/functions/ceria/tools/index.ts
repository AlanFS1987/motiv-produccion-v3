// supabase/functions/ceria/tools/index.ts
//
// Punto de entrada único de herramientas de Ceria — reexporta el
// schema combinado (TOOLS) para la API de OpenAI y el despachador
// (executeTool) que llama al executor correcto. Dividido en módulos
// por eje (mecanismo/producción/calidad/incidencias) el 10/09/2026 —
// puro refactor de organización, sin cambios de comportamiento.
//
// Dos ejes que NUNCA se mezclan (decisión de sesión): PRODUCCIÓN (m²,
// tiempos, incidencias de producción) y CALIDAD (1ª/comercial/eco/
// contenedor, incidencias de calidad). Electromecánica
// (get_averias/get_ajustes) descartada por ahora. Gamificación fuera:
// el jefe no la usa.
//
// Todas las sumas las hace Postgres (vistas v_produccion_turno,
// v_calidad_modelo, v_calidad_lote) — nunca se le pide al modelo que
// sume filas él mismo.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { TOOLS_MECANISMO, ejecutarGetIdentidad, ejecutarGetDatosHistorial, ejecutarAskUser } from "./mecanismo.ts";
import {
  TOOLS_PRODUCCION,
  ejecutarGetProduccionTurno,
  ejecutarGetProduccionLinea,
  ejecutarGetPartes,
} from "./produccion.ts";
import {
  TOOLS_CALIDAD,
  ejecutarGetCalidadTurno,
  ejecutarGetCalidadModelo,
  ejecutarGetCalidadLote,
  ejecutarGetCalidadLinea,
} from "./calidad.ts";
import {
  TOOLS_INCIDENCIAS,
  ejecutarGetIncidenciasProduccion,
  ejecutarGetIncidenciasCalidad,
} from "./incidencias.ts";

export { LIMITS } from "./limits.ts";

// ── SCHEMA combinado de herramientas para la API de OpenAI (function calling) ─
export const TOOLS = [
  ...TOOLS_MECANISMO,
  ...TOOLS_PRODUCCION,
  ...TOOLS_CALIDAD,
  ...TOOLS_INCIDENCIAS,
];

// ── EJECUTORES ────────────────────────────────────────────────────
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales?: number; limitado?: boolean }> {
  console.log(`[ceria tool] ${toolName}`, JSON.stringify(args));

  switch (toolName) {
    case "get_identidad":
      return ejecutarGetIdentidad();

    case "get_datos_historial":
      return ejecutarGetDatosHistorial(args);

    case "ask_user":
      return ejecutarAskUser(args);

    case "get_produccion_turno":
      return ejecutarGetProduccionTurno(args, supabase);

    case "get_calidad_turno":
      return ejecutarGetCalidadTurno(args, supabase);

    case "get_produccion_linea":
      return ejecutarGetProduccionLinea(args, supabase);

    case "get_calidad_linea":
      return ejecutarGetCalidadLinea(args, supabase);

    case "get_partes":
      return ejecutarGetPartes(args, supabase);

    case "get_calidad_modelo":
      return ejecutarGetCalidadModelo(args, supabase);

    case "get_calidad_lote":
      return ejecutarGetCalidadLote(args, supabase);

    case "get_incidencias_produccion":
      return ejecutarGetIncidenciasProduccion(args, supabase);

    case "get_incidencias_calidad":
      return ejecutarGetIncidenciasCalidad(args, supabase);

    default:
      throw new Error(`Herramienta desconocida: ${toolName}`);
  }
}
