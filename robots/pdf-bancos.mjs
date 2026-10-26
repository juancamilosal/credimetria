// Robot de los PDF: revisa el PDF oficial de tasas de cada banco y, si
// cambió, lo guarda en Directus con la tasa leída por aprobar.
//
// Para cada fuente activa de tipo PDF (colección `fuentes`):
//   1. Busca el PDF con la regla del banco (reglas.mjs) y lo baja.
//   2. Si la huella SHA-256 es la misma de la última vez, no hace nada.
//   3. Si es nuevo, lo sube a `documentos` (origen robot) y crea en
//      `tasas_publicadas` la tasa leída, en "por revisar". Nunca publica:
//      siempre la aprueba una persona en /admin/tasas.
//   4. Manda un correo si no encontró el PDF, si la regla ya no lo lee, si lo
//      leído no tiene sentido o si hay una tasa nueva por aprobar.
//
// Uso:
//   DIRECTUS_TOKEN=<token del robot> node robots/pdf-bancos.mjs
//   node robots/pdf-bancos.mjs --sin-guardar     (revisa sin escribir nada)
//   node robots/pdf-bancos.mjs --probar bbva archivo.pdf   (solo la regla)

import { readFile } from "node:fs/promises";
import { avisar } from "./comun/aviso.mjs";
import { directus, hayToken, subirArchivo } from "./comun/directus.mjs";
import { bajarPdf, huella, pagina, textoPdf } from "./comun/pdf.mjs";
import { masReciente, REGLAS, revisar } from "./reglas.mjs";

const USURA = JSON.parse(
  await readFile(
    new URL("../src/app/core/datos/usura.json", import.meta.url),
    "utf8",
  ),
);
const soloMirar = process.argv.includes("--sin-guardar");

/** Lee un PDF con la regla del banco y dice qué encontró. */
async function leerPdf(banco, datos) {
  const regla = REGLAS[banco];
  if (!regla)
    return { tasa: null, problemas: [`No hay regla para "${banco}".`] };
  try {
    const tasa = regla.leer(await textoPdf(datos));
    return { tasa, problemas: revisar(tasa, USURA) };
  } catch (error) {
    return { tasa: null, problemas: [error.message] };
  }
}

/** Direcciones donde puede estar el PDF, la más probable primero. */
async function direcciones(fuente, regla, notas) {
  const lista = regla.buscar?.(fuente, new Date()) ?? [fuente.url];
  if (regla.enlace && fuente.url_indice) {
    try {
      const html = (await pagina(fuente.url_indice)).replaceAll("&amp;", "&");
      const enlaces = [...html.matchAll(regla.enlace)].map(
        (m) => new URL(m[0], fuente.url_indice).href,
      );
      const nuevo = masReciente(enlaces);
      if (nuevo) lista.unshift(nuevo);
      else notas.push(`No vi el enlace al PDF en ${fuente.url_indice}.`);
    } catch (error) {
      notas.push(`No pude abrir ${fuente.url_indice}: ${error.message}.`);
    }
  }
  return lista.filter((u, i) => u && lista.indexOf(u) === i);
}

