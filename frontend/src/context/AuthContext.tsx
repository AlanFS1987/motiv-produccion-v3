import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase-client";

export type RolUsuario =
  | "responsable"
  | "jefe"
  | "produccion"
  | "calidad"
  | "operario"
  | "administrador"
  | "suplente"
  | "pantalla";

export interface PerfilUsuario {
  id: string;
  username: string;
  rol: RolUsuario;
  letra: "A" | "B" | "C" | "D" | null;
  generaciones_disponibles: number;
}

interface AuthContextValue {
  sesion: Session | null;
  usuario: PerfilUsuario | null;
  cargando: boolean;
  errorPerfil: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(userId: string) {
      const { data, error } = await supabase
        .from("usuario")
        .select("id, username, rol, letra, generaciones_disponibles")
        .eq("id", userId)
        .single();

      if (!activo) return;

      if (error) {
        // La sesión de Auth existe pero no hay fila en `usuario` —
        // no debería pasar en uso normal (se crean juntas), pero si
        // pasa, es mejor avisar claro que dejar al usuario a medias.
        setErrorPerfil(
          "Tu cuenta existe pero no tiene perfil de aplicación asociado. Contacta con el administrador.",
        );
        setUsuario(null);
      } else {
        setErrorPerfil(null);
        setUsuario(data as PerfilUsuario);
      }
    }

    // Estado inicial al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return;
      setSesion(session);
      if (session) {
        cargarPerfil(session.user.id).finally(() => activo && setCargando(false));
      } else {
        setCargando(false);
      }
    });

    // Se mantiene sincronizado ante login/logout/refresco de token
const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
  if (!activo) return;
  setSesion(nuevaSesion);

  // TOKEN_REFRESHED se dispara solo, sin que el usuario haga nada,
  // cada vez que la pestaña recupera el foco (mecanismo interno de
  // Supabase) — abrir la cámara nativa ya cuenta como "perder y
  // recuperar el foco". El usuario y su perfil no han cambiado en
  // ese caso, así que NO se recarga el perfil ni se pasa por
  // cargando=true: eso desmontaría toda la app (App.tsx muestra
  // "Cargando..." a pantalla completa mientras cargando es true) y
  // tiraba por tierra cualquier captura de foto en curso. Detectado
  // en sesión — antes de este fix, CADA foto "en el acto" perdía el
  // progreso al volver de la cámara.
  if (evento === "TOKEN_REFRESHED" && usuario) {
    return;
  }

  if (nuevaSesion) {
    setCargando(true);
    cargarPerfil(nuevaSesion.user.id).finally(() => activo && setCargando(false));
  } else {
    setUsuario(null);
    setCargando(false);
  }
});

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ sesion, usuario, cargando, errorPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>");
  return ctx;
}
