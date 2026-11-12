// Asesores aliados y reportes contra ellos, en Directus (colecciones
// `asesores` y `reportes_asesores`, creadas con
// servidor/scripts/crear-asesores.mjs).
//
//   GET  /api/asesores            los publicados (solo sus datos públicos)
//   GET  /api/asesores/:id/foto   la foto de un asesor publicado
//   POST /api/reportes-asesores   reporte de una persona contra un asesor
//   POST /api/solicitudes-aliados  "Quiero ser aliado" (colección
//                                  `solicitudes_aliados`, solo crear)
//
// El token es el del "Lector web": lee los asesores publicados (sin cédula,
// celular, correo ni notas) y solo puede CREAR reportes, no leerlos.

import express from "express";
import { cargarEnv } from "./env.mjs";
import {
  CID_LOGO,
  logoCorreo,
  mandarCorreo,
  verificarTurnstile,
} from "./prospectos.mjs";

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
    // `?v=` cambia con cada foto nueva: el navegador guarda la foto un día y
    // así no se queda con la anterior.
    ...(fila.foto
      ? {
          foto: `/api/asesores/${fila.id}/foto?v=${String(fila.foto).slice(0, 8)}`,
        }
      : {}),
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
  const archivo = (await leer()).fotos.get(id);
  if (!archivo) return null;
  const lista = fotos.get(id);
  if (lista?.archivo === archivo && Date.now() - lista.en < CACHE_MS)
    return lista;
  // Cuadrada (320 × 320) aunque suban una foto de cuerpo entero: Directus la
  // recorta alrededor del punto focal del archivo (o del centro si no tiene).
  const r = await pedir(
    `/assets/${archivo}?width=320&height=320&fit=cover&format=webp`,
  );
  const foto = {
    datos: Buffer.from(await r.arrayBuffer()),
    tipo: r.headers.get("content-type") ?? "image/webp",
    archivo,
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

// ── "Quiero ser aliado": solicitudes de asesores ─────────────────────────

export const TIPOS_ALIADO = {
  independiente: "Asesor independiente",
  fuerza_ventas: "Fuerza de ventas",
  empleado_entidad: "Empleado de la entidad",
  empresa: "Empresa asesora",
};

export const VINCULOS = {
  carta: "Carta de la entidad",
  certificado: "Certificado",
  contrato: "Contrato",
  otro: "Otro",
};

/** Lista de textos cortos (entidades, productos, ciudades): máximo 40. */
const textos = (v, max = 60) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v
            .filter((x) => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x && x.length <= max),
        ),
      ].slice(0, 40)
    : [];

/**
 * Revisa la solicitud "Quiero ser aliado" y devuelve el registro para
 * Directus, o `{ error }` con el campo que no sirve.
 */
export function validarSolicitudAliado(cuerpo, ip = null) {
  const c = cuerpo ?? {};
  const nombre = texto(c.nombre, 120);
  if (!nombre) return { error: "nombre" };
  const cedula =
    typeof c.cedula === "string" ? c.cedula.replace(/\D/g, "") : "";
  if (!/^\d{5,12}$/.test(cedula)) return { error: "cedula" };
  const celular = typeof c.celular === "string" ? c.celular : "";
  if (!/^3\d{9}$/.test(celular)) return { error: "celular" };
  const correo = texto(c.correo, 120);
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    return { error: "correo" };
  const ciudad = texto(c.ciudad, 80);
  if (!ciudad) return { error: "ciudad" };
  const tipo = c.tipo in TIPOS_ALIADO ? c.tipo : null;
  if (!tipo) return { error: "tipo" };
  const empresa = texto(c.empresa, 120);
  const entidades = textos(c.entidades);
  if (!entidades.length) return { error: "entidades" };
  const productos = textos(c.productos);
  if (!productos.length) return { error: "productos" };
  const ciudades = textos(c.ciudades);
  if (!ciudades.length) return { error: "ciudades" };
  const experiencia =
    Number.isInteger(c.experiencia) && c.experiencia >= 0 && c.experiencia <= 60
      ? c.experiencia
      : null;
  if (experiencia === null) return { error: "experiencia" };
  const vinculo = c.vinculo in VINCULOS ? c.vinculo : null;
  if (!vinculo) return { error: "vinculo" };
  const mensaje = texto(c.mensaje, 2000);
  if (c.aceptaReglas !== true) return { error: "reglas" };
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
    solicitud: {
      nombre,
      cedula,
      celular,
      correo,
      ciudad,
      tipo,
      empresa,
      entidades,
      productos,
      ciudades,
      experiencia,
      vinculo,
      mensaje,
      acepta_reglas: true,
      autorizacion: {
        ...autorizacion,
        recibida: new Date().toISOString(),
        ip,
      },
    },
  };
}

