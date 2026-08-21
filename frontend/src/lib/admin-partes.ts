// frontend/src/lib/admin-partes.ts
// Búsqueda de partes para el panel de administrador
// (09-administrador.md — "Corrección de partes sin límite de
// tiempo"). A diferencia de dashboard-detallada.ts (jerarquía
// turno -> línea -> parte, para auditar un turno completo), esto es
// una búsqueda PLANA: el admin no navega turno a turno, busca el
// parte concreto que necesita corregir. El detalle completo para
// editar se pide aparte con obtenerParteDetalle (lib/parte.ts)
// cuando se selecciona una fila — evita duplicar aquí todos los
// campos de piezas/calibres/tiempos que la lista no necesita mostrar.

import { supabase } from "./supabase-client";

export interface FiltrosBusquedaPartes {
  fechaDesde: string;
  fechaHasta: string;
  turno?: "M" | "T" | "N";
  lineaNombre?: string;
  responsableUsername?: string;
}

export interface ParteBusqueda {
  id: string;
  fecha: string;
  tipoTurno: "M" | "T" | "N";
  lineaNombre: string;
  responsableUsername: string | null;
  operarioUsername: string | null;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  numeroOrden: string;
  tono: string;
  calibre: string | null;
  piezasEntradas: number;
  completadoAt: string | null;
}

const LIMITE_RESULTADOS = 150;

function uno<T>(valor: T | T[] | null | undefined): T | null {
  return (Array.isArray(valor) ? (valor[0] ?? null) : valor) as T | null;
}

/**
 * Busca partes VIGENTES y COMPLETADOS en el rango/filtros dados —
 * mismo criterio que el resto de la app (solo lo que "cuenta" hoy).
 * Sin ventana de 1h ni límite a "hoy": el admin puede corregir
 * cualquiera de estos, por eso el rango de fechas es libre.
 *
 * Mismo patrón de dos pasos que dashboard-detallada.ts: primero se
 * resuelven los turnos del rango (fecha vive en `turno`, no en
 * `parte`), luego se filtra `parte` por esos turno_id.
 */
export async function buscarPartes(filtros: FiltrosBusquedaPartes): Promise<ParteBusqueda[]> {
  let queryTurnos = supabase
    .from("turno")
    .select("id, fecha, tipo")
    .gte("fecha", filtros.fechaDesde)
    .lte("fecha", filtros.fechaHasta);
  if (filtros.turno) queryTurnos = queryTurnos.eq("tipo", filtros.turno);

  const { data: turnosRaw, error: errorTurnos } = await queryTurnos;
  if (errorTurnos) throw new Error(`turno: ${errorTurnos.message}`);
  if (!turnosRaw || turnosRaw.length === 0) return [];

  const turnoPorId = new Map(turnosRaw.map((t) => [t.id as string, t]));
  const turnoIds = turnosRaw.map((t) => t.id as string);

  let queryPartes = supabase
    .from("parte")
    .select(
      `id, turno_id, tono, calibre, piezas_entradas, completado_at,
       linea:linea_id ( nombre ),
       responsable:responsable_id ( username ),
       operario:operario_id ( username ),
       lote:lote_id (
         numero_orden,
         producto:producto_id (
           modelo:modelo_id ( nombre ),
           marca:marca_id ( nombre ),
           formato:formato_id ( nombre )
         )
       )`,
    )
    .in("turno_id", turnoIds)
    .eq("vigente", true)
    .eq("completado", true)
    .order("completado_at", { ascending: false })
    .limit(LIMITE_RESULTADOS);

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

  return ((partesRaw ?? []) as any[]).map((p) => {
    const turno = turnoPorId.get(p.turno_id as string);
    const linea = uno<{ nombre: string }>(p.linea);
    const responsable = uno<{ username: string }>(p.responsable);
    const operario = uno<{ username: string }>(p.operario);
    const lote = uno<any>(p.lote);
    const producto = uno<any>(lote?.producto);
    const modelo = uno<{ nombre: string }>(producto?.modelo);
    const marca = uno<{ nombre: string }>(producto?.marca);
    const formato = uno<{ nombre: string }>(producto?.formato);

    return {
      id: p.id as string,
      fecha: (turno?.fecha as string) ?? "",
      tipoTurno: (turno?.tipo as "M" | "T" | "N") ?? "M",
      lineaNombre: linea?.nombre ?? "—",
      responsableUsername: responsable?.username ?? null,
      operarioUsername: operario?.username ?? null,
      modeloNombre: modelo?.nombre ?? "—",
      marcaNombre: marca?.nombre ?? "—",
      formatoNombre: formato?.nombre ?? "—",
      numeroOrden: lote?.numero_orden ?? "—",
      tono: p.tono as string,
      calibre: p.calibre as string | null,
      piezasEntradas: (p.piezas_entradas as number) ?? 0,
      completadoAt: p.completado_at as string | null,
    };
  });
}