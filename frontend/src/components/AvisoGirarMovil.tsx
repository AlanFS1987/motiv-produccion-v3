import { RotateCw } from "lucide-react";
import { useOrientacionDispositivo } from "../lib/orientacion";

/**
 * Aviso que se muestra cuando el móvil está en vertical, para las fotos de
 * documentos APAISADOS: la caja (superior 4:3 y lateral, una franja muy alargada)
 * y la pantalla de la máquina. Para esas, girar el móvil deja el texto recto.
 *
 * NO sirve para la hoja de partida (Foto 1): es un A4 VERTICAL, y pedir que se gire el
 * móvil hacía que se fotografiara la hoja de lado (texto vertical, OCR peor). La hoja
 * no usa este aviso: FotoHojaPartida tiene el suyo, siempre visible, que pide la hoja
 * en vertical con la cabecera arriba.
 *
 * No bloquea la captura — el responsable puede ignorarlo y seguir si quiere — solo
 * reduce la probabilidad de que el texto salga girado y el OCR falle.
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