/** Guarda la solicitud en Directus. Lanza error si no se pudo. */
export async function guardarSolicitudAliado(solicitud) {
  await pedir("/items/solicitudes_aliados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(solicitud),
  });
}

/** Aviso al administrador con toda la información del asesor. */
export function correoSolicitudAdmin(s) {
  const filas = [
    ["Nombre", s.nombre],
    ["Cédula", s.cedula],
    ["Celular", s.celular],
    ["Correo", s.correo],
    ["Vive en", s.ciudad],
    ["Tipo", TIPOS_ALIADO[s.tipo]],
    ["Empresa", s.empresa ?? "—"],
    ["Entidades", s.entidades.join(", ")],
    ["Productos", s.productos.join(", ")],
    ["Atiende en", s.ciudades.join(", ")],
    ["Experiencia", `${s.experiencia} ${s.experiencia === 1 ? "año" : "años"}`],
    ["Puede demostrar su vínculo con", VINCULOS[s.vinculo]],
  ];
  return {
    to: process.env.AVISO_PARA,
    replyTo: s.correo,
    subject: `Credimetría · Quiere ser aliado: ${s.nombre} (${TIPOS_ALIADO[s.tipo]})`,
    text: [
      "Un asesor quiere ser aliado:",
      "",
      ...filas.map(([k, v]) => `${k}: ${v}`),
      ...(s.mensaje ? ["", "Mensaje:", s.mensaje] : []),
      "",
      "Aceptó las 5 reglas de los aliados.",
      `Ver en Directus: ${DIRECTUS}/admin/content/solicitudes_aliados`,
    ].join("\n"),
    html: `<!doctype html><html lang="es"><body style="font:14px/1.5 Arial,sans-serif;color:#1b2733">
<p><b>Un asesor quiere ser aliado.</b></p>
<table cellpadding="0" cellspacing="0">${filas
      .map(
        ([k, v]) =>
          `<tr><td style="padding:3px 16px 3px 0;color:#5b6b7b;vertical-align:top">${k}</td><td style="padding:3px 0"><b>${escapar(v)}</b></td></tr>`,
      )
      .join("")}</table>
${s.mensaje ? `<p style="white-space:pre-wrap;background:#f3f6f9;padding:12px;border-radius:8px">${escapar(s.mensaje)}</p>` : ""}
<p>Aceptó las 5 reglas de los aliados.</p>
<p><a href="${DIRECTUS}/admin/content/solicitudes_aliados">Ver en Directus</a></p>
</body></html>`,
  };
}

/** Las 5 reglas de /aliados, dichas al asesor (no a la persona). */
export const REGLAS_ASESOR = [
  [
    "Nunca cobrar por adelantado.",
    'Ni por estudio, ni por "aprobar" el crédito.',
  ],
  [
    "Usar los datos solo para ofrecer crédito.",
    "No revenderlos ni compartirlos con nadie.",
  ],
  [
    "Respetar horarios y canales.",
    "Solo por el canal que eligió la persona, en los horarios de la ley.",
  ],
  ["Demostrar tu vínculo con la entidad.", "Con carta o certificado."],
  ["Borrar los datos de quien lo pida.", "Y avisarnos cuando esté hecho."],
];

/** "CARLOS ANDRÉS PÉREZ" o "carlos" → "Carlos". */
const primerNombre = (nombre) => {
  const n = nombre.trim().split(/\s+/)[0].toLocaleLowerCase("es-CO");
  return n.charAt(0).toLocaleUpperCase("es-CO") + n.slice(1);
};

