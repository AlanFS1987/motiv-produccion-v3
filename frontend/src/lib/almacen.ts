// frontend/src/lib/almacen.ts
//
// Almacén de repuestos (17-rol-mecanico-plan.md, bloque 3). Pieza 1:
// solo lectura — árbol de categorías + ficha de repuesto (stock,
// referencias, historial). Alta, movimientos manuales y pedidos son
// piezas siguientes.
//
// v_almacen_stock es una VISTA (agregado sobre almacen_movimiento),
// no una tabla con FK — PostgREST no puede "embeberla" con la
// sintaxis `tabla ( columna )` como sí hace con relaciones reales.
// Se consulta aparte y se combina en JS.

import { supabase } from "./supabase-client";


export interface AlmacenCategoria {
  id: string;
  clave: string;
  maquina: string;
  submaquina: string | null;
  nombre: string;
  orden: number;
}

export interface RepuestoResumen {
  id: string;
  nombre: string;
  categoriaId: string;
  imagenUrl: string | null;
  stock: number;
}

export interface ReferenciaRepuesto {
  id: string;
  proveedorNombre: string;
  codigo: string;
}

export interface MovimientoRepuesto {
  id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  fecha: string;
  mecanicoUsername: string | null;
  nota: string | null;
}

export interface RepuestoFicha {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  categoriaId: string;
  stock: number;
  referencias: ReferenciaRepuesto[];
  movimientos: MovimientoRepuesto[];
}

// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

async function obtenerStockPorIds(repuestoIds: string[]): Promise<Map<string, number>> {
  if (repuestoIds.length === 0) return new Map();
  const { data, error } = await supabase.from("v_almacen_stock").select("repuesto_id, stock").in("repuesto_id", repuestoIds);
  if (error) throw new Error(`v_almacen_stock: ${error.message}`);
  return new Map((data ?? []).map((f: any) => [f.repuesto_id, f.stock]));
}

/** Árbol completo, plano — el frontend agrupa por `maquina` para pintar el acordeón. */
export async function listarCategorias(): Promise<AlmacenCategoria[]> {
  const { data, error } = await supabase
    .from("almacen_categoria")
    .select("id, clave, maquina, submaquina, nombre, orden")
    .order("maquina")
    .order("orden");

  if (error) throw new Error(`almacen_categoria: ${error.message}`);
  return data as AlmacenCategoria[];
}

export async function listarRepuestosPorCategoria(categoriaId: string): Promise<RepuestoResumen[]> {
  const { data: repuestos, error } = await supabase
    .from("almacen_repuesto")
    .select("id, nombre, categoria_id, imagen_url")
    .eq("categoria_id", categoriaId)
    .order("nombre");

  if (error) throw new Error(`almacen_repuesto: ${error.message}`);

  const stockPorId = await obtenerStockPorIds((repuestos ?? []).map((r) => r.id));

  return (repuestos ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    categoriaId: r.categoria_id,
    imagenUrl: r.imagen_url,
    stock: stockPorId.get(r.id) ?? 0,
  }));
}

export async function obtenerFichaRepuesto(repuestoId: string): Promise<RepuestoFicha> {
  const [{ data: repuesto, error: errorRepuesto }, { data: referencias, error: errorRef }, { data: movimientos, error: errorMov }] =
    await Promise.all([
      supabase.from("almacen_repuesto").select("id, nombre, descripcion, imagen_url, categoria_id").eq("id", repuestoId).single(),
      supabase
        .from("almacen_repuesto_referencia")
        .select("id, codigo, proveedor:proveedor_id ( nombre )")
        .eq("repuesto_id", repuestoId)
        .order("created_at"),
      supabase
        .from("almacen_movimiento")
        .select("id, tipo, cantidad, fecha, nota, mecanico:mecanico_id ( username )")
        .eq("repuesto_id", repuestoId)
        .order("fecha", { ascending: false }),
    ]);

  if (errorRepuesto) throw new Error(`almacen_repuesto: ${errorRepuesto.message}`);
  if (errorRef) throw new Error(`almacen_repuesto_referencia: ${errorRef.message}`);
  if (errorMov) throw new Error(`almacen_movimiento: ${errorMov.message}`);

  const stockPorId = await obtenerStockPorIds([repuestoId]);

  return {
    id: repuesto.id,
    nombre: repuesto.nombre,
    descripcion: repuesto.descripcion,
    imagenUrl: repuesto.imagen_url,
    categoriaId: repuesto.categoria_id,
    stock: stockPorId.get(repuestoId) ?? 0,
    referencias: (referencias ?? []).map((r: any) => ({
      id: r.id,
      codigo: r.codigo,
      proveedorNombre: uno<{ nombre: string }>(r.proveedor)?.nombre ?? "—",
    })),
    movimientos: (movimientos ?? []).map((m: any) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad: m.cantidad,
      fecha: m.fecha,
      nota: m.nota,
      mecanicoUsername: uno<{ username: string }>(m.mecanico)?.username ?? null,
    })),
  };
}
export interface AlmacenProveedor {
  id: string;
  nombre: string;
}

