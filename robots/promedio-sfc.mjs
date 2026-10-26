// Robot del promedio: lo que cobra cada entidad en promedio según la
// Superfinanciera (formato 88, datos.gov.co conjunto qzsc-9esp).
//
// Para cada entidad activa con `codigo_sfc` y cada producto, calcula el
// promedio ponderado por monto de las últimas 4 semanas, sube a Directus una
// copia (CSV) con el enlace de la consulta y actualiza su fila en
// `tasas_promedio` (una por entidad y producto, sin historial).
//
// Uso:
//   DIRECTUS_URL=https://credimetria-api.valkiriacode.com \
//   DIRECTUS_TOKEN=<token del usuario robot> node robots/promedio-sfc.mjs
//   node robots/promedio-sfc.mjs --sin-guardar   (solo muestra los promedios)
//
// Manda un correo (comun/aviso.mjs) si falla, si un banco no reportó o si
// una tasa saltó más de 2 puntos.

import { avisar } from "./comun/aviso.mjs";
import { directus, hayToken } from "./comun/directus.mjs";

const SFC = "https://www.datos.gov.co/resource/qzsc-9esp.json";
const SEMANAS = 4;
/** Producto de Credimetría → producto de crédito en el formato 88. */
const PRODUCTOS = { "libre-inversion": "Libre inversión" };
/** Salto (en puntos) que se avisa en las notas para revisarlo. */
const SALTO = 2;

const soloMostrar = process.argv.includes("--sin-guardar");
const TOKEN = hayToken();
/** Lo que necesita que alguien lo mire (va por correo al final). */
const revisar = [];

/** Consulta a datos.gov.co, con 2 minutos de límite y un reintento. */
async function sfc(params) {
  const url = `${SFC}?${new URLSearchParams(params)}`;
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new Error(`datos.gov.co → ${r.status}`);
      return { url, filas: await r.json() };
    } catch (error) {
      if (intento >= 2)
        throw new Error(`datos.gov.co no respondió: ${error.message}`);
      console.log(`datos.gov.co no respondió (${error.message}); reintento…`);
    }
  }
}

/** "1-13" → { tipo: '1', codigo: '13' } */
const partir = (codigoSfc) => {
  const [tipo, codigo] = codigoSfc.split("-");
  return { tipo, codigo };
};

