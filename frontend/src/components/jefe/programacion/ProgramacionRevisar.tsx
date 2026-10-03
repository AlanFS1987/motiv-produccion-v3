// frontend/src/components/jefe/programacion/ProgramacionRevisar.tsx
//
// Sub-vista "Revisar" de la pestaña Programación. Si no hay CSV
// pegado hoy, muestra el textarea para pegarlo (fusionado en el mismo
// paso, sin pestaña aparte — guardar_programacion_csv permite ahora a
// jefe/administrador escribir en admin_notas). Se puede pegar el CSV (;)
// o las celdas copiadas directamente de Excel (tabuladores): se normalizan
// antes de guardar (lib/normalizar-pegado.ts).
//
// Revisar solo VALIDA (memorias/22, Mejora 2): tono y calibre ya no se
// rellenan aquí (se hace en Consultar). Si hay avisos (números repetidos,
// filas incompletas, líneas ignoradas por el lector) se muestran en el bloque
// «Avisos» antes de los hornos, con resolución en el cliente. En cuanto hay
// CSV, el diff agrupado por horno: nuevo, eliminado (se puede "mantener" si el
// jefe considera que el parser se equivocó), reordenado/sin cambios
// (informativos) y cambia de horno. Confirmar ejecuta confirmar_programacion
// con el estado final ya editado; queda BLOQUEADO mientras haya repetidos sin
// resolver o filas incompletas incluidas (el servidor sigue rechazando
// repetidos como red de seguridad). Deshacer restaura el snapshot de antes de
// la última confirmación (ver 20-programacion.md).

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Info, Loader2, RefreshCw, Undo2, Upload } from "lucide-react";
import {
  agruparPorHorno,
  confirmarProgramacion,
  deshacerUltimaProgramacion,
  existeCsvHoy,
  guardarProgramacionCsv,
  hoyISO,
  metrosDeTexto,
  obtenerDiffProgramacion,
  validarProgramacion,
  type AvisoProgramacion,
  type FilaAConfirmar,
  type FilaDiff,
} from "../../../lib/programacion";
import { avisosDePegado, normalizarPegado, traeCeldasDeExcel } from "../../../lib/normalizar-pegado";
import { AvisosRevisar, type CamposElegidos } from "./AvisosRevisar";
import { BotonCopiar, COLOR_CAMBIO, ETIQUETA_CAMBIO, formatoMetros } from "./ui";

interface FilaEditable extends FilaDiff {
  // false = el jefe ha decidido invertir el destino por defecto:
  // - si cambio === 'eliminado' y incluida === true → se MANTIENE
  //   (el jefe considera que el parser se equivocó al marcarla).
  // - si cambio !== 'eliminado' y incluida === false → se DESCARTA (no
  //   se guarda: una fila basura que coló el parser, o una incompleta; si la
  //   orden ya estaba en programación, se elimina de ella).
  incluida: boolean;
  // Tono y calibre YA NO se editan aquí (se rellenan en Consultar). Se
  // conservan en el payload por si una fila trajera valor por otro camino.
  tono?: string | null;
  calibre?: string | null;
}

function esIncompleta(f: { modelo: string | null; metros: number | null }): boolean {
  return !f.modelo?.trim() || !(f.metros !== null && f.metros > 0);
}

// La aparición elegida de un número repetido sustituye a la fila que devuelve el diff.
function aplicarCampos(f: FilaEditable, c: CamposElegidos): FilaEditable {
  return {
    ...f,
    horno: c.horno,
    hornoNuevo: c.horno,
    posicionNueva: c.posicion,
    modelo: c.modelo || null,
    metros: c.metros,
    acabado: c.acabado || null,
    cep: c.cep,
    caja: c.caja || null,
  };
}

// El diff (parse_programacion) falla con un METROS que no es un número (p. ej. "5,5").
// En ese caso no hay diff que completar en pantalla: se explica y se señalan las líneas.
function mensajeDeErrorDiff(err: unknown, avisos: AvisoProgramacion[]): string {
  const texto = err instanceof Error ? err.message : "Error cargando el diff";
  if (!texto.includes("invalid input syntax for type numeric")) return texto;
  const lineas = avisos
    .filter((a) => a.tipo === "incompleta" && a.metros.trim() !== "" && metrosDeTexto(a.metros) === null)
    .map((a) => `línea ${a.linea} (${a.numeroOrden}): METROS «${a.metros.trim()}»`);
  return (
    "El archivo tiene valores de METROS que no se pueden leer" +
    (lineas.length > 0 ? `: ${lineas.join("; ")}` : "") +
    ". Corrígelos en el archivo y pégalo de nuevo con «¿Archivo equivocado? Sustituir»."
  );
}

