// frontend/src/components/admin/CorreccionPartesScreen.tsx
// "Corrección de partes sin límite de tiempo" (09-administrador.md).
// El admin busca cualquier parte vigente+completado (sin restringir
// a "hoy" ni a la ventana de 1h del responsable) y lo corrige con el
// mismo formulario que ya usa el responsable (FotoPantallaMaquina
// modo="corregir") — la diferencia de permisos ya la resuelve BD
// (política parte_admin_todo + trigger security definer, sesión
// 20/08/2026); aquí solo se quita el candado de la UI.
//
// contexto.responsableId al corregir = el ADMIN (quien corrige), no
// el responsable original — igual que ya hace el propio responsable
// al corregirse a sí mismo, así queda registrado quién hizo cada
// corrección.

import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase-client";
import { buscarPartes, type FiltrosBusquedaPartes, type ParteBusqueda } from "../../lib/admin-partes";
import { obtenerParteDetalle, type ParteDetalle } from "../../lib/parte";
import { FotoPantallaMaquina } from "../captura-parte/FotoPantallaMaquina";

const NOMBRE_TURNO: Record<"M" | "T" | "N", string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function fechaISOHaceNDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type Vista = "lista" | "cargando-detalle" | "detalle" | "editando";

export function CorreccionPartesScreen() {
  const { usuario } = useAuth();

  const [fechaDesde, setFechaDesde] = useState(fechaISOHaceNDias(7));
  const [fechaHasta, setFechaHasta] = useState(fechaISOHaceNDias(0));
  const [turnoFiltro, setTurnoFiltro] = useState<"" | "M" | "T" | "N">("");
  const [lineaFiltro, setLineaFiltro] = useState("");
  const [responsableFiltro, setResponsableFiltro] = useState("");
  const [lineasOpciones, setLineasOpciones] = useState<string[]>([]);

  const [resultados, setResultados] = useState<ParteBusqueda[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("lista");
  const [parteDetalle, setParteDetalle] = useState<ParteDetalle | null>(null);

  useEffect(() => {
    supabase
      .from("linea")
      .select("nombre")
      .order("nombre")
      .then(({ data }) => setLineasOpciones((data ?? []).map((l) => l.nombre as string)));
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscar() {
    setCargandoLista(true);
    setError(null);
    const filtros: FiltrosBusquedaPartes = {
      fechaDesde,
      fechaHasta,
      turno: turnoFiltro || undefined,
      lineaNombre: lineaFiltro || undefined,
      responsableUsername: responsableFiltro || undefined,
    };
    try {
      const data = await buscarPartes(filtros);
      setResultados(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error buscando partes");
    } finally {
      setCargandoLista(false);
    }
  }

  async function seleccionar(parteId: string) {
    setVista("cargando-detalle");
    setError(null);
    try {
      const detalle = await obtenerParteDetalle(parteId);
      setParteDetalle(detalle);
      setVista("detalle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando el parte");
      setVista("lista");
    }
  }

  // ── Editando ──────────────────────────────────────────────────
  if (vista === "editando" && parteDetalle && usuario) {
    return (
      <div className="mx-auto max-w-md p-4">
        <FotoPantallaMaquina
          modo="corregir"
          parteOriginalId={parteDetalle.id}
          contexto={{
            turnoId: parteDetalle.turnoId,
            lineaId: parteDetalle.lineaId,
            loteId: parteDetalle.loteId,
            responsableId: usuario.id,
          }}
          valoresIniciales={parteDetalle}
          onGuardado={() => {
            setParteDetalle(null);
            setVista("lista");
            buscar();
          }}
          onCancelar={() => setVista("detalle")}
        />
      </div>
    );
  }

  // ── Detalle (o cargando el detalle) ──────────────────────────
  if ((vista === "detalle" || vista === "cargando-detalle") && parteDetalle) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setParteDetalle(null);
              setVista("lista");
            }}
            className="text-[var(--texto-tenue)]"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <p className="text-sm font-medium text-[var(--texto)]">
            {parteDetalle.marcaNombre} — {parteDetalle.modeloNombre}
          </p>
        </div>

        <FilaDetalle etiqueta="Nº orden" valor={parteDetalle.numeroOrden} />
        <FilaDetalle etiqueta="Tono" valor={parteDetalle.tono} />
        <FilaDetalle etiqueta="Calibre" valor={parteDetalle.calibre ?? "—"} />
        <FilaDetalle
          etiqueta="Verificación de caja"
          valor={parteDetalle.verificacionCajaEstado?.replace("_", " ") ?? "—"}
        />
        <FilaDetalle etiqueta="1ª calidad" valor={String(parteDetalle.piezas1a)} />
        <FilaDetalle etiqueta="Comercial" valor={String(parteDetalle.piezasComercial)} />
        <FilaDetalle etiqueta="Contenedor" valor={String(parteDetalle.piezasContenedor)} />
        <FilaDetalle etiqueta="Piezas entradas" valor={String(parteDetalle.piezasEntradas)} />
        <FilaDetalle etiqueta="Minutos total" valor={String(parteDetalle.minutosTotal)} />
        <FilaDetalle etiqueta="Minutos plena" valor={String(parteDetalle.minutosPlena)} />

        <button
          type="button"
          onClick={() => setVista("editando")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--acento)] px-4 py-4 text-base font-medium text-[var(--acento-texto)]"
        >
          <Pencil size={18} aria-hidden />
          Corregir este parte
        </button>
        <p className="mt-2 text-center text-xs text-[var(--texto-tenue)]">
          Como administrador puedes corregirlo sin límite de 1h.
        </p>
      </div>
    );
  }

  // ── Lista + filtros ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-3 sm:grid-cols-5">
        <label className="flex flex-col text-xs text-[var(--texto-tenue)]">
          Desde
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="mt-0.5 rounded border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1 text-sm text-[var(--texto)]"
          />
        </label>
        <label className="flex flex-col text-xs text-[var(--texto-tenue)]">
          Hasta
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="mt-0.5 rounded border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1 text-sm text-[var(--texto)]"
          />
        </label>
        <label className="flex flex-col text-xs text-[var(--texto-tenue)]">
          Turno
          <select
            value={turnoFiltro}
            onChange={(e) => setTurnoFiltro(e.target.value as "" | "M" | "T" | "N")}
            className="mt-0.5 rounded border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1 text-sm text-[var(--texto)]"
          >
            <option value="">Todos</option>
            <option value="M">Mañana</option>
            <option value="T">Tarde</option>
            <option value="N">Noche</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--texto-tenue)]">
          Línea
          <select
            value={lineaFiltro}
            onChange={(e) => setLineaFiltro(e.target.value)}
            className="mt-0.5 rounded border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1 text-sm text-[var(--texto)]"
          >
            <option value="">Todas</option>
            {lineasOpciones.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--texto-tenue)]">
          Responsable
          <input
            type="text"
            value={responsableFiltro}
            onChange={(e) => setResponsableFiltro(e.target.value)}
            placeholder="usuario..."
            className="mt-0.5 rounded border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1 text-sm text-[var(--texto)]"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={buscar}
        className="flex items-center gap-2 rounded-lg bg-[var(--acento)] px-4 py-2 text-sm font-medium text-[var(--acento-texto)]"
      >
        <Search size={16} aria-hidden />
        Buscar
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargandoLista && <p className="text-sm text-[var(--texto-tenue)]">Buscando...</p>}

      {!cargandoLista && resultados.length === 0 && (
        <p className="text-center text-sm text-[var(--texto-tenue)]">Sin resultados para este filtro.</p>
      )}

      <div className="space-y-2">
        {resultados.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => seleccionar(p.id)}
            className="flex w-full items-center justify-between rounded-xl bg-[var(--superficie)] p-3 text-left shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-[var(--texto)]">
                {p.marcaNombre} {p.formatoNombre} — {p.modeloNombre}
              </p>
              <p className="text-xs text-[var(--texto-tenue)]">
                {p.fecha} · {NOMBRE_TURNO[p.tipoTurno]} · {p.lineaNombre} · Tono {p.tono}
                {p.calibre ? ` · Cal. ${p.calibre}` : ""}
              </p>
              <p className="text-xs text-[var(--texto-tenue)]">
                Responsable: {p.responsableUsername ?? "—"} · Operario: {p.operarioUsername ?? "—"}
              </p>
            </div>
            <Pencil size={16} className="shrink-0 text-[var(--texto-tenue)]" aria-hidden />
          </button>
        ))}
      </div>
      {resultados.length >= 150 && (
        <p className="text-center text-xs text-[var(--texto-tenue)]">
          Mostrando los 150 más recientes — acota el rango de fechas si buscas algo más antiguo.
        </p>
      )}
    </div>
  );
}

function FilaDetalle({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--borde)] py-2 text-sm">
      <span className="text-[var(--texto-tenue)]">{etiqueta}</span>
      <span className="font-medium text-[var(--texto)]">{valor}</span>
    </div>
  );
}