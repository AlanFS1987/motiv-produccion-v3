// frontend/src/components/jefe/programacion/ProgramacionConsultar.tsx
//
// Sub-vista "Consultar" de la pestaña Programación: la lista de hoy,
// ya congelada, con estado en vivo (pendiente/iniciado/finalizado vía
// JOIN contra `lote`) y botón copiar → copiado en cada Nº ORDEN.
// Pensada para el móvil. Es la vista de trabajo del jefe (memorias/22,
// Mejoras 3 y 4), tras confirmar en Revisar:
//   - fecha de alta por fila + insignia «Nueva hoy»;
//   - filtros «Solo nuevas de hoy» y «Sin tono/calibre» (combinables);
//   - tono y calibre editables en la fila (jefe/administrador);
//   - «Copiar nuevas de hoy» (números de orden, uno por línea);
//   - notas por orden con selección múltiple («Añadir nota»).
// Los demás roles con acceso a la lista (responsable, produccion) la ven
// solo en lectura. La hoja impresa A4 NO cambia: las notas no van en ella.
//
// PDF: tabla compacta a una hoja A4 vertical, una sola cara, imitando
// el formato tradicional de papel (columna de horno combinada a la
// izquierda) con el set de columnas nuevo. Solo visible al imprimir
// (@media print) — en pantalla se ve la lista de tarjetas normal. El
// botón "Exportar/Imprimir" abre el diálogo de impresión del
// navegador (permite "Guardar como PDF"). El aislamiento de impresión
// (body * { visibility: hidden } + .print-area visible) es necesario
// porque window.print() imprime todo lo visible en pantalla, incluida
// la cabecera de la app si no se oculta explícitamente. Con volúmenes
// de pedidos muy por encima de lo habitual (~55-60), podría desbordar
// a una segunda hoja — si pasa, bajar el font-size de abajo o revisar
// qué columna se puede recortar más (ver 20-programacion.md). La hoja
// impresa usa SIEMPRE todas las filas, no las filtradas en pantalla.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Loader2, MessageSquarePlus, Printer, RefreshCw } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { hoyLocalISO } from "../../../lib/fechas";
import { agruparPorHorno, listarProgramacionConEstado, type FilaConEstado } from "../../../lib/programacion";
import {
  listarFrases,
  listarNotasProgramacion,
  type FraseNota,
  type NotaOrden,
} from "../../../lib/programacion-notas";
import { ConsultarFila } from "./ConsultarFila";
import { DialogoAnadirNota } from "./DialogoAnadirNota";
import { formatoMetros } from "./ui";

