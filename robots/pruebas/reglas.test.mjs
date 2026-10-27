// Pruebas de las reglas con el texto de los PDF reales de octubre de 2026
// (pdftotext -layout). Correr: npm test (en robots/).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { textoHtml } from "../comun/pdf.mjs";
import {
  fecha,
  masReciente,
  mensual,
  mesVencido,
  mismasTasas,
  REGLAS,
  reglaDe,
  revisar,
} from "../reglas.mjs";

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
  "banco-falabella": [1.13, 14.435, 2.117, 28.581, "2026-10-01"],
  bancoomeva: [mensual(24.6), 24.6, null, null, "2026-10-01"],
  "banco-serfinanza": [1.69, 22.28, 1.79, 23.75, "2026-10-01"],
  "banco-agrario": [mensual(26.68), 26.68, mensual(27.64), 27.64, "2026-10-05"],
  "banco-caja-social": [1.37, 17.75, 1.99, 26.7, "2026-06-18"],
  "banco-de-occidente": [1.55, 20.27, 2.11, 28.44, "2026-10-01"],
  davibank: [mensual(17.74), 17.74, mensual(28.59), 28.59, "2026-10-01"],
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

  it("banco-popular: lee la tabla de su página (no publica PDF)", () => {
    const html = readFileSync(
      new URL("./textos/banco-popular.html", import.meta.url),
      "utf8",
    );
    const t = REGLAS["banco-popular"].leer(textoHtml(html));
    assert.deepEqual(
      [t.eaDesde, t.eaHasta, t.mvDesde, t.mvHasta, t.vigencia],
      [25.23, 25.23, mensual(25.23), mensual(25.23), "2026-02-05"],
    );
    // No toma la tabla de compra de cartera (24,10 %).
    assert.doesNotMatch(t.frase, /24,1000/);
    assert.deepEqual(revisar(t, USURA), []);
  });

  it("lulo-bank: lee el rango de su página legal (no publica PDF)", () => {
    const html = readFileSync(
      new URL("./textos/lulo-bank.html", import.meta.url),
      "utf8",
    );
    const t = REGLAS["lulo-bank"].leer(textoHtml(html));
    assert.deepEqual(
      [t.mvDesde, t.eaDesde, t.mvHasta, t.eaHasta, t.vigencia],
      [1.17, 14.97, 1.88, 25, "2025-10-01"],
    );
    assert.deepEqual(revisar(t, USURA), []);
  });

  it("banco-finandina: lee la fila y la revisión ve que supera la usura", () => {
    const t = REGLAS["banco-finandina"].leer(texto("banco-finandina"));
    assert.deepEqual(
      [t.mvDesde, t.eaDesde, t.eaHasta, t.vigencia],
      [2.15, 29.08, null, "2026-09-01"],
    );
    // 29,08 % de septiembre no cabe en la usura de octubre (28,59 %).
    assert.match(revisar(t, USURA).join(), /supera la usura/);
  });

  it("banco-finandina: su página de tasas vigentes es más nueva que el PDF", () => {
    const html = readFileSync(
      new URL("./textos/banco-finandina-vigentes.html", import.meta.url),
      "utf8",
    );
    const regla = REGLAS["banco-finandina"];
    const pagina = regla.paginaVigente.leer(textoHtml(html));
    assert.deepEqual(
      [pagina.mvDesde, pagina.eaDesde, pagina.vigencia],
      [2.11, 28.48, "2026-10-01"],
    );
    assert.deepEqual(revisar(pagina, USURA), []);
    // La del PDF de septiembre es más vieja: el robot usaría la página.
    const pdf = regla.leer(texto("banco-finandina"));
    assert.ok(pagina.vigencia > pdf.vigencia);
  });

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

/**
 * Libranza, de los mismos PDF de octubre de 2026 (BBVA tiene uno aparte, del
 * 4 de agosto): la tasa fija más baja de la tabla y la más alta si la publica.
 */
const LIBRANZA = {
  bbva: ["bbva-libranza", 1.03, 13.14, null, null, "2026-08-04"],
  "banco-caja-social": [
    "banco-caja-social-libranza",
    1.29,
    16.65,
    2.08,
    28.05,
    "2026-06-19",
  ],
  "banco-de-bogota": ["banco-de-bogota", 1.3, 16.7, null, null, "2026-10-01"],
  davivienda: ["davivienda", 1.3, 16.76, null, null, "2026-10-19"],
  "av-villas": [
    "av-villas",
    mensual(16.15),
    16.15,
    mensual(28.59),
    28.59,
    "2026-10-01",
  ],
  bancolombia: ["bancolombia", 1.12, 14.3, 2.12, 28.57, "2026-10-01"],
  "banco-agrario": [
    "banco-agrario",
    mensual(19.3),
    19.3,
    mensual(25.6),
    25.6,
    "2026-10-05",
  ],
  "banco-serfinanza": [
    "banco-serfinanza",
    1.39,
    18.02,
    1.49,
    19.42,
    "2026-10-01",
  ],
  "banco-finandina": ["banco-finandina", 1.62, 21.27, null, null, "2026-09-01"],
  bancoomeva: ["bancoomeva", mensual(23.58), 23.58, null, null, "2026-10-01"],
};

