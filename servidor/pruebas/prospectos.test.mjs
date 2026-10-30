import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import {
  correoAdmin,
  correoCliente,
  rutasProspectos,
  validarProspecto,
} from "../prospectos.mjs";

const valido = () => ({
  producto: "libre-inversion",
  monto: 20_000_000,
  ciudad: "Medellín",
  urgencia: "mes",
  nombres: "Ana María",
  apellidos: "Gómez Rojas",
  celular: "3001234567",
  correo: "ana@ejemplo.com",
  canales: { whatsapp: true, llamada: false, correo: true },
  entidad: null,
  autorizacion: {
    fecha: "2026-10-30T12:00:00.000Z",
    texto: "Autorizo a Credimetría a compartir mis datos…",
    versionPolitica: "2026-10-borrador",
    paginaOrigen: "/asesoria",
  },
});

test("acepta una solicitud completa y le pone la IP y el estado", () => {
  const { prospecto, error } = validarProspecto(valido(), "1.2.3.4");
  assert.equal(error, undefined);
  assert.equal(prospecto.autorizacion.ip, "1.2.3.4");
  assert.equal(prospecto.estado, "nuevo");
  assert.equal(prospecto.nombres, "Ana María");
});

test("rechaza lo que no sirve", () => {
  const casos = [
    [{ producto: "compra-cartera" }, "producto"],
    [{ monto: 500_000 }, "monto"],
    [{ ciudad: "  " }, "ciudad"],
    [{ celular: "6011234567" }, "celular"],
    [{ correo: "sin-arroba" }, "correo"],
    [{ correo: null }, "correo"],
    [{ canales: { whatsapp: false } }, "canales"],
    [{ autorizacion: {} }, "autorizacion"],
  ];
  for (const [cambio, campo] of casos) {
    assert.equal(validarProspecto({ ...valido(), ...cambio }).error, campo);
  }
  assert.equal(validarProspecto(null).error, "producto");
});

test("el correo a la persona dice que un asesor la contactará y trae las reglas", () => {
  const { prospecto } = validarProspecto(valido());
  const c = correoCliente(prospecto);
  assert.equal(c.to, "ana@ejemplo.com");
  assert.match(c.html, /Hola, Ana: recibimos tu solicitud/);
  assert.match(c.html, /Un asesor de crédito aliado se contactará contigo/);
  assert.match(c.html, /Nunca cobrar por adelantado/);
  assert.match(c.html, /\$20\.000\.000/);
  assert.match(c.text, /WhatsApp o correo/);
  assert.match(c.text, /5\. Borrar tus datos si lo pides/);
});

test("el correo escapa lo que escribe la persona", () => {
  const { prospecto } = validarProspecto({
    ...valido(),
    nombres: "<script>x</script>",
  });
  assert.doesNotMatch(correoCliente(prospecto).html, /<script>/);
  assert.doesNotMatch(correoAdmin(prospecto).html, /<script>/);
});

test("el correo al administrador trae los datos de contacto", () => {
  process.env.AVISO_PARA = "admin@ejemplo.com";
  const { prospecto } = validarProspecto(valido());
  const c = correoAdmin(prospecto);
  assert.equal(c.to, "admin@ejemplo.com");
  assert.equal(c.replyTo, "ana@ejemplo.com");
  assert.match(c.subject, /Libre inversión, Medellín/);
  assert.match(c.text, /Celular: 3001234567/);
});

async function servidor(opciones) {
  const app = express();
  rutasProspectos(app, opciones);
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  const url = `http://127.0.0.1:${s.address().port}/api/prospectos`;
  const post = (cuerpo, ip = "9.9.9.9") =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify(cuerpo),
    });
  return { post, cerrar: () => s.close() };
}

test("POST guarda, responde 201 y manda los dos correos", async () => {
  const guardados = [];
  const correos = [];
  const { post, cerrar } = await servidor({
    guardar: async (p) => guardados.push(p),
    mandar: async (c) => correos.push(c),
  });
  try {
    const r = await post(valido());
    assert.equal(r.status, 201);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(guardados.length, 1);
    assert.equal(guardados[0].autorizacion.ip, "9.9.9.9");
    assert.equal(correos.length, 2);
  } finally {
    cerrar();
  }
});

test("si Directus falla responde 503 y no manda correos", async () => {
  const correos = [];
  const { post, cerrar } = await servidor({
    guardar: async () => {
      throw new Error("caído");
    },
    mandar: async (c) => correos.push(c),
  });
  try {
    assert.equal((await post(valido())).status, 503);
    assert.equal(correos.length, 0);
  } finally {
    cerrar();
  }
});

test("rechaza datos malos con 400 y limita las solicitudes por IP", async () => {
  const { post, cerrar } = await servidor({
    guardar: async () => {},
    mandar: async () => {},
  });
  try {
    const malo = await post({ ...valido(), celular: "123" });
    assert.equal(malo.status, 400);
    assert.equal((await malo.json()).campo, "celular");
    for (let i = 0; i < 5; i++)
      assert.equal((await post(valido(), "5.5.5.5")).status, 201);
    assert.equal((await post(valido(), "5.5.5.5")).status, 429);
    assert.equal((await post(valido(), "6.6.6.6")).status, 201);
  } finally {
    cerrar();
  }
});
