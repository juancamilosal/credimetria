// Solicitudes de asesoría (prospectos): el formulario de /asesoria las manda
// a POST /api/prospectos; el servidor las revisa, las guarda en Directus
// (colección `prospectos`) y manda dos correos: uno a la persona (un asesor
// la contactará y las reglas de los aliados) y otro al administrador.
//
// Variables: DIRECTUS_TOKEN (el del "Lector web", que en `prospectos` solo
// puede crear, no leer), DIRECTUS_URL (opcional), SMTP_HOST, SMTP_PUERTO
// (465 por defecto), SMTP_USUARIO, SMTP_CLAVE, CORREO_DE (remitente; si no,
// AVISO_DE o el usuario), AVISO_PARA (a quién le llega cada solicitud) y
// SITIO_URL (para los enlaces y el logo del correo). Sin SMTP_HOST la
// solicitud se guarda igual y los correos solo se escriben en la consola.

import express from "express";

const DIRECTUS =
  process.env.DIRECTUS_URL ?? "https://credimetria-api.valkiriacode.com";
const SITIO = (
  process.env.SITIO_URL ?? "https://credimetria.valkiriacode.com"
).replace(/\/$/, "");

export const PRODUCTOS = {
  libranza: "Libranza",
  "libre-inversion": "Libre inversión",
  vehiculo: "Vehículo",
  vivienda: "Vivienda",
  "vivienda-vis": "Crédito hipotecario VIS",
  "vivienda-no-vis": "Crédito hipotecario No VIS",
  "leasing-vis": "Leasing habitacional VIS",
  "leasing-no-vis": "Leasing habitacional No VIS",
};

const URGENCIAS = { ya: "Ya", mes: "Este mes", tres: "En 3 meses" };

/** Las mismas reglas de la página de aliados (/aliados). */
export const REGLAS = [
  [
    "Nunca cobrar por adelantado.",
    'Ni por estudio, ni por "aprobar" el crédito.',
  ],
  [
    "Usar tus datos solo para ofrecerte crédito.",
    "No los revende ni los comparte.",
  ],
  [
    "Respetar horarios y canales.",
    "Solo por el canal que elegiste, en los horarios de la ley.",
  ],
  ["Demostrar su vínculo con la entidad.", "Con carta o certificado."],
  ["Borrar tus datos si lo pides.", "Te avisamos cuando esté hecho."],
];

const texto = (v, max) =>
  typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

/**
 * Revisa lo que llega del navegador (nunca se confía en él) y devuelve el
 * registro para Directus, o `{ error }` con el campo que no sirve.
 */
export function validarProspecto(cuerpo, ip = null) {
  const c = cuerpo ?? {};
  const producto = c.producto in PRODUCTOS ? c.producto : null;
  if (!producto) return { error: "producto" };
  const monto = c.monto === null || c.monto === undefined ? null : c.monto;
  if (
    monto !== null &&
    !(Number.isInteger(monto) && monto >= 1_000_000 && monto <= 50_000_000_000)
  )
    return { error: "monto" };
  const ciudad = texto(c.ciudad, 80);
  if (!ciudad) return { error: "ciudad" };
  const nombres = texto(c.nombres, 80);
  if (!nombres) return { error: "nombres" };
  const apellidos = texto(c.apellidos, 80);
  if (!apellidos) return { error: "apellidos" };
  const celular = typeof c.celular === "string" ? c.celular : "";
  if (!/^3\d{9}$/.test(celular)) return { error: "celular" };
  const correo = texto(c.correo, 120);
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    return { error: "correo" };
  const canales = {
    whatsapp: c.canales?.whatsapp === true,
    llamada: c.canales?.llamada === true,
    correo: c.canales?.correo === true,
  };
  if (!canales.whatsapp && !canales.llamada && !canales.correo)
    return { error: "canales" };
  const urgencia = c.urgencia in URGENCIAS ? c.urgencia : null;
  const entidad = texto(c.entidad, 80);
  const a = c.autorizacion ?? {};
  const autorizacion = {
    fecha: texto(a.fecha, 40),
    texto: texto(a.texto, 600),
    versionPolitica: texto(a.versionPolitica, 40),
    paginaOrigen: texto(a.paginaOrigen, 300),
  };
  // Sin la prueba de la autorización (Ley 1581) no se guarda.
  if (!autorizacion.texto?.startsWith("Autorizo a Credimetría"))
    return { error: "autorizacion" };
  return {
    prospecto: {
      producto,
      monto,
      ciudad,
      urgencia,
      nombres,
      apellidos,
      celular,
      correo,
      canales,
      entidad,
      autorizacion: {
        ...autorizacion,
        recibida: new Date().toISOString(),
        ip,
      },
      estado: "nuevo",
    },
  };
}

const escapar = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );

const pesos = (n) => "$" + n.toLocaleString("es-CO");

const canalesTexto = (canales) =>
  [
    canales.whatsapp && "WhatsApp",
    canales.llamada && "llamada",
    canales.correo && "correo",
  ]
    .filter(Boolean)
    .join(", ")
    .replace(/, ([^,]*)$/, " o $1");

