// Ejecutar: node --test frontend/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapearFilaGestion, textoHace, textoPctObjetivo, formatPendiente, type FilaLoteGestion } from "../src/lib/lote-logica.ts";

const fila = (o: Partial<FilaLoteGestion> = {}): FilaLoteGestion => ({
  lote_id: "l1",
  numero_orden: "1114136",
  estado: "iniciado",
  modelo: "CROSSCUT",
  marca: "ARGENTA",
  formato: "600x1200",
  m2_pendiente: "500.32",
  piezas_pendiente: 695,
  pct_objetivo: "0.49968",
  ultima_actividad: "2026-10-01T10:00:00Z",
  tiene_parte_abierto: true,
  ...o,
});

test("mapea la fila de la vista (numeric como string o number)", () => {
  const l = mapearFilaGestion(fila());
  assert.equal(l.id, "l1");
  assert.equal(l.m2Pendiente, 500.32);
  assert.equal(l.piezasPendiente, 695);
  assert.equal(l.pctObjetivo, 0.49968);
  assert.equal(l.tieneParteAbierto, true);
  assert.equal(l.formatoNombre, "600x1200");
});

test("sin objetivo: pendiente y % quedan en null (nunca 0); nulos de texto tienen valor por defecto", () => {
  const l = mapearFilaGestion(fila({ m2_pendiente: null, piezas_pendiente: null, pct_objetivo: null, modelo: null, marca: null, numero_orden: null, tiene_parte_abierto: null }));
  assert.equal(l.m2Pendiente, null);
  assert.equal(l.piezasPendiente, null);
  assert.equal(l.pctObjetivo, null);
  assert.equal(l.modeloNombre, "—");
  assert.equal(l.numeroOrden, "");
  assert.equal(l.tieneParteAbierto, false);
});

test("pendiente 0 sigue siendo 0, no null", () => {
  const l = mapearFilaGestion(fila({ m2_pendiente: "0", piezas_pendiente: 0 }));
  assert.equal(l.m2Pendiente, 0);
  assert.equal(l.piezasPendiente, 0);
});

test("textoHace: hoy, 1 día, N días, sin actividad", () => {
  const ahora = new Date("2026-10-04T12:00:00Z");
  assert.equal(textoHace("2026-10-04T08:00:00Z", ahora), "hoy");
  assert.equal(textoHace("2026-10-03T08:00:00Z", ahora), "hace 1 día");
  assert.equal(textoHace("2026-10-01T12:00:00Z", ahora), "hace 3 días");
  assert.equal(textoHace(null, ahora), "sin actividad");
  assert.equal(textoHace("basura", ahora), "sin actividad");
  assert.equal(textoHace("2026-10-05T12:00:00Z", ahora), "hoy"); // reloj adelantado: nunca negativo
});

test("textoPctObjetivo: redondea, no recorta a 100 y respeta null", () => {
  assert.equal(textoPctObjetivo(0.49968), "50 %");
  assert.equal(textoPctObjetivo(1), "100 %");
  assert.equal(textoPctObjetivo(1.12), "112 %");
  assert.equal(textoPctObjetivo(0), "0 %");
  assert.equal(textoPctObjetivo(null), null);
});

test("formatPendiente: m² a 1 decimal y piezas enteras", () => {
  assert.equal(formatPendiente(500.32, 695.4), "500,3 m² · 695 piezas");
});
