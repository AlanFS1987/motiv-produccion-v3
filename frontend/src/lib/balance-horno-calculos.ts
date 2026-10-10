// frontend/src/lib/balance-horno-calculos.ts
// Funciones PURAS del balance horno vs clasificación y del nivel de piezas
// que cada línea necesita para sostener el horno.
//
// El horno cuece a ritmo constante todo el día: un turno es exactamente 1/3
// del día. Salida de UN horno por turno = m²/día ÷ 3. El balance es una SUMA
// CORRIDA de (clasificado − horno): por turno suelto sale irregular por la
// rotación de líneas; lo que importa es la tendencia.
//
// QUÉ FORMATO COCE CADA HORNO se INFIERE de lo que se clasifica (no hay dato
// real todavía; ver memorias/21-alimentacion.md). Reglas de la planta
// (ESTRUCTURA_HORNOS): 4 hornos intercambiables en tamaño pero con reparto fijo:
//   - el horno GRANDE cuece 900x900 o 1200x1200 (nunca los dos a la vez);
//   - el horno FLEXIBLE cuece 200x1200 o 300x1200 (nunca los dos a la vez) y,
//     de vez en cuando, pasa a cocer 600x1200;
//   - los otros dos cuecen 600x1200.
// Inferencia: un horno mantiene su formato hasta que se clasifica otro de su
// familia y domina (cuando un parte nuevo de 300x1200 sigue a muchos de
// 200x1200, ese horno cambió). Cuando 600x1200 supera los 2,5 hornos
// equivalentes en un día, el flexible está cociendo 600x1200 ese día.
// Mientras el horno cuece otro formato, lo que aún se clasifica del anterior
// es vaciado de stock (suma sin que el horno lo respalde).

import type { ClasificadoTurnoFormato, HornoFormato } from "./horno-formato";
import type { TipoTurno } from "./dashboard-alimentacion";
import { sumarDias } from "./alimentacion-calculos";

export const TURNOS_POR_DIA = 3;
const ORDEN_TURNO: TipoTurno[] = ["M", "T", "N"];

/** Reparto de hornos de la planta (único sitio donde vive). */
export const ESTRUCTURA_HORNOS = {
  /** Un horno, formatos exclusivos entre sí. */
  grande: ["900x900", "1200x1200"],
  /** Un horno, formatos exclusivos entre sí; los raros (300x600, 600x600) se asumen aquí. */
  flexible: ["200x1200", "300x1200", "300x600", "600x600"],
  /** Formato de los hornos fijos (y al que pasa el flexible cuando hace falta). */
  principal: "600x1200",
  hornosPrincipalFijos: 2,
  /** Hornos equivalentes al día de 600x1200 a partir de los cuales el flexible también lo cuece. */
  umbralTercerHorno: 2.5,
  /** Un día con menos de esta fracción de la mediana de m² de la planta se considera incompleto (bordes). */
  fraccionDiaCompleto: 0.5,
} as const;

/** Fila de horno_formato vigente en `fecha` para el formato (la más reciente con vigente_desde <= fecha). */
export function parametrosVigentes(filas: HornoFormato[], formato: string, fecha: string): HornoFormato | null {
  let mejor: HornoFormato | null = null;
  for (const f of filas) {
    if (f.formato !== formato || f.vigenteDesde > fecha) continue;
    if (!mejor || f.vigenteDesde > mejor.vigenteDesde) mejor = f;
  }
  return mejor;
}

/** m² que saca UN horno de ese formato en un turno (un tercio del día). */
export function m2UnHornoPorTurno(p: HornoFormato): number {
  return p.metrosDiaHorno / TURNOS_POR_DIA;
}

export interface NivelHorno {
  /** Piezas que debe clasificar CADA línea por turno (3 turnos/día) para no acumular material. */
  piezasTurnoPorLinea: number;
  parametros: HornoFormato;
}

/**
 * Nivel medio de piezas por línea y turno que sostiene el horno:
 * m²/día × hornos ÷ líneas ÷ m² por pieza ÷ 3, con los hornos y líneas HABITUALES
 * de la tabla. Es un nivel MEDIO (las líneas rotan de modelo), no un umbral
 * turno a turno.
 */
export function nivelHornoPorLinea(filas: HornoFormato[], formato: string, fecha: string): NivelHorno | null {
  const p = parametrosVigentes(filas, formato, fecha);
  if (!p || p.areaM2 <= 0 || p.lineas <= 0) return null;
  return { piezasTurnoPorLinea: (p.metrosDiaHorno * p.hornos) / p.lineas / p.areaM2 / TURNOS_POR_DIA, parametros: p };
}

