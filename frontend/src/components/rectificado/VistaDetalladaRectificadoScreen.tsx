// frontend/src/components/rectificado/VistaDetalladaRectificadoScreen.tsx
//
// Mismo patrón que jefe/VistaDetalladaScreen.tsx: filtros fecha
// desde/hasta, turno, línea (sin responsable — no existe para esta
// sección). Acordeón turno → línea, con desglose de calidad por
// modelo debajo de cada línea (v_rectificado_modelo).

import { useEffect, useState } from "react";
import {
  obtenerDetalleRectificado,
  obtenerCalidadPorModeloRectificado,
  type TurnoRectificado,
  type ModeloRectificado,
  type FiltroRectificado,
} from "../../lib/dashboard-rectificado";

export function VistaDetalladaRectificadoScreen() {
  const [filtro, setFiltro] = useState<FiltroRectificado>({});
  const [filas, setFilas] = useState<TurnoRectificado[]>([]);
  const [modelos, setModelos] = useState<ModeloRectificado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([obtenerDetalleRectificado(filtro), obtenerCalidadPorModeloRectificado(filtro)])
      .then(([f, m]) => {
        if (!activo) return;
        setFilas(f);
        setModelos(m);
        setError(null);
      })
      .catch((err) => activo && setError(err instanceof Error ? err.message : "Error cargando datos"))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [filtro]);

  function toggle(clave: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={filtro.fechaDesde ?? ""}
          onChange={(e) => setFiltro((f) => ({ ...f, fechaDesde: e.target.value || undefined }))}
          className="rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 text-sm"
        />
        <input
          type="date"
          value={filtro.fechaHasta ?? ""}
          onChange={(e) => setFiltro((f) => ({ ...f, fechaHasta: e.target.value || undefined }))}
          className="rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 text-sm"
        />
        <select
          value={filtro.tipoTurno ?? ""}
          onChange={(e) => setFiltro((f) => ({ ...f, tipoTurno: (e.target.value || undefined) as any }))}
          className="rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 text-sm"
        >
          <option value="">Todos los turnos</option>
          <option value="M">Mañana</option>
          <option value="T">Tarde</option>
          <option value="N">Noche</option>
        </select>
      </div>

      {cargando ? (
        <p className="text-sm text-[var(--texto-secundario)]">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-2">
          {filas.map((t) => {
            const clave = `${t.turnoId}_${t.lineaId}`;
            const abierta = abiertos.has(clave);
            const modelosLinea = modelos.filter((m) => m.turnoId === t.turnoId && m.lineaId === t.lineaId);
            return (
              <div key={clave} className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)]">
                <button
                  onClick={() => toggle(clave)}
                  className="flex w-full items-center justify-between p-3 text-left text-sm"
                >
                  <span>
                    {t.fecha} · {t.tipoTurno} · {t.lineaNombre}
                  </span>
                  <span className="text-[var(--texto-secundario)]">
                    {t.pctRendimiento ?? "—"}% · {Math.round(t.m2Total)} m² · std {t.pctCalibreStd ?? "—"}%
                  </span>
                </button>
                {abierta && (
                  <div className="border-t border-[var(--borde)] p-3 text-sm">
                    <p className="mb-2 text-[var(--texto-secundario)]">
                      Piezas/min: {t.piezasMinuto ?? "—"} · Pleno: {t.minutosPlenoRendimiento}min ·
                      Paradas propias: {t.minutosParadasPropias}min · Paradas ajenas: {t.minutosParadasAjenas}min
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[var(--texto-tenue)]">
                          <th className="pb-1">Modelo</th>
                          <th className="pb-1">Piezas</th>
                          <th className="pb-1">m²</th>
                          <th className="pb-1">Std %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelosLinea.map((m) => (
                          <tr key={m.modeloNombre}>
                            <td className="py-1">{m.modeloNombre}</td>
                            <td className="py-1">{m.piezasTotal}</td>
                            <td className="py-1">{Math.round(m.m2Total)}</td>
                            <td className="py-1">{m.pctCalibreStd ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}