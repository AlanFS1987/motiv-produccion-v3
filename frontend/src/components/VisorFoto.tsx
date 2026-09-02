// frontend/src/components/VisorFoto.tsx
//
// Capa a pantalla completa para ver una foto de incidencia en
// grande. Se abre tocando la miniatura desde cualquier pantalla que
// la use, se cierra tocando fuera de la imagen o el botón de cerrar.
// Componente único, reutilizado en todos los sitios donde aparecen
// fotos de incidencias.

import { X } from "lucide-react";

interface VisorFotoOverlayProps {
  url: string;
  onCerrar: () => void;
}

export function VisorFotoOverlay({ url, onCerrar }: VisorFotoOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onCerrar}>
      <button
        type="button"
        onClick={onCerrar}
        className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
        aria-label="Cerrar"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt="Foto de incidencia ampliada"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}