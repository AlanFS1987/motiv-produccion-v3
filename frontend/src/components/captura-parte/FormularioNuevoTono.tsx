import { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  obtenerLoteCompleto,
  crearParteInicial,
  type LoteResuelto,
  type LoteCompleto,
} from "../../lib/parte";
import {
  sugerirTonoSiguiente,
  esTonoCalibreValido,
  limpiarEntradaTonoCalibre,
  normalizarTexto,
} from "../../lib/normalizacion";

interface FormularioNuevoTonoProps {
  turnoId: string;
  lineaId: string;
  loteId: string;
  tonoAnterior: string;
  calibreAnterior: string | null;
  onCreado: (lote: LoteResuelto, parteId: string) => void;
  onCancelar: () => void;
}

/**
 * "Nuevo tono/calibre, mismo lote" — reaprovecha un lote ya resuelto
 * (sin volver a pasar por hoja de partida ni resolver-catalogo). Solo
 * tono y calibre son editables; el resto del lote se muestra bloqueado
 * como contexto. Ver mockup de sesión.
 */
export function FormularioNuevoTono({
  turnoId,
  lineaId,
  loteId,
  tonoAnterior,
  calibreAnterior,
  onCreado,
  onCancelar,
}: FormularioNuevoTonoProps) {
  const { usuario } = useAuth();
  const [lote, setLote] = useState<LoteCompleto | null>(null);
  const [tono, setTono] = useState("");
  const [calibre, setCalibre] = useState(calibreAnterior ?? "");
  const [tonoEsSugerencia, setTonoEsSugerencia] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerLoteCompleto(loteId)
      .then((datos) => {
        setLote(datos);
        const sugerencia = sugerirTonoSiguiente(tonoAnterior);
        setTono(sugerencia ?? "");
        setTonoEsSugerencia(sugerencia !== null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCargando(false));
  }, [loteId, tonoAnterior]);

  const tonoValido = tono.trim() !== "" && esTonoCalibreValido(tono);
  const calibreValido = calibre.trim() === "" || esTonoCalibreValido(calibre);

  async function confirmar() {
    if (!lote || !usuario || !tonoValido || !calibreValido) return;
    setCreando(true);
    setError(null);
    try {
      const loteResuelto: LoteResuelto = {
        loteId: lote.loteId,
        productoId: lote.productoId,
        modeloId: lote.modeloId,
        marcaId: lote.marcaId,
        loteCreado: false,
        loteReabierto: false,
        formatoNombre: lote.formatoNombre,
        numeroOrden: lote.numeroOrden,
        tono: tono.trim(),
        calibre: calibre.trim(),
        marcaTextoNormalizado: normalizarTexto(lote.marcaNombre),
        modeloTextoNormalizado: normalizarTexto(lote.modeloNombre),
        fotoHojaPartidaUrl: "",
      };
      const parte = await crearParteInicial(turnoId, lineaId, usuario.id, loteResuelto);
      onCreado(loteResuelto, parte.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreando(false);
    }
  }

  if (cargando) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando datos del lote...</div>;
  }

  if (error && !lote) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (!lote) return null;

  return (
    <div className="mx-auto max-w-md pb-8">
      <p className="mb-4 text-sm font-medium text-slate-600">Nuevo tono/calibre — mismo lote</p>

      <CampoBloqueado etiqueta="Modelo" valor={lote.modeloNombre} />
      <CampoBloqueado etiqueta="Marca" valor={lote.marcaNombre} />
      <CampoBloqueado etiqueta="Formato" valor={lote.formatoNombre} />
      <CampoBloqueado etiqueta="Nº de orden" valor={lote.numeroOrden} />

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-slate-600">
          Tono {tonoEsSugerencia && <span className="text-xs font-normal text-amber-600">(sugerido: anterior + 1)</span>}
        </label>
        <input
          value={tono}
          onChange={(e) => {
            setTono(limpiarEntradaTonoCalibre(e.target.value));
            setTonoEsSugerencia(false);
          }}
          className={`w-full rounded-lg border p-2 text-sm ${tonoValido ? "border-slate-300" : "border-red-400"}`}
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

      <CampoBloqueado etiqueta="Acabado — código" valor={lote.acabadoCodigo ?? "—"} />
      <CampoBloqueado etiqueta="Acabado — tipo" valor={lote.acabadoTipo ?? "—"} />
      <CampoBloqueado etiqueta="Acabado — nombre" valor={lote.acabadoNombre ?? "—"} />
      <CampoBloqueado etiqueta="Espesor" valor={lote.espesor ?? "—"} />
      <CampoBloqueado etiqueta="Tipo de palet" valor={lote.tipoPalet ?? "—"} />
      <CampoBloqueado etiqueta="Piezas por caja" valor={lote.pzaCaja != null ? String(lote.pzaCaja) : "—"} />
      <CampoBloqueado etiqueta="Objetivo (m²)" valor={lote.objetivoM2 != null ? String(lote.objetivoM2) : "—"} />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!tonoValido || !calibreValido || creando}
        onClick={confirmar}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        <FileCheck2 size={20} aria-hidden />
        {creando ? "Creando parte..." : "Confirmar y crear parte"}
      </button>

      <button type="button" onClick={onCancelar} className="mt-3 w-full text-center text-sm text-slate-400 underline">
        Cancelar
      </button>
    </div>
  );
}

function CampoBloqueado({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-slate-600">{etiqueta}</label>
      <input value={valor} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-500" />
    </div>
  );
}