// frontend/src/components/responsable/RelevoScreen.tsx
//
// Pestaña "Relevo" (02-responsable.md): qué dejó el turno
// inmediatamente anterior, para que quien entra ahora no tenga que
// ir línea por línea reconstruyéndolo. Solo lectura — para retomar un
// lote se sigue usando la pestaña Turno (Continuar / Nuevo tono),
// esta pantalla no crea ni edita nada.
//
// Se calcula el turno que le toca AHORA al responsable con la misma
// lógica que TurnoScreen (calcularTurnoActual / calcularTurnoActualSuplente)
// para saber fecha+tipo, y a partir de ahí lib/relevo.ts resuelve cuál
// es el turno anterior — deliberadamente SIN depender de que la fila
// de hoy en `turno` ya exista (esta pestaña puede abrirse antes de
// entrar nunca en Turno).

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Megaphone, PlayCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { calcularTurnoActual, calcularTurnoActualSuplente, type TipoTurno } from "../../lib/rotacion";
import { obtenerDatosRelevo, type DatosRelevo, type RelevoLinea } from "../../lib/relevo";
import { VisorFotoOverlay } from "../VisorFoto";

const NOMBRE_TIPO: Record<TipoTurno, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function formatearFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

function formatearHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/** null cuando el lote no tiene objetivo_m2 capturado — no se pinta nada en vez de un "0" engañoso. */
function formatearPendiente(pendiente: { m2Pendiente: number | null; piezasPendiente: number | null }): string | null {
  if (pendiente.m2Pendiente === null || pendiente.piezasPendiente === null) return null;
  if (pendiente.m2Pendiente === 0) return "Objetivo completado";
  const m2 = pendiente.m2Pendiente.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const piezas = Math.round(pendiente.piezasPendiente).toLocaleString("es-ES");
  return `Pendiente: ${m2} m² · ${piezas} piezas`;
}

export function RelevoScreen() {
  const { usuario } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosRelevo | null>(null);
  const [sinTurnoAsignado, setSinTurnoAsignado] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    // Capturado en una constante local: dentro de la función anidada
    // `cargar` (declarada más abajo), TypeScript no conserva el
    // estrechamiento de tipo del `if` de arriba sobre `usuario`
    // directamente — sí lo hace sobre esta constante.
    const u = usuario;
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const info = u.rol === "suplente" ? await calcularTurnoActualSuplente() : await calcularTurnoActual(u.letra!);

        if (!info.fecha || !info.tipo) {
          if (!cancelado) {
            setSinTurnoAsignado(true);
            setCargando(false);
          }
          return;
        }

        const resultado = await obtenerDatosRelevo(info.fecha, info.tipo);
        if (!cancelado) {
          setDatos(resultado);
          setSinTurnoAsignado(false);
        }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : "Error cargando el relevo");
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando relevo...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (sinTurnoAsignado) {
    return <div className="p-6 text-center text-sm text-slate-500">Hoy es tu descanso — no hay un turno activo del que relevar.</div>;
  }

  if (!datos || !datos.turnoAnterior) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-slate-500">
        El turno inmediatamente anterior no llegó a abrirse — no hay nada que relevar.
      </div>
    );
  }

  const { turnoAnterior, incidenciasGenerales, lineas } = datos;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 pb-8">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Clock size={12} aria-hidden />
          Relevo del turno anterior
        </p>
        <p className="mt-1 text-base font-medium text-slate-900">
          {NOMBRE_TIPO[turnoAnterior.tipo]} — {formatearFecha(turnoAnterior.fecha)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {turnoAnterior.cerradoAt
            ? `Cerrado ${turnoAnterior.comoCerro === "automatico" ? "automáticamente" : "manualmente"} a las ${formatearHora(turnoAnterior.cerradoAt)}`
            : "Aún sin cerrar"}
        </p>
      </div>

      {incidenciasGenerales.length > 0 && (
        <div className="rounded-2xl bg-red-50 p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">
            <Megaphone size={12} aria-hidden />
            Incidencias generales del turno anterior
          </p>
          <div className="mt-2 space-y-2">
            {incidenciasGenerales.map((inc) => (
              <p key={inc.id} className="text-sm text-red-900">
                {inc.descripcion}
              </p>
            ))}
          </div>
        </div>
      )}

      {lineas.map((linea) => (
        <TarjetaLineaRelevo key={linea.lineaId} linea={linea} />
      ))}
    </div>
  );
}

