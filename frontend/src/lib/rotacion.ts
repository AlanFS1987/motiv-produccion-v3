import { supabase } from "./supabase-client";

export type TipoTurno = "M" | "T" | "N";
export type LetraTurno = "A" | "B" | "C" | "D";
export type EstadoTurno = "descanso" | "antes" | "abierto" | "en_revision" | "cerrado";

// Franjas horarias fijas (01-rol-responsable.md 3.1)
const FRANJAS: Record<TipoTurno, { inicioHora: number; finHora: number }> = {
  M: { inicioHora: 6, finHora: 14 },
  T: { inicioHora: 14, finHora: 22 },
  N: { inicioHora: 22, finHora: 6 }, // cruza medianoche
};

export const MARGEN_ANTES_MS = 60 * 60 * 1000; // 1h antes del inicio -> Abierto
export const MARGEN_REVISION_MS = 60 * 60 * 1000; // 1h después del fin -> En revisión

function formatearFechaLocal(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** Llama a la función SQL fn_turno_de_letra(fecha, letra) -> 'M'|'T'|'N'|null */
async function tipoTurnoDeLetra(fechaISO: string, letra: LetraTurno): Promise<TipoTurno | null> {
  const { data, error } = await supabase.rpc("fn_turno_de_letra", {
    p_fecha: fechaISO,
    p_letra: letra,
  });
  if (error) throw error;
  return (data as TipoTurno | null) ?? null;
}

interface CandidatoTurno {
  fecha: string; // fecha "de inicio" del turno (columna turno.fecha)
  tipo: TipoTurno;
  inicioFranja: Date;
  finFranja: Date;
}

export function construirCandidato(fechaISO: string, tipo: TipoTurno): CandidatoTurno {
  const { inicioHora, finHora } = FRANJAS[tipo];
  const [y, m, d] = fechaISO.split("-").map(Number);
  const inicioFranja = new Date(y, m - 1, d, inicioHora, 0, 0);
  const finFranja =
    tipo === "N"
      ? new Date(y, m - 1, d + 1, finHora, 0, 0) // el fin cae al día siguiente
      : new Date(y, m - 1, d, finHora, 0, 0);
  return { fecha: fechaISO, tipo, inicioFranja, finFranja };
}

export function estadoDeCandidato(ahora: Date, c: CandidatoTurno): EstadoTurno {
  const inicioMargen = new Date(c.inicioFranja.getTime() - MARGEN_ANTES_MS);
  const finRevision = new Date(c.finFranja.getTime() + MARGEN_REVISION_MS);

  if (ahora < inicioMargen) return "antes";
  if (ahora <= c.finFranja) return "abierto";
  if (ahora <= finRevision) return "en_revision";
  return "cerrado";
}

export interface TurnoActual {
  estado: EstadoTurno;
  fecha: string | null; // null solo si estado === 'descanso' sin ningún candidato válido
  tipo: TipoTurno | null;
  inicioFranja: Date | null;
  finFranja: Date | null;
}

/**
 * Determina el turno "real" que le corresponde ahora mismo a una
 * letra — mirando SIEMPRE tanto la fecha de hoy como la de ayer.
 *
 * Por qué hace falta mirar ayer también: un turno de noche (22:00-
 * 06:00) sigue activo o en revisión después de medianoche, momento
 * en el que el reloj del sistema ya está "hoy", pero el turno que
 * corresponde comprobar es el que se abrió AYER. Ignorar esto es
 * exactamente el bug de v2 que esta función existe para evitar
 * (01-rol-responsable.md 3.1: "un operario de turno noche podía
 * marcar 'tarde' y rellenar el parte del día siguiente").
 */
export async function calcularTurnoActual(letra: LetraTurno, ahora: Date = new Date()): Promise<TurnoActual> {
  const hoy = formatearFechaLocal(ahora);
  const ayer = formatearFechaLocal(sumarDias(ahora, -1));

  const [tipoHoy, tipoAyer] = await Promise.all([
    tipoTurnoDeLetra(hoy, letra),
    tipoTurnoDeLetra(ayer, letra),
  ]);

  const candidatos: CandidatoTurno[] = [];
  if (tipoAyer) candidatos.push(construirCandidato(ayer, tipoAyer));
  if (tipoHoy) candidatos.push(construirCandidato(hoy, tipoHoy));

  // Preferir cualquier candidato que esté Abierto o En revisión AHORA.
  for (const c of candidatos) {
    const estado = estadoDeCandidato(ahora, c);
    if (estado === "abierto" || estado === "en_revision") {
      return { estado, fecha: c.fecha, tipo: c.tipo, inicioFranja: c.inicioFranja, finFranja: c.finFranja };
    }
  }

  // Nada activo ahora mismo. Si hoy es descanso para esta letra, se
  // muestra descanso (aunque ayer hubiera turno, ya pasó del todo).
  if (!tipoHoy) {
    return { estado: "descanso", fecha: null, tipo: null, inicioFranja: null, finFranja: null };
  }

  // Si no, se muestra el turno de HOY en su estado natural (lo normal
  // aquí es "antes" — todavía no ha llegado el margen de apertura).
  const candidatoHoy = construirCandidato(hoy, tipoHoy);
  return {
    estado: estadoDeCandidato(ahora, candidatoHoy),
    fecha: candidatoHoy.fecha,
    tipo: candidatoHoy.tipo,
    inicioFranja: candidatoHoy.inicioFranja,
    finFranja: candidatoHoy.finFranja,
  };
}

/**
 * Igual que calcularTurnoActual, pero para el usuario `suplente`: no
 * tiene `letra`, así que no hay rotación que consultar — está exento
 * del candado de rotación y "siempre puede iniciar turno, dentro de
 * la franja horaria correspondiente" (01-rol-responsable.md 3.1). En
 * vez de preguntar "¿qué turno le toca a mi letra hoy?", se pregunta
 * directamente "¿qué franja horaria está activa ahora mismo?" sobre
 * los 3 tipos de turno — sin llamar a fn_turno_de_letra, sin letra
 * que pasarle.
 *
 * Mismo cuidado con el cruce de medianoche que calcularTurnoActual:
 * el turno N de AYER puede seguir Abierto/En revisión ahora mismo.
 */
export async function calcularTurnoActualSuplente(ahora: Date = new Date()): Promise<TurnoActual> {
  const hoy = formatearFechaLocal(ahora);
  const ayer = formatearFechaLocal(sumarDias(ahora, -1));

  const candidatos: CandidatoTurno[] = [
    construirCandidato(ayer, "N"), // turno de noche de ayer, puede seguir vivo ahora
    construirCandidato(hoy, "M"),
    construirCandidato(hoy, "T"),
    construirCandidato(hoy, "N"),
  ];

  // Preferir cualquier candidato que esté Abierto o En revisión AHORA.
  for (const c of candidatos) {
    const estado = estadoDeCandidato(ahora, c);
    if (estado === "abierto" || estado === "en_revision") {
      return { estado, fecha: c.fecha, tipo: c.tipo, inicioFranja: c.inicioFranja, finFranja: c.finFranja };
    }
  }

  // Nada abierto ahora mismo: mostrar el próximo turno de hoy que
  // todavía no ha entrado en su margen de apertura (estado "antes"),
  // el más cercano en el tiempo.
  const candidatosFuturos = candidatos.filter((c) => estadoDeCandidato(ahora, c) === "antes");
  if (candidatosFuturos.length > 0) {
    const proximo = candidatosFuturos.reduce((a, b) => (a.inicioFranja < b.inicioFranja ? a : b));
    return {
      estado: "antes",
      fecha: proximo.fecha,
      tipo: proximo.tipo,
      inicioFranja: proximo.inicioFranja,
      finFranja: proximo.finFranja,
    };
  }

  // Tramo muerto (ej. justo tras la revisión del N de ayer y antes de
  // que M de hoy entre en su margen de "antes") — nada que abrir ahora.
  // No es "descanso" (el suplente no tiene día de descanso, ver 3.1),
  // así que se reutiliza "cerrado" para la pantalla de solo lectura.
  return { estado: "cerrado", fecha: null, tipo: null, inicioFranja: null, finFranja: null };
}

/**
 * Instante exacto del PRÓXIMO cambio de estado, a partir del
 * `TurnoActual` ya calculado — para no dejar la pantalla mostrando un
 * estado caducado hasta que el usuario haga algo que recargue
 * (CLAUDE.md, pendiente #1: "Recálculo automático del estado de turno
 * con el tiempo — setTimeout al instante exacto, no un intervalo
 * recurrente, + visibilitychange"; era el origen del bug real de
 * sesión 15/08 donde `Cerrado` no tenía pantalla propia y se quedaba
 * mostrando el turno como si siguiera abierto horas después).
 *
 * Devuelve `null` solo cuando no hay transición futura CONOCIDA con
 * los datos que ya tenemos (estado `descanso` o `cerrado`, donde no
 * se ha calculado el candidato del día siguiente) — en ese caso quien
 * llama debe usar `proximaMedianocheLocal` como red de seguridad, no
 * quedarse sin programar nada.
 */
export function proximoCambioEstado(info: TurnoActual): Date | null {
  switch (info.estado) {
    case "antes":
      // "antes" -> "abierto" al entrar en el margen de 1h previo.
      return info.inicioFranja ? new Date(info.inicioFranja.getTime() - MARGEN_ANTES_MS) : null;
    case "abierto":
      // "abierto" -> "en_revision" justo al acabar la franja.
      return info.finFranja;
    case "en_revision":
      // "en_revision" -> "cerrado" 1h después del fin de la franja.
      return info.finFranja ? new Date(info.finFranja.getTime() + MARGEN_REVISION_MS) : null;
    case "descanso":
    case "cerrado":
      // No hay más candidato calculado para hoy (calcularTurnoActual
      // solo mira hoy/ayer) — no se sabe el instante exacto del
      // próximo "antes" de mañana sin volver a llamar a la fórmula de
      // rotación. Quien llama debe caer a la medianoche local.
      return null;
    default:
      return null;
  }
}

/** Medianoche local del día siguiente a `ahora` — red de seguridad
 * para los casos de `proximoCambioEstado` que devuelven `null`. */
export function proximaMedianocheLocal(ahora: Date): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 0);
}