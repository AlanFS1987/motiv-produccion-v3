// frontend/src/components/mecanico/MovimientoRepuestoForm.tsx
//
// Movimiento manual de stock (salida o ajuste) sobre un repuesto ya
// existente. La entrada nunca se registra a mano — sale siempre de
// marcar recibida una línea de pedido (pieza 4, pendiente).

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { registrarMovimiento } from "../../lib/almacen";

type TipoMovimiento = "salida" | "ajuste";

interface MovimientoRepuestoFormProps {
  repuestoId: string;
  onGuardado: () => void;
  onCancelar: () => void;
}

export function MovimientoRepuestoForm({ repuestoId, onGuardado, onCancelar }: MovimientoRepuestoFormProps) {
  const { usuario } = useAuth();
  const [tipo, setTipo] = useState<TipoMovimiento>("salida");
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cantidadNumero = Number(cantidadTexto);
  const valido =
    cantidadTexto.trim() !== "" && !Number.isNaN(cantidadNumero) && cantidadNumero !== 0 && (tipo === "ajuste" || cantidadNumero > 0);

  async function guardar() {
    if (!valido || !usuario) return;
    setGuardando(true);
    setError(null);
    try {
      // Salida: el mecánico introduce siempre un número positivo (lo
      // que se ha usado); se guarda en negativo. Ajuste: el mecánico
      // ya introduce el signo real (positivo si el recuento físico
      // da más de lo calculado, negativo si da menos) — negativos
      // permitidos en ambos casos, sin distinguir motivo (17-rol-
      // mecanico-plan.md 3.3).
      const cantidadFinal = tipo === "salida" ? -Math.abs(cantidadNumero) : cantidadNumero;
      await registrarMovimiento(repuestoId, tipo, cantidadFinal, usuario.id, nota.trim() || null);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">Registrar movimiento</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo("salida")}
          className={`flex-1 rounded-lg border py-2 text-sm ${
            tipo === "salida" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600"
          }`}
        >
          Salida
        </button>
        <button
          type="button"
          onClick={() => setTipo("ajuste")}
          className={`flex-1 rounded-lg border py-2 text-sm ${
            tipo === "ajuste" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600"
          }`}
        >
          Ajuste
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {tipo === "salida" ? "Cantidad usada" : "Diferencia del recuento (+ o −)"}
        </label>
        <input
          type="number"
          value={cantidadTexto}
          onChange={(e) => setCantidadTexto(e.target.value)}
          placeholder={tipo === "salida" ? "Ej. 2" : "Ej. -3 o 5"}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
        />
        {tipo === "ajuste" && (
          <p className="mt-1 text-xs text-slate-400">
            Positivo si el recuento real es mayor que el stock calculado; negativo si es menor.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
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