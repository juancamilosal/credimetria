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

/** Tipo de entidad del CUIF → tipo en Credimetría. */
export const TIPOS_SFC = {
  1: "Banco",
  4: "Financiera",
  32: "Cooperativa",
  22: "Fondo",
};

/**
 * Lo que sale en la página: todos los bancos (1), compañías de financiamiento
 * (4) y cooperativas financieras (32) que reportan, más las entidades
 * oficiales que le prestan a la gente (ICETEX, Fondo Nacional del Ahorro y
 * Caja Promotora de Vivienda Militar y de Policía) y las demás de Directus
 * con código SFC.
 */
export const TIPOS_INCLUIDOS = ["1", "4", "32"];
export const OFICIALES_INCLUIDAS = ["22-5", "22-8", "22-11"];

/**
 * Nombre corto de los bancos que no están en Directus (el CUIF los trae en
 * mayúsculas, sin tildes y con "S.A.").
 */
export const NOMBRES_SFC = {
  "1-1": "Banco de Bogotá",
  "1-2": "Banco Popular",
  "1-6": "Itaú",
  "1-7": "Bancolombia",
  "1-9": "Citibank",
  "1-12": "GNB Sudameris",
  "1-13": "BBVA",
  "1-23": "Banco de Occidente",
  "1-30": "Banco Caja Social",
  "1-39": "Davivienda",
  "1-42": "Davibank",
  "1-43": "Banco Agrario",
  "1-49": "Banco AV Villas",
  "1-51": "Ban100",
  "1-52": "Bancamía",
  "1-53": "Banco W",
  "1-54": "Bancoomeva",
  "1-55": "Banco Finandina",
  "1-56": "Banco Falabella",
  "1-57": "Banco Pichincha",
  "1-58": "Banco Coopcentral",
  "1-59": "Banco Santander",
  "1-60": "Banco Mundo Mujer",
  "1-62": "Mibanco",
  "1-63": "Banco Serfinanza",
  "1-64": "J.P. Morgan",
  "1-65": "Lulo Bank",
  "1-66": "BTG Pactual",
  "1-67": "Banco Unión",
  "1-68": "Banco Contactar",
  "4-26": "Tuya",
  "4-31": "GM Financial",
  "4-46": "Coltefinanciera",
  "4-108": "Iris",
  "4-117": "Credifamilia",
  "4-118": "Crezcamos",
  "4-120": "La Hipotecaria",
  "4-121": "Financiera Juriscoop",
  "4-122": "RCI Colombia",
  "4-123": "Bancar Tecnología",
  "4-124": "RappiPay",
  "4-126": "Mercado Pago",
  "4-127": "Bold",
  "4-128": "Nu Colombia",
  "4-129": "Koa",
  "4-130": "Nequi",
  "4-131": "Addi",
  "4-132": "Plata",
  "32-1": "Cooperativa Financiera de Antioquia",
  "32-2": "Coopkennedy",
  "32-4": "Cotrafa",
  "32-5": "Confiar",
  "22-5": "ICETEX",
  "22-8": "Fondo Nacional del Ahorro",
  "22-11": "Caja Promotora de Vivienda Militar y de Policía",
};

/**
 * Logos guardados en el repositorio (public/logos-entidades) para los bancos
 * que no están en Directus. Si el banco se crea en Directus con logo, manda
 * el de Directus.
 */
export const LOGOS_SFC = {
  "1-6": "/logos-entidades/itau.webp",
  "1-9": "/logos-entidades/citibank.webp",
  "1-52": "/logos-entidades/bancamia.webp",
  "1-53": "/logos-entidades/banco-w.webp",
  "1-58": "/logos-entidades/coopcentral.webp",
  "1-59": "/logos-entidades/santander.webp",
  "1-60": "/logos-entidades/mundo-mujer.webp",
  "1-62": "/logos-entidades/mibanco.webp",
  "1-64": "/logos-entidades/jp-morgan.webp",
  "1-66": "/logos-entidades/btg-pactual.webp",
  "1-68": "/logos-entidades/banco-contactar.webp",
  "4-26": "/logos-entidades/tuya.webp",
  "4-31": "/logos-entidades/gm-financial.webp",
  "4-46": "/logos-entidades/coltefinanciera.webp",
  "4-117": "/logos-entidades/credifamilia.webp",
  "4-118": "/logos-entidades/crezcamos.webp",
  "4-122": "/logos-entidades/rci-colombia.webp",
  "4-124": "/logos-entidades/rappipay.webp",
  "4-126": "/logos-entidades/mercado-pago.webp",
  "4-127": "/logos-entidades/bold.webp",
  "4-130": "/logos-entidades/nequi.webp",
  "4-131": "/logos-entidades/addi.webp",
  "4-132": "/logos-entidades/plata.webp",
};

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