/**
 * Confirmación al asesor, con el mismo diseño del correo al cliente: el logo
 * adjunto, lo que nos contó, qué sigue (nos pondremos en contacto con él) y
 * las reglas que aceptó. Las respuestas llegan a AVISO_PARA.
 */
export function correoSolicitudAsesor(s, logo = logoCorreo()) {
  const srcLogo = logo ? `cid:${CID_LOGO}` : `${SITIO}/correo/credimetria.png`;
  const nombre = primerNombre(s.nombre);
  const azul = "#0b4f8c";
  const tinta = "#1b2733";
  const suave = "#5b6b7b";
  const anios = `${s.experiencia} ${s.experiencia === 1 ? "año" : "años"}`;
  const resumen = [
    ["Eres", TIPOS_ALIADO[s.tipo]],
    ...(s.empresa ? [["Empresa", s.empresa]] : []),
    ["Experiencia", anios],
    ["Entidades", s.entidades.join(", ")],
    ["Productos", s.productos.join(", ")],
    ["Atiendes en", s.ciudades.join(", ")],
    ["Tu vínculo", `Lo demuestras con: ${VINCULOS[s.vinculo].toLowerCase()}`],
    ["Te contactamos", `${s.correo} · ${s.celular}`],
  ];
  const pasos = [
    [
      "Revisamos tu solicitud.",
      "Miramos tu experiencia y las entidades con las que trabajas.",
    ],
    [
      "Nos ponemos en contacto contigo.",
      "Te escribimos o te llamamos para conocerte y pedirte el documento que demuestre tu vínculo con las entidades.",
    ],
    [
      "Te publicamos en Credimetría.",
      'Si todo está bien, apareces en credimetria.com/aliados con el sello "Verificado por Credimetría" y empiezas a recibir solicitudes de personas que ya compararon tasas.',
    ],
  ];
  const filas = (lista, numerado) =>
    lista
      .map(
        ([titulo, detalle], i) => `
              <tr>
                <td valign="top" style="padding:6px 12px 6px 0;width:26px">
                  <div style="width:24px;height:24px;border-radius:12px;background:${numerado};color:#fff;font:bold 13px/24px Arial,sans-serif;text-align:center">${i + 1}</div>
                </td>
                <td style="padding:6px 0;font:14px/1.5 Arial,sans-serif;color:${tinta}"><b>${escapar(titulo)}</b> <span style="color:${suave}">${escapar(detalle)}</span></td>
              </tr>`,
      )
      .join("");
  const resumenHtml = resumen
    .map(
      ([k, v]) => `
              <tr>
                <td valign="top" style="padding:4px 16px 4px 0;font:14px Arial,sans-serif;color:${suave};white-space:nowrap">${k}</td>
                <td style="padding:4px 0;font:bold 14px/1.5 Arial,sans-serif;color:${tinta}">${escapar(v)}</td>
              </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibimos tu solicitud para ser aliado</title></head>
<body style="margin:0;padding:0;background:#eef3f8">
  <div style="display:none;max-height:0;overflow:hidden">Revisaremos tu información y nos pondremos en contacto contigo para los siguientes pasos.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px 32px;border-bottom:4px solid ${azul}">
          <a href="${SITIO}"><img src="${srcLogo}" width="190" alt="Credimetría" style="display:block;border:0;width:190px;height:auto"></a>
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 12px;font:bold 22px/1.3 Arial,sans-serif;color:${tinta}">Hola, ${escapar(nombre)}: recibimos tu solicitud</h1>
          <p style="margin:0 0 16px;font:15px/1.6 Arial,sans-serif;color:${tinta}">Gracias por querer ser <b>asesor aliado de Credimetría</b>. Nuestro equipo va a revisar tu información y <b>nos pondremos en contacto contigo</b> en los próximos días hábiles, a tu correo o a tu celular, para contarte los siguientes pasos.</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9f1fa;border-radius:10px">
            <tr><td style="padding:16px 20px">
              <div style="font:bold 12px Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${azul};margin-bottom:6px">Lo que nos contaste</div>
              <table role="presentation" cellpadding="0" cellspacing="0">${resumenHtml}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 4px">
          <h2 style="margin:0 0 8px;font:bold 17px/1.3 Arial,sans-serif;color:${tinta}">Qué sigue</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(pasos, "#187d55")}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 4px">
          <h2 style="margin:0 0 8px;font:bold 17px/1.3 Arial,sans-serif;color:${tinta}">Las reglas que aceptaste</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(REGLAS_ASESOR, azul)}
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;font:14px/1.6 Arial,sans-serif;color:${tinta}">
          ¿Algo de tu información cambió o quieres contarnos más? <b>Responde a este correo</b> y lo agregamos a tu solicitud. Mientras tanto, mira cómo te verán las personas en la <a href="${SITIO}/aliados" style="color:${azul}">lista de asesores aliados</a>.
        </td></tr>
        <tr><td style="padding:20px 32px;background:#0b2a4a;font:12px/1.6 Arial,sans-serif;color:#c9d6e3">
          Recibes este correo porque pediste ser asesor aliado en Credimetría y autorizaste el tratamiento de tus datos. Tu cédula no se publica. <a href="${SITIO}/politica-de-datos" style="color:#ffffff">Política de tratamiento de datos</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hola, ${nombre}: recibimos tu solicitud`,
    "",
    "Gracias por querer ser asesor aliado de Credimetría. Nuestro equipo va a revisar tu información y nos pondremos en contacto contigo en los próximos días hábiles, a tu correo o a tu celular, para contarte los siguientes pasos.",
    "",
    "Lo que nos contaste:",
    ...resumen.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Qué sigue:",
    ...pasos.map(([t, d], i) => `${i + 1}. ${t} ${d}`),
    "",
    "Las reglas que aceptaste:",
    ...REGLAS_ASESOR.map(([t, d], i) => `${i + 1}. ${t} ${d}`),
    "",
    "¿Algo de tu información cambió? Responde a este correo.",
    `Lista de asesores aliados: ${SITIO}/aliados`,
    "",
    "— Equipo de Credimetría",
  ].join("\n");

  return {
    to: s.correo,
    // Si responde, la respuesta llega a quien revisa las solicitudes.
    ...(process.env.AVISO_PARA ? { replyTo: process.env.AVISO_PARA } : {}),
    subject: "Recibimos tu solicitud para ser asesor aliado de Credimetría",
    html,
    text,
    ...(logo && {
      attachments: [
        {
          filename: "credimetria.png",
          content: logo,
          contentType: "image/png",
          cid: CID_LOGO,
          contentDisposition: "inline",
        },
      ],
    }),
  };
}

