// Resalta en verde las cifras de la tasa en los PDF ya guardados que no
// tienen copia resaltada (los anteriores a esta función o los subidos a
// mano, una vez escrita su tasa). El robot de los PDF ya lo hace con cada
// PDF nuevo.
//
// Uso:
//   DIRECTUS_TOKEN=<token del robot> node robots/resaltar.mjs
//   node robots/resaltar.mjs --sin-guardar   (dice qué resaltaría)

import {
  bajarArchivo,
  directus,
  hayToken,
  subirArchivo,
} from "./comun/directus.mjs";
import { resaltarPdf } from "./comun/resaltar.mjs";
import { reglaDe } from "./reglas.mjs";

const soloMirar = process.argv.includes("--sin-guardar");
if (!hayToken() && !soloMirar) console.log("Sin DIRECTUS_TOKEN.");

const documentos = await directus(
  "GET",
  "/items/documentos?filter[archivo_resaltado][_null]=true" +
    "&fields=id,vigente_desde,fuente.producto,fuente.entidad.codigo,fuente.entidad.nombre,archivo.id,archivo.type&limit=-1",
);
let hechos = 0;
for (const d of documentos) {
  if (d.archivo?.type !== "application/pdf" || !d.fuente) continue;
  const banco = d.fuente.entidad.codigo;
  const producto = d.fuente.producto;
  const [tasa] = await directus(
    "GET",
    `/items/tasas_publicadas?filter[documento][_eq]=${d.id}&filter[estado][_neq]=rechazada` +
      "&fields=valor_desde,valor_hasta,ea_desde,ea_hasta,hasta_origen&sort=-id&limit=1",
  );
  if (!tasa || (tasa.valor_desde === null && tasa.valor_hasta === null)) {
    console.log(`${banco} ${producto} (documento ${d.id}): sin tasa escrita.`);
    continue;
  }
  const propia = tasa.hasta_origen !== "usura";
  const resaltado = await resaltarPdf(await bajarArchivo(d.archivo.id), {
    cifras: [
      tasa.valor_desde,
      tasa.ea_desde,
      ...(propia ? [tasa.valor_hasta, tasa.ea_hasta] : []),
    ],
    vigencia: d.vigente_desde,
    producto,
    ancla: reglaDe(banco, producto)?.ancla,
  });
  if (!resaltado) {
    console.log(
      `${banco} ${producto} (documento ${d.id}): no encontré las cifras.`,
    );
    continue;
  }
  if (soloMirar) {
    console.log(`${banco} ${producto} (documento ${d.id}): lo resaltaría.`);
    continue;
  }
  const archivo = await subirArchivo(
    resaltado,
    `${banco}-${(d.vigente_desde ?? "sin-fecha").slice(0, 10)}-resaltado.pdf`,
    "application/pdf",
    `${d.fuente.entidad.nombre} · ${producto} · resaltado`,
  );
  await directus("PATCH", `/items/documentos/${d.id}`, {
    archivo_resaltado: archivo,
  });
  hechos++;
  console.log(`${banco} ${producto} (documento ${d.id}): resaltado.`);
}
console.log(`Listo: ${hechos} PDF resaltados.`);
