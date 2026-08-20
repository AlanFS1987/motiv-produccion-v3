import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ArrowLeft, CheckCircle2, Camera } from "lucide-react";
import type { TurnoActual } from "../../lib/rotacion";
import {
  obtenerLineasParaLimpieza,
  obtenerChecklistDeLinea,
  type LineaChecklistResumen,
  type ChecklistItemEstado,
} from "../../lib/operario";
import { LimpiezaItemCaptura } from "./LimpiezaItemCaptura";

interface LimpiezaScreenProps {
  /** Turno activo AHORA por reloj (letra-agnóstico). */
  turnoInfo: TurnoActual | null;
  /** null si no hay turno activo O si lo hay pero el operario no pertenece a él (ver `pertenece`). */
  turnoId: string | null;
  /** ¿Este operario pertenece a turnoInfo? (su letra coincide, o está de refuerzo — ver OperarioApp.tsx). */
  pertenece: boolean;
  cargandoTurno: boolean;
  nombreTipo: Record<"M" | "T" | "N", string>;
}

/**
 * Limpieza (03-rol-operario.md 5.9/5.9a) — cualquier operario que
 * PERTENEZCA al turno (letra o refuerzo, ver OperarioApp.tsx) puede
 * limpiar y puntuar cualquiera de las 6 líneas, esté o no asignado a
 * producción en ella. "Apuntarse" no es un dato en base de datos:
 * desplegar la línea es solo estado de UI (5.9a).
 */
export function LimpiezaScreen({ turnoInfo, turnoId, pertenece, cargandoTurno, nombreTipo }: LimpiezaScreenProps) {
  const [lineas, setLineas] = useState<LineaChecklistResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaChecklistResumen | null>(null);
  const [items, setItems] = useState<ChecklistItemEstado[]>([]);
  const [cargandoItems, setCargandoItems] = useState(false);
  const [itemEnCaptura, setItemEnCaptura] = useState<ChecklistItemEstado | null>(null);

  const cargarLineas = useCallback(async () => {
    if (!turnoId) {
      setLineas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerLineasParaLimpieza(turnoId);
      setLineas(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [turnoId]);

  useEffect(() => {
    cargarLineas();
  }, [cargarLineas]);

  const cargarItems = useCallback(async () => {
    if (!turnoId || !lineaSeleccionada) return;
    setCargandoItems(true);
    try {
      const datos = await obtenerChecklistDeLinea(turnoId, lineaSeleccionada.lineaId);
      setItems(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargandoItems(false);
    }
  }, [turnoId, lineaSeleccionada]);

  useEffect(() => {
    cargarItems();
  }, [cargarItems]);

  if (cargandoTurno || cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando...</div>;
  }

  // Hay un turno real activo, pero este operario no está dado de alta
  // en él (ni por letra ni por refuerzo) — mismo criterio que "Mi
  // línea": la limpieza también exige "estar en el turno" (5.9).
  if (turnoInfo && (turnoInfo.estado === "abierto" || turnoInfo.estado === "en_revision") && !pertenece) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-medium text-slate-900">No estás dado de alta en el turno de {nombreTipo[turnoInfo.tipo!]}</p>
        <p className="max-w-sm text-sm text-slate-500">
          Si vas a ayudar hoy en este turno, pide al responsable que te añada en "Operarios de refuerzo".
        </p>
      </div>
    );
  }

  if (!turnoId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-medium text-slate-900">
          {turnoInfo?.tipo ? `El turno de ${nombreTipo[turnoInfo.tipo]} aún no está abierto` : "No hay turno activo"}
        </p>
        <p className="max-w-sm text-sm text-slate-500">La limpieza se puntúa por línea+turno, así que hace falta un turno abierto.</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (itemEnCaptura && lineaSeleccionada) {
    return (
      <LimpiezaItemCaptura
        turnoId={turnoId}
        lineaId={lineaSeleccionada.lineaId}
        item={itemEnCaptura}
        onGuardado={() => {
          setItemEnCaptura(null);
          cargarItems();
          cargarLineas();
        }}
        onYaMarcado={() => {
          setItemEnCaptura(null);
          cargarItems();
          cargarLineas();
        }}
        onCancelar={() => setItemEnCaptura(null)}
      />
    );
  }

  if (lineaSeleccionada) {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLineaSeleccionada(null);
              setItems([]);
            }}
            className="text-slate-400"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <p className="text-sm font-medium text-slate-600">{lineaSeleccionada.lineaNombre} — Limpieza</p>
        </div>

        {cargandoItems ? (
          <div className="p-6 text-center text-sm text-slate-500">Cargando ítems...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.hecho}
                onClick={() => setItemEnCaptura(item)}
                className={`flex items-center justify-between rounded-xl p-4 text-left shadow-sm ${
                  item.hecho ? "bg-emerald-50" : "bg-white active:scale-[0.98]"
                }`}
              >
                <div>
                  <p className="font-medium text-slate-900">{item.nombre}</p>
                  {item.hecho ? (
                    <p className="text-xs text-emerald-700">
                      Limpiado por {item.operarioUsername ?? "—"}
                      {item.hora ? ` · ${new Date(item.hora).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">Libre — {item.puntos} punto{item.puntos !== 1 ? "s" : ""}</p>
                  )}
                </div>
                {item.hecho ? (
                  <CheckCircle2 size={20} className="text-emerald-600" aria-hidden />
                ) : (
                  <Camera size={20} className="text-slate-300" aria-hidden />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-2">
      {lineas.map((linea) => (
        <button
          key={linea.lineaId}
          type="button"
          onClick={() => setLineaSeleccionada(linea)}
          className="flex items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm active:scale-[0.98]"
        >
          <div>
            <p className="font-medium text-slate-900">{linea.lineaNombre}</p>
            <p className="text-sm text-slate-500">
              {linea.hechos}/{linea.total} ítems limpiados este turno
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-300" aria-hidden />
        </button>
      ))}
    </div>
  );
}