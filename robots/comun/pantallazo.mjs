// Pantallazo de la tabla de tasas de una página, como prueba de lo que decía
// el día que cambió. Usa Chromium de Playwright (instalado en el Dockerfile).

const NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

/**
 * PNG de la tabla que contiene `texto`; si no la encuentra o no se ve, de la
 * página completa.
 */
export async function pantallazo(url, texto) {
  const { chromium } = await import("playwright");
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({
      viewport: { width: 1280, height: 900 },
      locale: "es-CO",
      userAgent: NAVEGADOR,
    });
    await pagina.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    const tabla = pagina.locator("table", { hasText: texto }).last();
    try {
      await tabla.scrollIntoViewIfNeeded({ timeout: 10_000 });
      return await tabla.screenshot({ timeout: 10_000 });
    } catch {
      return await pagina.screenshot({ fullPage: true });
    }
  } finally {
    await navegador.close();
  }
}
