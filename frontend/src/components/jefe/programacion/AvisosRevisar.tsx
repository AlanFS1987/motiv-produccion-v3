// frontend/src/components/jefe/programacion/AvisosRevisar.tsx
//
// Bloque «Avisos» de Revisar (memorias/22, Mejora 2), antes de los hornos. Tres tipos
// (los calcula `validar_programacion` sobre el CSV crudo; aquí solo se presentan y se
// resuelven en el estado del cliente):
//   - Repetidas: las apariciones lado a lado, con los campos que difieren resaltados. La
//     app puede marcar la «Más completa», pero NUNCA preselecciona: el jefe elige
//     «Quedarme con esta» o «Editar y quedarme con esta». La elegida sustituye a la fila
//     que devuelve el diff; las demás se descartan.
//   - Incompletas (falta MODELO o METROS): completarlas en la fila o descartarlas.
//     ACABADO y CAJA vacíos NO son aviso (hay órdenes legítimas sin acabado).
//   - Descartadas por el parser: lista informativa con la línea cruda; no bloquea.

import { useState } from "react";
import { AlertTriangle, Check, Undo2 } from "lucide-react";
import { metrosDeTexto, type AvisoProgramacion } from "../../../lib/programacion";

/** Valores finales de una aparición elegida (ya interpretados). */
export interface CamposElegidos {
  linea: number;
  horno: number;
  posicion: number;
  modelo: string;
  metros: number | null;
  acabado: string;
  cep: boolean;
  caja: string;
}

export function camposDeAviso(a: AvisoProgramacion): CamposElegidos {
  return {
    linea: a.linea,
    horno: a.horno,
    posicion: a.posicion ?? 0,
    modelo: a.modelo.trim(),
    metros: metrosDeTexto(a.metros),
    acabado: a.acabado.trim(),
    cep: a.cep.trim().toUpperCase() === "X",
    caja: a.caja.trim(),
  };
}

type Campo = "horno" | "modelo" | "metros" | "acabado" | "cep" | "caja";
const ETIQUETA_CAMPO: Record<Campo, string> = {
  horno: "Horno",
  modelo: "Modelo",
  metros: "Metros",
  acabado: "Acabado",
  cep: "CEP",
  caja: "Caja",
};
const CAMPOS: Campo[] = ["horno", "modelo", "metros", "acabado", "cep", "caja"];

function valorComparable(c: CamposElegidos, campo: Campo): string {
  switch (campo) {
    case "horno":
      return String(c.horno);
    case "metros":
      return c.metros === null ? "" : String(c.metros);
    case "cep":
      return c.cep ? "X" : "";
    default:
      return c[campo].trim();
  }
}

function valorMostrado(c: CamposElegidos, campo: Campo): string {
  const v = campo === "metros" ? (c.metros === null ? "" : c.metros.toLocaleString("es-ES")) : valorComparable(c, campo);
  return v === "" ? "—" : v;
}

/** Cuántos de los 4 datos que importan tiene la aparición (modelo, metros, acabado, caja). */
function puntuacion(c: CamposElegidos): number {
  return [c.modelo !== "", c.metros !== null, c.acabado !== "", c.caja !== ""].filter(Boolean).length;
}

interface PropsRepetida {
  numeroOrden: string;
  apariciones: AvisoProgramacion[];
  resuelta: number | null; // línea elegida
  onElegir: (campos: CamposElegidos) => void;
  onDeshacer: () => void;
}

