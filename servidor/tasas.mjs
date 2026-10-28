// Tasas para la página pública, leídas de Directus en el servidor con el
// token del usuario "Lector web" (solo lectura). El navegador nunca ve
// Directus ni el token: pide /api/tasas y /api/logos/<entidad> a la página.
//
// Variables: DIRECTUS_TOKEN (obligatoria) y DIRECTUS_URL (opcional).

// En desarrollo (`npm start`) la parte de la página que se arma en el
// servidor también necesita el token del .env; en Coolify no hay .env y se
// usan las variables del recurso.
if (!process.env.DIRECTUS_TOKEN) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Sin .env: la página sale sin tasas (y lo dice el log).
  }
}

const DIRECTUS =
  process.env.DIRECTUS_URL ?? "https://credimetria-api.valkiriacode.com";
/** Cada cuánto se vuelve a preguntar a Directus. */
const VIGENCIA_MS = 10 * 60 * 1000;

let guardado = null; // { datos, logos: Map<codigo, idArchivo>, en }
let pidiendo = null;
const logos = new Map(); // codigo → { datos, tipo, en }

async function pedir(ruta) {
  const token = process.env.DIRECTUS_TOKEN;
  if (!token) throw new Error("Falta DIRECTUS_TOKEN");
  const r = await fetch(DIRECTUS + ruta, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    // El mensaje de Directus (p. ej. "You don't have permission…") ayuda a
    // saber qué pasó; nunca trae el token.
    const detalle = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Directus ${r.status} en ${ruta.split("?")[0]}${detalle ? `: ${detalle}` : ""}`,
    );
  }
  return r;
}

/** Productos de vivienda (pesos): hipotecario y leasing, VIS y No VIS. */
const VIVIENDA = [
  "vivienda-vis",
  "vivienda-no-vis",
  "leasing-vis",
  "leasing-no-vis",
];

const numero = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * Bancos que en un producto no publican su tasa (fuente con `como_extraer`
 * "solo_promedio", p. ej. Banco Popular en libranza): salen solo con el
 * promedio de la Superfinanciera. Si no se pueden leer, la página sigue sin
 * ellos.
 */
/** Cómo salió la última lectura de los bancos sin tasa (para /api/estado). */
let estadoSinTasa = { ok: null, bancos: 0, error: null };

async function soloPromedio() {
  try {
    const r = await pedir(
      "/items/fuentes?filter[como_extraer][_eq]=solo_promedio&filter[estado][_eq]=activa&limit=-1" +
        "&fields=producto,entidad.codigo,entidad.nombre,entidad.tipo,entidad.logo,entidad.activa",
    );
    const datos = (await r.json()).data;
    estadoSinTasa = { ok: true, bancos: datos.length, error: null };
    return datos;
  } catch (error) {
    console.error("No se pudieron leer los bancos sin tasa:", error.message);
    estadoSinTasa = { ok: false, bancos: 0, error: error.message };
    return [];
  }
}

async function leer() {
  const [publicadas, promedios, sinTasa, entidadesVivienda] = await Promise.all(
    [
      pedir(
        "/items/tasas_publicadas?filter[estado][_eq]=publicada&limit=-1" +
          "&fields=producto,ea_desde,ea_hasta,hasta_origen,vigente_desde,enlace,enlace_es_pagina," +
          "entidad.codigo,entidad.nombre,entidad.tipo,entidad.logo,fuente.*",
      ).then((r) => r.json()),
      pedir(
        "/items/tasas_promedio?limit=-1&fields=entidad,producto,tasa_ea,corte",
      ).then((r) => r.json()),
      soloPromedio(),
      pedir(
        "/items/entidades?filter[activa][_eq]=true&limit=-1&fields=codigo,nombre,tipo,logo,activa",
      )
        .then((r) => r.json())
        .then((r) => r.data)
        .catch(() => []),
    ],
  );
  const idsLogo = new Map();
  const tasas = [];
  for (const p of publicadas.data) {
    if (!p.entidad) continue;
    if (p.entidad.logo) idsLogo.set(p.entidad.codigo, p.entidad.logo);
    const promedio = promedios.data.find(
      (x) => x.entidad === p.entidad.codigo && x.producto === p.producto,
    );
    const desde = numero(p.ea_desde);
    // En vivienda, sin promedio de la Superfinanciera (p. ej. Bancolombia o
    // AV Villas en leasing, que lo ofrecen pero no reportan créditos) sale
    // igual, con "Sin reporte" y al final: mejor mostrar que lo ofrece. Se
    // calcula con la tasa que publica.
    const sinReporte =
      VIVIENDA.includes(p.producto) && numero(promedio?.tasa_ea) === null;
    const real =
      numero(promedio?.tasa_ea) ??
      desde ??
      (sinReporte ? numero(p.ea_hasta) : null);
    if (real === null) continue;
    tasas.push({
      entidad: p.entidad.nombre,
      tipo: p.entidad.tipo,
      producto: p.producto,
      tasaReal: real,
      ...(sinReporte ? { sinReporte: true } : {}),
      tasaAnunciada: desde,
      tasaHasta: numero(p.ea_hasta),
      hastaUsura: p.hasta_origen === "usura",
      vigencia: p.vigente_desde,
      // De dónde salió esta tasa: su propio enlace (PDF o página) o, en las
      // tasas anteriores a ese campo, la dirección de su fuente.
      pdf: p.enlace ?? p.fuente?.url ?? null,
      enPagina: p.enlace
        ? Boolean(p.enlace_es_pagina)
        : p.fuente?.tipo === "pagina",
      logo: p.entidad.logo ? `/api/logos/${p.entidad.codigo}` : null,
    });
  }
  // Sin tasa publicada: solo con su promedio, sin rango ni enlace.
  for (const f of sinTasa) {
    const e = f.entidad;
    if (!e?.activa) continue;
    if (tasas.some((t) => t.entidad === e.nombre && t.producto === f.producto))
      continue;
    const promedio = promedios.data.find(
      (x) => x.entidad === e.codigo && x.producto === f.producto,
    );
    const real = numero(promedio?.tasa_ea);
    if (real === null) continue;
    if (e.logo) idsLogo.set(e.codigo, e.logo);
    tasas.push({
      entidad: e.nombre,
      tipo: e.tipo,
      producto: f.producto,
      tasaReal: real,
      tasaAnunciada: null,
      tasaHasta: null,
      hastaUsura: false,
      vigencia: null,
      pdf: null,
      enPagina: false,
      logo: e.logo ? `/api/logos/${e.codigo}` : null,
    });
  }
  // Vivienda: mientras se cargan sus tasas publicadas, las entidades salen
  // con su promedio y "Por cargar" en la tasa que anuncian.
  if (entidadesVivienda.length) {
    for (const x of promedios.data) {
      if (!VIVIENDA.includes(x.producto)) continue;
      const e = entidadesVivienda.find((y) => y.codigo === x.entidad);
      if (!e?.activa) continue;
      if (
        tasas.some((t) => t.entidad === e.nombre && t.producto === x.producto)
      )
        continue;
      const real = numero(x.tasa_ea);
      if (real === null) continue;
      if (e.logo) idsLogo.set(e.codigo, e.logo);
      tasas.push({
        entidad: e.nombre,
        tipo: e.tipo,
        producto: x.producto,
        tasaReal: real,
        tasaAnunciada: null,
        anunciaPendiente: true,
        tasaHasta: null,
        hastaUsura: false,
        vigencia: null,
        pdf: null,
        enPagina: false,
        logo: e.logo ? `/api/logos/${e.codigo}` : null,
      });
    }
  }
  const cortes = promedios.data
    .map((x) => x.corte)
    .filter(Boolean)
    .sort();
  return {
    datos: {
      corte: {
        fuente: "Superintendencia Financiera de Colombia",
        fecha: cortes.at(-1) ?? null,
        ejemplo: false,
      },
      tasas,
    },
    logos: idsLogo,
  };
}

/**
 * Las tasas publicadas con su promedio. Guarda la respuesta 10 minutos; si
 * Directus falla, devuelve la última que tenía.
 */
export async function tasasPublicas() {
  if (guardado && Date.now() - guardado.en < VIGENCIA_MS) return guardado.datos;
  pidiendo ??= leer()
    .then((nuevo) => {
      guardado = { ...nuevo, en: Date.now() };
      return nuevo.datos;
    })
    .catch((error) => {
      if (guardado) return guardado.datos;
      throw error;
    })
    .finally(() => (pidiendo = null));
  return pidiendo;
}

/** El logo de una entidad, reducido; `null` si no tiene. */
export async function logoEntidad(codigo) {
  const listo = logos.get(codigo);
  if (listo && Date.now() - listo.en < VIGENCIA_MS * 6) return listo;
  await tasasPublicas();
  const id = guardado?.logos.get(codigo);
  if (!id) return null;
  const r = await pedir(`/assets/${id}?height=56&fit=inside&format=webp`);
  const logo = {
    datos: Buffer.from(await r.arrayBuffer()),
    tipo: r.headers.get("content-type") ?? "image/webp",
    en: Date.now(),
  };
  logos.set(codigo, logo);
  return logo;
}

/** Rutas /api/tasas y /api/logos/<entidad> para un servidor Express. */
export function rutasTasas(app) {
  // Diagnóstico sin datos sensibles: qué versión corre y qué leyó.
  app.get("/api/estado", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const datos = await tasasPublicas();
      const porProducto = {};
      for (const t of datos.tasas)
        porProducto[t.producto] = (porProducto[t.producto] ?? 0) + 1;
      res.json({
        version: process.env.SOURCE_COMMIT ?? process.env.COMMIT ?? null,
        leidoHace: guardado
          ? `${Math.round((Date.now() - guardado.en) / 1000)} s`
          : null,
        tasasPorProducto: porProducto,
        sinTasa: estadoSinTasa,
      });
    } catch (error) {
      res.status(503).json({ error: error.message, sinTasa: estadoSinTasa });
    }
  });

  app.get("/api/tasas", async (_req, res) => {
    try {
      res.set("Cache-Control", "public, max-age=300");
      res.json(await tasasPublicas());
    } catch (error) {
      console.error("No se pudieron leer las tasas:", error.message);
      res.status(503).json({ error: "Las tasas no están disponibles" });
    }
  });
  app.get("/api/logos/:codigo", async (req, res) => {
    try {
      const logo = await logoEntidad(req.params.codigo);
      if (!logo) return res.status(404).end();
      res.set("Content-Type", logo.tipo);
      res.set("Cache-Control", "public, max-age=86400");
      res.end(logo.datos);
    } catch (error) {
      console.error("No se pudo leer el logo:", error.message);
      res.status(503).end();
    }
  });
}
