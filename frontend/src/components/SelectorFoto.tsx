import { useRef, type ChangeEvent } from "react";
import { Camera, ImageUp } from "lucide-react";

/**
 * Botón doble "Hacer foto" / "Elegir de galería".
 *
 * VUELTA A CÁMARA NATIVA (sesión 28/08/2026): "Hacer foto" ya no
 * dispara una captura de cámara en vivo (useCamaraLive) — ahora es
 * un <input type="file" capture="environment"> que delega en la app
 * de Cámara del sistema, igual que "Elegir de galería" pero forzando
 * la cámara trasera. El bug de Chrome que motivó el cambio a cámara
 * en vivo (recarga de pestaña al volver de la app nativa en varios
 * Xiaomi, sesión 18/08/2026) se comprobó resuelto en prueba real.
 * Por eso ya no hace falta el prop `onDisparar`: ambos botones
 * terminan en `onArchivoSeleccionado`.
 */
interface SelectorFotoProps {
  onArchivoSeleccionado: (archivo: File) => void;
  /** Atajo: si se pasa, deshabilita AMBOS botones. Ignorado si se pasan disabledCamara/disabledGaleria. */
  disabled?: boolean;
  disabledCamara?: boolean;
  disabledGaleria?: boolean;
  etiquetaCamara?: string;
  etiquetaGaleria?: string;
}

export function SelectorFoto({
  onArchivoSeleccionado,
  disabled = false,
  disabledCamara,
  disabledGaleria,
  etiquetaCamara = "Hacer foto",
  etiquetaGaleria = "Elegir de galería",
}: SelectorFotoProps) {
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

  const camaraDeshabilitada = disabledCamara ?? disabled;
  const galeriaDeshabilitada = disabledGaleria ?? disabled;

  function manejarSeleccion(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (archivo) {
      onArchivoSeleccionado(archivo);
    }
  }

  return (
    <div className="flex gap-3">
      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={manejarSeleccion}
      />
      <input ref={inputGaleriaRef} type="file" accept="image/*" className="hidden" onChange={manejarSeleccion} />

      <button
        type="button"
        disabled={camaraDeshabilitada}
        onClick={() => inputCamaraRef.current?.click()}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        <Camera size={20} aria-hidden />
        {etiquetaCamara}
      </button>

      <button
        type="button"
        disabled={galeriaDeshabilitada}
        onClick={() => inputGaleriaRef.current?.click()}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-4 text-base font-medium text-slate-900 transition active:scale-[0.98] disabled:opacity-40"
      >
        <ImageUp size={20} aria-hidden />
        {etiquetaGaleria}
      </button>
    </div>
  );
}