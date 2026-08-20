import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Pencil } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerPartesCompletadosHoy, type ParteDetalle } from "../../lib/parte";
import { FotoPantallaMaquina } from "./FotoPantallaMaquina";

interface PartesCompletadosLineaProps {
  turnoId: string;
  lineaId: string;
  lineaNombre: string;
  onVolver: () => void;
  onCorregido: () => void;
}

type Vista = "cargando" | "lista" | "detalle" | "editando";

export function PartesCompletadosLinea({
  turnoId,
  lineaId,
  lineaNombre,
  onVolver,
  onCorregido,
}: PartesCompletadosLineaProps) {
  const { usuario } = useAuth();
  const [vista, setVista] = useState<Vista>("cargando");
  const [partes, setPartes] = useState<ParteDetalle[]>([]);
  const [seleccionado, setSeleccionado] = useState<ParteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoId, lineaId]);

  async function cargar() {
    setVista("cargando");
    try {
      const lista = await obtenerPartesCompletadosHoy(turnoId, lineaId);
      setPartes(lista);
      setVista("lista");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (vista === "cargando") {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando partes de hoy...</div>;
  }

  if (vista === "editando" && seleccionado && usuario) {
    return (
      <FotoPantallaMaquina
        modo="corregir"
        parteOriginalId={seleccionado.id}
        contexto={{ turnoId, lineaId, loteId: seleccionado.loteId, responsableId: usuario.id }}
        valoresIniciales={seleccionado}
        onGuardado={() => {
          setSeleccionado(null);
          onCorregido();
        }}
        onCancelar={() => setVista("detalle")}
      />
    );
  }

  if (vista === "detalle" && seleccionado) {
    return <DetalleParte parte={seleccionado} onVolver={() => setVista("lista")} onEditar={() => setVista("editando")} />;
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onVolver} className="text-slate-400" aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-medium text-slate-700">{lineaNombre} — Partes de hoy</p>
      </div>

      {partes.length === 0 ? (
        <p className="text-center text-sm text-slate-400">No hay partes completados hoy en esta línea.</p>
      ) : (
        <div className="space-y-2">
          {partes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSeleccionado(p);
                setVista("detalle");
              }}
              className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {p.marcaNombre} — {p.modeloNombre}
                </p>
                <p className="text-xs text-slate-500">
                  Tono {p.tono}
                  {p.calibre ? ` · Cal. ${p.calibre}` : ""}
                </p>
              </div>
              {p.dentroDeVentanaCorreccion ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Pencil size={12} aria-hidden />
                  Editable
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Lock size={12} aria-hidden />
                  Cerrado
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetalleParte({
  parte,
  onVolver,
  onEditar,
}: {
  parte: ParteDetalle;
  onVolver: () => void;
  onEditar: () => void;
}) {
  return (
    <div className="mx-auto max-w-md pb-8">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onVolver} className="text-slate-400" aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-medium text-slate-700">
          {parte.marcaNombre} — {parte.modeloNombre}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-800">
        <CheckCircle2 size={18} aria-hidden />
        <p className="text-sm">Parte completado</p>
      </div>

      <FilaDetalle etiqueta="Tono" valor={parte.tono} />
      <FilaDetalle etiqueta="Calibre" valor={parte.calibre ?? "—"} />
      <FilaDetalle etiqueta="Nº orden" valor={parte.numeroOrden} />
      <FilaDetalle etiqueta="Verificación de caja" valor={parte.verificacionCajaEstado?.replace("_", " ") ?? "—"} />
      <FilaDetalle etiqueta="1ª calidad" valor={String(parte.piezas1a)} />
      <FilaDetalle etiqueta="Comercial" valor={String(parte.piezasComercial)} />
      <FilaDetalle etiqueta="Contenedor" valor={String(parte.piezasContenedor)} />
      <FilaDetalle etiqueta="Piezas entradas" valor={String(parte.piezasEntradas)} />
      <FilaDetalle etiqueta="Minutos total" valor={String(parte.minutosTotal)} />
      <FilaDetalle etiqueta="Minutos plena" valor={String(parte.minutosPlena)} />

      {parte.dentroDeVentanaCorreccion ? (
        <button
          type="button"
          onClick={onEditar}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-medium text-white"
        >
          <Pencil size={18} aria-hidden />
          Editar
        </button>
      ) : (
        <p className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-500">
          <Lock size={14} aria-hidden />
          Pasó la hora de corrección — solo el administrador puede editarlo ya.
        </p>
      )}
    </div>
  );
}

function FilaDetalle({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{etiqueta}</span>
      <span className="font-medium text-slate-900">{valor}</span>
    </div>
  );
}