/** POST /api/solicitudes-aliados. */
export function rutasSolicitudesAliados(
  app,
  {
    guardar = guardarSolicitudAliado,
    mandar = mandarCorreo,
    verificar = verificarTurnstile,
  } = {},
) {
  const intentos = new Map();
  app.post(
    "/api/solicitudes-aliados",
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
          .json({ error: "Demasiadas solicitudes; intenta más tarde." });
      }
      recientes.push(ahora);
      intentos.set(ip, recientes);
      if (!(await verificar(req.body?.turnstileToken, ip))) {
        return res.status(400).json({
          error: "verificacion",
          mensaje: "No pudimos verificar tu solicitud.",
        });
      }
      const { solicitud, error } = validarSolicitudAliado(req.body, ip);
      if (error) return res.status(400).json({ error, campo: error });
      try {
        await guardar(solicitud);
      } catch (e) {
        console.error("No se pudo guardar la solicitud de aliado:", e.message);
        return res
          .status(503)
          .json({ error: "No pudimos guardar tu solicitud." });
      }
      res.status(201).json({ ok: true });
      console.log(
        `Solicitud de aliado guardada (${solicitud.tipo}); mandando los 2 correos.`,
      );
      await Promise.all([
        mandar(correoSolicitudAdmin(solicitud)),
        mandar(correoSolicitudAsesor(solicitud)),
      ]);
    },
  );
}