// ── Inferencia de hornos ────────────────────────────────────────────

const claveTurno = (fecha: string, tipo: TipoTurno) => `${fecha}|${tipo}`;

/** Formato con más m² entre los candidatos, o null si ninguno tiene clasificación. */
function dominante(m2: Map<string, number>, candidatos: readonly string[]): string | null {
  let mejor: string | null = null;
  let max = 0;
  for (const f of candidatos) {
    const v = m2.get(f) ?? 0;
    if (v > max) {
      max = v;
      mejor = f;
    }
  }
  return mejor;
}

export interface HornosDeTurno {
  fecha: string;
  tipoTurno: TipoTurno;
  /** Hornos (enteros) que se infiere que cuecen cada formato en este turno. */
  hornos: Map<string, number>;
}

/**
 * Infiere, turno a turno, cuántos hornos cuece cada formato. `clasificado`
 * debe traer TODOS los formatos de la planta (no solo el elegido). Devuelve
 * los turnos desde el primer día completo hasta el último día completo con
 * clasificación; los días de los bordes con muy poca producción de la planta
 * (datos parciales) se descartan.
 */
export function inferirHornos(clasificado: ClasificadoTurnoFormato[], parametros: HornoFormato[]): HornosDeTurno[] {
  if (clasificado.length === 0) return [];
  const E = ESTRUCTURA_HORNOS;

  const porTurno = new Map<string, Map<string, number>>();
  const m2Dia = new Map<string, number>();
  const m2PrincipalDia = new Map<string, number>();
  for (const c of clasificado) {
    const k = claveTurno(c.fecha, c.tipoTurno);
    if (!porTurno.has(k)) porTurno.set(k, new Map());
    const m = porTurno.get(k)!;
    m.set(c.formato, (m.get(c.formato) ?? 0) + c.m2Clasificados);
    m2Dia.set(c.fecha, (m2Dia.get(c.fecha) ?? 0) + c.m2Clasificados);
    if (c.formato === E.principal) m2PrincipalDia.set(c.fecha, (m2PrincipalDia.get(c.fecha) ?? 0) + c.m2Clasificados);
  }

  // Recorte de bordes: se descartan los días de los extremos con muy poca producción de la planta.
  const fechas = [...m2Dia.keys()].sort();
  const totales = fechas.map((f) => m2Dia.get(f)!).sort((a, b) => a - b);
  const mediana = totales[Math.floor(totales.length / 2)];
  const completo = (f: string) => (m2Dia.get(f) ?? 0) >= E.fraccionDiaCompleto * mediana;
  let ini = 0;
  let fin = fechas.length - 1;
  while (ini < fin && !completo(fechas[ini])) ini++;
  while (fin > ini && !completo(fechas[fin])) fin--;
  const desde = fechas[ini];
  const hasta = fechas[fin];

  // Turnos en orden cronológico (los días sin datos entre medias también cuentan: el horno sigue).
  const turnos: { fecha: string; tipo: TipoTurno }[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) for (const tipo of ORDEN_TURNO) turnos.push({ fecha: f, tipo });

  // ¿El flexible cuece 600x1200 este día? (600x1200 por encima de 2,5 hornos equivalentes)
  const terceroEnDia = (fecha: string): boolean => {
    const p = parametrosVigentes(parametros, E.principal, fecha);
    if (!p || p.metrosDiaHorno <= 0) return false;
    return (m2PrincipalDia.get(fecha) ?? 0) / p.metrosDiaHorno >= E.umbralTercerHorno;
  };

  // Estado inicial = primer formato dominante de cada familia en la serie (así no hay turnos "sin horno" al principio).
  let estadoGrande: string | null = null;
  let estadoFlexible: string | null = null;
  for (const t of turnos) {
    const m = porTurno.get(claveTurno(t.fecha, t.tipo));
    if (!m) continue;
    if (!estadoGrande) estadoGrande = dominante(m, E.grande);
    if (!estadoFlexible && !terceroEnDia(t.fecha)) estadoFlexible = dominante(m, E.flexible);
    if (estadoGrande && estadoFlexible) break;
  }

  const salida: HornosDeTurno[] = [];
  for (const t of turnos) {
    const m = porTurno.get(claveTurno(t.fecha, t.tipo)) ?? new Map<string, number>();
    const hornos = new Map<string, number>();

    // Horno grande: sigue con su formato hasta que domina el otro.
    estadoGrande = dominante(m, E.grande) ?? estadoGrande;
    if (estadoGrande) hornos.set(estadoGrande, 1);

    // Hornos de 600x1200: dos fijos, y el flexible los refuerza los días de más de 2,5 hornos equivalentes.
    const tercero = terceroEnDia(t.fecha);
    hornos.set(E.principal, E.hornosPrincipalFijos + (tercero ? 1 : 0));

    // Horno flexible: si no está con 600x1200, sigue con su formato hasta que domina otro de su familia.
    if (!tercero) {
      estadoFlexible = dominante(m, E.flexible) ?? estadoFlexible;
      if (estadoFlexible) hornos.set(estadoFlexible, 1);
    }
    salida.push({ fecha: t.fecha, tipoTurno: t.tipo, hornos });
  }
  return salida;
}

