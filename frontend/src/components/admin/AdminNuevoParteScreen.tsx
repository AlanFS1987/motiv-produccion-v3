// frontend/src/components/admin/AdminNuevoParteScreen.tsx
//
// "Añadir parte a un turno ya cerrado" (09-administrador.md). Cubre
// el hueco que dejaba "Corrección de partes sin límite de tiempo"
// (CorreccionPartesScreen.tsx): esa pantalla permite EDITAR partes
// que ya existen, pero no permite CREAR uno que nunca llegó a
// insertarse — caso real, sesión 02/09/2026: un responsable en su
// primer turno no pudo abrir un segundo parte en una línea (el
// primero seguía pendiente, ver uq_parte_pendiente_por_linea_turno)
// y cerró el turno sin completarlo, dejando el primer parte huérfano
// y el segundo sin crear.
//
// El admin busca el turno por fecha+tipo (SIN crearlo si no existe —
// a diferencia de obtenerOCrearTurno, que sí lo crea, esta pantalla
// solo debe operar sobre turnos que ya existieron) y, una vez
// encontrado, reutiliza el mismo wizard que usa el responsable
// (CapturaParteScreen) tal cual, sin ningún candado de "turno
// abierto": la política RLS parte_insert_responsable ya incluye
// 'administrador' (20260101000010_rls.sql) y no hay ningún trigger
// que bloquee un INSERT en `parte` por el estado de `turno.cerrado_at`
// — el único candado que existía era de UI (TurnoScreen solo monta
// CapturaParteScreen para "mi turno" de hoy), así que aquí basta con
// no tener ese candado. No hizo falta ninguna migración SQL.
//
// El turno NO se reabre (cerrado_at se deja tal cual): insertar un
// parte a posteriori no debe disparar de nuevo el envío del resumen
// a Telegram ni cambiar un estado que ya se comunicó. Si había un
// parte pendiente (completado=false) huérfano en esa línea,
// CapturaParteScreen lo detecta solo (obtenerPartePendiente) y
// retoma el wizard donde se quedó — mismo camino que "Continuar
// parte" del responsable, sin lógica especial aquí para ese caso.
//
// responsable_id del parte insertado queda como el ADMIN que lo
// crea, no el responsable original — mismo criterio ya usado en
// CorreccionPartesScreen para las correcciones.

import { useEffect, useState } from "react";
import { AlertTriangle, Lock, Search } from "lucide-react";
import { listarLineas, type Linea } from "../../lib/turno";
import { obtenerTurnoPorFechaTipo } from "../../lib/resumen-turno";
import { CapturaParteScreen } from "../captura-parte/CapturaParteScreen";

const NOMBRE_TURNO: Record<"M" | "T" | "N", string> = { M: "Mañana", T: "Tarde", N: "Noche" };

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TurnoEncontrado {
  id: string;
  cerrado_at: string | null;
}

export function AdminNuevoParteScreen() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<"M" | "T" | "N">("M");
  const [lineaId, setLineaId] = useState("");

  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [turno, setTurno] = useState<TurnoEncontrado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarLineas()
      .then((ls) => {
        setLineas(ls);
        if (ls.length > 0) setLineaId(ls[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error cargando líneas"));
  }, []);

  async function buscarTurno() {
    setBuscando(true);
    setError(null);
    setBuscado(false);
    setTurno(null);
    try {
      const encontrado = await obtenerTurnoPorFechaTipo(fecha, tipo);
      setTurno(encontrado);
      setBuscado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error buscando el turno");
    } finally {
      setBuscando(false);
    }
  }

  const lineaSeleccionada = lineas.find((l) => l.id === lineaId) ?? null;

  // Wizard de captura montado: mismo componente que usa el
  // responsable, sin ningún candado adicional. Si esa línea+turno
  // tiene un parte pendiente huérfano, lo retoma solo; si no,
  // arranca uno nuevo desde "hoja".
  if (turno && lineaSeleccionada) {
    return (
      <div className="mx-auto max-w-md">
        <CapturaParteScreen
          turnoId={turno.id}
          lineaId={lineaSeleccionada.id}
          lineaNombre={lineaSeleccionada.nombre}
          onFinalizado={() => {
            setTurno(null);
            setBuscado(false);
          }}
          onCancelar={() => {
            setTurno(null);
            setBuscado(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-4 text-sm text-[var(--texto-secundario)]">
        Busca el turno exacto (fecha + tipo) donde falta un parte — también
        sirve para retomar uno que quedó a medias (huérfano) sin que nadie
        lo cerrara. El turno no se reabre: si ya estaba cerrado, se queda
        cerrado.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-[var(--superficie)] p-4 shadow-sm sm:grid-cols-3">
        <label className="text-sm">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--borde)] px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          Turno
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "M" | "T" | "N")}
            className="mt-1 w-full rounded border border-[var(--borde)] px-2 py-1.5"
          >
            {(["M", "T", "N"] as const).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TURNO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Línea
          <select
            value={lineaId}
            onChange={(e) => setLineaId(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--borde)] px-2 py-1.5"
          >
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={buscarTurno}
        disabled={buscando || !lineaId}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--acento)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        <Search size={16} aria-hidden />
        {buscando ? "Buscando..." : "Buscar turno"}
      </button>

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle size={14} aria-hidden /> {error}
        </p>
      )}

      {buscado && !turno && !error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={14} aria-hidden />
          No existe ningún turno para esa fecha y tipo — nunca se llegó a abrir.
        </p>
      )}

      {buscado && turno?.cerrado_at && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-sm text-[var(--texto-secundario)]">
          <Lock size={14} aria-hidden />
          Turno cerrado el {new Date(turno.cerrado_at).toLocaleString("es-ES")}. El parte se
          insertará dentro de él sin reabrirlo ni reenviar el resumen a Telegram.
        </p>
      )}
    </div>
  );
}