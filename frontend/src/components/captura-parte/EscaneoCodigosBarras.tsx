import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, UserCheck, RotateCcw } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  construirListaCampos,
  encontrarCampoCoincidente,
  calcularEstadoGeneral,
  type CampoEscaneado,
} from "../../lib/verificacion-codbar";
import { actualizarVerificacionCodbar, obtenerCodigosBarrasParaParte, type EstadoVerificacionCodbar } from "../../lib/parte";

type Paso = "elegir" | "escaneando" | "manual" | "error";

interface EscaneoCodigosBarrasProps {
  parteId: string;
  onVerificado: (estado: EstadoVerificacionCodbar) => void;
  onCancelar: () => void;
}

/**
 * Solo EAN-13 y Code128 (>90% de las cajas reales son EAN-13, el
 * resto casi todo Code128 — decisión de sesión 18/08, sin necesidad
 * de cubrir QR ni otros formatos de barras).
 */
const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.CODE_128]);

export function EscaneoCodigosBarras({ parteId, onVerificado, onCancelar }: EscaneoCodigosBarrasProps) {
  const [paso, setPaso] = useState<Paso>("elegir");
  const [campos, setCampos] = useState<CampoEscaneado[] | null>(null);
  const [codigoLeido, setCodigoLeido] = useState<string>("—");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // Carga los códigos esperados del lote en cuanto se monta, sin
  // esperar a que el responsable elija "Escanear" — así "Confirmar a
  // mano" está disponible al instante, y si el lote no tiene ningún
  // código de barras esperado, se salta la pantalla entera en vez de
  // mostrar un checklist vacío.
  useEffect(() => {
    let cancelado = false;
    obtenerCodigosBarrasParaParte(parteId)
      .then((codigos) => {
        if (cancelado) return;
        const lista = construirListaCampos(codigos);
        if (lista.length === 0) {
          actualizarVerificacionCodbar(parteId, "no_realizada")
            .then(() => {
              if (!cancelado) onVerificado("no_realizada");
            })
            .catch((err) => {
              if (!cancelado) {
                setPaso("error");
                setMensaje(err instanceof Error ? err.message : String(err));
              }
            });
          return;
        }
        setCampos(lista);
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

  // Cámara en vivo — solo activa mientras paso === "escaneando".
  useEffect(() => {
    if (paso !== "escaneando" || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader(HINTS);
    let activo = true;

    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current, (resultado) => {
        if (!activo || !resultado) return;
        const texto = resultado.getText();
        setCodigoLeido(texto);
        setCampos((prev) => {
          if (!prev) return prev;
          const campoCoincidente = encontrarCampoCoincidente(texto, prev);
          if (!campoCoincidente) return prev;
          return prev.map((c) => (c.campo === campoCoincidente ? { ...c, verificado: true } : c));
        });
      })
      .then((controls) => {
        if (activo) controlsRef.current = controls;
        else controls.stop();
      })
      .catch((err) => {
        setPaso("error");
        setMensaje(err instanceof Error ? err.message : String(err));
      });

    return () => {
      activo = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [paso]);

  async function guardarResultadoEscaneo() {
    if (!campos) return;
    setGuardando(true);
    try {
      const estado = calcularEstadoGeneral(campos);
      await actualizarVerificacionCodbar(parteId, estado, campos);
      onVerificado(estado);
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarManual() {
    setGuardando(true);
    try {
      await actualizarVerificacionCodbar(parteId, "manual");
      onVerificado("manual");
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  if (paso === "elegir") {
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-4 text-sm font-medium text-slate-600">Verificación de códigos de barras</p>
        <button
          type="button"
          disabled={!campos}
          onClick={() => setPaso("escaneando")}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
        >
          <ScanLine size={20} aria-hidden />
          Escanear códigos de barras
        </button>
        <button
          type="button"
          onClick={() => setPaso("manual")}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-4 text-base font-medium text-slate-900"
        >
          <UserCheck size={20} aria-hidden />
          Confirmar a mano, sin escáner
        </button>
        <button type="button" onClick={onCancelar} className="w-full text-center text-sm text-slate-400 underline">
          Dejar para más tarde
        </button>
      </div>
    );
  }

  if (paso === "manual") {
    return (
      <div className="mx-auto max-w-md text-center">
        <UserCheck size={40} className="mx-auto mb-3 text-slate-400" aria-hidden />
        <p className="mb-1 text-base font-medium text-slate-900">Confirmación manual</p>
        <p className="mb-6 text-sm text-slate-500">
          Confirmas que has comprobado a simple vista que los códigos de barras de la caja coinciden con los del
          lote. Queda registrado como verificación manual, distinta de la verificación por escáner.
        </p>
        <button
          type="button"
          disabled={guardando}
          onClick={confirmarManual}
          className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
        >
          {guardando ? "Guardando..." : "Confirmo que es correcto"}
        </button>
        <button type="button" onClick={() => setPaso("elegir")} className="text-sm text-slate-400 underline">
          Volver
        </button>
      </div>
    );
  }

  if (paso === "error") {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-sm text-red-600">{mensaje}</p>
        <button
          type="button"
          onClick={() => setPaso("elegir")}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          <RotateCcw size={16} aria-hidden />
          Volver a intentar
        </button>
      </div>
    );
  }

  // paso === "escaneando"
  const todosVerificados = campos?.every((c) => c.verificado) ?? false;

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-3 text-sm font-medium text-slate-600">Escaneando códigos de barras</p>
      <div className="relative mb-3 w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "4 / 3" }}>
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-red-500" />
      </div>
      <p className="mb-4 text-center text-sm text-slate-500">
        Código leído: <span className="font-mono text-slate-900">{codigoLeido}</span>
      </p>
      <div className="mb-4 divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
        {campos?.map((c) => (
          <div key={c.campo} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-700">{c.etiqueta}</span>
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
        disabled={guardando}
        onClick={guardarResultadoEscaneo}
        className="w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        {guardando ? "Guardando..." : todosVerificados ? "Continuar" : "Continuar de todas formas"}
      </button>
      <button
        type="button"
        onClick={() => setPaso("elegir")}
        className="mt-3 w-full text-center text-sm text-slate-400 underline"
      >
        Volver
      </button>
    </div>
  );
}