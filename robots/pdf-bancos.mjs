// Robot de los PDF: revisa el PDF oficial de tasas de cada banco y, si
// cambió, lo guarda en Directus con la tasa leída por aprobar.
//
// Para cada fuente activa de tipo PDF (colección `fuentes`), o de tipo página
// en los bancos que no publican PDF (regla con `pagina`). Cada fuente es un
// banco y un producto (libre inversión, libranza) con su regla; si dos
// productos salen del mismo PDF, el archivo se guarda una sola vez:
//   1. Busca el PDF con la regla del banco (reglas.mjs) y lo baja.
//   2. Si la huella SHA-256 es la misma de la última vez, no hace nada. Si
//      el PDF cambió pero las tasas leídas son las mismas de la publicada (o
//      de una por aprobar), tampoco: solo anota la huella nueva.
//   3. Si es nuevo, lo sube a `documentos` (origen robot; de una página, un
//      pantallazo de la tabla) y crea en
//      `tasas_publicadas` la tasa leída, en "por revisar". Nunca publica:
//      siempre la aprueba una persona en /admin/tasas.
//   4. Los bancos que bloquean la descarga (regla con `bloquea`) van en un
//      recordatorio aparte los lunes, con los enlaces para revisarlos a mano.
//      Los de PDF mensual con índice bloqueado (`mensual`) entran ahí todos
//      los días desde que lo guardado es de un mes anterior (desde el día 2)
//      hasta que se sube el del mes.
//   5. Manda un correo si no encontró el PDF, si la regla ya no lo lee, si lo
//      leído no tiene sentido o si hay una tasa nueva por aprobar.
//
// Uso:
//   DIRECTUS_TOKEN=<token del robot> node robots/pdf-bancos.mjs
//   node robots/pdf-bancos.mjs --sin-guardar     (revisa sin escribir nada)
//   node robots/pdf-bancos.mjs --probar bbva archivo.pdf   (solo la regla;
//                    también acepta la página guardada: archivo.html; para
//                    otro producto: --probar bbva:libranza archivo.pdf)
//   --hoy 2026-11-03   simula esa fecha (probar recordatorios, con
//                    --sin-guardar)
//   --recordatorio   manda hoy el recordatorio de los bancos que bloquean
//                    (normalmente sale los lunes)

import { readFile } from "node:fs/promises";
import { avisar } from "./comun/aviso.mjs";
import { directus, hayToken, subirArchivo } from "./comun/directus.mjs";
import { pantallazo, textoConNavegador } from "./comun/pantallazo.mjs";
import { bajarPdf, huella, pagina, textoHtml, textoPdf } from "./comun/pdf.mjs";
import {
  masReciente,
  mesVencido,
  mismasTasas,
  reglaDe,
  revisar,
} from "./reglas.mjs";

const USURA = JSON.parse(
  await readFile(
    new URL("../src/app/core/datos/usura.json", import.meta.url),
    "utf8",
  ),
);
const soloMirar = process.argv.includes("--sin-guardar");
// --hoy AAAA-MM-DD simula la fecha (para probar los recordatorios); solo
// cambia qué se avisa, no las fechas que se guardan.
const iHoy = process.argv.indexOf("--hoy");
const HOY =
  iHoy > 0 ? new Date(`${process.argv[iHoy + 1]}T12:00:00`) : new Date();
/** Día del recordatorio de los bancos que se revisan a mano (1 = lunes). */
const DIA_RECORDATORIO = 1;
// Los bancos que bloquean van los lunes; los PDF mensuales vencidos, a diario
// hasta que se sube el nuevo.
const recordar =
  process.argv.includes("--recordatorio") || HOY.getDay() === DIA_RECORDATORIO;

/** Lee el texto (del PDF o de la página) con la regla del banco. */
function leerTexto(regla, texto) {
  try {
    const tasa = regla.leer(texto);
    return { tasa, problemas: revisar(tasa, USURA) };
  } catch (error) {
    return { tasa: null, problemas: [error.message] };
  }
}

/** Direcciones donde puede estar el PDF, la más probable primero. */
async function direcciones(fuente, regla, notas) {
  const lista = regla.buscar?.(fuente, HOY) ?? [fuente.url];
  if (regla.enlace && fuente.url_indice) {
    try {
      const html = (await pagina(fuente.url_indice)).replaceAll("&amp;", "&");
      const encontrados = [...html.matchAll(regla.enlace)].map((m) => m[0]);
      const nuevo = regla.elegir
        ? regla.elegir(encontrados)
        : masReciente(
            encontrados.map((e) => new URL(e, fuente.url_indice).href),
          );
      if (nuevo) lista.unshift(nuevo);
      else notas.push(`No vi el enlace al PDF en ${fuente.url_indice}.`);
    } catch (error) {
      notas.push(`No pude abrir ${fuente.url_indice}: ${error.message}.`);
    }
  }
  return lista.filter((u, i) => u && lista.indexOf(u) === i);
}