export function ProgramacionRevisar() {
  const [fecha] = useState(hoyISO());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaEditable[]>([]);
  const [avisos, setAvisos] = useState<AvisoProgramacion[]>([]);
  // numero_orden → valores de la aparición elegida. «Resuelto» vive en el cliente:
  // validar_programacion seguirá avisando del CSV crudo.
  const [elegidas, setElegidas] = useState<Record<string, CamposElegidos>>({});
  const [diffFallido, setDiffFallido] = useState(false);
  const [validacionFallida, setValidacionFallida] = useState(false);
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

  // `mensaje` (opcional): resultado de la acción que provoca la recarga
  // (confirmar/deshacer). Se muestra cuando termina de cargar; si se
  // fijara antes, la propia recarga lo borraría y solo se vería el spinner.
  // `reaplicar` (por defecto sí): vuelve a aplicar las elecciones de duplicados ya hechas
  // (tras confirmar/deshacer el CSV es el mismo). Con un archivo nuevo, no.
  function cargarDiff(mensaje?: string, reaplicar = true) {
    setCargando(true);
    setError(null);
    setResultado(null);
    setDiffFallido(false);
    Promise.allSettled([obtenerDiffProgramacion(fecha), validarProgramacion(fecha)])
      .then(([diff, validacion]) => {
        const lista = validacion.status === "fulfilled" ? validacion.value : [];
        setAvisos(lista);
        setValidacionFallida(validacion.status === "rejected");

        if (diff.status === "rejected") {
          setFilas([]);
          setDiffFallido(true);
          setError(mensajeDeErrorDiff(diff.reason, lista));
          return;
        }

        setFilas(
          diff.value.map((f) => {
            const base: FilaEditable = { ...f, incluida: f.cambio !== "eliminado" };
            // Tras confirmar/recargar, las elecciones ya hechas se vuelven a aplicar
            // (el CSV es el mismo, así que las líneas coinciden).
            const elegida = reaplicar && f.repetida ? elegidas[f.numeroOrden] : undefined;
            return elegida ? aplicarCampos(base, elegida) : base;
          }),
        );
        if (validacion.status === "rejected") {
          setError(
            `No se pudo validar el archivo (${
              validacion.reason instanceof Error ? validacion.reason.message : "error"
            }). Confirmar queda bloqueado hasta poder validarlo.`,
          );
        } else if (mensaje) {
          setResultado(mensaje);
        }
      })
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

  // Lo pegado, normalizado (tabuladores de Excel → ;) y sus avisos, sin tocar el texto.
  const pegadoNormalizado = useMemo(() => normalizarPegado(csvTexto), [csvTexto]);
  const avisosPegado = useMemo(() => avisosDePegado(pegadoNormalizado), [pegadoNormalizado]);

  async function guardarCsv() {
    if (!csvTexto.trim()) {
      setError("Pega primero el contenido del CSV.");
      return;
    }
    if (avisosPegado.length > 0) {
      setError(avisosPegado[0]);
      return;
    }
    setGuardandoCsv(true);
    setError(null);
    try {
      // Se guarda el texto NORMALIZADO; el parser SQL no cambia.
      await guardarProgramacionCsv(fecha, pegadoNormalizado);
      setCsvTexto("");
      setElegidas({}); // archivo nuevo: las elecciones anteriores ya no valen
      setHayCsv(true);
      setSustituyendo(false);
      cargarDiff(undefined, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando el CSV");
    } finally {
      setGuardandoCsv(false);
    }
  }

  const porHorno = useMemo(() => agruparPorHorno(filas), [filas]);

  // Números de orden con aviso de incompleta en el CSV (para no bloquear por filas que el
  // validador no marcó).
  const numerosIncompletos = useMemo(
    () => new Set(avisos.filter((a) => a.tipo === "incompleta" && a.numeroOrden).map((a) => a.numeroOrden as string)),
    [avisos],
  );

  const repetidasSinResolver = filas.filter((f) => f.repetida && !elegidas[f.numeroOrden]);
  const incompletasIncluidas = filas.filter(
    (f) => f.incluida && f.cambio !== "eliminado" && numerosIncompletos.has(f.numeroOrden) && esIncompleta(f),
  );
  const bloqueado =
    diffFallido || validacionFallida || repetidasSinResolver.length > 0 || incompletasIncluidas.length > 0;

  function actualizarFila(numeroOrden: string, cambios: Partial<FilaEditable>) {
    setFilas((prev) => prev.map((f) => (f.numeroOrden === numeroOrden ? { ...f, ...cambios } : f)));
  }

  function elegirAparicion(numeroOrden: string, campos: CamposElegidos) {
    setElegidas((prev) => ({ ...prev, [numeroOrden]: campos }));
    setFilas((prev) => prev.map((f) => (f.numeroOrden === numeroOrden ? aplicarCampos(f, campos) : f)));
  }

  function deshacerEleccion(numeroOrden: string) {
    setElegidas((prev) => {
      const resto = { ...prev };
      delete resto[numeroOrden];
      return resto;
    });
  }

  async function confirmar() {
    if (bloqueado) {
      setError("No se puede confirmar todavía: resuelve los avisos de arriba.");
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
      cargarDiff(`Guardado: ${r.nuevos} nuevos, ${r.eliminados} eliminados, ${r.actualizados} actualizados.`);
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
      cargarDiff(
        `Deshecho: ${r.filasRestauradas} filas restauradas (estado de ${new Date(r.snapshotDe).toLocaleString("es-ES")}).`,
      );
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
              Todavía no hay ninguna programación pegada para hoy. En el Excel diario{" "}
              <strong>selecciona las celdas de la programación (las 4 secciones, empezando por la columna
              anterior a «Nº ORDEN»)</strong>, cópialas y pégalas aquí abajo. También vale pegar el contenido
              de un CSV (con «;»).
            </>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}
        {traeCeldasDeExcel(csvTexto) && avisosPegado.length === 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            Celdas copiadas de Excel detectadas: se convertirán automáticamente al guardar.
          </div>
        )}
        {avisosPegado.map((a) => (
          <div key={a} className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {a}
          </div>
        ))}

        <textarea
          value={csvTexto}
          onChange={(e) => setCsvTexto(e.target.value)}
          rows={12}
          placeholder="Pega aquí las celdas de Excel o el contenido del CSV..."
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={guardarCsv}
            disabled={!csvTexto.trim() || guardandoCsv || avisosPegado.length > 0}
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
      <div className="space-y-2 p-6 text-sm text-slate-500">
        {resultado && (
          <div className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-green-700">
            <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
            {resultado}
          </div>
        )}
        <div>No hay ningún cambio que revisar respecto a la última programación confirmada.</div>
      </div>
    );
  }

  const resoluciones = Object.fromEntries(Object.entries(elegidas).map(([n, c]) => [n, c.linea]));

  let textoPie = "Todo listo. Tono y calibre se rellenan después en Consultar.";
  if (diffFallido) textoPie = "Confirmar bloqueado: no se pudo leer el archivo.";
  else if (validacionFallida) textoPie = "Confirmar bloqueado: no se pudo validar el archivo.";
  else if (repetidasSinResolver.length > 0)
    textoPie = `Confirmar bloqueado: ${repetidasSinResolver.length} número(s) de orden repetido(s) sin resolver.`;
  else if (incompletasIncluidas.length > 0)
    textoPie = `Confirmar bloqueado: ${incompletasIncluidas.length} fila(s) incompleta(s) (completa o descarta).`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Revisión — {fecha}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cargarDiff()}
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

      {!diffFallido && (
        <AvisosRevisar
          avisos={avisos}
          filas={filas.map((f) => ({
            numeroOrden: f.numeroOrden,
            modelo: f.modelo,
            metros: f.metros,
            incluida: f.incluida,
            esNueva: f.cambio === "nuevo",
          }))}
          resoluciones={resoluciones}
          onElegir={elegirAparicion}
          onDeshacerEleccion={deshacerEleccion}
          onCompletar={(numero, modelo, metros) => actualizarFila(numero, { modelo: modelo || null, metros })}
          onAlternarDescarte={(numero) => {
            const f = filas.find((x) => x.numeroOrden === numero);
            if (f) actualizarFila(numero, { incluida: !f.incluida });
          }}
        />
      )}

      {[1, 2, 3, 4].map((horno) => {
        const filasHorno = porHorno.get(horno) ?? [];
        if (filasHorno.length === 0) return null;
        return (
          <div key={horno} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">🔥 Horno {horno}</div>
            <div className="divide-y divide-slate-100">
              {filasHorno.map((f) => {
                const incompletaPendiente =
                  f.incluida && f.cambio !== "eliminado" && numerosIncompletos.has(f.numeroOrden) && esIncompleta(f);
                return (
                  <div
                    key={f.numeroOrden}
                    className={`flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center ${
                      !f.incluida && f.cambio !== "eliminado" ? "opacity-50" : ""
                    }`}
                  >
                    <span
                      className={`w-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_CAMBIO[f.cambio]}`}
                    >
                      {ETIQUETA_CAMBIO[f.cambio] ?? f.cambio}
                    </span>
                    {f.cambio === "cambia_horno" && f.hornoActual !== null && (
                      <span className="w-fit shrink-0 text-xs text-blue-700">viene del horno {f.hornoActual}</span>
                    )}
                    {f.repetida &&
                      (elegidas[f.numeroOrden] ? (
                        <span className="w-fit shrink-0 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Repetida: resuelta (línea {elegidas[f.numeroOrden].linea})
                        </span>
                      ) : (
                        <span className="w-fit shrink-0 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Repetida
                        </span>
                      ))}
                    {incompletaPendiente && (
                      <span className="w-fit shrink-0 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Incompleta
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

                    {f.cambio === "eliminado" && (
                      <button
                        type="button"
                        onClick={() => actualizarFila(f.numeroOrden, { incluida: !f.incluida })}
                        className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {f.incluida ? "✓ Se mantiene" : "Mantener igualmente"}
                      </button>
                    )}

                    {f.cambio === "nuevo" && (
                      <button
                        type="button"
                        onClick={() => actualizarFila(f.numeroOrden, { incluida: !f.incluida })}
                        className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {f.incluida ? "Descartar" : "✗ Descartada"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-[var(--fondo)] py-3">
        <span className="text-xs text-slate-500">{textoPie}</span>
        <button
          type="button"
          onClick={confirmar}
          disabled={confirmando || bloqueado}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {confirmando && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Confirmar y actualizar
        </button>
      </div>
    </div>
  );
}
