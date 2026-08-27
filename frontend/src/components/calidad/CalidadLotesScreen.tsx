// frontend/src/components/calidad/CalidadLotesScreen.tsx
//
// Últimos 15 lotes (abiertos o cerrados), una tarjeta por lote con
// 2 donuts (completa 1ª/comercial/contenedor — eco no se usa aquí — y
// oficial 1ª/comercial). Buscador arriba: fecha, número de orden o
// modelo (autocompletado), un filtro activo a la vez. Click en la
// tarjeta expande el desglose por tono; botón de incidencias solo
// aparece si el lote tiene alguna.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search, XCircle } from "lucide-react";
import {
  obtenerLotesCalidad,
  obtenerConteoIncidenciasPorLotes,
  obtenerTonosPorLote,
  obtenerIncidenciasPorLote,
  buscarModelosAutocomplete,
  type LoteCalidad,
  type TonoCalidad,
  type IncidenciaLote,
  type ModoFiltroCalidad,
} from "../../lib/dashboard-calidad";

// ── Donut SVG propio (mismo patrón que pantalla/PantallaCarrusel.tsx,
// sin librería externa; no se importa de allí para no acoplar shells) ──
function Donut({ segmentos, size = 70 }: { segmentos: { valor: number; color: string }[]; size?: number }) {
  const radio = size / 2 - 8;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radio} fill="none" stroke="var(--superficie-alt)" strokeWidth={10} />
      {segmentos.map((s, i) => {
        const largo = (s.valor / 100) * circunferencia;
        const dasharray = `${largo} ${circunferencia - largo}`;
        const offset = -((acumulado / 100) * circunferencia);
        acumulado += s.valor;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radio}
            fill="none"
            stroke={s.color}
            strokeWidth={10}
            strokeDasharray={dasharray}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}

function DosDonuts({ lote }: { lote: LoteCalidad }) {
  return (
    <div className="flex items-center justify-around gap-4">
      <div className="flex flex-col items-center gap-1">
        <Donut
          segmentos={[
            { valor: lote.pct1aCompleta ?? 0, color: "#22c55e" },
            { valor: lote.pctComercialCompleta ?? 0, color: "#f97316" },
            { valor: lote.pctContenedorCompleta ?? 0, color: "#64748b" },
          ]}
        />
        <span className="text-[10px] text-[var(--texto-secundario)]">Completa {lote.pct1aCompleta ?? "—"}%</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Donut
          segmentos={[
            { valor: lote.pct1aOficial ?? 0, color: "#22c55e" },
            { valor: lote.pctComercialOficial ?? 0, color: "#f97316" },
          ]}
        />
        <span className="text-[10px] text-[var(--texto-secundario)]">Oficial {lote.pct1aOficial ?? "—"}%</span>
      </div>
    </div>
  );
}

function DosDonutsTono({ tono }: { tono: TonoCalidad }) {
  return (
    <div className="flex items-center justify-around gap-3">
      <div className="flex flex-col items-center gap-1">
        <Donut
          size={54}
          segmentos={[
            { valor: tono.pct1aCompleta ?? 0, color: "#22c55e" },
            { valor: tono.pctComercialCompleta ?? 0, color: "#f97316" },
            { valor: tono.pctContenedorCompleta ?? 0, color: "#64748b" },
          ]}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <Donut
          size={54}
          segmentos={[
            { valor: tono.pct1aOficial ?? 0, color: "#22c55e" },
            { valor: tono.pctComercialOficial ?? 0, color: "#f97316" },
          ]}
        />
      </div>
    </div>
  );
}

function TarjetaTonos({ loteId }: { loteId: string }) {
  const [tonos, setTonos] = useState<TonoCalidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerTonosPorLote(loteId)
      .then((data) => activo && setTonos(data))
      .catch((err) => activo && setError(err instanceof Error ? err.message : "Error cargando tonos"));
    return () => {
      activo = false;
    };
  }, [loteId]);

  if (error) return <p className="p-3 text-sm text-red-600">{error}</p>;
  if (!tonos) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-[var(--texto-secundario)]">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Cargando tonos…
      </div>
    );
  }
  if (tonos.length === 0) {
    return <p className="p-3 text-sm text-[var(--texto-secundario)]">Sin tonos completados todavía.</p>;
  }

  return (
    <div className="divide-y divide-[var(--borde)] border-t border-[var(--borde)]">
      {tonos.map((t) => (
        <div key={t.tono} className="flex items-center justify-between gap-3 p-3">
          <div className="text-sm">
            <p className="font-medium text-[var(--texto)]">Tono {t.tono}</p>
            <p className="text-xs text-[var(--texto-secundario)]">
              {t.piezasEntradas.toLocaleString("es-ES")} piezas · {Math.round(t.m2Total)} m²
            </p>
          </div>
          <DosDonutsTono tono={t} />
        </div>
      ))}
    </div>
  );
}

