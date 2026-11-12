import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import {
  asesorPublico,
  correoReporteAdmin,
  rutasAsesores,
  validarReporte,
} from "../asesores.mjs";

const ALEXANDRA = {
  id: "alexandra-rojas-garcia",
  nombre: "Alexandra Rojas García",
  empresa: "Fuerza de ventas",
  verificado: true,
  entidades: ["BBVA"],
  productos: ["Libranza"],
  ciudades: ["Cali"],
  foto: "/api/asesores/alexandra-rojas-garcia/foto",
};

const valido = () => ({
  asesor: "alexandra-rojas-garcia",
  asesorNombre: null,
  motivo: "cobro_adelantado",
  descripcion: "Me pidió 200.000 pesos para aprobar el crédito.",
  fechaContacto: "2026-11-10",
  nombre: "Ana Gómez",
  correo: "ana@ejemplo.com",
  celular: "3001234567",
  autorizacion: {
    fecha: "2026-11-12T12:00:00.000Z",
    texto: "Autorizo a Credimetría a tratar los datos de este reporte…",
    versionPolitica: "2026-11-12",
    paginaOrigen: "/aliados/reportar",
  },
  turnstileToken: "token-bueno",
});

test("de Directus a la página solo pasan los datos públicos y la foto por /api", () => {
  const a = asesorPublico({
    id: "x",
    nombre: "X",
    empresa: null,
    verificado: true,
    entidades: ["BBVA", 3, ""],
    productos: null,
    ciudades: ["Cali"],
    foto: "uuid-archivo",
    cedula: "123",
    celular: "300",
  });
  assert.deepEqual(a, {
    id: "x",
    nombre: "X",
    empresa: "",
    verificado: true,
    entidades: ["BBVA"],
    productos: [],
    ciudades: ["Cali"],
    foto: "/api/asesores/x/foto?v=uuid-arc",
  });
});

test("valida el reporte y le pone la IP; el token no se guarda", () => {
  const { reporte, error } = validarReporte(valido(), "1.2.3.4", [
    "alexandra-rojas-garcia",
  ]);
  assert.equal(error, undefined);
  assert.equal(reporte.asesor, "alexandra-rojas-garcia");
  assert.equal(reporte.asesor_nombre, null);
  assert.equal(reporte.autorizacion.ip, "1.2.3.4");
  assert.equal("turnstileToken" in reporte, false);
});

test("un asesor que no está publicado se guarda por el nombre escrito", () => {
  const { reporte } = validarReporte(
    { ...valido(), asesor: "otro", asesorNombre: "Juan Pérez" },
    null,
    ["alexandra-rojas-garcia"],
  );
  assert.equal(reporte.asesor, null);
  assert.equal(reporte.asesor_nombre, "Juan Pérez");
});

test("rechaza lo que no sirve", () => {
  const ids = ["alexandra-rojas-garcia"];
  const casos = [
    [{ asesor: "nadie", asesorNombre: null }, "asesor"],
    [{ motivo: "aburrido" }, "motivo"],
    [{ descripcion: "corto" }, "descripcion"],
    [{ nombre: " " }, "nombre"],
    [{ correo: "sin-arroba" }, "correo"],
    [{ celular: "123" }, "celular"],
    [{ autorizacion: {} }, "autorizacion"],
  ];
  for (const [cambio, campo] of casos) {
    assert.equal(
      validarReporte({ ...valido(), ...cambio }, null, ids).error,
      campo,
    );
  }
});

test("el aviso al administrador trae el asesor, el motivo y escapa el texto", () => {
  process.env.AVISO_PARA = "admin@ejemplo.com";
  const { reporte } = validarReporte(
    { ...valido(), descripcion: "<script>x</script> me pidió plata" },
    null,
    ["alexandra-rojas-garcia"],
  );
  const c = correoReporteAdmin(reporte, "Alexandra Rojas García");
  assert.equal(c.to, "admin@ejemplo.com");
  assert.equal(c.replyTo, "ana@ejemplo.com");
  assert.match(
    c.subject,
    /Alexandra Rojas García \(Me pidió dinero por adelantado\)/,
  );
  assert.doesNotMatch(c.html, /<script>/);
});

