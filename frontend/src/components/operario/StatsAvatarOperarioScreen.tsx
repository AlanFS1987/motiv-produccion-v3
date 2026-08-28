// frontend/src/components/operario/StatsAvatarOperarioScreen.tsx
//
// Stats (siempre en vivo) + gestión de Avatar, fusionados en una
// sola pestaña (decisión de sesión 23/08/2026 — antes iban a ser dos
// pestañas separadas, Stats y Avatar).

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  obtenerStatsEnVivo,
  obtenerPersonajeActivo,
  listarPersonajes,
  seleccionarPersonaje,
  obtenerNivelesDisponiblesParaGenerar,
  generarPersonajeParaNivel,
  type StatsEnVivo,
  type NivelDisponibleGenerar,
} from "../../lib/stats-avatar";
import type { PersonajeInfo } from "../../lib/gamificacion";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { cargarImagenDesdeArchivo, procesarFotoLibre } from "../../lib/captura-imagen";

// 6 tramos: 0-10 / 10-100 / 100-1.000 / 1.000-10.000 / 10.000-100.000 / 100.000-1.000.000
const TRAMOS = [10, 100, 1_000, 10_000, 100_000, 1_000_000];
const COLOR: Record<"fuerza" | "resistencia" | "velocidad" | "vida", string> = {
  fuerza: "#E24B4A",
  resistencia: "#BA7517",
  velocidad: "#378ADD",
  vida: "#639922",
};

function BarraTramos({ valor, color }: { valor: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {TRAMOS.map((limite, i) => {
        const anterior = i === 0 ? 0 : TRAMOS[i - 1];
        let pct = 0;
        if (valor >= limite) pct = 100;
        else if (valor > anterior) pct = ((valor - anterior) / (limite - anterior)) * 100;
        return (
          <div key={limite} className="h-2 flex-1 overflow-hidden rounded-sm bg-[var(--superficie-alt)]">
            <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        );
      })}
    </div>
  );
}