function PanelIncidencias({ loteId }: { loteId: string }) {
  const [incidencias, setIncidencias] = useState<IncidenciaLote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerIncidenciasPorLote(loteId)
      .then((data) => activo && setIncidencias(data))
      .catch((err) => activo && setError(err instanceof Error ? err.message : "Error cargando incidencias"));
    return () => {
      activo = false;
    };
  }, [loteId]);

  if (error) return <p className="p-3 text-sm text-red-600">{error}</p>;
  if (!incidencias) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-[var(--texto-secundario)]">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Cargando incidencias…
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-amber-200 bg-amber-50 p-3">
      {incidencias.map((inc) => (
        <div key={inc.id} className="rounded-lg border border-amber-200 bg-white p-2">
          <p className="mb-1 text-xs text-amber-600">
            {new Date(inc.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-sm text-amber-900">{inc.descripcion}</p>
          {inc.fotos && inc.fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {inc.fotos.map((url) => (
                <img key={url} src={url} alt="" className="h-20 w-20 rounded-md object-cover" />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TarjetaLote({ lote, numIncidencias }: { lote: LoteCalidad; numIncidencias: number }) {
  const [expandido, setExpandido] = useState(false);
  const [incidenciasAbiertas, setIncidenciasAbiertas] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] shadow-sm">
      <button onClick={() => setExpandido((v) => !v)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--texto)]">
            {lote.modeloNombre} · {lote.marcaNombre}
          </p>
          <p className="text-xs text-[var(--texto-secundario)]">
            Orden {lote.numeroOrden} · {lote.formatoNombre} · {lote.loteEstado}
          </p>
          <p className="text-xs text-[var(--texto-tenue)]">
            {lote.primeraProduccion} → {lote.ultimaProduccion} · {Math.round(lote.m2Total)} m² · {lote.piezasEntradas.toLocaleString("es-ES")} piezas
          </p>
        </div>
        <DosDonuts lote={lote} />
      </button>

      {numIncidencias > 0 && (
        <div className="border-t border-[var(--borde)] px-3 py-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIncidenciasAbiertas((v) => !v);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-600"
          >
            <XCircle size={14} aria-hidden />
            {numIncidencias} incidencia{numIncidencias > 1 ? "s" : ""} de calidad
          </button>
        </div>
      )}
      {incidenciasAbiertas && <PanelIncidencias loteId={lote.loteId} />}

      {expandido && <TarjetaTonos loteId={lote.loteId} />}
    </div>
  );
}

export function CalidadLotesScreen() {
  const [modo, setModo] = useState<ModoFiltroCalidad>("ninguno");
  const [valorFecha, setValorFecha] = useState("");
  const [valorOrden, setValorOrden] = useState("");
  const [valorModelo, setValorModelo] = useState("");
  const [sugerencias, setSugerencias] = useState<{ id: string; nombre: string }[]>([]);

  const [lotes, setLotes] = useState<LoteCalidad[]>([]);
  const [conteoIncidencias, setConteoIncidencias] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtroActivo = useMemo(() => {
    if (modo === "fecha" && valorFecha) return { modo, valor: valorFecha };
    if (modo === "orden" && valorOrden) return { modo, valor: valorOrden };
    if (modo === "modelo" && valorModelo) return { modo, valor: valorModelo };
    return { modo: "ninguno" as ModoFiltroCalidad };
  }, [modo, valorFecha, valorOrden, valorModelo]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerLotesCalidad(filtroActivo)
      .then(async (data) => {
        if (!activo) return;
        setLotes(data);
        const conteo = await obtenerConteoIncidenciasPorLotes(data.map((l) => l.loteId));
        if (activo) setConteoIncidencias(conteo);
        setError(null);
      })
      .catch((err) => activo && setError(err instanceof Error ? err.message : "Error cargando lotes"))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroActivo.modo, filtroActivo.valor]);

  // Autocompletado de modelo, con debounce simple
  useEffect(() => {
    if (modo !== "modelo") {
      setSugerencias([]);
      return;
    }
    const id = setTimeout(() => {
      buscarModelosAutocomplete(valorModelo).then(setSugerencias).catch(() => setSugerencias([]));
    }, 250);
    return () => clearTimeout(id);
  }, [modo, valorModelo]);

  function cambiarModo(nuevo: ModoFiltroCalidad) {
    setModo(nuevo);
    setValorFecha("");
    setValorOrden("");
    setValorModelo("");
    setSugerencias([]);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3">
        <div className="mb-2 flex gap-2 text-sm">
          {(["ninguno", "fecha", "orden", "modelo"] as ModoFiltroCalidad[]).map((m) => (
            <button
              key={m}
              onClick={() => cambiarModo(m)}
              className={`rounded-lg px-3 py-1.5 ${
                modo === m ? "bg-[var(--acento)] text-[var(--acento-texto)]" : "bg-[var(--superficie-alt)] text-[var(--texto-secundario)]"
              }`}
            >
              {m === "ninguno" ? "Últimos 15" : m === "fecha" ? "Por fecha" : m === "orden" ? "Por nº orden" : "Por modelo"}
            </button>
          ))}
        </div>

        {modo === "fecha" && (
          <input
            type="date"
            value={valorFecha}
            onChange={(e) => setValorFecha(e.target.value)}
            className="rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 text-sm"
          />
        )}
        {modo === "orden" && (
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-[var(--texto-tenue)]" aria-hidden />
            <input
              value={valorOrden}
              onChange={(e) => setValorOrden(e.target.value)}
              placeholder="Número de orden"
              className="w-full rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 pl-7 text-sm"
            />
          </div>
        )}
        {modo === "modelo" && (
          <div className="relative">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-[var(--texto-tenue)]" aria-hidden />
              <input
                value={valorModelo}
                onChange={(e) => setValorModelo(e.target.value)}
                placeholder="Nombre del modelo (ej. marmol)"
                className="w-full rounded-lg border border-[var(--borde)] bg-[var(--superficie)] p-2 pl-7 text-sm"
              />
            </div>
            {sugerencias.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--borde)] bg-[var(--superficie)] shadow-lg">
                {sugerencias.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setValorModelo(s.nombre);
                      setSugerencias([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--superficie-alt)]"
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--texto-secundario)]">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      ) : lotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--borde)] p-6 text-center text-sm text-[var(--texto-tenue)]">
          Sin lotes que coincidan.
        </p>
      ) : (
        <div className="space-y-2">
          {lotes.map((lote) => (
            <TarjetaLote key={lote.loteId} lote={lote} numIncidencias={conteoIncidencias[lote.loteId] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}