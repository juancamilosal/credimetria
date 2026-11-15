// Estados financieros de las entidades (página /estados-financieros).
//
// Las cifras salen solas del CUIF de la Superfinanciera (datos.gov.co,
// conjunto mxk5-ce6w: las cuentas de cada entidad vigilada, mes a mes, desde
// 2016). En Directus solo va lo que nadie más tiene: el PDF del estado
// financiero más reciente y el análisis escrito (colección
// `estados_financieros`, una ficha por entidad; ver
// servidor/scripts/crear-estados-financieros.mjs).
//
// El navegador nunca ve Directus ni el token: pide /api/financieros y
// /api/estados-financieros/<entidad>/pdf a la página.

import { cargarEnv } from "./env.mjs";

if (!process.env.DIRECTUS_TOKEN) cargarEnv();

const DIRECTUS = process.env.DIRECTUS_URL ?? "https://api.credimetria.com";
const CUIF = "https://www.datos.gov.co/resource/mxk5-ce6w.json";

/** Cuentas del CUIF que se usan (moneda 0 = total). */
export const CUENTAS = {
  590000: "utilidad",
  300000: "patrimonio",
  100000: "activos",
  140000: "cartera",
};
/** Años completos (cierres de diciembre) que se muestran en la gráfica. */
export const ANIOS = 6;
/** El CUIF sale una vez al mes: se vuelve a pedir cada 12 horas. */
const VIGENCIA_CUIF_MS = 12 * 60 * 60 * 1000;
/** Los análisis y los PDF de Directus, cada 10 minutos. */
const VIGENCIA_DIRECTUS_MS = 10 * 60 * 1000;

