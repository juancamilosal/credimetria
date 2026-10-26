// Robot de los PDF: revisa el PDF oficial de tasas de cada banco y, si
// cambió, lo guarda en Directus con la tasa leída por aprobar.
//
// Para cada fuente activa de tipo PDF (colección `fuentes`), o de tipo página
// en los bancos que no publican PDF (regla con `pagina`):
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
//      Los de PDF mensual con índice bloqueado (`mensual`) entran ahí cuando
//      lo guardado es de un mes anterior (también el día 2 de cada mes).
//   5. Manda un correo si no encontró el PDF, si la regla ya no lo lee, si lo
//      leído no tiene sentido o si hay una tasa nueva por aprobar.
//
// Uso:
//   DIRECTUS_TOKEN=<token del robot> node robots/pdf-bancos.mjs
//   node robots/pdf-bancos.mjs --sin-guardar     (revisa sin escribir nada)
//   node robots/pdf-bancos.mjs --probar bbva archivo.pdf   (solo la regla;
//                    también acepta la página guardada: archivo.html)
//   --recordatorio   manda hoy el recordatorio de los bancos que se revisan
//                    a mano (normalmente sale los lunes)

import { readFile } from "node:fs/promises";
import { avisar } from "./comun/aviso.mjs";
import { directus, hayToken, subirArchivo } from "./comun/directus.mjs";
import { pantallazo } from "./comun/pantallazo.mjs";
import { bajarPdf, huella, pagina, textoHtml, textoPdf } from "./comun/pdf.mjs";
import {
  masReciente,
  mesVencido,
  mismasTasas,
  REGLAS,
  revisar,
} from "./reglas.mjs";

const USURA = JSON.parse(
  await readFile(
    new URL("../src/app/core/datos/usura.json", import.meta.url),
    "utf8",
  ),
);
const soloMirar = process.argv.includes("--sin-guardar");
/** Día del recordatorio de los bancos que se revisan a mano (1 = lunes). */
const DIA_RECORDATORIO = 1;
// Los lunes, y el día 2 de cada mes (cuando cambian los PDF mensuales).
const recordar =
  process.argv.includes("--recordatorio") ||
  new Date().getDay() === DIA_RECORDATORIO ||
  new Date().getDate() === 2;