describe("reglas de libranza", () => {
  for (const [
    banco,
    [archivo, mvDesde, eaDesde, mvHasta, eaHasta, vigencia],
  ] of Object.entries(LIBRANZA)) {
    it(`${banco}: lee la tasa de libranza`, () => {
      const t = reglaDe(banco, "libranza").leer(texto(archivo));
      assert.deepEqual(
        [t.mvDesde, t.eaDesde, t.mvHasta, t.eaHasta, t.vigencia],
        [mvDesde, eaDesde, mvHasta, eaHasta, vigencia],
      );
      assert.deepEqual(revisar(t, USURA), []);
      assert.ok(t.frase);
    });
  }

  it("busca el PDF igual que la regla de libre inversión del banco", () => {
    const hoy = new Date("2026-11-03T12:00:00");
    const fuente = { url: "https://x/tasas.pdf" };
    assert.deepEqual(
      reglaDe("banco-de-bogota", "libranza").buscar(fuente, hoy),
      REGLAS["banco-de-bogota"].buscar(fuente, hoy),
    );
    assert.equal(reglaDe("davivienda", "libranza").bloquea, true);
    assert.equal(reglaDe("bbva"), REGLAS.bbva);
    assert.equal(reglaDe("lulo-bank", "libranza"), undefined);
  });

  it("finandina: lee libranza en su página de tasas vigentes", () => {
    const html = readFileSync(
      new URL("./textos/banco-finandina-vigentes.html", import.meta.url),
      "utf8",
    );
    const t = reglaDe("banco-finandina", "libranza").paginaVigente.leer(
      textoHtml(html),
    );
    assert.deepEqual(
      [t.mvDesde, t.eaDesde, t.vigencia],
      [1.62, 21.27, "2026-10-01"],
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
    assert.equal(fecha("Febrero 5/2026 "), "2026-02-05");
    assert.equal(fecha("18-Jun-2026"), "2026-06-18");
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
    // Meses abreviados (Falabella).
    assert.equal(
      masReciente([
        "/doc/02-VERTICAL-TASAS-SEP-2026.pdf",
        "/doc/02-VERTICAL-TASAS-OCT-2026.pdf",
      ]),
      "/doc/02-VERTICAL-TASAS-OCT-2026.pdf",
    );
    // Bancoomeva: el idFile más alto.
    assert.equal(
      REGLAS.bancoomeva.elegir([
        "descargar.php?idFile=25298",
        "/descargar.php?idFile= 24960",
        "descargar.php?idFile=25257",
      ]),
      "https://www.bancoomeva.com.co/descargar.php?idFile=25298",
    );
    // Banco Agrario: la semana que empieza más tarde.
    assert.equal(
      REGLAS["banco-agrario"].elegir([
        "/doc/Tasas_colocaciones_del_19oct_al_25oct_2026.pdf",
        "/doc/Tasas_colocaciones_del_26oct_al_01nov_2026.pdf",
        "/doc/Tasas_colocaciones_del_28sep_al_04oct_2026.pdf",
      ]),
      "/doc/Tasas_colocaciones_del_26oct_al_01nov_2026.pdf",
    );
    // Números largos en la dirección no cuentan como año.
    assert.equal(
      masReciente([
        "/documents/37648/10212085/Tasas+Activas+01+Octubre+2026+%281%29.pdf/f5",
        "/documents/2920580/51181841/Tasas+Activas+01+Abril+2026v1.pdf/8d",
      ]),
      "/documents/37648/10212085/Tasas+Activas+01+Octubre+2026+%281%29.pdf/f5",
    );
  });
});

describe("mismasTasas", () => {
  const leida = {
    valor_desde: 1.3,
    valor_hasta: 2.12,
    ea_desde: 16.77,
    ea_hasta: 28.57,
  };
  const guardada = {
    valor_desde: "1.3000",
    valor_hasta: "2.1200",
    ea_desde: "16.7700",
    ea_hasta: "28.5700",
  };

  it("reconoce la misma tasa aunque Directus la mande como texto", () => {
    assert.equal(mismasTasas(leida, guardada), true);
  });

  it("ve el cambio en cualquiera de los cuatro valores", () => {
    assert.equal(
      mismasTasas(leida, { ...guardada, valor_desde: "1.3200" }),
      false,
    );
    assert.equal(
      mismasTasas(leida, { ...guardada, ea_hasta: "28.5900" }),
      false,
    );
    assert.equal(mismasTasas(leida, { ...guardada, valor_hasta: null }), false);
  });
});

describe("páginas web", () => {
  it("saca el texto visible, sin scripts ni etiquetas", () => {
    const t = textoHtml(
      '<p>Hola&nbsp;<b>mundo</b> &amp; m&aacute;s &#36;1</p><script>var x = "no";</script>',
    );
    assert.equal(t, "Hola mundo & m&aacute;s $1");
  });

  it("pasa de E.A. a M.V.", () => {
    assert.equal(mensual(25.23), 1.8925);
    assert.equal(mensual(16.77), 1.3003);
  });
});

describe("mesVencido", () => {
  const dia = (d) => new Date(2026, 10, d); // noviembre de 2026
  it("avisa desde el día 2 si lo guardado es de un mes anterior", () => {
    assert.equal(mesVencido("2026-10-01", dia(1)), false);
    assert.equal(mesVencido("2026-10-01", dia(2)), true);
    assert.equal(mesVencido("2026-11-01", dia(15)), false);
    assert.equal(mesVencido(null, dia(5)), true);
    assert.equal(mesVencido("2025-12-01", new Date(2026, 0, 3)), true);
  });
});
