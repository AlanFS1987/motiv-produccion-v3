// frontend/src/lib/dashboard-detallada.ts
// Datos para Vista Detallada del jefe — jerarquía turno -> línea ->
// parte, con TODO lo capturado (piezas, calibres, verificaciones,
// tiempos, lote) y todo lo calculable de ahí (m² por categoría,
// calidad completa/oficial por parte). A diferencia de Vista Rápida
// (agregados), aquí se muestra el detalle real fila a fila — es la
// pantalla de auditar un turno concreto.
//
// Producción y calidad siguen siendo ejes separados en la
// presentación (ver componente), aunque convivan en la misma fila de
// `parte` — no se implica causalidad entre ellos.

import { supabase } from "./supabase-client";

export interface IncidenciaProduccionDetalle {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  created_at: string;
  linea_id: string | null;
}

export interface IncidenciaCalidadDetalle {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  created_at: string;
}

export interface ParteDetalle {
  id: string;
  tono: string;
  calibre: string | null;
  calibre_com_pct: number | null;
  calibre_std_pct: number | null;

  // Piezas capturadas (crudo)
  piezas_entradas: number;
  piezas_1a: number;
  piezas_comercial: number;
  piezas_eco: number;
  piezas_descuadre_com: number;
  piezas_planar_com: number;
  piezas_contenedor: number;
  cal_1: number | null;
  cal_2: number | null;
  cal_3: number | null;
  cal_4: number | null;
  cal_5: number | null;
  cal_6: number | null;
  cal_7: number | null;
  cal_8: number | null;

  // Tiempos capturados (crudo)
  minutos_total: number;
  minutos_plena: number;
  minutos_no_alimentada: number;
  minutos_saturacion: number;
  minutos_banco: number;
  minutos_maquina: number;

  // Verificaciones
  verificacion_caja_estado: string | null;
  verificacion_caja_estado_operario: string | null;
  verificacion_codbar_estado: string | null;
  verificacion_codbar_estado_operario: string | null;

  hora_captura_pantalla: string | null;
  completado_at: string | null;
  created_at: string;

  operario_username: string | null;

  // Lote/producto de ESTE parte (un parte puede llevar tono/calibre
  // distinto dentro del mismo lote, o incluso lote distinto si se
  // reasignó — se muestra siempre el del propio parte, no el de la
  // línea en general)
  numero_orden: string;
  acabado_nombre: string | null;
  espesor: string;
  tipo_palet: string | null;
  pza_caja: number | null;
  objetivo_m2: number | null;
  modelo_nombre: string;
  marca_nombre: string;
  formato_nombre: string;
  area_m2: number;

  incidencias_calidad: IncidenciaCalidadDetalle[];

  // ── Calculado (nunca capturado directamente) ──────────────────
  m2_total: number;
  m2_1a: number;
  m2_comercial: number;
  m2_eco: number;
  m2_contenedor: number;
  pct_1a_completa: number | null;
  pct_comercial_completa: number | null;
  pct_eco_completa: number | null;
  pct_contenedor_completa: number | null;
  pct_1a_oficial: number | null;
  pct_comercial_oficial: number | null;
}

export interface LineaDetalle {
  linea_id: string;
  linea_nombre: string;
  operario_principal: string | null; // del primer parte, orientativo
  partes: ParteDetalle[];
  incidencias_produccion: IncidenciaProduccionDetalle[];
}

export interface TurnoDetalle {
  turno_id: string;
  fecha: string;
  tipo_turno: "M" | "T" | "N";
  cerrado_at: string | null;
  responsable_username: string | null;
  lineas: LineaDetalle[];
  incidencias_generales: IncidenciaProduccionDetalle[]; // linea_id = null
}

export interface FiltrosDetalle {
  fechaDesde: string;
  fechaHasta: string;
  turno?: "M" | "T" | "N";
  lineaNombre?: string;
  responsableUsername?: string;
}

function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

function calcularCalculadosParte(base: Omit<ParteDetalle, keyof ReturnType<typeof camposCalculadosVacios>>): ParteDetalle {
  const entradas = base.piezas_entradas || 0;
  const a1 = base.piezas_1a || 0;
  const comercial = base.piezas_comercial || 0;
  const eco = base.piezas_eco || 0;
  const contenedor = base.piezas_contenedor || 0;

  return {
    ...base,
    m2_total: redondear(entradas * base.area_m2),
    m2_1a: redondear(a1 * base.area_m2),
    m2_comercial: redondear(comercial * base.area_m2),
    m2_eco: redondear(eco * base.area_m2),
    m2_contenedor: redondear(contenedor * base.area_m2),
    pct_1a_completa: entradas > 0 ? redondear((a1 / entradas) * 100) : null,
    pct_comercial_completa: entradas > 0 ? redondear((comercial / entradas) * 100) : null,
    pct_eco_completa: entradas > 0 ? redondear((eco / entradas) * 100) : null,
    pct_contenedor_completa: entradas > 0 ? redondear((contenedor / entradas) * 100) : null,
    pct_1a_oficial: a1 + comercial > 0 ? redondear((a1 / (a1 + comercial)) * 100) : null,
    pct_comercial_oficial: a1 + comercial > 0 ? redondear((comercial / (a1 + comercial)) * 100) : null,
  };
}

