import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import {
  correoAdmin,
  correoCliente,
  rutasProspectos,
  validarProspecto,
  verificarTurnstile,
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
  turnstileToken: "token-bueno",
});

/**
 * siteverify de mentiras: "token-bueno" pasa desde credimetria.com,
 * "token-otro-sitio" pasa pero desde otro dominio y lo demás falla. Guarda
 * lo que se le pidió.
 */
function siteverifyFalso(pedidos = []) {
  return async (url, opciones) => {
    const cuerpo = new URLSearchParams(opciones.body);
    pedidos.push({ url, cuerpo });
    const token = cuerpo.get("response");
    const respuesta =
      token === "token-bueno"
        ? { success: true, hostname: "credimetria.com" }
        : token === "token-otro-sitio"
          ? { success: true, hostname: "otro.com" }
          : { success: false, "error-codes": ["invalid-input-response"] };
    return new Response(JSON.stringify(respuesta));
  };
}

const verificarFalso = (pedidos) => (token, ip) =>
  verificarTurnstile(token, ip, {
    secreto: "secreto-de-prueba",
    pedir: siteverifyFalso(pedidos),
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
  rutasProspectos(app, { verificar: verificarFalso(), ...opciones });
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

test("verificarTurnstile manda la clave, el token y la IP a siteverify", async () => {
  const pedidos = [];
  assert.equal(
    await verificarTurnstile("token-bueno", "1.2.3.4", {
      secreto: "s3cr3to",
      pedir: siteverifyFalso(pedidos),
    }),
    true,
  );
  assert.equal(
    pedidos[0].url,
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  );
  assert.equal(pedidos[0].cuerpo.get("secret"), "s3cr3to");
  assert.equal(pedidos[0].cuerpo.get("response"), "token-bueno");
  assert.equal(pedidos[0].cuerpo.get("remoteip"), "1.2.3.4");
});

test("verificarTurnstile rechaza sin token, sin clave, con otro dominio, si falla o si no responde", async () => {
  const pedir = siteverifyFalso();
  const v = (token, opciones = {}) =>
    verificarTurnstile(token, "1.2.3.4", {
      secreto: "s3cr3to",
      pedir,
      ...opciones,
    });
  assert.equal(await v(undefined), false);
  assert.equal(await v(""), false);
  assert.equal(await v("token-bueno", { secreto: "" }), false);
  assert.equal(await v("token-malo"), false);
  assert.equal(await v("token-otro-sitio"), false);
  assert.equal(
    await v("token-bueno", {
      pedir: async () => {
        throw new DOMException("tiempo agotado", "TimeoutError");
      },
    }),
    false,
  );
  assert.equal(
    await v("token-bueno", { pedir: async () => new Response("<html>") }),
    false,
  );
});

test("con la clave de prueba de Cloudflare acepta el dominio example.com", async () => {
  const pedir = async () =>
    new Response(JSON.stringify({ success: true, hostname: "example.com" }));
  assert.equal(
    await verificarTurnstile("XXXX.DUMMY.TOKEN.XXXX", null, {
      secreto: "1x0000000000000000000000000000000AA",
      pedir,
    }),
    true,
  );
  assert.equal(
    await verificarTurnstile("XXXX.DUMMY.TOKEN.XXXX", null, {
      secreto: "s3cr3to",
      pedir,
    }),
    false,
  );
});

test("POST sin token responde 400 y no guarda", async () => {
  const guardados = [];
  const { post, cerrar } = await servidor({
    guardar: async (p) => guardados.push(p),
    mandar: async () => {},
  });
  try {
    const { turnstileToken: _, ...sinToken } = valido();
    const r = await post(sinToken, "7.7.7.1");
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "verificacion");
    assert.equal(guardados.length, 0);
  } finally {
    cerrar();
  }
});

test("POST con token inválido responde 400 y no guarda", async () => {
  const guardados = [];
  const { post, cerrar } = await servidor({
    guardar: async (p) => guardados.push(p),
    mandar: async () => {},
  });
  try {
    const r = await post(
      { ...valido(), turnstileToken: "token-malo" },
      "7.7.7.2",
    );
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "verificacion");
    assert.equal(guardados.length, 0);
  } finally {
    cerrar();
  }
});

test("POST con token válido guarda el prospecto sin el token", async () => {
  const guardados = [];
  const pedidos = [];
  const { post, cerrar } = await servidor({
    guardar: async (p) => guardados.push(p),
    mandar: async () => {},
    verificar: verificarFalso(pedidos),
  });
  try {
    const r = await post(valido(), "7.7.7.3");
    assert.equal(r.status, 201);
    assert.equal(guardados.length, 1);
    assert.equal(pedidos[0].cuerpo.get("remoteip"), "7.7.7.3");
    assert.equal(JSON.stringify(guardados[0]).includes("token-bueno"), false);
    assert.equal("turnstileToken" in guardados[0], false);
  } finally {
    cerrar();
  }
});

test("el límite por IP también cuenta los intentos con token inválido", async () => {
  const { post, cerrar } = await servidor({
    guardar: async () => {},
    mandar: async () => {},
  });
  try {
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await post({ ...valido(), turnstileToken: "x" }, "8.8.8.8")).status,
        400,
      );
    assert.equal((await post(valido(), "8.8.8.8")).status, 429);
  } finally {
    cerrar();
  }
});
