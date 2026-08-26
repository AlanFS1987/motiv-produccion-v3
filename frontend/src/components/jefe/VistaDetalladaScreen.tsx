// frontend/src/components/jefe/VistaDetalladaScreen.tsx
// Vista Detallada del jefe — auditoría fila a fila. Acordeón de 3
// niveles (turno -> línea -> parte) en vez de tabla ancha de
// columnas fijas (esa no funciona en móvil). Cada parte muestra TODO
// lo capturado y todo lo calculable de ahí, organizado en secciones
// para que no sea una pared de números — pero nada se omite.

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { supabase } from "../../lib/supabase-client";
import {
  obtenerDetalle,
  type FiltrosDetalle,
  type LineaDetalle,
  type ParteDetalle,
  type TurnoDetalle,
} from "../../lib/dashboard-detallada";

const NOMBRE_TURNO: Record<string, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function fechaISOHaceNDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function EstadoVerificacion({ estado }: { estado: string | null }) {
  if (!estado) return <span className="text-slate-300">—</span>;
  const color =
    estado === "coincide" || estado === "completo"
      ? "text-green-600"
      : estado === "no_realizada"
        ? "text-slate-400"
        : "text-amber-600";
  return <span className={color}>{estado}</span>;
}

function SeccionCampos({ titulo, campos }: { titulo: string; campos: { etiqueta: string; valor: React.ReactNode }[] }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.etiqueta} className="flex justify-between gap-2 text-xs sm:block">
            <dt className="text-slate-400">{c.etiqueta}</dt>
            <dd className="font-medium text-slate-700">{c.valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FilaParte({ parte }: { parte: ParteDetalle }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 text-sm">
          {abierto ? (
            <ChevronDown size={14} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-slate-400" />
          )}
          <span className="font-medium text-slate-800">{parte.modelo_nombre}</span>
          <span className="text-slate-400">· {parte.formato_nombre}</span>
          <span className="text-slate-400">· tono {parte.tono}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{parte.piezas_entradas.toLocaleString("es-ES")} pzs</span>
          <span>{parte.m2_total.toLocaleString("es-ES")} m²</span>
          {parte.pct_1a_oficial != null && (
            <span className="font-medium text-blue-600">1ª ofi. {parte.pct_1a_oficial}%</span>
          )}
        </div>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3">
          <SeccionCampos
            titulo="Lote"
            campos={[
              { etiqueta: "Nº orden", valor: parte.numero_orden },
              { etiqueta: "Marca", valor: parte.marca_nombre },
              { etiqueta: "Acabado", valor: parte.acabado_nombre },
              { etiqueta: "Espesor", valor: parte.espesor },
              { etiqueta: "Tipo palet", valor: parte.tipo_palet },
              { etiqueta: "Pza/caja", valor: parte.pza_caja },
              { etiqueta: "Objetivo m²", valor: parte.objetivo_m2 },
              { etiqueta: "Calibre", valor: parte.calibre },
              { etiqueta: "Calibre com. %", valor: parte.calibre_com_pct },
              { etiqueta: "Calibre std %", valor: parte.calibre_std_pct },
            ]}
          />

          <SeccionCampos
            titulo="Piezas capturadas"
            campos={[
              { etiqueta: "Entradas", valor: parte.piezas_entradas },
              { etiqueta: "1ª", valor: parte.piezas_1a },
              { etiqueta: "Comercial", valor: parte.piezas_comercial },
              { etiqueta: "Eco", valor: parte.piezas_eco },
              { etiqueta: "Descuadre com.", valor: parte.piezas_descuadre_com },
              { etiqueta: "Planar com.", valor: parte.piezas_planar_com },
              { etiqueta: "Contenedor", valor: parte.piezas_contenedor },
            ]}
          />

          {[
            parte.cal_1,
            parte.cal_2,
            parte.cal_3,
            parte.cal_4,
            parte.cal_5,
            parte.cal_6,
            parte.cal_7,
            parte.cal_8,
          ].some((v) => v != null) && (
            <SeccionCampos
              titulo="Calibres (cal_1–8)"
              campos={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
                etiqueta: `cal_${n}`,
                valor: (parte as unknown as Record<string, number | null>)[`cal_${n}`],
              }))}
            />
          )}

          <SeccionCampos
            titulo="Calculado — m² por categoría"
            campos={[
              { etiqueta: "m² total", valor: parte.m2_total },
              { etiqueta: "m² 1ª", valor: parte.m2_1a },
              { etiqueta: "m² comercial", valor: parte.m2_comercial },
              { etiqueta: "m² eco", valor: parte.m2_eco },
              { etiqueta: "m² contenedor", valor: parte.m2_contenedor },
            ]}
          />

          <SeccionCampos
            titulo="Calculado — calidad completa (sobre entradas)"
            campos={[
              { etiqueta: "1ª", valor: parte.pct_1a_completa != null ? `${parte.pct_1a_completa}%` : null },
              {
                etiqueta: "Comercial",
                valor: parte.pct_comercial_completa != null ? `${parte.pct_comercial_completa}%` : null,
              },
              { etiqueta: "Eco", valor: parte.pct_eco_completa != null ? `${parte.pct_eco_completa}%` : null },
              {
                etiqueta: "Contenedor",
                valor: parte.pct_contenedor_completa != null ? `${parte.pct_contenedor_completa}%` : null,
              },
            ]}
          />

          <SeccionCampos
            titulo="Calculado — calidad oficial (solo 1ª+comercial)"
            campos={[
              { etiqueta: "1ª oficial", valor: parte.pct_1a_oficial != null ? `${parte.pct_1a_oficial}%` : null },
              {
                etiqueta: "Comercial oficial",
                valor: parte.pct_comercial_oficial != null ? `${parte.pct_comercial_oficial}%` : null,
              },
            ]}
          />

          <SeccionCampos
            titulo="Tiempos (min)"
            campos={[
              { etiqueta: "Total", valor: parte.minutos_total },
              { etiqueta: "Plena", valor: parte.minutos_plena },
              { etiqueta: "No alimentada", valor: parte.minutos_no_alimentada },
              { etiqueta: "Saturación", valor: parte.minutos_saturacion },
              { etiqueta: "Banco", valor: parte.minutos_banco },
              { etiqueta: "Máquina", valor: parte.minutos_maquina },
            ]}
          />

          <SeccionCampos
            titulo="Verificaciones"
            campos={[
              {
                etiqueta: "Caja (responsable)",
                valor: <EstadoVerificacion estado={parte.verificacion_caja_estado} />,
              },
              {
                etiqueta: "Caja (operario)",
                valor: <EstadoVerificacion estado={parte.verificacion_caja_estado_operario} />,
              },
              {
                etiqueta: "Cód. barras (responsable)",
                valor: <EstadoVerificacion estado={parte.verificacion_codbar_estado} />,
              },
              {
                etiqueta: "Cód. barras (operario)",
                valor: <EstadoVerificacion estado={parte.verificacion_codbar_estado_operario} />,
              },
            ]}
          />

          <SeccionCampos
            titulo="Metadatos"
            campos={[
              { etiqueta: "Operario", valor: parte.operario_username },
              {
                etiqueta: "Hora captura pantalla",
                valor: parte.hora_captura_pantalla
                  ? new Date(parte.hora_captura_pantalla).toLocaleString("es-ES")
                  : null,
              },
              {
                etiqueta: "Completado",
                valor: parte.completado_at ? new Date(parte.completado_at).toLocaleString("es-ES") : null,
              },
            ]}
          />

          {parte.incidencias_calidad.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Incidencias de calidad ({parte.incidencias_calidad.length})
              </p>
              <ul className="space-y-2">
                {parte.incidencias_calidad.map((ic) => (
                  <li key={ic.id} className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                    <p>{ic.descripcion}</p>
                    {ic.fotos?.map((url) => (
                      <img key={url} src={url} alt="" className="mt-1 max-h-32 rounded" />
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BloqueLinea({ linea }: { linea: LineaDetalle }) {
  const [abierta, setAbierta] = useState(false);
  const totalM2 = linea.partes.reduce((acc, p) => acc + p.m2_total, 0);
  const totalPiezas = linea.partes.reduce((acc, p) => acc + p.piezas_entradas, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          {abierta ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
          {linea.linea_nombre}
          {linea.operario_principal && (
            <span className="text-xs font-normal text-slate-400">· {linea.operario_principal}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            {linea.partes.length} parte{linea.partes.length !== 1 ? "s" : ""}
          </span>
          <span>{totalPiezas.toLocaleString("es-ES")} pzs</span>
          <span>{Math.round(totalM2).toLocaleString("es-ES")} m²</span>
        </div>
      </button>

      {abierta && (
        <div className="space-y-2 px-3 pb-3">
          {linea.incidencias_produccion.length > 0 && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
              {linea.incidencias_produccion.map((ip) => (
                <p key={ip.id}>⚠ {ip.descripcion}</p>
              ))}
            </div>
          )}
          {linea.partes.map((p) => (
            <FilaParte key={p.id} parte={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function BloqueTurno({ turno }: { turno: TurnoDetalle }) {
  const [abierto, setAbierto] = useState(false);
  const totalPiezas = turno.lineas.reduce((acc, l) => acc + l.partes.reduce((a, p) => a + p.piezas_entradas, 0), 0);
  const totalM2 = turno.lineas.reduce((acc, l) => acc + l.partes.reduce((a, p) => a + p.m2_total, 0), 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {abierto ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {turno.fecha} · {NOMBRE_TURNO[turno.tipo_turno]}
            </p>
            <p className="text-xs text-slate-400">
              {turno.responsable_username ?? "sin responsable"} · {turno.lineas.length} línea(s) ·{" "}
              {turno.cerrado_at ? "cerrado" : "abierto"}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{totalPiezas.toLocaleString("es-ES")} pzs</p>
          <p>{Math.round(totalM2).toLocaleString("es-ES")} m²</p>
        </div>
      </button>

      {abierto && (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          {turno.incidencias_generales.length > 0 && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
              {turno.incidencias_generales.map((ip) => (
                <p key={ip.id}>⚠ (general del turno) {ip.descripcion}</p>
              ))}
            </div>
          )}
          {turno.lineas.map((l) => (
            <BloqueLinea key={l.linea_id} linea={l} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VistaDetalladaScreen({ responsableFijo }: { responsableFijo?: string } = {}) {
  const [fechaDesde, setFechaDesde] = useState(fechaISOHaceNDias(7));
  const [fechaHasta, setFechaHasta] = useState(fechaISOHaceNDias(0));
  const [turnoFiltro, setTurnoFiltro] = useState<"" | "M" | "T" | "N">("");
  const [lineaFiltro, setLineaFiltro] = useState("");
  const [responsableFiltro, setResponsableFiltro] = useState(responsableFijo ?? "");

  const [lineasOpciones, setLineasOpciones] = useState<string[]>([]);
  const [responsablesOpciones, setResponsablesOpciones] = useState<string[]>([]);

  const [turnos, setTurnos] = useState<TurnoDetalle[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("linea")
      .select("nombre")
      .order("nombre")
      .then(({ data }) => setLineasOpciones((data ?? []).map((l) => l.nombre as string)));
    if (!responsableFijo) {
      supabase
        .from("usuario")
        .select("username")
        .in("rol", ["responsable", "suplente"])
        .order("username")
        .then(({ data }) => setResponsablesOpciones((data ?? []).map((u) => u.username as string)));
    }
  }, [responsableFijo]);

  async function buscar() {
    setCargando(true);
    setError(null);
    const filtros: FiltrosDetalle = {
      fechaDesde,
      fechaHasta,
      turno: turnoFiltro || undefined,
      lineaNombre: lineaFiltro || undefined,
      responsableUsername: responsableFiltro || undefined,
    };
    try {
      const data = await obtenerDetalle(filtros);
      setTurnos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando el detalle");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {/* Filtros */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-5">
        <label className="flex flex-col text-xs text-slate-500">
          Desde
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Hasta
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Turno
          <select
            value={turnoFiltro}
            onChange={(e) => setTurnoFiltro(e.target.value as "" | "M" | "T" | "N")}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="M">Mañana</option>
            <option value="T">Tarde</option>
            <option value="N">Noche</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Línea
          <select
            value={lineaFiltro}
            onChange={(e) => setLineaFiltro(e.target.value)}
            className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {lineasOpciones.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {!responsableFijo && (
          <label className="flex flex-col text-xs text-slate-500">
            Responsable
            <select
              value={responsableFiltro}
              onChange={(e) => setResponsableFiltro(e.target.value)}
              className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              {responsablesOpciones.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={buscar}
          disabled={cargando}
          className="col-span-2 flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 sm:col-span-1"
        >
          <Search size={14} aria-hidden />
          Buscar
        </button>
      </div>

      {cargando && (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Cargando...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {!cargando && !error && turnos.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No hay partes que coincidan con estos filtros.
        </p>
      )}

      <div className="space-y-3">
        {turnos.map((t) => (
          <BloqueTurno key={t.turno_id} turno={t} />
        ))}
      </div>
    </div>
  );
}