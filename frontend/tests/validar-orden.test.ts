// Ejecutar: node --test frontend/tests/validar-orden.test.ts  (Node >= 22, sin dependencias)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as front from "../src/lib/validar-orden.ts";
import * as back from "../../supabase/functions/_shared/validacion-orden.ts";

for (const [nombre, m] of [["frontend", front], ["servidor", back]] as const) {
  test(`${nombre}: número de orden`, () => {
    const ok = m.normalizarNumeroOrden("11.147.69");
    assert.equal(ok.valor, "1114769");
    assert.equal(ok.corregido, true);
    assert.equal(m.normalizarNumeroOrden("1114769").corregido, false);
    for (const malo of ["1.16640", "11172222", "843559203684", "M-14 CAL", "", null]) {
      const r = m.normalizarNumeroOrden(malo);
      assert.equal(r.valor, null, String(malo));
      assert.equal(r.error, "7 dígitos y empieza por 11");
    }
  });

  test(`${nombre}: objetivo m²`, () => {
    const casos: [string, number | null, boolean][] = [
      ["11.000.000", 11000, true],
      ["3000000", 3000, true],
      ["4", 4000, true],
      ["4000002", 4000, true],
      ["111604", null, false],
      ["2.000,000", 2000, false],
      ["2000", 2000, false],
      ["", null, false],
      ["0", null, false],
      ["100", 100, false],
      ["50000", 50000, false],
      ["50001", null, false],
      ["50", 50000, true],
      ["99", null, false], // 99 x 1000 = 99.000, fuera de rango
    ];
    for (const [entrada, valor, corregido] of casos) {
      const r = m.normalizarObjetivoM2(entrada);
      assert.equal(r.valor, valor, entrada);
      if (valor !== null) assert.equal(r.corregido, corregido, entrada);
      else assert.ok(r.error, entrada);
    }
    assert.equal(m.textoCorreccionObjetivo("11.000.000", 11000), "Corregido: 11.000.000 -> 11.000");
    assert.equal(m.textoCorreccionObjetivo("3000000", 3000), "Corregido: 3.000.000 -> 3.000");
  });

  test(`${nombre}: objetivo numérico (servidor)`, () => {
    assert.equal(m.normalizarObjetivoNumero(11000000).valor, 11000);
    assert.equal(m.normalizarObjetivoNumero(2000).valor, 2000);
    assert.equal(m.normalizarObjetivoNumero(111604).valor, null);
    assert.equal(m.normalizarObjetivoNumero(2000.5).valor, null);
    assert.equal(m.normalizarObjetivoNumero(null).valor, null);
    assert.equal(m.normalizarObjetivoNumero("2000").valor, null);
  });

  test(`${nombre}: normalizarModeloComparable da el resultado literal (flag u, letras M y p intactas)`, () => {
    assert.equal(m.normalizarModeloComparable("Cálá Désert Ánt"), "CALADESERTANT");
    assert.equal(m.normalizarModeloComparable("SL Mapa-Pampa M (PRC)"), "SLMAPAPAMPAMPRC");
    assert.equal(m.normalizarModeloComparable("pM p{M} Mp"), "PMPMMP");
    assert.equal(m.normalizarModeloComparable("Crème  Brûlée"), "CREMEBRULEE");
    assert.equal(m.normalizarModeloComparable(null), "");
  });

  test(`${nombre}: modelos (igualdad exacta normalizada)`, () => {
    assert.ok(m.modelosIguales("SL Irati-Taupe ", "SL IRATI TAUPE"));
    assert.ok(m.modelosIguales("Cálá  Désert", "CALA DESERT"));
    assert.ok(m.modelosIguales(m.modeloDeProgramacion("SL IRATI TAUPE (PRC) 30X120RC /DST04_S"), "SL IRATI TAUPE"));
    assert.ok(m.modelosIguales(m.modeloDeProgramacion("SL IRATI TAUPE(PRC)30X120RC/DST04_S"), "SL IRATI TAUPE"));
    for (const [x, y] of [
      ["CALA DESERT", "CALA DESERT ANT"],
      ["SL LIVIA CREAM", "SL LIVIA CREAM LM"],
      ["CLASS AVORIO", "CLASS AVORIO PL"],
      ["SL MIDTOWN CREAM", "SL MIDTOWN CREAM NPL"],
      ["SL NEUTRA CREAM", "SL NEUTRA CREAM AN"],
    ]) {
      assert.ok(!m.modelosIguales(x, y), `${x} != ${y}`);
      assert.ok(!m.modelosIguales(y, x));
    }
    assert.ok(!m.modelosIguales("", ""));
    assert.ok(!m.modelosIguales(null, "X"));
  });
}
