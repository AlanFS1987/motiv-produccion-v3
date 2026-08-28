import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, CheckCircle2, XCircle, HelpCircle, RotateCcw, Camera, ImageUp } from "lucide-react";
import { AvisoGirarMovil } from "../AvisoGirarMovil";
import { useCamaraLive } from "../useCamaraLive";
import { cargarImagenDesdeArchivo, procesarFoto, cssAspectRatio, type FormaFoto } from "../../lib/captura-imagen";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { ocrParte } from "../../lib/supabase-functions";
import { requiereDosFotosCaja, evaluarVerificacionCaja, type ResultadoVerificacionCaja } from "../../lib/verificacion-caja";
import type { DatosOcrCaja, EstadoVerificacionCaja } from "../../lib/parte";
import { actualizarVerificacionCajaOperario, construirDatosComparacion, type ParteParaOperario } from "../../lib/operario";

type Paso = "foto_superior" | "foto_lateral" | "leyendo" | "resultado" | "error";

interface VerificacionCajaOperarioProps {
  parte: ParteParaOperario;
  onVerificado: (estado: EstadoVerificacionCaja) => void;
  onCancelar: () => void;
}

/**
 * Verificación de caja del OPERARIO — mismo criterio que la del
 * responsable: cámara EN VIVO (no nativa), por el recuadro-guía en
 * tiempo real. Sí conserva galería como respaldo por si la cámara
 * en vivo falla (getUserMedia denegado, sin cámara, etc.) — a
 * diferencia de Limpieza, que deliberadamente no ofrece galería. El
 * propio <video> hace de previsualización, no hace falta un estado
 * aparte para eso.
 */
