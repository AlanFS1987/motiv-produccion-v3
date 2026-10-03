// frontend/src/components/jefe/programacion/ui.tsx
//
// Presentación compartida entre ProgramacionRevisar y
// ProgramacionConsultar: etiquetas/colores de los enums del dominio,
// formato de números, y el botón "copiar → copiado" (usado en las dos
// pantallas). Sin lógica de datos — eso vive en lib/programacion.ts.

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CambioDiff, Estado } from "../../../lib/programacion";

export const ETIQUETA_CAMBIO: Record<CambioDiff, string> = {
  nuevo: "+ Nuevo",
  eliminado: "− Eliminado",
  reordenado: "~ Reordenado",
  sin_cambios: "= Sin cambios",
  cambia_horno: "⇄ Cambia de horno",
};

export const COLOR_CAMBIO: Record<CambioDiff, string> = {
  nuevo: "bg-green-50 text-green-700 border-green-200",
  eliminado: "bg-red-50 text-red-700 border-red-200",
  reordenado: "bg-amber-50 text-amber-700 border-amber-200",
  sin_cambios: "bg-slate-50 text-slate-500 border-slate-200",
  cambia_horno: "bg-blue-50 text-blue-700 border-blue-200",
};

export const COLOR_ESTADO: Record<Estado, string> = {
  pendiente: "bg-slate-100 text-slate-600",
  iniciado: "bg-blue-100 text-blue-700",
  finalizado: "bg-green-100 text-green-700",
};

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  pendiente: "Pendiente",
  iniciado: "Iniciado",
  finalizado: "Finalizado",
};

export function formatoMetros(m: number | null): string {
  if (m === null) return "—";
  return m.toLocaleString("es-ES");
}

/** "2026-10-03" -> "03/10/2026"; "—" si no hay fecha (filas anteriores al 02/10/2026). */
export function formatoFechaISO(f: string | null): string {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // portapapeles no disponible (http sin TLS, permisos...) — no
      // rompemos la UI por esto, simplemente no confirmamos visualmente.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
        copiado
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {copiado ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}