function FiltroChip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        activo ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function ProgramacionConsultar() {
  const { usuario } = useAuth();
  // Solo jefe y administrador editan (las RPC lo exigen igualmente en servidor).
  const puedeEditar = usuario?.rol === "jefe" || usuario?.rol === "administrador";

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avisoNotas, setAvisoNotas] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaConEstado[]>([]);
  const [notas, setNotas] = useState<Map<string, NotaOrden[]>>(new Map());
  const [frases, setFrases] = useState<FraseNota[]>([]);

  const [soloNuevasHoy, setSoloNuevasHoy] = useState(false);
  const [soloSinTonoCalibre, setSoloSinTonoCalibre] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const hoy = hoyLocalISO();

  function avisar(texto: string) {
    setMensaje(texto);
    setTimeout(() => setMensaje(null), 3000);
  }

  function recargarNotas() {
    setAvisoNotas(null);
    listarNotasProgramacion()
      .then(setNotas)
      .catch((err) => {
        setNotas(new Map());
        setAvisoNotas(err instanceof Error ? err.message : "No se pudieron cargar las notas");
      });
  }

  function cargar() {
    setCargando(true);
    setError(null);
    listarProgramacionConEstado()
      .then(setFilas)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando"))
      .finally(() => setCargando(false));
    recargarNotas();
    listarFrases(true)
      .then(setFrases)
      .catch(() => setFrases([]));
  }

  useEffect(cargar, []);

  // Si una orden sale de programación, deja de estar seleccionada.
  useEffect(() => {
    setSeleccion((prev) => {
      const vigentes = new Set(filas.map((f) => f.numeroOrden));
      const filtrada = new Set([...prev].filter((n) => vigentes.has(n)));
      return filtrada.size === prev.size ? prev : filtrada;
    });
  }, [filas]);

  // La hoja impresa usa TODAS las filas.
  const porHorno = useMemo(() => agruparPorHorno(filas), [filas]);

  const nuevasHoy = useMemo(() => filas.filter((f) => f.fechaAlta === hoy), [filas, hoy]);
  const sinTonoCalibre = useMemo(() => filas.filter((f) => !f.tono?.trim() || !f.calibre?.trim()), [filas]);

  const visibles = useMemo(
    () =>
      filas.filter((f) => {
        if (soloNuevasHoy && f.fechaAlta !== hoy) return false;
        if (soloSinTonoCalibre && f.tono?.trim() && f.calibre?.trim()) return false;
        return true;
      }),
    [filas, soloNuevasHoy, soloSinTonoCalibre, hoy],
  );
  const visiblesPorHorno = useMemo(() => agruparPorHorno(visibles), [visibles]);

  function alternar(numeros: string[], marcar: boolean) {
    setSeleccion((prev) => {
      const sig = new Set(prev);
      for (const n of numeros) {
        if (marcar) sig.add(n);
        else sig.delete(n);
      }
      return sig;
    });
  }

  function tonoCalibreGuardado(numeroOrden: string, tono: string | null, calibre: string | null) {
    setFilas((prev) => prev.map((f) => (f.numeroOrden === numeroOrden ? { ...f, tono, calibre } : f)));
  }

  async function copiarNuevasHoy() {
    if (nuevasHoy.length === 0) {
      avisar("Hoy no hay órdenes nuevas");
      return;
    }
    const ordenadas = [...nuevasHoy].sort((a, b) => a.horno - b.horno || a.posicion - b.posicion);
    try {
      await navigator.clipboard.writeText(ordenadas.map((f) => f.numeroOrden).join("\n"));
      avisar(`Copiadas ${ordenadas.length} ${ordenadas.length === 1 ? "orden nueva" : "órdenes nuevas"}`);
    } catch {
      avisar("No se pudo copiar (portapapeles no disponible)");
    }
  }

  const todasVisiblesSeleccionadas = visibles.length > 0 && visibles.every((f) => seleccion.has(f.numeroOrden));

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando...
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-3xl space-y-4 p-4 print:p-0 ${seleccion.size > 0 ? "pb-24" : ""}`}>
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Programación de hoy</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cargar}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={12} aria-hidden /> Actualizar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <Printer size={12} aria-hidden /> Exportar / Imprimir
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}
      {avisoNotas && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 print:hidden">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          No se pudieron cargar las notas: {avisoNotas}
        </div>
      )}

      {filas.length === 0 && !error && (
        <div className="p-6 text-sm text-slate-500">
          Todavía no hay ninguna programación confirmada. Ve a "Revisar" para generarla.
        </div>
      )}

      {filas.length > 0 && (
        <div className="space-y-2 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <FiltroChip activo={soloNuevasHoy} onClick={() => setSoloNuevasHoy((v) => !v)}>
              Solo nuevas de hoy ({nuevasHoy.length})
            </FiltroChip>
            <FiltroChip activo={soloSinTonoCalibre} onClick={() => setSoloSinTonoCalibre((v) => !v)}>
              Sin tono/calibre ({sinTonoCalibre.length})
            </FiltroChip>
            <button
              type="button"
              onClick={copiarNuevasHoy}
              className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <ClipboardList size={12} aria-hidden /> Copiar nuevas de hoy
            </button>
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  alternar(
                    visibles.map((f) => f.numeroOrden),
                    !todasVisiblesSeleccionadas,
                  )
                }
                disabled={visibles.length === 0}
                className="rounded-lg border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                {todasVisiblesSeleccionadas ? "Quitar las visibles" : `Seleccionar las visibles (${visibles.length})`}
              </button>
              {seleccion.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSeleccion(new Set())}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
                >
                  Limpiar selección
                </button>
              )}
            </div>
          )}
          {mensaje && (
            <div role="status" className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white">
              {mensaje}
            </div>
          )}
        </div>
      )}

      {/* Vista de tarjetas — solo pantalla / móvil */}
      <div className="space-y-4 print:hidden">
        {filas.length > 0 && visibles.length === 0 && (
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
            Ninguna orden cumple los filtros.
          </div>
        )}
        {[1, 2, 3, 4].map((horno) => {
          const filasHorno = visiblesPorHorno.get(horno) ?? [];
          if (filasHorno.length === 0) return null;
          const todasDelHorno = (porHorno.get(horno) ?? []).map((f) => f.numeroOrden);
          const hornoSeleccionado = todasDelHorno.length > 0 && todasDelHorno.every((n) => seleccion.has(n));
          return (
            <div key={horno} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-2 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
                <span>🔥 Horno {horno}</span>
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={() => alternar(todasDelHorno, !hornoSeleccionado)}
                    className="rounded bg-white/15 px-2 py-0.5 font-medium hover:bg-white/25"
                  >
                    {hornoSeleccionado ? "Quitar el horno" : `Seleccionar las ${todasDelHorno.length} del horno`}
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {filasHorno.map((f) => (
                  <ConsultarFila
                    key={f.numeroOrden}
                    fila={f}
                    hoy={hoy}
                    puedeEditar={puedeEditar}
                    seleccionada={seleccion.has(f.numeroOrden)}
                    onSeleccion={(marcada) => alternar([f.numeroOrden], marcada)}
                    notas={notas.get(f.numeroOrden) ?? []}
                    onTonoCalibreGuardado={tonoCalibreGuardado}
                    onNotasCambiadas={recargarNotas}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {puedeEditar && seleccion.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-[var(--superficie)] p-3 shadow-lg print:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm text-[var(--texto)]">
              {seleccion.size} {seleccion.size === 1 ? "seleccionada" : "seleccionadas"}
            </span>
            <button
              type="button"
              onClick={() => setDialogoAbierto(true)}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              <MessageSquarePlus size={14} aria-hidden /> Añadir nota
            </button>
          </div>
        </div>
      )}

      {dialogoAbierto && (
        <DialogoAnadirNota
          ordenes={[...seleccion]}
          frases={frases}
          onCerrar={() => setDialogoAbierto(false)}
          onHecho={(n) => {
            setDialogoAbierto(false);
            setSeleccion(new Set());
            recargarNotas();
            avisar(`Nota añadida a ${n} ${n === 1 ? "orden" : "órdenes"}`);
          }}
        />
      )}

      {/* Hoja de impresión — solo al imprimir/exportar PDF */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }

          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }

          .tabla-impresion-programacion {
            font-size: 9pt;
            line-height: 1.2;
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
          }
          .tabla-impresion-programacion th,
          .tabla-impresion-programacion td {
            border: 0.5pt solid #333;
            padding: 1.2pt 2.5pt;
            text-align: left;
            vertical-align: middle;
            overflow-wrap: break-word;
          }
          .tabla-impresion-programacion th {
            background: #ddd;
            font-size: 9pt;
          }
          .tabla-impresion-programacion .col-horno {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            text-align: center;
            font-weight: bold;
            background: #eee;
          }
          .tabla-impresion-programacion .col-modelo {
            white-space: normal;
          }
        }
      `}</style>
      <div className="print-area hidden print:block">
        <table className="tabla-impresion-programacion">
          <caption className="print:mb-1 print:text-left print:text-[9pt] print:font-semibold">
            Programación de producción — {new Date().toLocaleDateString("es-ES")}
          </caption>
          <colgroup>
            <col style={{ width: "8mm" }} />
            <col style={{ width: "16mm" }} />
            <col style={{ width: "70mm" }} />
            <col style={{ width: "14mm" }} />
            <col style={{ width: "8mm" }} />
            <col style={{ width: "8mm" }} />
            <col style={{ width: "28mm" }} />
            <col style={{ width: "14mm" }} />
            <col style={{ width: "14mm" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Horno</th>
              <th>Nº ORDEN</th>
              <th>MODELO</th>
              <th>METROS</th>
              <th>ACB</th>
              <th>CEP</th>
              <th>CAJA</th>
              <th>TONO</th>
              <th>CALIBRE</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].flatMap((horno) => {
              const filasHorno = porHorno.get(horno) ?? [];
              return filasHorno.map((f, idx) => (
                <tr key={f.numeroOrden}>
                  {idx === 0 && (
                    <td className="col-horno" rowSpan={filasHorno.length}>
                      {horno}
                    </td>
                  )}
                  <td>{f.numeroOrden}</td>
                  <td className="col-modelo">{f.modelo}</td>
                  <td>{formatoMetros(f.metros)}</td>
                  <td>{f.acabado}</td>
                  <td>{f.cep ? "X" : ""}</td>
                  <td>{f.caja}</td>
                  <td>{f.tono ?? ""}</td>
                  <td>{f.calibre ?? ""}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
