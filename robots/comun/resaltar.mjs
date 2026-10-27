// Copia del PDF con las cifras de la tasa resaltadas en verde, para ver de
// una dónde está en el documento. El original no se toca (es la prueba y su
// huella dice si el banco lo cambió).

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { BlendMode, PDFDocument, rgb } from "pdf-lib";

/** Dónde empieza cada producto en un PDF con varios. */
const ANCLAS = {
  "libre-inversion": /libre\s*(inversi|destino)/i,
  libranza: /libranza/i,
};

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Palabras del PDF con su caja, en orden de lectura (`pdftotext
 * -bbox-layout`): { pagina, x0, y0, x1, y1, texto, linea }. La caja va desde
 * arriba a la izquierda, en puntos, como la mide poppler.
 */
export function palabrasDe(xhtml) {
  const palabras = [];
  let pagina = -1;
  let linea = 0;
  const marca =
    /<page\b|<\/line>|<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  for (const m of xhtml.matchAll(marca)) {
    if (m[0] === "<page") pagina++;
    else if (m[0] === "</line>") linea++;
    else
      palabras.push({
        pagina,
        x0: +m[1],
        y0: +m[2],
        x1: +m[3],
        y1: +m[4],
        texto: m[5].replace(/&(\w+);/g, (t, e) => ENTIDADES[e] ?? t),
        linea,
      });
  }
  return palabras;
}

/** "13.14%", "1,03%" o "19,3" (seguido de "%") → número; si no, null. */
function porcentaje(palabras, i) {
  const t = palabras[i].texto;
  const conSigno = /%/.test(t) || palabras[i + 1]?.texto.startsWith("%");
  const m = t.match(/\d{1,2}(?:[.,]\d+)?/);
  if (!conSigno || !m) return null;
  return Number(m[0].replace(",", "."));
}

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Índices de las palabras de la fecha (ISO) en el PDF, la más cercana a `cerca`. */
function fecha(palabras, iso, cerca) {
  if (!iso) return [];
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dia = (t) => new RegExp(`^0?${d}(o|°|º)?[.,:]?$`, "i").test(t);
  const mes = (t) =>
    t
      .toLowerCase()
      .replace(/[^a-záéíóú]/g, "")
      .startsWith(MESES[m - 1]) ||
    (t.toLowerCase().startsWith("set") && m === 9);
  const año = (t) => t.includes(String(a));
  const numerica = new RegExp(
    `^0?${d}[/-](0?${m}|${MESES[m - 1]})[a-z]*[/-](${a}|${a % 100})`,
    "i",
  );
  const halladas = [];
  palabras.forEach((p, i) => {
    if (numerica.test(p.texto.replace(/^\D+/, ""))) halladas.push([i, i]);
    else if (dia(p.texto)) {
      // "1 de octubre de 2026", "01 al 31 de octubre 2026"
      const tras = palabras.slice(i + 1, i + 8);
      const im = tras.findIndex((x) => mes(x.texto));
      const ia = tras.findIndex((x) => año(x.texto));
      if (im >= 0 && ia > im) halladas.push([i, i + 1 + ia]);
    } else if (mes(p.texto)) {
      // "Octubre 05 de 2026"
      const tras = palabras.slice(i + 1, i + 5);
      const id = tras.findIndex((x) => dia(x.texto));
      const ia = tras.findIndex((x) => año(x.texto));
      if (id >= 0 && ia > id) halladas.push([i, i + 1 + ia]);
    }
  });
  if (!halladas.length) return [];
  // La más cercana, primero en la misma página.
  const lejos = ([i]) =>
    Math.abs(palabras[i].pagina - palabras[cerca].pagina) * 1e6 +
    Math.abs(i - cerca);
  const [ini, fin] = halladas.reduce((mejor, h) =>
    lejos(h) < lejos(mejor) ? h : mejor,
  );
  // Con las palabras de antes que la anuncian ("Vigente a partir del").
  let desde = ini;
  while (
    desde > 0 &&
    ini - desde < 5 &&
    palabras[desde - 1].linea === palabras[ini].linea &&
    /vigen|partir|desde|^(a|al|del|de|el|la):?$/i.test(
      palabras[desde - 1].texto,
    )
  )
    desde--;
  return Array.from({ length: fin - desde + 1 }, (_, k) => desde + k);
}

/** Distancia entre dos palabras en la página (otra página: lejísimos). */
function distancia(a, b) {
  if (a.pagina !== b.pagina) return Infinity;
  return Math.hypot(
    (a.x0 + a.x1 - b.x0 - b.x1) / 2,
    (a.y0 + a.y1 - b.y0 - b.y1) / 2,
  );
}

