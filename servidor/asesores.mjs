// Asesores aliados y reportes contra ellos, en Directus (colecciones
// `asesores` y `reportes_asesores`, creadas con
// servidor/scripts/crear-asesores.mjs).
//
//   GET  /api/asesores            los publicados (solo sus datos públicos)
//   GET  /api/asesores/:id/foto   la foto de un asesor publicado
//   POST /api/reportes-asesores   reporte de una persona contra un asesor
//
// El token es el del "Lector web": lee los asesores publicados (sin cédula,
// celular, correo ni notas) y solo puede CREAR reportes, no leerlos.

import express from "express";
import { cargarEnv } from "./env.mjs";
import { mandarCorreo, verificarTurnstile } from "./prospectos.mjs";

if (!process.env.DIRECTUS_TOKEN) cargarEnv();

const DIRECTUS = process.env.DIRECTUS_URL ?? "https://api.credimetria.com";
const SITIO = (process.env.SITIO_URL ?? "https://credimetria.com").replace(
  /\/$/,
  "",
);
const CAMPOS =
  "id,nombre,empresa,verificado,entidades,productos,ciudades,foto,orden";
const CACHE_MS = 5 * 60 * 1000;

export const MOTIVOS = {
  cobro_adelantado: "Me pidió dinero por adelantado",
  datos: "Usó o compartió mis datos sin permiso",
  horario_canal: "Me contactó fuera de horario o por otro canal",
  suplantacion: "Se hizo pasar por el banco o por Credimetría",
  trato: "Mal trato o información falsa",
  otro: "Otro",
};

async function pedir(ruta, opciones = {}) {
  const token = process.env.DIRECTUS_TOKEN;
  if (!token) throw new Error("Falta DIRECTUS_TOKEN");
  const r = await fetch(DIRECTUS + ruta, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, ...opciones.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const detalle = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(`Directus ${r.status} en ${ruta}: ${detalle}`);
  }
  return r;
}

const lista = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : [];

/** Fila de Directus → asesor para la página (la foto pasa por /api). */
export function asesorPublico(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    empresa: fila.empresa ?? "",
    verificado: fila.verificado === true,
    entidades: lista(fila.entidades),
    productos: lista(fila.productos),
    ciudades: lista(fila.ciudades),
    ...(fila.foto ? { foto: `/api/asesores/${fila.id}/foto` } : {}),
  };
}

let guardado = null; // { asesores, fotos: Map<id, idArchivo>, en }
const fotos = new Map(); // id → { datos, tipo, en }

async function leer() {
  if (guardado && Date.now() - guardado.en < CACHE_MS) return guardado;
  // Sin filtro por estado: el permiso del "Lector web" ya entrega solo los
  // publicados, y el campo `estado` no es público (pedirlo da 403).
  const r = await pedir(
    `/items/asesores?limit=-1&fields=${CAMPOS}&sort=orden,nombre`,
  );
  const filas = (await r.json()).data ?? [];
  guardado = {
    asesores: filas.map(asesorPublico),
    fotos: new Map(filas.filter((f) => f.foto).map((f) => [f.id, f.foto])),
    en: Date.now(),
  };
  return guardado;
}

/** Asesores publicados (con caché de 5 minutos). Lanza error si falla. */
export async function asesoresPublicos() {
  return (await leer()).asesores;
}

/** La foto de un asesor publicado: { datos, tipo } o null. */
export async function fotoAsesor(id) {
  const lista = fotos.get(id);
  if (lista && Date.now() - lista.en < CACHE_MS) return lista;
  const archivo = (await leer()).fotos.get(id);
  if (!archivo) return null;
  const r = await pedir(`/assets/${archivo}?width=320&format=webp`);
  const foto = {
    datos: Buffer.from(await r.arrayBuffer()),
    tipo: r.headers.get("content-type") ?? "image/webp",
    en: Date.now(),
  };
  fotos.set(id, foto);
  return foto;
}

const texto = (v, max) =>
  typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

/**
 * Revisa el reporte que llega del navegador y devuelve el registro para
 * Directus, o `{ error }` con el campo que no sirve. `ids` son los asesores
 * publicados.
 */
