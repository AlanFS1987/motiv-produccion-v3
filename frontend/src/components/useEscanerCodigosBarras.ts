import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

/** Tipos mínimos de BarcodeDetector — no está en lib.dom.d.ts en todas las versiones de TS. */
interface BarcodeDetectorResultado {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(fuente: CanvasImageSource): Promise<BarcodeDetectorResultado[]>;
}
declare const BarcodeDetector:
  | { new (opciones: { formats: string[] }): BarcodeDetectorLike }
  | undefined;

/** Solo EAN-13 y Code128 — decisión de sesión 18/08, >90% de las cajas reales son EAN-13. */
const FORMATOS_NATIVOS = ["ean_13", "code_128"];
const HINTS_ZXING = new Map();
HINTS_ZXING.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.CODE_128]);

export interface UseEscanerCodigosBarrasResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: string | null;
}

/**
 * Escaneo continuo de códigos de barras, con doble motor y recorte de área.
 *
 * MOTOR (sesión 28/08/2026): usa `BarcodeDetector` nativo del
 * navegador cuando está disponible (Chrome/Android — acelerado por
 * hardware, más rápido y preciso), con fallback automático a ZXing
 * (@zxing/browser) en cualquier otro caso. Es imprescindible seguir
 * teniendo ZXing: Safari, y por extensión TODOS los navegadores en
 * iOS (dependen de WebKit por obligación de Apple), no implementan
 * BarcodeDetector — no es una cuestión de qué navegador de iPhone
 * elijas, ninguno lo tiene. Con una flota mitad Android/mitad
 * iPhone, cada responsable obtiene automáticamente el mejor motor
 * disponible en su propio móvil.
 *
 * RECORTE (mismo motivo en ambos casos): cada fotograma se recorta a
 * una franja central antes de analizarlo — menos píxeles que
 * procesar (más intentos por segundo) y menos ruido de fondo,
 * especialmente útil con códigos muy alargados que ocupan poco alto
 * del encuadre.
 *
 * Gestiona la cámara directamente con getUserMedia (no usa
 * decodeFromConstraints de ZXing, que no permite recortar el área
 * analizada) — por eso NO se apoya en useCamaraLive.ts, que está
 * pensado para fotos fijas, no para un bucle de detección continua.
 */
export function useEscanerCodigosBarras(
  activo: boolean,
  alDetectar: (texto: string) => void,
): UseEscanerCodigosBarrasResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const alDetectarRef = useRef(alDetectar);
  alDetectarRef.current = alDetectar;

  const soportaNativo = typeof BarcodeDetector !== "undefined";

  useEffect(() => {
    if (!activo || !videoRef.current) return;

    let vivo = true;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let procesando = false;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const detectorNativo = soportaNativo && BarcodeDetector ? new BarcodeDetector({ formats: FORMATOS_NATIVOS }) : null;
    const readerZXing = detectorNativo ? null : new BrowserMultiFormatReader(HINTS_ZXING);

    async function procesarFotograma() {
      if (!vivo) return;
      if (procesando || !ctx || video.videoWidth === 0) {
        frameId = requestAnimationFrame(procesarFotograma);
        return;
      }
      procesando = true;

      // Recorte a franja central: 92% del ancho, 32% del alto.
      // Ajusta estos porcentajes si el recuadro visual (overlay en
      // el componente) cambia — deben coincidir para que lo que ve
      // el usuario sea realmente lo que se analiza.
      const anchoRecorte = video.videoWidth * 0.95;
      const altoRecorte = video.videoHeight * 0.2;
      const x = (video.videoWidth - anchoRecorte) / 2;
      const y = (video.videoHeight - altoRecorte) / 2;
      canvas.width = anchoRecorte;
      canvas.height = altoRecorte;
      ctx.drawImage(video, x, y, anchoRecorte, altoRecorte, 0, 0, anchoRecorte, altoRecorte);

      try {
        if (detectorNativo) {
          const resultados = await detectorNativo.detect(canvas);
          if (resultados[0]?.rawValue && vivo) {
            alDetectarRef.current(resultados[0].rawValue);
          }
        } else if (readerZXing) {
          try {
            const resultado = readerZXing.decodeFromCanvas(canvas);
            if (vivo) alDetectarRef.current(resultado.getText());
          } catch {
            // NotFoundException — normal, no había código legible en este fotograma.
          }
        }
      } catch {
        // Error puntual de detección — se reintenta en el siguiente fotograma.
      }

      procesando = false;
      if (vivo) frameId = requestAnimationFrame(procesarFotograma);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        if (!vivo) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
        frameId = requestAnimationFrame(procesarFotograma);
      })
      .catch((err) => {
        if (vivo) setError(err instanceof Error ? err.message : "No se pudo acceder a la cámara");
      });

    return () => {
      vivo = false;
      if (frameId) cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [activo, soportaNativo]);

  return { videoRef, error };
}