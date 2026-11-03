// Lee el archivo .env de la carpeta del proyecto (solo en desarrollo; en
// Coolify no hay .env y se usan las variables del recurso). Aguanta los
// .env que guardan algunos editores de Windows: con BOM, en UTF-16 o con
// fin de línea \r\n. No pisa las variables que ya vienen del sistema.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Convierte el contenido del .env en variables (sin tocar `process.env`). */
export function leerEnv(datos) {
  let texto;
  if (datos[0] === 0xff && datos[1] === 0xfe) {
    texto = datos.subarray(2).toString("utf16le");
  } else if (datos[0] === 0xfe && datos[1] === 0xff) {
    // UTF-16 big endian: se voltean los bytes de cada carácter.
    texto = Buffer.from(datos.subarray(2)).swap16().toString("utf16le");
  } else {
    texto = datos.toString("utf8");
  }
  const variables = {};
  for (const linea of texto.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = linea.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!m) continue;
    let valor = m[2].trim();
    const comilla = valor[0];
    if (
      (comilla === '"' || comilla === "'") &&
      valor.endsWith(comilla) &&
      valor.length > 1
    ) {
      valor = valor.slice(1, -1);
    } else {
      valor = valor.replace(/\s+#.*$/, "");
    }
    variables[m[1]] = valor;
  }
  return variables;
}

/** Carga el .env si existe. Devuelve la ruta leída, o `null` si no hay. */
export function cargarEnv(ruta = resolve(".env")) {
  let datos;
  try {
    datos = readFileSync(ruta);
  } catch {
    return null;
  }
  for (const [clave, valor] of Object.entries(leerEnv(datos))) {
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
  return ruta;
}
