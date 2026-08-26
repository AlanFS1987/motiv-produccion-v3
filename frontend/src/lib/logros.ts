// frontend/src/lib/logros.ts
//
// Datos de la pestaña Logros (sesión de diseño 23/08/2026, ampliado
// 25/08/2026 para responsable). Motor GENÉRICO: lee logros_definicion
// (catálogo) y resuelve cada fila según su condicion_tipo, sin nada
// hardcodeado por nombre de logro.
//
// Los `condicion_tipo` que este motor entiende:
//
//   Tramo (acumulado de por vida, se repite cada condicion_valor
//   unidades — histórico cerrado + ciclo en vivo):
//     Operario: 'm2_total', 'tiempo_plena', 'tiempo_no_alimentada',
//       'tiempo_saturacion', 'tiempo_banco', 'tiempo_maquina',
//       'm2_contenedor', 'm2_com', 'm2_std', 'piezas_formato' (×7,
//       usa `formato_nombre`).
//     Responsable: 'm2_total', 'minutos_plena', 'minutos_no_alimentada',
//       'minutos_saturacion', 'minutos_banco', 'minutos_maquina',
//       'm2_contenedor', 'm2_com', 'm2_std' — MISMOS NOMBRES que las
//       columnas reales de historial_ciclo_responsable, distintos de
//       los del operario (tiempo_* allá, minutos_* aquí) — no
//       intercambiables entre roles.
//
//   Ciclo, sin progreso hacia "el siguiente", solo veces conseguido:
//     Operario: 'bestia_ciclo', 'ciclo_legendario' (umbral de
//       puntos), 'rey_de_reyes' (sin condicion_valor).
//     Responsable: 'bestia_ciclo_responsable', 'ciclo_legendario_responsable'
//       (umbral de puntos), 'lider_indiscutible' (sin condicion_valor).
//
//   Ciclo, umbral de una COLUMNA (no de puntos) en un solo ciclo —
//   nuevo 25/08/2026, solo responsable por ahora:
//     'manitas_ciclo' (condicion_valor = umbral de minutos_plena en
//        un ciclo, ej. 54000 = 900h)
//     'salvador_ciclo' (condicion_valor = umbral de m2_total en un
//        ciclo, ej. 400000)
//
//   Solo responsable, nuevos 25/08/2026:
//     'lotes_creados' (tramo, pero contra la tabla `lote` en vez de
//        historial_ciclo_responsable — count(*) where created_by =
//        usuarioId, sin concepto de ciclo)
//     'creador_de_heroes' (ciclo, sin condicion_valor — cuenta ciclos
//        donde historial_ciclo_responsable.operario_gano_ciclo = true;
//        esa columna se congela al cerrar cada ciclo a partir de los
//        operarios con los que ese responsable trabajó DE VERDAD ese
//        ciclo — parte.responsable_id/operario_id reales, no la letra
//        actual del operario, que puede haber cambiado desde entonces)
//     'equipo_a' (ciclo, condicion_valor = umbral de puntos — compara
//        contra historial_ciclo_responsable.puntos_equipo_ciclo,
//        congelada con el mismo criterio que la de arriba)

import { supabase } from "./supabase-client";
import { obtenerCicloActual } from "./ciclo";

