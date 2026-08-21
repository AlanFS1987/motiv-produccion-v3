// frontend/src/components/admin/PruebaCamaraScreen.tsx
// Prueba AISLADA — no sube nada a Cloudinary, no toca ningún parte,
// no depende de turno/línea. Sirve para comparar dos formas de
// capturar una foto:
//
// 1) Cámara nativa (<input type="file" capture="environment">) —
//    delega en la app de Cámara del sistema. Es el método que se
//    abandonó en sesión 18/08/2026 por un bug real detectado en
//    varios Xiaomi (Redmi Note 12 Pro+ y 8 Pro): al volver de la app
//    de Cámara, Chrome recargaba la pestaña ENTERA en vez de devolver
//    el foco, perdiendo todo el progreso del parte que se estuviera
//    capturando — sin ningún error JS detectable, comportamiento del
//    navegador (ver lib/captura-imagen.ts, comentario de
//    capturarFotogramaVideo).
// 2) Cámara en vivo (useCamaraLive, con ImageCapture cuando el
//    navegador lo soporta) — el método que usa hoy toda la app
//    (FotoHojaPartida, FotoCajaVerificacion, FotoPantallaMaquina...).
//
// Si en el dispositivo/versión de Chrome actual el método 1 YA NO
// recarga la pestaña, podría valer la pena reconsiderarlo (a veces
// da fotos más nítidas al delegar en la app nativa) — pero eso se
// decide viendo el resultado aquí, no cambiando nada en producción
// todavía.

import { useState, type ChangeEvent } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { useCamaraLive } from "../useCamaraLive";
import { cargarImagenDesdeArchivo, procesarFoto, cssAspectRatio } from "../../lib/captura-imagen";

interface ResultadoCaptura {
  url: string;
  ancho: number;
  alto: number;
  bytes: number;
  mediaType: string;
}

export function PruebaCamaraScreen() {
  const [resultadoNativa, setResultadoNativa] = useState<ResultadoCaptura | null>(null);
  const [resultadoEnVivo, setResultadoEnVivo] = useState<ResultadoCaptura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vivaActiva, setVivaActiva] = useState(false);

  // "pantalla" es solo la forma/recuadro de referencia (4:3) — vale
  // igual para esta prueba, no implica que estemos capturando datos
  // reales de ninguna máquina.
  const camara = useCamaraLive("pantalla", vivaActiva);

  async function manejarArchivoNativo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError(null);
    try {
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFoto(img, "pantalla");
      setResultadoNativa({
        url: URL.createObjectURL(procesada.blob),
        ancho: procesada.ancho,
        alto: procesada.alto,
        bytes: procesada.blob.size,
        mediaType: procesada.mediaType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function dispararEnVivo() {
    setError(null);
    try {
      const procesada = await camara.disparar();
      setResultadoEnVivo({
        url: URL.createObjectURL(procesada.blob),
        ancho: procesada.ancho,
        alto: procesada.alto,
        bytes: procesada.blob.size,
        mediaType: procesada.mediaType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <p className="text-sm text-[var(--texto-tenue)]">
        Prueba aislada: no sube nada ni toca ningún parte. Solo compara la foto que sale de cada método —
        nitidez, tamaño de archivo y, sobre todo, si la pestaña se recarga sola al volver de la cámara nativa.
      </p>

      {/* Método 1: cámara nativa */}
      <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
        <p className="mb-2 text-sm font-medium text-[var(--texto)]">1) Cámara nativa (input capture)</p>
        <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--acento)] px-4 py-3 text-sm font-medium text-[var(--acento-texto)]">
          <Camera size={18} aria-hidden />
          Abrir cámara nativa
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={manejarArchivoNativo} />
        </label>
        {resultadoNativa && <ResultadoFoto r={resultadoNativa} />}
      </div>

      {/* Método 2: cámara en vivo (el que usa hoy la app en producción) */}
      <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
        <p className="mb-2 text-sm font-medium text-[var(--texto)]">2) Cámara en vivo (método actual)</p>
        {!vivaActiva ? (
          <button
            type="button"
            onClick={() => setVivaActiva(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--acento)] px-4 py-3 text-sm font-medium text-[var(--acento-texto)]"
          >
            <Camera size={18} aria-hidden />
            Activar cámara en vivo
          </button>
        ) : (
          <>
            <div
              className="mb-2 overflow-hidden rounded-lg bg-black"
              style={{ aspectRatio: cssAspectRatio("pantalla") }}
            >
              {camara.error ? (
                <p className="p-3 text-center text-sm text-red-400">{camara.error}</p>
              ) : (
                <video ref={camara.videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={dispararEnVivo}
                disabled={camara.cargando || !!camara.error}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--acento)] px-4 py-3 text-sm font-medium text-[var(--acento-texto)] disabled:opacity-40"
              >
                <Camera size={18} aria-hidden />
                Disparar
              </button>
              <button
                type="button"
                onClick={() => setVivaActiva(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--borde)] px-4 py-3 text-sm text-[var(--texto)]"
              >
                <RotateCcw size={18} aria-hidden />
                Apagar
              </button>
            </div>
          </>
        )}
        {resultadoEnVivo && <ResultadoFoto r={resultadoEnVivo} />}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ResultadoFoto({ r }: { r: ResultadoCaptura }) {
  return (
    <div className="mt-3">
      <img src={r.url} alt="" className="w-full rounded-lg border border-[var(--borde)]" />
      <p className="mt-1 text-xs text-[var(--texto-tenue)]">
        {r.ancho}×{r.alto} px · {(r.bytes / 1024).toFixed(0)} KB · {r.mediaType}
      </p>
    </div>
  );
}