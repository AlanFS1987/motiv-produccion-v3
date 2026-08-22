// frontend/src/lib/gamificacion.ts
// Capa de datos de la pantalla Inicio del operario/responsable
// (sesión 22/08/2026 — retoma lo que InicioOperarioScreen.tsx dejó
// "deliberadamente vacío" el 19/08/2026, ahora que el resto de la
// gamificación ya está construido: puntos, niveles, ciclo,
// personaje RPG).

import { supabase } from "./supabase-client";

export interface NivelInfo {
  id: string;
  nombre: string;
  descripcion: string | null;
  color_marco: string;
  estrellas: number;
  efecto_aura: string | null;
  orden: number;
  umbral_min: number;
  umbral_max: number | null;
}

export interface PersonajeInfo {
  id: string;
  imagen_url: string;
  historia: string | null;
  created_at: string;
}

export interface ResumenGamificacion {
  puntosTotales: number;
  nivelActual: NivelInfo;
  /** null si ya está en el último nivel (Leyenda) — no hay "siguiente". */
  siguienteNivel: NivelInfo | null;
  /** null si todavía no ha generado ningún personaje. */
  personaje: PersonajeInfo | null;
  generacionesDisponibles: number;
}

/**
 * Trae todo lo que necesita la tarjeta de gamificación de Inicio.
 * El rol decide tanto qué vista de puntos usar (v_puntos_operario_
 * total_vida / v_puntos_responsable_total_vida) como qué columna de
 * umbral de `niveles` le corresponde (los del responsable son ×1,5,
 * ver 04-gamificacion.md).
 */
export async function obtenerResumenGamificacion(
  usuarioId: string,
  rol: "operario" | "responsable",
): Promise<ResumenGamificacion> {
  const vista = rol === "operario" ? "v_puntos_operario_total_vida" : "v_puntos_responsable_total_vida";
  const columnaId = rol === "operario" ? "operario_id" : "responsable_id";
  const colMin = rol === "operario" ? "umbral_min" : "umbral_min_responsable";
  const colMax = rol === "operario" ? "umbral_max" : "umbral_max_responsable";

  const [
    { data: puntosData, error: errorPuntos },
    { data: nivelesData, error: errorNiveles },
    { data: personajeData, error: errorPersonaje },
    { data: usuarioData, error: errorUsuario },
  ] = await Promise.all([
    supabase.from(vista).select("puntos_totales").eq(columnaId, usuarioId).maybeSingle(),
    supabase
      .from("niveles")
      .select(`id, nombre, descripcion, color_marco, estrellas, efecto_aura, orden, umbral_min:${colMin}, umbral_max:${colMax}`)
      .order("orden", { ascending: true }),
    supabase
      .from("personaje_rpg")
      .select("id, imagen_url, historia, created_at")
      .eq("usuario_id", usuarioId)
      .eq("seleccionada", true)
      .maybeSingle(),
    supabase.from("usuario").select("generaciones_disponibles").eq("id", usuarioId).single(),
  ]);

  if (errorPuntos) throw new Error(errorPuntos.message);
  if (errorNiveles) throw new Error(errorNiveles.message);
  if (errorPersonaje) throw new Error(errorPersonaje.message);
  if (errorUsuario) throw new Error(errorUsuario.message);

  const niveles = (nivelesData ?? []) as unknown as NivelInfo[];
  if (niveles.length === 0) throw new Error("No hay niveles configurados en la base de datos");

  const puntosTotales = (puntosData?.puntos_totales as number | undefined) ?? 0;

  // El nivel actual es el último cuyo umbral_min ya se ha alcanzado
  // (los niveles vienen ordenados por `orden`, así que basta con
  // recorrerlos y quedarse con el último que cumple).
  let indiceActual = 0;
  for (let i = 0; i < niveles.length; i++) {
    if (puntosTotales >= niveles[i].umbral_min) indiceActual = i;
  }
  const nivelActual = niveles[indiceActual];
  const siguienteNivel = niveles[indiceActual + 1] ?? null;

  return {
    puntosTotales,
    nivelActual,
    siguienteNivel,
    personaje: (personajeData as PersonajeInfo | null) ?? null,
    generacionesDisponibles: (usuarioData?.generaciones_disponibles as number | undefined) ?? 0,
  };
}

export interface RespuestaGenerarPersonaje {
  ok: true;
  personaje: PersonajeInfo;
  nivel: { id: string; nombre: string };
}

/**
 * Llama a la Edge Function generar-personaje. Siempre manual — el
 * usuario pulsa el botón, nunca se dispara solo (decisión de sesión
 * 22/08/2026). Igual que en v1/v2: necesita una imagen de referencia
 * (cualquier imagen de la galería del usuario, ya subida a Cloudinary
 * — ver subirACloudinary con categoría "personajes") y admite un
 * texto libre opcional que el usuario añade a mano.
 *
 * Mismo patrón de manejo de errores que ocrParte/preguntarCeria: si
 * el error trae un cuerpo JSON legible, se usa ese mensaje en vez del
 * genérico de la librería.
 */
export async function generarPersonaje(
  imagenReferenciaUrl: string,
  promptOperario?: string,
): Promise<RespuestaGenerarPersonaje> {
  const { data, error } = await supabase.functions.invoke<RespuestaGenerarPersonaje>("generar-personaje", {
    body: {
      imagen_referencia_url: imagenReferenciaUrl,
      prompt_operario: promptOperario,
    },
  });

  if (error) {
    let mensaje = error.message ?? "Error llamando a generar-personaje";
    try {
      // deno-lint-ignore no-explicit-any
      const cuerpo = await (error as any).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      // sin cuerpo JSON legible, nos quedamos con error.message
    }
    throw new Error(mensaje);
  }

  return data as RespuestaGenerarPersonaje;
}