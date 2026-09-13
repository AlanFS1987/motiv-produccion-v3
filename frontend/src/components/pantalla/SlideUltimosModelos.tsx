// frontend/src/components/pantalla/SlideUltimosModelos.tsx
// Diapositiva 2 — REAL (v_calidad_modelo). Los 9 productos con
// producción más reciente, con donut de calidad completa y oficial.

import { useEffect, useState } from "react";
import { obtenerUltimosModelos, type ModeloReciente } from "../../lib/pantalla-carrusel";
import { Donut, SlideCargando, SlideError, SlideVacio } from "./PantallaCompartido";

export function SlideUltimosModelos() {
  const [modelos, setModelos] = useState<ModeloReciente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerUltimosModelos(9)
      .then(setModelos)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando modelos"));
  }, []);

  if (error) return <SlideError mensaje={error} />;
  if (!modelos) return <SlideCargando />;
  if (modelos.length === 0) return <SlideVacio mensaje="Sin producción registrada todavía." />;

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <h2 className="text-lg font-semibold text-[var(--texto)]">Últimos {modelos.length} modelos en producción</h2>
      <div className="grid flex-1 grid-cols-3 gap-4 overflow-y-auto">
        {modelos.map((m) => (
          <div key={m.producto_id} className="rounded-xl bg-[var(--superficie-alt)] p-4">
            <p className="truncate text-sm font-semibold text-[var(--texto)]">{m.modelo_nombre}</p>
            <p className="text-xs text-[var(--texto-secundario)]">{m.formato_nombre}</p>
            <p className="mt-1 text-sm text-sky-400">{Math.round(m.m2_total).toLocaleString("es-ES")} m²</p>
            <div className="mt-3 flex items-center justify-around">
              <div className="flex flex-col items-center gap-1">
                <Donut
                  size={120}
                  segmentos={[
                    { valor: m.pct_1a_completa ?? 0, color: "#22c55e" },
                    { valor: m.pct_comercial_completa ?? 0, color: "#f97316" },
                    { valor: m.pct_contenedor_completa ?? 0, color: "#64748b" },
                  ]}
                />
                <span className="text-xs text-[var(--texto-secundario)]">Total {m.pct_1a_completa ?? 0}%</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Donut
                  size={120}
                  segmentos={[
                    { valor: m.pct_1a_oficial ?? 0, color: "#22c55e" },
                    { valor: m.pct_comercial_oficial ?? 0, color: "#f97316" },
                  ]}
                />
                <span className="text-xs text-[var(--texto-secundario)]">Oficial {m.pct_1a_oficial ?? 0}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 text-[11px] text-[var(--texto-secundario)]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> 1ª calidad
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> 2ª calidad
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-500" /> Contenedor · Oficial = sin contenedor
        </span>
      </div>
    </div>
  );
}