export async function listarProveedores(): Promise<AlmacenProveedor[]> {
  const { data, error } = await supabase.from("almacen_proveedor").select("id, nombre").order("nombre");
  if (error) throw new Error(`almacen_proveedor: ${error.message}`);
  return data as AlmacenProveedor[];
}

export async function crearProveedor(nombre: string): Promise<string> {
  const { data, error } = await supabase.from("almacen_proveedor").insert({ nombre: nombre.trim() }).select("id").single();
  if (error) throw new Error(`No se pudo crear el proveedor: ${error.message}`);
  return data.id as string;
}

export interface NuevaReferencia {
  proveedorId: string;
  codigo: string;
}

/**
 * Alta "sobre la marcha" (17-rol-mecanico-plan.md 3.5): un único
 * formulario, categoriaId siempre obligatorio (nunca null — si no se
 * sabe, el frontend ya manda el id de "por_catalogar"). Referencias
 * opcionales: filas sin proveedor o sin código se descartan aquí, no
 * hace falta que el frontend las filtre antes de llamar.
 */
export async function crearRepuesto(datos: {
  nombre: string;
  descripcion: string | null;
  categoriaId: string;
  imagenUrl: string | null;
  createdBy: string;
  referencias: NuevaReferencia[];
}): Promise<string> {
  const { data: repuesto, error: errorRepuesto } = await supabase
    .from("almacen_repuesto")
    .insert({
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion,
      categoria_id: datos.categoriaId,
      imagen_url: datos.imagenUrl,
      created_by: datos.createdBy,
    })
    .select("id")
    .single();

  if (errorRepuesto) throw new Error(`No se pudo crear el repuesto: ${errorRepuesto.message}`);

  const referenciasValidas = datos.referencias.filter((r) => r.proveedorId && r.codigo.trim());
  if (referenciasValidas.length > 0) {
    const filas = referenciasValidas.map((r) => ({
      repuesto_id: repuesto.id,
      proveedor_id: r.proveedorId,
      codigo: r.codigo.trim(),
    }));
    const { error: errorRef } = await supabase.from("almacen_repuesto_referencia").insert(filas);
    if (errorRef) throw new Error(`Repuesto creado, pero no se pudieron guardar las referencias: ${errorRef.message}`);
  }

  return repuesto.id as string;
}
export async function registrarMovimiento(
  repuestoId: string,
  tipo: "salida" | "ajuste",
  cantidad: number, // ya con el signo correcto, resuelto por el formulario
  mecanicoId: string,
  nota: string | null,
): Promise<void> {
  const { error } = await supabase.from("almacen_movimiento").insert({
    repuesto_id: repuestoId,
    tipo,
    cantidad,
    mecanico_id: mecanicoId,
    nota,
  });
  if (error) throw new Error(`No se pudo registrar el movimiento: ${error.message}`);
}
function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Crea una categoría (máquina/submáquina) del árbol al vuelo, desde
 * el formulario de alta de repuesto. `clave` se genera sola (slug +
 * sufijo aleatorio para garantizar unicidad sin tener que consultar
 * antes) — no la escribe el mecánico, no hace falta que siga el
 * patrón punteado de Ceria al pie de la letra, solo ser única.
 */
export async function crearCategoria(maquina: string, submaquina: string | null, nombre: string): Promise<string> {
  const sufijo = Math.random().toString(36).slice(2, 6);
  const clave = [slug(maquina), submaquina ? slug(submaquina) : null, sufijo].filter(Boolean).join(".");

  const { data, error } = await supabase
    .from("almacen_categoria")
    .insert({ clave, maquina: maquina.trim(), submaquina: submaquina?.trim() || null, nombre: nombre.trim(), orden: 0 })
    .select("id")
    .single();

  if (error) throw new Error(`No se pudo crear la categoría: ${error.message}`);
  return data.id as string;
}