/** Revisa una fuente; devuelve qué pasó para el correo. */
async function revisarFuente(fuente) {
  const banco = fuente.entidad?.codigo;
  const nombre = fuente.entidad?.nombre ?? banco;
  const regla = REGLAS[banco];
  if (!regla)
    return {
      problema: `${nombre}: no hay regla para leer su PDF (reglas.mjs).`,
    };

  const notas = [];
  let url = null;
  let datos = null;
  const fallos = [];
  for (const posible of await direcciones(fuente, regla, notas)) {
    try {
      datos = await bajarPdf(posible);
      url = posible;
      break;
    } catch (error) {
      fallos.push(`${posible} → ${error.message}`);
    }
  }
  if (!datos) {
    if (regla.bloquea) {
      console.log(`${nombre}: bloquea la descarga desde el servidor.`);
      // Recordatorio semanal (lunes) en vez de un correo diario.
      return new Date().getDay() === 1
        ? {
            problema: `${nombre}: no deja bajar su PDF desde el servidor. Revísalo a mano (${fuente.url}) y, si cambió, súbelo en /admin/tasas.`,
          }
        : {};
    }
    return {
      problema: `${nombre}: no encontré el PDF. ${[...notas, ...fallos].join(" · ")}`,
    };
  }

  const ahora = new Date().toISOString();
  const marca = huella(datos);
  const yaVisto =
    marca === fuente.ultimo_hash ||
    (
      await directus(
        "GET",
        `/items/documentos?filter[huella][_eq]=${marca}&fields=id&limit=1`,
      )
    ).length > 0;
  if (yaVisto) {
    console.log(`${nombre}: sin cambios.`);
    if (!soloMirar)
      await directus("PATCH", `/items/fuentes/${fuente.id}`, {
        url,
        ultimo_hash: marca,
        ultima_revision: ahora,
      });
    return {};
  }

  const { tasa, problemas } = await leerPdf(banco, datos);
  console.log(`${nombre}: PDF nuevo`, tasa ?? "", problemas);
  if (soloMirar)
    return problemas.length
      ? { problema: `${nombre}: PDF nuevo, pero ${problemas.join(" ")}` }
      : { nuevo: `${nombre}: PDF nuevo (sin guardar, --sin-guardar).` };

  const archivo = await subirArchivo(
    datos,
    `${banco}-${(tasa?.vigencia ?? ahora).slice(0, 10)}.pdf`,
    "application/pdf",
    `${nombre} · tasas · ${tasa?.vigencia ?? "revisado " + ahora.slice(0, 10)}`,
  );
  const documento = await directus("POST", "/items/documentos", {
    fuente: fuente.id,
    archivo,
    estado: "nuevo",
    vigente_desde: tasa?.vigencia ?? null,
    origen: "robot",
    huella: marca,
    notas: `Bajado por el robot de ${url}`,
  });

  // Tipo de tasa y sistema se copian de la publicada (el PDF no los cambia).
  const [publicada] = await directus(
    "GET",
    `/items/tasas_publicadas?filter[fuente][_eq]=${fuente.id}&filter[estado][_eq]=publicada&fields=tipo_tasa,sistema_amortizacion&limit=1`,
  );
  const leida = tasa && !problemas.length;
  const sinMaxima = leida && tasa.eaHasta === null;
  await directus("POST", "/items/tasas_publicadas", {
    fuente: fuente.id,
    entidad: banco,
    producto: fuente.producto,
    documento: documento.id,
    estado: "por_revisar",
    unidad: "MV",
    capturada: ahora,
    vigente_desde: tasa?.vigencia ?? null,
    tipo_tasa: publicada?.tipo_tasa ?? null,
    sistema_amortizacion: publicada?.sistema_amortizacion ?? null,
    ...(leida
      ? {
          valor_desde: tasa.mvDesde,
          valor_hasta: sinMaxima ? USURA.mv : tasa.mvHasta,
          ea_desde: tasa.eaDesde,
          ea_hasta: sinMaxima ? USURA.tasa : tasa.eaHasta,
          hasta_origen: sinMaxima ? "usura" : "entidad",
          frase: tasa.frase,
          notas: `Leída por el robot.${sinMaxima ? ` El banco no publica máxima: hasta = usura de ${USURA.mes}.` : ""}`,
        }
      : {
          notas: `El robot no pudo leer la tasa: ${problemas.join(" ")} Llénala mirando el PDF.`,
        }),
  });
  await directus("PATCH", `/items/fuentes/${fuente.id}`, {
    url,
    ultimo_hash: marca,
    ultima_revision: ahora,
  });

  return leida
    ? {
        nuevo: `${nombre}: PDF nuevo (rige desde ${tasa.vigencia}). Leí ${tasa.mvDesde} % a ${sinMaxima ? USURA.mv + " % (usura)" : tasa.mvHasta + " %"} M.V.; está por aprobar.`,
      }
    : {
        problema: `${nombre}: PDF nuevo guardado, pero no pude leer la tasa: ${problemas.join(" ")} Quedó por aprobar sin valores.`,
      };
}

async function main() {
  // Probar solo la regla con un PDF del disco.
  const i = process.argv.indexOf("--probar");
  if (i > 0) {
    const [banco, archivo] = process.argv.slice(i + 1);
    const resultado = await leerPdf(banco, await readFile(archivo));
    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.problemas.length ? 1 : 0);
  }

  if (!hayToken()) throw new Error("Falta DIRECTUS_TOKEN.");
  const fuentes = await directus(
    "GET",
    "/items/fuentes?filter[tipo][_eq]=pdf&filter[estado][_eq]=activa&limit=-1" +
      "&fields=id,producto,url,url_indice,ultimo_hash,entidad.codigo,entidad.nombre",
  );
  const nuevos = [];
  const problemas = [];
  for (const fuente of fuentes) {
    try {
      const r = await revisarFuente(fuente);
      if (r.nuevo) nuevos.push(r.nuevo);
      if (r.problema) problemas.push(r.problema);
    } catch (error) {
      problemas.push(
        `${fuente.entidad?.nombre ?? fuente.id}: error inesperado: ${error.message}`,
      );
    }
  }
  if (problemas.length)
    await avisar(
      `${problemas.length === 1 ? "Un banco necesita" : `${problemas.length} bancos necesitan`} revisión`,
      [...problemas, ...nuevos],
    );
  else if (nuevos.length)
    await avisar(
      `${nuevos.length === 1 ? "Hay una tasa nueva" : `Hay ${nuevos.length} tasas nuevas`} por aprobar`,
      nuevos,
    );
  else console.log(`Sin cambios en ${fuentes.length} PDF.`);
}

main().catch(async (error) => {
  await avisar("El robot de los PDF falló", [error.message]);
  process.exit(1);
});
