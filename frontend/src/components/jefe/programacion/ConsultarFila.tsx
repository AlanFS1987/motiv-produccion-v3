// frontend/src/components/jefe/programacion/ConsultarFila.tsx
//
// Tarjeta de una orden en Consultar: número + copiar, datos, fecha de alta con
// insignia «Nueva hoy», tono y calibre EDITABLES en la fila (solo jefe/administrador;
// guardan al salir del campo), selección múltiple y notas (ver, editar, borrar).
// La lógica de datos vive en lib/programacion.ts y lib/programacion-notas.ts.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { actualizarTonoCalibre, type FilaConEstado } from "../../../lib/programacion";
import { borrarNota, editarNota, type NotaOrden } from "../../../lib/programacion-notas";
import { BotonCopiar, COLOR_ESTADO, ETIQUETA_ESTADO, formatoFechaISO, formatoMetros } from "./ui";

interface Props {
  fila: FilaConEstado;
  hoy: string;
  puedeEditar: boolean;
  seleccionada: boolean;
  onSeleccion: (marcada: boolean) => void;
  notas: NotaOrden[];
  onTonoCalibreGuardado: (numeroOrden: string, tono: string | null, calibre: string | null) => void;
  onNotasCambiadas: () => void;
}

function formatoFechaHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

function CampoTonoCalibre({
  etiqueta,
  valor,
  onCambio,
  onSalir,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  onSalir: () => void;
}) {
  const vacio = valor.trim() === "";
  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      {etiqueta}
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        onBlur={onSalir}
        maxLength={20}
        aria-label={etiqueta}
        className={`w-20 rounded border px-1.5 py-1 text-sm text-[var(--texto)] ${
          vacio ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"
        }`}
      />
      {vacio && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">falta {etiqueta.toLowerCase()}</span>}
    </label>
  );
}

