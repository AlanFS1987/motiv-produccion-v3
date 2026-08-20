import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerHistorialOperario, type TurnoHistorialItem } from "../../lib/operario";

const NOMBRE_TIPO: Record<"M" | "T" | "N", string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function formatearFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Historial del operario (03-rol-operario.md 5.2) — turnos de los
 * últimos 15 días, expandible por turno → línea → partes individuales.
 */
export function HistorialOperarioScreen() {
  const { usuario } = useAuth();
  const [turnos, setTurnos] = useState<TurnoHistorialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnoAbierto, setTurnoAbierto] = useState<string | null>(null);
  const [lineaAbierta, setLineaAbierta] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    setCargando(true);
    obtenerHistorialOperario(usuario.id)
      .then((datos) => {
        if (!cancelado) setTurnos(datos);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando historial...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (turnos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-medium text-slate-900">Todavía no tienes partes en los últimos 15 días</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3">
      {turnos.map((turno) => {
        const abierto = turnoAbierto === turno.turnoId;
        const totalPartes = turno.lineas.reduce((n, l) => n + l.partes.length, 0);

        return (
          <div key={turno.turnoId} className="overflow-hidden rounded-xl bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setTurnoAbierto(abierto ? null : turno.turnoId)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {formatearFecha(turno.fecha)} — Turno {NOMBRE_TIPO[turno.tipo]}
                </p>
                <p className="text-sm text-slate-500">
                  {turno.lineas.length} línea{turno.lineas.length !== 1 ? "s" : ""} · {totalPartes} parte
                  {totalPartes !== 1 ? "s" : ""}
                </p>
              </div>
              {abierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {abierto && (
              <div className="border-t border-slate-100">
                {turno.lineas.map((linea) => {
                  const lineaKey = `${turno.turnoId}-${linea.lineaId}`;
                  const lineaOpen = lineaAbierta === lineaKey;
                  return (
                    <div key={linea.lineaId} className="border-b border-slate-50 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setLineaAbierta(lineaOpen ? null : lineaKey)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <p className="text-sm font-medium text-slate-700">{linea.lineaNombre}</p>
                        {lineaOpen ? (
                          <ChevronUp size={16} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-400" />
                        )}
                      </button>

                      {lineaOpen && (
                        <div className="space-y-2 px-4 pb-3">
                          {linea.partes.map((p) => (
                            <div key={p.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                              <p className="font-medium text-slate-800">
                                {p.modeloNombre} — {p.formatoNombre}, tono {p.tono}
                              </p>
                              <p className="text-slate-500">
                                {p.piezasEntradas.toLocaleString("es-ES")} piezas · {p.minutosTotal} min
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
