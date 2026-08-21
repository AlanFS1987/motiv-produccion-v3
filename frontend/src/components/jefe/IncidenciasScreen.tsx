// frontend/src/components/jefe/IncidenciasScreen.tsx
// Incidencias del jefe — DOS bloques separados (producción y
// calidad), nunca combinados en una sola lista. Mismo filtro de
// fechas para ambos por comodidad, pero cada bloque consulta y
// muestra de forma independiente.

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Search, Wrench, XCircle } from "lucide-react";
import {
  obtenerIncidenciasCalidad,
  obtenerIncidenciasProduccion,
  type IncidenciaCalidadItem,
  type IncidenciaProduccionItem,
} from "../../lib/dashboard-incidencias";

const NOMBRE_TURNO: Record<string, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function fechaISOHaceNDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TarjetaIncidenciaProduccion({ inc }: { inc: IncidenciaProduccionItem }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-red-500">
        <span className="font-semibold">{inc.fecha}</span>
        <span>· {NOMBRE_TURNO[inc.tipo_turno]}</span>
        <span>· {inc.linea_nombre ?? "General del turno"}</span>
        {inc.creado_por && <span>· {inc.creado_por}</span>}
        <span className="ml-auto text-red-300">{formatearFechaHora(inc.created_at)}</span>
      </div>
      <p className="text-sm text-red-800">{inc.descripcion}</p>
      {inc.fotos && inc.fotos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {inc.fotos.map((url) => (
            <img key={url} src={url} alt="" className="h-20 w-20 rounded-md object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaIncidenciaCalidad({ inc }: { inc: IncidenciaCalidadItem }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-amber-600">
        <span className="font-semibold">{inc.fecha}</span>
        <span>· {NOMBRE_TURNO[inc.tipo_turno]}</span>
        <span>· {inc.linea_nombre}</span>
        <span>
          · {inc.modelo_nombre} ({inc.formato_nombre})
        </span>
        <span>· orden {inc.numero_orden}</span>
        {inc.creado_por && <span>· {inc.creado_por}</span>}
        <span className="ml-auto text-amber-300">{formatearFechaHora(inc.created_at)}</span>
      </div>
      <p className="text-sm text-amber-900">{inc.descripcion}</p>
      {inc.fotos && inc.fotos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {inc.fotos.map((url) => (
            <img key={url} src={url} alt="" className="h-20 w-20 rounded-md object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

export function IncidenciasScreen() {
  const [fechaDesde, setFechaDesde] = useState(fechaISOHaceNDias(14));
  const [fechaHasta, setFechaHasta] = useState(fechaISOHaceNDias(0));

  const [produccion, setProduccion] = useState<IncidenciaProduccionItem[]>([]);
  const [calidad, setCalidad] = useState<IncidenciaCalidadItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    setCargando(true);
    setError(null);
    try {
      const [prod, cal] = await Promise.all([
        obtenerIncidenciasProduccion(fechaDesde, fechaHasta),
        obtenerIncidenciasCalidad(fechaDesde, fechaHasta),
      ]);
      setProduccion(prod);
      setCalidad(cal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando incidencias");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Filtro de fechas, compartido por los dos bloques */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="flex flex-col text-xs text-slate-500">
          Desde
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Hasta
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={buscar}
          disabled={cargando}
          className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Search size={14} aria-hidden />
          Buscar
        </button>
      </div>

      {cargando && (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Cargando...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* Bloque PRODUCCIÓN — paros, fallos de máquina, falta de material */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wrench size={16} className="text-red-500" aria-hidden />
              Incidencias de producción ({produccion.length})
            </h2>
            {produccion.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                Sin incidencias de producción en este periodo.
              </p>
            ) : (
              <div className="space-y-2">
                {produccion.map((inc) => (
                  <TarjetaIncidenciaProduccion key={inc.id} inc={inc} />
                ))}
              </div>
            )}
          </section>

          {/* Bloque CALIDAD — defectos de producto, nunca mezclado con lo anterior */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <XCircle size={16} className="text-amber-500" aria-hidden />
              Incidencias de calidad ({calidad.length})
            </h2>
            {calidad.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                Sin incidencias de calidad en este periodo.
              </p>
            ) : (
              <div className="space-y-2">
                {calidad.map((inc) => (
                  <TarjetaIncidenciaCalidad key={inc.id} inc={inc} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}