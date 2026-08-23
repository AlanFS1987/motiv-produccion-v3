// frontend/src/components/operario/InicioOperarioScreen.tsx
//
// Pantalla Inicio — reescrita 23/08/2026 (sesión de diseño gamificación
// pestañas). Dos cambios respecto a la versión del 22/08/2026:
//
// 1. La generación de personaje SALE de aquí — vive ahora en la
//    pestaña Stats (fusionada con Avatar, ver StatsAvatarOperarioScreen).
//    La tarjeta de aquí es de SOLO LECTURA (lib/inicio-gamificacion.ts).
// 2. Nueva sub-barra DENTRO de Inicio (decisión de sesión: solo
//    visible aquí, no en Mi línea/Historial/Limpieza) con 4 vistas:
//    Resumen (turno + tarjeta), Ranking, Stats, Logros.

import { useCallback, useEffect, useState } from "react";
import { Clock, Coffee, Trophy, BarChart3, Award, Home } from "lucide-react";
import type { TurnoActual } from "../../lib/rotacion";
import { useAuth } from "../../context/AuthContext";
import { obtenerResumenInicio, type ResumenInicio } from "../../lib/inicio-gamificacion";
import { RankingOperarioScreen } from "./RankingOperarioScreen";
import { StatsAvatarOperarioScreen } from "./StatsAvatarOperarioScreen";
import { LogrosOperarioScreen } from "./LogrosOperarioScreen";

interface InicioOperarioScreenProps {
  turnoInfo: TurnoActual | null;
  cargando: boolean;
  nombreTipo: Record<"M" | "T" | "N", string>;
}

type SubPestana = "resumen" | "ranking" | "stats" | "logros";

function formatearHora(fecha: Date | null): string {
  if (!fecha) return "—";
  return fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function InicioOperarioScreen({ turnoInfo, cargando, nombreTipo }: InicioOperarioScreenProps) {
  const [subPestana, setSubPestana] = useState<SubPestana>("resumen");

  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando...</div>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      {/* Sub-barra de gamificación — solo dentro de Inicio */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
        <SubBoton activa={subPestana === "resumen"} onClick={() => setSubPestana("resumen")} icono={<Home size={15} />}>
          Inicio
        </SubBoton>
        <SubBoton activa={subPestana === "ranking"} onClick={() => setSubPestana("ranking")} icono={<Trophy size={15} />}>
          Ranking
        </SubBoton>
        <SubBoton activa={subPestana === "stats"} onClick={() => setSubPestana("stats")} icono={<BarChart3 size={15} />}>
          Stats
        </SubBoton>
        <SubBoton activa={subPestana === "logros"} onClick={() => setSubPestana("logros")} icono={<Award size={15} />}>
          Logros
        </SubBoton>
      </div>

      {subPestana === "resumen" && (
        <>
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

          <ResumenGamificacionMini />
        </>
      )}

      {subPestana === "ranking" && <RankingOperarioScreen />}
      {subPestana === "stats" && <StatsAvatarOperarioScreen />}
      {subPestana === "logros" && <LogrosOperarioScreen />}
    </div>
  );
}

/**
 * Tarjeta resumen de gamificación en Inicio — SOLO LECTURA (la
 * generación de personaje vive en la pestaña Stats). Ver
 * lib/inicio-gamificacion.ts para el detalle de cada dato.
 */
function ResumenGamificacionMini() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState<ResumenInicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario || usuario.rol !== "operario") {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerResumenInicio(usuario.id, "operario");
      setResumen(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Cargando tu progreso...</div>;
  }
  if (error) {
    return <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">{error}</div>;
  }
  if (!resumen) return null;

  const { nivelActual, siguienteNivel, puntosTotales } = resumen;
  const progresoPct = siguienteNivel
    ? Math.min(100, Math.round((100 * (puntosTotales - nivelActual.umbral_min)) / (siguienteNivel.umbral_min - nivelActual.umbral_min)))
    : 100;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="p-6" style={{ borderTop: `4px solid ${nivelActual.color_marco}` }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100"
            style={{ border: `2px solid ${nivelActual.color_marco}` }}
          >
            {resumen.avatarUrl ? (
              <img src={resumen.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400">?</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{resumen.nombreOperario}</p>
            <p className="text-xs text-slate-500">
              {resumen.grupo ? `Grupo ${resumen.grupo} · ` : ""}
              Nivel {nivelActual.orden} · {nivelActual.nombre}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-2xl font-bold text-slate-900">{puntosTotales.toLocaleString("es-ES")} pts</span>
          {siguienteNivel && (
            <span className="text-xs text-slate-400">
              {(siguienteNivel.umbral_min - puntosTotales).toLocaleString("es-ES")} para {siguienteNivel.nombre}
            </span>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progresoPct}%`, backgroundColor: nivelActual.color_marco }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
        <MiniStat etiqueta="Puntos ciclo" valor={resumen.puntosCiclo} />
        <MiniStat etiqueta="Piezas totales" valor={resumen.puntosPiezasTotales} />
        <MiniStat etiqueta="Rendimiento" valor={resumen.puntosRendimientoTotales} />
        <MiniStat etiqueta="Limpieza" valor={resumen.puntosLimpiezaTotales} />
      </div>

      <div className="flex justify-between border-t border-slate-100 p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Metros totales</p>
          <p className="font-medium text-slate-900">{resumen.metrosTotales.toLocaleString("es-ES")} m²</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Tiempo plena</p>
          <p className="font-medium text-slate-900">{resumen.horasPlenaTotales.toLocaleString("es-ES")} h</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p className="text-base font-medium text-slate-900">{valor.toLocaleString("es-ES")}</p>
    </div>
  );
}

function SubBoton({
  activa,
  onClick,
  icono,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition ${
        activa ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      {icono}
      {children}
    </button>
  );
}