const COLUMNAS_TRAMO_OPERARIO = [
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

const COLUMNAS_TRAMO_RESPONSABLE = [
  "m2_total",
  "minutos_plena",
  "minutos_no_alimentada",
  "minutos_saturacion",
  "minutos_banco",
  "minutos_maquina",
  "m2_contenedor",
  "m2_com",
  "m2_std",
  "verificaciones_codbar",
] as const;

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

// ---------------------------------------------------------------
// OPERARIO — sin cambios de comportamiento respecto a la versión
// del 23/08/2026, solo movida a su propia función.
// ---------------------------------------------------------------
async function obtenerLogrosOperario(usuarioId: string): Promise<ResumenLogros> {
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

  const totalesColumna: Record<string, number> = {};
  for (const col of COLUMNAS_TRAMO_OPERARIO) {
    const sumaHistorico = historico.reduce((acc, fila: any) => acc + (fila[col] ?? 0), 0);
    const valorVivo = (vivoData as any)?.[col] ?? 0;
    totalesColumna[col] = sumaHistorico + valorVivo;
  }

  let piezasPorFormato: Record<string, number> = {};
  for (const fila of historico) {
    piezasPorFormato = sumarPiezasPorFormato(piezasPorFormato, fila.piezas_por_formato as Record<string, number> | null);
  }
  piezasPorFormato = sumarPiezasPorFormato(piezasPorFormato, (vivoData as any)?.piezas_por_formato ?? null);

  function contarCiclosSobreUmbralPuntos(umbral: number): number {
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
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces,
        progreso: objetivo > 0 ? { actual: restante, objetivo, pct: (restante / objetivo) * 100 } : null,
      };
    }

    if ((COLUMNAS_TRAMO_OPERARIO as readonly string[]).includes(def.condicion_tipo)) {
      const acumulado = totalesColumna[def.condicion_tipo];
      const objetivo = def.condicion_valor ?? 0;
      const veces = objetivo > 0 ? Math.floor(acumulado / objetivo) : 0;
      const restante = objetivo > 0 ? acumulado % objetivo : 0;
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces,
        progreso: objetivo > 0 ? { actual: restante, objetivo, pct: (restante / objetivo) * 100 } : null,
      };
    }

    if (def.condicion_tipo === "bestia_ciclo" || def.condicion_tipo === "ciclo_legendario") {
      const veces = contarCiclosSobreUmbralPuntos(def.condicion_valor ?? 0);
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces, progreso: null,
      };
    }

    if (def.condicion_tipo === "rey_de_reyes") {
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: vecesReyDeReyes > 0, veces: vecesReyDeReyes, progreso: null,
      };
    }

    console.warn(`logros.ts: condicion_tipo desconocido "${def.condicion_tipo}" en logro "${def.nombre}" (rol operario)`);
    return {
      id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
      desbloqueado: false, veces: 0, progreso: null,
    };
  });

  return { logros, desbloqueados: logros.filter((l) => l.desbloqueado).length, total: logros.length };
}

// ---------------------------------------------------------------
// RESPONSABLE — nuevo 25/08/2026. Misma forma que operario, pero:
// - lee historial_ciclo_responsable / v_metros_responsable_ciclo +
//   v_tiempo_responsable_ciclo (ciclo en vivo) en vez de
//   historial_ciclos / v_produccion_operario_ciclo.
// - sin piezas_formato (no existe para responsable).
// - "bestia_ciclo_responsable"/"ciclo_legendario_responsable" en vez
//   de los del operario (mismo mecanismo, distinto condicion_tipo
//   para no chocar si algún día se listan logros de los dos roles
//   juntos en una única consulta).
// - "lider_indiscutible" en vez de "rey_de_reyes"
//   (v_veces_lider_indiscutible en vez de v_veces_rey_de_reyes).
// - "manitas_ciclo"/"salvador_ciclo": NUEVO condicion_tipo — umbral
//   de una columna cruda (no de puntos) en UN solo ciclo. A
//   diferencia de bestia_ciclo/ciclo_legendario (que comparan
//   puntos_ciclo), estos comparan minutos_plena / m2_total
//   directamente, así que necesitan saber CUÁL columna mirar — se
//   resuelve con un mapa fijo condicion_tipo -> columna, ya que solo
//   hay 2 (si en el futuro hace falta un tercero con otra columna,
//   añadir aquí, no generalizar de más para 2-3 casos).
// ---------------------------------------------------------------
const COLUMNA_POR_CONDICION_CICLO_CRUDA: Record<string, "minutos_plena" | "m2_total"> = {
  manitas_ciclo: "minutos_plena",
  salvador_ciclo: "m2_total",
};

