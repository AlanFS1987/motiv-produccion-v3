import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { FotoHojaPartida } from "./FotoHojaPartida";
import { FotoCajaVerificacion } from "./FotoCajaVerificacion";
import { EscaneoCodigosBarras } from "./EscaneoCodigosBarras";
import { FotoPantallaMaquina } from "./FotoPantallaMaquina";
import { FormularioNuevoTono } from "./FormularioNuevoTono";
import { AvisoVentanaCorreccion, huboSidoOcultado } from "./AvisoVentanaCorreccion";
import { FormularioIncidencia } from "../incidencias/FormularioIncidencia";
import { useAuth } from "../../context/AuthContext";
import { normalizarTexto } from "../../lib/normalizacion";
import { crearIncidenciaCalidad } from "../../lib/incidencias";
import { ListaIncidenciasCalidad } from "../incidencias/ListaIncidenciasCalidad";
import { ConfirmarContinuar } from "./ConfirmarContinuar";
import type { SugerenciaContinuar } from "../../lib/parte";
import {
  obtenerPartePendiente,
  cerrarSinProduccion,
  type LoteResuelto,
  type DatosLoteComparacion,
  type ParteResumen,
} from "../../lib/parte";

type Paso = "cargando" | "hoja" | "tono" | "continuar" | "caja" | "codbar" | "pantalla" | "incidencia" | "aviso" | "cerrando" | "listo";

interface OrigenNuevoTono {
  loteId: string;
  tonoAnterior: string;
  calibreAnterior: string | null;
}

interface CapturaParteScreenProps {
  turnoId: string;
  lineaId: string;
  lineaNombre: string;
  onFinalizado: () => void;
  onCancelar: () => void;
  /** Si se pasa, se salta el paso de "hoja de partida" y arranca directo en el formulario de nuevo tono/calibre sobre este lote. */
  origenNuevoTono?: OrigenNuevoTono;
  origenContinuar?: SugerenciaContinuar;
}

interface InfoCabecera {
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  tono: string;
  calibre: string | null;
  numeroOrden: string;
}

