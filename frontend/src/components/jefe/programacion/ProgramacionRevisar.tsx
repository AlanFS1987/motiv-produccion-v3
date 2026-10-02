// frontend/src/components/jefe/programacion/ProgramacionRevisar.tsx
//
// Sub-vista "Revisar" de la pestaña Programación. Si no hay CSV
// pegado hoy, muestra el textarea para pegarlo (fusionado en el mismo
// paso, sin pestaña aparte — guardar_programacion_csv permite ahora a
// jefe/administrador escribir en admin_notas). En cuanto hay CSV,
// muestra el diff editable: nuevo → rellenar tono/calibre; eliminado
// → se puede "mantener" si el jefe considera que el parser se
// equivocó; reordenado/sin cambios → informativos, no bloquean.
// Confirmar ejecuta confirmar_programacion con el estado final ya
// editado. Deshacer restaura el snapshot de antes de la última
// confirmación (ver 20-programacion.md).

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, Undo2, Upload } from "lucide-react";
import {
  agruparPorHorno,
  confirmarProgramacion,
  deshacerUltimaProgramacion,
  existeCsvHoy,
  guardarProgramacionCsv,
  hoyISO,
  obtenerDiffProgramacion,
  type FilaAConfirmar,
  type FilaDiff,
} from "../../../lib/programacion";
import { BotonCopiar, COLOR_CAMBIO, ETIQUETA_CAMBIO, formatoMetros } from "./ui";

interface FilaEditable extends FilaDiff {
  // false = el jefe ha decidido invertir el destino por defecto:
  // - si cambio === 'eliminado' y incluida === true → se MANTIENE
  //   (el jefe considera que el parser se equivocó al marcarla).
  // - si cambio === 'nuevo' y incluida === false → se DESCARTA (no
  //   se añade, p.ej. una fila basura que coló el parser).
  incluida: boolean;
  tono?: string | null;
  calibre?: string | null;
}