/** El nombre a mostrar: el de la lista o el del CUIF, más legible. */
export function nombreEntidad(clave, nombreSfc) {
  if (NOMBRES_SFC[clave]) return NOMBRES_SFC[clave];
  return (nombreSfc ?? clave)
    .replace(/\s+S\.?\s?A\.?(\s|$)/gi, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) =>
      i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");
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
        anual.push({
          anio,
          utilidad: dic.utilidad,
          patrimonio: dic.patrimonio ?? null,
          cartera: dic.cartera ?? null,
        });
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
  // Bancos, financieras y cooperativas (TIPOS_INCLUIDOS), las oficiales que
  // prestan a personas y las demás entidades de Directus con código SFC.
  const partes = [...codigosSfc, ...OFICIALES_INCLUIDAS]
    .map(partirCodigoSfc)
    .filter(Boolean);
  const tipos = [
    ...new Set([...TIPOS_INCLUIDOS, ...partes.map((p) => p.tipo)]),
  ];
  const codigos = [...new Set(["0", ...partes.map((p) => p.codigo)])];
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
      ` AND (tipo_entidad in(${lista(TIPOS_INCLUIDOS)}) OR (tipo_entidad in(${lista(tipos)}) AND codigo_entidad in(${lista(codigos)})))` +
      ` AND fecha_corte>='${desde}T00:00:00'` +
      ` AND (date_extract_m(fecha_corte)=12 OR fecha_corte='${u.corte}T00:00:00'` +
      ` OR fecha_corte='${finDeMes(u.anio - 1, u.mes)}T00:00:00')`,
    $limit: "20000",
  });
  // Se piden juntos tipos y códigos: se quedan los tipos incluidos y los
  // pares pedidos.
  const pedidos = new Set(partes.map((p) => `${p.tipo}-${p.codigo}`));
  const propias = filas.filter(
    (f) =>
      TIPOS_INCLUIDOS.includes(f.tipo_entidad) ||
      pedidos.has(`${f.tipo_entidad}-${f.codigo_entidad}`),
  );
  // La ficha técnica no es indispensable: si falla, la página sale sin ella.
  const fichas = await leerVigiladas(tipos).catch((error) => {
    console.warn("Sin ficha técnica de la Superfinanciera:", error.message);
    return new Map();
  });
  return { corte: u.corte, cifras: armarCifras(propias, ultimo), fichas };
}

const VIGILADAS = "https://www.datos.gov.co/resource/sr9n-792w.json";

const titulo = (texto) =>
  texto
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) =>
      // Siglas con punto (D.C.) en mayúsculas.
      /\w\.\w/.test(p)
        ? p.toUpperCase()
        : i > 0 && MINUSCULAS.has(p)
          ? p
          : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");

const pendiente = (v) => !v || /^pendiente/i.test(v.trim());

