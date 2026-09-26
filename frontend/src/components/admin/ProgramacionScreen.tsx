// frontend/src/components/admin/ProgramacionScreen.tsx
//
// Pestaña "Programación": pega el CSV diario de producción (guardado
// desde Excel como CSV UTF-8) y lo sube a `admin_notas`
// (tipo='programacion', una fila por fecha) para que Ceria (u otro
// proceso) lo lea después por SQL.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Upload } from "lucide-react";
import {
  fechaDeHoyISO,
  guardarProgramacion,
  listarProgramacionHistorico,
  type ProgramacionHistorico,
} from "../../lib/admin-notas";

export function ProgramacionScreen() {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [csvTexto, setCsvTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [historico, setHistorico] = useState<ProgramacionHistorico[]>([]);
  const [cargandoHistorico, setCargandoHistorico] = useState(true);

  function cargarHistorico() {
    setCargandoHistorico(true);
    listarProgramacionHistorico()
      .then(setHistorico)
      .catch((err) =>
        setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error cargando el histórico" }),
      )
      .finally(() => setCargandoHistorico(false));
  }

  useEffect(cargarHistorico, []);

  async function guardar() {
    if (!fecha) {
      setMensaje({ tipo: "error", texto: "Elige una fecha." });
      return;
    }
    if (!csvTexto.trim()) {
      setMensaje({ tipo: "error", texto: "Pega primero el contenido del CSV." });
      return;
    }

    setGuardando(true);
    setMensaje(null);
    try {
      await guardarProgramacion(fecha, csvTexto);
      setMensaje({ tipo: "ok", texto: `Guardado correctamente para el ${fecha}.` });
      setCsvTexto("");
      cargarHistorico();
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        Guarda el Excel diario como <strong>CSV UTF-8 (delimitado por comas)</strong>, ábrelo con el
        Bloc de notas, selecciona todo y pégalo aquí abajo. Volver a guardar la misma fecha
        sobrescribe lo que hubiera.
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Fecha (autogenerada, puedes cambiarla)</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Contenido del CSV</label>
        <textarea
          value={csvTexto}
          onChange={(e) => setCsvTexto(e.target.value)}
          rows={14}
          placeholder={
            "N° ORDEN,MODELO,METROS,N° BOX,ACABADO,HORNO,CEP,CAJA\n1117168,SL CLASH BEECH(PRC)20X120 RC/ARG5_S,5.500,19,1,1,,ARGENTA"
          }
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </div>

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
        {guardando ? "Guardando..." : "Guardar"}
      </button>

      {mensaje && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {mensaje.tipo === "ok" ? <Check size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
          {mensaje.texto}
        </div>
      )}

      <hr className="border-slate-200" />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Últimas subidas</h3>
        {cargandoHistorico ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay ninguna.</p>
        ) : (
          <ul className="space-y-1">
            {historico.map((h) => (
              <li key={h.id} className="font-mono text-xs text-slate-600">
                {h.fecha} — <span className="text-slate-400">{h.numFilas ?? "?"} líneas</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