/**
 * Lo que va en el recordatorio de un banco que se revisa a mano: dónde ver
 * su PDF y cuál es el último que está guardado. `sinTasa` si todavía no hay
 * ninguna tasa de ese producto (ni publicada ni por aprobar): ese va a
 * diario, no solo los lunes, para que no se pase.
 */
async function recordatorio(fuente, nombre) {
  const [[ultimo], [tasa]] = await Promise.all([
    directus(
      "GET",
      `/items/documentos?filter[fuente][_eq]=${fuente.id}&sort=-vigente_desde,-date_created&limit=1&fields=vigente_desde,date_created`,
    ),
    directus(
      "GET",
      `/items/tasas_publicadas?filter[fuente][_eq]=${fuente.id}&filter[estado][_in]=publicada,por_revisar&limit=1&fields=id`,
    ),
  ]);
  const texto = [
    `${nombre}${tasa ? "" : ": todavía no tiene ninguna tasa cargada"}`,
    `   ${fuente.tipo === "pagina" ? "Página de tasas" : "PDF de tasas"}: ${fuente.url}`,
    ...(fuente.url_indice ? [`   Página: ${fuente.url_indice}`] : []),
    `   Último guardado: ${ultimo ? `rige desde ${ultimo.vigente_desde ?? "—"} (subido el ${ultimo.date_created.slice(0, 10)})` : "ninguno"}`,
  ].join("\n");
  return { texto, sinTasa: !tasa };
}

/**
 * Banco con PDF mensual (regla `mensual`): si lo último guardado es de un
 * mes anterior, el texto para el recordatorio; si no, null.
 */
async function pdfDelMes(fuente, nombre) {
  const [ultimo] = await directus(
    "GET",
    `/items/tasas_publicadas?filter[fuente][_eq]=${fuente.id}&filter[estado][_in]=publicada,por_revisar` +
      "&sort=-vigente_desde&limit=1&fields=vigente_desde",
  );
  if (!mesVencido(ultimo?.vigente_desde, HOY)) return null;
  return [
    `${nombre}: publica un PDF nuevo cada mes y su página no deja entrar al robot. Lo último guardado rige desde ${ultimo?.vigente_desde ?? "—"}: baja el de este mes y súbelo.`,
    `   Página: ${fuente.url_indice ?? fuente.url}`,
  ].join("\n");
}

/**
 * Página de tasas vigentes de un banco que también publica PDF (regla con
 * `paginaVigente`): la tasa que muestra hoy, para compararla con el PDF.
 */
async function leerPaginaVigente(cfg) {
  try {
    const texto = cfg.navegador
      ? await textoConNavegador(cfg.url, cfg.pantallazo)
      : textoHtml(await pagina(cfg.url));
    const tasa = cfg.leer(texto);
    return { tasa, problemas: revisar(tasa, USURA) };
  } catch (error) {
    return { tasa: null, problemas: [error.message] };
  }
}