function NotaItem({
  nota,
  puedeEditar,
  onCambiada,
}: {
  nota: NotaOrden;
  puedeEditar: boolean;
  onCambiada: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.texto);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(accion: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      setEditando(false);
      setConfirmandoBorrado(false);
      onCambiada();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
      {editando ? (
        <div className="space-y-1.5">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            rows={2}
            aria-label="Texto de la nota"
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={trabajando || !texto.trim()}
              onClick={() => ejecutar(() => editarNota(nota.id, texto))}
              className="flex items-center gap-1 rounded bg-slate-900 px-2 py-1 font-medium text-white disabled:opacity-40"
            >
              {trabajando ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />}
              Guardar
            </button>
            <button
              type="button"
              disabled={trabajando}
              onClick={() => {
                setEditando(false);
                setTexto(nota.texto);
                setError(null);
              }}
              className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-600"
            >
              <X size={12} aria-hidden /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="whitespace-pre-wrap text-sm text-[var(--texto)]">{nota.texto}</p>
            <p className="mt-0.5 text-slate-400">
              {nota.autor ?? "—"} · {formatoFechaHora(nota.creadaEn)}
              {nota.editadaEn !== nota.creadaEn && " · editada"}
            </p>
          </div>
          {puedeEditar && (
            <div className="flex shrink-0 gap-1">
              {confirmandoBorrado ? (
                <>
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => ejecutar(() => borrarNota(nota.id))}
                    className="rounded bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-40"
                  >
                    Borrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrado(false)}
                    className="rounded border border-slate-300 px-2 py-1 text-slate-600"
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditando(true)}
                    aria-label="Editar nota"
                    className="rounded border border-slate-300 p-1 text-slate-500 hover:bg-white"
                  >
                    <Pencil size={12} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrado(true)}
                    aria-label="Borrar nota"
                    className="rounded border border-slate-300 p-1 text-slate-500 hover:bg-white"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </li>
  );
}

export function ConsultarFila({
  fila,
  hoy,
  puedeEditar,
  seleccionada,
  onSeleccion,
  notas,
  onTonoCalibreGuardado,
  onNotasCambiadas,
}: Props) {
  const [tono, setTono] = useState(fila.tono ?? "");
  const [calibre, setCalibre] = useState(fila.calibre ?? "");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notasAbiertas, setNotasAbiertas] = useState(false);

  // Valores más recientes y último valor confirmado en BD, en refs para que los
  // guardados encadenados (salir de un campo y entrar al otro) no usen valores viejos.
  const actual = useRef({ tono: fila.tono ?? "", calibre: fila.calibre ?? "" });
  const guardado = useRef({ tono: fila.tono ?? "", calibre: fila.calibre ?? "" });
  const cola = useRef<Promise<void>>(Promise.resolve());

  // Sincroniza con la fila (recarga o guardado propio) SOLO los campos sin edición
  // pendiente: si el jefe ya está tecleando el calibre mientras se guarda el tono, su
  // texto no se pisa.
  useEffect(() => {
    const nuevo = { tono: fila.tono ?? "", calibre: fila.calibre ?? "" };
    const previo = guardado.current;
    if (actual.current.tono.trim() === previo.tono) {
      setTono(nuevo.tono);
      actual.current.tono = nuevo.tono;
    }
    if (actual.current.calibre.trim() === previo.calibre) {
      setCalibre(nuevo.calibre);
      actual.current.calibre = nuevo.calibre;
    }
    guardado.current = nuevo;
  }, [fila.tono, fila.calibre]);

  function guardarAhora(): Promise<void> {
    const quiero = { tono: actual.current.tono.trim(), calibre: actual.current.calibre.trim() };
    if (quiero.tono === guardado.current.tono && quiero.calibre === guardado.current.calibre) return Promise.resolve();
    setGuardando(true);
    setError(null);
    setOk(false);
    return actualizarTonoCalibre(fila.numeroOrden, quiero.tono, quiero.calibre)
      .then((res) => {
        guardado.current = { tono: res.tono ?? "", calibre: res.calibre ?? "" };
        onTonoCalibreGuardado(fila.numeroOrden, res.tono, res.calibre);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error guardando"))
      .finally(() => setGuardando(false));
  }

  function alSalirDeCampo() {
    cola.current = cola.current.then(guardarAhora);
  }

  const esNueva = fila.fechaAlta === hoy;

  return (
    <div className="flex flex-col gap-2 p-3 text-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          {puedeEditar && (
            <input
              type="checkbox"
              checked={seleccionada}
              onChange={(e) => onSeleccion(e.target.checked)}
              aria-label={`Seleccionar la orden ${fila.numeroOrden}`}
              className="h-4 w-4"
            />
          )}
          <span className="font-mono text-xs text-slate-500">{fila.numeroOrden}</span>
          <BotonCopiar texto={fila.numeroOrden} />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 font-medium text-[var(--texto)]">
            {fila.modelo}
            {esNueva && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                Nueva hoy
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {formatoMetros(fila.metros)} m² · Acabado {fila.acabado} · Caja {fila.caja}
            {fila.cep ? " · Cepillado" : ""}
            {!puedeEditar && fila.tono ? ` · Tono ${fila.tono}` : ""}
            {!puedeEditar && fila.calibre ? ` · Calibre ${fila.calibre}` : ""}
            {` · Alta ${formatoFechaISO(fila.fechaAlta)}`}
          </div>
        </div>

        <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[fila.estado]}`}>
          {ETIQUETA_ESTADO[fila.estado]}
        </span>
      </div>

      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <CampoTonoCalibre
            etiqueta="Tono"
            valor={tono}
            onCambio={(v) => {
              setTono(v);
              actual.current.tono = v;
            }}
            onSalir={alSalirDeCampo}
          />
          <CampoTonoCalibre
            etiqueta="Calibre"
            valor={calibre}
            onCambio={(v) => {
              setCalibre(v);
              actual.current.calibre = v;
            }}
            onSalir={alSalirDeCampo}
          />
          {guardando && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Guardando" />}
          {ok && <Check size={14} className="text-green-600" aria-label="Guardado" />}
          {error && (
            <span title={error} className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle size={14} aria-hidden /> {error}
            </span>
          )}
        </div>
      )}

      {(notas.length > 0 || puedeEditar) && (
        <div>
          <button
            type="button"
            onClick={() => setNotasAbiertas((a) => !a)}
            disabled={notas.length === 0}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
              notas.length > 0
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-400"
            }`}
          >
            <MessageSquare size={12} aria-hidden />
            {notas.length === 0 ? "Sin notas" : `${notas.length} ${notas.length === 1 ? "nota" : "notas"}`}
          </button>
          {notasAbiertas && notas.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">
              {notas.map((n) => (
                <NotaItem key={n.id} nota={n} puedeEditar={puedeEditar} onCambiada={onNotasCambiadas} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
