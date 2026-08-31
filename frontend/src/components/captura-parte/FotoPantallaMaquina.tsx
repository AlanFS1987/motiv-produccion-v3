import { useMemo, useState } from "react";
import { Save, RotateCcw, AlertTriangle } from "lucide-react";
import { SelectorFoto } from "../SelectorFoto";
import { AvisoGirarMovil } from "../AvisoGirarMovil";
import {
  cargarImagenDesdeArchivo,
  procesarFotoLibre,
  cssAspectRatio,
  blobABase64,
  type ImagenProcesada,
} from "../../lib/captura-imagen";
import { subirACloudinary, construirPublicId } from "../../lib/cloudinary";
import { ocrParte } from "../../lib/supabase-functions";
import { completarParte, corregirParte, type DatosOcrPantalla, type ParteDetalle } from "../../lib/parte";
import { validarParte, calcularCalibrePct } from "../../lib/validaciones-parte";
import { esTonoCalibreValido, limpiarEntradaTonoCalibre } from "../../lib/normalizacion";

type Fase = "capturando" | "procesando" | "revisando" | "guardando" | "error";

type FotoPantallaMaquinaProps =
  | {
      modo: "completar";
      parteId: string;
      tono: string;
      onGuardado: () => void;
      onCancelar: () => void;
    }
  | {
      modo: "corregir";
      parteOriginalId: string;
      contexto: { turnoId: string; lineaId: string; loteId: string; responsableId: string };
      valoresIniciales: ParteDetalle;
      onGuardado: () => void;
      onCancelar: () => void;
    };

const CAMPOS_PIEZAS = [
  ["piezas_1a", "1ª calidad (TOTAL STD)"],
  ["piezas_comercial", "Comercial (COM)"],
  ["piezas_eco", "Eco"],
  ["piezas_descuadre_com", "Descuadre comercial"],
  ["piezas_planar_com", "Planar comercial"],
  ["piezas_contenedor", "Contenedor"],
  ["piezas_entradas", "Piezas entradas"],
] as const;

const CAMPOS_CALIBRE = ["cal_1", "cal_2", "cal_3", "cal_4", "cal_5", "cal_6", "cal_7", "cal_8"] as const;

const CAMPOS_MINUTOS = [
  ["minutos_total", "Minutos total"],
  ["minutos_plena", "Plena producción"],
  ["minutos_no_alimentada", "No alimentada"],
  ["minutos_saturacion", "Saturación"],
  ["minutos_banco", "Inhabilita banco"],
  ["minutos_maquina", "Inhabilita máquina"],
] as const;

function detalleADatosOcr(d: ParteDetalle): DatosOcrPantalla {
  return {
    piezas_1a: d.piezas1a,
    piezas_comercial: d.piezasComercial,
    piezas_eco: d.piezasEco,
    piezas_descuadre_com: d.piezasDescuadreCom,
    piezas_planar_com: d.piezasPlanarCom,
    piezas_contenedor: d.piezasContenedor,
    cal_1: d.cal1,
    cal_2: d.cal2,
    cal_3: d.cal3,
    cal_4: d.cal4,
    cal_5: d.cal5,
    cal_6: d.cal6,
    cal_7: d.cal7,
    cal_8: d.cal8,
    piezas_entradas: d.piezasEntradas,
    minutos_total: d.minutosTotal,
    minutos_plena: d.minutosPlena,
    minutos_no_alimentada: d.minutosNoAlimentada,
    minutos_saturacion: d.minutosSaturacion,
    minutos_banco: d.minutosBanco,
    minutos_maquina: d.minutosMaquina,
    hora_captura_pantalla: d.horaCapturaPantalla,
    confianza: "alta",
  };
}

function intentarParsearFechaHora(valor: string | null): Date | null {
  if (!valor || valor.trim() === "") return null;
  const iso = new Date(valor);
  if (!isNaN(iso.getTime())) return iso;
  const m = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(valor.trim());
  if (m) {
    const [, dd, mm, yyyy, hh, min, ss] = m;
    const year = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy);
    const fecha = new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min), ss ? Number(ss) : 0);
    if (!isNaN(fecha.getTime())) return fecha;
  }
  return null;
}

