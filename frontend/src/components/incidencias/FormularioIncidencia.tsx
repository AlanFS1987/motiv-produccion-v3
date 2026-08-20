import { useState } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { SelectorFotosMultiple } from "./SelectorFotosMultiple";
import type { CategoriaCloudinary } from "../../lib/cloudinary";

interface FotoSubida {
  url: string;
  previsualizacion: string;
}

interface FormularioIncidenciaProps {
  titulo: string;
  publicIdPrefijo: string;
  categoria: CategoriaCloudinary;
  onGuardar: (descripcion: string, fotosUrls: string[]) => Promise<void>;
  onCancelar: () => void;
}

export function FormularioIncidencia({ titulo, publicIdPrefijo, categoria, onGuardar, onCancelar }: FormularioIncidenciaProps) {
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<FotoSubida[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido = descripcion.trim() !== "";

  async function confirmar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(
        descripcion.trim(),
        fotos.map((f) => f.url),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-500" aria-hidden />
        <p className="text-sm font-medium text-slate-900">{titulo}</p>
      </div>

      <label className="mb-1 block text-xs font-medium text-slate-500">Descripción</label>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={3}
        className="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
        placeholder="Qué ha pasado..."
      />

      <label className="mb-1 block text-xs font-medium text-slate-500">Fotos (opcional)</label>
      <SelectorFotosMultiple fotos={fotos} onCambiar={setFotos} publicIdPrefijo={publicIdPrefijo} categoria={categoria} />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || guardando}
          onClick={confirmar}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Send size={14} aria-hidden />
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}