/**
 * Correo a la persona: un asesor aliado la contactará, qué pidió y las
 * reglas que todo aliado cumple. HTML con tablas y estilos en línea (así lo
 * leen Gmail y Outlook) y su versión en texto.
 */
export function correoCliente(p) {
  const nombre = p.nombres.split(/\s+/)[0];
  const producto = PRODUCTOS[p.producto];
  const canales = canalesTexto(p.canales);
  const resumen = [
    ["Crédito", producto],
    ...(p.monto ? [["Monto", pesos(p.monto)]] : []),
    ["Ciudad", p.ciudad],
    ["Te contactamos por", canales],
  ];
  const azul = "#0b4f8c";
  const tinta = "#1b2733";
  const suave = "#5b6b7b";
  const reglasHtml = REGLAS.map(
    ([titulo, detalle], i) => `
              <tr>
                <td valign="top" style="padding:6px 12px 6px 0;width:26px">
                  <div style="width:24px;height:24px;border-radius:12px;background:${azul};color:#fff;font:bold 13px/24px Arial,sans-serif;text-align:center">${i + 1}</div>
                </td>
                <td style="padding:6px 0;font:14px/1.5 Arial,sans-serif;color:${tinta}"><b>${escapar(titulo)}</b> <span style="color:${suave}">${escapar(detalle)}</span></td>
              </tr>`,
  ).join("");
  const resumenHtml = resumen
    .map(
      ([k, v]) => `
              <tr>
                <td style="padding:4px 16px 4px 0;font:14px Arial,sans-serif;color:${suave};white-space:nowrap">${k}</td>
                <td style="padding:4px 0;font:bold 14px Arial,sans-serif;color:${tinta}">${escapar(v)}</td>
              </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibimos tu solicitud</title></head>
<body style="margin:0;padding:0;background:#eef3f8">
  <div style="display:none;max-height:0;overflow:hidden">Un asesor aliado te contactará por ${escapar(canales)}. Recuerda: nunca te cobran por adelantado.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px 32px;border-bottom:4px solid ${azul}">
          <a href="${SITIO}"><img src="${SITIO}/correo/credimetria.png" width="190" alt="Credimetría" style="display:block;border:0;width:190px;height:auto"></a>
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 12px;font:bold 22px/1.3 Arial,sans-serif;color:${tinta}">Hola, ${escapar(nombre)}: recibimos tu solicitud</h1>
          <p style="margin:0 0 16px;font:15px/1.6 Arial,sans-serif;color:${tinta}">Gracias por confiar en Credimetría. <b>Un asesor de crédito aliado se contactará contigo</b> por ${escapar(canales)}, de lunes a viernes de 7 a.&nbsp;m. a 7 p.&nbsp;m. y sábados de 8 a.&nbsp;m. a 3 p.&nbsp;m. Te contactarán máximo 2 asesores.</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9f1fa;border-radius:10px">
            <tr><td style="padding:16px 20px">
              <div style="font:bold 12px Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${azul};margin-bottom:6px">Lo que pediste</div>
              <table role="presentation" cellpadding="0" cellspacing="0">${resumenHtml}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 4px">
          <h2 style="margin:0 0 8px;font:bold 17px/1.3 Arial,sans-serif;color:${tinta}">Lo que todo asesor aliado se compromete a cumplir</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${reglasHtml}
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4e5;border-left:4px solid #e08a00;border-radius:6px">
            <tr><td style="padding:14px 18px;font:14px/1.5 Arial,sans-serif;color:${tinta}">
              <b>Si alguien te pide dinero para "aprobar" o estudiar tu crédito, es estafa.</b> No pagues nada y cuéntanos en <a href="mailto:reportes@credimetria.co" style="color:${azul}">reportes@credimetria.co</a>. Retiramos de la lista a quien incumpla.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;font:14px/1.6 Arial,sans-serif;color:${tinta}">
          Antes de hablar con el asesor, revisa que esté en la <a href="${SITIO}/aliados" style="color:${azul}">lista de asesores aliados</a>. Mientras tanto puedes <a href="${SITIO}/ranking" style="color:${azul}">comparar las tasas de los bancos</a>.
        </td></tr>
        <tr><td style="padding:20px 32px;background:#0b2a4a;font:12px/1.6 Arial,sans-serif;color:#c9d6e3">
          Recibes este correo porque pediste asesoría en Credimetría y autorizaste el tratamiento de tus datos. Puedes pedir que los borremos cuando quieras respondiendo a este correo. <a href="${SITIO}/politica-de-datos" style="color:#ffffff">Política de tratamiento de datos</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hola, ${nombre}: recibimos tu solicitud`,
    "",
    `Gracias por confiar en Credimetría. Un asesor de crédito aliado se contactará contigo por ${canales}, de lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m. Te contactarán máximo 2 asesores.`,
    "",
    "Lo que pediste:",
    ...resumen.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Lo que todo asesor aliado se compromete a cumplir:",
    ...REGLAS.map(([t, d], i) => `${i + 1}. ${t} ${d}`),
    "",
    'Si alguien te pide dinero para "aprobar" o estudiar tu crédito, es estafa. No pagues nada y cuéntanos en reportes@credimetria.co.',
    "",
    `Lista de asesores aliados: ${SITIO}/aliados`,
    `Política de tratamiento de datos: ${SITIO}/politica-de-datos`,
    "",
    "— Equipo de Credimetría",
  ].join("\n");

  return {
    to: p.correo,
    subject: "Recibimos tu solicitud: un asesor te contactará",
    html,
    text,
  };
}

