// frontend/src/components/jefe/programacion/ProgramacionConsultar.tsx
//
// Sub-vista "Consultar" de la pestaña Programación: la lista de hoy,
// ya congelada, con estado en vivo (pendiente/iniciado/finalizado vía
// JOIN contra `lote`) y botón copiar → copiado en cada Nº ORDEN.
// Pensada para el móvil.
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
// qué columna se puede recortar más (ver 20-programacion.md).

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Printer, RefreshCw } from "lucide-react";
import { agruparPorHorno, listarProgramacionConEstado, type FilaConEstado } from "../../../lib/programacion";
import { BotonCopiar, COLOR_ESTADO, ETIQUETA_ESTADO, formatoMetros } from "./ui";

export function ProgramacionConsultar() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaConEstado[]>([]);

  function cargar() {
    setCargando(true);
    listarProgramacionConEstado()
      .then(setFilas)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando"))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  const porHorno = useMemo(() => agruparPorHorno(filas), [filas]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 print:p-0">
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

      {filas.length === 0 && !error && (
        <div className="p-6 text-sm text-slate-500">
          Todavía no hay ninguna programación confirmada. Ve a "Revisar" para generarla.
        </div>
      )}

      {/* Vista de tarjetas — solo pantalla / móvil */}
      <div className="space-y-4 print:hidden">
        {[1, 2, 3, 4].map((horno) => {
          const filasHorno = porHorno.get(horno) ?? [];
          if (filasHorno.length === 0) return null;
          return (
            <div key={horno} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">🔥 Horno {horno}</div>
              <div className="divide-y divide-slate-100">
                {filasHorno.map((f) => (
                  <div key={f.numeroOrden} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{f.numeroOrden}</span>
                      <BotonCopiar texto={f.numeroOrden} />
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-[var(--texto)]">{f.modelo}</div>
                      <div className="text-xs text-slate-500">
                        {formatoMetros(f.metros)} m² · Acabado {f.acabado} · Caja {f.caja}
                        {f.cep ? " · Cepillado" : ""}
                        {f.tono ? ` · Tono ${f.tono}` : ""}
                        {f.calibre ? ` · Calibre ${f.calibre}` : ""}
                      </div>
                    </div>

                    <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[f.estado]}`}>
                      {ETIQUETA_ESTADO[f.estado]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

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