/** "8600029644" → "860.002.964-4" (el último dígito es el de verificación). */
export function formatoNit(nit) {
  const n = String(nit ?? "").replace(/\D/g, "");
  if (n.length < 2) return null;
  const base = n.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${base}-${n.slice(-1)}`;
}

/**
 * La ficha técnica de una entidad con su fila de "Entidades vigiladas por la
 * Superfinanciera" (datos.gov.co sr9n-792w), limpia: la razón social sin las
 * frases legales ("podrá utilizar…"), el cargo sin las notas de radicado y
 * sin "Pendiente".
 */
export function fichaTecnica(fila) {
  if (!fila) return null;
  const razon = (fila.razon_social ?? "")
    .split(
      /\s*(?:,|\(|\s-\s?[A-Z]|\s(?:y\s)?podr[aá]|\spudiendo|\squien|\scuya|\spero|\sy\/o|\so\s(?=[A-Z])|\ses\suna|\sla\scual)/,
    )[0]
    .trim();
  const cargoTexto = fila.nombrepublicocargo ?? "";
  const cargo = cargoTexto.split(/\s-|\(/)[0].trim();
  const web = (fila.uripaginaweb ?? "").split(/\s/)[0].trim();
  return {
    razonSocial: razon || null,
    nit: formatoNit(fila.numeroidentificacion),
    representante: pendiente(fila.representante_legal)
      ? null
      : titulo(fila.representante_legal.trim()),
    cargo: pendiente(cargo) ? null : cargo,
    // La Superfinanciera anota cuando el representante renunció.
    cambioEnCurso: /renuncia/i.test(cargoTexto),
    ciudad: pendiente(fila.ciudad) ? null : titulo(fila.ciudad.trim()),
    direccion: pendiente(fila.direccion)
      ? null
      : fila.direccion.trim().replace(/\.$/, ""),
    sitioWeb:
      !pendiente(web) &&
      /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(web) &&
      !web.includes("@")
        ? web.replace(/^(?!https?:\/\/)/, "https://")
        : null,
  };
}

/** Fichas técnicas de los tipos de entidad pedidos, por "tipo-código". */
async function leerVigiladas(tipos) {
  const lista = tipos.map((t) => `'${t}'`).join(",");
  const r = await fetch(
    `${VIGILADAS}?${new URLSearchParams({ $where: `tipo_entidad in(${lista})`, $limit: "2000" })}`,
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!r.ok) throw new Error(`Vigiladas ${r.status}`);
  const filas = await r.json();
  return new Map(
    filas.map((f) => [`${f.tipo_entidad}-${f.cod_entidad}`, fichaTecnica(f)]),
  );
}

/** Los campos de la ficha guardados en `entidades` de Directus. */
export const CAMPOS_FICHA = [
  "representante_legal",
  "cargo_representante",
  "ciudad",
  "direccion",
];

/**
 * La ficha a mostrar: primero lo guardado en Directus (se puede corregir a
 * mano) y lo que falte, de la Superfinanciera.
 */
export function unirFicha(directus, superfinanciera) {
  const guardada = (campo) => {
    const v = directus?.[campo];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const representante = guardada("representante_legal");
  const s = superfinanciera ?? {
    razonSocial: null,
    nit: null,
    representante: null,
    cargo: null,
    cambioEnCurso: false,
    ciudad: null,
    direccion: null,
    sitioWeb: null,
  };
  const ficha = {
    ...s,
    representante: representante ?? s.representante,
    cargo: guardada("cargo_representante") ?? s.cargo,
    ciudad: guardada("ciudad") ?? s.ciudad,
    direccion: guardada("direccion") ?? s.direccion,
    // Si en Directus se puso otro representante, la nota de renuncia de la
    // Superfinanciera ya no aplica.
    cambioEnCurso:
      s.cambioEnCurso && (!representante || representante === s.representante),
  };
  return Object.values(ficha).some((v) => v) ? ficha : null;
}

/** Las entidades con código SFC y los análisis publicados. */
async function leerDirectus() {
  // Activas e inactivas: los bancos que solo están para los estados
  // financieros se guardan inactivos (no salen en el ranking de tasas).
  const base =
    "/items/entidades?filter[codigo_sfc][_nnull]=true&limit=-1&sort=nombre" +
    "&fields=codigo,nombre,tipo,logo,codigo_sfc,activa";
  // La ficha guardada (servidor/scripts/sincronizar-fichas.mjs). Si el
  // "Lector web" todavía no la puede leer, se sigue sin ella.
  const entidades = await pedirDirectus(`${base},${CAMPOS_FICHA.join(",")}`)
    .catch((error) => {
      console.warn("Entidades sin ficha guardada:", error.message);
      return pedirDirectus(base);
    })
    .then((r) => r.json());
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
  const porCodigoSfc = new Map(
    entidades
      .filter((e) => partirCodigoSfc(e.codigo_sfc))
      .map((e) => [e.codigo_sfc.trim(), e]),
  );
  const lista = [];
  // Todas las del CUIF: con los datos de Directus si la entidad está allá.
  for (const [clave, cifras] of cuif.cifras) {
    const d = porCodigoSfc.get(clave);
    const e = d ?? {
      codigo: `sfc-${clave}`,
      nombre: nombreEntidad(clave, cifras.nombreSfc),
      tipo: TIPOS_SFC[clave.split("-")[0]] ?? null,
      logo: null,
    };
    const ficha = d ? porEntidad.get(e.codigo) : null;
    lista.push({
      codigo: e.codigo,
      nombre: e.nombre,
      tipo: e.tipo ?? null,
      // El de Directus (solo las activas pasan por /api/logos); si no, el
      // del repositorio (LOGOS_SFC).
      logo:
        d?.logo && d.activa !== false
          ? `/api/logos/${e.codigo}`
          : (LOGOS_SFC[clave] ?? null),
      codigoSfc: clave,
      fichaTecnica: unirFicha(d, cuif.fichas?.get(clave) ?? null),
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
