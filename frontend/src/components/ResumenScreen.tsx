import { useEffect, useState } from "react";
import { Copy, Check, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { calcularTurnoActual, calcularTurnoActualSuplente, type TipoTurno } from "../lib/rotacion";
import {
  obtenerTurnoPorFechaTipo,
  generarResumenTurno,
  formatearResumenTurnoTexto,
  type ResumenTurno,
} from "../lib/resumen-turno";

const NOMBRE_TIPO: Record<TipoTurno, string> = {
  M: "Mañana",
  T: "Tarde",
  N: "Noche",
};

/**
 * Pestaña "Resumen" (01-rol-responsable.md 3.9/3.9b). Muestra el
 * informe jerárquico del turno de HOY (según la misma rotación que
 * TurnoScreen) — si todavía está abierto o en revisión, se avisa de
 * que es una vista provisional; el envío automático a Telegram
 * cuando se cierra vive aparte, en la Edge Function
 * `generar-resumen-turno` (pendiente).
 */
export function ResumenScreen() {
  const { usuario } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenTurno | null>(null);
  const [esProvisional, setEsProvisional] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const info =
          usuario!.rol === "suplente"
            ? await calcularTurnoActualSuplente()
            : usuario!.letra
              ? await calcularTurnoActual(usuario!.letra)
              : null;

        if (!info || !info.fecha || !info.tipo) {
          if (!cancelado) {
            setResumen(null);
            setEsProvisional(false);
          }
          return;
        }

        const turno = await obtenerTurnoPorFechaTipo(info.fecha, info.tipo);
        if (!turno) {
          if (!cancelado) {
            setResumen(null);
            setEsProvisional(false);
          }
          return;
        }

        const datos = await generarResumenTurno(turno.id);
        if (!cancelado) {
          setResumen(datos);
          // Provisional si el turno de hoy sigue vivo y todavía no se
          // ha cerrado (ni a mano ni automático) — el informe se
          // recalcula cada vez que se entra a esta pestaña, no es una
          // foto fija hasta el cierre.
          setEsProvisional(!turno.cerrado_at && (info.estado === "abierto" || info.estado === "en_revision"));
        }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  async function copiar() {
    if (!resumen) return;
    try {
      await navigator.clipboard.writeText(formatearResumenTurnoTexto(resumen));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo copiar al portapapeles");
    }
  }

  if (cargando) {
    return <div className="p-6 text-center text-slate-400">Cargando resumen...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (!resumen) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <FileText size={40} className="text-slate-300" aria-hidden />
        <p className="text-lg font-medium text-slate-900">Todavía no hay turno que resumir</p>
        <p className="max-w-sm text-sm text-slate-500">
          El resumen aparece aquí en cuanto se abra un turno hoy.
        </p>
      </div>
    );
  }

  const texto = formatearResumenTurnoTexto(resumen);

  return (
    <div className="mx-auto max-w-md pb-8">
      <p className="mb-4 text-sm font-medium text-slate-600">
        Resumen — Turno {NOMBRE_TIPO[resumen.tipo]}
      </p>

      {esProvisional && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          El turno todavía no se ha cerrado — esto es una vista provisional, sigue cambiando mientras haya
          producción.
        </div>
      )}

      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600"
        >
          {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      <pre className="whitespace-pre-wrap rounded-xl bg-white p-4 text-xs leading-relaxed text-slate-800 shadow-sm">
        {texto}
      </pre>
    </div>
  );
}
