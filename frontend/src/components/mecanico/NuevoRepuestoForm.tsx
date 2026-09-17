// frontend/src/components/mecanico/NuevoRepuestoForm.tsx
//
// Formulario único de "nuevo repuesto" (17-rol-mecanico-plan.md 3.5),
// pensado para reutilizarse tanto desde el árbol del almacén como,
// más adelante, desde "añadir línea a un pedido con repuesto que no
// existe todavía". Categoría siempre obligatoria — "por catalogar"
// va preseleccionada si no se pasa nada mejor.

import { useEffect, useState } from "react";
import { Plus, Trash2, PackagePlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SelectorFotosMultiple } from "../incidencias/SelectorFotosMultiple";
import {
  listarCategorias,
  listarProveedores,
  crearProveedor,
  crearCategoria,
  crearRepuesto,
  type AlmacenCategoria,
  type AlmacenProveedor,
} from "../../lib/almacen";

interface FotoSubida {
  url: string;
  previsualizacion: string;
}

interface FilaReferencia {
  clave: string; // solo para el key de React, no se envía
  proveedorId: string; // "" | "__nuevo__" | id existente
  proveedorNuevoNombre: string;
  codigo: string;
}

function nuevaFila(): FilaReferencia {
  return { clave: crypto.randomUUID(), proveedorId: "", proveedorNuevoNombre: "", codigo: "" };
}

interface NuevoRepuestoFormProps {
  onCreado: (repuestoId: string) => void;
  onCancelar: () => void;
}

