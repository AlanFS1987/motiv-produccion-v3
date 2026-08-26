// frontend/src/lib/gamificacion.ts
// Tipos compartidos de gamificación (nivel, personaje). La capa de
// datos real vive en lib/inicio-gamificacion.ts (tarjeta de Inicio,
// solo lectura) y lib/stats-avatar.ts (stats en vivo + generación de
// avatar por nivel, generarPersonajeParaNivel).
//
// Antes este archivo tenía obtenerResumenGamificacion() y
// generarPersonaje() (contador plano de generaciones) — se
// eliminaron el 24/08/2026: ninguna pantalla las llamaba ya desde el
// rediseño del 23/08 (generaciones por nivel), y generarPersonaje()
// ni siquiera mandaba nivel_id, que la Edge Function exige — habría
// fallado con 400 si algo la hubiera llamado.

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