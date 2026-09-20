// frontend/src/components/jefe/InformesScreen.tsx
//
// Pestaña "Informes" de JefeApp y AdminApp (sesión 20/09/2026):
// listado de los PDF ya generados, para abrirlos desde la app sin
// tener que buscar el enlace en Telegram.
//
// Tres vistas, mismo patrón (lista de tarjetas, la más reciente
// primero):
//   - Diarios   -> informe_periodo, tipo 'diario'   (3 turnos M+T+N)
//   - Semanales -> informe_periodo, tipo 'semanal'  (lunes M → domingo N)
//   - Turnos    -> turno.informe_pdf_url            (uno por turno)
//
// Solo lectura. Los PDF están en Cloudinary; el botón los abre en una
// pestaña nueva (en el móvil, el visor de PDF del navegador). Estilo con
// las variables del sistema de temas (12-temas.md), como el resto de
// pantallas del jefe.

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import {
  formatearM2,
  formatearPorcentaje,
  listarInformesPeriodo,
  listarInformesTurno,
  tituloInformePeriodo,
  tituloInformeTurno,
  urlPdfSegura,
  type InformePeriodo,
  type InformeTurno,
} from "../../lib/informes";

type Vista = "diarios" | "semanales" | "turnos";

const ETIQUETA_VISTA: Record<Vista, string> = {
  diarios: "Diarios",
  semanales: "Semanales",
  turnos: "Por turno",
};

const TEXTO_VACIO: Record<Vista, string> = {
  diarios: "Todavía no hay informes diarios.",
  semanales: "Todavía no hay informes semanales.",
  turnos: "Todavía no hay informes de turno.",
};

/** Los errores de Supabase son objetos con `message`, no instancias de Error. */
function mensajeDeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : "No se pudieron cargar los informes";
}

export function InformesScreen() {
  const [vista, setVista] = useState<Vista>("diarios");
  const [periodos, setPeriodos] = useState<InformePeriodo[]>([]);
  const [turnos, setTurnos] = useState<InformeTurno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Si se cambia de vista con una carga en curso, solo vale la última:
  // sin esto, una respuesta lenta podía pintar datos de la vista anterior.
  const peticionActual = useRef(0);

  const cargar = useCallback(async (v: Vista) => {
    const numero = ++peticionActual.current;
    setCargando(true);
    setError(null);
    try {
      if (v === "turnos") {
        const datos = await listarInformesTurno();
        if (numero === peticionActual.current) setTurnos(datos);
      } else {
        const datos = await listarInformesPeriodo(v === "diarios" ? "diario" : "semanal");
        if (numero === peticionActual.current) setPeriodos(datos);
      }
    } catch (err) {
      if (numero === peticionActual.current) setError(mensajeDeError(err));
    } finally {
      if (numero === peticionActual.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(vista);
  }, [vista, cargar]);

  const lista = vista === "turnos" ? turnos.length : periodos.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(Object.keys(ETIQUETA_VISTA) as Vista[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              vista === v
                ? "bg-[var(--acento)] text-[var(--acento-texto)]"
                : "bg-[var(--superficie-alt)] text-[var(--texto-secundario)]"
            }`}
          >
            {ETIQUETA_VISTA[v]}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="py-8 text-center text-sm text-[var(--texto-tenue)]">Cargando informes...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-500">{error}</p>
      ) : lista === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--texto-tenue)]">{TEXTO_VACIO[vista]}</p>
      ) : vista === "turnos" ? (
        <div className="flex flex-col gap-2">
          {turnos.map((t) => (
            <TarjetaInformeTurno key={t.turnoId} informe={t} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {periodos.map((p) => (
            <TarjetaInformePeriodo key={p.id} informe={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Tarjetas (presentacionales — reciben los datos ya cargados)
// ---------------------------------------------------------------

function BotonAbrirPdf({ url }: { url: string | null }) {
  const segura = urlPdfSegura(url);
  if (!segura) {
    return <span className="text-xs text-[var(--texto-tenue)]">PDF no disponible</span>;
  }
  return (
    <a
      href={segura}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--acento)] px-3 py-2 text-sm font-medium text-[var(--acento-texto)]"
    >
      <ExternalLink size={14} aria-hidden />
      Abrir PDF
    </a>
  );
}

export function TarjetaInformePeriodo({ informe }: { informe: InformePeriodo }) {
  const r = informe.resumen;
  const incompleto = r !== null && (r.turnos_faltantes.length > 0 || r.turnos_sin_cerrar > 0);

  return (
    <div className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-[var(--texto)]">
            <FileText size={16} className="shrink-0 text-[var(--texto-tenue)]" aria-hidden />
            {tituloInformePeriodo(informe)}
          </p>
          {r ? (
            <>
              <p className="mt-1 text-sm text-[var(--texto)]">
                <strong>{formatearM2(r.m2_total)}</strong>
                <span className="text-[var(--texto-secundario)]">
                  {" "}
                  · 1ª {formatearPorcentaje(r.m2_1a, r.m2_total)}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--texto-secundario)]">
                {r.turnos_registrados} de {r.turnos_esperados} turnos · {r.lotes} lotes · {r.incidencias} incidencias
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--texto-tenue)]">Sin resumen guardado</p>
          )}
        </div>
        <BotonAbrirPdf url={informe.pdfUrl} />
      </div>

      {incompleto && r && (
        <p className="mt-2 text-xs text-amber-600">
          {r.turnos_faltantes.length > 0 && `Sin turno registrado: ${r.turnos_faltantes.join(", ")}. `}
          {r.turnos_sin_cerrar > 0 &&
            `${r.turnos_sin_cerrar} turno${r.turnos_sin_cerrar > 1 ? "s" : ""} sin cerrar al generarlo.`}
        </p>
      )}
    </div>
  );
}

export function TarjetaInformeTurno({ informe }: { informe: InformeTurno }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--texto)]">
        <FileText size={16} className="shrink-0 text-[var(--texto-tenue)]" aria-hidden />
        {tituloInformeTurno(informe)}
      </p>
      <BotonAbrirPdf url={informe.pdfUrl} />
    </div>
  );
}
