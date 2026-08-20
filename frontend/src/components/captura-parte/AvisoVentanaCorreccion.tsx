import { useState } from "react";
import { Info } from "lucide-react";

const CLAVE_OCULTAR = "motiv:ocultar-aviso-correccion";

export function huboSidoOcultado(): boolean {
  try {
    return localStorage.getItem(CLAVE_OCULTAR) === "true";
  } catch {
    return false;
  }
}

interface AvisoVentanaCorreccionProps {
  onContinuar: () => void;
}

/**
 * Aviso tras cerrar un parte: recuerda la ventana de 1h para
 * corregirlo (04-rol-administrador.md 6.3). Se puede silenciar de
 * forma permanente con el checkbox — guardado en localStorage, no en
 * Supabase, es solo una preferencia de este navegador.
 */
export function AvisoVentanaCorreccion({ onContinuar }: AvisoVentanaCorreccionProps) {
  const [noMostrarMas, setNoMostrarMas] = useState(false);

  function continuar() {
    if (noMostrarMas) {
      try {
        localStorage.setItem(CLAVE_OCULTAR, "true");
      } catch {
        // si localStorage falla, simplemente se volverá a mostrar la próxima vez
      }
    }
    onContinuar();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
      <Info size={32} className="mx-auto mb-3 text-slate-400" aria-hidden />
      <p className="mb-1 text-base font-medium text-slate-900">Parte guardado</p>
      <p className="mb-4 text-sm text-slate-500">
        Tienes <strong>1 hora</strong> desde ahora para corregirlo si ves algo mal — pasado ese tiempo, solo el
        administrador podrá hacerlo.
      </p>
      <label className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={noMostrarMas} onChange={(e) => setNoMostrarMas(e.target.checked)} />
        No volver a mostrar este aviso
      </label>
      <button type="button" onClick={continuar} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
        Entendido
      </button>
    </div>
  );
}