export function ProgramacionRevisar() {
  const [fecha] = useState(hoyISO());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaEditable[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  // null = todavía no sabemos; true/false = ya comprobado
  const [hayCsv, setHayCsv] = useState<boolean | null>(null);
  const [csvTexto, setCsvTexto] = useState("");
  const [guardandoCsv, setGuardandoCsv] = useState(false);
  // El jefe puede pedir sustituir el CSV de hoy aunque ya exista uno
  // (por si se equivocó de archivo) — fuerza a mostrar el textarea.
  const [sustituyendo, setSustituyendo] = useState(false);

  function cargarDiff() {
    setCargando(true);
    setError(null);
    setResultado(null);
    obtenerDiffProgramacion(fecha)
      .then((diff) =>
        setFilas(
          diff.map((f) => ({
            ...f,
            incluida: f.cambio !== "eliminado",
          })),
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando el diff"))
      .finally(() => setCargando(false));
  }

  function comprobarYCargar() {
    setCargando(true);
    setError(null);
    existeCsvHoy(fecha)
      .then((existe) => {
        setHayCsv(existe);
        if (existe) {
          cargarDiff();
        } else {
          setCargando(false);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error comprobando el CSV de hoy");
        setCargando(false);
      });
  }

  useEffect(comprobarYCargar, [fecha]);

  async function guardarCsv() {
    if (!csvTexto.trim()) {
      setError("Pega primero el contenido del CSV.");
      return;
    }
    setGuardandoCsv(true);
    setError(null);
    try {
      await guardarProgramacionCsv(fecha, csvTexto);
      setCsvTexto("");
      setHayCsv(true);
      setSustituyendo(false);
      cargarDiff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando el CSV");
    } finally {
      setGuardandoCsv(false);
    }
  }

  const porHorno = useMemo(() => agruparPorHorno(filas), [filas]);

  const nuevasPendientesDeTono = filas.filter((f) => f.cambio === "nuevo" && f.incluida && !f.tono);

  // Un numero_orden repetido en el CSV es siempre un error (aunque sea en
  // hornos distintos). El diff solo devuelve una de las apariciones, así
  // que no se puede resolver aquí: hay que corregir el archivo.
  const repetidas = filas.filter((f) => f.repetida);

  function actualizarFila(numeroOrden: string, horno: number, cambios: Partial<FilaEditable>) {
    setFilas((prev) =>
      prev.map((f) => (f.horno === horno && f.numeroOrden === numeroOrden ? { ...f, ...cambios } : f)),
    );
  }

  async function confirmar() {
    if (repetidas.length > 0) {
      setError("Hay números de orden repetidos en el archivo. Corrígelo y usa «Sustituir».");
      return;
    }
    setConfirmando(true);
    setError(null);
    try {
      // Entran todas las filas que existen en el CSV nuevo (nuevo,
      // reordenado, sin_cambios, cambia_horno): la clave es numero_orden,
      // así que una orden que cambia de horno se actualiza en su sitio y
      // conserva tono, calibre y fecha de alta. Solo "eliminado" queda
      // fuera (salvo que el jefe lo mantenga, más abajo).
      const filasFinales: FilaAConfirmar[] = filas
        .filter((f) => f.incluida && f.cambio !== "eliminado")
        .map((f, idx) => ({
          horno: f.horno,
          numero_orden: f.numeroOrden,
          modelo: f.modelo,
          metros: f.metros,
          acabado: f.acabado,
          cep: f.cep,
          caja: f.caja,
          posicion: f.posicionNueva ?? f.posicionActual ?? idx,
          tono: f.tono ?? null,
          calibre: f.calibre ?? null,
        }));

      // las eliminadas que el jefe decidió MANTENER también se
      // conservan con su posición/datos actuales
      for (const f of filas) {
        if (f.cambio === "eliminado" && f.incluida) {
          filasFinales.push({
            horno: f.horno,
            numero_orden: f.numeroOrden,
            modelo: f.modelo,
            metros: f.metros,
            acabado: f.acabado,
            cep: f.cep,
            caja: f.caja,
            posicion: f.posicionActual ?? 999,
          });
        }
      }

      const r = await confirmarProgramacion(fecha, filasFinales);
      setResultado(
        `Guardado: ${r.nuevos} nuevos, ${r.eliminados} eliminados, ${r.actualizados} actualizados.`,
      );
      cargarDiff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setConfirmando(false);
    }
  }

  async function deshacer() {
    if (
      !window.confirm(
        "¿Deshacer la última confirmación? Esto restaura la programación a como estaba justo antes de esa confirmación.",
      )
    ) {
      return;
    }
    setDeshaciendo(true);
    setError(null);
    try {
      const r = await deshacerUltimaProgramacion();
      setResultado(
        `Deshecho: ${r.filasRestauradas} filas restauradas (estado de ${new Date(r.snapshotDe).toLocaleString("es-ES")}).`,
      );
      cargarDiff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al deshacer");
    } finally {
      setDeshaciendo(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        {hayCsv === null ? "Comprobando si hay programación de hoy..." : "Comparando con el CSV de hoy..."}
      </div>
    );
  }

  // Todavía no hay CSV pegado para hoy, o el jefe pidió sustituirlo
  // porque se equivocó de archivo: mostrar el textarea aquí mismo
  // (fusionado en el mismo paso, sin pestaña aparte).
  if (hayCsv === false || sustituyendo) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Programación — {fecha}</h2>
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          {sustituyendo ? (
            <>
              Vas a <strong>sustituir</strong> el CSV que ya había para hoy. Pega el correcto abajo — al
              guardar, se recalculará el diff contra el estado actual, así que si ya habías confirmado
              algo por error, esto lo corrige.
            </>
          ) : (
            <>
              Todavía no hay ningún CSV pegado para hoy. Guarda el Excel diario como{" "}
              <strong>CSV UTF-8 (delimitado por comas)</strong>, ábrelo con el Bloc de notas, selecciona
              todo y pégalo aquí abajo.
            </>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <textarea
          value={csvTexto}
          onChange={(e) => setCsvTexto(e.target.value)}
          rows={12}
          placeholder="Pega aquí el contenido del CSV..."
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={guardarCsv}
            disabled={!csvTexto.trim() || guardandoCsv}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {guardandoCsv ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
            Guardar y comparar
          </button>
          {sustituyendo && (
            <button
              type="button"
              onClick={() => {
                setSustituyendo(false);
                setCsvTexto("");
                setError(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (filas.length === 0 && !error) {
    return (
      <div className="p-6 text-sm text-slate-500">
        No hay ningún cambio que revisar respecto a la última programación confirmada.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Revisión — {fecha}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cargarDiff}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={12} aria-hidden /> Recargar
          </button>
          <button
            type="button"
            onClick={() => setSustituyendo(true)}
            className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
          >
            <Upload size={12} aria-hidden /> ¿Archivo equivocado? Sustituir
          </button>
          <button
            type="button"
            onClick={deshacer}
            disabled={deshaciendo}
            className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-40"
          >
            {deshaciendo ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Undo2 size={12} aria-hidden />}
            Deshacer última confirmación
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}
      {resultado && (
        <div className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-700">
          <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
          {resultado}
        </div>
      )}
      {repetidas.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <strong>Números de orden repetidos en el archivo:</strong>{" "}
            {repetidas.map((f) => f.numeroOrden).join(", ")}.
            <br />
            No se puede confirmar. Corrige el archivo y pégalo de nuevo con «¿Archivo equivocado? Sustituir».
          </div>
        </div>
      )}

      {[1, 2, 3, 4].map((horno) => {
        const filasHorno = porHorno.get(horno) ?? [];
        if (filasHorno.length === 0) return null;
        return (
          <div key={horno} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">🔥 Horno {horno}</div>
            <div className="divide-y divide-slate-100">
              {filasHorno.map((f) => (
                <div key={f.numeroOrden} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center">
                  <span
                    className={`w-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_CAMBIO[f.cambio]}`}
                  >
                    {ETIQUETA_CAMBIO[f.cambio] ?? f.cambio}
                  </span>
                  {f.cambio === "cambia_horno" && f.hornoActual !== null && (
                    <span className="w-fit shrink-0 text-xs text-blue-700">viene del horno {f.hornoActual}</span>
                  )}
                  {f.repetida && (
                    <span className="w-fit shrink-0 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Repetida
                    </span>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-[var(--texto)]">
                      <span>
                        {f.numeroOrden} — {f.modelo}
                      </span>
                      <BotonCopiar texto={f.numeroOrden} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatoMetros(f.metros)} m² · Acabado {f.acabado} · Caja {f.caja}
                      {f.cep ? " · Cepillado" : ""}
                    </div>
                  </div>

                  {f.cambio === "nuevo" && f.incluida && (
                    <div className="flex gap-2">
                      <input
                        placeholder="Tono (ej. M12)"
                        defaultValue={f.tono ?? ""}
                        onBlur={(e) => actualizarFila(f.numeroOrden, f.horno, { tono: e.target.value })}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        placeholder="Calibre"
                        defaultValue={f.calibre ?? ""}
                        onBlur={(e) => actualizarFila(f.numeroOrden, f.horno, { calibre: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                    </div>
                  )}

                  {f.cambio === "eliminado" && (
                    <button
                      type="button"
                      onClick={() => actualizarFila(f.numeroOrden, f.horno, { incluida: !f.incluida })}
                      className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {f.incluida ? "✓ Se mantiene" : "Mantener igualmente"}
                    </button>
                  )}

                  {f.cambio === "nuevo" && (
                    <button
                      type="button"
                      onClick={() => actualizarFila(f.numeroOrden, f.horno, { incluida: !f.incluida })}
                      className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {f.incluida ? "Descartar" : "✗ Descartada"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-[var(--fondo)] py-3">
        <span className="text-xs text-slate-500">
          {repetidas.length > 0
            ? "Confirmar bloqueado: hay números de orden repetidos."
            : nuevasPendientesDeTono.length > 0
              ? `${nuevasPendientesDeTono.length} pedido(s) nuevo(s) sin tono/calibre — puedes confirmar igualmente y rellenarlos después.`
              : "Todo listo."}
        </span>
        <button
          type="button"
          onClick={confirmar}
          disabled={confirmando || repetidas.length > 0}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {confirmando && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Confirmar y actualizar
        </button>
      </div>
    </div>
  );
}
