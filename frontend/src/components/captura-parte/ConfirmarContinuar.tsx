import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { crearParteInicial, type LoteResuelto, type SugerenciaContinuar } from "../../lib/parte";
import { normalizarTexto } from "../../lib/normalizacion";

interface ConfirmarContinuarProps {
  turnoId: string;
  lineaId: string;
  sugerencia: SugerenciaContinuar;
  onCreado: (lote: LoteResuelto, parteId: string) => void;
  onCancelar: () => void;
}

/**
 * Camino 1: "Continuar mismo lote+tono" — sin fotos en absoluto (ver
 * 01-rol-responsable.md 3.2), crea el parte directo con lo mismo que
 * ya se estaba produciendo y salta a la Foto 4 (pantalla).
 */
export function ConfirmarContinuar({ turnoId, lineaId, sugerencia, onCreado, onCancelar }: ConfirmarContinuarProps) {
  const { usuario } = useAuth();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!usuario) return;
    setCreando(true);
    setError(null);
    try {
      const loteResuelto: LoteResuelto = {
        loteId: sugerencia.loteId,
        productoId: "",
        modeloId: "",
        marcaId: "",
        loteCreado: false,
        loteReabierto: false,
        formatoNombre: sugerencia.formatoNombre,
        numeroOrden: sugerencia.numeroOrden,
        tono: sugerencia.tono,
        calibre: sugerencia.calibre ?? "",
        // Sin normalizar aquí, evaluarVerificacionCaja (lib/verificacion-caja.ts)
        // compara normalizarTexto(leído) === esperado — si "esperado" queda
        // sin normalizar, cualquier diferencia de mayúsculas/tildes entre el
        // nombre guardado en catálogo y lo impreso en la caja da un falso
        // "incorrecto" solo en este camino (los otros dos sí normalizan, ver
        // FotoHojaPartida.tsx y FormularioNuevoTono.tsx).
        marcaTextoNormalizado: normalizarTexto(sugerencia.marcaNombre),
        modeloTextoNormalizado: normalizarTexto(sugerencia.modeloNombre),
        fotoHojaPartidaUrl: "",
      };
      const parte = await crearParteInicial(turnoId, lineaId, usuario.id, loteResuelto);
      onCreado(loteResuelto, parte.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <PlayCircle size={40} className="mx-auto mb-3 text-slate-400" aria-hidden />
      <p className="mb-1 text-base font-medium text-slate-900">
        {sugerencia.marcaNombre} {sugerencia.formatoNombre} — {sugerencia.modeloNombre}
      </p>
      <p className="mb-6 text-sm text-slate-500">
        Tono {sugerencia.tono}
        {sugerencia.calibre ? ` · Calibre ${sugerencia.calibre}` : ""} · Orden {sugerencia.numeroOrden}
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={creando}
        onClick={confirmar}
        className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
      >
        {creando ? "Creando parte..." : "Continuar con esto"}
      </button>
      <button type="button" onClick={onCancelar} className="text-sm text-slate-400 underline">
        Cancelar
      </button>
    </div>
  );
}