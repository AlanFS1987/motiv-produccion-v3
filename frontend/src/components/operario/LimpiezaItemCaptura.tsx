import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Camera, RotateCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { marcarItemChecklist, ItemYaMarcadoError, type ChecklistItemEstado } from "../../lib/operario";
import { cargarImagenDesdeArchivo, procesarFoto, cssAspectRatio, type FormaFoto } from "../../lib/captura-imagen";

type Paso = "antes" | "subiendo_antes" | "despues" | "guardando" | "error" | "ya_marcado";

interface LimpiezaItemCapturaProps {
  turnoId: string;
  lineaId: string;
  item: ChecklistItemEstado;
  onGuardado: () => void;
  onYaMarcado: () => void;
  onCancelar: () => void;
}

/**
 * Foto de "antes" → limpieza → foto de "después" → guarda, suma el
 * punto (03-rol-operario.md 5.9). Ambas fotos obligatorias.
 *
 * Sin selector de galería a propósito (5.9a: "las fotos se toman con
 * la cámara integrada de la propia app, sin selector de elegir
 * archivo") — a diferencia del resto de fotos de la app, aquí NO se
 * usa <SelectorFoto> (que sí ofrece galería).
 *
 * VUELTA A CÁMARA NATIVA (sesión 28/08/2026): sustituye la cámara en
 * vivo (useCamaraLive) por <input type="file" capture="environment">
 * — sigue forzando la cámara trasera y sigue sin ofrecer galería,
 * solo cambia el mecanismo de disparo.
 */
export function LimpiezaItemCaptura({ turnoId, lineaId, item, onGuardado, onYaMarcado, onCancelar }: LimpiezaItemCapturaProps) {
  const { usuario } = useAuth();
  const [paso, setPaso] = useState<Paso>("antes");
  const [mensaje, setMensaje] = useState("");
  const [previsualizacionAntes, setPrevisualizacionAntes] = useState<string | null>(null);
  const [previsualizacionDespues, setPrevisualizacionDespues] = useState<string | null>(null);
  const [urlAntes, setUrlAntes] = useState<string | null>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  // "limpieza" — ver nota de integración en lib/captura-imagen.ts.
  const forma: FormaFoto = "limpieza";

  async function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    setMensaje("Subiendo foto...");
    try {
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFoto(img, forma);
      const previsualizacion = URL.createObjectURL(procesada.blob);

      if (paso === "antes") {
        setPrevisualizacionAntes(previsualizacion);
        setPaso("subiendo_antes");
        const publicId = construirPublicId(item.nombre.slice(0, 20), "antes");
        const subida = await subirACloudinary(procesada.blob, publicId, "limpieza");
        setUrlAntes(subida.url);
        setPaso("despues");
        setMensaje("");
      } else {
        setPrevisualizacionDespues(previsualizacion);
        setPaso("guardando");
        const publicId = construirPublicId(item.nombre.slice(0, 20), "despues");
        const subida = await subirACloudinary(procesada.blob, publicId, "limpieza");
        await guardar(urlAntes!, subida.url);
      }
    } catch (err) {
      setPaso("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function guardar(urlAntesFinal: string, urlDespuesFinal: string) {
    if (!usuario) return;
    try {
      await marcarItemChecklist(turnoId, lineaId, item.id, usuario.id, [urlAntesFinal], [urlDespuesFinal]);
      onGuardado();
    } catch (err) {
      if (err instanceof ItemYaMarcadoError) {
        setMensaje(err.message);
        setPaso("ya_marcado");
      } else {
        setPaso("error");
        setMensaje(err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (paso === "ya_marcado") {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-sm text-amber-700">{mensaje}</p>
        <button type="button" onClick={onYaMarcado} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Volver a la lista
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
          onClick={() => {
            setPaso("antes");
            setMensaje("");
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          <RotateCcw size={16} aria-hidden />
          Reintentar
        </button>
      </div>
    );
  }

  const etiqueta = paso === "antes" || paso === "subiendo_antes" ? "Foto de ANTES" : "Foto de DESPUÉS";
  const previsualizacion = paso === "antes" || paso === "subiendo_antes" ? previsualizacionAntes : previsualizacionDespues;
  const subiendo = paso === "subiendo_antes" || paso === "guardando";

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onCancelar} className="text-slate-400" aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-medium text-slate-600">{item.nombre}</p>
      </div>

      <p className="mb-3 text-sm font-medium text-slate-700">{etiqueta}</p>

      <div className="w-full overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200" style={{ aspectRatio: cssAspectRatio(forma) }}>
        {previsualizacion ? (
          <img src={previsualizacion} alt="Previsualización" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Encuadra la línea</div>
        )}
      </div>

      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={manejarArchivo}
      />
      <button
        type="button"
        disabled={subiendo}
        onClick={() => inputCamaraRef.current?.click()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        <Camera size={20} aria-hidden />
        {subiendo ? "Subiendo..." : "Hacer foto"}
      </button>

      {mensaje && <p className="mt-3 text-sm text-slate-600">{mensaje}</p>}
      <button type="button" onClick={onCancelar} className="mt-4 w-full text-center text-sm text-slate-400 underline">
        Cancelar
      </button>
    </div>
  );
}