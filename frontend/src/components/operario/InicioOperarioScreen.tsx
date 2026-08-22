import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Coffee, Sparkles, Wand2, ImageUp } from "lucide-react";
import type { TurnoActual } from "../../lib/rotacion";
import { useAuth } from "../../context/AuthContext";
import {
  generarPersonaje,
  obtenerResumenGamificacion,
  type ResumenGamificacion,
} from "../../lib/gamificacion";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { cargarImagenDesdeArchivo, procesarFotoLibre } from "../../lib/captura-imagen";

interface InicioOperarioScreenProps {
  turnoInfo: TurnoActual | null;
  cargando: boolean;
  nombreTipo: Record<"M" | "T" | "N", string>;
}

function formatearHora(fecha: Date | null): string {
  if (!fecha) return "—";
  return fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Pantalla Inicio (03-rol-operario.md 5.1) — el estado del turno de
 * hoy (sin cambios desde 19/08/2026) + la tarjeta de gamificación
 * (retomada 22/08/2026, ver InicioOperarioScreen anterior: quedó
 * "deliberadamente vacía" hasta que el resto del sistema de puntos
 * estuviera construido — ya lo está).
 */
export function InicioOperarioScreen({ turnoInfo, cargando, nombreTipo }: InicioOperarioScreenProps) {
  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando...</div>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {turnoInfo?.estado === "descanso" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Coffee size={40} className="text-slate-400" aria-hidden />
            <p className="text-lg font-medium text-slate-900">Hoy es tu día de descanso</p>
            <p className="text-sm text-slate-500">Puedes seguir consultando tu historial cuando quieras.</p>
          </div>
        ) : turnoInfo?.tipo ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock size={40} className="text-slate-400" aria-hidden />
            <p className="text-lg font-medium text-slate-900">
              Turno de {nombreTipo[turnoInfo.tipo]}
              {turnoInfo.estado === "antes" && ` — empieza a las ${formatearHora(turnoInfo.inicioFranja)}`}
            </p>
            {turnoInfo.estado === "en_revision" && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">En revisión</span>
            )}
            {turnoInfo.estado === "cerrado" && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Turno cerrado</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock size={40} className="text-slate-400" aria-hidden />
            <p className="text-sm text-slate-500">No hay turno activo ahora mismo.</p>
          </div>
        )}
      </div>

      <GamificacionCard />
    </div>
  );
}

