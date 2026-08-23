// frontend/src/lib/logros.ts
//
// Datos de la pestaña Logros (sesión de diseño 23/08/2026). Motor
// GENÉRICO: lee logros_definicion (catálogo, hoy sin sembrar — ver
// aviso más abajo) y resuelve cada fila según su condicion_tipo,
// sin nada hardcodeado por nombre de logro — así añadir un logro
// nuevo en el futuro (posible ampliación "v4" mencionada en sesión)
// es solo una fila nueva en logros_definicion, sin tocar código.
//
// *** IMPORTANTE — logros_definicion está VACÍA hoy ***
// Según 04-gamificacion.md, el esquema está listo pero los 19 datos
// reales del CSV de v2 no se han sembrado todavía. Esta pantalla
// funcionará correctamente en cuanto se siembren, pero mostrará una
// lista vacía hasta entonces. Los `condicion_tipo` que este motor
// entiende (hay que usar EXACTAMENTE estos valores al sembrar):
//
//   Tramo (16, se repiten cada condicion_valor unidades):
//     'm2_total', 'tiempo_plena', 'tiempo_no_alimentada',
//     'tiempo_saturacion', 'tiempo_banco', 'tiempo_maquina',
//     'm2_contenedor', 'm2_com', 'm2_std',
//     'piezas_formato' (×7 filas, una por formato — usar la columna
//        `formato_nombre` para indicar cuál de los 7)
//
//   Ciclo (3, sin progreso hacia "el siguiente", solo veces conseguido):
//     'bestia_ciclo' (condicion_valor = umbral de puntos, ej. 600)
//     'ciclo_legendario' (condicion_valor = umbral de puntos, ej. 1000)
//     'rey_de_reyes' (sin condicion_valor — se compara contra los
//        demás cada ciclo, ver v_veces_rey_de_reyes)

import { supabase } from "./supabase-client";
import { obtenerCicloActual } from "./ciclo";

const COLUMNAS_TRAMO_SIMPLE = [
  "m2_total",
  "tiempo_plena",
  "tiempo_no_alimentada",
  "tiempo_saturacion",
  "tiempo_banco",
  "tiempo_maquina",
  "m2_contenedor",
  "m2_com",
  "m2_std",
] as const;
type ColumnaTramoSimple = (typeof COLUMNAS_TRAMO_SIMPLE)[number];

interface LogroDefinicionFila {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  condicion_tipo: string;
  condicion_valor: number | null;
  formato_nombre: string | null;
}

export interface LogroResuelto {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  desbloqueado: boolean;
  veces: number;
  /** Solo para logros de tramo — null en los de ciclo (no tienen "siguiente tramo"). */
  progreso: { actual: number; objetivo: number; pct: number } | null;
}

export interface ResumenLogros {
  logros: LogroResuelto[];
  desbloqueados: number;
  total: number;
}

function sumarPiezasPorFormato(
  a: Record<string, number>,
  b: Record<string, number> | null | undefined,
): Record<string, number> {
  const resultado = { ...a };
  for (const [formato, piezas] of Object.entries(b ?? {})) {
    resultado[formato] = (resultado[formato] ?? 0) + (piezas ?? 0);
  }
  return resultado;
}