export function VerificacionCajaOperario({ parte, onVerificado, onCancelar }: VerificacionCajaOperarioProps) {
  const lote = construirDatosComparacion(parte);
  const dosFotos = requiereDosFotosCaja(lote.formatoNombre);

  const [paso, setPaso] = useState<Paso>("foto_superior");
  const [mensaje, setMensaje] = useState("");
  const [urlSuperior, setUrlSuperior] = useState<string | null>(null);
  const [fotosSubidas, setFotosSubidas] = useState<string[]>([]);
  const [resultado, setResultado] = useState<ResultadoVerificacionCaja | null>(null);
  const [guardando, setGuardando] = useState(false);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

  const forma: FormaFoto = paso === "foto_superior" ? "caja_superior" : "caja_lateral";
  const camaraActiva = paso === "foto_superior" || paso === "foto_lateral";
  const camara = useCamaraLive(forma, camaraActiva);

  async function subirBlob(blob: Blob): Promise<string> {
    const publicId = construirPublicId(lote.tono, "caja_op");
    const subida = await subirACloudinary(blob, publicId, "partes");
    return subida.url;
  }

  async function manejarFotoSuperior(url: string) {
    setUrlSuperior(url);
    if (dosFotos) {
      setFotosSubidas([url]);
      setPaso("foto_lateral");
      setMensaje("");
    } else {
      setFotosSubidas([url]);
      await leerYEvaluar([{ url }]);
    }
  }

  async function manejarFotoLateral(url: string) {
    if (!urlSuperior) throw new Error("Falta la foto superior — reinicia la verificación");
    setFotosSubidas([urlSuperior, url]);
    await leerYEvaluar([{ url: urlSuperior }, { url }]);
  }

  async function manejarDisparo() {
    try {
      const procesada = await camara.disparar();
      const url = await subirBlob(procesada.blob);
      if (paso === "foto_superior") {
        await manejarFotoSuperior(url);
      } else {
        await manejarFotoLateral(url);
      }
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function manejarArchivoGaleria(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    setMensaje("Subiendo foto...");
    try {
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFoto(img, forma);
      const url = await subirBlob(procesada.blob);
      if (paso === "foto_superior") {
        await manejarFotoSuperior(url);
      } else {
        await manejarFotoLateral(url);
      }
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function leerYEvaluar(imagenes: { url: string }[]) {
    setPaso("leyendo");
    setMensaje("Leyendo caja con Claude...");
    try {
      const respuesta = await ocrParte("caja", imagenes);
      const datosCaja = respuesta.datos as unknown as DatosOcrCaja;
      setResultado(evaluarVerificacionCaja(datosCaja, lote));
      setPaso("resultado");
      setMensaje("");
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function confirmar() {
    if (!resultado) return;
    setGuardando(true);
    try {
      await actualizarVerificacionCajaOperario(parte.id, resultado.estadoGeneral, fotosSubidas, resultado.campos);
      onVerificado(resultado.estadoGeneral);
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  function reiniciar() {
    setUrlSuperior(null);
    setFotosSubidas([]);
    setResultado(null);
    setPaso("foto_superior");
    setMensaje("");
  }

  if (paso === "foto_superior" || paso === "foto_lateral") {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center gap-2">
          <button type="button" onClick={onCancelar} className="text-slate-400" aria-label="Volver">
            <ArrowLeft size={20} />
          </button>
          <p className="text-sm font-medium text-slate-600">Verificación de caja {dosFotos ? (paso === "foto_superior" ? "(1/2)" : "(2/2)") : ""}</p>
        </div>

        <AvisoGirarMovil />

        <div className="w-full overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200" style={{ aspectRatio: cssAspectRatio(forma) }}>
          {camara.error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-sm text-red-600">{camara.error}</p>
              <p className="text-xs text-slate-400">Puedes elegir una foto de la galería en su lugar.</p>
            </div>
          ) : (
            <video ref={camara.videoRef} autoPlay muted playsInline className="h-full w-full bg-black object-cover" />
          )}
        </div>

        <input ref={inputGaleriaRef} type="file" accept="image/*" className="hidden" onChange={manejarArchivoGaleria} />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={camara.cargando || !!camara.error}
            onClick={manejarDisparo}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
          >
            <Camera size={20} aria-hidden />
            Hacer foto
          </button>
          <button
            type="button"
            onClick={() => inputGaleriaRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-4 text-base font-medium text-slate-900"
          >
            <ImageUp size={20} aria-hidden />
            Elegir de galería
          </button>
        </div>

        {mensaje && <p className="mt-3 text-sm text-slate-600">{mensaje}</p>}
        <button type="button" onClick={onCancelar} className="mt-4 w-full text-center text-sm text-slate-400 underline">
          Dejar para más tarde
        </button>
      </div>
    );
  }

  if (paso === "leyendo") {
    return <div className="p-6 text-center text-sm text-slate-500">{mensaje}</div>;
  }

  if (paso === "error") {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-sm text-red-600">{mensaje}</p>
        <button type="button" onClick={reiniciar} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          <RotateCcw size={16} aria-hidden />
          Repetir
        </button>
      </div>
    );
  }

  if (paso === "resultado" && resultado) {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center gap-2">
          {resultado.estadoGeneral === "correcto" ? (
            <CheckCircle2 size={20} className="text-emerald-600" aria-hidden />
          ) : resultado.estadoGeneral === "incorrecto" ? (
            <XCircle size={20} className="text-red-600" aria-hidden />
          ) : (
            <HelpCircle size={20} className="text-amber-600" aria-hidden />
          )}
          <p className="text-sm font-medium text-slate-700 capitalize">{resultado.estadoGeneral.replace("_", " ")}</p>
        </div>

        <div className="mb-6 space-y-2">
          {resultado.campos.map((c) => (
            <div key={c.campo} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">{c.etiqueta}</span>
              <span className="font-medium text-slate-800">{c.valorLeido ?? "—"}</span>
            </div>
          ))}
        </div>

        <button type="button" disabled={guardando} onClick={confirmar} className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40">
          {guardando ? "Guardando..." : "Confirmar"}
        </button>
        <button type="button" onClick={reiniciar} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-3 text-sm font-medium text-slate-900">
          <RotateCcw size={16} aria-hidden />
          Repetir foto
        </button>
      </div>
    );
  }

  return null;
}