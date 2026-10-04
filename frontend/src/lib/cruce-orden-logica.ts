// Lógica pura (sin Supabase) del cruce del Nº de orden leído en la Foto 1 contra lotes y programación.
import { modeloDeProgramacion, modelosIguales, normalizarModeloComparable } from "./validar-orden.ts";

/**
 * Único sitio que controla si el aviso «la orden ya existe con otro modelo» BLOQUEA Confirmar.
 * false = solo aviso (despliegue inicial). Pasar a true tras ~2 semanas de observación
 * (ver memorias/07-pendientes.md, revisar el 2026-10-18).
 */
export const BLOQUEAR_CRUCE_MODELO = false;

export interface CruceOrden {
  lote: { numero_orden: string; modelo: string; objetivo_m2: number | null } | null;
  programacion: { numero_orden: string; modelo: string } | null;
  /** Órdenes de la misma longitud que difieren en UN dígito. Los de lote traen marca y formato; los de programación no. */
  parecidos: {
    numero_orden: string;
    modelo: string | null;
    marca: string | null;
    formato: string | null;
    origen: "lote" | "programacion";
  }[];
}

export interface LeidoHoja {
  modelo: string;
  marca: string;
  /** Formato tal cual leído (DIMENSIONES); se normaliza con normFormato. */
  formato: string;
}

export interface EvaluacionCruce {
  loteExiste: boolean;
  /** Modelo del lote existente si NO es igual al leído; null si coincide o no hay lote. */
  modeloLoteDistinto: string | null;
  programacionModelo: string | null;
  programacionDistinta: boolean;
  sugerencias: CruceOrden["parecidos"];
  /** Si el lote existe, el objetivo es el del lote, de solo lectura y no se valida lo leído. */
  objetivoSoloLectura: boolean;
  objetivoLote: number | null;
  bloquea: boolean;
}

export function evaluarCruce(
  cruce: CruceOrden | null,
  leido: LeidoHoja,
  normFormato: (t: string | null) => string | null,
  bloquear: boolean = BLOQUEAR_CRUCE_MODELO,
): EvaluacionCruce {
  const lote = cruce?.lote ?? null;
  const prog = cruce?.programacion ?? null;
  const modeloLoteDistinto = lote && !modelosIguales(lote.modelo, leido.modelo) ? lote.modelo : null;
  const programacionDistinta = !!prog && !modelosIguales(modeloDeProgramacion(prog.modelo), leido.modelo);

  const formatoLeido = normFormato(leido.formato);
  const marcaLeida = normalizarModeloComparable(leido.marca);
  // Sugerencia solo si el número leído NO tiene lote y el candidato es el MISMO PRODUCTO
  // (modelo + marca + formato). La programación no trae marca: allí se compara modelo + formato.
  const sugerencias = lote || !cruce
    ? []
    : cruce.parecidos.filter((c) => {
        if (formatoLeido === null) return false;
        if (c.origen === "lote") {
          return (
            modelosIguales(c.modelo, leido.modelo) &&
            marcaLeida !== "" &&
            normalizarModeloComparable(c.marca) === marcaLeida &&
            c.formato === formatoLeido
          );
        }
        return (
          modelosIguales(modeloDeProgramacion(c.modelo), leido.modelo) && normFormato(c.modelo) === formatoLeido
        );
      });

  return {
    loteExiste: lote !== null,
    modeloLoteDistinto,
    programacionModelo: prog?.modelo ?? null,
    programacionDistinta,
    sugerencias,
    objetivoSoloLectura: lote !== null,
    objetivoLote: lote?.objetivo_m2 ?? null,
    bloquea: bloquear && modeloLoteDistinto !== null,
  };
}
