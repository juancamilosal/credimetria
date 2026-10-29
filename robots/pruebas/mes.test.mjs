// Pruebas de cuándo una fuente manual queda pendiente de cargar.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pendienteDelMes } from "../comun/mes.mjs";

describe("pendienteDelMes", () => {
  const hoy = new Date("2026-11-03T15:00:00Z");

  it("pendiente si nunca se revisó o se revisó el mes pasado", () => {
    assert.equal(pendienteDelMes(null, hoy), true);
    assert.equal(pendienteDelMes("2026-10-28T20:00:00.000Z", hoy), true);
  });

  it("al día si se revisó este mes", () => {
    assert.equal(pendienteDelMes("2026-11-02T14:00:00.000Z", hoy), false);
  });

  it("el mes empieza a la medianoche de Colombia, no de UTC", () => {
    // 1 nov a las 2 a. m. UTC = 31 oct 9 p. m. en Colombia: sigue octubre.
    const revisada = "2026-10-15T15:00:00.000Z";
    assert.equal(
      pendienteDelMes(revisada, new Date("2026-11-01T02:00:00Z")),
      false,
    );
    assert.equal(
      pendienteDelMes(revisada, new Date("2026-11-01T05:00:00Z")),
      true,
    );
  });
});
