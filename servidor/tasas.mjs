// Tasas para la página pública, leídas de Directus en el servidor con el
// token del usuario "Lector web" (solo lectura). El navegador nunca ve
// Directus ni el token: pide /api/tasas y /api/logos/<entidad> a la página.
//
// Variables: DIRECTUS_TOKEN (obligatoria) y DIRECTUS_URL (opcional).

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
  if (!r.ok) throw new Error(`Directus ${r.status} en ${ruta.split("?")[0]}`);
  return r;
}

const numero = (v) => (v === null || v === undefined ? null : Number(v));

async function leer() {
  const [publicadas, promedios] = await Promise.all([
    pedir(
      "/items/tasas_publicadas?filter[estado][_eq]=publicada&limit=-1" +
        "&fields=producto,ea_desde,ea_hasta,hasta_origen,vigente_desde," +
        "entidad.codigo,entidad.nombre,entidad.tipo,entidad.logo,fuente.url",
    ).then((r) => r.json()),
    pedir(
      "/items/tasas_promedio?limit=-1&fields=entidad,producto,tasa_ea,corte",
    ).then((r) => r.json()),
  ]);
  const idsLogo = new Map();
  const tasas = [];
  for (const p of publicadas.data) {
    if (!p.entidad) continue;
    if (p.entidad.logo) idsLogo.set(p.entidad.codigo, p.entidad.logo);
    const promedio = promedios.data.find(
      (x) => x.entidad === p.entidad.codigo && x.producto === p.producto,
    );
    const desde = numero(p.ea_desde);
    const real = numero(promedio?.tasa_ea) ?? desde;
    if (real === null) continue;
    tasas.push({
      entidad: p.entidad.nombre,
      tipo: p.entidad.tipo,
      producto: p.producto,
      tasaReal: real,
      tasaAnunciada: desde,
      tasaHasta: numero(p.ea_hasta),
      hastaUsura: p.hasta_origen === "usura",
      vigencia: p.vigente_desde,
      pdf: p.fuente?.url ?? null,
      logo: p.entidad.logo ? `/api/logos/${p.entidad.codigo}` : null,
    });
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