/** Lee el texto (del PDF o de la página) con la regla del banco. */
function leerTexto(banco, texto) {
  const regla = REGLAS[banco];
  if (!regla && fuente.tipo === "pagina") return {};
  if (!regla)
    return { tasa: null, problemas: [`No hay regla para "${banco}".`] };
  try {
    const tasa = regla.leer(texto);
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

/**
 * Lo que va en el recordatorio de un banco que se revisa a mano: dónde ver
 * su PDF y cuál es el último que está guardado.
 */
async function recordatorio(fuente, nombre) {
  const [ultimo] = await directus(
    "GET",
    `/items/documentos?filter[fuente][_eq]=${fuente.id}&sort=-vigente_desde,-date_created&limit=1&fields=vigente_desde,date_created`,
  );
  return [
    `${nombre}`,
    `   PDF de tasas: ${fuente.url}`,
    ...(fuente.url_indice ? [`   Página: ${fuente.url_indice}`] : []),
    `   Último guardado: ${ultimo ? `rige desde ${ultimo.vigente_desde ?? "—"} (subido el ${ultimo.date_created.slice(0, 10)})` : "ninguno"}`,
  ].join("\n");
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
  if (!mesVencido(ultimo?.vigente_desde, new Date())) return null;
  return [
    `${nombre}: publica un PDF nuevo cada mes y su página no deja entrar al robot. Lo último guardado rige desde ${ultimo?.vigente_desde ?? "—"}: baja el de este mes y súbelo.`,
    `   Página: ${fuente.url_indice ?? fuente.url}`,
  ].join("\n");
}

/** Revisa una fuente; devuelve qué pasó para el correo. */
async function revisarFuente(fuente) {
  const banco = fuente.entidad?.codigo;
  const nombre = fuente.entidad?.nombre ?? banco;
  const regla = REGLAS[banco];
  if (!regla && fuente.tipo === "pagina") return {};
  if (!regla)
    return {
      problema: `${nombre}: no hay regla para leer su PDF (reglas.mjs).`,
    };
  // Las fuentes de tipo página solo se revisan en bancos sin PDF.
  if ((fuente.tipo === "pagina") !== Boolean(regla.pagina)) return {};

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
  const yaVisto = async (marca) =>
    marca === fuente.ultimo_hash ||
    (
      await directus(
        "GET",
        `/items/documentos?filter[huella][_eq]=${marca}&fields=id&limit=1`,
      )
    ).length > 0;

  let url, marca, tasa, problemas, prueba;
  if (fuente.tipo === "pagina") {
    // Banco sin PDF: se lee la página y la huella es la de la tasa leída (la
    // página completa cambia en cada visita).
    url = fuente.url;
    let texto;
    try {
      texto = textoHtml(await pagina(url));
    } catch (error) {
      return {
        problema: `${nombre}: no pude abrir su página de tasas (${url} → ${error.message}).`,
      };
    }
    ({ tasa, problemas } = leerTexto(banco, texto));
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
    if (!datos) {
      if (regla.bloquea) {
        console.log(`${nombre}: bloquea la descarga desde el servidor.`);
        return { manual: await recordatorio(fuente, nombre) };
      }
      return {
        problema: `${nombre}: no encontré el PDF. ${[...notas, ...fallos].join(" · ")}`,
      };
    }
    marca = huella(datos);
    if (await yaVisto(marca)) {
      console.log(`${nombre}: sin cambios.`);
      return sinCambios(url, marca);
    }
    ({ tasa, problemas } = leerTexto(banco, await textoPdf(datos)));
    prueba = async () => ({
      datos,
      tipo: "application/pdf",
      extension: "pdf",
      nota: `Bajado por el robot de ${url}`,
    });
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
  if (leida) {
    const guardadas = await directus(
      "GET",
      `/items/tasas_publicadas?filter[fuente][_eq]=${fuente.id}&filter[estado][_in]=publicada,por_revisar` +
        "&fields=estado,valor_desde,valor_hasta,ea_desde,ea_hasta&limit=-1",
    );
    const igual = guardadas.find((g) => mismasTasas(valores, g));
    if (igual) {
      console.log(
        `${nombre}: el PDF cambió, pero las tasas son las mismas de la ${igual.estado === "publicada" ? "publicada" : "que espera aprobación"}; no se crea nada.`,
      );
      return sinCambios(url, marca);
    }
  }

  const queEs =
    fuente.tipo === "pagina" ? "tasa nueva en su página" : "PDF nuevo";
  console.log(`${nombre}: ${queEs}`, tasa ?? "", problemas);
  if (soloMirar)
    return problemas.length
      ? { problema: `${nombre}: ${queEs}, pero ${problemas.join(" ")}` }
      : { nuevo: `${nombre}: ${queEs} (sin guardar, --sin-guardar).` };

  const copia = await prueba();
  const archivo = await subirArchivo(
    copia.datos,
    `${banco}-${(tasa?.vigencia ?? ahora).slice(0, 10)}.${copia.extension}`,
    copia.tipo,
    `${nombre} · tasas · ${tasa?.vigencia ?? "revisado " + ahora.slice(0, 10)}`,
  );
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
    ...(leida
      ? {
          ...valores,
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
        nuevo: `${nombre}: ${queEs} (rige desde ${tasa.vigencia}). Leí ${tasa.mvDesde} % a ${sinMaxima ? USURA.mv + " % (usura)" : tasa.mvHasta + " %"} M.V.; está por aprobar.`,
      }
    : {
        problema: `${nombre}: ${queEs} guardado, pero no pude leer la tasa: ${problemas.join(" ")} Quedó por aprobar sin valores.`,
      };
}

async function main() {
  // Probar solo la regla con un PDF del disco.
  const i = process.argv.indexOf("--probar");
  if (i > 0) {
    const [banco, archivo] = process.argv.slice(i + 1);
    const contenido = await readFile(archivo);
    const resultado = leerTexto(
      banco,
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
    "/items/fuentes?filter[tipo][_in]=pdf,pagina&filter[estado][_eq]=activa&limit=-1" +
      "&fields=id,tipo,producto,url,url_indice,ultimo_hash,entidad.codigo,entidad.nombre",
  );
  const nuevos = [];
  const problemas = [];
  const manuales = [];
  for (const fuente of fuentes) {
    try {
      const r = await revisarFuente(fuente);
      if (r.nuevo) nuevos.push(r.nuevo);
      if (r.problema) problemas.push(r.problema);
      if (r.manual) manuales.push(r.manual);
      if (REGLAS[fuente.entidad?.codigo]?.mensual) {
        const vencido = await pdfDelMes(fuente, fuente.entidad.nombre);
        if (vencido) {
          console.log(vencido.split("\n")[0]);
          manuales.push(vencido);
        }
      }
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
  else console.log("Sin cambios.");

  // Recordatorio semanal, en un correo aparte, de los bancos que no dejan
  // bajar su PDF desde el servidor.
  if (manuales.length && recordar)
    await avisar(
      `Recordatorio: revisa a mano ${manuales.length === 1 ? "1 banco" : `${manuales.length} bancos`}`,
      manuales,
      "Estos bancos no dejan que el robot baje su PDF o encuentre el del mes. Ábrelo y, si la fecha o las tasas cambiaron, súbelo en Configuración de tasas (Cargar PDF nuevo).",
    );
}

main().catch(async (error) => {
  await avisar("El robot de los PDF falló", [error.message]);
  process.exit(1);
});
