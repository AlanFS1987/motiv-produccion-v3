import { useEffect, useRef, useState } from "react";
import { FileCheck2, RotateCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SelectorFoto } from "../SelectorFoto";
import {
  cargarImagenDesdeArchivo,
  procesarFotoLibre,
  blobABase64,
  type ImagenProcesada,
} from "../../lib/captura-imagen";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { ocrParte, resolverCatalogo } from "../../lib/supabase-functions";
import {
  normalizarTexto,
  normalizarFormato,
  sugerirTonoSiguiente,
  esTonoCalibreValido,
  limpiarEntradaTonoCalibre,
  extraerModeloVisible,
} from "../../lib/normalizacion";
import {
  modeloDeProgramacion,
  normalizarNumeroOrden,
  normalizarObjetivoM2,
  textoCorreccionObjetivo,
} from "../../lib/validar-orden";
import { cruzarOrden } from "../../lib/cruce-orden";
import { evaluarCruce, type CruceOrden } from "../../lib/cruce-orden-logica";
import { crearParteInicial, type DatosOcrHojaPartida, type LoteResuelto } from "../../lib/parte";

type Fase = "capturando" | "procesando" | "revisando" | "resolviendo" | "error";

// La hoja de partida es un A4 VERTICAL: se fotografía con la hoja en vertical y la cabecera
// arriba. Por eso esta pantalla NO usa AvisoGirarMovil (que pide girar el móvil en horizontal,
// correcto para caja y pantalla pero no para la hoja: al obedecerlo se fotografiaba la hoja de
// lado, el texto salía vertical y el OCR leía mal, p. ej. el nº de orden 1117222 como 11172222).
const PROPORCION_A4_VERTICAL = "210 / 297";

// Alto máximo del recuadro: 55 % del alto de pantalla, pero dejando sitio (~31 rem) para lo demás
// —cabecera y pestañas de la app (~7 rem), título y aviso (~7 rem), botones «Hacer foto» /
// «Elegir de galería» y «Cancelar» (~6 rem), barras del navegador y del sistema del móvil
// (~7 rem) y margen— para que los botones se vean sin desplazarse en móviles de 360x800 y
// 390x844. Mínimo 12 rem para que no quede ridículamente pequeño. (La cámara es la nativa: el
// recuadro es solo una guía de cómo colocar la hoja, no un visor.)
const ALTO_MAXIMO_MARCO = "min(55vh, max(12rem, calc(100vh - 31rem)))";

/** Aviso SIEMPRE visible (no depende de cómo tenga el móvil): hoja en vertical, cabecera arriba. */
function AvisoHojaVertical() {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
      <svg viewBox="0 0 84 72" className="h-14 w-16 shrink-0" aria-hidden>
        {/* folio vertical con la cabecera arriba */}
        <rect x="6" y="8" width="34" height="56" rx="2" fill="#ffffff" stroke="#92400e" strokeWidth="2" />
        <rect x="11" y="13" width="24" height="9" rx="1" fill="#f59e0b" />
        <line x1="11" y1="30" x2="35" y2="30" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="11" y1="37" x2="35" y2="37" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="11" y1="44" x2="35" y2="44" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="11" y1="51" x2="28" y2="51" stroke="#cbd5e1" strokeWidth="2" />
        {/* flecha hacia arriba + ARRIBA */}
        <line x1="62" y1="62" x2="62" y2="22" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
        <polyline points="53,31 62,20 71,31" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="62" y="13" textAnchor="middle" fontSize="10" fontWeight="700" fill="#92400e">
          ARRIBA
        </text>
      </svg>
      <p>
        <strong>Pon la hoja en vertical, con la cabecera arriba.</strong> El texto tiene que leerse recto.
      </p>
    </div>
  );
}

interface FotoHojaPartidaProps {
  turnoId: string;
  lineaId: string;
  /** responsable_id del parte nuevo; por defecto, el usuario de la sesión (ver CapturaParteScreen.responsableIdOverride). */
  responsableId?: string;
  onResuelto: (lote: LoteResuelto, parteId: string) => void;
  onCancelar: () => void;
}

