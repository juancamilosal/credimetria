// Pruebas de las reglas con el texto de los PDF reales de octubre de 2026
// (pdftotext -layout). Correr: npm test (en robots/).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fecha, masReciente, REGLAS, revisar } from "../reglas.mjs";

const USURA = { tasa: 28.59, mv: 2.118 };
const texto = (banco) =>
  readFileSync(new URL(`./textos/${banco}.txt`, import.meta.url), "utf8");

/** Lo que se publicó a mano en octubre de 2026 desde estos PDF. */
const ESPERADO = {
  bbva: [1.77, 23.47, 2.12, 28.56, "2026-10-05"],
  "banco-de-bogota": [1.13, 14.49, null, null, "2026-10-01"],
  bancolombia: [1.3, 16.77, 2.12, 28.57, "2026-10-01"],
  davivienda: [1.38, 17.87, null, null, "2026-10-19"],
  "av-villas": [1.24, 16, 2.118, 28.59, "2026-10-01"],
};

describe("reglas por banco", () => {
  for (const [
    banco,
    [mvDesde, eaDesde, mvHasta, eaHasta, vigencia],
  ] of Object.entries(ESPERADO)) {
    it(`${banco}: lee la tasa de libre inversión`, () => {
      const t = REGLAS[banco].leer(texto(banco));
      assert.deepEqual(
        [t.mvDesde, t.eaDesde, t.mvHasta, t.eaHasta, t.vigencia],
        [mvDesde, eaDesde, mvHasta, eaHasta, vigencia],
      );
      assert.deepEqual(revisar(t, USURA), []);
      assert.ok(t.frase);
    });
  }

  it("avisa qué no encontró si el PDF cambió de forma", () => {
    assert.throws(
      () => REGLAS.bbva.leer(texto("davivienda")),
      /No encontré la vigencia/,
    );
    assert.throws(
      () => REGLAS.bancolombia.leer("Un PDF distinto"),
      /No encontré la vigencia de libre inversión/,
    );
  });
});

describe("revisar", () => {
  const buena = {
    mvDesde: 1.3,
    eaDesde: 16.77,
    mvHasta: 2.12,
    eaHasta: 28.57,
    vigencia: "2026-10-01",
  };

  it("acepta una tasa normal", () => {
    assert.deepEqual(revisar(buena, USURA), []);
  });

  it("rechaza lo que no tiene sentido", () => {
    assert.match(
      revisar({ ...buena, eaHasta: 31 }, USURA).join(),
      /supera la usura/,
    );
    assert.match(
      revisar({ ...buena, eaDesde: 0.85 }, USURA).join(),
      /no es creíble/,
    );
    assert.match(
      revisar({ ...buena, mvDesde: 1.9 }, USURA).join(),
      /no cuadra/,
    );
    assert.match(
      revisar({ ...buena, vigencia: null }, USURA).join(),
      /desde cuándo rige/,
    );
  });
});

describe("ayudas", () => {
  it("entiende las fechas de los PDF", () => {
    assert.equal(fecha("1 de Octubre de 2026, para"), "2026-10-01");
    assert.equal(fecha("Octubre 05 de 2026"), "2026-10-05");
    assert.equal(fecha("octubre de 2026"), "2026-10-01");
    assert.equal(fecha("19 de Octubre de 2026"), "2026-10-19");
    assert.equal(fecha("sin fecha"), null);
  });

  it("elige el enlace del mes más reciente", () => {
    assert.equal(
      masReciente([
        "/x/Actualizacion_tasas_Septiembre_2026.pdf",
        "/x/Actualizacion_tasas_Noviembre_2026.pdf",
        "/x/Actualizacion_tasas_Octubre_2026.pdf",
      ]),
      "/x/Actualizacion_tasas_Noviembre_2026.pdf",
    );
    assert.equal(
      masReciente([
        "/d/Tasas+Activas+01+Abril+2027.pdf",
        "/d/Tasas+Activas+01+Diciembre+2026.pdf",
      ]),
      "/d/Tasas+Activas+01+Abril+2027.pdf",
    );
  });
});
