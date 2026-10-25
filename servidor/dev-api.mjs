// Para `npm start` (sin SSR): sirve /api/tasas y /api/logos en el puerto
// 4300; el servidor de desarrollo de Angular los reenvía (proxy.conf.json).
// El token va en el archivo .env (no se sube al repositorio).
import express from "express";

try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env: se usan las variables del sistema.
}
const { rutasTasas } = await import("./tasas.mjs");

const app = express();
rutasTasas(app);
app.listen(4300, () => {
  if (!process.env.DIRECTUS_TOKEN) {
    console.warn("Falta DIRECTUS_TOKEN en .env: la página saldrá sin tasas.");
  }
  console.log("API de tasas en http://localhost:4300/api/tasas");
});
