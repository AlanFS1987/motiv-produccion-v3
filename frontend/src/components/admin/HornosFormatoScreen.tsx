// frontend/src/components/admin/HornosFormatoScreen.tsx
//
// Pestaña "Hornos" del admin: producción nominal del horno por formato (m²/día de
// cada horno), nº de hornos y de líneas habituales. Alimenta la línea de nivel
// medio del horno y el balance horno vs clasificación de la pestaña Alimentación
// (memorias/21-alimentacion.md). Cada fila vale desde una fecha: para cambiar la
// consigna de un horno sin falsear el histórico, se guarda con una fecha nueva.
// Escritura solo por la RPC guardar_horno_formato (solo administrador).

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { guardarHornoFormato, listarHornoFormato, type HornoFormato } from "../../lib/horno-formato";
import { hoyLocalISO } from "../../lib/fechas";

const ent = (n: number) => Math.round(n).toLocaleString("es-ES");

function FilaFormato({ actual, historico, onGuardada }: { actual: HornoFormato; historico: HornoFormato[]; onGuardada: () => void }) {
  const [metros, setMetros] = useState(String(actual.metrosDiaHorno));
  const [hornos, setHornos] = useState(String(actual.hornos));
  const [lineas, setLineas] = useState(String(actual.lineas));
  const [desde, setDesde] = useState(actual.vigenteDesde);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrosN = Number(metros.replace(",", "."));
  const hornosN = Number(hornos);
  const lineasN = Number(lineas);
  const valido = metrosN > 0 && Number.isInteger(hornosN) && hornosN >= 1 && Number.isInteger(lineasN) && lineasN >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(desde);
  const cambiado = metrosN !== actual.metrosDiaHorno || hornosN !== actual.hornos || lineasN !== actual.lineas || desde !== actual.vigenteDesde;
  const esNuevaVersion = desde !== actual.vigenteDesde;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await guardarHornoFormato({ formatoId: actual.formatoId, vigenteDesde: desde, metrosDiaHorno: metrosN, hornos: hornosN, lineas: lineasN });
      setOk(true);
      onGuardada();
      setTimeout(() => setOk(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  }

  const necesarioPorLinea = valido ? (metrosN * hornosN) / lineasN / actual.areaM2 / 3 : null;
  const campo = "rounded border border-[var(--borde)] bg-[var(--superficie)] px-2 py-1 text-sm";

  return (
    <div className="space-y-1 rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-24">
          <div className="text-sm font-semibold text-[var(--texto)]">{actual.formato}</div>
          <div className="text-xs text-[var(--texto-tenue)]">{actual.areaM2.toLocaleString("es-ES")} m²/pieza</div>
        </div>
        <label className="text-xs text-[var(--texto-secundario)]">
          m²/día por horno
          <input value={metros} onChange={(e) => setMetros(e.target.value)} inputMode="decimal" className={`${campo} mt-0.5 block w-24`} />
        </label>
        <label className="text-xs text-[var(--texto-secundario)]">
          Hornos
          <input value={hornos} onChange={(e) => setHornos(e.target.value)} inputMode="numeric" className={`${campo} mt-0.5 block w-16`} />
        </label>
        <label className="text-xs text-[var(--texto-secundario)]">
          Líneas
          <input value={lineas} onChange={(e) => setLineas(e.target.value)} inputMode="numeric" className={`${campo} mt-0.5 block w-16`} />
        </label>
        <label className="text-xs text-[var(--texto-secundario)]">
          Vigente desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${campo} mt-0.5 block`} />
        </label>
        <button
          type="button"
          onClick={guardar}
          disabled={!valido || !cambiado || guardando}
          className="rounded-lg bg-[var(--acento)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {esNuevaVersion ? "Guardar versión nueva" : "Guardar"}
        </button>
        {guardando && <Loader2 size={14} className="animate-spin text-[var(--texto-tenue)]" aria-hidden />}
        {ok && <Check size={14} className="text-green-600" aria-hidden />}
      </div>
      {necesarioPorLinea !== null && (
        <p className="text-xs text-[var(--texto-secundario)]">
          Cada línea debe clasificar de media unas <strong className="text-[var(--texto)]">{ent(necesarioPorLinea)}</strong> piezas por turno ({ent((metrosN * hornosN) / 3)} m² por turno entre{" "}
          {lineasN} línea{lineasN === 1 ? "" : "s"}).
        </p>
      )}
      {historico.length > 0 && (
        <p className="text-xs text-[var(--texto-tenue)]">
          Versiones anteriores:{" "}
          {historico.map((h) => `${h.vigenteDesde}: ${ent(h.metrosDiaHorno)} m² · ${h.hornos} horno${h.hornos === 1 ? "" : "s"} · ${h.lineas} línea${h.lineas === 1 ? "" : "s"}`).join(" | ")}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle size={12} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export function HornosFormatoScreen() {
  const [filas, setFilas] = useState<HornoFormato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setError(null);
    listarHornoFormato()
      .then(setFilas)
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando"))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  // Por formato: la versión vigente hoy (la más reciente que ya ha empezado) y el resto como histórico.
  const porFormato = useMemo(() => {
    const hoy = hoyLocalISO();
    const mapa = new Map<string, HornoFormato[]>();
    for (const f of filas) mapa.set(f.formato, [...(mapa.get(f.formato) ?? []), f]);
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
      .map(([formato, versiones]) => {
        const ordenadas = [...versiones].sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde));
        const actual = ordenadas.find((v) => v.vigenteDesde <= hoy) ?? ordenadas[0];
        return { formato, actual, historico: ordenadas.filter((v) => v !== actual) };
      });
  }, [filas]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-[var(--texto-tenue)]">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Cargando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
        Producción nominal de cada horno por formato. El horno cuece a ritmo constante, así que un turno es un tercio del día. Para cambiar la consigna de un horno sin tocar el histórico,
        pon la fecha en que entra en vigor y pulsa «Guardar versión nueva». «Hornos» y «Líneas» son el reparto HABITUAL de ese formato (p. ej. 2 hornos y 3 líneas en 600x1200) y solo sirven
        para calcular el nivel medio por línea: el balance horno vs clasificación infiere día a día qué horno cuece cada formato.
      </div>
      {porFormato.map(({ formato, actual, historico }) => (
        <FilaFormato key={`${formato}|${actual.vigenteDesde}|${actual.metrosDiaHorno}|${actual.hornos}|${actual.lineas}`} actual={actual} historico={historico} onGuardada={cargar} />
      ))}
      {porFormato.length === 0 && <p className="text-sm text-[var(--texto-tenue)]">No hay ningún formato configurado.</p>}
    </div>
  );
}
