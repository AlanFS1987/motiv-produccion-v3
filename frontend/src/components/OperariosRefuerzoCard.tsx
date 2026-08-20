import { useCallback, useEffect, useState } from "react";
import { UserPlus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listarRefuerzos,
  listarOperariosOtrasLetras,
  marcarRefuerzo,
  quitarRefuerzo,
  type OperarioParaAsignar,
} from "../lib/turno";

interface OperariosRefuerzoCardProps {
  turnoId: string;
  /** Se llama tras cualquier alta/baja — el padre debe recargar su lista de operarios para los desplegables de línea. */
  onCambio: () => void;
}

/**
 * "Operarios de refuerzo" (sesión 19/08/2026) — franja colapsada por
 * defecto, encima de la cuadrícula de líneas: el caso normal (sin
 * refuerzo ese turno) no debe pesar visualmente como una tarjeta más.
 * Solo cuando hay 1+ marcados se ve como una línea de texto con
 * nombres + "Editar".
 *
 * Es el paso PREVIO obligatorio para poder asignar a una línea a un
 * operario que no es de la letra del responsable (ver
 * listarOperariosParaAsignar, lib/turno.ts) — por eso se coloca
 * ARRIBA de la cuadrícula, no abajo: el responsable debe verlo y
 * usarlo antes de intentar buscar a ese operario en un desplegable de
 * línea, donde ya no aparecerá si no lo ha dado de alta aquí primero.
 */
export function OperariosRefuerzoCard({ turnoId, onCambio }: OperariosRefuerzoCardProps) {
  const { usuario } = useAuth();
  const [refuerzos, setRefuerzos] = useState<OperarioParaAsignar[]>([]);
  const [candidatos, setCandidatos] = useState<OperarioParaAsignar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [listaRefuerzos, listaCandidatos] = await Promise.all([
        listarRefuerzos(turnoId),
        listarOperariosOtrasLetras(usuario?.letra ?? null),
      ]);
      setRefuerzos(listaRefuerzos);
      setCandidatos(listaCandidatos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [turnoId, usuario?.letra]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alternar(operarioId: string, marcado: boolean) {
    if (!usuario) return;
    setGuardandoId(operarioId);
    try {
      if (marcado) {
        await quitarRefuerzo(turnoId, operarioId);
      } else {
        await marcarRefuerzo(turnoId, operarioId, usuario.id);
      }
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardandoId(null);
    }
  }

  if (cargando) return null; // Sin parpadeo de "cargando" en una franja tan pequeña — aparece ya resuelta.

  const idsRefuerzo = new Set(refuerzos.map((r) => r.id));

  return (
    <div className="mb-4">
      {!expandido ? (
        refuerzos.length === 0 ? (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            <UserPlus size={15} aria-hidden />
            Añadir operario de refuerzo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <span className="text-slate-600">
              <strong className="text-slate-800">Refuerzo hoy:</strong> {refuerzos.map((r) => r.username).join(", ")}
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-500">
              Editar
              <ChevronDown size={14} aria-hidden />
            </span>
          </button>
        )
      ) : (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setExpandido(false)}
            className="mb-3 flex w-full items-center justify-between text-sm font-medium text-slate-700"
          >
            <span className="flex items-center gap-1.5">
              <UserPlus size={15} aria-hidden />
              Operarios de refuerzo
            </span>
            <ChevronUp size={16} className="text-slate-400" aria-hidden />
          </button>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          {candidatos.length === 0 ? (
            <p className="text-sm text-slate-400">No hay operarios de otras letras para añadir.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {candidatos.map((op) => {
                const marcado = idsRefuerzo.has(op.id);
                return (
                  <label
                    key={op.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={guardandoId === op.id}
                        onChange={() => alternar(op.id, marcado)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {op.username}
                      {op.letra && <span className="text-xs text-slate-400">({op.letra})</span>}
                    </span>
                    {marcado && <X size={14} className="text-slate-300" aria-hidden />}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}