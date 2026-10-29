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
//   node robots/promedio-sfc.mjs --producto libranza   (solo ese producto: así
//                    cada producto es una tarea de Coolify con sus 15 minutos;
//                    también varios con comas o un grupo: hipotecario =
//                    vivienda-vis,vivienda-no-vis; leasing = leasing-vis,
//                    leasing-no-vis)
//
// Manda un correo (comun/aviso.mjs) si falla, si un banco no reportó o si
// una tasa saltó más de 2 puntos.

import { avisar } from "./comun/aviso.mjs";
import { directus, hayToken } from "./comun/directus.mjs";

const SFC = "https://www.datos.gov.co/resource/qzsc-9esp.json";
const SEMANAS = 4;
/**
 * Producto de Credimetría → producto de crédito en el formato 88. La
 * libranza viene junta ("Libranza otros"): no se separa por tipo de cliente.
 * Vivienda: solo adquisición en pesos (sin UVR, construcción ni empleados);
 * la Superfinanciera separa hipotecario y leasing, VIS y No VIS.
 */
const PRODUCTOS = {
  "libre-inversion": "Libre inversión",
  libranza: "Libranza otros",
  // Vehículo: la Superfinanciera no separa nuevo, usado ni motos (el
  // "Leasing financiero - financiación vehículos" va aparte y no cuenta).
  vehiculo: "Vehículo",
  "vivienda-vis": "Adquisición de vivienda vis (colocación en pesos)",
  "vivienda-no-vis": "Adquisición de vivienda no vis (colocación en pesos)",
  "leasing-vis": "Adquisición leasing habitacional vis (colocación en pesos)",
  "leasing-no-vis":
    "Adquisición leasing habitacional no vis (colocación en pesos)",
};
/** Nombre de cada producto para el correo. */
const NOMBRES = {
  "libre-inversion": "Libre inversión",
  libranza: "Libranza",
  vehiculo: "Vehículo",
  "vivienda-vis": "Vivienda VIS",
  "vivienda-no-vis": "Vivienda No VIS",
  "leasing-vis": "Leasing habitacional VIS",
  "leasing-no-vis": "Leasing habitacional No VIS",
};
/**
 * Con menos créditos que esto en las 4 semanas, el promedio es poco
 * confiable: se anota en las notas (dato interno, no sale en la página).
 */
const POCOS_CREDITOS = 100;
/** Salto (en puntos) que se avisa en las notas para revisarlo. */
const SALTO = 2;

const soloMostrar = process.argv.includes("--sin-guardar");
const iProducto = process.argv.indexOf("--producto");
/** Grupos que se piden juntos en una sola tarea. */
const GRUPOS = {
  hipotecario: ["vivienda-vis", "vivienda-no-vis"],
  leasing: ["leasing-vis", "leasing-no-vis"],
};
/** Los de --producto (uno, varios separados por coma o un grupo). */
const elegidos =
  iProducto > 0
    ? process.argv[iProducto + 1]
        .split(",")
        .flatMap((p) => GRUPOS[p.trim()] ?? [p.trim()])
    : null;
for (const p of elegidos ?? [])
  if (!PRODUCTOS[p])
    throw new Error(
      `Producto "${p}" desconocido: usa ${[...Object.keys(PRODUCTOS), ...Object.keys(GRUPOS)].join(", ")}.`,
    );
/** Los productos de esta corrida: los de --producto o todos. */
const AHORA = Object.entries(PRODUCTOS).filter(
  ([producto]) => !elegidos || elegidos.includes(producto),
);
const TOKEN = hayToken();
/** Lo que necesita que alguien lo mire (va por correo al final). */
const revisar = [];
/** Producto → bancos cuyo promedio no se actualizó (para el asunto). */
const sinActualizar = new Map();
/**
 * Tiempo máximo para consultar datos.gov.co (la tarea de Coolify corta a los
 * 15 minutos): lo que alcance a traer se guarda; los bancos que falten se
 * dejan con su tasa anterior y van en el correo.
 */
const FIN = Date.now() + 11 * 60 * 1000;

/**
 * Una consulta a datos.gov.co, con `espera` de límite (sin pasar del tiempo
 * de la corrida). Los reintentos los hace `main`, al final de la ronda, para
 * que un banco lento no frene a los demás.
 */
