// frontend/src/lib/metros.ts
//
// METROS de la programación, leídos con la MISMA regla que la base de datos
// (`fn_metros_entero`, migración 20261003142002): se quita todo lo que no sea un
// dígito. Los metros son siempre enteros (m²) y el separador de miles puede llegar como
// punto o coma:
//   '5500', '5.500' y '5,500' = 5500 · '15.000' y '15,000' = 15000 · '5,5' = 55 (documentado)
//   vacío, ' - ' o texto sin dígitos = null · más de 18 dígitos = null
//
// Diferencia deliberada con la función SQL: aquí un valor ≤ 0 (p. ej. '0') también da null,
// porque los llamadores solo necesitan saber si hay unos metros utilizables, y la base de datos
// trata `coalesce(metros, 0) <= 0` como «falta METROS». Si cambia la regla, cambiarla en las dos.
//
// Módulo puro y sin dependencias (se verifica con un script desechable: el repo no tiene tests).

export function metrosDeTexto(raw: string): number | null {
  const digitos = raw.replace(/[^0-9]/g, "");
  if (digitos.length < 1 || digitos.length > 18) return null;
  const n = Number(digitos);
  return n > 0 ? n : null;
}