async function main() {
  if (!soloMostrar && !TOKEN)
    throw new Error("Falta DIRECTUS_TOKEN (o usa --sin-guardar).");
  const entidades =
    soloMostrar && !TOKEN
      ? [
          { codigo: "banco-de-bogota", codigo_sfc: "1-1" },
          { codigo: "bancolombia", codigo_sfc: "1-7" },
          { codigo: "bbva", codigo_sfc: "1-13" },
          { codigo: "davivienda", codigo_sfc: "1-39" },
          { codigo: "av-villas", codigo_sfc: "1-49" },
        ]
      : await directus(
          "GET",
          "/items/entidades?fields=codigo,codigo_sfc&filter[activa][_eq]=true&filter[codigo_sfc][_nnull]=true&limit=-1",
        );

  // Se piden las últimas 7 semanas y se usan las 4 más recientes con datos
  // (preguntar antes por las fechas de corte agrupando todo el conjunto es
  // muy lento en datos.gov.co y a veces no responde).
  const hace = new Date(Date.now() - 49 * 864e5).toISOString().slice(0, 10);

  for (const [producto, nombreSfc] of Object.entries(PRODUCTOS)) {
    const lista = entidades
      .map((e) => `'${partir(e.codigo_sfc).codigo}'`)
      .join(",");
    const { url, filas: recientes } = await sfc({
      $select:
        "tipo_entidad,codigo_entidad,nombre_entidad,fecha_corte," +
        "sum(tasa_efectiva_promedio*montos_desembolsados) as tm," +
        "sum(montos_desembolsados) as m,sum(numero_de_creditos) as n",
      $where:
        `producto_de_cr_dito='${nombreSfc}' AND codigo_entidad in (${lista}) ` +
        `AND fecha_corte >= '${hace}'`,
      $group: "tipo_entidad,codigo_entidad,nombre_entidad,fecha_corte",
      $order: "codigo_entidad,fecha_corte",
      $limit: "1000",
    });
    const cortes = [...new Set(recientes.map((f) => f.fecha_corte))]
      .sort()
      .reverse()
      .slice(0, SEMANAS);
    if (!cortes.length)
      throw new Error(
        `datos.gov.co no trajo datos de ${nombreSfc} desde ${hace}.`,
      );
    const corte = cortes[0].slice(0, 10);
    const filas = recientes.filter((f) => cortes.includes(f.fecha_corte));

    // Respaldo: lo que respondió la Superfinanciera, con el enlace.
    const csv = [
      `# Fuente: Superintendencia Financiera de Colombia, formato 88, datos.gov.co qzsc-9esp`,
      `# Consulta:,${url}`,
      `# Promedio ponderado por monto = suma(tasa * monto) / suma(monto). Producto: ${nombreSfc}. Consultado el ${new Date().toISOString().slice(0, 10)}.`,
      "tipo_entidad,codigo_entidad,nombre_entidad,fecha_corte,tasa_ea_ponderada,monto_desembolsado,numero_creditos",
      ...filas.map((f) =>
        [
          f.tipo_entidad,
          f.codigo_entidad,
          `"${f.nombre_entidad}"`,
          f.fecha_corte.slice(0, 10),
          (Number(f.tm) / Number(f.m)).toFixed(4),
          Math.round(Number(f.m)),
          Math.round(Number(f.n)),
        ].join(","),
      ),
    ].join("\n");

    let respaldo = null;
    if (!soloMostrar) {
      const datos = new FormData();
      datos.append(
        "title",
        `Superfinanciera · ${nombreSfc} · promedio ${SEMANAS} semanas · corte ${corte}`,
      );
      datos.append(
        "file",
        new Blob([csv], { type: "text/csv" }),
        `sfc-${producto}-${corte}.csv`,
      );
      respaldo = (await directus("POST", "/files", datos)).id;
    }

    for (const e of entidades) {
      const { tipo, codigo } = partir(e.codigo_sfc);
      const suyas = filas.filter(
        (f) => f.tipo_entidad === tipo && f.codigo_entidad === codigo,
      );
      const m = suyas.reduce((s, f) => s + Number(f.m), 0);
      const tasa = m
        ? +(suyas.reduce((s, f) => s + Number(f.tm), 0) / m).toFixed(2)
        : null;
      console.log(
        `${e.codigo.padEnd(16)} ${producto}  ${tasa ?? "sin reporte"}${tasa ? " % E.A." : ""}  (${suyas.length} semanas)`,
      );
      if (soloMostrar) continue;

      const [actual] = await directus(
        "GET",
        `/items/tasas_promedio?filter[entidad][_eq]=${e.codigo}&filter[producto][_eq]=${producto}&fields=id,tasa_ea&limit=1`,
      );
      const antes = actual?.tasa_ea == null ? null : Number(actual.tasa_ea);
      const salto =
        tasa !== null && antes !== null && Math.abs(tasa - antes) > SALTO;
      if (tasa === null)
        revisar.push(
          `${e.codigo}: sin reporte en las ${SEMANAS} semanas al ${corte}; se dejó la tasa anterior.`,
        );
      if (salto)
        revisar.push(
          `${e.codigo}: el promedio cambió de ${antes} % a ${tasa} % (más de ${SALTO} puntos).`,
        );
      const fila = {
        entidad: e.codigo,
        producto,
        corte,
        respaldo,
        consulta_url: url,
        actualizada: new Date().toISOString(),
        ...(tasa === null
          ? {
              estado: "sin_reporte",
              notas: `Sin desembolsos reportados en las ${SEMANAS} semanas al ${corte}; se conserva la tasa anterior.`,
            }
          : {
              tasa_ea: tasa,
              estado: "al_dia",
              notas:
                `Promedio ponderado por monto de ${suyas.length} semanas al ${corte}.` +
                (salto
                  ? ` REVISAR: cambió de ${antes} % a ${tasa} % (más de ${SALTO} puntos).`
                  : ""),
            }),
      };
      if (actual)
        await directus("PATCH", `/items/tasas_promedio/${actual.id}`, fila);
      else await directus("POST", "/items/tasas_promedio", fila);
    }
  }
}

main()
  .then(() =>
    revisar.length
      ? avisar("El promedio de la Superfinanciera necesita revisión", revisar)
      : undefined,
  )
  .catch(async (error) => {
    await avisar("El robot del promedio falló", [error.message]);
    process.exit(1);
  });
