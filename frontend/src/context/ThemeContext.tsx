// frontend/src/context/ThemeContext.tsx
// Sistema de temas para TODA la app (Operario, Responsable, Jefe,
// Administrador, Pantalla) — uno solo, reutilizado en todas partes,
// no algo particular de ninguna pantalla (decisión de sesión:
// Pantalla no debía quedarse en oscuro fijo mientras el resto no
// tiene temas; en vez de revertirla a claro, se construye el sistema
// para todos a la vez).
//
// Funciona con variables CSS (ver index.css) aplicadas vía atributo
// `data-tema` en <html>. Los componentes usan esas variables con la
// sintaxis de valor arbitrario de Tailwind v4: `bg-[var(--superficie)]`,
// `text-[var(--texto)]`, etc. — así un componente ya escrito con
// colores fijos (`bg-white`, `text-slate-900`) se puede migrar
// cambiando solo esas clases, sin tocar el resto de su lógica.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type TemaId = "oscuro" | "claro" | "naturaleza" | "cyberpunk" | "sistema";

export interface DefinicionTema {
  id: TemaId;
  nombre: string;
  colorPunto: string; // color del punto del selector (no del tema en sí)
}

export const TEMAS: DefinicionTema[] = [
  { id: "oscuro", nombre: "Oscuro", colorPunto: "#1e293b" },
  { id: "claro", nombre: "Claro", colorPunto: "#fbbf24" },
  { id: "naturaleza", nombre: "Naturaleza", colorPunto: "#22c55e" },
  { id: "cyberpunk", nombre: "Cyberpunk", colorPunto: "#f0abfc" },
  { id: "sistema", nombre: "Sistema", colorPunto: "#94a3b8" },
];

const CLAVE_LOCALSTORAGE = "motiv_tema";

function resolverTemaSistema(): "oscuro" | "claro" {
  if (typeof window === "undefined") return "claro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

interface ThemeContextValue {
  tema: TemaId;
  setTema: (t: TemaId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<TemaId>(() => {
    const guardado = localStorage.getItem(CLAVE_LOCALSTORAGE) as TemaId | null;
    return guardado && TEMAS.some((t) => t.id === guardado) ? guardado : "claro";
  });

  useEffect(() => {
    const temaEfectivo = tema === "sistema" ? resolverTemaSistema() : tema;
    document.documentElement.setAttribute("data-tema", temaEfectivo);
    // Se guarda la elección real ("sistema"), no la resuelta — si el
    // usuario eligió "sistema", debe seguir siguiendo al SO aunque
    // cambie, no quedarse fijo en lo que tocara en ese momento.
    localStorage.setItem(CLAVE_LOCALSTORAGE, tema);
  }, [tema]);

  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const escuchar = () => document.documentElement.setAttribute("data-tema", mq.matches ? "oscuro" : "claro");
    mq.addEventListener("change", escuchar);
    return () => mq.removeEventListener("change", escuchar);
  }, [tema]);

  return <ThemeContext.Provider value={{ tema, setTema: setTemaState }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}