/** "27 oct 2026, 8:20 a. m." en hora de Colombia, para las notas. */
function cuando(fecha = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day} ${p.month.replace(".", "")} ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod.replace(/\s+/g, " ")}`;
}

/** "Bancolombia" o, si no es libre inversión, "Bancolombia (libranza)". */
const nombreDe = (fuente) =>
  `${fuente.entidad?.nombre ?? fuente.entidad?.codigo}${fuente.producto && fuente.producto !== "libre-inversion" ? ` (${fuente.producto})` : ""}`;

/** Revisa una fuente; devuelve qué pasó para el correo. */
async function revisarFuente(fuente) {
  const banco = fuente.entidad?.codigo;
  const nombre = nombreDe(fuente);
  const regla = reglaDe(banco, fuente.producto);
  if (!regla && fuente.tipo === "pagina") return {};
  if (!regla)
    return {
      problema: `${nombre}: no hay regla para leer su PDF (reglas.mjs).`,
    };
  // Las fuentes de tipo página solo se revisan en bancos sin PDF.
  if ((fuente.tipo === "pagina") !== Boolean(regla.pagina)) return {};
  // Banco que se revisa siempre a mano (Lulo): no se abre su página, solo
  // va en el recordatorio.
  if (regla.manual) {
    console.log(`${nombre}: se revisa a mano (no se abre su página).`);
    return { manual: await recordatorio(fuente, nombre) };
  }

  const ahora = new Date().toISOString();
  const sinCambios = async (url, marca) => {
    if (!soloMirar)
      await directus("PATCH", `/items/fuentes/${fuente.id}`, {
        url,
        ultimo_hash: marca,
        ultima_revision: ahora,
      });
    return {};
  };
  // Ya visto para esta fuente: el mismo PDF puede ser nuevo para libranza
  // aunque ya se guardó para libre inversión.
  const yaVisto = async (marca) =>
    marca === fuente.ultimo_hash ||
    (
      await directus(
        "GET",
        `/items/documentos?filter[huella][_eq]=${marca}&filter[fuente][_eq]=${fuente.id}&fields=id&limit=1`,
      )
    ).length > 0;

  let url, marca, tasa, problemas, prueba;
  // La tasa sale de una página (y no de un PDF): el enlace de la web dice
  // "Tasas en la página del banco".
  let enPagina = fuente.tipo === "pagina";
  if (fuente.tipo === "pagina") {
    // Banco sin PDF: se lee la página y la huella es la de la tasa leída (la
    // página completa cambia en cada visita).
    url = fuente.url;
    let texto;
    try {
      texto = regla.navegador
        ? await textoConNavegador(url, regla.pantallazo)
        : textoHtml(await pagina(url));
    } catch (error) {
      return {
        problema: `${nombre}: no pude abrir su página de tasas (${url} → ${error.message}).`,
      };
    }
    ({ tasa, problemas } = leerTexto(regla, texto));
    // Página que no le muestra las tasas al servidor (Lulo): al recordatorio
    // de los lunes en vez de un aviso diario de regla rota.
    if (!tasa && regla.bloquea) {
      console.log(`${nombre}: su página no le muestra las tasas al servidor.`);
      return { manual: await recordatorio(fuente, nombre) };
    }
    marca = huella(Buffer.from(JSON.stringify(tasa ?? texto)));
    if (await yaVisto(marca)) {
      console.log(`${nombre}: sin cambios.`);
      return sinCambios(url, marca);
    }
    prueba = async () => ({
      datos: await pantallazo(url, regla.pantallazo),
      tipo: "image/png",
      extension: "png",
      nota: `Pantallazo tomado por el robot de ${url}`,
    });
  } else {
    const notas = [];
    const fallos = [];
    let datos = null;
    for (const posible of await direcciones(fuente, regla, notas)) {
      try {
        datos = await bajarPdf(posible);
        url = posible;
        break;
      } catch (error) {
        fallos.push(`${posible} → ${error.message}`);
      }
    }
    // Si el banco también muestra la tasa en su página de tasas vigentes, se
    // prefiere el PDF, salvo que la página sea más nueva (el PDF del mes aún
    // no sale): entonces la página, con pantallazo.
    const vigente = regla.paginaVigente
      ? await leerPaginaVigente(regla.paginaVigente)
      : null;
    if (vigente && !vigente.tasa)
      console.log(
        `${nombre}: no leí su página de tasas vigentes`,
        vigente.problemas,
      );
    if (!datos && !vigente?.tasa) {
      if (regla.bloquea) {
        console.log(`${nombre}: bloquea la descarga desde el servidor.`);
        return { manual: await recordatorio(fuente, nombre) };
      }
      return {
        problema: `${nombre}: no encontré el PDF. ${[...notas, ...fallos].join(" · ")}`,
      };
    }
    const delPdf =
      datos && vigente ? leerTexto(regla, await textoPdf(datos)) : null;
    if (
      vigente?.tasa &&
      (!delPdf?.tasa ||
        (vigente.tasa.vigencia ?? "") > (delPdf.tasa.vigencia ?? ""))
    ) {
      url = regla.paginaVigente.url;
      enPagina = true;
      ({ tasa, problemas } = vigente);
      console.log(
        `${nombre}: su página (rige desde ${tasa.vigencia}) es más nueva que el PDF${delPdf?.tasa ? ` (${delPdf.tasa.vigencia})` : ""}: se usa la página.`,
      );
      marca = huella(Buffer.from(JSON.stringify(tasa)));
      if (await yaVisto(marca)) {
        console.log(`${nombre}: sin cambios.`);
        return sinCambios(fuente.url, marca);
      }
      prueba = async () => ({
        datos: await pantallazo(url, regla.paginaVigente.pantallazo, {
          clic: regla.paginaVigente.clic,
        }),
        tipo: "image/png",
        extension: "png",
        nota: `Pantallazo tomado por el robot de ${url} (el PDF del mes aún no estaba publicado)`,
      });
    } else {
      marca = huella(datos);
      if (await yaVisto(marca)) {
        console.log(`${nombre}: sin cambios.`);
        return sinCambios(url, marca);
      }
      ({ tasa, problemas } = delPdf ?? leerTexto(regla, await textoPdf(datos)));
      prueba = async () => ({
        datos,
        tipo: "application/pdf",
        extension: "pdf",
        nota: `Bajado por el robot de ${url}`,
      });
    }
  }

  const leida = tasa && !problemas.length;
  const sinMaxima = leida && tasa.eaHasta === null;
  const valores = leida && {
    valor_desde: tasa.mvDesde,
    valor_hasta: sinMaxima ? USURA.mv : tasa.mvHasta,
    ea_desde: tasa.eaDesde,
    ea_hasta: sinMaxima ? USURA.tasa : tasa.eaHasta,
  };

  // Si las tasas son las mismas de la publicada (o de una que ya espera
  // aprobación), no se crea nada: el banco solo volvió a subir el PDF.
  let conPdfOficial = false;
  if (leida) {
    const guardadas = await directus(
      "GET",
      `/items/tasas_publicadas?filter[fuente][_eq]=${fuente.id}&filter[estado][_in]=publicada,por_revisar` +
        "&fields=estado,valor_desde,valor_hasta,ea_desde,ea_hasta,enlace_es_pagina&limit=-1",
    );
    // Si la guardada salió de la página y ahora llega el PDF oficial con lo
    // mismo, sí se crea: así la prueba queda con el PDF.
    const igual = guardadas.find(
      (g) =>
        mismasTasas(valores, g) &&
        !(fuente.tipo !== "pagina" && !enPagina && g.enlace_es_pagina),
    );
    conPdfOficial =
      !igual && !enPagina && guardadas.some((g) => mismasTasas(valores, g));
    if (igual) {
      console.log(
        `${nombre}: el PDF cambió, pero las tasas son las mismas de la ${igual.estado === "publicada" ? "publicada" : "que espera aprobación"}; no se crea nada.`,
      );
      return sinCambios(url, marca);
    }
  }

  const queEs = enPagina ? "tasa nueva en su página" : "PDF nuevo";
  console.log(`${nombre}: ${queEs}`, tasa ?? "", problemas);
  if (soloMirar)
    return problemas.length
      ? { problema: `${nombre}: ${queEs}, pero ${problemas.join(" ")}` }
      : { nuevo: `${nombre}: ${queEs} (sin guardar, --sin-guardar).` };

  const copia = await prueba();
  // Si el mismo archivo ya está guardado para otro producto del banco (un
  // solo PDF con libre inversión y libranza), se usa ese y no se sube otra vez.
  const [mismo] = await directus(
    "GET",
    `/items/documentos?filter[huella][_eq]=${marca}&fields=archivo&limit=1`,
  );
  const archivo =
    mismo?.archivo ??
    (await subirArchivo(
      copia.datos,
      `${banco}-${(tasa?.vigencia ?? ahora).slice(0, 10)}.${copia.extension}`,
      copia.tipo,
      `${fuente.entidad?.nombre ?? banco} · tasas · ${tasa?.vigencia ?? "revisado " + ahora.slice(0, 10)}`,
    ));
  const documento = await directus("POST", "/items/documentos", {
    fuente: fuente.id,
    archivo,
    estado: "nuevo",
    vigente_desde: tasa?.vigencia ?? null,
    origen: "robot",
    huella: marca,
    notas: copia.nota,
  });

  // Tipo de tasa y sistema se copian de la publicada o, si no hay, de la
  // última anterior (el PDF no los cambia). Con -estado, "publicada" va
  // antes que "anterior".
  const [publicada] = await directus(
    "GET",
    `/items/tasas_publicadas?filter[fuente][_eq]=${fuente.id}&filter[estado][_in]=publicada,anterior` +
      `&sort=-estado,-id&fields=tipo_tasa,sistema_amortizacion&limit=1`,
  );
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
    enlace: url,
    enlace_es_pagina: enPagina,
    ...(leida
      ? {
          ...valores,
          hasta_origen: sinMaxima ? "usura" : "entidad",
          frase: tasa.frase,
          notas: `Leída por el robot el ${cuando()}${tasa.soloMaxima ? " El banco solo publica la tasa máxima (no hay desde)." : ""}${sinMaxima ? ` El banco no publica máxima: hasta = usura de ${USURA.mes}.` : ""}${conPdfOficial ? " Mismas tasas que la tomada de su página; ahora con el PDF oficial." : ""}`,
        }
      : {
          notas: `El robot no pudo leer la tasa (${cuando()}): ${problemas.join(" ")} Llénala mirando el PDF.`,
        }),
  });
  await directus("PATCH", `/items/fuentes/${fuente.id}`, {
    // Si la tasa salió de la página de tasas vigentes, la fuente conserva la
    // dirección del último PDF.
    url: enPagina && fuente.tipo !== "pagina" ? fuente.url : url,
    ultimo_hash: marca,
    ultima_revision: ahora,
  });

  return leida
    ? {
        nuevo: `${nombre}: ${queEs} (rige desde ${tasa.vigencia}). Leí ${tasa.soloMaxima ? `hasta ${tasa.mvHasta} % M.V. (solo publica la máxima)` : `${tasa.mvDesde} % a ${sinMaxima ? USURA.mv + " % (usura)" : tasa.mvHasta + " %"} M.V.`}; está por aprobar.`,
      }
    : {
        problema: `${nombre}: ${queEs} guardado, pero no pude leer la tasa: ${problemas.join(" ")} Quedó por aprobar sin valores.`,
      };
}

async function main() {
  // Probar solo la regla con un PDF del disco.
  const i = process.argv.indexOf("--probar");
  if (i > 0) {
    const [clave, archivo] = process.argv.slice(i + 1);
    const [banco, producto] = clave.split(":");
    const regla = reglaDe(banco, producto);
    if (!regla) throw new Error(`No hay regla para "${clave}".`);
    const contenido = await readFile(archivo);
    const resultado = leerTexto(
      regla,
      /\.html?$/i.test(archivo)
        ? textoHtml(contenido.toString("utf8"))
        : await textoPdf(contenido),
    );
    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.problemas.length ? 1 : 0);
  }

  if (!hayToken()) throw new Error("Falta DIRECTUS_TOKEN.");
  const fuentes = await directus(
    "GET",
    // Las de "solo_promedio" (el banco no publica su tasa) no se revisan.
    "/items/fuentes?filter[tipo][_in]=pdf,pagina&filter[estado][_eq]=activa&filter[como_extraer][_neq]=solo_promedio&limit=-1" +
      "&fields=id,tipo,producto,url,url_indice,ultimo_hash,entidad.codigo,entidad.nombre",
  );
  const nuevos = [];
  const problemas = [];
  const manuales = [];
  const vencidos = [];
  for (const fuente of fuentes) {
    try {
      const r = await revisarFuente(fuente);
      if (r.nuevo) nuevos.push(r.nuevo);
      if (r.problema) problemas.push(r.problema);
      // Sin ninguna tasa cargada: a diario; si ya tiene, solo los lunes.
      if (r.manual?.sinTasa) vencidos.push(r.manual.texto);
      else if (r.manual) manuales.push(r.manual.texto);
      if (reglaDe(fuente.entidad?.codigo, fuente.producto)?.mensual) {
        const vencido = await pdfDelMes(fuente, nombreDe(fuente));
        if (vencido) {
          console.log(vencido.split("\n")[0]);
          vencidos.push(vencido);
        }
      }
    } catch (error) {
      problemas.push(`${nombreDe(fuente)}: error inesperado: ${error.message}`);
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
  else console.log("Sin cambios.");

  // Recordatorio en un correo aparte: a diario los PDF mensuales vencidos
  // (hasta que se sube el nuevo) y los bancos a mano sin ninguna tasa; los
  // lunes, los demás bancos que bloquean.
  const recordatorio = [...vencidos, ...(recordar ? manuales : [])];
  if (recordatorio.length)
    await avisar(
      `Recordatorio: revisa a mano ${recordatorio.length === 1 ? "1 banco" : `${recordatorio.length} bancos`}`,
      recordatorio,
      "Estos bancos no dejan que el robot baje su PDF o encuentre el del mes. Ábrelo y, si la fecha o las tasas cambiaron, súbelo en Configuración de tasas (Cargar PDF nuevo).",
    );
}

main().catch(async (error) => {
  await avisar("El robot de los PDF falló", [error.message]);
  process.exit(1);
});