async function pedirDirectus(ruta) {
  const token = process.env.DIRECTUS_TOKEN;
  if (!token) throw new Error("Falta DIRECTUS_TOKEN");
  const r = await fetch(DIRECTUS + ruta, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) {
    const detalle = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Directus ${r.status} en ${ruta.split("?")[0]}${detalle ? `: ${detalle}` : ""}`,
    );
  }
  return r;
}

async function pedirCuif(parametros) {
  const url = `${CUIF}?${new URLSearchParams(parametros)}`;
  // datos.gov.co a veces tarda: se le da 60 s y, si no, se sigue con lo
  // último que se tenía.
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`CUIF ${r.status}`);
  return r.json();
}

/** "1-13" → { tipo: "1", codigo: "13" }; `null` si no tiene esa forma. */
export function partirCodigoSfc(codigoSfc) {
  const m = /^\s*(\d+)-(\d+)\s*$/.exec(codigoSfc ?? "");
  return m ? { tipo: m[1], codigo: m[2] } : null;
}

/** "2026-08-31T00:00:00.000" → { anio: 2026, mes: 8, corte: "2026-08-31" }. */
function fecha(texto) {
  const corte = texto.slice(0, 10);
  return {
    anio: Number(corte.slice(0, 4)),
    mes: Number(corte.slice(5, 7)),
    corte,
  };
}

/** El último día del mes, como lo pone el CUIF. */
function finDeMes(anio, mes) {
  const dia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Arma las cifras de cada entidad con las filas del CUIF.
 *
 * - `anual`: utilidad de cada año completo (cierre de diciembre).
 * - `actual`: lo que va del año al último corte, frente al mismo corte del
 *   año anterior (el CUIF acumula la utilidad desde enero).
 * - `rentabilidad`: utilidad del año llevada a 12 meses sobre el patrimonio.
 */
export function armarCifras(filas, ultimoCorte) {
  const ultimo = fecha(ultimoCorte);
  const anterior = finDeMes(ultimo.anio - 1, ultimo.mes);
  const porEntidad = new Map();
  for (const f of filas) {
    const clave = `${f.tipo_entidad}-${f.codigo_entidad}`;
    const campo = CUENTAS[f.cuenta];
    if (!campo) continue;
    const e =
      porEntidad.get(clave) ??
      porEntidad
        .set(clave, { nombreSfc: f.nombre_entidad, cortes: new Map() })
        .get(clave);
    const corte = f.fecha_corte.slice(0, 10);
    const valores = e.cortes.get(corte) ?? e.cortes.set(corte, {}).get(corte);
    valores[campo] = Number(f.valor);
  }

  const resultado = new Map();
  for (const [clave, e] of porEntidad) {
    const hoy = e.cortes.get(ultimo.corte);
    if (!hoy || hoy.utilidad === undefined) continue; // no reportó el último mes
    const antes = e.cortes.get(anterior) ?? {};
    const anual = [];
    for (let anio = ultimo.anio - ANIOS; anio < ultimo.anio; anio++) {
      const dic = e.cortes.get(`${anio}-12-31`);
      if (dic?.utilidad !== undefined)
        anual.push({ anio, utilidad: dic.utilidad });
    }
    const variacion = (nuevo, viejo) =>
      nuevo !== undefined && viejo !== undefined && viejo !== 0
        ? (nuevo - viejo) / Math.abs(viejo)
        : null;
    resultado.set(clave, {
      nombreSfc: e.nombreSfc,
      anual,
      actual: {
        corte: ultimo.corte,
        meses: ultimo.mes,
        utilidad: hoy.utilidad,
        utilidadAnterior: antes.utilidad ?? null,
        variacionUtilidad: variacion(hoy.utilidad, antes.utilidad),
        patrimonio: hoy.patrimonio ?? null,
        activos: hoy.activos ?? null,
        cartera: hoy.cartera ?? null,
        carteraAnterior: antes.cartera ?? null,
        variacionCartera: variacion(hoy.cartera, antes.cartera),
        rentabilidad:
          hoy.patrimonio > 0
            ? (hoy.utilidad * (12 / ultimo.mes)) / hoy.patrimonio
            : null,
      },
    });
  }
  return resultado;
}

/** Lee del CUIF las cifras de las entidades pedidas ("tipo-código"). */
export async function leerCuif(codigosSfc) {
  const partes = codigosSfc.map(partirCodigoSfc).filter(Boolean);
  if (!partes.length) return { corte: null, cifras: new Map() };
  const tipos = [...new Set(partes.map((p) => p.tipo))];
  const codigos = [...new Set(partes.map((p) => p.codigo))];
  const lista = (xs) => xs.map((x) => `'${x}'`).join(",");

  // El último mes publicado (Bancolombia, 1-7, reporta siempre).
  const [{ ultimo } = {}] = await pedirCuif({
    $select: "max(fecha_corte) as ultimo",
    $where: "tipo_entidad='1' AND codigo_entidad='7' AND cuenta='590000'",
  });
  if (!ultimo) throw new Error("El CUIF no devolvió el último corte");
  const u = fecha(ultimo);
  const desde = `${u.anio - ANIOS}-12-31`;

  const filas = await pedirCuif({
    $select:
      "tipo_entidad,codigo_entidad,nombre_entidad,fecha_corte,cuenta,valor",
    $where:
      `moneda='0' AND cuenta in(${lista(Object.keys(CUENTAS))})` +
      ` AND tipo_entidad in(${lista(tipos)}) AND codigo_entidad in(${lista(codigos)})` +
      ` AND fecha_corte>='${desde}T00:00:00'` +
      ` AND (date_extract_m(fecha_corte)=12 OR fecha_corte='${u.corte}T00:00:00'` +
      ` OR fecha_corte='${finDeMes(u.anio - 1, u.mes)}T00:00:00')`,
    $limit: "20000",
  });
  // Se piden juntos tipos y códigos: se quedan solo los pares pedidos.
  const pedidos = new Set(partes.map((p) => `${p.tipo}-${p.codigo}`));
  const propias = filas.filter((f) =>
    pedidos.has(`${f.tipo_entidad}-${f.codigo_entidad}`),
  );
  return { corte: u.corte, cifras: armarCifras(propias, ultimo) };
}

/** Las entidades activas con código SFC y los análisis publicados. */
async function leerDirectus() {
  const entidades = await (
    await pedirDirectus(
      "/items/entidades?filter[activa][_eq]=true&filter[codigo_sfc][_nnull]=true" +
        "&limit=-1&fields=codigo,nombre,tipo,logo,codigo_sfc&sort=nombre",
    )
  ).json();
  // La colección puede no existir todavía: la página sale igual, sin análisis.
  let fichas = [];
  try {
    fichas = (
      await (
        await pedirDirectus(
          "/items/estados_financieros?filter[estado][_eq]=publicado&limit=-1" +
            "&fields=entidad,periodo,pdf,titular,puntos,para_ti,date_updated",
        )
      ).json()
    ).data;
  } catch (error) {
    console.warn("Estados financieros sin análisis:", error.message);
  }
  return { entidades: entidades.data, fichas };
}

/** Une las entidades de Directus, sus cifras del CUIF y su análisis. */
export function unir(entidades, fichas, cuif) {
  const porEntidad = new Map(fichas.map((f) => [f.entidad, f]));
  const lista = [];
  for (const e of entidades) {
    const cifras = cuif.cifras.get(e.codigo_sfc?.trim());
    if (!cifras) continue; // sin reporte en el CUIF (no vigilada o sin datos)
    const ficha = porEntidad.get(e.codigo);
    lista.push({
      codigo: e.codigo,
      nombre: e.nombre,
      tipo: e.tipo ?? null,
      logo: e.logo ? `/api/logos/${e.codigo}` : null,
      anual: cifras.anual,
      actual: cifras.actual,
      analisis: ficha
        ? {
            periodo: ficha.periodo ?? null,
            titular: ficha.titular ?? null,
            puntos: Array.isArray(ficha.puntos)
              ? ficha.puntos
                  .filter((p) => p?.texto)
                  .map((p) => ({
                    tipo: p.tipo === "alerta" ? "alerta" : "fortaleza",
                    texto: p.texto,
                  }))
              : [],
            paraTi: ficha.para_ti ?? null,
            pdf: ficha.pdf ? `/api/estados-financieros/${e.codigo}/pdf` : null,
            actualizado: ficha.date_updated?.slice(0, 10) ?? null,
          }
        : null,
    });
  }
  lista.sort((a, b) => b.actual.utilidad - a.actual.utilidad);
  return {
    fuente: "Superintendencia Financiera de Colombia (CUIF)",
    consulta: "https://www.datos.gov.co/d/mxk5-ce6w",
    corte: cuif.corte,
    entidades: lista,
  };
}

let directus = null; // { datos, en }
let cuif = null; // { datos, en, codigos }
let pidiendo = null;

async function leer() {
  if (!directus || Date.now() - directus.en > VIGENCIA_DIRECTUS_MS) {
    directus = { datos: await leerDirectus(), en: Date.now() };
  }
  const codigos = directus.datos.entidades
    .map((e) => e.codigo_sfc?.trim())
    .filter(Boolean)
    .sort()
    .join(",");
  if (
    !cuif ||
    cuif.codigos !== codigos ||
    Date.now() - cuif.en > VIGENCIA_CUIF_MS
  ) {
    try {
      cuif = {
        datos: await leerCuif(codigos.split(",")),
        en: Date.now(),
        codigos,
      };
    } catch (error) {
      if (!cuif) throw error;
      console.warn("CUIF sin renovar:", error.message);
    }
  }
  return unir(directus.datos.entidades, directus.datos.fichas, cuif.datos);
}

let guardado = null; // { datos, en }

/**
 * Las cifras y los análisis. Como las tasas: si ya hay algo guardado, lo
 * devuelve al instante y lo renueva por detrás.
 */
export async function financieros() {
  if (guardado && Date.now() - guardado.en < VIGENCIA_DIRECTUS_MS)
    return guardado.datos;
  const renovar = (pidiendo ??= leer()
    .then((datos) => {
      guardado = { datos, en: Date.now() };
      return datos;
    })
    .catch((error) => {
      if (guardado) return guardado.datos;
      throw error;
    })
    .finally(() => (pidiendo = null)));
  if (guardado) {
    renovar.catch(() => {});
    return guardado.datos;
  }
  return renovar;
}

/** El PDF del estado financiero publicado de una entidad; `null` si no hay. */
export async function pdfEstadoFinanciero(codigo) {
  await financieros();
  const ficha = directus?.datos.fichas.find((f) => f.entidad === codigo);
  if (!ficha?.pdf) return null;
  const r = await pedirDirectus(`/assets/${ficha.pdf}`);
  return {
    datos: Buffer.from(await r.arrayBuffer()),
    tipo: r.headers.get("content-type") ?? "application/pdf",
  };
}

/** Rutas /api/financieros y /api/estados-financieros/<entidad>/pdf. */
export function rutasFinancieros(app) {
  app.get("/api/financieros", async (_req, res) => {
    try {
      res.set("Cache-Control", "public, max-age=300");
      res.json(await financieros());
    } catch (error) {
      console.error(
        "No se pudieron leer los estados financieros:",
        error.message,
      );
      res
        .status(503)
        .json({ error: "Los estados financieros no están disponibles" });
    }
  });
  app.get("/api/estados-financieros/:codigo/pdf", async (req, res) => {
    try {
      if (!/^[a-z0-9-]{1,80}$/i.test(req.params.codigo))
        return res.status(404).end();
      const pdf = await pdfEstadoFinanciero(req.params.codigo);
      if (!pdf) return res.status(404).end();
      res.set("Content-Type", pdf.tipo);
      res.set("Content-Disposition", "inline");
      res.set("Cache-Control", "public, max-age=3600");
      res.end(pdf.datos);
    } catch (error) {
      console.error("No se pudo leer el estado financiero:", error.message);
      res.status(503).end();
    }
  });
}
