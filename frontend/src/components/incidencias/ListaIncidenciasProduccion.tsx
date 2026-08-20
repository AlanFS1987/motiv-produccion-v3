import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  listarIncidenciasProduccionLinea,
  listarIncidenciasProduccionGenerales,
  type IncidenciaProduccion,
} from "../../lib/incidencias";

interface ListaIncidenciasProduccionProps {
  turnoId: string;
  /** null = incidencias generales del turno (sin línea). */
  lineaId: string | null;
  refrescarTrigger?: number;
}

export function ListaIncidenciasProduccion({ turnoId, lineaId, refrescarTrigger }: ListaIncidenciasProduccionProps) {
  const [incidencias, setIncidencias] = useState<IncidenciaProduccion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    const promesa = lineaId
      ? listarIncidenciasProduccionLinea(turnoId, lineaId)
      : listarIncidenciasProduccionGenerales(turnoId);
    promesa.then(setIncidencias).finally(() => setCargando(false));
  }, [turnoId, lineaId, refrescarTrigger]);

  if (cargando || incidencias.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-red-700">
        <AlertTriangle size={12} aria-hidden />
        Incidencias de producción ({incidencias.length})
      </p>
      {incidencias.map((inc) => (
        <div key={inc.id} className="rounded-lg bg-red-50 p-2">
          <p className="text-xs text-red-900">{inc.descripcion}</p>
          <p className="mt-1 text-[10px] text-red-500">
            {new Date(inc.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
          </p>
          {inc.fotos && inc.fotos.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {inc.fotos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="Foto de incidencia" className="h-12 w-12 rounded-md object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}