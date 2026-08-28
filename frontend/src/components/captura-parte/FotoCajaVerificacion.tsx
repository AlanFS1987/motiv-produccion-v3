import { useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, XCircle, HelpCircle, RotateCcw, UserCheck, Camera, ImageUp } from "lucide-react";
import { AvisoGirarMovil } from "../AvisoGirarMovil";
import { useCamaraLive } from "../useCamaraLive";
import {
  cargarImagenDesdeArchivo,
  procesarFoto,
  cssAspectRatio,
  type FormaFoto,
} from "../../lib/captura-imagen";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { ocrParte } from "../../lib/supabase-functions";
import {
  requiereDosFotosCaja,
  evaluarVerificacionCaja,
  type ResultadoVerificacionCaja,
} from "../../lib/verificacion-caja";
import { actualizarVerificacionCaja, type DatosLoteComparacion, type DatosOcrCaja, type EstadoVerificacionCaja } from "../../lib/parte";

type Paso = "elegir" | "foto_superior" | "foto_lateral" | "leyendo" | "resultado" | "manual" | "error";

interface FotoCajaVerificacionProps {
  parteId: string;
  lote: DatosLoteComparacion;
  onVerificado: (estado: EstadoVerificacionCaja) => void;
  onCancelar: () => void;
}

/**
 * Verificación de caja — CÁMARA EN VIVO (a diferencia de hoja/
 * pantalla, que usan cámara nativa desde el 28/08/2026). Decisión de
 * sesión: aquí sí importa el encuadre exacto en tiempo real, sobre
 * todo en "caja_lateral" (franja muy estrecha 1600x300) — el
 * recuadro-guía en pantalla solo funciona con vídeo en vivo. El
 * propio <video> hace de previsualización, no hace falta un estado
 * aparte para eso.
 */
export function FotoCajaVerificacion({ parteId, lote, onVerificado, onCancelar }: FotoCajaVerificacionProps) {
  const dosFotos = requiereDosFotosCaja(lote.formatoNombre);
  const [paso, setPaso] = useState<Paso>("elegir");
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
    const publicId = construirPublicId(lote.tono, "caja");
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

  async function confirmarResultadoOcr() {
    if (!resultado) return;
    setGuardando(true);
    try {
      await actualizarVerificacionCaja(parteId, resultado.estadoGeneral, fotosSubidas, resultado.campos);
      onVerificado(resultado.estadoGeneral);
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
      await actualizarVerificacionCaja(parteId, "verificado_manual");
      onVerificado("verificado_manual");
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
    setPaso("elegir");
    setMensaje("");
  }

  if (paso === "elegir") {
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-4 text-sm font-medium text-slate-600">Foto 2 — Verificación de caja</p>
        <button type="button" onClick={() => setPaso("foto_superior")} className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white">
          Verificar con foto (OCR)
        </button>
        <button type="button" onClick={() => setPaso("manual")} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 px-4 py-4 text-base font-medium text-slate-900">
          <UserCheck size={20} aria-hidden />
          Confirmar a mano, sin foto
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
          Confirmas que has comprobado a simple vista que la caja impresa coincide con {lote.marcaTextoNormalizado} — {lote.modeloTextoNormalizado}, tono {lote.tono}
          {lote.calibre ? `, calibre ${lote.calibre}` : ""}. Queda registrado como verificación manual, distinta de la verificación por foto.
        </p>
        <button type="button" disabled={guardando} onClick={confirmarManual} className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40">
          {guardando ? "Guardando..." : "Confirmo que es correcto"}
        </button>
        <button type="button" onClick={() => setPaso("elegir")} className="text-sm text-slate-400 underline">
          Volver
        </button>
      </div>
    );
  }

  if (paso === "foto_superior" || paso === "foto_lateral") {
    const etiqueta = paso === "foto_superior" ? (dosFotos ? "Foto 2 — Caja (parte superior: marca + especificaciones)" : "Foto 2 — Caja impresa") : "Foto 2b — Caja (lateral: modelo, tono, calibre)";

    return (
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-sm font-medium text-slate-600">{etiqueta}</p>
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
        <button type="button" onClick={() => setPaso("elegir")} className="mt-4 w-full text-center text-sm text-slate-400 underline">
          Volver
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
          Volver a intentar
        </button>
      </div>
    );
  }

  if (!resultado) return null;

  return (
    <div className="mx-auto max-w-md">
      <BannerEstado estado={resultado.estadoGeneral} />
      <div className="mt-4 divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
        {resultado.campos.map((c) => (
          <FilaCampo key={c.campo} campo={c} />
        ))}
      </div>
      <button type="button" onClick={reiniciar} className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-slate-400 underline">
        <RotateCcw size={14} aria-hidden />
        Repetir fotos
      </button>
      <button type="button" disabled={guardando} onClick={confirmarResultadoOcr} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40">
        {guardando ? "Guardando..." : "Continuar"}
      </button>
    </div>
  );
}

function BannerEstado({ estado }: { estado: ResultadoVerificacionCaja["estadoGeneral"] }) {
  if (estado === "correcto") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 size={20} aria-hidden />
        <p className="text-sm font-medium">Diseño correcto</p>
      </div>
    );
  }
  if (estado === "incorrecto") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-red-800">
        <XCircle size={20} aria-hidden />
        <p className="text-sm font-medium">Diseño incorrecto — revisar antes de continuar</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-amber-800">
      <HelpCircle size={20} aria-hidden />
      <p className="text-sm font-medium">No se ha podido verificar todo — revisa tú los campos marcados</p>
    </div>
  );
}

function FilaCampo({ campo }: { campo: ResultadoVerificacionCaja["campos"][number] }) {
  const Icono = campo.estado === "correcto" ? CheckCircle2 : campo.estado === "incorrecto" ? XCircle : HelpCircle;
  const color = campo.estado === "correcto" ? "text-emerald-600" : campo.estado === "incorrecto" ? "text-red-600" : "text-amber-600";
  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{campo.etiqueta}</p>
        <p className="text-xs text-slate-400">Esperado: {campo.valorEsperado || "—"} · Leído: {campo.valorLeido || "—"}</p>
      </div>
      <Icono size={20} className={color} aria-hidden />
    </div>
  );
}