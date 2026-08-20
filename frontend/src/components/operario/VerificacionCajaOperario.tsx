import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, HelpCircle, RotateCcw, Camera } from "lucide-react";
import { AvisoGirarMovil } from "../AvisoGirarMovil";
import { useCamaraLive } from "../useCamaraLive";
import { cssAspectRatio, type FormaFoto, type ImagenProcesada } from "../../lib/captura-imagen";
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
 * Verificación de caja hecha por el OPERARIO (03-rol-operario.md
 * 5.X) — mismo mecanismo de comparación que la del responsable
 * (lib/verificacion-caja.ts), pero:
 * - escribe en las columnas *_operario (lib/operario.ts), nunca en
 *   las del responsable;
 * - SOLO cámara en vivo, sin "confirmar a mano" NI "elegir de
 *   galería" (a diferencia del resto de fotos de la app) — mismo
 *   criterio que Limpieza (5.9a): el operario está delante de la
 *   caja en el momento, así que no hace falta ni tiene sentido subir
 *   una foto ya existente. Corregido en sesión 19/08/2026 — la
 *   primera versión de este archivo usaba <SelectorFoto>, que sí
 *   ofrece galería, coló la opción por error.
 *
 * Bloqueante si el dispositivo no tiene cámara (camara.error) — es el
 * comportamiento correcto aquí, a diferencia del responsable (ver fix
 * de SelectorFoto.tsx): sin cámara, esta verificación simplemente no
 * se puede hacer.
 */
export function VerificacionCajaOperario({ parte, onVerificado, onCancelar }: VerificacionCajaOperarioProps) {
  const lote = construirDatosComparacion(parte);
  const dosFotos = requiereDosFotosCaja(lote.formatoNombre);

  const [paso, setPaso] = useState<Paso>("foto_superior");
  const [mensaje, setMensaje] = useState("");
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [urlSuperior, setUrlSuperior] = useState<string | null>(null);
  const [fotosSubidas, setFotosSubidas] = useState<string[]>([]);
  const [resultado, setResultado] = useState<ResultadoVerificacionCaja | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const forma: FormaFoto = paso === "foto_superior" ? "caja_superior" : "caja_lateral";
  const camaraActiva = paso === "foto_superior" || paso === "foto_lateral";
  const camara = useCamaraLive(forma, camaraActiva);

  async function subirBlob(blob: Blob): Promise<string> {
    setPrevisualizacion(URL.createObjectURL(blob));
    const publicId = construirPublicId(lote.tono, "caja_op");
    const subida = await subirACloudinary(blob, publicId, "partes");
    return subida.url;
  }

  async function manejarFotoSuperior(url: string) {
    setUrlSuperior(url);
    if (dosFotos) {
      setFotosSubidas([url]);
      setPaso("foto_lateral");
      setPrevisualizacion(null);
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

  async function disparar() {
    setSubiendo(true);
    setMensaje("Subiendo foto...");
    try {
      const procesada: ImagenProcesada = await camara.disparar();
      const url = await subirBlob(procesada.blob);
      if (paso === "foto_superior") {
        await manejarFotoSuperior(url);
      } else {
        await manejarFotoLateral(url);
      }
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setSubiendo(false);
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
    setPrevisualizacion(null);
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
          <p className="text-sm font-medium text-slate-600">
            Verificación de caja {dosFotos ? (paso === "foto_superior" ? "(1/2)" : "(2/2)") : ""}
          </p>
        </div>

        {!camaraActiva && <AvisoGirarMovil />}

        <div
          className="w-full overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200"
          style={{ aspectRatio: cssAspectRatio(forma) }}
        >
          {camaraActiva ? (
            camara.error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                <p className="text-sm text-red-600">{camara.error}</p>
              </div>
            ) : (
              <video ref={camara.videoRef} autoPlay muted playsInline className="h-full w-full bg-black object-cover" />
            )
          ) : previsualizacion ? (
            <img src={previsualizacion} alt="Previsualización" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Encuadra la caja</div>
          )}
        </div>

        <button
          type="button"
          disabled={subiendo || camara.cargando || !!camara.error}
          onClick={disparar}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
        >
          <Camera size={20} aria-hidden />
          {subiendo ? "Subiendo..." : "Hacer foto"}
        </button>

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
        <button
          type="button"
          onClick={reiniciar}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
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

        <button
          type="button"
          disabled={guardando}
          onClick={confirmar}
          className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
        >
          {guardando ? "Guardando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={reiniciar}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-3 text-sm font-medium text-slate-900"
        >
          <RotateCcw size={16} aria-hidden />
          Repetir foto
        </button>
      </div>
    );
  }

  return null;
}