import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Pencil } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { obtenerParteDetalle, type ParteDetalle } from "../../lib/parte";
import { FotoPantallaMaquina } from "./FotoPantallaMaquina";
import { ListaIncidenciasCalidad } from "../incidencias/ListaIncidenciasCalidad";

interface DetalleParteScreenProps {
  parteId: string;
  turnoId: string;
  lineaId: string;
  onVolver: () => void;
  onCorregido: () => void;
}

type Vista = "cargando" | "detalle" | "editando";

export function DetalleParteScreen({ parteId, turnoId, lineaId, onVolver, onCorregido }: DetalleParteScreenProps) {
  const { usuario } = useAuth();
  const [vista, setVista] = useState<Vista>("cargando");
  const [parte, setParte] = useState<ParteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerParteDetalle(parteId)
      .then((p) => {
        setParte(p);
        setVista("detalle");
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [parteId]);

  if (error) {
    return <div className="p-6 text-center text-sm text-red-600">{error}</div>;
  }

  if (vista === "cargando" || !parte) {
    return <div className="p-6 text-center text-sm text-slate-500">Cargando parte...</div>;
  }

  if (vista === "editando" && usuario) {
    return (
      <FotoPantallaMaquina
        modo="corregir"
        parteOriginalId={parte.id}
        contexto={{ turnoId, lineaId, loteId: parte.loteId, responsableId: usuario.id }}
        valoresIniciales={parte}
        onGuardado={onCorregido}
        onCancelar={() => setVista("detalle")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md pb-8">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onVolver} className="text-slate-400" aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-medium text-slate-700">
          {parte.marcaNombre} {parte.formatoNombre} — {parte.modeloNombre}
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
      <ListaIncidenciasCalidad parteId={parte.id} />
      
      {parte.dentroDeVentanaCorreccion ? (
        <button
          type="button"
          onClick={() => setVista("editando")}
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