export async function obtenerLogros(usuarioId: string): Promise<ResumenLogros> {
  const ciclo = await obtenerCicloActual();

  const [
    { data: definiciones, error: errorDefiniciones },
    { data: historicoData, error: errorHistorico },
    { data: vivoData, error: errorVivo },
    { data: puntosVivoData, error: errorPuntosVivo },
    { data: vecesReyData, error: errorVecesRey },
  ] = await Promise.all([
    supabase
      .from("logros_definicion")
      .select("id, nombre, descripcion, icono, condicion_tipo, condicion_valor, formato_nombre")
      .eq("rol", "operario")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("historial_ciclos")
      .select(
        "m2_total, tiempo_plena, tiempo_no_alimentada, tiempo_saturacion, tiempo_banco, tiempo_maquina, m2_contenedor, m2_com, m2_std, piezas_por_formato, puntos_ciclo",
      )
      .eq("usuario_id", usuarioId)
      .eq("rol", "operario"),
    supabase
      .from("v_produccion_operario_ciclo")
      .select(
        "m2_total, tiempo_plena, tiempo_no_alimentada, tiempo_saturacion, tiempo_banco, tiempo_maquina, m2_contenedor, m2_com, m2_std, piezas_por_formato",
      )
      .eq("operario_id", usuarioId)
      .eq("cycle_id", ciclo.cycleId)
      .maybeSingle(),
    supabase.from("v_puntos_operario_ciclo").select("puntos_ciclo").eq("operario_id", usuarioId).eq("cycle_id", ciclo.cycleId).maybeSingle(),
    supabase.from("v_veces_rey_de_reyes").select("veces").eq("operario_id", usuarioId).maybeSingle(),
  ]);

  if (errorDefiniciones) throw new Error(errorDefiniciones.message);
  if (errorHistorico) throw new Error(errorHistorico.message);
  if (errorVivo) throw new Error(errorVivo.message);
  if (errorPuntosVivo) throw new Error(errorPuntosVivo.message);
  if (errorVecesRey) throw new Error(errorVecesRey.message);

  const historico = historicoData ?? [];

  // Totales de por vida por columna simple (histórico cerrado + ciclo en vivo).
  const totalesColumna: Record<ColumnaTramoSimple, number> = {
    m2_total: 0,
    tiempo_plena: 0,
    tiempo_no_alimentada: 0,
    tiempo_saturacion: 0,
    tiempo_banco: 0,
    tiempo_maquina: 0,
    m2_contenedor: 0,
    m2_com: 0,
    m2_std: 0,
  };
  for (const col of COLUMNAS_TRAMO_SIMPLE) {
    const sumaHistorico = historico.reduce((acc, fila: any) => acc + (fila[col] ?? 0), 0);
    const valorVivo = (vivoData as any)?.[col] ?? 0;
    totalesColumna[col] = sumaHistorico + valorVivo;
  }

  // Piezas por formato de por vida — suma jsonb histórico + ciclo en vivo.
  let piezasPorFormato: Record<string, number> = {};
  for (const fila of historico) {
    piezasPorFormato = sumarPiezasPorFormato(piezasPorFormato, fila.piezas_por_formato as Record<string, number> | null);
  }
  piezasPorFormato = sumarPiezasPorFormato(piezasPorFormato, (vivoData as any)?.piezas_por_formato ?? null);

  // Ciclos completos (cerrados + el actual si ya cualifica) para bestia/legendario.
  function contarCiclosSobreUmbral(umbral: number): number {
    const cerrados = historico.filter((f) => (f.puntos_ciclo ?? 0) >= umbral).length;
    const vivoCualifica = ((puntosVivoData?.puntos_ciclo as number | undefined) ?? 0) >= umbral ? 1 : 0;
    return cerrados + vivoCualifica;
  }

  const vecesReyDeReyes = (vecesReyData?.veces as number | undefined) ?? 0;

  const logros: LogroResuelto[] = (definiciones ?? []).map((def: LogroDefinicionFila) => {
    if (def.condicion_tipo === "piezas_formato") {
      const acumulado = piezasPorFormato[def.formato_nombre ?? ""] ?? 0;
      const objetivo = def.condicion_valor ?? 0;
      const veces = objetivo > 0 ? Math.floor(acumulado / objetivo) : 0;
      const restante = objetivo > 0 ? acumulado % objetivo : 0;
      return {
        id: def.id,
        nombre: def.nombre,
        descripcion: def.descripcion,
        icono: def.icono,
        desbloqueado: veces > 0,
        veces,
        progreso: objetivo > 0 ? { actual: restante, objetivo, pct: (restante / objetivo) * 100 } : null,
      };
    }

    if ((COLUMNAS_TRAMO_SIMPLE as readonly string[]).includes(def.condicion_tipo)) {
      const acumulado = totalesColumna[def.condicion_tipo as ColumnaTramoSimple];
      const objetivo = def.condicion_valor ?? 0;
      const veces = objetivo > 0 ? Math.floor(acumulado / objetivo) : 0;
      const restante = objetivo > 0 ? acumulado % objetivo : 0;
      return {
        id: def.id,
        nombre: def.nombre,
        descripcion: def.descripcion,
        icono: def.icono,
        desbloqueado: veces > 0,
        veces,
        progreso: objetivo > 0 ? { actual: restante, objetivo, pct: (restante / objetivo) * 100 } : null,
      };
    }

    if (def.condicion_tipo === "bestia_ciclo" || def.condicion_tipo === "ciclo_legendario") {
      const veces = contarCiclosSobreUmbral(def.condicion_valor ?? 0);
      return {
        id: def.id,
        nombre: def.nombre,
        descripcion: def.descripcion,
        icono: def.icono,
        desbloqueado: veces > 0,
        veces,
        progreso: null,
      };
    }

    if (def.condicion_tipo === "rey_de_reyes") {
      return {
        id: def.id,
        nombre: def.nombre,
        descripcion: def.descripcion,
        icono: def.icono,
        desbloqueado: vecesReyDeReyes > 0,
        veces: vecesReyDeReyes,
        progreso: null,
      };
    }

    // condicion_tipo desconocido — se muestra bloqueado en vez de romper la pantalla.
    console.warn(`logros.ts: condicion_tipo desconocido "${def.condicion_tipo}" en logro "${def.nombre}"`);
    return {
      id: def.id,
      nombre: def.nombre,
      descripcion: def.descripcion,
      icono: def.icono,
      desbloqueado: false,
      veces: 0,
      progreso: null,
    };
  });

  return {
    logros,
    desbloqueados: logros.filter((l) => l.desbloqueado).length,
    total: logros.length,
  };
}