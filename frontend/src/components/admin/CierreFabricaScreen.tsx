import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { listarCierres, crearCierre, eliminarCierre, type CierreFabrica } from "../../lib/admin-cierre-fabrica";

export function CierreFabricaScreen() {
  const [cierres, setCierres] = useState<CierreFabrica[]>([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);

  async function recargar() {
    setCierres(await listarCierres());
  }

  useEffect(() => {
    recargar().finally(() => setCargandoLista(false));
  }, []);

  async function handleCrear() {
    setError(null);
    if (!fechaInicio || !fechaFin) return setError("Faltan fechas.");
    if (fechaFin < fechaInicio) return setError("La fecha de fin no puede ser anterior al inicio.");
    setCargando(true);
    try {
      await crearCierre(fechaInicio, fechaFin);
      setFechaInicio("");
      setFechaFin("");
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setCargando(false);
    }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarCierre(id);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        Bloquea la apertura de turnos en ese rango de fechas (periodo de vacaciones).
        No afecta a la rotación ni a los ciclos, que siguen contando igual.
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Añadir periodo</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-sm text-slate-600">
            Desde
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col text-sm text-slate-600">
            Hasta
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={handleCrear}
            disabled={cargando}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle size={12} aria-hidden />
            {error}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Periodos guardados</h2>
        {cargandoLista ? (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Cargando...
          </div>
        ) : cierres.length === 0 ? (
          <p className="text-sm text-slate-400">Sin periodos de cierre guardados.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {cierres.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{c.fecha_inicio} → {c.fecha_fin}</span>
                <button onClick={() => handleEliminar(c.id)} aria-label="Eliminar" className="text-slate-400 hover:text-red-600">
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}