export function CapturaParteScreen({
  turnoId,
  lineaId,
  lineaNombre,
  onFinalizado,
  onCancelar,
  origenNuevoTono,
  origenContinuar,
}: CapturaParteScreenProps) {
  const { usuario } = useAuth();
  const [paso, setPaso] = useState<Paso>("cargando");
  const [pasoAnterior, setPasoAnterior] = useState<Paso>("caja");
  const [parteId, setParteId] = useState<string | null>(null);
  const [datosComparacion, setDatosComparacion] = useState<DatosLoteComparacion | null>(null);
  const [cabecera, setCabecera] = useState<InfoCabecera | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescarIncidencias, setRefrescarIncidencias] = useState(0);

  useEffect(() => {
    if (origenContinuar) {
    setPaso("continuar");
    return;
    }
    if (origenNuevoTono) {
      setPaso("tono");
      return;
    }
    let cancelado = false;
    obtenerPartePendiente(turnoId, lineaId)
      .then((pendiente) => {
        if (cancelado) return;
        if (pendiente) {
          setParteId(pendiente.id);
          setDatosComparacion(pendienteAComparacion(pendiente));
          setCabecera({
            modeloNombre: pendiente.modeloNombre,
            marcaNombre: pendiente.marcaNombre,
            formatoNombre: pendiente.formatoNombre,
            tono: pendiente.tono,
            calibre: pendiente.calibre,
            numeroOrden: pendiente.numeroOrden,
          });
          if (!pendiente.verificacionCajaEstado) {
            setPaso("caja");
          } else if (!pendiente.verificacionCodbarEstado) {
            setPaso("codbar");
          } else {
            setPaso("pantalla");
          }
        } else {
          setPaso("hoja");
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoId, lineaId]);

  function manejarLoteResuelto(lote: LoteResuelto, nuevoParteId: string) {
    setParteId(nuevoParteId);
    setDatosComparacion({
      formatoNombre: lote.formatoNombre,
      tono: lote.tono,
      calibre: lote.calibre,
      marcaTextoNormalizado: lote.marcaTextoNormalizado,
      modeloTextoNormalizado: lote.modeloTextoNormalizado,
    });
    setCabecera({
      modeloNombre: lote.modeloTextoNormalizado,
      marcaNombre: lote.marcaTextoNormalizado,
      formatoNombre: lote.formatoNombre,
      tono: lote.tono,
      calibre: lote.calibre || null,
      numeroOrden: lote.numeroOrden,
    });
    setPaso("caja");
  }

  function manejarCajaVerificada() {
    setPaso("codbar");
  }

  function manejarCodbarVerificado() {
    setPaso("pantalla");
  }

  function manejarParteCompletado() {
    setPaso(huboSidoOcultado() ? "listo" : "aviso");
  }

  async function cerrarSinProducir() {
    if (!parteId) return;
    setPaso("cerrando");
    try {
      await cerrarSinProduccion(parteId);
      onFinalizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPaso("caja");
    }
  }

  function abrirIncidenciaCalidad() {
    setPasoAnterior(paso);
    setPaso("incidencia");
  }

  async function guardarIncidenciaCalidad(descripcion: string, fotos: string[]) {
    if (!parteId || !usuario) return;
    await crearIncidenciaCalidad(parteId, descripcion, fotos, usuario.id);
    setRefrescarIncidencias((n) => n + 1);
    setPaso(pasoAnterior);
  }

  if (paso === "cargando") {
    return <div className="p-6 text-center text-sm text-slate-500">Comprobando si hay un parte pendiente...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  const muestraCerrarSinProduccion = parteId !== null && (paso === "caja" || paso === "codbar" || paso === "pantalla");
  const muestraIncidenciaCalidad = parteId !== null && (paso === "caja" || paso === "codbar" || paso === "pantalla");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {paso !== "listo" && paso !== "cerrando" && paso !== "aviso" && paso !== "incidencia" && (
          <button type="button" onClick={onCancelar} className="text-slate-400" aria-label="Volver">
            <ArrowLeft size={20} />
          </button>
        )}
        <p className="text-xs text-slate-400">{lineaNombre}</p>
      </div>

      {cabecera && (paso === "caja" || paso === "codbar" || paso === "pantalla") && <CabeceraParte info={cabecera} />}

      {paso === "hoja" && (
        <FotoHojaPartida turnoId={turnoId} lineaId={lineaId} onResuelto={manejarLoteResuelto} onCancelar={onCancelar} />
      )}

      {paso === "tono" && origenNuevoTono && (
        <FormularioNuevoTono
          turnoId={turnoId}
          lineaId={lineaId}
          loteId={origenNuevoTono.loteId}
          tonoAnterior={origenNuevoTono.tonoAnterior}
          calibreAnterior={origenNuevoTono.calibreAnterior}
          onCreado={manejarLoteResuelto}
          onCancelar={onCancelar}
        />
      )}
      {paso === "continuar" && origenContinuar && (
        <ConfirmarContinuar
          turnoId={turnoId}
          lineaId={lineaId}
          sugerencia={origenContinuar}
          onCreado={manejarLoteResuelto}
          onCancelar={onCancelar}
        />
      )}

      {paso === "caja" && parteId && datosComparacion && (
        <FotoCajaVerificacion parteId={parteId} lote={datosComparacion} onVerificado={manejarCajaVerificada} onCancelar={onCancelar} />
      )}
      {paso === "codbar" && parteId && (
        <EscaneoCodigosBarras parteId={parteId} onVerificado={manejarCodbarVerificado} onCancelar={onCancelar} />
      )}

      {paso === "pantalla" && parteId && (
        <FotoPantallaMaquina
          modo="completar"
          parteId={parteId}
          tono={cabecera?.tono ?? ""}
          onGuardado={manejarParteCompletado}
          onCancelar={onCancelar}
        />
      )}

      {muestraIncidenciaCalidad && (
        <button
          type="button"
          onClick={abrirIncidenciaCalidad}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 py-2 text-sm font-medium text-amber-700"
        >
          <AlertTriangle size={16} aria-hidden />
          Incidencia de calidad
        </button>
      )}
      {parteId && <ListaIncidenciasCalidad parteId={parteId} refrescarTrigger={refrescarIncidencias} />}
      {paso === "incidencia" && (
        <FormularioIncidencia
          titulo="Incidencia de calidad"
          publicIdPrefijo={cabecera?.tono ?? "INCIDENCIA"}
          categoria="incidencias-calidad"
          onGuardar={guardarIncidenciaCalidad}
          onCancelar={() => setPaso(pasoAnterior)}
        />
      )}

      {paso === "aviso" && <AvisoVentanaCorreccion onContinuar={() => setPaso("listo")} />}

      {muestraCerrarSinProduccion && <CerrarSinProduccion onConfirmar={cerrarSinProducir} />}

      {paso === "cerrando" && <div className="p-6 text-center text-sm text-slate-500">Cerrando parte...</div>}

      {paso === "listo" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
          <CheckCircle2 size={40} className="text-emerald-500" aria-hidden />
          <p className="text-lg font-medium text-slate-900">Parte guardado</p>
          <button type="button" onClick={onFinalizado} className="mt-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white">
            Volver al turno
          </button>
        </div>
      )}
    </div>
  );
}

function pendienteAComparacion(pendiente: ParteResumen): DatosLoteComparacion {
  return {
    formatoNombre: pendiente.formatoNombre,
    tono: pendiente.tono,
    calibre: pendiente.calibre ?? "",
    marcaTextoNormalizado: normalizarTexto(pendiente.marcaNombre),
    modeloTextoNormalizado: normalizarTexto(pendiente.modeloNombre),
  };
}

function CabeceraParte({ info }: { info: InfoCabecera }) {
  return (
    <div className="mb-4 rounded-xl bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-slate-900">
        {info.marcaNombre} {info.formatoNombre} — {info.modeloNombre}
      </p>
      <p className="text-xs text-slate-500">
        Tono {info.tono}
        {info.calibre ? ` · Cal. ${info.calibre}` : ""}
        {info.numeroOrden ? ` · Orden ${info.numeroOrden}` : ""}
      </p>
    </div>
  );
}

function CerrarSinProduccion({ onConfirmar }: { onConfirmar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="mt-6 flex w-full items-center justify-center gap-2 text-sm text-red-600 underline"
      >
        <XCircle size={14} aria-hidden />
        Cerrar sin producción
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-xl bg-red-50 p-4 text-center">
      <p className="mb-3 text-sm text-red-800">
        Esto cierra el parte con piezas y tiempos a cero (lote cancelado o movido de línea). ¿Confirmas?
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirmando(false)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">
          Volver
        </button>
        <button type="button" onClick={onConfirmar} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white">
          Sí, cerrar
        </button>
      </div>
    </div>
  );
}