async function obtenerLogrosResponsable(usuarioId: string): Promise<ResumenLogros> {
  const ciclo = await obtenerCicloActual();

  const [
    { data: definiciones, error: errorDefiniciones },
    { data: historicoData, error: errorHistorico },
    { data: metrosVivoData, error: errorMetrosVivo },
    { data: tiempoVivoData, error: errorTiempoVivo },
    { data: codbarVivoData, error: errorCodbarVivo },
    { data: puntosVivoData, error: errorPuntosVivo },
    { data: equipoVivoData, error: errorEquipoVivo },
    { data: vecesLiderData, error: errorVecesLider },
    { count: lotesCreados, error: errorLotes },
  ] = await Promise.all([
    supabase
      .from("logros_definicion")
      .select("id, nombre, descripcion, icono, condicion_tipo, condicion_valor, formato_nombre")
      .eq("rol", "responsable")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("historial_ciclo_responsable")
      .select(
        "m2_total, minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina, m2_contenedor, m2_com, m2_std, verificaciones_codbar, puntos_ciclo, puntos_equipo_ciclo, operario_gano_ciclo, cycle_id",
      )
      .eq("usuario_id", usuarioId),
    supabase
      .from("v_metros_responsable_ciclo")
      .select("m2_total, m2_contenedor, m2_com, m2_std")
      .eq("responsable_id", usuarioId)
      .eq("cycle_id", ciclo.cycleId)
      .maybeSingle(),
    supabase
      .from("v_tiempo_responsable_ciclo")
      .select("tiempo_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina")
      .eq("responsable_id", usuarioId)
      .eq("cycle_id", ciclo.cycleId)
      .maybeSingle(),
    supabase
      .from("v_verificaciones_codbar_responsable_ciclo")
      .select("verificaciones_codbar")
      .eq("responsable_id", usuarioId)
      .eq("cycle_id", ciclo.cycleId)
      .maybeSingle(),
    supabase.from("v_puntos_responsable_ciclo").select("puntos_ciclo").eq("responsable_id", usuarioId).eq("cycle_id", ciclo.cycleId).maybeSingle(),
    supabase
      .from("v_puntos_equipo_responsable_ciclo")
      .select("puntos_equipo, operario_gano_ciclo")
      .eq("responsable_id", usuarioId)
      .eq("cycle_id", ciclo.cycleId)
      .maybeSingle(),
    supabase.from("v_veces_lider_indiscutible").select("veces").eq("responsable_id", usuarioId).maybeSingle(),
    supabase.from("lote").select("id", { count: "exact", head: true }).eq("created_by", usuarioId),
  ]);

  if (errorDefiniciones) throw new Error(errorDefiniciones.message);
  if (errorHistorico) throw new Error(errorHistorico.message);
  if (errorMetrosVivo) throw new Error(errorMetrosVivo.message);
  if (errorTiempoVivo) throw new Error(errorTiempoVivo.message);
  if (errorCodbarVivo) throw new Error(errorCodbarVivo.message);
  if (errorPuntosVivo) throw new Error(errorPuntosVivo.message);
  if (errorEquipoVivo) throw new Error(errorEquipoVivo.message);
  if (errorVecesLider) throw new Error(errorVecesLider.message);
  if (errorLotes) throw new Error(errorLotes.message);

  const historico = historicoData ?? [];

  // "Veces" de Creador de Héroes y umbral de El Equipo A: ciclos
  // cerrados (columnas ya congeladas) + el ciclo en vivo (vista).
  const vecesCreadorHeroes =
    historico.filter((f: any) => f.operario_gano_ciclo === true).length +
    ((equipoVivoData as any)?.operario_gano_ciclo ? 1 : 0);
  const ciclosEquipoSobreUmbral = (umbral: number): number => {
    const cerrados = historico.filter((f: any) => (f.puntos_equipo_ciclo ?? 0) >= umbral).length;
    const vivoCualifica = ((equipoVivoData as any)?.puntos_equipo ?? 0) >= umbral ? 1 : 0;
    return cerrados + vivoCualifica;
  };

  // El ciclo en vivo, con el MISMO nombre de columna que
  // historial_ciclo_responsable (minutos_plena, no tiempo_plena),
  // para poder tratarlo igual que una fila histórica más abajo.
  const filaVivo = {
    m2_total: (metrosVivoData as any)?.m2_total ?? 0,
    m2_contenedor: (metrosVivoData as any)?.m2_contenedor ?? 0,
    m2_com: (metrosVivoData as any)?.m2_com ?? 0,
    m2_std: (metrosVivoData as any)?.m2_std ?? 0,
    minutos_plena: (tiempoVivoData as any)?.tiempo_plena ?? 0,
    minutos_no_alimentada: (tiempoVivoData as any)?.minutos_no_alimentada ?? 0,
    minutos_saturacion: (tiempoVivoData as any)?.minutos_saturacion ?? 0,
    minutos_banco: (tiempoVivoData as any)?.minutos_banco ?? 0,
    minutos_maquina: (tiempoVivoData as any)?.minutos_maquina ?? 0,
    verificaciones_codbar: (codbarVivoData as any)?.verificaciones_codbar ?? 0,
    puntos_ciclo: (puntosVivoData?.puntos_ciclo as number | undefined) ?? 0,
    cycle_id: ciclo.cycleId,
  };

  const totalesColumna: Record<string, number> = {};
  for (const col of COLUMNAS_TRAMO_RESPONSABLE) {
    const sumaHistorico = historico.reduce((acc, fila: any) => acc + (fila[col] ?? 0), 0);
    totalesColumna[col] = sumaHistorico + (filaVivo as any)[col];
  }

  function contarCiclosSobreUmbralPuntos(umbral: number): number {
    const cerrados = historico.filter((f) => (f.puntos_ciclo ?? 0) >= umbral).length;
    const vivoCualifica = filaVivo.puntos_ciclo >= umbral ? 1 : 0;
    return cerrados + vivoCualifica;
  }

  // Igual que arriba, pero comparando una columna cruda (minutos_plena
  // o m2_total) en vez de puntos_ciclo — para manitas_ciclo/salvador_ciclo.
  function contarCiclosSobreUmbralColumna(columna: "minutos_plena" | "m2_total", umbral: number): number {
    const cerrados = historico.filter((f: any) => (f[columna] ?? 0) >= umbral).length;
    const vivoCualifica = (filaVivo as any)[columna] >= umbral ? 1 : 0;
    return cerrados + vivoCualifica;
  }

  const vecesLider = (vecesLiderData?.veces as number | undefined) ?? 0;

  const logros: LogroResuelto[] = (definiciones ?? []).map((def: LogroDefinicionFila) => {
    if ((COLUMNAS_TRAMO_RESPONSABLE as readonly string[]).includes(def.condicion_tipo)) {
      const acumulado = totalesColumna[def.condicion_tipo];
      const objetivo = def.condicion_valor ?? 0;
      const veces = objetivo > 0 ? Math.floor(acumulado / objetivo) : 0;
      const restante = objetivo > 0 ? acumulado % objetivo : 0;
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces,
        progreso: objetivo > 0 ? { actual: restante, objetivo, pct: (restante / objetivo) * 100 } : null,
      };
    }

    if (def.condicion_tipo === "bestia_ciclo_responsable" || def.condicion_tipo === "ciclo_legendario_responsable") {
      const veces = contarCiclosSobreUmbralPuntos(def.condicion_valor ?? 0);
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces, progreso: null,
      };
    }

    if (def.condicion_tipo === "lider_indiscutible") {
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: vecesLider > 0, veces: vecesLider, progreso: null,
      };
    }

    if (def.condicion_tipo in COLUMNA_POR_CONDICION_CICLO_CRUDA) {
      const columna = COLUMNA_POR_CONDICION_CICLO_CRUDA[def.condicion_tipo];
      const veces = contarCiclosSobreUmbralColumna(columna, def.condicion_valor ?? 0);
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces, progreso: null,
      };
    }

    if (def.condicion_tipo === "lotes_creados") {
      // Tramo, pero sobre `lote` en vez de historial_ciclo_responsable
      // — sin concepto de ciclo, cuenta total y ya.
      const acumulado = lotesCreados ?? 0;
      const objetivo = def.condicion_valor ?? 0;
      const veces = objetivo > 0 ? Math.floor(acumulado / objetivo) : 0;
      const restante = objetivo > 0 ? acumulado % objetivo : 0;
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces,
        progreso: objetivo > 0 ? { actual: restante, objetivo, pct: (restante / objetivo) * 100 } : null,
      };
    }

    if (def.condicion_tipo === "creador_de_heroes") {
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: vecesCreadorHeroes > 0, veces: vecesCreadorHeroes, progreso: null,
      };
    }

    if (def.condicion_tipo === "equipo_a") {
      const veces = ciclosEquipoSobreUmbral(def.condicion_valor ?? 0);
      return {
        id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
        desbloqueado: veces > 0, veces, progreso: null,
      };
    }

    console.warn(`logros.ts: condicion_tipo desconocido "${def.condicion_tipo}" en logro "${def.nombre}" (rol responsable)`);
    return {
      id: def.id, nombre: def.nombre, descripcion: def.descripcion, icono: def.icono,
      desbloqueado: false, veces: 0, progreso: null,
    };
  });

  return { logros, desbloqueados: logros.filter((l) => l.desbloqueado).length, total: logros.length };
}

// ---------------------------------------------------------------
// Punto de entrada — igual firma que antes más `rol`, con default
// 'operario' para no romper la única pantalla que ya lo llama
// (LogrosOperarioScreen.tsx no necesita cambiar).
// ---------------------------------------------------------------
export async function obtenerLogros(usuarioId: string, rol: "operario" | "responsable" = "operario"): Promise<ResumenLogros> {
  return rol === "operario" ? obtenerLogrosOperario(usuarioId) : obtenerLogrosResponsable(usuarioId);
}