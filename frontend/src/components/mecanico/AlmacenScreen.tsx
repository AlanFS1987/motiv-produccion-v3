// frontend/src/components/mecanico/AlmacenScreen.tsx
//
// Almacén de repuestos, pieza 1 (solo lectura): árbol máquina →
// categoría → repuestos, y ficha de repuesto con stock, referencias
// e historial de movimientos.

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Package, ArrowLeft, Plus } from "lucide-react";
import {
  listarCategorias,
  listarRepuestosPorCategoria,
  obtenerFichaRepuesto,
  type AlmacenCategoria,
  type RepuestoResumen,
  type RepuestoFicha,
} from "../../lib/almacen";
import { NuevoRepuestoForm } from "./NuevoRepuestoForm";

const NOMBRE_TIPO_MOVIMIENTO: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function BadgeStock({ stock }: { stock: number }) {
  if (stock < 0) {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{stock} (negativo)</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{stock}</span>;
}

function FichaRepuesto({ repuestoId, onVolver }: { repuestoId: string; onVolver: () => void }) {
  const [ficha, setFicha] = useState<RepuestoFicha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerFichaRepuesto(repuestoId)
      .then(setFicha)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCargando(false));
  }, [repuestoId]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button type="button" onClick={onVolver} className="flex items-center gap-1 text-sm text-[var(--texto-secundario)]">
        <ArrowLeft size={14} aria-hidden />
        Volver al almacén
      </button>

      {cargando && <p className="text-sm text-[var(--texto-secundario)]">Cargando...</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {ficha && (
        <>
          <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            {ficha.imagenUrl && <img src={ficha.imagenUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />}
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{ficha.nombre}</h3>
                <BadgeStock stock={ficha.stock} />
              </div>
              {ficha.descripcion && <p className="text-sm text-slate-500">{ficha.descripcion}</p>}
            </div>
          </div>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-[var(--texto)]">Referencias</h4>
            {ficha.referencias.length === 0 ? (
              <p className="text-sm text-[var(--texto-secundario)]">Sin referencias todavía.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {ficha.referencias.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 text-sm">
                    <span className="text-slate-700">{r.proveedorNombre}</span>
                    <span className="font-mono text-slate-500">{r.codigo}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-[var(--texto)]">Movimientos</h4>
            {ficha.movimientos.length === 0 ? (
              <p className="text-sm text-[var(--texto-secundario)]">Sin movimientos todavía.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {ficha.movimientos.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <span className={`font-medium ${m.cantidad >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {m.cantidad >= 0 ? "+" : ""}
                      {m.cantidad}
                    </span>
                    <span className="text-slate-500">{NOMBRE_TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</span>
                    <span className="text-slate-400">· {formatearFecha(m.fecha)}</span>
                    {m.mecanicoUsername && <span className="text-slate-400">· {m.mecanicoUsername}</span>}
                    {m.nota && <span className="w-full text-xs text-slate-400">{m.nota}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Categoria({ categoria, onAbrirRepuesto }: { categoria: AlmacenCategoria; onAbrirRepuesto: (id: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [repuestos, setRepuestos] = useState<RepuestoResumen[] | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alternar() {
    const nuevoEstado = !abierta;
    setAbierta(nuevoEstado);
    if (nuevoEstado && repuestos === null) {
      setCargando(true);
      try {
        setRepuestos(await listarRepuestosPorCategoria(categoria.id));
      } finally {
        setCargando(false);
      }
    }
  }

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" onClick={alternar} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700">
        {abierta ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        {categoria.nombre}
      </button>
      {abierta && (
        <div className="bg-slate-50 pb-2 pl-8 pr-3">
          {cargando && <p className="py-2 text-xs text-slate-400">Cargando...</p>}
          {repuestos && repuestos.length === 0 && <p className="py-2 text-xs text-slate-400">Sin repuestos en esta categoría.</p>}
          {repuestos?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onAbrirRepuesto(r.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-white"
            >
              <span className="flex items-center gap-2">
                <Package size={14} className="text-slate-400" aria-hidden />
                {r.nombre}
              </span>
              <BadgeStock stock={r.stock} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoMaquina({
  maquina,
  categorias,
  onAbrirRepuesto,
}: {
  maquina: string;
  categorias: AlmacenCategoria[];
  onAbrirRepuesto: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-900"
      >
        {abierto ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        {maquina === "por_catalogar" ? "Por catalogar" : maquina}
      </button>
      {abierto && (
        <div>
          {categorias.map((c) => (
            <Categoria key={c.id} categoria={c} onAbrirRepuesto={onAbrirRepuesto} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AlmacenScreen() {
  const [categorias, setCategorias] = useState<AlmacenCategoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repuestoAbierto, setRepuestoAbierto] = useState<string | null>(null);
  const [mostrandoAlta, setMostrandoAlta] = useState(false);

  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCargando(false));
  }, []);

  if (repuestoAbierto) {
    return <FichaRepuesto repuestoId={repuestoAbierto} onVolver={() => setRepuestoAbierto(null)} />;
  }

  if (mostrandoAlta) {
    return (
      <NuevoRepuestoForm
        onCreado={(id) => {
          setMostrandoAlta(false);
          setRepuestoAbierto(id);
        }}
        onCancelar={() => setMostrandoAlta(false)}
      />
    );
  }

  const grupos = new Map<string, AlmacenCategoria[]>();
  for (const c of categorias) {
    const lista = grupos.get(c.maquina) ?? [];
    lista.push(c);
    grupos.set(c.maquina, lista);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--texto)]">Almacén</h2>
        <button
          type="button"
          onClick={() => setMostrandoAlta(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={14} aria-hidden />
          Nuevo repuesto
        </button>
      </div>
      {cargando && <p className="text-sm text-[var(--texto-secundario)]">Cargando...</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {[...grupos.entries()].map(([maquina, cats]) => (
          <GrupoMaquina key={maquina} maquina={maquina} categorias={cats} onAbrirRepuesto={setRepuestoAbierto} />
        ))}
      </div>
    </div>
  );
}