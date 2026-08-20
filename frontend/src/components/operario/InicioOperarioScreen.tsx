import { Clock, Coffee, Sparkles } from "lucide-react";
import type { TurnoActual } from "../../lib/rotacion";

interface InicioOperarioScreenProps {
  turnoInfo: TurnoActual | null;
  cargando: boolean;
  nombreTipo: Record<"M" | "T" | "N", string>;
}

function formatearHora(fecha: Date | null): string {
  if (!fecha) return "—";
  return fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Pantalla Inicio (03-rol-operario.md 5.1) — DELIBERADAMENTE VACÍA de
 * gamificación por ahora (puntos, nivel, mensaje motivacional): esa
 * capa está pospuesta hasta que el flujo de producción esté maduro y
 * la base poblada con datos reales (decisión de sesión 19/08/2026,
 * ver 08-pendientes.md). Mientras tanto, sirve como pantalla de
 * bienvenida con el estado del turno de hoy — cuando la gamificación
 * se retome, esta pantalla gana las tarjetas de puntos descritas en
 * 5.1 sin tocar el resto de la app.
 */
export function InicioOperarioScreen({ turnoInfo, cargando, nombreTipo }: InicioOperarioScreenProps) {
  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando...</div>;
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {turnoInfo?.estado === "descanso" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Coffee size={40} className="text-slate-400" aria-hidden />
            <p className="text-lg font-medium text-slate-900">Hoy es tu día de descanso</p>
            <p className="text-sm text-slate-500">Puedes seguir consultando tu historial cuando quieras.</p>
          </div>
        ) : turnoInfo?.tipo ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock size={40} className="text-slate-400" aria-hidden />
            <p className="text-lg font-medium text-slate-900">
              Turno de {nombreTipo[turnoInfo.tipo]}
              {turnoInfo.estado === "antes" && ` — empieza a las ${formatearHora(turnoInfo.inicioFranja)}`}
            </p>
            {turnoInfo.estado === "en_revision" && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">En revisión</span>
            )}
            {turnoInfo.estado === "cerrado" && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Turno cerrado</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock size={40} className="text-slate-400" aria-hidden />
            <p className="text-sm text-slate-500">No hay turno activo ahora mismo.</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
        <p>
          Tus puntos, nivel y ranking llegarán más adelante — de momento la app se centra en registrar bien la
          producción. Puedes ver tus líneas asignadas en <strong>Mi línea</strong>, tu historial en{" "}
          <strong>Historial</strong>, y sumar limpieza en <strong>Limpieza</strong>.
        </p>
      </div>
    </div>
  );
}
