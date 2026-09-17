// frontend/src/components/mecanico/IncidenciasScreen.tsx
//
// Cola de incidencias de producción para el rol mecánico. Sin
// reapertura: una vez contestada, la política RLS de UPDATE impide
// volver a tocarla — esta pantalla no necesita imponer esa regla,
// solo dejar de ofrecer el botón "Responder".

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { VisorFotoOverlay } from "../VisorFoto";
import { FormularioIncidencia } from "../incidencias/FormularioIncidencia";
import {
  listarIncidenciasParaMecanico,
  responderIncidencia,
  type IncidenciaMecanico,
} from "../../lib/mecanico-incidencias";

const NOMBRE_TURNO: Record<"M" | "T" | "N", string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function FilaFotos({ fotos, onFotoClick }: { fotos: string[] | null; onFotoClick: (url: string) => void }) {
  if (!fotos || fotos.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {fotos.map((url) => (
        <button key={url} type="button" onClick={() => onFotoClick(url)}>
          <img src={url} alt="" className="h-20 w-20 rounded-md object-cover" />
        </button>
      ))}
    </div>
  );
}

function TarjetaIncidencia({
  inc,
  onFotoClick,
  onResponder,
}: {
  inc: IncidenciaMecanico;
  onFotoClick: (url: string) => void;
  onResponder: (id: string) => void;
}) {
  const pendiente = inc.estado === "pendiente";

  return (
    <div className={`rounded-xl border p-3 ${pendiente ? "border-red-100 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className={`mb-1 flex flex-wrap items-center gap-2 text-xs ${pendiente ? "text-red-600" : "text-slate-500"}`}>
        <span className="font-semibold">{inc.fecha}</span>
        <span>· {NOMBRE_TURNO[inc.tipoTurno]}</span>
        <span>{inc.lineaNombre ?? "General del turno"}</span>
        {inc.creadoPor && <span>· {inc.creadoPor}</span>}
        <span className="ml-auto">{formatearFechaHora(inc.createdAt)}</span>
      </div>

      <p className={`text-sm ${pendiente ? "text-red-800" : "text-slate-800"}`}>{inc.descripcion}</p>
      <FilaFotos fotos={inc.fotos} onFotoClick={onFotoClick} />

      {pendiente ? (
        <button
          type="button"
          onClick={() => onResponder(inc.id)}
          className="mt-3 flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Wrench size={14} aria-hidden />
          Responder
        </button>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={14} className="text-green-600" aria-hidden />
            <span className="font-medium text-slate-700">{inc.respuestaMecanicoUsername ?? "—"}</span>
            {inc.respuestaFecha && <span>· {formatearFechaHora(inc.respuestaFecha)}</span>}
            {inc.respuestaSinIntervencion && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">Sin intervención</span>
            )}
          </div>
          {inc.respuestaTexto && <p className="text-sm text-slate-700">{inc.respuestaTexto}</p>}
          <FilaFotos fotos={inc.respuestaFotos} onFotoClick={onFotoClick} />
        </div>
      )}
    </div>
  );
}

export function IncidenciasScreen() {
  const { usuario } = useAuth();
  const [incidencias, setIncidencias] = useState<IncidenciaMecanico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);
  const [sinIntervencion, setSinIntervencion] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setIncidencias(await listarIncidenciasParaMecanico());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function manejarGuardarRespuesta(descripcion: string, fotos: string[]) {
    if (!respondiendoId || !usuario) return;
    await responderIncidencia(respondiendoId, descripcion, fotos, sinIntervencion, usuario.id);
    setRespondiendoId(null);
    setSinIntervencion(false);
    await cargar();
  }

  const visibles = soloPendientes ? incidencias.filter((i) => i.estado === "pendiente") : incidencias;
  const pendientesCount = incidencias.filter((i) => i.estado === "pendiente").length;

  if (respondiendoId) {
    return (
      <div className="mx-auto max-w-md">
        <label className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <input type="checkbox" checked={sinIntervencion} onChange={(e) => setSinIntervencion(e.target.checked)} />
          No requiere intervención física
        </label>
        <FormularioIncidencia
          titulo="Responder incidencia"
          publicIdPrefijo="RESP"
          categoria="incidencias-produccion"
          onGuardar={manejarGuardarRespuesta}
          onCancelar={() => {
            setRespondiendoId(null);
            setSinIntervencion(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--texto)]">
          Incidencias {pendientesCount > 0 && <span className="text-red-600">({pendientesCount} pendientes)</span>}
        </h2>
        <label className="flex items-center gap-2 text-xs text-[var(--texto-secundario)]">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo pendientes
        </label>
      </div>

      {cargando && <p className="text-sm text-[var(--texto-secundario)]">Cargando...</p>}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}
      {!cargando && visibles.length === 0 && (
        <p className="text-sm text-[var(--texto-secundario)]">
          {soloPendientes ? "No hay incidencias pendientes." : "No hay incidencias."}
        </p>
      )}

      <div className="space-y-2">
        {visibles.map((inc) => (
          <TarjetaIncidencia key={inc.id} inc={inc} onFotoClick={setFotoAmpliada} onResponder={setRespondiendoId} />
        ))}
      </div>

      {fotoAmpliada && <VisorFotoOverlay url={fotoAmpliada} onCerrar={() => setFotoAmpliada(null)} />}
    </div>
  );
}