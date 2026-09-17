// frontend/src/components/RecargarAppBoton.tsx
//
// Botón de "última salida" para cuando algo se queda colgado (foto
// subiendo eternamente, pantalla que no reacciona...) — un reload
// normal ya trae siempre la versión desplegada más reciente (sw.js:
// navegación "red primero"; vercel.json: no-cache en index.html), así
// que no hace falta ningún truco de purgar caché a mano. Confirmación
// antes de recargar porque interrumpe cualquier cosa sin guardar.

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RecargarAppBoton() {
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-[var(--texto-secundario)]">¿Recargar?</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-red-600 px-2 py-1 font-medium text-white"
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="rounded px-2 py-1 text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      title="Recargar la app — úsalo si algo se queda colgado"
      className="flex items-center gap-1 rounded-lg p-1.5 text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
    >
      <RefreshCw size={16} aria-hidden />
    </button>
  );
}