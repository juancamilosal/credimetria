import assert from "node:assert/strict";
import { test } from "node:test";
import {
  armarCifras,
  nombreEntidad,
  partirCodigoSfc,
  unir,
} from "../financieros.mjs";

const fila = (corte, cuenta, valor, codigo = "39") => ({
  tipo_entidad: "1",
  codigo_entidad: codigo,
  nombre_entidad: "BANCO DAVIVIENDA S.A.",
  fecha_corte: `${corte}T00:00:00.000`,
  cuenta,
  valor: String(valor),
});

// Cifras reales de Davivienda (CUIF, miles de millones × 1e9).
const MM = 1e9;
const FILAS = [
  fila("2024-12-31", "590000", 852.7 * MM),
  fila("2025-12-31", "590000", 1833.5 * MM),
  fila("2025-08-31", "590000", 1022.4 * MM),
  fila("2025-08-31", "140000", 103820 * MM),
  fila("2026-08-31", "590000", 1628.9 * MM),
  fila("2026-08-31", "300000", 15662.1 * MM),
  fila("2026-08-31", "100000", 159974.6 * MM),
  fila("2026-08-31", "140000", 116945.3 * MM),
  fila("2026-08-31", "999999", 1), // cuenta que no se usa
];

test("código SFC tipo-código", () => {
  assert.deepEqual(partirCodigoSfc("1-13"), { tipo: "1", codigo: "13" });
  assert.deepEqual(partirCodigoSfc(" 4-129 "), { tipo: "4", codigo: "129" });
  assert.equal(partirCodigoSfc("BBVA"), null);
  assert.equal(partirCodigoSfc(null), null);
});

test("arma lo que va del año frente al año anterior y la rentabilidad", () => {
  const d = armarCifras(FILAS, "2026-08-31T00:00:00.000").get("1-39");
  assert.equal(d.actual.corte, "2026-08-31");
  assert.equal(d.actual.meses, 8);
  assert.equal(d.actual.utilidad, 1628.9 * MM);
  assert.equal(d.actual.utilidadAnterior, 1022.4 * MM);
  assert.equal(Math.round(d.actual.variacionUtilidad * 100), 59);
  assert.equal(Math.round(d.actual.variacionCartera * 100), 13);
  // 1.628,9 × 12/8 / 15.662,1 = 15,6 %
  assert.equal(Math.round(d.actual.rentabilidad * 1000), 156);
  assert.deepEqual(d.anual, [
    { anio: 2024, utilidad: 852.7 * MM },
    { anio: 2025, utilidad: 1833.5 * MM },
  ]);
});

test("una pérdida el año anterior no voltea el signo de la variación", () => {
  const d = armarCifras(
    [fila("2025-08-31", "590000", -100), fila("2026-08-31", "590000", 50)],
    "2026-08-31T00:00:00.000",
  ).get("1-39");
  assert.equal(d.actual.variacionUtilidad, 1.5);
  assert.equal(d.actual.rentabilidad, null); // sin patrimonio
});

test("sin reporte del último mes, la entidad no sale", () => {
  const d = armarCifras(
    [fila("2025-12-31", "590000", 10)],
    "2026-08-31T00:00:00.000",
  );
  assert.equal(d.size, 0);
});

test("une entidades, cifras y solo los análisis publicados que llegan", () => {
  const cifras = armarCifras(FILAS, "2026-08-31T00:00:00.000");
  const datos = unir(
    [
      {
        codigo: "davivienda",
        nombre: "Davivienda",
        tipo: "Banco",
        logo: "x",
        codigo_sfc: "1-39",
      },
      {
        codigo: "sin-cuif",
        nombre: "Otra",
        tipo: "Banco",
        logo: null,
        codigo_sfc: "1-999",
      },
    ],
    [
      {
        entidad: "davivienda",
        periodo: "Junio 2026",
        pdf: "abc",
        titular: "Ganó más",
        puntos: [
          { tipo: "alerta", texto: "Ojo" },
          { tipo: "otro", texto: "Bien" },
          { texto: "" },
        ],
        para_ti: "Es sólido",
        date_updated: "2026-11-15T10:00:00",
      },
    ],
    { corte: "2026-08-31", cifras },
  );
  assert.equal(datos.corte, "2026-08-31");
  assert.equal(datos.entidades.length, 1);
  const e = datos.entidades[0];
  assert.equal(e.logo, "/api/logos/davivienda");
  assert.deepEqual(e.analisis, {
    periodo: "Junio 2026",
    titular: "Ganó más",
    puntos: [
      { tipo: "alerta", texto: "Ojo" },
      { tipo: "fortaleza", texto: "Bien" },
    ],
    paraTi: "Es sólido",
    pdf: "/api/estados-financieros/davivienda/pdf",
    actualizado: "2026-11-15",
  });
});

test("salen todos los bancos del CUIF, aunque no estén en Directus", () => {
  const filas = [
    ...FILAS,
    fila("2026-08-31", "590000", 3 * MM, "65"),
    {
      ...fila("2026-08-31", "590000", 1 * MM, "999"),
      nombre_entidad: "BANCO NUEVO DE LA COSTA S.A.",
    },
  ];
  const cifras = armarCifras(filas, "2026-08-31T00:00:00.000");
  const datos = unir(
    [
      {
        codigo: "davivienda",
        nombre: "Davivienda",
        tipo: "Banco",
        logo: null,
        codigo_sfc: "1-39",
      },
    ],
    [{ entidad: "sfc-1-65", titular: "No es de Directus: no se usa" }],
    { corte: "2026-08-31", cifras },
  );
  assert.deepEqual(
    datos.entidades.map((e) => [e.codigo, e.nombre, e.tipo]),
    [
      ["davivienda", "Davivienda", "Banco"],
      ["sfc-1-65", "Lulo Bank", "Banco"],
      ["sfc-1-999", "Banco Nuevo de la Costa", "Banco"],
    ],
  );
  assert.equal(datos.entidades[1].logo, null);
  assert.equal(datos.entidades[1].analisis, null);
});

test("nombres legibles", () => {
  assert.equal(nombreEntidad("1-52", "BANCAMIA S.A."), "Bancamía");
  assert.equal(
    nombreEntidad("4-1", "FINANCIERA DEL NORTE SA"),
    "Financiera del Norte",
  );
});
