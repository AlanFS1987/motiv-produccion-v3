import { useEffect, useRef, useState } from "react";
import {
  capturarFotogramaVideo,
  cargarImagenDesdeArchivo,
  procesarFoto,
  type FormaFoto,
  type ImagenProcesada,
} from "../lib/captura-imagen";

export interface UseCamaraLiveResult {
  /** Pasar a <video ref={videoRef} autoPlay muted playsInline />. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** true mientras se está pidiendo permiso/arrancando la cámara. */
  cargando: boolean;
  /** Mensaje de error si getUserMedia falla (permiso denegado, sin cámara, etc.). */
  error: string | null;
  /** Captura una foto a resolución completa (ImageCapture si el navegador lo soporta, si no cae al fotograma del vídeo en vivo). */
  disparar: () => Promise<ImagenProcesada>;
}

/** Tipos mínimos de la API ImageCapture — no está en lib.dom.d.ts en todas las versiones de TS. */
interface ImageCaptureLike {
  takePhoto(): Promise<Blob>;
}
declare const ImageCapture:
  | { new (track: MediaStreamTrack): ImageCaptureLike }
  | undefined;

/**
 * Cámara en vivo SIEMPRE activa mientras el componente que la usa esté
 * montado — sin paso de "activar" ni de "confirmar foto".
 *
 * `disparar()` usa la API ImageCapture cuando está disponible
 * (Chrome/Android) para tomar la foto a la resolución COMPLETA del
 * sensor — el stream de <video> en vivo va deliberadamente a menor
 * resolución que el sensor real (los navegadores lo hacen así para
 * que la previsualización vaya fluida), así que capturar solo un
 * fotograma del vídeo daba fotos notablemente más borrosas que la
 * app de Cámara nativa (detectado en sesión 18/08/2026: ~80-100KB
 * WebP en vez de varios cientos, visiblemente borroso al ampliar).
 * Si el navegador no soporta ImageCapture, cae al método anterior
 * (fotograma del vídeo) sin romper nada.
 *
 * Sustituye a <input capture="environment"> — ver
 * lib/captura-imagen.ts:capturarFotogramaVideo para el motivo del
 * cambio de fondo (bug real de Chrome recargando la pestaña al volver
 * de la app de Cámara nativa en varios Xiaomi).
 */
export function useCamaraLive(forma: FormaFoto, activa: boolean): UseCamaraLiveResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageCaptureRef = useRef<ImageCaptureLike | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activa) return;
    let vivo = true;
    setCargando(true);
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 3840 },
          height: { ideal: 2880 },
        },
      })
      .then((stream) => {
        if (!vivo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // ImageCapture da acceso a takePhoto() a resolución completa
        // del sensor — mucho más nítida que un fotograma del stream
        // de previsualización. Si el navegador no lo soporta,
        // imageCaptureRef se queda en null y disparar() cae al
        // método de fotograma de vídeo automáticamente.
        if (typeof ImageCapture !== "undefined") {
          const [track] = stream.getVideoTracks();
          if (track) {
            try {
              imageCaptureRef.current = new ImageCapture(track);
            } catch {
              imageCaptureRef.current = null;
            }
          }
        }

        setCargando(false);
      })
      .catch((err) => {
        if (!vivo) return;
        setError(
          err instanceof Error ? `No se pudo acceder a la cámara: ${err.message}` : "No se pudo acceder a la cámara",
        );
        setCargando(false);
      });

    return () => {
      vivo = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      imageCaptureRef.current = null;
    };
  }, [activa, forma]);

  async function disparar(): Promise<ImagenProcesada> {
    if (imageCaptureRef.current) {
      try {
        const blob = await imageCaptureRef.current.takePhoto();
        const img = await cargarImagenDesdeArchivo(blob);
        return procesarFoto(img, forma);
      } catch {
        // Si takePhoto() falla por lo que sea (algunos dispositivos
        // lo anuncian pero fallan en la práctica), cae al método de
        // fotograma de vídeo en vez de romper la captura entera.
      }
    }
    if (!videoRef.current) {
      throw new Error("La cámara todavía no está lista");
    }
    return capturarFotogramaVideo(videoRef.current, forma);
  }

  return { videoRef, cargando, error, disparar };
}