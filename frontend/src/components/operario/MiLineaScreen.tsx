import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Package, CheckCircle2, XCircle, HelpCircle, ScanLine } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { TurnoActual } from "../../lib/rotacion";
import { obtenerMisLineasAsignadas, type LineaAsignadaOperario } from "../../lib/operario";
import { VerificacionCajaOperario } from "./VerificacionCajaOperario";
import { VerificacionCodbarOperario } from "./VerificacionCodbarOperario";

interface MiLineaScreenProps {
  /** Turno activo AHORA por reloj (letra-agnóstico) — no la rotación personal del operario. */
  turnoInfo: TurnoActual | null;
  /** null si no hay turno activo O si lo hay pero el operario no pertenece a él (ver `pertenece`). */
  turnoId: string | null;
  /** ¿Este operario pertenece a turnoInfo? (su letra coincide, o está de refuerzo — ver OperarioApp.tsx). */
  pertenece: boolean;
  cargandoTurno: boolean;
  nombreTipo: Record<"M" | "T" | "N", string>;
}

/**
 * "Mi línea" (03-rol-operario.md 5.X) — muestra las 1-2 líneas a las
 * que el operario está asignado este turno, con una segunda capa de
 * verificación de caja/códigos de barras, voluntaria e independiente
 * de la que ya hace el responsable.
 *
 * REVISADO (sesión 19/08/2026): el turno ya no se calcula por la
 * rotación de letra del operario (bug real: un operario cubriendo/
 * cambiando turno quedaba sin ver su línea asignada) — ver
 * OperarioApp.tsx para el cálculo por reloj + pertenencia.
 */