function GamificacionCard() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState<ResumenGamificacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  // Imagen de referencia elegida por el usuario (obligatoria) + texto
  // libre opcional — igual que en v1/v2 (ver lib/gamificacion.ts).
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [imagenReferenciaUrl, setImagenReferenciaUrl] = useState<string | null>(null);
  const [promptOperario, setPromptOperario] = useState("");
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    if (!usuario || (usuario.rol !== "operario" && usuario.rol !== "responsable")) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerResumenGamificacion(usuario.id, usuario.rol);
      setResumen(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function manejarArchivoElegido(archivo: File) {
    setError(null);
    setSubiendoImagen(true);
    try {
      // Reduce a un ancho máximo razonable y convierte a WebP — sin
      // esto, una foto de móvil (varios MB, 4000px+) se sube entera a
      // Cloudinary y se reenvía entera a OpenAI, que cobra por tamaño
      // de imagen de entrada. GPT Image genera a 1024x1536, así que
      // no hace falta más resolución de la que ya pide procesarFotoLibre
      // por defecto (1600px de ancho máximo).
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFotoLibre(img);
      setPrevisualizacion(URL.createObjectURL(procesada.blob));
      const publicId = construirPublicId(usuario?.id ?? "personaje", "referencia");
      const subida = await subirACloudinary(procesada.blob, publicId, "personajes");
      setImagenReferenciaUrl(subida.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPrevisualizacion(null);
      setImagenReferenciaUrl(null);
    } finally {
      setSubiendoImagen(false);
    }
  }

  async function manejarGenerar() {
    if (!imagenReferenciaUrl) {
      setError("Elige antes una imagen de referencia");
      return;
    }
    setGenerando(true);
    setError(null);
    try {
      await generarPersonaje(imagenReferenciaUrl, promptOperario);
      await cargar(); // refresca imagen + generaciones_disponibles ya actualizadas
      // Limpia la selección para la próxima generación.
      setPrevisualizacion(null);
      setImagenReferenciaUrl(null);
      setPromptOperario("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerando(false);
    }
  }

  if (cargando) {
    return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Cargando tu progreso...</div>;
  }

  if (!resumen) {
    // Rol sin gamificación (jefe, admin, etc. no deberían llegar aquí,
    // pero por si acaso) — no se muestra nada, no es un error.
    return null;
  }

  const { puntosTotales, nivelActual, siguienteNivel, personaje, generacionesDisponibles } = resumen;

  const progresoPct = siguienteNivel
    ? Math.min(
        100,
        Math.round(
          (100 * (puntosTotales - nivelActual.umbral_min)) /
            (siguienteNivel.umbral_min - nivelActual.umbral_min),
        ),
      )
    : 100;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* Cabecera de nivel — el color_marco de niveles.color_marco enmarca la tarjeta */}
      <div className="p-6" style={{ borderTop: `4px solid ${nivelActual.color_marco}` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Nivel {nivelActual.orden}</p>
            <p className="text-lg font-semibold text-slate-900">{nivelActual.nombre}</p>
          </div>
          <div className="flex items-center gap-0.5" title={`${nivelActual.estrellas} estrellas`}>
            {Array.from({ length: nivelActual.estrellas }).map((_, i) => (
              <span key={i} style={{ color: nivelActual.color_marco }}>★</span>
            ))}
          </div>
        </div>

        <p className="mt-3 text-2xl font-bold text-slate-900">{puntosTotales.toLocaleString("es-ES")} pts</p>

        {siguienteNivel ? (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progresoPct}%`, backgroundColor: nivelActual.color_marco }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {(siguienteNivel.umbral_min - puntosTotales).toLocaleString("es-ES")} pts para {siguienteNivel.nombre}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs font-medium text-slate-500">Nivel máximo alcanzado 🎉</p>
        )}
      </div>

      {/* Personaje */}
      <div className="border-t border-slate-100 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Sparkles size={16} aria-hidden />
          Tu personaje
        </div>

        {personaje ? (
          <div className="mt-3 flex flex-col items-center gap-3">
            <img
              src={personaje.imagen_url}
              alt={`Personaje de nivel ${nivelActual.nombre}`}
              className="max-h-80 rounded-xl object-contain"
            />
            {personaje.historia && <p className="text-center text-sm text-slate-500">{personaje.historia}</p>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Todavía no has generado ningún personaje.</p>
        )}

        {/* Imagen de referencia — obligatoria, cualquier imagen de la galería (no tiene que ser tu cara) */}
        <input
          ref={inputArchivoRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) manejarArchivoElegido(archivo);
          }}
        />

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputArchivoRef.current?.click()}
            disabled={subiendoImagen}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ImageUp size={16} aria-hidden />
            {subiendoImagen ? "Subiendo imagen..." : previsualizacion ? "Cambiar imagen de referencia" : "Elegir imagen de referencia"}
          </button>

          {previsualizacion && (
            <img src={previsualizacion} alt="Referencia elegida" className="mx-auto max-h-32 rounded-lg object-contain" />
          )}

          <textarea
            value={promptOperario}
            onChange={(e) => setPromptOperario(e.target.value)}
            placeholder="Añade algo más si quieres (opcional): pose, colores, detalles..."
            rows={2}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 placeholder:text-slate-400"
          />
        </div>

        <button
          type="button"
          onClick={manejarGenerar}
          disabled={generando || subiendoImagen || !imagenReferenciaUrl || generacionesDisponibles <= 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Wand2 size={16} aria-hidden />
          {generando ? "Generando..." : personaje ? "Generar de nuevo" : "Generar mi personaje"}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          {generacionesDisponibles} generacion{generacionesDisponibles === 1 ? "" : "es"} disponible
          {generacionesDisponibles === 1 ? "" : "s"} — consigues 3 más cada vez que subes de nivel
        </p>

        {error && <p className="mt-3 text-center text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}