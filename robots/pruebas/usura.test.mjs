import assert from "node:assert/strict";
import { test } from "node:test";
import { usuraDe } from "../comun/usura.mjs";

test("la usura de Directus trae su mensual con 2 decimales y el mes en palabras", () => {
  assert.deepEqual(usuraDe({ tasa_ea: "28.34", mes: "2026-11-01" }), {
    tasa: 28.34,
    mv: 2.1,
    mes: "noviembre de 2026",
  });
  assert.equal(usuraDe({ tasa_ea: "28.59", mes: "2026-10-01" }).mv, 2.12);
});

test("sin dato devuelve null (y el robot usa usura.json)", () => {
  assert.equal(usuraDe(null), null);
  assert.equal(usuraDe({ tasa_ea: null, mes: "2026-11-01" }), null);
});