export function FotoHojaPartida({ turnoId, lineaId, responsableId, onResuelto, onCancelar }: FotoHojaPartidaProps) {
  const { usuario } = useAuth();
  const [fase, setFase] = useState<Fase>("capturando");
  const [mensaje, setMensaje] = useState("");
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [urlCloudinary, setUrlCloudinary] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosOcrHojaPartida | null>(null);
  const [tono, setTono] = useState("");
  const [calibre, setCalibre] = useState("");
  const [tonoEsSugerencia, setTonoEsSugerencia] = useState(false);
  // Nº de orden y objetivo se editan como TEXTO; el valor normalizado se deriva (ver lib/validar-orden).
  const [ordenTexto, setOrdenTexto] = useState("");
  const [objetivoTexto, setObjetivoTexto] = useState("");
  const [cruce, setCruce] = useState<{ orden: string; datos: CruceOrden | null } | null>(null);
  const ordenRef = useRef<HTMLInputElement>(null);

  const orden = normalizarNumeroOrden(ordenTexto);
  const objetivo = normalizarObjetivoM2(objetivoTexto);

  // Cruce con lotes y programación cada vez que el Nº de orden es válido. Si falla, no bloquea.
  useEffect(() => {
    const valor = orden.valor;
    if (fase !== "revisando" || !valor) return;
    let cancelado = false;
    cruzarOrden(valor)
      .then((datosCruce) => !cancelado && setCruce({ orden: valor, datos: datosCruce }))
      .catch(() => !cancelado && setCruce({ orden: valor, datos: null }));
    return () => {
      cancelado = true;
    };
  }, [orden.valor, fase]);

  async function manejarArchivo(archivo: File) {
    setFase("procesando");
    setMensaje("Redimensionando y convirtiendo a WebP...");
    try {
      const img = await cargarImagenDesdeArchivo(archivo);
      const procesada = await procesarFotoLibre(img);
      await manejarFotoCapturada(procesada);
    } catch (err) {
      setFase("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  async function manejarFotoCapturada(procesada: ImagenProcesada) {
    setFase("procesando");
    setMensaje("Subiendo y leyendo en paralelo...");
    try {
      setPrevisualizacion(URL.createObjectURL(procesada.blob));

      const publicId = construirPublicId("HOJA", "hoja");
      const base64 = await blobABase64(procesada.blob);

      // Antes: await subirACloudinary(...) y LUEGO await ocrParte(...)
      // con la URL resultante — el OCR esperaba innecesariamente a
      // que Cloudinary terminara. Ahora van en paralelo: el OCR usa
      // el base64 directamente (ya lo soportaba el backend), sin
      // depender de la URL de Cloudinary, que solo hace falta para
      // guardar la referencia de la foto.
      const [subida, respuesta] = await Promise.all([
        subirACloudinary(procesada.blob, publicId, "partes"),
        ocrParte("hoja_partida", [{ base64, mediaType: procesada.mediaType }]),
      ]);
      setUrlCloudinary(subida.url);

      const leido = respuesta.datos as unknown as DatosOcrHojaPartida;
      leido.modelo = extraerModeloVisible(leido.modelo);
      setDatos(leido);
      setOrdenTexto(leido.numero_orden ?? "");
      setObjetivoTexto(leido.objetivo_m2_texto ?? "");
      setCruce(null);

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
  const cruceActual = cruce && cruce.orden === orden.valor ? cruce.datos : null;
  const cruceCargando = orden.valor !== null && (cruce === null || cruce.orden !== orden.valor);
  const evaluacion = evaluarCruce(
    cruceActual,
    { modelo: datos?.modelo ?? "", marca: datos?.marca ?? "", formato: datos?.formato ?? "" },
    normalizarFormato,
  );
  const formularioValido =
    datos !== null &&
    orden.valor !== null &&
    (evaluacion.objetivoSoloLectura || objetivo.valor !== null) &&
    !cruceCargando &&
    !evaluacion.bloquea &&
    datos.modelo.trim() !== "" &&
    datos.marca.trim() !== "" &&
    datos.formato.trim() !== "" &&
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
        formato_alternativo_texto: datos.formato_alternativo_texto ?? null,
        numero_orden: orden.valor!,
        acabado_codigo: datos.acabado_codigo,
        acabado_tipo: datos.acabado_tipo,
        acabado_nombre: datos.acabado_nombre,
        espesor_mm: datos.espesor_mm,
        tipo_palet: datos.tipo_palet,
        pza_caja: datos.pza_caja,
        // Si el lote existe, resolver-catalogo usa el del lote y no exige este valor.
        objetivo_m2: evaluacion.objetivoSoloLectura ? null : objetivo.valor,
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
        numeroOrden: orden.valor!,
        tono: tono.trim(),
        calibre: calibre.trim(),
        marcaTextoNormalizado: normalizarTexto(datos.marca),
        modeloTextoNormalizado: normalizarTexto(datos.modelo),
        fotoHojaPartidaUrl: urlCloudinary,
      };

      setMensaje("Creando parte...");
      const parte = await crearParteInicial(turnoId, lineaId, responsableId ?? usuario.id, lote);

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
        <AvisoHojaVertical />

        {previsualizacion ? (
          // Con foto: se enseña ENTERA y con su proporción real (vertical o apaisada), sin recortar
          // ni forzar el marco vertical.
          <div className="mx-auto w-fit max-w-full overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200">
            <img
              src={previsualizacion}
              alt="Previsualización de la hoja"
              className="block h-auto w-auto max-w-full object-contain"
              style={{ maxHeight: ALTO_MAXIMO_MARCO }}
            />
          </div>
        ) : (
          // Sin foto: recuadro VERTICAL con proporción A4, centrado y con altura máxima.
          <div
            className="mx-auto flex items-center justify-center overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200"
            style={{
              aspectRatio: PROPORCION_A4_VERTICAL,
              width: `min(100%, calc(${ALTO_MAXIMO_MARCO} * 210 / 297))`,
            }}
          >
            <span className="px-2 text-center text-sm text-slate-400">Encuadra la hoja completa</span>
          </div>
        )}

        <div className="mt-4">
          <SelectorFoto onArchivoSeleccionado={manejarArchivo} disabledCamara={fase === "procesando"} disabledGaleria={fase === "procesando"} />
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
        <button type="button" onClick={reintentarFoto} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
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
            datos.confianza === "alta" ? "bg-emerald-100 text-emerald-700" : datos.confianza === "media" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
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
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-slate-600">Nº de orden</label>
        <input
          ref={ordenRef}
          value={ordenTexto}
          onChange={(e) => setOrdenTexto(e.target.value)}
          inputMode="numeric"
          className={`w-full rounded-lg border p-2 text-sm ${orden.error ? "border-red-400" : orden.corregido ? "border-amber-400" : "border-slate-300"}`}
        />
        {orden.error && <p className="mt-1 text-xs text-red-600">{orden.error}</p>}
        {orden.valor && orden.corregido && (
          <p className="mt-1 text-xs text-amber-700">Corregido de «{orden.original}» a {orden.valor}</p>
        )}
        {evaluacion.programacionModelo && (
          <p className={`mt-1 text-xs ${evaluacion.programacionDistinta ? "text-amber-700" : "text-slate-500"}`}>
            En programación: {modeloDeProgramacion(evaluacion.programacionModelo)}
            {evaluacion.programacionDistinta && ` — no coincide con el modelo leído (${datos.modelo})`}
          </p>
        )}
        {evaluacion.sugerencias.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-amber-700">
            {evaluacion.sugerencias.map((p) => (
              <button
                key={`${p.origen}-${p.numero_orden}`}
                type="button"
                onClick={() => setOrdenTexto(p.numero_orden)}
                className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 font-medium"
              >
                ¿{p.numero_orden}?
              </button>
            ))}
          </div>
        )}
        {evaluacion.modeloLoteDistinto && (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              Esta orden ya existe como {evaluacion.modeloLoteDistinto} y has leído {datos.modelo}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => actualizarCampo("modelo", evaluacion.modeloLoteDistinto!)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Usar la orden existente
              </button>
              <button
                type="button"
                onClick={() => {
                  ordenRef.current?.focus();
                  ordenRef.current?.select();
                }}
                className="rounded-lg border border-slate-400 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                Corregir el número
              </button>
            </div>
          </div>
        )}
      </div>

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
        <input value={calibre} onChange={(e) => setCalibre(limpiarEntradaTonoCalibre(e.target.value))} className={`w-full rounded-lg border p-2 text-sm ${calibreValido ? "border-slate-300" : "border-red-400"}`} placeholder="opcional" />
      </div>

      <CampoTexto etiqueta="Acabado — código" valor={datos.acabado_codigo ?? ""} onChange={(v) => actualizarCampo("acabado_codigo", v || null)} />
      <CampoTexto etiqueta="Acabado — tipo" valor={datos.acabado_tipo ?? ""} onChange={(v) => actualizarCampo("acabado_tipo", v || null)} />
      <CampoTexto etiqueta="Acabado — nombre" valor={datos.acabado_nombre ?? ""} onChange={(v) => actualizarCampo("acabado_nombre", v || null)} />
      <CampoNumerico etiqueta="Espesor (mm)" valor={datos.espesor_mm} onChange={(v) => actualizarCampo("espesor_mm", v)} />
      <CampoTexto etiqueta="Tipo de palet" valor={datos.tipo_palet ?? ""} onChange={(v) => actualizarCampo("tipo_palet", v || null)} />
      <CampoNumerico etiqueta="Piezas por caja" valor={datos.pza_caja} onChange={(v) => actualizarCampo("pza_caja", v)} />
      {evaluacion.objetivoSoloLectura ? (
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-600">Objetivo (m²)</label>
          <input
            readOnly
            value={evaluacion.objetivoLote ?? "—"}
            className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-500">Valor del lote existente (no se modifica).</p>
        </div>
      ) : (
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-600">Objetivo (m²)</label>
          <input
            value={objetivoTexto}
            onChange={(e) => setObjetivoTexto(e.target.value)}
            inputMode="numeric"
            className={`w-full rounded-lg border p-2 text-sm ${objetivo.error ? "border-red-400" : objetivo.corregido ? "border-amber-400" : "border-slate-300"}`}
          />
          {objetivo.error && <p className="mt-1 text-xs text-red-600">{objetivo.error}</p>}
          {objetivo.valor !== null && objetivo.corregido && (
            <p className="mt-1 text-xs text-amber-700">{textoCorreccionObjetivo(objetivo.original, objetivo.valor)}</p>
          )}
        </div>
      )}
      <CampoTexto etiqueta="Cód. barras caja" valor={datos.codbar_caja ?? ""} onChange={(v) => actualizarCampo("codbar_caja", v || null)} />
      <CampoTexto etiqueta="Cód. barras pieza" valor={datos.codbar_pieza ?? ""} onChange={(v) => actualizarCampo("codbar_pieza", v || null)} />
      <CampoTexto etiqueta="Cód. UPEC" valor={datos.cod_upec ?? ""} onChange={(v) => actualizarCampo("cod_upec", v || null)} />
      <CampoTexto etiqueta="Cód. SASO" valor={datos.codbar_saso ?? ""} onChange={(v) => actualizarCampo("codbar_saso", v || null)} />
      <CampoTexto etiqueta="Observaciones material" valor={datos.observaciones_material ?? ""} onChange={(v) => actualizarCampo("observaciones_material", v || null)} multilinea />
      <CampoTexto etiqueta="Observaciones orden" valor={datos.observaciones_orden ?? ""} onChange={(v) => actualizarCampo("observaciones_orden", v || null)} multilinea />

      {mensaje && <p className="mt-2 text-sm text-red-600">{mensaje}</p>}

      <button type="button" disabled={!formularioValido || fase === "resolviendo"} onClick={confirmarYResolver} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40">
        <FileCheck2 size={20} aria-hidden />
        {fase === "resolviendo" ? "Creando parte..." : "Confirmar y crear parte"}
      </button>
    </div>
  );
}

function CampoTexto({ etiqueta, valor, onChange, requerido = false, multilinea = false }: { etiqueta: string; valor: string; onChange: (v: string) => void; requerido?: boolean; multilinea?: boolean }) {
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
      <input type="number" value={valor ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
    </div>
  );
}