function camposCalculadosVacios() {
  return {
    m2_total: 0,
    m2_1a: 0,
    m2_comercial: 0,
    m2_eco: 0,
    m2_contenedor: 0,
    pct_1a_completa: null as number | null,
    pct_comercial_completa: null as number | null,
    pct_eco_completa: null as number | null,
    pct_contenedor_completa: null as number | null,
    pct_1a_oficial: null as number | null,
    pct_comercial_oficial: null as number | null,
  };
}

// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/**
 * Trae la jerarquía completa turno -> línea -> parte para el rango y
 * filtros dados. Solo partes vigentes y completados (mismo criterio
 * que el resto del proyecto).
 */
export async function obtenerDetalle(filtros: FiltrosDetalle): Promise<TurnoDetalle[]> {
  let queryTurnos = supabase
    .from("turno")
    .select(
      `id, fecha, tipo, cerrado_at,
       responsable:abierto_por ( username )`,
    )
    .gte("fecha", filtros.fechaDesde)
    .lte("fecha", filtros.fechaHasta)
    .order("fecha", { ascending: false });
  if (filtros.turno) queryTurnos = queryTurnos.eq("tipo", filtros.turno);

  const { data: turnosRaw, error: errorTurnos } = await queryTurnos;
  if (errorTurnos) throw new Error(`turno: ${errorTurnos.message}`);
  if (!turnosRaw || turnosRaw.length === 0) return [];

  const turnoIds = turnosRaw.map((t) => t.id as string);

  let queryPartes = supabase
    .from("parte")
    .select(
      `id, turno_id, linea_id, tono, calibre, calibre_com_pct, calibre_std_pct,
       piezas_entradas, piezas_1a, piezas_comercial, piezas_eco,
       piezas_descuadre_com, piezas_planar_com, piezas_contenedor,
       cal_1, cal_2, cal_3, cal_4, cal_5, cal_6, cal_7, cal_8,
       minutos_total, minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
       verificacion_caja_estado, verificacion_caja_estado_operario,
       verificacion_codbar_estado, verificacion_codbar_estado_operario,
       hora_captura_pantalla, completado_at, created_at,
       linea:linea_id ( nombre ),
       operario:operario_id ( username ),
       lote:lote_id (
         numero_orden, acabado_nombre, espesor, tipo_palet, pza_caja, objetivo_m2,
         producto:producto_id (
           modelo:modelo_id ( nombre ),
           marca:marca_id ( nombre ),
           formato:formato_id ( nombre, area_m2 )
         )
       ),
       incidencia_calidad ( id, descripcion, fotos, created_at )`,
    )
    .in("turno_id", turnoIds)
    .eq("vigente", true)
    .eq("completado", true)
    .order("created_at", { ascending: true });

  if (filtros.lineaNombre) {
    const { data: lineaRow } = await supabase
      .from("linea")
      .select("id")
      .ilike("nombre", `%${filtros.lineaNombre}%`)
      .limit(1)
      .maybeSingle();
    if (lineaRow) queryPartes = queryPartes.eq("linea_id", lineaRow.id as string);
  }
  if (filtros.responsableUsername) {
    const { data: respRow } = await supabase
      .from("usuario")
      .select("id")
      .ilike("username", `%${filtros.responsableUsername}%`)
      .limit(1)
      .maybeSingle();
    if (respRow) queryPartes = queryPartes.eq("responsable_id", respRow.id as string);
  }

  const { data: partesRaw, error: errorPartes } = await queryPartes;
  if (errorPartes) throw new Error(`parte: ${errorPartes.message}`);

  const { data: incidenciasProdRaw, error: errorInc } = await supabase
    .from("incidencia_produccion")
    .select("id, turno_id, linea_id, descripcion, fotos, created_at")
    .in("turno_id", turnoIds);
  if (errorInc) throw new Error(`incidencia_produccion: ${errorInc.message}`);

  // ── Ensamblado ────────────────────────────────────────────────
  const turnos: TurnoDetalle[] = turnosRaw.map((t) => {
    // deno-lint-ignore no-explicit-any
    const responsable = uno<{ username: string }>((t as any).responsable);
    return {
      turno_id: t.id as string,
      fecha: t.fecha as string,
      tipo_turno: t.tipo as "M" | "T" | "N",
      cerrado_at: t.cerrado_at as string | null,
      responsable_username: responsable?.username ?? null,
      lineas: [],
      incidencias_generales: [],
    };
  });
  const turnoPorId = new Map(turnos.map((t) => [t.turno_id, t]));

  for (const inc of incidenciasProdRaw ?? []) {
    const turno = turnoPorId.get(inc.turno_id as string);
    if (!turno) continue;
    const item: IncidenciaProduccionDetalle = {
      id: inc.id as string,
      descripcion: inc.descripcion as string,
      fotos: (inc.fotos as string[] | null) ?? null,
      created_at: inc.created_at as string,
      linea_id: inc.linea_id as string | null,
    };
    if (!item.linea_id) turno.incidencias_generales.push(item);
    // las que sí tienen línea se reparten más abajo, cuando ya conocemos las líneas del turno
  }

  const lineaPorTurnoYId = new Map<string, LineaDetalle>();

  for (const p of (partesRaw ?? []) as any[]) {
    const turno = turnoPorId.get(p.turno_id as string);
    if (!turno) continue;

    const lineaInfo = uno<{ nombre: string }>(p.linea);
    const operario = uno<{ username: string }>(p.operario);
    const lote = uno<any>(p.lote);
    const producto = uno<any>(lote?.producto);
    const modelo = uno<{ nombre: string }>(producto?.modelo);
    const marca = uno<{ nombre: string }>(producto?.marca);
    const formato = uno<{ nombre: string; area_m2: number }>(producto?.formato);

    const claveLinea = `${turno.turno_id}_${p.linea_id}`;
    let linea = lineaPorTurnoYId.get(claveLinea);
    if (!linea) {
      linea = {
        linea_id: p.linea_id as string,
        linea_nombre: lineaInfo?.nombre ?? "Línea desconocida",
        operario_principal: operario?.username ?? null,
        partes: [],
        incidencias_produccion: [],
      };
      lineaPorTurnoYId.set(claveLinea, linea);
      turno.lineas.push(linea);
    }

    const incidenciasCalidad: IncidenciaCalidadDetalle[] = (p.incidencia_calidad ?? []).map((ic: any) => ({
      id: ic.id,
      descripcion: ic.descripcion,
      fotos: ic.fotos ?? null,
      created_at: ic.created_at,
    }));

    const base = {
      id: p.id,
      tono: p.tono,
      calibre: p.calibre,
      calibre_com_pct: p.calibre_com_pct,
      calibre_std_pct: p.calibre_std_pct,
      piezas_entradas: p.piezas_entradas ?? 0,
      piezas_1a: p.piezas_1a ?? 0,
      piezas_comercial: p.piezas_comercial ?? 0,
      piezas_eco: p.piezas_eco ?? 0,
      piezas_descuadre_com: p.piezas_descuadre_com ?? 0,
      piezas_planar_com: p.piezas_planar_com ?? 0,
      piezas_contenedor: p.piezas_contenedor ?? 0,
      cal_1: p.cal_1,
      cal_2: p.cal_2,
      cal_3: p.cal_3,
      cal_4: p.cal_4,
      cal_5: p.cal_5,
      cal_6: p.cal_6,
      cal_7: p.cal_7,
      cal_8: p.cal_8,
      minutos_total: p.minutos_total ?? 0,
      minutos_plena: p.minutos_plena ?? 0,
      minutos_no_alimentada: p.minutos_no_alimentada ?? 0,
      minutos_saturacion: p.minutos_saturacion ?? 0,
      minutos_banco: p.minutos_banco ?? 0,
      minutos_maquina: p.minutos_maquina ?? 0,
      verificacion_caja_estado: p.verificacion_caja_estado,
      verificacion_caja_estado_operario: p.verificacion_caja_estado_operario,
      verificacion_codbar_estado: p.verificacion_codbar_estado,
      verificacion_codbar_estado_operario: p.verificacion_codbar_estado_operario,
      hora_captura_pantalla: p.hora_captura_pantalla,
      completado_at: p.completado_at,
      created_at: p.created_at,
      operario_username: operario?.username ?? null,
      numero_orden: lote?.numero_orden ?? "—",
      acabado_nombre: lote?.acabado_nombre ?? null,
      espesor: lote?.espesor ?? "—",
      tipo_palet: lote?.tipo_palet ?? null,
      pza_caja: lote?.pza_caja ?? null,
      objetivo_m2: lote?.objetivo_m2 ?? null,
      modelo_nombre: modelo?.nombre ?? "—",
      marca_nombre: marca?.nombre ?? "—",
      formato_nombre: formato?.nombre ?? "—",
      area_m2: formato?.area_m2 ?? 0,
      incidencias_calidad: incidenciasCalidad,
      ...camposCalculadosVacios(),
    };

    linea.partes.push(calcularCalculadosParte(base));
  }

  // Repartir incidencias de producción con línea a su línea correspondiente
  for (const inc of incidenciasProdRaw ?? []) {
    if (!inc.linea_id) continue;
    const claveLinea = `${inc.turno_id}_${inc.linea_id}`;
    const linea = lineaPorTurnoYId.get(claveLinea);
    if (!linea) continue;
    linea.incidencias_produccion.push({
      id: inc.id as string,
      descripcion: inc.descripcion as string,
      fotos: (inc.fotos as string[] | null) ?? null,
      created_at: inc.created_at as string,
      linea_id: inc.linea_id as string | null,
    });
  }

  return turnos.filter((t) => t.lineas.length > 0 || t.incidencias_generales.length > 0);
}