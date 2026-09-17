// frontend/src/components/mecanico/EngraseScreen.tsx
//
// Checklist de engrase — "parte" al mismo estilo que producción:
// línea + fecha + mecánico + qué puntos se marcaron. Sin disparador:
// solo registra, no avisa de cuándo toca.

import { useEffect, useState } from "react";
import { Droplet, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { listarLineas, type Linea } from "../../lib/turno";
import {
  crearParteEngrase,
  listarHistorialEngrase,
  listarPuntosEngrase,
  type EngraseParteItem,
  type EngrasePunto,
} from "../../lib/mecanico-engrase";

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function FormularioNuevoParte({
  lineas,
  puntos,
  onGuardado,
  onCancelar,
}: {
  lineas: Linea[];
  puntos: EngrasePunto[];
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { usuario } = useAuth();
  const [lineaId, setLineaId] = useState(lineas[0]?.id ?? "");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternar(id: string) {
    setMarcados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function guardar() {
    if (!usuario || !lineaId) return;
    setGuardando(true);
    setError(null);
    try {
      await crearParteEngrase(lineaId, usuario.id, [...marcados]);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Droplet size={18} className="text-blue-500" aria-hidden />
        <p className="text-sm font-medium text-slate-900">Nuevo parte de engrase</p>
      </div>

      <label className="mb-1 block text-xs font-medium text-slate-500">Línea</label>
      <select
        value={lineaId}
        onChange={(e) => setLineaId(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
      >
        {lineas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nombre}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium text-slate-500">
        Puntos revisados/engrasados ({marcados.size}/{puntos.length})
      </label>
      <div className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {puntos.map((p) => (
          <label key={p.id} className="flex items-center gap-2 p-2 text-sm text-slate-700">
            <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
            {p.nombre}
          </label>
        ))}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        No hace falta marcarlos todos — el parte se guarda igual con los que hayas hecho.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!lineaId || guardando}
          onClick={guardar}
          className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function TarjetaParte({ item }: { item: EngraseParteItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{item.lineaNombre}</span>
        <span>· {formatearFecha(item.fecha)}</span>
        <span className="ml-auto">{item.mecanicoUsername}</span>
      </div>
      {item.puntosMarcados.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {item.puntosMarcados.map((nombre) => (
            <span key={nombre} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              {nombre}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Ningún punto marcado en este parte.</p>
      )}
    </div>
  );
}

export function EngraseScreen() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [puntos, setPuntos] = useState<EngrasePunto[]>([]);
  const [historial, setHistorial] = useState<EngraseParteItem[]>([]);
  const [filtroLinea, setFiltroLinea] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrandoForm, setMostrandoForm] = useState(false);

  async function cargarBase() {
    setCargando(true);
    setError(null);
    try {
      const [l, p, h] = await Promise.all([listarLineas(), listarPuntosEngrase(), listarHistorialEngrase()]);
      setLineas(l);
      setPuntos(p);
      setHistorial(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarBase();
  }, []);

  async function manejarFiltro(linea: string) {
    setFiltroLinea(linea);
    try {
      setHistorial(await listarHistorialEngrase(linea || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (mostrandoForm) {
    return (
      <FormularioNuevoParte
        lineas={lineas}
        puntos={puntos}
        onGuardado={() => {
          setMostrandoForm(false);
          cargarBase();
        }}
        onCancelar={() => setMostrandoForm(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Engrase</h2>
        <button
          type="button"
          onClick={() => setMostrandoForm(true)}
          disabled={cargando || puntos.length === 0}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus size={14} aria-hidden />
          Nuevo parte
        </button>
      </div>

      <select
        value={filtroLinea}
        onChange={(e) => manejarFiltro(e.target.value)}
        className="rounded-lg border border-slate-300 p-2 text-sm"
      >
        <option value="">Todas las líneas</option>
        {lineas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nombre}
          </option>
        ))}
      </select>

      {cargando && <p className="text-sm text-[var(--texto-secundario)]">Cargando...</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {!cargando && historial.length === 0 && (
        <p className="text-sm text-[var(--texto-secundario)]">Todavía no hay ningún parte de engrase.</p>
      )}

      <div className="space-y-2">
        {historial.map((item) => (
          <TarjetaParte key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}