function TarjetaLineaRelevo({ linea }: { linea: RelevoLinea }) {
  const sinActividad = !linea.parteAbierto && !linea.ultimoCerrado;
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-slate-900">{linea.lineaNombre}</p>

      {linea.parteAbierto && (
        <div className="mb-2 rounded-lg bg-amber-50 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <PlayCircle size={13} aria-hidden />
            Lote abierto sin cerrar
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {linea.parteAbierto.marcaNombre} {linea.parteAbierto.formatoNombre} — {linea.parteAbierto.modeloNombre}
          </p>
          <p className="text-xs text-amber-700">
            Tono {linea.parteAbierto.tono}
            {linea.parteAbierto.calibre ? ` · Cal. ${linea.parteAbierto.calibre}` : ""} · Nº orden{" "}
            {linea.parteAbierto.numeroOrden}
          </p>
          {formatearPendiente(linea.parteAbierto.pendiente) && (
            <p className="mt-1 text-xs font-medium text-amber-800">{formatearPendiente(linea.parteAbierto.pendiente)}</p>
          )}
        </div>
      )}

      {linea.ultimoCerrado && (
        <div className="mb-2 rounded-lg bg-slate-50 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <CheckCircle2 size={13} aria-hidden />
            {linea.parteAbierto ? "Último lote cerrado antes" : "Último lote cerrado"}
          </p>
          <p className="mt-1 text-sm text-slate-800">
            {linea.ultimoCerrado.marcaNombre} {linea.ultimoCerrado.formatoNombre} — {linea.ultimoCerrado.modeloNombre}
          </p>
          <p className="text-xs text-slate-500">
            Tono {linea.ultimoCerrado.tono}
            {linea.ultimoCerrado.calibre ? ` · Cal. ${linea.ultimoCerrado.calibre}` : ""} ·{" "}
            {linea.ultimoCerrado.piezasEntradas} piezas · cerrado a las {formatearHora(linea.ultimoCerrado.completadoAt)}
          </p>
          {formatearPendiente(linea.ultimoCerrado.pendiente) && (
            <p className="mt-1 text-xs font-medium text-slate-600">{formatearPendiente(linea.ultimoCerrado.pendiente)}</p>
          )}
        </div>
      )}

      {sinActividad && <p className="text-xs text-slate-400">Sin actividad registrada en esta línea el turno anterior.</p>}

      {linea.incidenciasProduccion.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
            <AlertTriangle size={11} aria-hidden />
            Incidencias de producción
          </p>
          {linea.incidenciasProduccion.map((inc) => (
            <p key={inc.id} className="rounded-lg bg-red-50 p-2 text-xs text-red-900">
              {inc.descripcion}
            </p>
          ))}
        </div>
      )}

      {linea.incidenciasCalidad.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            <AlertTriangle size={11} aria-hidden />
            Incidencias de calidad
          </p>
          {linea.incidenciasCalidad.map((inc) => (
            <div key={inc.id} className="rounded-lg bg-amber-50 p-2">
              <p className="text-xs text-amber-900">
                {inc.modeloNombre} (tono {inc.tono}): {inc.descripcion}
              </p>
              {inc.fotos && inc.fotos.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {inc.fotos.map((url) => (
                    <button key={url} type="button" onClick={() => setFotoAmpliada(url)}>
                      <img src={url} alt="Foto de incidencia" className="h-12 w-12 rounded-md object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {fotoAmpliada && <VisorFotoOverlay url={fotoAmpliada} onCerrar={() => setFotoAmpliada(null)} />}
    </div>
  );
}