export function MiLineaScreen({ turnoInfo, turnoId, pertenece, cargandoTurno, nombreTipo }: MiLineaScreenProps) {
  const { usuario } = useAuth();
  const [lineas, setLineas] = useState<LineaAsignadaOperario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineaDesplegada, setLineaDesplegada] = useState<string | null>(null);
  const [verificando, setVerificando] = useState<{ lineaId: string; tipo: "caja" | "codbar" } | null>(null);

  const cargar = useCallback(async () => {
    if (!turnoId || !usuario) {
      setLineas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerMisLineasAsignadas(turnoId, usuario.id);
      setLineas(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [turnoId, usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargandoTurno || cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando...</div>;
  }

  // Hay un turno real activo ahora mismo, pero este operario no forma
  // parte de él (ni por letra ni por refuerzo) — mensaje distinto de
  // "no hay turno", porque aquí la solución es pedirle al responsable
  // que lo dé de alta en "Operarios de refuerzo", no esperar.
  if (turnoInfo && (turnoInfo.estado === "abierto" || turnoInfo.estado === "en_revision") && !pertenece) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-medium text-slate-900">No estás dado de alta en el turno de {nombreTipo[turnoInfo.tipo!]}</p>
        <p className="max-w-sm text-sm text-slate-500">
          Si vas a trabajar hoy en este turno, pide al responsable que te añada en "Operarios de refuerzo".
        </p>
      </div>
    );
  }

  if (!turnoId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <Clock size={40} className="text-slate-400" aria-hidden />
        <p className="text-lg font-medium text-slate-900">
          {turnoInfo?.tipo ? `El turno de ${nombreTipo[turnoInfo.tipo]} aún no está abierto` : "No hay turno activo"}
        </p>
        <p className="max-w-sm text-sm text-slate-500">
          En cuanto el responsable abra turno y te asigne una línea, aparecerá aquí.
        </p>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (verificando && turnoId) {
    const linea = lineas.find((l) => l.lineaId === verificando.lineaId);
    if (linea?.parte) {
      return verificando.tipo === "caja" ? (
        <VerificacionCajaOperario
          parte={linea.parte}
          onVerificado={() => {
            setVerificando(null);
            cargar();
          }}
          onCancelar={() => setVerificando(null)}
        />
      ) : (
        <VerificacionCodbarOperario
          parteId={linea.parte.id}
          onVerificado={() => {
            setVerificando(null);
            cargar();
          }}
          onCancelar={() => setVerificando(null)}
        />
      );
    }
  }

  if (lineas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-medium text-slate-900">Todavía no tienes ninguna línea asignada hoy</p>
        <p className="max-w-sm text-sm text-slate-500">
          El responsable asigna las líneas al abrir turno — vuelve a comprobarlo en unos minutos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3">
      {lineas.map((linea) => (
        <TarjetaLinea
          key={linea.lineaId}
          linea={linea}
          desplegada={lineaDesplegada === linea.lineaId}
          onToggle={() => setLineaDesplegada(lineaDesplegada === linea.lineaId ? null : linea.lineaId)}
          onVerificarCaja={() => setVerificando({ lineaId: linea.lineaId, tipo: "caja" })}
          onVerificarCodbar={() => setVerificando({ lineaId: linea.lineaId, tipo: "codbar" })}
        />
      ))}
    </div>
  );
}

function TarjetaLinea({
  linea,
  desplegada,
  onToggle,
  onVerificarCaja,
  onVerificarCodbar,
}: {
  linea: LineaAsignadaOperario;
  desplegada: boolean;
  onToggle: () => void;
  onVerificarCaja: () => void;
  onVerificarCodbar: () => void;
}) {
  const parte = linea.parte;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        disabled={!parte}
        className="flex w-full items-center justify-between p-4 text-left disabled:cursor-default"
      >
        <div>
          <p className="font-medium text-slate-900">{linea.lineaNombre}</p>
          {parte ? (
            <p className="text-sm text-slate-500">
              {parte.marcaNombre} {parte.formatoNombre} — {parte.modeloNombre}, tono {parte.tono}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Sin producción activa</p>
          )}
        </div>
        {parte && (desplegada ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />)}
      </button>

      {desplegada && parte && (
        <div className="border-t border-slate-100 p-4">
          <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Dato etiqueta="Marca" valor={parte.marcaNombre} />
            <Dato etiqueta="Modelo" valor={parte.modeloNombre} />
            <Dato etiqueta="Formato" valor={parte.formatoNombre} />
            <Dato etiqueta="Tono" valor={parte.tono} />
            <Dato etiqueta="Calibre" valor={parte.calibre ?? "—"} />
            <Dato etiqueta="Nº orden" valor={parte.numeroOrden} />
          </div>

          <EstadoVerificacion
            titulo="Verificación de caja"
            icono={<Package size={16} aria-hidden />}
            estado={parte.verificacionCajaEstadoOperario}
            onVerificar={onVerificarCaja}
            resultadoOk="correcto"
          />
          <div className="mt-3">
            <EstadoVerificacion
              titulo="Verificación de códigos de barras"
              icono={<ScanLine size={16} aria-hidden />}
              estado={parte.verificacionCodbarEstadoOperario}
              onVerificar={onVerificarCodbar}
              resultadoOk="completo"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{etiqueta}</p>
      <p className="font-medium text-slate-800">{valor}</p>
    </div>
  );
}

function EstadoVerificacion({
  titulo,
  icono,
  estado,
  onVerificar,
  resultadoOk,
}: {
  titulo: string;
  icono: React.ReactNode;
  estado: string | null;
  onVerificar: () => void;
  resultadoOk: string;
}) {
  const validado = estado !== null;

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {icono}
        <span>{titulo}</span>
      </div>
      {validado ? (
        <span className="flex items-center gap-1 text-xs font-medium">
          {estado === resultadoOk ? (
            <CheckCircle2 size={14} className="text-emerald-600" aria-hidden />
          ) : estado === "incorrecto" ? (
            <XCircle size={14} className="text-red-600" aria-hidden />
          ) : (
            <HelpCircle size={14} className="text-amber-600" aria-hidden />
          )}
          <span className="capitalize text-slate-600">{estado.replace("_", " ")}</span>
        </span>
      ) : (
        <button type="button" onClick={onVerificar} className="text-xs font-medium text-slate-900 underline">
          Validar
        </button>
      )}
    </div>
  );
}