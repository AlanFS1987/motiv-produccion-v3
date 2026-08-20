import { supabase } from "./supabase-client";

/**
 * Supabase Auth necesita un email por debajo, pero `usuario.username`
 * (05-modelo-de-datos.md / 11-esquema-supabase.md 13.3) es lo único
 * que el responsable/operario escribe y recuerda — nunca ven ni
 * escriben un email real. Se traduce de forma determinista a un
 * email sintético dentro de un dominio que nunca recibe correo real.
 */
const DOMINIO_SINTETICO = "motivproduccion.local";

export function emailSinteticoDeUsername(username: string): string {
  const limpio = username.trim().toLowerCase();
  return `${limpio}@${DOMINIO_SINTETICO}`;
}

export interface ResultadoLogin {
  ok: boolean;
  error?: string;
}

export async function iniciarSesion(username: string, password: string): Promise<ResultadoLogin> {
  if (!username.trim() || !password) {
    return { ok: false, error: "Escribe usuario y contraseña" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: emailSinteticoDeUsername(username),
    password,
  });

  if (error) {
    // No revelamos si el fallo es "usuario no existe" vs "contraseña
    // incorrecta" — mismo mensaje genérico, práctica habitual de login.
    return { ok: false, error: "Usuario o contraseña incorrectos" };
  }

  return { ok: true };
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}
