// Bajar un PDF, sacar su huella y su texto; texto de una página web.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// Algunos bancos no responden a programas: se pide como un navegador.
const NAVEGADOR = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
};

/** Página HTML (para buscar el enlace al PDF en un índice). */
export async function pagina(url) {
  const r = await fetch(url, {
    headers: NAVEGADOR,
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`la página respondió ${r.status}`);
  return r.text();
}

/** El PDF como Buffer, o un error que dice por qué no se pudo. */
export async function bajarPdf(url) {
  const r = await fetch(url, {
    headers: { ...NAVEGADOR, Accept: "application/pdf,*/*" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) throw new Error(`respondió ${r.status}`);
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.subarray(0, 5).toString() !== "%PDF-")
    throw new Error(
      `no es un PDF (llegó ${r.headers.get("content-type") ?? "otra cosa"})`,
    );
  return datos;
}

export const huella = (datos) =>
  createHash("sha256").update(datos).digest("hex");

/** Texto del PDF con `pdftotext -layout` (paquete poppler-utils), siempre en UTF-8 (en Windows sale en otra codificación si no se pide). */
export async function textoPdf(datos) {
  const carpeta = await mkdtemp(join(tmpdir(), "robot-pdf-"));
  try {
    const archivo = join(carpeta, "tasas.pdf");
    await writeFile(archivo, datos);
    const { stdout } = await promisify(execFile)(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", archivo, "-"],
      { maxBuffer: 50 * 1024 * 1024 },
    );
    return stdout;
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

const ENTIDADES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Texto visible de una página HTML: sin scripts, estilos ni etiquetas. */
export function textoHtml(html) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (todo, e) => {
      if (e[0] === "#")
        return String.fromCodePoint(
          e[1] === "x" || e[1] === "X"
            ? parseInt(e.slice(2), 16)
            : Number(e.slice(1)),
        );
      return ENTIDADES[e.toLowerCase()] ?? todo;
    })
    .replace(/\s+/g, " ")
    .trim();
}