function aValorDatetimeLocal(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

export function FotoPantallaMaquina(props: FotoPantallaMaquinaProps) {
  const esCorreccion = props.modo === "corregir";
  const tonoParaArchivo = esCorreccion ? props.valoresIniciales.tono : props.tono;

  const [fase, setFase] = useState<Fase>(esCorreccion ? "revisando" : "capturando");
  const [mensaje, setMensaje] = useState("");
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosOcrPantalla | null>(
    esCorreccion ? detalleADatosOcr(props.valoresIniciales) : null,
  );
  const [horaTextoCrudo, setHoraTextoCrudo] = useState<string | null>(
    esCorreccion ? props.valoresIniciales.horaCapturaPantalla : null,
  );
  const [horaLocal, setHoraLocal] = useState(() => {
    if (!esCorreccion) return "";
    const fecha = intentarParsearFechaHora(props.valoresIniciales.horaCapturaPantalla);
    return fecha ? aValorDatetimeLocal(fecha) : "";
  });
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [tonoEditado, setTonoEditado] = useState(esCorreccion ? props.valoresIniciales.tono : "");
  const [calibreEditado, setCalibreEditado] = useState(esCorreccion ? (props.valoresIniciales.calibre ?? "") : "");

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

      const publicId = construirPublicId(tonoParaArchivo, "pantalla");
      const base64 = await blobABase64(procesada.blob);

      // Igual que en FotoHojaPartida: el OCR ya no espera a que
      // termine la subida a Cloudinary — usa el base64 directamente
      // y ambas llamadas van en paralelo.
      const [, respuesta] = await Promise.all([
        subirACloudinary(procesada.blob, publicId, "partes"),
        ocrParte("pantalla", [{ base64, mediaType: procesada.mediaType }]),
      ]);
      // Nota: si en algún sitio de este componente se usa la URL de
      // Cloudinary de Pantalla (no se ha visto en los fragmentos
      // revisados), guarda el primer resultado del Promise.all en una
      // variable en vez de descartarlo con la coma — revísalo contra
      // tu archivo real antes de aplicar.

      const leido = respuesta.datos as unknown as DatosOcrPantalla;
      setDatos(leido);
      setHoraTextoCrudo(leido.hora_captura_pantalla);

      const fechaParseada = intentarParsearFechaHora(leido.hora_captura_pantalla);
      setHoraLocal(fechaParseada ? aValorDatetimeLocal(fechaParseada) : "");

      setFase("revisando");
      setMensaje("");
    } catch (err) {
      setFase("error");
      setMensaje(err instanceof Error ? err.message : String(err));
    }
  }

  function reintentarFoto() {
    setDatos(null);
    setPrevisualizacion(null);
    setFase("capturando");
    setMensaje("");
  }

  function actualizarNumero(campo: keyof DatosOcrPantalla, valor: number) {
    setDatos((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  const validacion = useMemo(() => {
    if (!datos) return null;
    return validarParte({
      piezas_1a: datos.piezas_1a,
      piezas_comercial: datos.piezas_comercial,
      piezas_eco: datos.piezas_eco,
      piezas_contenedor: datos.piezas_contenedor,
      piezas_entradas: datos.piezas_entradas,
      minutos_total: datos.minutos_total,
      minutos_plena: datos.minutos_plena,
      minutos_no_alimentada: datos.minutos_no_alimentada,
      minutos_saturacion: datos.minutos_saturacion,
      minutos_banco: datos.minutos_banco,
      minutos_maquina: datos.minutos_maquina,
    });
  }, [datos]);

  async function guardar() {
    if (!datos || !validacion?.puedeGuardar) return;
    setFase("guardando");
    setErrorGuardado(null);
    try {
      const { calibreComPct } = calcularCalibrePct(datos.piezas_descuadre_com, datos.piezas_entradas);
      const horaCapturaPantallaIso = horaLocal ? new Date(horaLocal).toISOString() : null;

      if (props.modo === "completar") {
        await completarParte({
          parteId: props.parteId,
          datosPantalla: datos,
          horaCapturaPantallaIso,
          horaCapturaPantallaTextoCrudo: horaTextoCrudo,
          calibreComPct,
          calibreStdPct: null,
        });
      } else {
        await corregirParte(props.parteOriginalId, props.contexto, {
          tono: tonoEditado,
          calibre: calibreEditado || null,
          verificacionCajaEstado: props.valoresIniciales.verificacionCajaEstado,
          piezas1a: datos.piezas_1a,
          piezasComercial: datos.piezas_comercial,
          piezasEco: datos.piezas_eco,
          piezasDescuadreCom: datos.piezas_descuadre_com,
          piezasPlanarCom: datos.piezas_planar_com,
          piezasContenedor: datos.piezas_contenedor,
          piezasEntradas: datos.piezas_entradas,
          cal1: datos.cal_1,
          cal2: datos.cal_2,
          cal3: datos.cal_3,
          cal4: datos.cal_4,
          cal5: datos.cal_5,
          cal6: datos.cal_6,
          cal7: datos.cal_7,
          cal8: datos.cal_8,
          minutosTotal: datos.minutos_total,
          minutosPlena: datos.minutos_plena,
          minutosNoAlimentada: datos.minutos_no_alimentada,
          minutosSaturacion: datos.minutos_saturacion,
          minutosBanco: datos.minutos_banco,
          minutosMaquina: datos.minutos_maquina,
          horaCapturaPantallaIso,
          horaCapturaPantallaTextoCrudo: horaTextoCrudo,
          calibreComPct,
        });
      }

      props.onGuardado();
    } catch (err) {
      setFase("revisando");
      setErrorGuardado(err instanceof Error ? err.message : String(err));
    }
  }

  if (fase === "capturando" || fase === "procesando") {
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-sm font-medium text-slate-600">Foto — Pantalla de la máquina</p>
        <AvisoGirarMovil />
        <div
          className="w-full overflow-hidden rounded-lg border-4 border-dashed border-amber-500 bg-slate-200"
          style={{ aspectRatio: cssAspectRatio("pantalla") }}
        >
          {previsualizacion ? (
            <img src={previsualizacion} alt="Previsualización" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Encuadra la pantalla completa
            </div>
          )}
        </div>
        <div className="mt-4">
          <SelectorFoto
            onArchivoSeleccionado={manejarArchivo}
            disabledCamara={fase === "procesando"}
            disabledGaleria={fase === "procesando"}
          />
        </div>
        {mensaje && <p className="mt-3 text-sm text-slate-600">{mensaje}</p>}
        <button type="button" onClick={props.onCancelar} className="mt-4 w-full text-center text-sm text-slate-400 underline">
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

  if (!datos || !validacion) return null;

  return (
    <div className="mx-auto max-w-md pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          {esCorreccion ? "Corrige los datos" : "Revisa los datos leídos"}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            datos.confianza === "alta"
              ? "bg-emerald-100 text-emerald-700"
              : datos.confianza === "media"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {esCorreccion && datos.confianza === "alta" ? "Datos previos" : `Confianza ${datos.confianza}`}
        </span>
      </div>

      <button type="button" onClick={reintentarFoto} className="mb-4 flex items-center gap-1 text-xs text-slate-400 underline">
        <RotateCcw size={12} aria-hidden />
        {esCorreccion ? "Repetir foto (sustituye estos datos)" : "Repetir foto"}
      </button>

      {esCorreccion && (
        <SeccionCampos titulo="Tono y calibre">
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-slate-600">Tono</label>
            <input
              value={tonoEditado}
              onChange={(e) => setTonoEditado(limpiarEntradaTonoCalibre(e.target.value))}
              className={`w-full rounded-lg border p-2 text-sm ${
                esTonoCalibreValido(tonoEditado) ? "border-slate-300" : "border-red-400"
              }`}
            />
            {!esTonoCalibreValido(tonoEditado) && (
              <p className="mt-1 text-xs text-red-600">Requerido — solo mayúsculas y números, sin espacios.</p>
            )}
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-slate-600">Calibre</label>
            <input
              value={calibreEditado}
              onChange={(e) => setCalibreEditado(limpiarEntradaTonoCalibre(e.target.value))}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="opcional"
            />
          </div>
        </SeccionCampos>
      )}

      <SeccionCampos titulo="Piezas por calidad">
        {CAMPOS_PIEZAS.map(([campo, etiqueta]) => (
          <CampoEntero key={campo} etiqueta={etiqueta} valor={datos[campo]} onChange={(v) => actualizarNumero(campo, v)} />
        ))}
      </SeccionCampos>

      <SeccionCampos titulo="Piezas por canal de calibre (CAL 1-8)">
        <div className="grid grid-cols-4 gap-2">
          {CAMPOS_CALIBRE.map((campo, i) => (
            <CampoEntero key={campo} etiqueta={`CAL ${i + 1}`} valor={datos[campo]} onChange={(v) => actualizarNumero(campo, v)} compacto />
          ))}
        </div>
      </SeccionCampos>

      <SeccionCampos titulo="Tiempos (minutos)">
        {CAMPOS_MINUTOS.map(([campo, etiqueta]) => (
          <CampoEntero key={campo} etiqueta={etiqueta} valor={datos[campo]} onChange={(v) => actualizarNumero(campo, v)} />
        ))}
      </SeccionCampos>

      <SeccionCampos titulo="Hora de pantalla (metadato de validación)">
        <input
          type="datetime-local"
          value={horaLocal}
          onChange={(e) => setHoraLocal(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
        />
        {horaTextoCrudo && !horaLocal && (
          <p className="mt-1 text-xs text-amber-600">
            El OCR leyó "{horaTextoCrudo}" pero no se pudo interpretar automáticamente — complétalo a mano si quieres.
          </p>
        )}
      </SeccionCampos>

      <div className="mt-4 space-y-2">
        {validacion.calidad.bloqueante && <AvisoValidacion tipo="error" mensaje={validacion.calidad.mensaje} />}
        {validacion.tiempos.bloqueante && <AvisoValidacion tipo="error" mensaje={validacion.tiempos.mensaje} />}
        {validacion.esAtipico && <AvisoValidacion tipo="aviso" mensaje={validacion.duracion.mensaje} />}
      </div>

      {errorGuardado && <p className="mt-2 text-sm text-red-600">{errorGuardado}</p>}

      <button
        type="button"
        disabled={!validacion.puedeGuardar || fase === "guardando" || (esCorreccion && !esTonoCalibreValido(tonoEditado))}
        onClick={guardar}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        <Save size={20} aria-hidden />
        {fase === "guardando" ? "Guardando..." : esCorreccion ? "Guardar corrección" : "Guardar parte"}
      </button>

      <button type="button" onClick={props.onCancelar} className="mt-3 w-full text-center text-sm text-slate-400 underline">
        Cancelar
      </button>
    </div>
  );
}

function SeccionCampos({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CampoEntero({
  etiqueta,
  valor,
  onChange,
  compacto = false,
}: {
  etiqueta: string;
  valor: number;
  onChange: (v: number) => void;
  compacto?: boolean;
}) {
  if (compacto) {
    return (
      <div>
        <label className="mb-1 block text-xs text-slate-500">{etiqueta}</label>
        <input
          type="number"
          value={valor}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full rounded-lg border border-slate-300 p-2 text-center text-sm"
        />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-slate-600">{etiqueta}</label>
      <input
        type="number"
        value={valor}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-24 rounded-lg border border-slate-300 p-2 text-right text-sm"
      />
    </div>
  );
}

function AvisoValidacion({ tipo, mensaje }: { tipo: "error" | "aviso"; mensaje: string }) {
  const color = tipo === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800";
  return (
    <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${color}`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{mensaje}</span>
    </div>
  );
}