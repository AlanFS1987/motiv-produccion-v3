// frontend/src/lib/normalizar-pegado.ts
//
// Pegado directo de celdas de Excel en Programación (memorias/22, Mejora 1).
//
// Al copiar celdas en Excel, el portapapeles trae TEXTO SEPARADO POR TABULADORES (no por
// `;`), y las celdas con saltos de línea o comillas van entre comillas (con las comillas
// internas duplicadas). El parser SQL (`parse_programacion`) espera `;`, así que se
// normaliza aquí ANTES de `guardarProgramacionCsv`; el parser y el diff no cambian y los
// CSV con `;` se siguen aceptando tal cual.
//
// Función pura y sin dependencias (se verifica con un script desechable: el repo no
// tiene tests). ESTADO: PROVISIONAL — escrita sin una muestra real de celdas pegadas
// (ver 20/22/07). Lo que sí se sabe de los CSV reales ya guardados: la cabecera empieza
// con una primera columna vacía (el horno/formato), METROS llega como " 4.500   " (punto
// de miles, con espacios) y otras columnas usan coma decimal ("9,4"). Cómo llega todo
// eso al copiar celdas directamente solo lo confirma una muestra real.

/** Quita el BOM y unifica los saltos de línea (\r\n y \r sueltos → \n). */
function normalizarSaltos(texto: string): string {
  return texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/** ¿Termina la línea con una celda entrecomillada sin cerrar? (cuenta comillas, "" no cuenta) */
function comillasImpares(linea: string): boolean {
  const sinDobles = linea.replace(/""/g, "");
  return (sinDobles.match(/"/g)?.length ?? 0) % 2 === 1;
}

/**
 * Una línea se lee como celdas de Excel si trae tabuladores, o si empieza por comilla y
 * no parece un CSV con `;` (o deja una comilla abierta). Las demás pasan intactas.
 */
function esLineaDeCeldas(linea: string): boolean {
  if (linea.includes("\t")) return true;
  if (!linea.startsWith('"')) return false;
  return !linea.includes(";") || comillasImpares(linea);
}

/**
 * Lee un registro de celdas separadas por tabulador empezando en `lineas[desde]`.
 * Si una celda entrecomillada contiene saltos de línea, consume las líneas siguientes
 * (el salto interno pasa a ser un espacio). Devuelve las celdas y el índice de la
 * siguiente línea sin consumir.
 */
function leerRegistro(lineas: string[], desde: number): { celdas: string[]; siguiente: number } {
  const celdas: string[] = [];
  let i = desde;
  let linea = lineas[i];
  let pos = 0;
  let celda = "";
  let enComillas = false;
  let inicioCelda = true;

  for (;;) {
    if (pos >= linea.length) {
      if (!enComillas) break;
      i += 1;
      if (i >= lineas.length) break; // comilla sin cerrar al final del texto: se deja lo leído
      celda += " ";
      linea = lineas[i];
      pos = 0;
      continue;
    }

    const c = linea[pos];

    if (enComillas) {
      if (c === '"') {
        const sig = linea[pos + 1];
        if (sig === '"') {
          celda += '"'; // "" → "
          pos += 2;
        } else if (sig === undefined || sig === "\t") {
          enComillas = false; // comilla de cierre
          pos += 1;
        } else {
          celda += '"'; // comilla suelta dentro de la celda: se conserva
          pos += 1;
        }
      } else {
        celda += c;
        pos += 1;
      }
      continue;
    }

    if (c === "\t") {
      celdas.push(celda);
      celda = "";
      inicioCelda = true;
      pos += 1;
    } else if (c === '"' && inicioCelda) {
      enComillas = true;
      inicioCelda = false;
      pos += 1;
    } else {
      celda += c;
      inicioCelda = false;
      pos += 1;
    }
  }

  celdas.push(celda);
  return { celdas, siguiente: i + 1 };
}

/**
 * Convierte lo pegado desde Excel al formato que espera el parser SQL:
 *  - quita el BOM y normaliza `\r\n`;
 *  - líneas con tabuladores → celdas separadas por tabulador, unidas con `;`;
 *  - celdas entre comillas: se descomillan, `""` → `"`, saltos internos → espacio;
 *  - un `;` dentro de una celda pasa a `,` (para no desplazar columnas);
 *  - líneas que ya usan `;` y no tienen tabuladores: intactas.
 */
export function normalizarPegado(texto: string): string {
  const lineas = normalizarSaltos(texto).split("\n");
  const salida: string[] = [];

  let i = 0;
  while (i < lineas.length) {
    if (esLineaDeCeldas(lineas[i])) {
      const { celdas, siguiente } = leerRegistro(lineas, i);
      salida.push(celdas.map((c) => c.replace(/;/g, ",")).join(";"));
      i = siguiente;
    } else {
      salida.push(lineas[i]);
      i += 1;
    }
  }

  return salida.join("\n");
}

/** ¿Trae el texto celdas copiadas de Excel (tabuladores)? Sirve para avisar en pantalla. */
export function traeCeldasDeExcel(texto: string): boolean {
  return texto.includes("\t");
}

/**
 * Avisos sobre lo pegado, SIN modificarlo. Hoy solo uno: si la primera celda de una
 * cabecera es «Nº ORDEN», se ha copiado desde esa columna y falta la anterior (la del
 * horno/formato): el parser lee el número de orden en la 2.ª columna, así que todo
 * quedaría desplazado y no se reconocería ninguna orden.
 */
export function avisosDePegado(textoNormalizado: string): string[] {
  const avisos: string[] = [];
  const lineas = textoNormalizado.split("\n");
  const cabeceraDesplazada = lineas.some((l) => {
    const mayus = l.toUpperCase();
    return mayus.includes("Nº ORDEN") && mayus.includes("MODELO") && l.split(";")[0].trim().toUpperCase().startsWith("Nº ORDEN");
  });
  if (cabeceraDesplazada) {
    avisos.push(
      "La cabecera empieza en «Nº ORDEN»: parece que has copiado desde esa columna. Copia también la columna anterior (la del horno/formato), si no, no se reconocerá ninguna orden.",
    );
  }
  return avisos;
}