// ── Balance de un formato ───────────────────────────────────────────

export interface TurnoBalance {
  fecha: string;
  tipoTurno: TipoTurno;
  /** Posición del turno en la serie (0, 1, 2…), para el eje X. */
  indice: number;
  m2Clasificados: number;
  /** Hornos que se infiere que cuecen este formato en el turno. */
  hornos: number;
  m2Horno: number;
  /** Líneas que clasificaron este formato en el turno (0 = ninguna). */
  lineas: number;
  piezas: number;
  /** clasificado − horno de este turno. */
  diferencia: number;
  /** Suma corrida de la diferencia desde el primer turno de la serie. */
  diferenciaAcumulada: number;
  clasificadoAcumulado: number;
  hornoAcumulado: number;
}

export interface BalanceHorno {
  turnos: TurnoBalance[];
  m2Clasificados: number;
  m2Horno: number;
  /** 100 × clasificado ÷ horno (0 si el horno no cuece el formato en el periodo). */
  pctClasificadoSobreHorno: number;
  diferencia: number;
  /** Turnos en los que se infiere que algún horno cuece este formato. */
  turnosConHorno: number;
  desde: string;
  hasta: string;
}

/**
 * Balance del formato elegido en el periodo: lo clasificado por todas las líneas
 * frente a lo que sacan los hornos que, según la inferencia, lo cuecen. Devuelve
 * null si no hay clasificación del formato o faltan los m²/día del horno.
 * `clasificadoPlanta` trae TODOS los formatos (la inferencia los necesita).
 */
export function construirBalance(clasificadoPlanta: ClasificadoTurnoFormato[], parametros: HornoFormato[], formato: string): BalanceHorno | null {
  const hornosPorTurno = inferirHornos(clasificadoPlanta, parametros);
  if (hornosPorTurno.length === 0) return null;

  const m2Formato = new Map<string, ClasificadoTurnoFormato>();
  for (const c of clasificadoPlanta) if (c.formato === formato) m2Formato.set(claveTurno(c.fecha, c.tipoTurno), c);
  if (m2Formato.size === 0) return null;

  const turnos: TurnoBalance[] = [];
  let acumDif = 0;
  let acumClas = 0;
  let acumHorno = 0;
  let conHorno = 0;

  for (const h of hornosPorTurno) {
    const p = parametrosVigentes(parametros, formato, h.fecha);
    if (!p) return null;
    const c = m2Formato.get(claveTurno(h.fecha, h.tipoTurno));
    const n = h.hornos.get(formato) ?? 0;
    const horno = n * m2UnHornoPorTurno(p);
    const clas = c?.m2Clasificados ?? 0;
    if (n > 0) conHorno++;
    acumDif += clas - horno;
    acumClas += clas;
    acumHorno += horno;
    turnos.push({
      fecha: h.fecha,
      tipoTurno: h.tipoTurno,
      indice: turnos.length,
      m2Clasificados: clas,
      hornos: n,
      m2Horno: horno,
      lineas: c?.lineasConProduccion ?? 0,
      piezas: c?.piezasTotal ?? 0,
      diferencia: clas - horno,
      diferenciaAcumulada: acumDif,
      clasificadoAcumulado: acumClas,
      hornoAcumulado: acumHorno,
    });
  }

  return {
    turnos,
    m2Clasificados: acumClas,
    m2Horno: acumHorno,
    pctClasificadoSobreHorno: acumHorno > 0 ? (100 * acumClas) / acumHorno : 0,
    diferencia: acumDif,
    turnosConHorno: conHorno,
    desde: turnos[0].fecha,
    hasta: turnos[turnos.length - 1].fecha,
  };
}