function BarraSimple({ valor, min, max, color }: { valor: number; min: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, ((valor - min) / (max - min)) * 100));
  return (
    <div className="h-2 overflow-hidden rounded-sm bg-[var(--superficie-alt)]">
      <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function StatsAvatarOperarioScreen() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<StatsEnVivo | null>(null);
  const [activo, setActivo] = useState<PersonajeInfo | null>(null);
  const [nivelesDisponibles, setNivelesDisponibles] = useState<NivelDisponibleGenerar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [mostrarGenerador, setMostrarGenerador] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuario || (usuario.rol !== "operario" && usuario.rol !== "responsable")) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [statsData, activoData, nivelesData] = await Promise.all([
        obtenerStatsEnVivo(usuario.id, usuario.rol as "operario" | "responsable"),
        obtenerPersonajeActivo(usuario.id),
        obtenerNivelesDisponiblesParaGenerar(usuario.id),
      ]);
      setStats(statsData);
      setActivo(activoData);
      setNivelesDisponibles(nivelesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando)
    return (
      <div className="rounded-2xl bg-[var(--superficie)] p-6 text-center text-sm text-[var(--texto-tenue)] shadow-sm">
        Cargando...
      </div>
    );
  if (error) return <div className="rounded-2xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">{error}</div>;
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-[var(--superficie)] p-5 shadow-sm">
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-[var(--texto-secundario)]">Fuerza</span>
            <span className="text-sm font-medium text-[var(--texto)]">{stats.fuerza.toLocaleString("es-ES")}</span>
          </div>
          <BarraTramos valor={stats.fuerza} color={COLOR.fuerza} />
        </div>
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-[var(--texto-secundario)]">Resistencia</span>
            <span className="text-sm font-medium text-[var(--texto)]">{stats.resistencia.toLocaleString("es-ES")}</span>
          </div>
          <BarraTramos valor={stats.resistencia} color={COLOR.resistencia} />
        </div>
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-[var(--texto-secundario)]">Velocidad</span>
            <span className="text-sm font-medium text-[var(--texto)]">
              {stats.velocidad === null ? "—" : stats.velocidad.toLocaleString("es-ES")}
            </span>
          </div>
          <BarraSimple valor={stats.velocidad ?? 0} min={6} max={11} color={COLOR.velocidad} />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-[var(--texto-secundario)]">Vida</span>
            <span className="text-sm font-medium text-[var(--texto)]">{stats.vida.toLocaleString("es-ES")}</span>
          </div>
          <BarraTramos valor={stats.vida} color={COLOR.vida} />
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--superficie)] p-4 shadow-sm">
        <div className="mb-3 flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--superficie-alt)]">
          {activo ? (
            <img src={activo.imagen_url} alt="Tu avatar" className="h-full w-full object-contain" />
          ) : (
            // Placeholder — el operario definirá una imagen graciosa propia más adelante.
            <span className="text-sm text-[var(--texto-tenue)]">Aún no tienes avatar</span>
          )}
        </div>

        {activo && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-[var(--texto-secundario)]">Su historia</p>
            {activo.historia ? (
              <p className="text-sm leading-relaxed text-[var(--texto)]">{activo.historia}</p>
            ) : (
              <p className="text-sm italic text-[var(--texto-tenue)]">Tu historia se está preparando — vuelve más tarde.</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {activo && (
            <button
              onClick={() => setMostrarPicker(true)}
              className="flex-1 rounded-lg border border-[var(--borde)] py-2 text-sm font-medium text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
            >
              Elegir avatar
            </button>
          )}
          <button
            onClick={() => setMostrarGenerador(true)}
            disabled={nivelesDisponibles.length === 0}
            className="flex-1 rounded-lg bg-[var(--acento)] py-2 text-sm font-medium text-[var(--acento-texto)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {nivelesDisponibles.length === 0 ? "Sin generaciones" : "Generar avatar"}
          </button>
        </div>
      </div>

      {mostrarPicker && usuario && (
        <PickerAvatares
          usuarioId={usuario.id}
          onCerrar={() => setMostrarPicker(false)}
          onElegido={() => {
            setMostrarPicker(false);
            cargar();
          }}
        />
      )}

      {mostrarGenerador && (
        <GeneradorAvatar
          nivelesDisponibles={nivelesDisponibles}
          onCerrar={() => setMostrarGenerador(false)}
          onGenerado={() => {
            setMostrarGenerador(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function PickerAvatares({ usuarioId, onCerrar, onElegido }: { usuarioId: string; onCerrar: () => void; onElegido: () => void }) {
  const [personajes, setPersonajes] = useState<(PersonajeInfo & { seleccionada: boolean })[]>([]);
  const [cargando, setCargando] = useState(true);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarPersonajes(usuarioId)
      .then(setPersonajes)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCargando(false));
  }, [usuarioId]);

  async function elegir(id: string) {
    setEligiendo(id);
    setError(null);
    try {
      await seleccionarPersonaje(id);
      onElegido();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEligiendo(null);
    }
  }

  return (
    <div className="rounded-2xl bg-[var(--superficie)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--texto)]">Elegir avatar</p>
        <button onClick={onCerrar} aria-label="Cerrar">
          <X size={18} className="text-[var(--texto-tenue)]" />
        </button>
      </div>
      {cargando ? (
        <p className="py-4 text-center text-sm text-[var(--texto-secundario)]">Cargando...</p>
      ) : personajes.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--texto-secundario)]">Todavía no has generado ningún avatar.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {personajes.map((p) => (
            <button
              key={p.id}
              onClick={() => elegir(p.id)}
              disabled={eligiendo !== null}
              className={`relative aspect-[3/4] overflow-hidden rounded-lg ${p.seleccionada ? "ring-2 ring-[var(--acento)]" : ""}`}
            >
              <img src={p.imagen_url} alt="" className="h-full w-full object-cover" />
              {eligiendo === p.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--superficie)]/70">
                  <RefreshCw size={16} className="animate-spin text-[var(--texto-secundario)]" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function GeneradorAvatar({
  nivelesDisponibles,
  onCerrar,
  onGenerado,
}: {
  nivelesDisponibles: NivelDisponibleGenerar[];
  onCerrar: () => void;
  onGenerado: () => void;
}) {
  const { usuario } = useAuth();
  const [nivelId, setNivelId] = useState<string | null>(
    nivelesDisponibles.length === 1 ? nivelesDisponibles[0].nivelId : null,
  );
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [imagenReferenciaUrl, setImagenReferenciaUrl] = useState<string | null>(null);
  const [promptOperario, setPromptOperario] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  async function manejarArchivoElegido(archivo: File) {
    setError(null);
    setSubiendoImagen(true);
    try {
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
    if (!nivelId) {
      setError("Elige antes para qué nivel quieres generar");
      return;
    }
    if (!imagenReferenciaUrl) {
      setError("Elige antes una imagen de referencia");
      return;
    }
    setGenerando(true);
    setError(null);
    try {
      await generarPersonajeParaNivel(nivelId, imagenReferenciaUrl, promptOperario);
      onGenerado();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[var(--superficie)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--texto)]">Generar avatar</p>
        <button onClick={onCerrar} aria-label="Cerrar">
          <X size={18} className="text-[var(--texto-tenue)]" />
        </button>
      </div>

      <p className="mb-1.5 text-xs font-medium text-[var(--texto-secundario)]">¿Para qué nivel?</p>
      <div className="mb-3 flex flex-col gap-1.5">
        {nivelesDisponibles.map((n) => (
          <button
            key={n.nivelId}
            onClick={() => setNivelId(n.nivelId)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
              nivelId === n.nivelId
                ? "border-[var(--acento)] bg-[var(--superficie-alt)]"
                : "border-[var(--borde)]"
            }`}
          >
            <span className="font-medium text-[var(--texto)]">{n.nivelNombre}</span>
            <span className="text-xs text-[var(--texto-secundario)]">
              {n.generacionesRestantes}/3{n.yaGenerado ? " · regenerar" : ""}
            </span>
          </button>
        ))}
      </div>

      <input
        ref={inputArchivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) manejarArchivoElegido(archivo);
        }}
      />

      <button
        onClick={() => inputArchivoRef.current?.click()}
        disabled={subiendoImagen || !nivelId}
        className="mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--borde)] bg-[var(--superficie-alt)] disabled:opacity-50"
      >
        {previsualizacion ? (
          <img src={previsualizacion} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-[var(--texto-tenue)]">
            <ImagePlus size={24} aria-hidden />
            <span className="text-xs">{subiendoImagen ? "Subiendo..." : "Elige una foto de tu galería"}</span>
          </div>
        )}
      </button>

      <textarea
        value={promptOperario}
        onChange={(e) => setPromptOperario(e.target.value)}
        placeholder="Algo que quieras añadir (opcional)"
        className="mb-3 w-full rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 text-sm text-[var(--texto)]"
        rows={2}
      />

      <button
        onClick={manejarGenerar}
        disabled={generando || !imagenReferenciaUrl || !nivelId}
        className="w-full rounded-lg bg-[var(--acento)] py-2 text-sm font-medium text-[var(--acento-texto)] disabled:opacity-50"
      >
        {generando ? "Generando..." : "Generar mi avatar"}
      </button>

      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}