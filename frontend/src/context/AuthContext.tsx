import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  | "pantalla"
  | "jefe_rectificado";

export interface PerfilUsuario {
  id: string;
  username: string;
  rol: RolUsuario;
  letra: "A" | "B" | "C" | "D" | null;
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
  const usuarioRef = useRef<PerfilUsuario | null>(null);
  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);
  useEffect(() => {
    let activo = true;

    async function cargarPerfil(userId: string) {
      const { data, error } = await supabase
        .from("usuario")
        .select("id, username, rol, letra ")
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
  //
  // OJO: se usa usuarioRef.current, NUNCA la variable `usuario` de
  // arriba — esta función se crea una sola vez al montar (deps=[]
  // de este efecto), así que `usuario` quedaría congelado para
  // siempre en su valor inicial (null) y esta guarda nunca se
  // cumpliría. usuarioRef sí se lee "fresco" en cada llamada — bug
  // real detectado en sesión 26/08/2026, el fix anterior (commit
  // b50a6d0) nunca llegó a funcionar por este motivo.
  // TOKEN_REFRESHED y SIGNED_IN pueden dispararse solos, sin que el
  // usuario haga nada, al recuperar el foco (mecanismo interno de
  // Supabase) — confirmado en consola remota 26/08/2026: al volver
  // de la cámara nativa el evento real es SIGNED_IN, no
  // TOKEN_REFRESHED como se asumía antes. Si ya tenemos un perfil
  // cargado para ESE MISMO usuario, no hace falta recargar nada.
  if (
    (evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN") &&
    usuarioRef.current &&
    usuarioRef.current.id === nuevaSesion?.user.id
  ) {
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
