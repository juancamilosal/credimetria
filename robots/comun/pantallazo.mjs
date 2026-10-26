// Páginas con navegador (Chromium de Playwright, instalado en el Dockerfile):
// el pantallazo de la tabla de tasas, como prueba de lo que decía el día que
// cambió, y el texto de las páginas que se arman con JavaScript.

import { textoHtml } from "./pdf.mjs";

const NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

async function conNavegador(url, hacer) {
  const { chromium } = await import("playwright");
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({
      viewport: { width: 1280, height: 900 },
      locale: "es-CO",
      userAgent: NAVEGADOR,
    });
    await pagina.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    return await hacer(pagina);
  } finally {
    await navegador.close();
  }
}

/**
 * Texto de una página que se arma con JavaScript (Lulo): el HTML que llega
 * al servidor no trae las tasas. Espera a que el navegador la arme y junta el
 * texto de la página y de sus marcos (iframes), aunque esté oculto.
 */
export function textoConNavegador(url, texto) {
  return conNavegador(url, async (pagina) => {
    await pagina
      .waitForFunction(
        (buscado) => document.documentElement.textContent.includes(buscado),
        texto,
        { timeout: 30_000 },
      )
      .catch(() => {});
    const partes = [];
    for (const marco of pagina.frames()) {
      try {
        partes.push(textoHtml(await marco.content()));
      } catch {
        // Marco de otro sitio que no deja leerse: no importa.
      }
    }
    return partes.join("\n");
  });
}

/**
 * PNG de la tabla (o sección) que contiene `texto`; si no la encuentra o no
 * se ve, de la página completa. `clic`: texto de la pestaña que hay que tocar
 * antes para que la tabla se vea.
 */
export function pantallazo(url, texto, { clic } = {}) {
  return conNavegador(url, async (pagina) => {
    // Pestaña que hay que abrir para que se vea la tabla (Finandina).
    if (clic)
      await pagina
        .getByText(clic, { exact: true })
        .first()
        .click({ timeout: 10_000 })
        .then(() => pagina.waitForTimeout(1_000))
        .catch(() => {});
    // La tabla que tiene el texto o, si la página no usa tablas (Lulo), la
    // sección más cercana que no sea enorme.
    for (const etiqueta of ["table", "section", "article", "main"]) {
      const parte = pagina.locator(etiqueta, { hasText: texto }).last();
      try {
        if (!(await parte.count())) continue;
        const caja = await parte.boundingBox();
        if (caja && caja.height > 1400) continue;
        await parte.scrollIntoViewIfNeeded({ timeout: 10_000 });
        return await parte.screenshot({ timeout: 10_000 });
      } catch {
        // No se ve: probar con la siguiente.
      }
    }
    // Sin tabla ni sección (filas hechas con div, como Finandina): el bloque
    // más grande alrededor del texto que no pase de 1.400 px de alto.
    try {
      const marca = pagina.getByText(texto, { exact: false }).first();
      await marca.scrollIntoViewIfNeeded({ timeout: 10_000 });
      let mejor = marca;
      for (let nivel = 1; nivel <= 8; nivel++) {
        const padre = marca.locator(`xpath=ancestor::*[${nivel}]`);
        const caja = await padre.boundingBox();
        if (!caja || caja.height > 1400) break;
        mejor = padre;
      }
      return await mejor.screenshot({ timeout: 10_000 });
    } catch {
      return pagina.screenshot({ fullPage: true });
    }
  });
}