/**
 * Índices del título del producto ("Crédito de Libranza", o el de la fila)
 * que va encima o a la izquierda de las cifras (la celda de la fila puede
 * quedar un poco más abajo si ocupa varias filas): en un PDF con varios
 * productos dice de cuál salió la tasa.
 */
function titulo(palabras, ancla, anclas, grupo) {
  const cifras = grupo.map((i) => palabras[i]);
  const arriba = Math.min(...cifras.map((p) => p.y0));
  const abajo = Math.max(...cifras.map((p) => p.y1));
  const izquierda = Math.min(...cifras.map((p) => p.x0));
  const lejos = (i) => {
    const p = palabras[i];
    if (p.pagina !== cifras[0].pagina || p.y0 > abajo + 12) return Infinity;
    // Mejor el de arriba o el del mismo renglón; el de abajo solo si no hay.
    const debajo = p.y0 > arriba + 2 ? 1000 : 0;
    return (
      debajo + Math.max(0, arriba - p.y1) + Math.abs(p.x0 - izquierda) * 0.3
    );
  };
  const a = anclas.reduce(
    (mejor, i) => (mejor === undefined || lejos(i) < lejos(mejor) ? i : mejor),
    undefined,
  );
  if (a === undefined || lejos(a) === Infinity) return [];
  const linea = palabras
    .map((p, i) => (p.linea === palabras[a].linea ? i : -1))
    .filter((i) => i >= 0);
  if (linea.length <= 8) {
    // El nombre de la fila puede venir partido en dos líneas del PDF
    // ("Libranzas Pensionados" + "Libranza hasta $49MM"): se suman las
    // palabras del mismo renglón pegadas a él (no las de otras columnas).
    const y = palabras[a].y0;
    const juntas = new Set(linea);
    let x0 = Math.min(...linea.map((i) => palabras[i].x0));
    let x1 = Math.max(...linea.map((i) => palabras[i].x1));
    for (let cambio = true; cambio; ) {
      cambio = false;
      palabras.forEach((p, i) => {
        if (
          !juntas.has(i) &&
          p.pagina === palabras[a].pagina &&
          Math.abs(p.y0 - y) < 3 &&
          p.x1 > x0 - 15 &&
          p.x0 < x1 + 15
        ) {
          juntas.add(i);
          x0 = Math.min(x0, p.x0);
          x1 = Math.max(x1, p.x1);
          cambio = true;
        }
      });
    }
    return [...juntas];
  }
  // Línea larga: solo las palabras que nombran el producto.
  for (const k of linea)
    for (let n = 1; n <= 3; n++) {
      const trozo = linea.filter((i) => i >= k && i < k + n);
      if (ancla.test(trozo.map((i) => palabras[i].texto).join(" ")))
        return trozo;
    }
  return [];
}

/**
 * Qué palabras resaltar: las cifras de la tasa (desde y hasta, M.V. y E.A.)
 * donde aparecen juntas en la página (si un valor se repite, el grupo más
 * compacto y, si empatan, el que va después del título del producto), el
 * título del producto y la fecha de la vigencia más cercana.
 */
export function aResaltar(palabras, cifras, ancla, vigencia) {
  const lineas = new Map();
  for (const p of palabras)
    lineas.set(p.linea, `${lineas.get(p.linea) ?? ""} ${p.texto}`);
  const anclas = palabras
    .map((p, i) => (ancla?.test(lineas.get(p.linea)) ? i : -1))
    .filter((i) => i >= 0);
  const valores = [
    ...new Set(cifras.filter((c) => c !== null && c !== undefined).map(Number)),
  ];
  // Dónde aparece cada valor. Hasta 0,0051 de diferencia: "2,12 %" en el
  // PDF y 2,1176 guardado.
  const donde = valores.map((v) =>
    palabras
      .map((p, i) => {
        const n = porcentaje(palabras, i);
        return n !== null && Math.abs(n - v) < 0.0051 ? i : -1;
      })
      .filter((i) => i >= 0),
  );
  let mejor = null;
  for (const semilla of donde.flat()) {
    const s = palabras[semilla];
    const grupo = donde
      .map((lista) =>
        lista.reduce(
          (c, i) =>
            c === undefined ||
            distancia(palabras[i], s) < distancia(palabras[c], s)
              ? i
              : c,
          undefined,
        ),
      )
      .filter((i) => i !== undefined && distancia(palabras[i], s) < Infinity);
    const cajas = grupo.map((i) => palabras[i]);
    const tamaño =
      Math.max(...cajas.map((p) => p.x1)) -
      Math.min(...cajas.map((p) => p.x0)) +
      Math.max(...cajas.map((p) => p.y1)) -
      Math.min(...cajas.map((p) => p.y0));
    const ini = Math.min(...grupo);
    const conAncla = anclas.some((a) => a <= ini && ini - a < 300);
    const puntos = grupo.length * 1e7 + (conAncla ? 1e5 : 0) - tamaño;
    if (!mejor || puntos > mejor.puntos) mejor = { puntos, grupo };
  }
  if (!mejor) return [];
  const elegidas = new Set([
    ...mejor.grupo,
    // El título de cada fila de donde sale una cifra (desde y hasta pueden
    // ser de filas distintas).
    ...filas(palabras, mejor.grupo).flatMap((fila) =>
      titulo(palabras, ancla, anclas, fila),
    ),
    ...fecha(palabras, vigencia, Math.min(...mejor.grupo)),
  ]);
  return palabras.filter((p, i) => elegidas.has(i));
}

