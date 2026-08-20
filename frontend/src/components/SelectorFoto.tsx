import { useRef, type ChangeEvent } from "react";
import { Camera, ImageUp } from "lucide-react";

/**
 * Botón doble "Hacer foto" / "Elegir de galería".
 *
 * SIMPLIFICADO (sesión 18/08/2026): el recuadro-guía del padre ya
 * muestra la cámara en vivo por defecto (ver useCamaraLive) — no hay
 * paso de "activar cámara" ni de "confirmar foto" dentro de la
 * página. "Hacer foto" aquí es literalmente el disparador: captura el
 * fotograma actual y el padre sigue el flujo al momento (subida +
 * OCR), igual que pasaba antes con la app de Cámara nativa.
 *
 * "Elegir de galería" sigue exactamente igual que siempre.
 *
 * FIX (sesión 19/08/2026): ese mismo cambio del 18/08 introdujo una
 * regresión sin querer — como `disabled` era un único booleano
 * compartido por los dos botones, y los componentes que llaman a
 * este calculan `disabled` incluyendo `!!camara.error`, en cualquier
 * dispositivo SIN cámara (ej. probar desde un PC de escritorio) se
 * apagaban los dos botones a la vez, incluido "Elegir de galería" —
 * que no necesita cámara para nada y quedaba bloqueado sin salida.
 * Se separan los dos motivos de deshabilitado: `disabledCamara`
 * (pensado para incluir el estado de la cámara) y `disabledGaleria`
 * (pensado para NO depender nunca de la cámara, solo de si se está
 * procesando/subiendo algo). El prop `disabled` original se conserva
 * como atajo que sigue afectando a ambos, por si algún sitio no se
 * actualiza — pero los 4 usos reales del proyecto ya pasan a los
 * props separados.
 */
interface SelectorFotoProps {
  onArchivoSeleccionado: (archivo: File) => void;
  onDisparar: () => void;
  /** Atajo: si se pasa, deshabilita AMBOS botones (comportamiento antiguo). Ignorado si se pasan disabledCamara/disabledGaleria. */
  disabled?: boolean;
  /** Deshabilita solo "Hacer foto" — aquí sí tiene sentido mirar camara.error/camara.cargando. */
  disabledCamara?: boolean;
  /** Deshabilita solo "Elegir de galería" — NO debería depender del estado de la cámara. */
  disabledGaleria?: boolean;
  etiquetaCamara?: string;
  etiquetaGaleria?: string;
}

export function SelectorFoto({
  onArchivoSeleccionado,
  onDisparar,
  disabled = false,
  disabledCamara,
  disabledGaleria,
  etiquetaCamara = "Hacer foto",
  etiquetaGaleria = "Elegir de galería",
}: SelectorFotoProps) {
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
      <input ref={inputGaleriaRef} type="file" accept="image/*" className="hidden" onChange={manejarSeleccion} />

      <button
        type="button"
        disabled={camaraDeshabilitada}
        onClick={onDisparar}
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