import { useEffect, useState } from "react";

export type Orientacion = "portrait" | "landscape";

function leerOrientacionActual(): Orientacion {
  if (typeof window === "undefined") return "landscape";
  return window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
}

/**
 * Detecta si el dispositivo está en vertical (portrait) u horizontal
 * (landscape), actualizándose en vivo al girar el móvil. Se usa para
 * avisar al responsable que gire el teléfono antes de fotografiar
 * documentos — el texto girado hace que el OCR falle mucho más
 * (confirmado con pruebas reales, ver notas de sesión).
 */
export function useOrientacionDispositivo(): Orientacion {
  const [orientacion, setOrientacion] = useState<Orientacion>(leerOrientacionActual);

  useEffect(() => {
    const mql = window.matchMedia("(orientation: portrait)");
    const manejar = () => setOrientacion(mql.matches ? "portrait" : "landscape");
    manejar();
    mql.addEventListener("change", manejar);
    return () => mql.removeEventListener("change", manejar);
  }, []);

  return orientacion;
}
