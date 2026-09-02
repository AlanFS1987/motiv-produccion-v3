import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { listarIncidenciasCalidad, type IncidenciaCalidad } from "../../lib/incidencias";
import { VisorFotoOverlay } from "../VisorFoto";

interface ListaIncidenciasCalidadProps {
  parteId: string;
  /** Cambia para forzar un refresco (ej. tras guardar una nueva incidencia). */
  refrescarTrigger?: number;
}

export function ListaIncidenciasCalidad({ parteId, refrescarTrigger }: ListaIncidenciasCalidadProps) {
  const [incidencias, setIncidencias] = useState<IncidenciaCalidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    listarIncidenciasCalidad(parteId)
      .then(setIncidencias)
      .finally(() => setCargando(false));
  }, [parteId, refrescarTrigger]);

  if (cargando || incidencias.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
        <AlertTriangle size={12} aria-hidden />
        Incidencias de calidad ({incidencias.length})
      </p>
      {incidencias.map((inc) => (
        <div key={inc.id} className="rounded-lg bg-amber-50 p-3">
          <p className="text-sm text-amber-900">{inc.descripcion}</p>
          <p className="mt-1 text-xs text-amber-600">
            {new Date(inc.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
          </p>
          {inc.fotos && inc.fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {inc.fotos.map((url) => (
                <button key={url} type="button" onClick={() => setFotoAmpliada(url)}>
                  <img src={url} alt="Foto de incidencia" className="h-16 w-16 rounded-md object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {fotoAmpliada && <VisorFotoOverlay url={fotoAmpliada} onCerrar={() => setFotoAmpliada(null)} />}
    </div>
  );
}