/** Correo al administrador con todos los datos de la solicitud. */
export function correoAdmin(p) {
  const filas = [
    ["Nombre", `${p.nombres} ${p.apellidos}`],
    ["Celular", p.celular],
    ["Correo", p.correo],
    ["Contactar por", canalesTexto(p.canales)],
    ["Crédito", PRODUCTOS[p.producto]],
    ["Monto", p.monto ? pesos(p.monto) : "No lo dijo"],
    ["Ciudad", p.ciudad],
    ["Urgencia", p.urgencia ? URGENCIAS[p.urgencia] : "No la dijo"],
    ...(p.entidad ? [["Entidad del ranking", p.entidad]] : []),
    ["Desde", p.autorizacion.paginaOrigen ?? "—"],
    ["Autorizó", p.autorizacion.fecha ?? "—"],
  ];
  return {
    to: process.env.AVISO_PARA,
    replyTo: p.correo,
    subject: `Credimetría · Nueva solicitud de asesoría: ${PRODUCTOS[p.producto]}, ${p.ciudad}`,
    text: [
      "Llegó una solicitud de asesoría:",
      "",
      ...filas.map(([k, v]) => `${k}: ${v}`),
      "",
      `Está en Directus, colección prospectos: ${DIRECTUS}/admin/content/prospectos`,
    ].join("\n"),
    html: `<!doctype html><html lang="es"><body style="font:14px/1.5 Arial,sans-serif;color:#1b2733">
<p><b>Llegó una solicitud de asesoría.</b></p>
<table cellpadding="0" cellspacing="0">${filas
      .map(
        ([k, v]) =>
          `<tr><td style="padding:3px 16px 3px 0;color:#5b6b7b">${k}</td><td style="padding:3px 0"><b>${escapar(v)}</b></td></tr>`,
      )
      .join("")}</table>
<p><a href="${DIRECTUS}/admin/content/prospectos">Ver en Directus</a></p>
</body></html>`,
  };
}

/** Guarda el prospecto en Directus. Lanza error si no se pudo. */
export async function guardarEnDirectus(prospecto) {
  const token = process.env.DIRECTUS_TOKEN;
  if (!token) throw new Error("Falta DIRECTUS_TOKEN");
  const r = await fetch(`${DIRECTUS}/items/prospectos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prospecto),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const detalle = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(`Directus ${r.status} al guardar el prospecto: ${detalle}`);
  }
}

/** Manda un correo. Nunca lanza error: si falla, queda en la consola. */
export async function mandarCorreo(correo) {
  const { SMTP_HOST, SMTP_USUARIO, SMTP_CLAVE } = process.env;
  if (!SMTP_HOST || !correo.to) {
    console.log(`CORREO (sin SMTP) a ${correo.to ?? "—"}: ${correo.subject}`);
    return;
  }
  try {
    const { createTransport } = await import("nodemailer");
    const puerto = Number(process.env.SMTP_PUERTO ?? 465);
    await createTransport({
      host: SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: SMTP_USUARIO ? { user: SMTP_USUARIO, pass: SMTP_CLAVE } : undefined,
    }).sendMail({
      from:
        process.env.CORREO_DE ??
        `Credimetría <${process.env.AVISO_DE ?? SMTP_USUARIO}>`,
      ...correo,
    });
  } catch (error) {
    console.error(`No se pudo mandar "${correo.subject}":`, error.message);
  }
}

/** Máximo de solicitudes por IP en la ventana (contra el spam). */
const LIMITE = 5;
const VENTANA_MS = 60 * 60 * 1000;

/**
 * POST /api/prospectos. `guardar` y `mandar` se pueden cambiar en las
 * pruebas. Responde apenas se guarda; los correos salen después.
 */
export function rutasProspectos(
  app,
  { guardar = guardarEnDirectus, mandar = mandarCorreo } = {},
) {
  const intentos = new Map(); // ip → [marcas de tiempo]
  app.post(
    "/api/prospectos",
    express.json({ limit: "10kb" }),
    async (req, res) => {
      res.set("Cache-Control", "no-store");
      // Detrás de Cloudflare y Traefik la IP real llega en estos encabezados.
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
      const { prospecto, error } = validarProspecto(req.body, ip);
      if (error) return res.status(400).json({ error, campo: error });
      recientes.push(ahora);
      intentos.set(ip, recientes);
      try {
        await guardar(prospecto);
      } catch (e) {
        console.error("No se pudo guardar el prospecto:", e.message);
        return res
          .status(503)
          .json({ error: "No pudimos guardar tu solicitud." });
      }
      res.status(201).json({ ok: true });
      await Promise.all([
        mandar(correoCliente(prospecto)),
        mandar(correoAdmin(prospecto)),
      ]);
    },
  );
}