export function validarReporte(cuerpo, ip = null, ids = []) {
  const c = cuerpo ?? {};
  const asesor =
    typeof c.asesor === "string" && ids.includes(c.asesor) ? c.asesor : null;
  const asesorNombre = asesor ? null : texto(c.asesorNombre, 120);
  if (!asesor && !asesorNombre) return { error: "asesor" };
  const motivo = c.motivo in MOTIVOS ? c.motivo : null;
  if (!motivo) return { error: "motivo" };
  const descripcion = texto(c.descripcion, 3000);
  if (!descripcion || descripcion.length < 10) return { error: "descripcion" };
  const fecha =
    typeof c.fechaContacto === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.fechaContacto)
      ? c.fechaContacto
      : null;
  const nombre = texto(c.nombre, 120);
  if (!nombre) return { error: "nombre" };
  const correo = texto(c.correo, 120);
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    return { error: "correo" };
  const celular = typeof c.celular === "string" ? c.celular : "";
  if (celular && !/^3\d{9}$/.test(celular)) return { error: "celular" };
  const a = c.autorizacion ?? {};
  const autorizacion = {
    fecha: texto(a.fecha, 40),
    texto: texto(a.texto, 600),
    versionPolitica: texto(a.versionPolitica, 40),
    paginaOrigen: texto(a.paginaOrigen, 300),
  };
  if (!autorizacion.texto?.startsWith("Autorizo a Credimetría"))
    return { error: "autorizacion" };
  return {
    reporte: {
      asesor,
      asesor_nombre: asesorNombre,
      motivo,
      descripcion,
      fecha_contacto: fecha,
      nombre,
      correo,
      celular: celular || null,
      autorizacion: {
        ...autorizacion,
        recibida: new Date().toISOString(),
        ip,
      },
    },
  };
}

/** Guarda el reporte en Directus. Lanza error si no se pudo. */
export async function guardarReporte(reporte) {
  await pedir("/items/reportes_asesores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reporte),
  });
}

const escapar = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );

/** Aviso al administrador (AVISO_PARA) con todo el reporte. */
export function correoReporteAdmin(r, nombreAsesor) {
  const filas = [
    ["Asesor", nombreAsesor ?? r.asesor_nombre ?? "—"],
    ["En la lista", r.asesor ? "Sí" : "No (escribió el nombre)"],
    ["Motivo", MOTIVOS[r.motivo]],
    ["Fecha del contacto", r.fecha_contacto ?? "—"],
    ["Reporta", r.nombre],
    ["Correo", r.correo],
    ["Celular", r.celular ?? "—"],
  ];
  return {
    to: process.env.AVISO_PARA,
    replyTo: r.correo,
    subject: `Credimetría · Reporte contra asesor: ${filas[0][1]} (${MOTIVOS[r.motivo]})`,
    text: [
      "Llegó un reporte contra un asesor:",
      "",
      ...filas.map(([k, v]) => `${k}: ${v}`),
      "",
      "Lo que pasó:",
      r.descripcion,
      "",
      `Ver en Directus: ${DIRECTUS}/admin/content/reportes_asesores`,
    ].join("\n"),
    html: `<!doctype html><html lang="es"><body style="font:14px/1.5 Arial,sans-serif;color:#1b2733">
<p><b>Llegó un reporte contra un asesor.</b></p>
<table cellpadding="0" cellspacing="0">${filas
      .map(
        ([k, v]) =>
          `<tr><td style="padding:3px 16px 3px 0;color:#5b6b7b">${k}</td><td style="padding:3px 0"><b>${escapar(v)}</b></td></tr>`,
      )
      .join("")}</table>
<p style="white-space:pre-wrap;background:#f3f6f9;padding:12px;border-radius:8px">${escapar(r.descripcion)}</p>
<p><a href="${DIRECTUS}/admin/content/reportes_asesores">Ver en Directus</a></p>
</body></html>`,
  };
}

