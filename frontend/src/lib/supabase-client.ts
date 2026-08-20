import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY — revisa tu archivo .env.local",
  );
}

/**
 * Cliente único de Supabase para toda la app. A partir de aquí, las
 * consultas a tablas (con RLS) y las llamadas a Edge Functions vía
 * supabase.functions.invoke() usan automáticamente el token de la
 * sesión activa (o la clave anon si nadie ha iniciado sesión) — ya
 * no hace falta pasar el header Authorization a mano como en
 * lib/supabase-functions.ts (ese archivo se irá retirando a medida
 * que las pantallas reales usen este cliente).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
