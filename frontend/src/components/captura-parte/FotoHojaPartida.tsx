import { useState } from "react";
import { FileCheck2, RotateCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SelectorFoto } from "../SelectorFoto";
import { AvisoGirarMovil } from "../AvisoGirarMovil";
import { useCamaraLive } from "../useCamaraLive";
import {
  cargarImagenDesdeArchivo,
  procesarFoto,
  cssAspectRatio,
  type ImagenProcesada,
} from "../../lib/captura-imagen";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { ocrParte, resolverCatalogo } from "../../lib/supabase-functions";
import {
  normalizarTexto,
  sugerirTonoSiguiente,
  esTonoCalibreValido,
  limpiarEntradaTonoCalibre,
  extraerModeloVisible,
  parsearNumeroEspanol,
} from "../../lib/normalizacion";
import { crearParteInicial, type DatosOcrHojaPartida, type LoteResuelto } from "../../lib/parte";

type Fase = "capturando" | "procesando" | "revisando" | "resolviendo" | "error";

interface FotoHojaPartidaProps {
  turnoId: string;
  lineaId: string;
  onResuelto: (lote: LoteResuelto, parteId: string) => void;
  onCancelar: () => void;
}

export function FotoHojaPartida({ turnoId, lineaId, onResuelto, onCancelar }: FotoHojaPartidaProps) {
  const { usuario } = useAuth();
  const [fase, setFase] = useState<Fase>("capturando");
  const [mensaje, setMensaje] = useState("");
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [urlCloudinary, setUrlCloudinary] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosOcrHojaPartida | null>(null);
  const [tono, setTono] = useState("");
  const [calibre, setCalibre] = useState("");
  const [tonoEsSugerencia, setTonoEsSugerencia] = useState(false);
  const [objetivoM2, setObjetivoM2] = useState<number | null>(null);

  const camaraActiva = fase === "capturando";
  const camara = useCamaraLive("hoja_partida", camaraActiva);

  async function manejarArchivo(archivo: File) {
    setFase("procesando");
    setMensaje("Recortando y convirtiendo a WebP...");
    try {
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFoto(img, "hoja_partida");
      await manejarFotoCapturada(procesada);
    } catch (err) {
      setFase("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function manejarFotoCapturada(procesada: ImagenProcesada) {
    setFase("procesando");
    setMensaje("Subiendo a Cloudinary...");
    try {
      setPrevisualizacion(URL.createObjectURL(procesada.blob));

      setMensaje(`Subiendo a Cloudinary (${(procesada.blob.size / 1024).toFixed(0)} KB)...`);
      const publicId = construirPublicId("HOJA", "hoja");
      const subida = await subirACloudinary(procesada.blob, publicId, "partes");
      setUrlCloudinary(subida.url);

      setMensaje("Leyendo con GPT...");
      const respuesta = await ocrParte("hoja_partida", [{ url: subida.url }]);
      const leido = respuesta.datos as unknown as DatosOcrHojaPartida;
      leido.modelo = extraerModeloVisible(leido.modelo);
      setDatos(leido);
      setObjetivoM2(parsearNumeroEspanol(leido.objetivo_m2_texto));

      const sugerencia = sugerirTonoSiguiente(leido.tono_ant);
      setTono(sugerencia ?? "");
      setTonoEsSugerencia(sugerencia !== null);
      setCalibre(leido.calibre ? limpiarEntradaTonoCalibre(leido.calibre) : "");

      setFase("revisando");
      setMensaje("");
    } catch (err) {
      setFase("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function manejarDisparo() {
    try {
      const procesada = await camara.disparar();
      await manejarFotoCapturada(procesada);
    } catch (err) {
      setFase("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  function actualizarCampo<K extends keyof DatosOcrHojaPartida>(campo: K, valor: DatosOcrHojaPartida[K]) {
    setDatos((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  function reintentarFoto() {
    setDatos(null);
    setPrevisualizacion(null);
    setUrlCloudinary(null);
    setFase("capturando");
    setMensaje("");
  }

  const tonoValido = tono.trim() !== "" && esTonoCalibreValido(tono);
  const calibreValido = calibre.trim() === "" || esTonoCalibreValido(calibre);
  const formularioValido =
    datos !== null &&
    datos.modelo.trim() !== "" &&
    datos.marca.trim() !== "" &&
    datos.formato.trim() !== "" &&
    datos.numero_orden.trim() !== "" &&
    tonoValido &&
    calibreValido;

  async function confirmarYResolver() {
    if (!datos || !usuario || !urlCloudinary || !formularioValido) return;
    setFase("resolviendo");
    setMensaje("Resolviendo modelo/marca/lote contra el catálogo...");
    try {
      const respuesta = await resolverCatalogo({
        modelo_texto: datos.modelo.trim(),
        marca_texto: datos.marca.trim(),
        formato_nombre: datos.formato.trim(),
        numero_orden: datos.numero_orden.trim(),
        acabado_codigo: datos.acabado_codigo,
        acabado_tipo: datos.acabado_tipo,
        acabado_nombre: datos.acabado_nombre,
        espesor_mm: datos.espesor_mm,
        tipo_palet: datos.tipo_palet,
        pza_caja: datos.pza_caja,
        objetivo_m2: objetivoM2,
        codbar_caja: datos.codbar_caja,
        codbar_pieza: datos.codbar_pieza,
        cod_upec: datos.cod_upec,
        codbar_saso: datos.codbar_saso,
        observaciones_material: datos.observaciones_material,
        observaciones_orden: datos.observaciones_orden,
      });

      const lote: LoteResuelto = {
        loteId: respuesta.lote_id,
        productoId: respuesta.producto_id,
        modeloId: respuesta.modelo_id,
        marcaId: respuesta.marca_id,
        loteCreado: respuesta.lote_creado,
        loteReabierto: respuesta.lote_reabierto,
        formatoNombre: datos.formato.trim(),
        numeroOrden: datos.numero_orden.trim(),
        tono: tono.trim(),
        calibre: calibre.trim(),
        marcaTextoNormalizado: normalizarTexto(datos.marca),
        modeloTextoNormalizado: normalizarTexto(datos.modelo),
        fotoHojaPartidaUrl: urlCloudinary,
      };

      setMensaje("Creando parte...");
      const parte = await crearParteInicial(turnoId, lineaId, usuario.id, lote);

      onResuelto(lote, parte.id);
    } catch (err) {
      setFase("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  if (fase === "capturando" || fase === "procesando") {
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-sm font-medium text-slate-600">Foto 1 — Hoja de partida</p>
        {!camaraActiva && <AvisoGirarMovil />}

        <div
          className="w-full overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200"
          style={{ aspectRatio: cssAspectRatio("hoja_partida") }}
        >
          {camaraActiva ? (
            camara.error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                <p className="text-sm text-red-600">{camara.error}</p>
              </div>
            ) : (
              <video
                ref={camara.videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full bg-black object-cover"
              />
            )
          ) : previsualizacion ? (
            <img src={previsualizacion} alt="Previsualización" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Encuadra la hoja completa
            </div>
          )}
        </div>

        <div className="mt-4">
        <SelectorFoto
          onArchivoSeleccionado={manejarArchivo}
          onDisparar={manejarDisparo}
          disabledCamara={fase === "procesando" || camara.cargando || !!camara.error}
          disabledGaleria={fase === "procesando"}
        />
        </div>

        {mensaje && <p className="mt-3 text-sm text-slate-600">{mensaje}</p>}
        <button type="button" onClick={onCancelar} className="mt-4 w-full text-center text-sm text-slate-400 underline">
          Cancelar
        </button>
      </div>
    );
  }

  if (fase === "error") {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-sm text-red-600">{mensaje}</p>
        <button
          type="button"
          onClick={reintentarFoto}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          <RotateCcw size={16} aria-hidden />
          Repetir foto
        </button>
      </div>
    );
  }

  if (!datos) return null;

  return (
    <div className="mx-auto max-w-md pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">Revisa los datos leídos</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            datos.confianza === "alta"
              ? "bg-emerald-100 text-emerald-700"
              : datos.confianza === "media"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          Confianza {datos.confianza}
        </span>
      </div>

      <button type="button" onClick={reintentarFoto} className="mb-4 flex items-center gap-1 text-xs text-slate-400 underline">
        <RotateCcw size={12} aria-hidden />
        Repetir foto
      </button>

      <CampoTexto etiqueta="Modelo" valor={datos.modelo} onChange={(v) => actualizarCampo("modelo", v)} requerido />
      <CampoTexto etiqueta="Marca" valor={datos.marca} onChange={(v) => actualizarCampo("marca", v)} requerido />
      <CampoTexto etiqueta="Formato" valor={datos.formato} onChange={(v) => actualizarCampo("formato", v)} requerido />
      <CampoTexto etiqueta="Nº de orden" valor={datos.numero_orden} onChange={(v) => actualizarCampo("numero_orden", v)} requerido />

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-slate-600">
          Tono {tonoEsSugerencia && <span className="text-xs font-normal text-amber-600">(sugerido: tono_ant + 1)</span>}
        </label>
        <input
          value={tono}
          onChange={(e) => {
            setTono(limpiarEntradaTonoCalibre(e.target.value));
            setTonoEsSugerencia(false);
          }}
          className={`w-full rounded-lg border p-2 text-sm ${tonoValido ? "border-slate-300" : "border-red-400"}`}
          placeholder="ej. M10"
        />
        {!tonoValido && <p className="mt-1 text-xs text-red-600">Requerido — solo mayúsculas y números, sin espacios.</p>}
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-slate-600">Calibre</label>
        <input
          value={calibre}
          onChange={(e) => setCalibre(limpiarEntradaTonoCalibre(e.target.value))}
          className={`w-full rounded-lg border p-2 text-sm ${calibreValido ? "border-slate-300" : "border-red-400"}`}
          placeholder="opcional"
        />
      </div>

      <CampoTexto etiqueta="Acabado — código" valor={datos.acabado_codigo ?? ""} onChange={(v) => actualizarCampo("acabado_codigo", v || null)} />
      <CampoTexto etiqueta="Acabado — tipo" valor={datos.acabado_tipo ?? ""} onChange={(v) => actualizarCampo("acabado_tipo", v || null)} />
      <CampoTexto etiqueta="Acabado — nombre" valor={datos.acabado_nombre ?? ""} onChange={(v) => actualizarCampo("acabado_nombre", v || null)} />
      <CampoNumerico etiqueta="Espesor (mm)" valor={datos.espesor_mm} onChange={(v) => actualizarCampo("espesor_mm", v)} />
      <CampoTexto etiqueta="Tipo de palet" valor={datos.tipo_palet ?? ""} onChange={(v) => actualizarCampo("tipo_palet", v || null)} />
      <CampoNumerico etiqueta="Piezas por caja" valor={datos.pza_caja} onChange={(v) => actualizarCampo("pza_caja", v)} />
      <CampoNumerico etiqueta="Objetivo (m²)" valor={objetivoM2} onChange={setObjetivoM2} />
      <CampoTexto etiqueta="Cód. barras caja" valor={datos.codbar_caja ?? ""} onChange={(v) => actualizarCampo("codbar_caja", v || null)} />
      <CampoTexto etiqueta="Cód. barras pieza" valor={datos.codbar_pieza ?? ""} onChange={(v) => actualizarCampo("codbar_pieza", v || null)} />
      <CampoTexto etiqueta="Cód. UPEC" valor={datos.cod_upec ?? ""} onChange={(v) => actualizarCampo("cod_upec", v || null)} />
      <CampoTexto etiqueta="Cód. SASO" valor={datos.codbar_saso ?? ""} onChange={(v) => actualizarCampo("codbar_saso", v || null)} />
      <CampoTexto etiqueta="Observaciones material" valor={datos.observaciones_material ?? ""} onChange={(v) => actualizarCampo("observaciones_material", v || null)} multilinea />
      <CampoTexto etiqueta="Observaciones orden" valor={datos.observaciones_orden ?? ""} onChange={(v) => actualizarCampo("observaciones_orden", v || null)} multilinea />

      {mensaje && <p className="mt-2 text-sm text-red-600">{mensaje}</p>}

      <button
        type="button"
        disabled={!formularioValido || fase === "resolviendo"}
        onClick={confirmarYResolver}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        <FileCheck2 size={20} aria-hidden />
        {fase === "resolviendo" ? "Creando parte..." : "Confirmar y crear parte"}
      </button>
    </div>
  );
}

function CampoTexto({
  etiqueta,
  valor,
  onChange,
  requerido = false,
  multilinea = false,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  requerido?: boolean;
  multilinea?: boolean;
}) {
  const vacio = requerido && valor.trim() === "";
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-slate-600">{etiqueta}</label>
      {multilinea ? (
        <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
      ) : (
        <input value={valor} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-lg border p-2 text-sm ${vacio ? "border-red-400" : "border-slate-300"}`} />
      )}
    </div>
  );
}

function CampoNumerico({ etiqueta, valor, onChange }: { etiqueta: string; valor: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-slate-600">{etiqueta}</label>
      <input
        type="number"
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-lg border border-slate-300 p-2 text-sm"
      />
    </div>
  );
}