/** Confirmación a quien reporta. */
export function correoReportePersona(r) {
  const nombre = r.nombre.split(/\s+/)[0];
  const lineas = [
    `Hola, ${nombre}: recibimos tu reporte.`,
    "",
    "Lo revisamos y, si el asesor incumplió las reglas de Credimetría, lo retiramos de la lista de aliados. Si necesitamos más información, te escribimos a este correo.",
    "",
    "Recuerda: ningún asesor aliado puede cobrarte por adelantado. Si te pidieron dinero, no pagues.",
    "",
    `Credimetría · ${SITIO}`,
  ];
  return {
    to: r.correo,
    subject: "Recibimos tu reporte",
    text: lineas.join("\n"),
    html: `<!doctype html><html lang="es"><body style="font:15px/1.6 Arial,sans-serif;color:#1b2733">
${lineas
  .filter(Boolean)
  .map((l) => `<p>${escapar(l)}</p>`)
  .join("\n")}
</body></html>`,
  };
}

const LIMITE = 5;
const VENTANA_MS = 10 * 60 * 1000;

/**
 * Rutas de asesores y reportes. `leerAsesores`, `foto`, `guardar`, `mandar`
 * y `verificar` se pueden cambiar en las pruebas.
 */
export function rutasAsesores(
  app,
  {
    leerAsesores = asesoresPublicos,
    foto = fotoAsesor,
    guardar = guardarReporte,
    mandar = mandarCorreo,
    verificar = verificarTurnstile,
  } = {},
) {
  app.get("/api/asesores", async (_req, res) => {
    try {
      res.set("Cache-Control", "public, max-age=300");
      res.json({ asesores: await leerAsesores() });
    } catch (e) {
      console.error("No se pudieron leer los asesores:", e.message);
      res.status(503).json({ error: "No pudimos leer los asesores." });
    }
  });

  app.get("/api/asesores/:id/foto", async (req, res) => {
    try {
      const f = await foto(req.params.id);
      if (!f) return res.status(404).end();
      res.set("Content-Type", f.tipo);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(f.datos);
    } catch (e) {
      console.error("No se pudo leer la foto del asesor:", e.message);
      res.status(503).end();
    }
  });

  const intentos = new Map();
  app.post(
    "/api/reportes-asesores",
    express.json({ limit: "20kb" }),
    async (req, res) => {
      res.set("Cache-Control", "no-store");
      const ip =
        req.get("cf-connecting-ip") ??
        req.get("x-forwarded-for")?.split(",")[0].trim() ??
        req.socket.remoteAddress ??
        null;
      const ahora = Date.now();
      const recientes = (intentos.get(ip) ?? []).filter(
        (t) => ahora - t < VENTANA_MS,
      );
      if (recientes.length >= LIMITE) {
        return res
          .status(429)
          .json({ error: "Demasiados reportes; intenta más tarde." });
      }
      recientes.push(ahora);
      intentos.set(ip, recientes);
      if (!(await verificar(req.body?.turnstileToken, ip))) {
        return res.status(400).json({
          error: "verificacion",
          mensaje: "No pudimos verificar tu reporte.",
        });
      }
      let asesores = [];
      try {
        asesores = await leerAsesores();
      } catch {
        // Sin la lista, el reporte igual se guarda con el nombre escrito.
      }
      const { reporte, error } = validarReporte(
        req.body,
        ip,
        asesores.map((a) => a.id),
      );
      if (error) return res.status(400).json({ error, campo: error });
      try {
        await guardar(reporte);
      } catch (e) {
        console.error("No se pudo guardar el reporte:", e.message);
        return res
          .status(503)
          .json({ error: "No pudimos guardar tu reporte." });
      }
      res.status(201).json({ ok: true });
      console.log(
        `Reporte guardado contra ${reporte.asesor ?? "un asesor fuera de la lista"} (${reporte.motivo}); mandando los 2 correos.`,
      );
      const nombre = asesores.find((a) => a.id === reporte.asesor)?.nombre;
      await Promise.all([
        mandar(correoReporteAdmin(reporte, nombre)),
        mandar(correoReportePersona(reporte)),
      ]);
    },
  );
}