export function NuevoRepuestoForm({ onCreado, onCancelar }: NuevoRepuestoFormProps) {
  const { usuario } = useAuth();
  const [categorias, setCategorias] = useState<AlmacenCategoria[]>([]);
  const [proveedores, setProveedores] = useState<AlmacenProveedor[]>([]);
  const [cargandoBase, setCargandoBase] = useState(true);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [nuevaMaquina, setNuevaMaquina] = useState("");
  const [nuevaSubmaquina, setNuevaSubmaquina] = useState("");
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [foto, setFoto] = useState<FotoSubida[]>([]);
  const [referencias, setReferencias] = useState<FilaReferencia[]>([nuevaFila()]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarCategorias(), listarProveedores()])
      .then(([cats, provs]) => {
        setCategorias(cats);
        setProveedores(provs);
        const porCatalogar = cats.find((c) => c.clave === "por_catalogar");
        setCategoriaId(porCatalogar?.id ?? cats[0]?.id ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCargandoBase(false));
  }, []);

  function actualizarFila(clave: string, cambios: Partial<FilaReferencia>) {
    setReferencias((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function quitarFila(clave: string) {
    setReferencias((prev) => prev.filter((f) => f.clave !== clave));
  }

  const categoriaNuevaValida = categoriaId !== "__nueva__" || (nuevaMaquina.trim() !== "" && nuevaCategoriaNombre.trim() !== "");
  const valido = nombre.trim() !== "" && categoriaId !== "" && categoriaNuevaValida;

  async function guardar() {
    if (!valido || !usuario) return;
    setGuardando(true);
    setError(null);
    try {
      // Resolver categoría nueva antes de crear el repuesto, igual
      // que ya se hace con proveedores nuevos más abajo.
      let categoriaFinal = categoriaId;
      if (categoriaId === "__nueva__") {
        categoriaFinal = await crearCategoria(nuevaMaquina, nuevaSubmaquina.trim() || null, nuevaCategoriaNombre);
      }

      // Resolver proveedores nuevos antes de crear el repuesto —
      // cada fila "__nuevo__" con nombre se crea primero y se
      // sustituye por su id real.
      const referenciasResueltas = [];
      for (const fila of referencias) {
        if (fila.proveedorId === "__nuevo__" && fila.proveedorNuevoNombre.trim()) {
          const id = await crearProveedor(fila.proveedorNuevoNombre);
          referenciasResueltas.push({ proveedorId: id, codigo: fila.codigo });
        } else if (fila.proveedorId && fila.proveedorId !== "__nuevo__") {
          referenciasResueltas.push({ proveedorId: fila.proveedorId, codigo: fila.codigo });
        }
      }

      const id = await crearRepuesto({
        nombre,
        descripcion: descripcion.trim() || null,
        categoriaId: categoriaFinal,
        imagenUrl: foto[0]?.url ?? null,
        createdBy: usuario.id,
        referencias: referenciasResueltas,
      });
      onCreado(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGuardando(false);
    }
  }

  if (cargandoBase) {
    return <p className="mx-auto max-w-md text-sm text-slate-400">Cargando...</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <PackagePlus size={18} className="text-slate-700" aria-hidden />
        <p className="text-sm font-medium text-slate-900">Nuevo repuesto</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          placeholder="Ej. Rodamiento 6204-2RS"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Descripción (opcional)</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.clave === "por_catalogar" ? "Por catalogar" : `${c.maquina} — ${c.nombre}`}
            </option>
          ))}
          <option value="__nueva__">+ Categoría nueva</option>
        </select>

        {categoriaId === "__nueva__" ? (
          <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 p-2">
            <input
              value={nuevaMaquina}
              onChange={(e) => setNuevaMaquina(e.target.value)}
              placeholder="Máquina (ej. BS08)"
              className="w-full rounded border border-slate-300 p-1.5 text-xs"
            />
            <input
              value={nuevaSubmaquina}
              onChange={(e) => setNuevaSubmaquina(e.target.value)}
              placeholder="Submáquina (opcional)"
              className="w-full rounded border border-slate-300 p-1.5 text-xs"
            />
            <input
              value={nuevaCategoriaNombre}
              onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
              placeholder="Nombre de la categoría (ej. Divisor)"
              className="w-full rounded border border-slate-300 p-1.5 text-xs"
            />
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-400">Si no sabes dónde encaja, déjalo en "Por catalogar" — se puede cambiar después.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Foto (opcional)</label>
        <SelectorFotosMultiple fotos={foto} onCambiar={setFoto} publicIdPrefijo="REPUESTO" categoria="almacen-repuestos" maxFotos={1} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-500">Referencias (opcional)</label>
          <button
            type="button"
            onClick={() => setReferencias((prev) => [...prev, nuevaFila()])}
            className="flex items-center gap-1 text-xs text-slate-500 underline"
          >
            <Plus size={12} aria-hidden />
            Añadir
          </button>
        </div>

        <div className="space-y-2">
          {referencias.map((fila) => (
            <div key={fila.clave} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2">
              <div className="flex-1 space-y-1">
                <select
                  value={fila.proveedorId}
                  onChange={(e) => actualizarFila(fila.clave, { proveedorId: e.target.value })}
                  className="w-full rounded border border-slate-300 p-1.5 text-xs"
                >
                  <option value="">Elegir proveedor...</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                  <option value="__nuevo__">+ Proveedor nuevo</option>
                </select>
                {fila.proveedorId === "__nuevo__" && (
                  <input
                    value={fila.proveedorNuevoNombre}
                    onChange={(e) => actualizarFila(fila.clave, { proveedorNuevoNombre: e.target.value })}
                    placeholder="Nombre del proveedor"
                    className="w-full rounded border border-slate-300 p-1.5 text-xs"
                  />
                )}
                <input
                  value={fila.codigo}
                  onChange={(e) => actualizarFila(fila.clave, { codigo: e.target.value })}
                  placeholder="Código del proveedor"
                  className="w-full rounded border border-slate-300 p-1.5 text-xs"
                />
              </div>
              {referencias.length > 1 && (
                <button type="button" onClick={() => quitarFila(fila.clave)} className="mt-1 text-slate-300 hover:text-red-500">
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || guardando}
          onClick={guardar}
          className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}