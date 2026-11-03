import assert from "node:assert/strict";
import { test } from "node:test";
import { leerEnv } from "../env.mjs";

const contenido =
  'DIRECTUS_TOKEN=abc\nSMTP_CLAVE="ab cd"\n# AVISO_PARA=x\nCORREO_DE=Credimetría <hola@credimetria.co>\n';

test("lee un .env normal, con comillas y comentarios", () => {
  const v = leerEnv(Buffer.from(contenido));
  assert.equal(v.DIRECTUS_TOKEN, "abc");
  assert.equal(v.SMTP_CLAVE, "ab cd");
  assert.equal(v.AVISO_PARA, undefined);
  assert.equal(v.CORREO_DE, "Credimetría <hola@credimetria.co>");
});

test("aguanta los .env de Windows: BOM, UTF-16 y \\r\\n", () => {
  const conBom = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(contenido),
  ]);
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(contenido, "utf16le"),
  ]);
  const crlf = Buffer.from(contenido.replace(/\n/g, "\r\n"));
  for (const datos of [conBom, utf16, crlf]) {
    const v = leerEnv(datos);
    assert.equal(v.DIRECTUS_TOKEN, "abc");
    assert.equal(v.CORREO_DE, "Credimetría <hola@credimetria.co>");
  }
});

test("los espacios alrededor del = no importan", () => {
  assert.equal(
    leerEnv(Buffer.from("DIRECTUS_TOKEN = abc \n")).DIRECTUS_TOKEN,
    "abc",
  );
});
