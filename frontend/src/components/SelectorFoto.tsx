import { useRef, type ChangeEvent } from "react";
import { Camera, ImageUp } from "lucide-react";

interface SelectorFotoProps {
  onArchivoSeleccionado: (archivo: File) => void;
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
      <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={manejarSeleccion} />
      <input ref={inputGaleriaRef} type="file" accept="image/*" className="hidden" onChange={manejarSeleccion} />

      <button type="button" disabled={camaraDeshabilitada} onClick={() => inputCamaraRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white transition active:scale-[0.98] disabled:opacity-40">
        <Camera size={20} aria-hidden />
        {etiquetaCamara}
      </button>

      <button type="button" disabled={galeriaDeshabilitada} onClick={() => inputGaleriaRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-4 text-base font-medium text-slate-900 transition active:scale-[0.98] disabled:opacity-40">
        <ImageUp size={20} aria-hidden />
        {etiquetaGaleria}
      </button>
    </div>
  );
}