import assert from "node:assert/strict";
import { test } from "node:test";
import { usuraDe } from "../tasas.mjs";

test("la usura de Directus llega con su mensual (2 decimales) y el mes", () => {
  assert.deepEqual(usuraDe({ tasa_ea: "28.34", mes: "2026-11-01" }), {
    tasa: 28.34,
    mv: 2.1,
    mes: "noviembre de 2026",
  });
});

test("sin dato de Directus queda la de usura.json", () => {
  const respaldo = usuraDe(null);
  assert.equal(typeof respaldo.tasa, "number");
  assert.match(respaldo.mes, /de 20\d\d$/);
});
