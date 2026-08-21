import { useState } from "react";
import { Camera, ImageUp, X, Loader2 } from "lucide-react";
import { cargarImagenDesdeArchivo, procesarFotoLibre } from "../../lib/captura-imagen";
import { subirACloudinary, construirPublicId, type CategoriaCloudinary } from "../../lib/cloudinary";

interface FotoSubida {
  url: string;
  previsualizacion: string;
}

interface SelectorFotosMultipleProps {
  fotos: FotoSubida[];
  onCambiar: (fotos: FotoSubida[]) => void;
  publicIdPrefijo: string;
  categoria: CategoriaCloudinary;
  maxFotos?: number;
}

/**
 * Selector de varias fotos libres (sin recorte guiado), para
 * incidencias de calidad/producción. Cada foto se sube a Cloudinary
 * en cuanto se elige — el array de URLs resultante es lo que se
 * guarda en `fotos text[]`.
 */
export function SelectorFotosMultiple({ fotos, onCambiar, publicIdPrefijo, categoria, maxFotos = 5 }: SelectorFotosMultipleProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarArchivo(archivo: File) {
    if (fotos.length >= maxFotos) return;
    setSubiendo(true);
    setError(null);
    try {
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFotoLibre(img);
      const previsualizacion = URL.createObjectURL(procesada.blob);
      const publicId = construirPublicId(publicIdPrefijo);
      const subida = await subirACloudinary(procesada.blob, publicId, categoria);
      onCambiar([...fotos, { url: subida.url, previsualizacion }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubiendo(false);
    }
  }

  function quitarFoto(index: number) {
    const foto = fotos[index];
    if (foto) {
      // Libera la URL de objeto local de la previsualización — el
      // archivo real en Cloudinary no se borra (preset unsigned, no
      // permite borrado desde el navegador sin exponer credenciales;
      // queda para la purga periódica de retención).
      URL.revokeObjectURL(foto.previsualizacion);
    }
    onCambiar(fotos.filter((_, i) => i !== index));
  }

  function manejarInputArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo) manejarArchivo(archivo);
  }

  return (
    <div>
      {fotos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <div key={f.url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
              <img src={f.previsualizacion} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => quitarFoto(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                aria-label="Quitar foto"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {fotos.length < maxFotos && (
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-slate-900 py-2 text-xs font-medium text-slate-900">
            {subiendo ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
            Hacer foto
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={subiendo} onChange={manejarInputArchivo} />
          </label>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600">
            <ImageUp size={16} aria-hidden />
            Galería
            <input type="file" accept="image/*" className="hidden" disabled={subiendo} onChange={manejarInputArchivo} />
          </label>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}