async function sfc(params, espera) {
  const url = `${SFC}?${new URLSearchParams(params)}`;
  const queda = FIN - Date.now();
  if (queda < 5_000) throw new Error("se acabó el tiempo de la corrida");
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(Math.min(espera, queda)),
    });
    if (!r.ok) throw new Error(`respondió ${r.status}`);
    return { url, filas: await r.json() };
  } catch (error) {
    // "fetch failed" esconde la causa real (conexión, DNS, certificado).
    throw new Error(error.cause?.code ?? error.cause?.message ?? error.message);
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
          "/items/entidades?fields=codigo,nombre,codigo_sfc&filter[activa][_eq]=true&filter[codigo_sfc][_nnull]=true&limit=-1",
        );

  // Se piden las últimas 7 semanas y se usan las 4 más recientes con datos
  // (preguntar antes por las fechas de corte agrupando todo el conjunto es
  // muy lento en datos.gov.co y a veces no responde).
  const hace = new Date(Date.now() - 49 * 864e5).toISOString().slice(0, 10);

  // Una consulta por banco y producto (de 4 a 10 s cada una; sumar todos
  // los bancos juntos, o pedir los dos productos a la vez a los bancos
  // grandes, hacía que datos.gov.co cortara). Primero una ronda con 60 s por
  // consulta; las que fallan se reintentan al final, con más tiempo, mientras
  // quede tiempo de corrida. Las que no salen conservan su promedio anterior.
  const todas = [];
  const consultas = new Map(); // "producto:entidad" → enlace de su consulta
  let pendientes = entidades.flatMap((e) =>
    AHORA.map(([producto, nombreSfc]) => ({
      e,
      producto,
      nombreSfc,
    })),
  );
  const errores = new Map(); // "producto:entidad" → último error
  for (const [ronda, espera] of [
    [1, 60_000],
    [2, 100_000],
    [3, 120_000],
  ]) {
    if (!pendientes.length || FIN - Date.now() < 10_000) break;
    if (ronda > 1) {
      console.log(
        `Reintento ${ronda - 1} con ${pendientes.length} consultas que fallaron…`,
      );
      await new Promise((listo) => setTimeout(listo, 10_000));
    }
    const fallaron = [];
    for (const p of pendientes) {
      const { tipo, codigo } = partir(p.e.codigo_sfc);
      const clave = `${p.producto}:${p.e.codigo}`;
      try {
        const { url, filas } = await sfc(
          {
            $select:
              "nombre_entidad,fecha_corte," +
              "sum(tasa_efectiva_promedio*montos_desembolsados) as tm," +
              "sum(montos_desembolsados) as m,sum(numero_de_creditos) as n",
            $where:
              `producto_de_cr_dito='${p.nombreSfc}' AND tipo_entidad='${tipo}' ` +
              `AND codigo_entidad='${codigo}' AND fecha_corte >= '${hace}'`,
            $group: "nombre_entidad,fecha_corte",
            $order: "fecha_corte",
            $limit: "100",
          },
          espera,
        );
        consultas.set(clave, url);
        errores.delete(clave);
        for (const f of filas)
          todas.push({
            ...f,
            producto_de_cr_dito: p.nombreSfc,
            tipo_entidad: tipo,
            codigo_entidad: codigo,
          });
      } catch (error) {
        console.log(`${clave}: datos.gov.co no respondió (${error.message})`);
        errores.set(clave, error.message);
        fallaron.push(p);
      }
    }
    pendientes = fallaron;
  }
  if (!consultas.size)
    throw new Error(
      `datos.gov.co no respondió para ningún banco (${[...errores.values()][0] ?? "sin bancos"}).`,
    );
  // Por producto: cuáles bancos no se actualizaron y por qué.
  const nombreDe = (codigo) =>
    entidades.find((e) => e.codigo === codigo)?.nombre ?? codigo;
  for (const [producto] of AHORA) {
    const fallaron = [...errores].filter(([clave]) =>
      clave.startsWith(`${producto}:`),
    );
    if (!fallaron.length) continue;
    const bancos = fallaron.map(([clave]) => nombreDe(clave.split(":")[1]));
    sinActualizar.set(NOMBRES[producto], bancos);
    revisar.push(
      `${NOMBRES[producto]}: no se actualizó el promedio de ${bancos.length === 1 ? "1 banco" : `${bancos.length} bancos`} (${bancos.join(", ")}) porque datos.gov.co no respondió (${[...new Set(fallaron.map(([, e]) => e))].join("; ")}). Conservan su promedio anterior.`,
    );
  }

  for (const [producto, nombreSfc] of AHORA) {
    const recientes = todas.filter((f) => f.producto_de_cr_dito === nombreSfc);
    const cortes = [...new Set(recientes.map((f) => f.fecha_corte))]
      .sort()
      .reverse()
      .slice(0, SEMANAS);
    if (!cortes.length) {
      revisar.push(
        `${NOMBRES[producto]}: datos.gov.co no trajo datos desde ${hace}; no se actualizó ningún promedio de este producto.`,
      );
      sinActualizar.set(NOMBRES[producto], ["todos"]);
      continue;
    }
    const corte = cortes[0].slice(0, 10);
    const filas = recientes.filter((f) => cortes.includes(f.fecha_corte));

    // Respaldo: lo que respondió la Superfinanciera, con el enlace.
    const csv = [
      `# Fuente: Superintendencia Financiera de Colombia, formato 88, datos.gov.co qzsc-9esp`,
      ...[...consultas]
        .filter(([clave]) => clave.startsWith(`${producto}:`))
        .map(([clave, url]) => `# Consulta ${clave.split(":")[1]}:,${url}`),
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
      if (errores.has(`${producto}:${e.codigo}`)) continue;
      const { tipo, codigo } = partir(e.codigo_sfc);
      const suyas = filas.filter(
        (f) => f.tipo_entidad === tipo && f.codigo_entidad === codigo,
      );
      const m = suyas.reduce((s, f) => s + Number(f.m), 0);
      const creditos = Math.round(
        suyas.reduce((s, f) => s + Number(f.n ?? 0), 0),
      );
      const tasa = m
        ? +(suyas.reduce((s, f) => s + Number(f.tm), 0) / m).toFixed(2)
        : null;
      console.log(
        `${e.codigo.padEnd(16)} ${producto}  ${tasa ?? "sin reporte"}${tasa ? " % E.A." : ""}  (${suyas.length} semanas, ${creditos} créditos)`,
      );
      if (soloMostrar) continue;

      const [actual] = await directus(
        "GET",
        `/items/tasas_promedio?filter[entidad][_eq]=${e.codigo}&filter[producto][_eq]=${producto}&fields=id,tasa_ea&limit=1`,
      );
      // Banco que no tiene este producto (p. ej. libranza en Lulo): si nunca
      // tuvo promedio, no se crea fila ni se avisa.
      if (tasa === null && !actual) continue;
      const antes = actual?.tasa_ea == null ? null : Number(actual.tasa_ea);
      const salto =
        tasa !== null && antes !== null && Math.abs(tasa - antes) > SALTO;
      if (tasa === null)
        revisar.push(
          `${NOMBRES[producto]} · ${e.nombre ?? e.codigo}: sin reporte en las ${SEMANAS} semanas al ${corte}; se dejó la tasa anterior.`,
        );
      if (salto)
        revisar.push(
          `${NOMBRES[producto]} · ${e.nombre ?? e.codigo}: el promedio cambió de ${antes} % a ${tasa} % (más de ${SALTO} puntos).`,
        );
      // Primera vez que reporta este producto (p. ej. Banco de Bogotá en
      // leasing VIS): sale en el ranking con su promedio y falta la tasa que
      // anuncia.
      if (tasa !== null && !actual)
        revisar.push(
          `${NOMBRES[producto]} · ${e.nombre ?? e.codigo}: empezó a reportar créditos (${creditos} en ${SEMANAS} semanas, promedio ${tasa} %). Ya sale en el ranking; revisa si publica su tasa para este producto y agrégale la fuente.`,
        );
      const fila = {
        entidad: e.codigo,
        producto,
        corte,
        respaldo,
        consulta_url: consultas.get(`${producto}:${e.codigo}`),
        actualizada: new Date().toISOString(),
        // Interno: cuántos créditos hay detrás del promedio.
        creditos,
        ...(tasa === null
          ? {
              estado: "sin_reporte",
              notas: `Sin desembolsos reportados en las ${SEMANAS} semanas al ${corte}; se conserva la tasa anterior.`,
            }
          : {
              tasa_ea: tasa,
              estado: "al_dia",
              notas:
                `Promedio ponderado por monto de ${suyas.length} semanas al ${corte} (${creditos} créditos).` +
                (creditos < POCOS_CREDITOS
                  ? ` Pocos créditos: el promedio es poco confiable.`
                  : "") +
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

/** "Libre inversión y Libranza", con los productos de esta corrida. */
const productosDeLaCorrida = () =>
  AHORA.map(([producto]) => NOMBRES[producto]).join(" y ");

main()
  .then(() => {
    if (!revisar.length) return;
    // El asunto dice qué productos quedaron sin actualizar.
    const asunto = sinActualizar.size
      ? `Promedios sin actualizar: ${[...sinActualizar]
          .map(([nombre, bancos]) =>
            bancos[0] === "todos"
              ? `${nombre} (todos)`
              : `${nombre} (${bancos.length === 1 ? "1 banco" : `${bancos.length} bancos`})`,
          )
          .join(", ")}`
      : `El promedio de ${productosDeLaCorrida()} necesita revisión`;
    return avisar(asunto, revisar);
  })
  .catch(async (error) => {
    await avisar(`El robot del promedio de ${productosDeLaCorrida()} falló`, [
      `No se actualizó ningún promedio de ${productosDeLaCorrida()}: ${error.message}`,
    ]);
    process.exit(1);
  });