async function servidor(opciones) {
  const app = express();
  rutasAsesores(app, {
    leerAsesores: async () => [ALEXANDRA],
    foto: async (id) =>
      id === ALEXANDRA.id
        ? { datos: Buffer.from("img"), tipo: "image/webp" }
        : null,
    verificar: async (t) => t === "token-bueno",
    ...opciones,
  });
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  const base = `http://127.0.0.1:${s.address().port}`;
  const post = (cuerpo, ip = "9.9.9.9") =>
    fetch(`${base}/api/reportes-asesores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify(cuerpo),
    });
  return { base, post, cerrar: () => s.close() };
}

test("GET /api/asesores y la foto", async () => {
  const { base, cerrar } = await servidor({});
  try {
    const r = await fetch(`${base}/api/asesores`);
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).asesores, [ALEXANDRA]);
    const f = await fetch(`${base}/api/asesores/alexandra-rojas-garcia/foto`);
    assert.equal(f.status, 200);
    assert.equal(f.headers.get("content-type"), "image/webp");
    assert.equal((await fetch(`${base}/api/asesores/nadie/foto`)).status, 404);
  } finally {
    cerrar();
  }
});

test("si Directus falla, /api/asesores responde 503", async () => {
  const { base, cerrar } = await servidor({
    leerAsesores: async () => {
      throw new Error("caído");
    },
  });
  try {
    assert.equal((await fetch(`${base}/api/asesores`)).status, 503);
  } finally {
    cerrar();
  }
});

test("POST de un reporte: sin Turnstile 400; válido se guarda y manda los 2 correos", async () => {
  const guardados = [];
  const correos = [];
  const { post, cerrar } = await servidor({
    guardar: async (r) => guardados.push(r),
    mandar: async (c) => correos.push(c),
  });
  try {
    const malo = await post({ ...valido(), turnstileToken: "x" }, "7.7.7.1");
    assert.equal(malo.status, 400);
    assert.equal((await malo.json()).error, "verificacion");
    assert.equal(guardados.length, 0);
    const r = await post(valido(), "7.7.7.2");
    assert.equal(r.status, 201);
    await new Promise((x) => setTimeout(x, 20));
    assert.equal(guardados.length, 1);
    assert.equal(guardados[0].autorizacion.ip, "7.7.7.2");
    assert.equal(correos.length, 2);
    assert.match(correos[0].subject, /Reporte contra asesor/);
    assert.equal(correos[1].to, "ana@ejemplo.com");
  } finally {
    cerrar();
  }
});

test("limita los reportes por IP", async () => {
  const { post, cerrar } = await servidor({
    guardar: async () => {},
    mandar: async () => {},
  });
  try {
    for (let i = 0; i < 5; i++)
      assert.equal((await post(valido(), "8.8.8.8")).status, 201);
    assert.equal((await post(valido(), "8.8.8.8")).status, 429);
  } finally {
    cerrar();
  }
});

import {
  correoSolicitudAdmin,
  rutasSolicitudesAliados,
  validarSolicitudAliado,
} from "../asesores.mjs";

const solicitud = () => ({
  nombre: "Carlos Pérez",
  cedula: "1.020.304.050",
  celular: "3109876543",
  correo: "carlos@ejemplo.com",
  ciudad: "Cali",
  tipo: "fuerza_ventas",
  empresa: "Asesores SAS",
  entidades: ["BBVA", "BBVA", " Davivienda "],
  productos: ["Libranza"],
  ciudades: ["Cali", "Palmira"],
  experiencia: 5,
  vinculo: "carta",
  mensaje: "Trabajo con pensionados.",
  aceptaReglas: true,
  autorizacion: {
    fecha: "2026-11-12T12:00:00.000Z",
    texto: "Autorizo a Credimetría a tratar mis datos para estudiar…",
    versionPolitica: "2026-11-12",
    paginaOrigen: "/aliados/quiero-ser-aliado",
  },
  turnstileToken: "token-bueno",
});

test("valida la solicitud de aliado, limpia las listas y no guarda el token", () => {
  const { solicitud: s, error } = validarSolicitudAliado(
    solicitud(),
    "1.2.3.4",
  );
  assert.equal(error, undefined);
  assert.equal(s.cedula, "1020304050");
  assert.deepEqual(s.entidades, ["BBVA", "Davivienda"]);
  assert.equal(s.acepta_reglas, true);
  assert.equal(s.autorizacion.ip, "1.2.3.4");
  assert.equal("turnstileToken" in s, false);
});

test("rechaza la solicitud de aliado incompleta", () => {
  const casos = [
    [{ nombre: "" }, "nombre"],
    [{ cedula: "12" }, "cedula"],
    [{ celular: "6011234567" }, "celular"],
    [{ correo: "x" }, "correo"],
    [{ tipo: "jefe" }, "tipo"],
    [{ entidades: [] }, "entidades"],
    [{ productos: [] }, "productos"],
    [{ ciudades: [] }, "ciudades"],
    [{ experiencia: -1 }, "experiencia"],
    [{ vinculo: "palabra" }, "vinculo"],
    [{ aceptaReglas: false }, "reglas"],
    [{ autorizacion: {} }, "autorizacion"],
  ];
  for (const [cambio, campo] of casos) {
    assert.equal(
      validarSolicitudAliado({ ...solicitud(), ...cambio }).error,
      campo,
    );
  }
});

test("el aviso de la solicitud trae toda la información del asesor", () => {
  process.env.AVISO_PARA = "admin@ejemplo.com";
  const { solicitud: s } = validarSolicitudAliado(solicitud());
  const c = correoSolicitudAdmin(s);
  assert.equal(c.to, "admin@ejemplo.com");
  assert.equal(c.replyTo, "carlos@ejemplo.com");
  assert.match(
    c.subject,
    /Quiere ser aliado: Carlos Pérez \(Fuerza de ventas\)/,
  );
  for (const t of [
    "1020304050",
    "3109876543",
    "BBVA, Davivienda",
    "Cali, Palmira",
    "5 años",
    "Carta de la entidad",
  ])
    assert.match(c.text, new RegExp(t));
});

test("POST /api/solicitudes-aliados: sin Turnstile 400; válida se guarda y manda 2 correos", async () => {
  const guardadas = [];
  const correos = [];
  const app = express();
  rutasSolicitudesAliados(app, {
    guardar: async (s) => guardadas.push(s),
    mandar: async (c) => correos.push(c),
    verificar: async (t) => t === "token-bueno",
  });
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const url = `http://127.0.0.1:${srv.address().port}/api/solicitudes-aliados`;
  const post = (cuerpo) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  try {
    assert.equal(
      (await post({ ...solicitud(), turnstileToken: "x" })).status,
      400,
    );
    assert.equal(guardadas.length, 0);
    assert.equal((await post(solicitud())).status, 201);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(guardadas.length, 1);
    assert.equal(correos.length, 2);
    assert.equal(correos[1].to, "carlos@ejemplo.com");
  } finally {
    srv.close();
  }
});
