import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ScanLine } from "lucide-react";
import { useEscanerCodigosBarras } from "../useEscanerCodigosBarras";
import {
  construirListaCampos,
  encontrarCampoCoincidente,
  calcularEstadoGeneral,
  type CampoEscaneado,
} from "../../lib/verificacion-codbar";
import { obtenerCodigosBarrasParaParte, type EstadoVerificacionCodbar } from "../../lib/parte";
import { actualizarVerificacionCodbarOperario } from "../../lib/operario";

type Paso = "cargando" | "escaneando" | "guardando" | "error";

interface VerificacionCodbarOperarioProps {
  parteId: string;
  onVerificado: (estado: EstadoVerificacionCodbar) => void;
  onCancelar: () => void;
}

/**
 * Escaneo de códigos de barras hecho por el OPERARIO (03-rol-
 * operario.md 5.X) — mismo mecanismo que la del responsable (3.8),
 * pero escribe en las columnas *_operario y SIN opción de
 * confirmación manual (mismo criterio que VerificacionCajaOperario).
 * BarcodeDetector nativo con fallback a ZXing y recorte de área, ver
 * useEscanerCodigosBarras.ts.
 */
export function VerificacionCodbarOperario({ parteId, onVerificado, onCancelar }: VerificacionCodbarOperarioProps) {
  const [paso, setPaso] = useState<Paso>("cargando");
  const [campos, setCampos] = useState<CampoEscaneado[] | null>(null);
  const [codigoLeido, setCodigoLeido] = useState<string>("—");
  const [mensaje, setMensaje] = useState("");

  const { videoRef, error: errorCamara } = useEscanerCodigosBarras(paso === "escaneando", (texto) => {
    setCodigoLeido(texto);
    setCampos((prev) => {
      if (!prev) return prev;
      const campoCoincidente = encontrarCampoCoincidente(texto, prev);
      if (!campoCoincidente) return prev;
      return prev.map((c) => (c.campo === campoCoincidente ? { ...c, verificado: true } : c));
    });
  });

  useEffect(() => {
    if (errorCamara) {
      setPaso("error");
      setMensaje(errorCamara);
    }
  }, [errorCamara]);

  useEffect(() => {
    let cancelado = false;
    obtenerCodigosBarrasParaParte(parteId)
      .then(async (codigos) => {
        if (cancelado) return;
        const lista = construirListaCampos(codigos);
        if (lista.length === 0) {
          await actualizarVerificacionCodbarOperario(parteId, "no_realizada");
          if (!cancelado) onVerificado("no_realizada");
          return;
        }
        setCampos(lista);
        setPaso("escaneando");
      })
      .catch((err) => {
        if (!cancelado) {
          setPaso("error");
          setMensaje(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parteId]);

  async function guardarResultado() {
    if (!campos) return;
    setPaso("guardando");
    try {
      const estado = calcularEstadoGeneral(campos);
      await actualizarVerificacionCodbarOperario(parteId, estado, campos);
      onVerificado(estado);
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  if (paso === "cargando") {
    return <div className="p-6 text-center text-sm text-slate-500">Comprobando códigos esperados...</div>;
  }

  if (paso === "error") {
    return <div className="p-6 text-center text-sm text-red-600">{mensaje}</div>;
  }

  const todosVerificados = campos ? campos.every((c) => c.verificado) : false;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onCancelar} className="text-slate-400" aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-medium text-slate-600">Verificación de códigos de barras</p>
      </div>

      <div className="relative mb-4 overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-black" style={{ aspectRatio: "16 / 5" }}>
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-black/50" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-black/50" />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <ScanLine size={16} aria-hidden />
        Último código leído: <span className="font-mono">{codigoLeido}</span>
      </div>

      <div className="mb-6 space-y-2">
        {(campos ?? []).map((c) => (
          <div key={c.campo} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">{c.etiqueta}</span>
            {c.verificado ? (
              <CheckCircle2 size={18} className="text-emerald-600" aria-hidden />
            ) : (
              <span className="text-xs text-slate-400">Pendiente</span>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={paso === "guardando"}
        onClick={guardarResultado}
        className="w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        {paso === "guardando" ? "Guardando..." : todosVerificados ? "Continuar" : "Continuar de todas formas"}
      </button>
    </div>
  );
}