// Carga en Directus (colección `estados_financieros`) los análisis de
// servidor/scripts/datos/analisis-2026.json, uno por entidad, en BORRADOR:
// nada sale en la página hasta que alguien lo revise y lo pase a Publicado.
//
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/cargar-analisis.mjs --sin-guardar
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/cargar-analisis.mjs
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/cargar-analisis.mjs --pdfs C:\ruta\estados
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/cargar-analisis.mjs --actualizar
//
// - Busca cada entidad por su `codigo_sfc`: si no está, avisa (corre antes
//   servidor/scripts/sincronizar-fichas.mjs, que crea las que faltan).
// - Si la entidad ya tiene ficha, no la toca; con --actualizar la reemplaza
//   solo si sigue en borrador (lo publicado no se pisa nunca).
// - Con --pdfs <carpeta>, sube el PDF <código>.pdf de esa carpeta (p. ej.
//   1-39.pdf) a la carpeta "Estados financieros" y lo enlaza.
//
// En Windows (PowerShell):
//   $env:DIRECTUS_ADMIN_TOKEN="…"; node servidor/scripts/cargar-analisis.mjs --sin-guardar
// (Detrás de un proxy, con NODE_USE_ENV_PROXY=1.)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const D = process.env.DIRECTUS_URL ?? "https://api.credimetria.com";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const SIN_GUARDAR = process.argv.includes("--sin-guardar");
const ACTUALIZAR = process.argv.includes("--actualizar");
const iPdfs = process.argv.indexOf("--pdfs");
const PDFS = iPdfs > -1 ? process.argv[iPdfs + 1] : null;
if (!TOKEN) throw new Error("Falta DIRECTUS_ADMIN_TOKEN");

const { analisis } = JSON.parse(
  readFileSync(new URL("./datos/analisis-2026.json", import.meta.url), "utf8"),
);

async function api(metodo, ruta, cuerpo) {
  if (SIN_GUARDAR && metodo !== "GET") return null;
  const r = await fetch(D + ruta, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(cuerpo && !(cuerpo instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      cuerpo instanceof FormData
        ? cuerpo
        : cuerpo
          ? JSON.stringify(cuerpo)
          : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${texto}`);
  return texto ? JSON.parse(texto).data : null;
}

const entidades = await api(
  "GET",
  "/items/entidades?limit=-1&fields=codigo,nombre,codigo_sfc&filter[codigo_sfc][_nnull]=true",
);
const porSfc = new Map(entidades.map((e) => [e.codigo_sfc.trim(), e]));
const fichas = await api(
  "GET",
  "/items/estados_financieros?limit=-1&fields=id,entidad,estado,periodo",
);
const porEntidad = new Map(fichas.map((f) => [f.entidad, f]));

let carpeta = null;
async function subirPdf(codigoSfc, nombre) {
  if (!PDFS) return null;
  const ruta = join(PDFS, `${codigoSfc}.pdf`);
  if (!existsSync(ruta)) {
    console.log(`  (sin PDF: no está ${ruta})`);
    return null;
  }
  if (SIN_GUARDAR) {
    console.log(`  subiría ${ruta}`);
    return null;
  }
  if (carpeta === null) {
    const ya = await api(
      "GET",
      `/folders?filter=${encodeURIComponent(JSON.stringify({ name: { _eq: "Estados financieros" } }))}`,
    );
    carpeta = ya[0]?.id ?? "";
  }
  const datos = new FormData();
  if (carpeta) datos.append("folder", carpeta);
  datos.append("title", `Estado financiero ${nombre}`);
  datos.append(
    "file",
    new Blob([readFileSync(ruta)], { type: "application/pdf" }),
    `${codigoSfc}.pdf`,
  );
  return (await api("POST", "/files", datos)).id;
}

const resumen = { creadas: 0, actualizadas: 0, omitidas: 0, faltan: [] };
for (const [codigoSfc, a] of Object.entries(analisis)) {
  const e = porSfc.get(codigoSfc);
  if (!e) {
    resumen.faltan.push(`${a.banco} (${codigoSfc})`);
    continue;
  }
  const ya = porEntidad.get(e.codigo);
  const datos = {
    periodo: a.periodo,
    titular: a.titular,
    puntos: a.puntos,
    para_ti: a.para_ti,
  };
  if (ya) {
    if (!ACTUALIZAR || ya.estado === "publicado") {
      console.log(
        `= ${e.nombre}: ya tiene ficha (${ya.estado}, ${ya.periodo ?? "sin periodo"}); no se toca`,
      );
      resumen.omitidas++;
      continue;
    }
    const pdf = await subirPdf(codigoSfc, e.nombre);
    await api("PATCH", `/items/estados_financieros/${ya.id}`, {
      ...datos,
      ...(pdf ? { pdf } : {}),
    });
    console.log(
      `~ ${e.nombre}: ${SIN_GUARDAR ? "actualizaría" : "borrador actualizado"} (${a.periodo})`,
    );
    resumen.actualizadas++;
    continue;
  }
  const pdf = await subirPdf(codigoSfc, e.nombre);
  await api("POST", "/items/estados_financieros", {
    entidad: e.codigo,
    estado: "borrador",
    ...datos,
    ...(pdf ? { pdf } : {}),
  });
  console.log(
    `+ ${e.nombre}: ${SIN_GUARDAR ? "crearía el borrador" : "borrador creado"} (${a.periodo})`,
  );
  resumen.creadas++;
}
console.log(
  `\n${SIN_GUARDAR ? "(sin guardar) " : ""}Creadas: ${resumen.creadas}, actualizadas: ${resumen.actualizadas}, sin tocar: ${resumen.omitidas}`,
);
if (resumen.faltan.length)
  console.log(
    `No están en Directus (corre sincronizar-fichas.mjs): ${resumen.faltan.join(", ")}`,
  );