function TarjetaAparicion({
  aviso,
  diferentes,
  masCompleta,
  elegida,
  bloqueada,
  onElegir,
}: {
  aviso: AvisoProgramacion;
  diferentes: Set<Campo>;
  masCompleta: boolean;
  elegida: boolean;
  bloqueada: boolean;
  onElegir: (c: CamposElegidos) => void;
}) {
  const base = camposDeAviso(aviso);
  const [editando, setEditando] = useState(false);
  const [modelo, setModelo] = useState(base.modelo);
  const [metros, setMetros] = useState(aviso.metros.trim());
  const [acabado, setAcabado] = useState(base.acabado);
  const [cep, setCep] = useState(base.cep);
  const [caja, setCaja] = useState(base.caja);
  const [error, setError] = useState<string | null>(null);

  function guardarEdicion() {
    const m = metros.trim() === "" ? null : metrosDeTexto(metros);
    if (metros.trim() !== "" && m === null) {
      setError("METROS no válidos (ejemplo: 5.500).");
      return;
    }
    onElegir({ ...base, modelo: modelo.trim(), metros: m, acabado: acabado.trim(), cep, caja: caja.trim() });
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-2 text-xs ${
        elegida ? "border-green-400 bg-green-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-600">Línea {aviso.linea} del archivo</span>
        {masCompleta && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Más completa</span>
        )}
        {elegida && (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            <Check size={10} aria-hidden /> Elegida
          </span>
        )}
      </div>

      {editando ? (
        <div className="space-y-1.5">
          {[
            ["Modelo", modelo, setModelo],
            ["Metros", metros, setMetros],
            ["Acabado", acabado, setAcabado],
            ["Caja", caja, setCaja],
          ].map(([etiqueta, valor, set]) => (
            <label key={etiqueta as string} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-slate-500">{etiqueta as string}</span>
              <input
                value={valor as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-[var(--texto)]"
              />
            </label>
          ))}
          <label className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-slate-500">CEP</span>
            <input type="checkbox" checked={cep} onChange={(e) => setCep(e.target.checked)} className="h-4 w-4" />
          </label>
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={guardarEdicion}
              className="rounded bg-slate-900 px-2 py-1 font-medium text-white"
            >
              Guardar y quedarme con esta
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setError(null);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="space-y-1">
            {CAMPOS.map((campo) => {
              const falta = (campo === "modelo" || campo === "metros") && valorComparable(base, campo) === "";
              return (
                <div
                  key={campo}
                  className={`flex items-baseline gap-2 rounded px-1 ${
                    falta ? "bg-red-100" : diferentes.has(campo) ? "bg-amber-100" : ""
                  }`}
                >
                  <dt className="w-14 shrink-0 text-slate-500">{ETIQUETA_CAMPO[campo]}</dt>
                  <dd className="min-w-0 break-words font-medium text-[var(--texto)]">
                    {valorMostrado(base, campo)}
                    {falta && <span className="ml-1 text-[10px] font-semibold text-red-700">falta</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {!bloqueada && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onElegir(base)}
                className="rounded bg-slate-900 px-2 py-1 font-medium text-white"
              >
                Quedarme con esta
              </button>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
              >
                Editar y quedarme con esta
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GrupoRepetida({ numeroOrden, apariciones, resuelta, onElegir, onDeshacer }: PropsRepetida) {
  const campos = apariciones.map(camposDeAviso);
  const diferentes = new Set<Campo>(
    CAMPOS.filter((campo) => new Set(campos.map((c) => valorComparable(c, campo))).size > 1),
  );
  const mejor = Math.max(...campos.map(puntuacion));
  const conMejor = campos.filter((c) => puntuacion(c) === mejor);
  // Solo se marca si hay una ÚNICA más completa y no son todas iguales de completas.
  const lineaMasCompleta =
    conMejor.length === 1 && campos.some((c) => puntuacion(c) < mejor) ? conMejor[0].linea : null;

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-[var(--texto)]">
          <span className="font-mono">{numeroOrden}</span> aparece {apariciones.length} veces en el archivo
        </div>
        {resuelta !== null ? (
          <button
            type="button"
            onClick={onDeshacer}
            className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
          >
            <Undo2 size={12} aria-hidden /> Cambiar elección
          </button>
        ) : (
          <span className="text-xs font-medium text-red-700">Elige cuál es la buena</span>
        )}
      </div>
      {diferentes.size === 0 && (
        <p className="text-xs text-slate-500">Las filas son idénticas: elige cualquiera (se guardará una sola).</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {apariciones.map((a) => (
          <TarjetaAparicion
            key={a.linea}
            aviso={a}
            diferentes={diferentes}
            masCompleta={lineaMasCompleta === a.linea}
            elegida={resuelta === a.linea}
            bloqueada={resuelta !== null}
            onElegir={onElegir}
          />
        ))}
      </div>
    </div>
  );
}

interface PropsIncompleta {
  numeroOrden: string;
  modelo: string;
  metros: number | null;
  falta: string[];
  incluida: boolean;
  esNueva: boolean;
  onCompletar: (modelo: string, metros: number | null) => void;
  onDescartar: () => void;
}

function FilaIncompleta({ numeroOrden, modelo, metros, falta, incluida, esNueva, onCompletar, onDescartar }: PropsIncompleta) {
  const [modeloTxt, setModeloTxt] = useState(modelo);
  const [metrosTxt, setMetrosTxt] = useState(metros === null ? "" : String(metros));
  const [error, setError] = useState<string | null>(null);

  const completa = modelo.trim() !== "" && metros !== null && metros > 0;

  function aplicar(m: string, mt: string) {
    if (mt.trim() !== "" && metrosDeTexto(mt) === null) {
      setError("METROS no válidos (ejemplo: 5.500).");
      return;
    }
    setError(null);
    onCompletar(m.trim(), mt.trim() === "" ? null : metrosDeTexto(mt));
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-amber-200 bg-white p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-medium text-[var(--texto)]">{numeroOrden}</span>
        {!incluida ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">Descartada</span>
        ) : completa ? (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
            <Check size={10} aria-hidden /> Completa
          </span>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
            Falta {falta.join(" y ")}
          </span>
        )}
      </div>

      {incluida ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={modeloTxt}
            onChange={(e) => setModeloTxt(e.target.value)}
            onBlur={() => aplicar(modeloTxt, metrosTxt)}
            placeholder="Modelo"
            aria-label={`Modelo de la orden ${numeroOrden}`}
            className={`min-w-0 flex-1 rounded border px-1.5 py-1 text-[var(--texto)] ${
              modeloTxt.trim() === "" ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
            }`}
          />
          <input
            value={metrosTxt}
            onChange={(e) => setMetrosTxt(e.target.value)}
            onBlur={() => aplicar(modeloTxt, metrosTxt)}
            placeholder="Metros (5.500)"
            aria-label={`Metros de la orden ${numeroOrden}`}
            className={`w-28 rounded border px-1.5 py-1 text-[var(--texto)] ${
              metrosDeTexto(metrosTxt) === null ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
            }`}
          />
          <button
            type="button"
            onClick={onDescartar}
            className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
          >
            {esNueva ? "Descartar" : "Descartar (se eliminará de la programación)"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={onDescartar} className="rounded border border-slate-300 px-2 py-1 text-slate-600">
          Deshacer descarte
        </button>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}

export interface FilaParaAvisos {
  numeroOrden: string;
  modelo: string | null;
  metros: number | null;
  incluida: boolean;
  esNueva: boolean;
}

interface Props {
  avisos: AvisoProgramacion[];
  filas: FilaParaAvisos[];
  resoluciones: Record<string, number>;
  onElegir: (numeroOrden: string, campos: CamposElegidos) => void;
  onDeshacerEleccion: (numeroOrden: string) => void;
  onCompletar: (numeroOrden: string, modelo: string, metros: number | null) => void;
  onAlternarDescarte: (numeroOrden: string) => void;
}

export function AvisosRevisar({
  avisos,
  filas,
  resoluciones,
  onElegir,
  onDeshacerEleccion,
  onCompletar,
  onAlternarDescarte,
}: Props) {
  const repetidas = new Map<string, AvisoProgramacion[]>();
  for (const a of avisos) {
    if (a.tipo !== "repetida" || !a.numeroOrden) continue;
    if (!repetidas.has(a.numeroOrden)) repetidas.set(a.numeroOrden, []);
    repetidas.get(a.numeroOrden)!.push(a);
  }

  // Una orden con aviso de incompleta que NO es un duplicado sin resolver. (Si es un
  // duplicado, la falta se ve resaltada en su tarjeta; tras elegir, si la elegida sigue
  // incompleta, se completa aquí.)
  const incompletas = new Map<string, AvisoProgramacion>();
  for (const a of avisos) {
    if (a.tipo !== "incompleta" || !a.numeroOrden) continue;
    const esRepetida = repetidas.has(a.numeroOrden);
    if (esRepetida && resoluciones[a.numeroOrden] === undefined) continue;
    if (!incompletas.has(a.numeroOrden)) incompletas.set(a.numeroOrden, a);
  }

  const descartadas = avisos.filter((a) => a.tipo === "descartada");

  if (repetidas.size === 0 && incompletas.size === 0 && descartadas.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Avisos">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--texto)]">
        <AlertTriangle size={16} className="text-amber-600" aria-hidden /> Avisos
      </h3>

      {[...repetidas.entries()].map(([numero, apariciones]) => (
        <GrupoRepetida
          key={numero}
          numeroOrden={numero}
          apariciones={apariciones}
          resuelta={resoluciones[numero] ?? null}
          onElegir={(campos) => onElegir(numero, campos)}
          onDeshacer={() => onDeshacerEleccion(numero)}
        />
      ))}

      {incompletas.size > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Filas incompletas (falta modelo o metros). Complétalas aquí o descártalas; no se puede confirmar con una fila
            incompleta incluida.
          </p>
          {[...incompletas.entries()].map(([numero, aviso]) => {
            const fila = filas.find((f) => f.numeroOrden === numero);
            if (!fila) return null;
            return (
              <FilaIncompleta
                key={numero}
                numeroOrden={numero}
                modelo={fila.modelo ?? ""}
                metros={fila.metros}
                falta={aviso.falta}
                incluida={fila.incluida}
                esNueva={fila.esNueva}
                onCompletar={(m, mt) => onCompletar(numero, m, mt)}
                onDescartar={() => onAlternarDescarte(numero)}
              />
            );
          })}
        </div>
      )}

      {descartadas.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">
            {descartadas.length} {descartadas.length === 1 ? "línea ignorada" : "líneas ignoradas"} por el lector que
            parecen órdenes (informativo, no bloquea)
          </summary>
          <ul className="mt-2 space-y-1">
            {descartadas.map((a) => (
              <li key={a.linea} className="break-all font-mono">
                Línea {a.linea}: {(a.lineaCruda ?? "").replace(/;+$/, "")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
