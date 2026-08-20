import { RotateCw } from "lucide-react";
import { useOrientacionDispositivo } from "../lib/orientacion";

/**
 * Aviso que se muestra cuando el móvil está en vertical, para las
 * fotos de documentos (todas nuestras 4 formas son más anchas que
 * altas). No bloquea la captura — el responsable puede ignorarlo y
 * seguir si quiere — solo reduce la probabilidad de que el texto
 * salga girado y el OCR falle.
 */
export function AvisoGirarMovil() {
  const orientacion = useOrientacionDispositivo();

  if (orientacion !== "portrait") return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
      <RotateCw size={18} className="shrink-0" aria-hidden />
      <span>Gira el móvil en horizontal para que el texto salga recto — así el OCR lee mucho mejor.</span>
    </div>
  );
}