/** Las cifras agrupadas por fila (misma página y casi la misma altura). */
function filas(palabras, grupo) {
  const lista = [];
  for (const i of [...grupo].sort(
    (a, b) =>
      palabras[a].pagina - palabras[b].pagina ||
      palabras[a].y0 - palabras[b].y0,
  )) {
    const p = palabras[i];
    const fila = lista.find(
      (f) =>
        palabras[f[0]].pagina === p.pagina &&
        Math.abs(palabras[f[0]].y0 - p.y0) < 4,
    );
    if (fila) fila.push(i);
    else lista.push([i]);
  }
  return lista;
}

/** Las palabras seguidas de un mismo renglón, en un solo recuadro. */
export function recuadros(marcadas) {
  const orden = [...marcadas].sort(
    (a, b) =>
      a.pagina - b.pagina ||
      (Math.abs(a.y0 - b.y0) < 3 ? a.x0 - b.x0 : a.y0 - b.y0),
  );
  const lista = [];
  for (const p of orden) {
    const antes = lista.at(-1);
    if (
      antes &&
      antes.pagina === p.pagina &&
      Math.abs(antes.y0 - p.y0) < 3 &&
      p.x0 - antes.x1 < 15
    ) {
      antes.x1 = Math.max(antes.x1, p.x1);
      antes.y0 = Math.min(antes.y0, p.y0);
      antes.y1 = Math.max(antes.y1, p.y1);
    } else lista.push({ ...p });
  }
  return lista;
}

async function cajas(datos) {
  const carpeta = await mkdtemp(join(tmpdir(), "robot-resaltar-"));
  try {
    const archivo = join(carpeta, "tasas.pdf");
    await writeFile(archivo, datos);
    const { stdout } = await promisify(execFile)(
      "pdftotext",
      ["-bbox-layout", archivo, "-"],
      { maxBuffer: 100 * 1024 * 1024 },
    );
    return palabrasDe(stdout);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/**
 * El PDF con las cifras resaltadas, o null si no encontró ninguna (o el PDF
 * no se deja modificar). `cifras`: las tasas guardadas (M.V. y E.A.);
 * `vigencia`: AAAA-MM-DD; `ancla`: dónde empieza el producto, si no es el
 * nombre de siempre.
 */
export async function resaltarPdf(
  datos,
  { cifras, vigencia, producto, ancla },
) {
  try {
    const marcadas = aResaltar(
      await cajas(datos),
      cifras,
      ancla ?? ANCLAS[producto],
      vigencia,
    );
    if (!marcadas.length) return null;
    const pdf = await PDFDocument.load(datos, { ignoreEncryption: true });
    const paginas = pdf.getPages();
    for (const p of recuadros(marcadas)) {
      const pagina = paginas[p.pagina];
      // Páginas giradas: la caja de poppler no coincide; mejor no marcar mal.
      if (!pagina || pagina.getRotation().angle % 360 !== 0) continue;
      const recorte = pagina.getCropBox();
      pagina.drawRectangle({
        x: recorte.x + p.x0 - 1.5,
        y: recorte.y + recorte.height - p.y1 - 1.5,
        width: p.x1 - p.x0 + 3,
        height: p.y1 - p.y0 + 3,
        color: rgb(0.35, 0.85, 0.35),
        opacity: 0.45,
        blendMode: BlendMode.Multiply,
        // El borde se ve también sobre fondos oscuros (títulos en barras).
        borderColor: rgb(0.1, 0.65, 0.1),
        borderWidth: 1.2,
        borderOpacity: 1,
      });
    }
    return Buffer.from(await pdf.save());
  } catch (error) {
    console.log(`No se pudo resaltar el PDF: ${error.message}`);
    return null;
  }
}
