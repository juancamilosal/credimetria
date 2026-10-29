// Pruebas del resaltado de la tasa en el PDF, con las cajas de palabras de
// páginas reales de octubre de 2026 (pdftotext -bbox-layout).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  aResaltar,
  cifrasPublicadas,
  palabrasDe,
  recuadros,
  resaltarPdf,
} from "../comun/resaltar.mjs";
import { mensual } from "../reglas.mjs";

const pagina = (nombre) =>
  palabrasDe(
    readFileSync(
      new URL(`textos/${nombre}.bbox.html`, import.meta.url),
      "utf8",
    ),
  );
const textos = (marcadas) => marcadas.map((p) => p.texto).join(" ");

describe("resaltar la tasa en el PDF", () => {
  it("Serfinanza: las cifras de la misma fila, no las repetidas de pensionados", () => {
    const marcadas = aResaltar(
      pagina("banco-serfinanza-libranza"),
      [1.39, 18.02, 1.49, 19.42],
      /libranza/i,
      "2026-10-01",
    );
    const t = textos(marcadas);
    assert.match(t, /Libranzas Convenios hasta a \$49MM/);
    assert.match(t, /a partir del 1 de octubre de 2026/);
    // Filas de convenios (arriba), no las de pensionados.
    const cifras = marcadas.filter((p) => /%/.test(p.texto));
    assert.equal(cifras.length, 4);
    assert.ok(
      cifras.every((p) => p.y0 < 400),
      JSON.stringify(cifras),
    );
  });

  it("Davivienda: título del producto, cifras y vigencia de la página", () => {
    const t = textos(
      aResaltar(
        pagina("davivienda-libranza"),
        [1.3, 16.76],
        /libranza/i,
        "2026-10-19",
      ),
    );
    assert.match(t, /Vigente a partir del 19 de Octubre de 2026/);
    assert.match(t, /1,30% 16,76%/);
    assert.match(t, /Libranza/);
  });

  it("si no encuentra las cifras, no resalta nada", () => {
    assert.deepEqual(
      aResaltar(pagina("davivienda-libranza"), [9.99], /libranza/i, null),
      [],
    );
  });

  it("une las palabras seguidas de un renglón en un recuadro", () => {
    const p = (x0, x1, y0) => ({ pagina: 0, x0, x1, y0, y1: y0 + 10 });
    // La segunda palabra viene de otra línea del PDF pero en el mismo renglón.
    const r = recuadros([
      p(0, 10, 0),
      p(100, 110, 0),
      p(12, 20, 1),
      p(0, 5, 30),
    ]);
    assert.deepEqual(
      r.map((x) => [x.x0, x.x1, x.y0]),
      [
        [0, 20, 0],
        [100, 110, 0],
        [0, 5, 30],
      ],
    );
  });

  it("devuelve una copia del PDF con los recuadros (el original no cambia)", async () => {
    const doc = await PDFDocument.create();
    const hoja = doc.addPage([400, 200]);
    const letra = await doc.embedFont(StandardFonts.Helvetica);
    hoja.drawText("Credito de Libranza", {
      x: 20,
      y: 160,
      size: 12,
      font: letra,
    });
    hoja.drawText("Desde 1,30% M.V. 16,76% E.A.", {
      x: 20,
      y: 130,
      size: 12,
      font: letra,
    });
    const original = Buffer.from(await doc.save());
    const copia = await resaltarPdf(original, {
      cifras: [1.3, 16.76],
      producto: "libranza",
    });
    assert.ok(copia);
    assert.notDeepEqual(copia, original);
    assert.equal((await PDFDocument.load(copia)).getPageCount(), 1);
    assert.equal(
      await resaltarPdf(original, { cifras: [5.55], producto: "libranza" }),
      null,
    );
  });
});

describe("cifrasPublicadas", () => {
  it("no busca la M.V. que calculamos de la E.A. (Banco Agrario)", () => {
    // 14,70 % E.A. → 1,1495 % M.V. calculada: en el PDF no está y "1,15 %"
    // aparecía en la tabla de tarjetas de crédito.
    assert.deepEqual(cifrasPublicadas(mensual(14.7), 14.7, null, null), [
      null,
      14.7,
      null,
      null,
    ]);
    // Guardada en Directus como texto.
    assert.deepEqual(cifrasPublicadas("1.1495", "14.7000", null, null), [
      null,
      "14.7000",
      null,
      null,
    ]);
  });

  it("sí busca la M.V. que publica el banco", () => {
    // BBVA: 12,10 % E.A. y 0,96 % M.V. (la calculada sería 0,9555).
    assert.deepEqual(
      cifrasPublicadas(0.96, 12.1, 1.27, 16.3),
      [0.96, 12.1, 1.27, 16.3],
    );
  });
});
