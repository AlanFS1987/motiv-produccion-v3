// frontend/src/components/jefe/ProgramacionScreen.tsx
//
// Pestaña "Programación" del jefe. Dos sub-vistas:
//   - Revisar: el diff editable contra el CSV pegado hoy en
//     admin_notas (tipo='programacion', pestaña del admin). Nuevo →
//     rellenar tono/calibre; eliminado → se puede "mantener" si el
//     jefe considera que el parser se equivocó; reordenado/sin
//     cambios → informativos, no bloquean. Confirmar ejecuta
//     confirmar_programacion con el estado final ya editado.
//   - Consultar: la lista de hoy, ya congelada, con estado en vivo
//     (pendiente/iniciado/finalizado vía JOIN contra `lote`) y botón
//     copiar → copiado en cada Nº ORDEN. Pensada para el móvil.
//
// PDF: pendiente (queda con el mismo formato que el papel de
// siempre, ver memorias/07-pendientes.md) — por ahora "Consultar" es
// solo la vista en pantalla; el botón de imprimir usa el diálogo de
// impresión del navegador (Guardar como PDF) con estilos @media print.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Printer, RefreshCw } from "lucide-react";
import {
  agruparPorHorno,
  confirmarProgramacion,
  hoyISO,
  listarProgramacionConEstado,
  obtenerDiffProgramacion,
  type CambioDiff,
  type Estado,
  type FilaAConfirmar,
  type FilaConEstado,
  type FilaDiff,
} from "../../lib/programacion";

type SubVista = "revisar" | "consultar";

// -----------------------------------------------------------------
// Utilidades de presentación
// -----------------------------------------------------------------

const ETIQUETA_CAMBIO: Record<CambioDiff, string> = {
  nuevo: "+ Nuevo",
  eliminado: "− Eliminado",
  reordenado: "~ Reordenado",
  sin_cambios: "= Sin cambios",
};

const COLOR_CAMBIO: Record<CambioDiff, string> = {
  nuevo: "bg-green-50 text-green-700 border-green-200",
  eliminado: "bg-red-50 text-red-700 border-red-200",
  reordenado: "bg-amber-50 text-amber-700 border-amber-200",
  sin_cambios: "bg-slate-50 text-slate-500 border-slate-200",
};

const COLOR_ESTADO: Record<Estado, string> = {
  pendiente: "bg-slate-100 text-slate-600",
  iniciado: "bg-blue-100 text-blue-700",
  finalizado: "bg-green-100 text-green-700",
};

const ETIQUETA_ESTADO: Record<Estado, string> = {
  pendiente: "Pendiente",
  iniciado: "Iniciado",
  finalizado: "Finalizado",
};

function formatoMetros(m: number | null): string {
  if (m === null) return "—";
  return m.toLocaleString("es-ES");
}

// -----------------------------------------------------------------
// Botón "copiar → copiado"
// -----------------------------------------------------------------

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // portapapeles no disponible (http sin TLS, permisos...) — no
      // rompemos la UI por esto, simplemente no confirmamos visualmente.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
        copiado
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {copiado ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

// -----------------------------------------------------------------
// Vista "Revisar" — diff editable
// -----------------------------------------------------------------

interface FilaEditable extends FilaDiff {
  // false = el jefe ha decidido invertir el destino por defecto:
  // - si cambio === 'eliminado' y incluida === true → se MANTIENE
  //   (el jefe considera que el parser se equivocó al marcarla).
  // - si cambio === 'nuevo' y incluida === false → se DESCARTA (no
  //   se añade, p.ej. una fila basura que coló el parser).
  incluida: boolean;
}

function ScreenRevisar() {
  const [fecha] = useState(hoyISO());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaEditable[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    setResultado(null);
    obtenerDiffProgramacion(fecha)
      .then((diff) =>
        setFilas(
          diff.map((f) => ({
            ...f,
            incluida: f.cambio !== "eliminado", // por defecto: se respeta lo que dice el parser
          })),
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando el diff"))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [fecha]);

  const porHorno = useMemo(() => agruparPorHorno(filas), [filas]);

  const nuevasPendientesDeTono = filas.filter(
    (f) => f.cambio === "nuevo" && f.incluida && !(f as any).tono,
  );

  function actualizarFila(numeroOrden: string, horno: number, cambios: Partial<FilaEditable>) {
    setFilas((prev) =>
      prev.map((f) => (f.horno === horno && f.numeroOrden === numeroOrden ? { ...f, ...cambios } : f)),
    );
  }

  async function confirmar() {
    setConfirmando(true);
    setError(null);
    try {
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
          tono: (f as any).tono ?? null,
          calibre: (f as any).calibre ?? null,
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
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setConfirmando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Comparando con el CSV de hoy...
      </div>
    );
  }

  if (filas.length === 0 && !error) {
    return (
      <div className="p-6 text-sm text-slate-500">
        No hay ningún CSV de programación pegado para hoy ({fecha}) en la pestaña del administrador,
        o no hay ningún cambio que revisar.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Revisión — {fecha}</h2>
        <button
          type="button"
          onClick={cargar}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={12} aria-hidden /> Recargar
        </button>
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
                    {ETIQUETA_CAMBIO[f.cambio]}
                  </span>

                  <div className="flex-1">
                    <div className="font-medium text-[var(--texto)]">
                      {f.numeroOrden} — {f.modelo}
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
                        defaultValue={(f as any).tono ?? ""}
                        onBlur={(e) => actualizarFila(f.numeroOrden, f.horno, { tono: e.target.value } as any)}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        placeholder="Calibre"
                        defaultValue={(f as any).calibre ?? ""}
                        onBlur={(e) => actualizarFila(f.numeroOrden, f.horno, { calibre: e.target.value } as any)}
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
          {nuevasPendientesDeTono.length > 0
            ? `${nuevasPendientesDeTono.length} pedido(s) nuevo(s) sin tono/calibre — puedes confirmar igualmente y rellenarlos después.`
            : "Todo listo."}
        </span>
        <button
          type="button"
          onClick={confirmar}
          disabled={confirmando}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {confirmando && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Confirmar y actualizar
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Vista "Consultar" — móvil, estado en vivo
// -----------------------------------------------------------------

function ScreenConsultar() {
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

      {[1, 2, 3, 4].map((horno) => {
        const filasHorno = porHorno.get(horno) ?? [];
        if (filasHorno.length === 0) return null;
        return (
          <div key={horno} className="overflow-hidden rounded-xl border border-slate-200 print:break-inside-avoid">
            <div className="bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white print:bg-slate-200 print:text-slate-900">
              🔥 Horno {horno}
            </div>
            <div className="divide-y divide-slate-100">
              {filasHorno.map((f) => (
                <div key={f.numeroOrden} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{f.numeroOrden}</span>
                    <span className="print:hidden">
                      <BotonCopiar texto={f.numeroOrden} />
                    </span>
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
  );
}

// -----------------------------------------------------------------
// Contenedor con las dos sub-pestañas
// -----------------------------------------------------------------

export function ProgramacionScreen() {
  const [vista, setVista] = useState<SubVista>("consultar");

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex gap-1 border-b border-slate-200 px-4 print:hidden">
        <button
          type="button"
          onClick={() => setVista("consultar")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            vista === "consultar"
              ? "border-[var(--acento)] text-[var(--texto)]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Consultar
        </button>
        <button
          type="button"
          onClick={() => setVista("revisar")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            vista === "revisar"
              ? "border-[var(--acento)] text-[var(--texto)]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Revisar
        </button>
      </div>

      {vista === "consultar" ? <ScreenConsultar /> : <ScreenRevisar />}
    </div>
  );
}
