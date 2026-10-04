// Ejecutar: node --test frontend/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluarCruce, BLOQUEAR_CRUCE_MODELO, type CruceOrden } from "../src/lib/cruce-orden-logica.ts";
import { normalizarFormato } from "../src/lib/normalizacion.ts";

const leido = { modelo: "CROSSCUT PETRA OUT", marca: "ARGENTA", formato: "600x1200" };
const vacio: CruceOrden = { lote: null, programacion: null, parecidos: [] };
const parecido = (o: Partial<CruceOrden["parecidos"][number]>): CruceOrden["parecidos"][number] => ({
  numero_orden: "1114136",
  modelo: "CROSSCUT PETRA OUT",
  marca: "ARGENTA",
  formato: "600x1200",
  origen: "lote",
  ...o,
});
const ev = (c: CruceOrden | null, bloquear?: boolean) => evaluarCruce(c, leido, normalizarFormato, bloquear);

test("la constante de bloqueo arranca en false (solo aviso)", () => {
  assert.equal(BLOQUEAR_CRUCE_MODELO, false);
});

test("sugerencia: mismo producto a un dígito sí; mismo modelo con otro formato o marca no", () => {
  assert.equal(ev({ ...vacio, parecidos: [parecido({})] }).sugerencias.length, 1);
  assert.equal(ev({ ...vacio, parecidos: [parecido({ formato: "1200x1200" })] }).sugerencias.length, 0);
  assert.equal(ev({ ...vacio, parecidos: [parecido({ marca: "CIFRE" })] }).sugerencias.length, 0);
  assert.equal(ev({ ...vacio, parecidos: [parecido({ modelo: "CROSSCUT PETRA OUT AN" })] }).sugerencias.length, 0);
});

test("sugerencia desde programación: modelo + formato (el formato va en el texto)", () => {
  const prog = (modelo: string) => parecido({ origen: "programacion", marca: null, formato: null, modelo });
  assert.equal(ev({ ...vacio, parecidos: [prog("CROSSCUT PETRA OUT (PRC)60X120RC/ARG02_S")] }).sugerencias.length, 1);
  assert.equal(ev({ ...vacio, parecidos: [prog("CROSSCUT PETRA OUT (PRC)120X120RC/ARG02_S")] }).sugerencias.length, 0);
});

test("sin sugerencia si el número leído ya tiene lote", () => {
  const c: CruceOrden = {
    lote: { numero_orden: "1114137", modelo: "CROSSCUT PETRA OUT", objetivo_m2: 3000 },
    programacion: null,
    parecidos: [parecido({})],
  };
  assert.equal(ev(c).sugerencias.length, 0);
});

test("lote existente: objetivo de solo lectura con el valor del lote", () => {
  const c: CruceOrden = { ...vacio, lote: { numero_orden: "1114137", modelo: "CROSSCUT PETRA OUT", objetivo_m2: 3000 } };
  const r = ev(c);
  assert.equal(r.objetivoSoloLectura, true);
  assert.equal(r.objetivoLote, 3000);
  assert.equal(ev(vacio).objetivoSoloLectura, false);
});

test("modelo distinto en lote existente: aviso, y solo bloquea con la constante a true", () => {
  const c: CruceOrden = { ...vacio, lote: { numero_orden: "1114137", modelo: "CROSSCUT PETRA OUT AN", objetivo_m2: 3000 } };
  assert.equal(ev(c).modeloLoteDistinto, "CROSSCUT PETRA OUT AN");
  assert.equal(ev(c).bloquea, false); // valor por defecto de la constante
  assert.equal(ev(c, false).bloquea, false);
  assert.equal(ev(c, true).bloquea, true);
  const igual: CruceOrden = { ...vacio, lote: { numero_orden: "1114137", modelo: "Crosscut Petra-Out", objetivo_m2: 3000 } };
  assert.equal(ev(igual, true).bloquea, false);
});

test("programación: modelo distinto (igualdad exacta) se marca; igual no", () => {
  const p = (modelo: string): CruceOrden => ({ ...vacio, programacion: { numero_orden: "1114137", modelo } });
  assert.equal(ev(p("CROSSCUT PETRA OUT (PRC)60X120RC/ARG02_S")).programacionDistinta, false);
  assert.equal(ev(p("CROSSCUT PETRA OUT AN (PRC)60X120RC/ARG02_S")).programacionDistinta, true);
  assert.equal(ev(p("X")).bloquea, false);
});
