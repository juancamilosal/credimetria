// Para `npm start` (sin SSR): sirve /api/tasas, /api/logos y /api/prospectos en el puerto
// 4300; el servidor de desarrollo de Angular los reenvía (proxy.conf.json).
// El token va en el archivo .env (no se sube al repositorio).
import express from "express";
import { cargarEnv } from "./env.mjs";

const archivo = cargarEnv();
const { rutasTasas } = await import("./tasas.mjs");
const { rutasProspectos } = await import("./prospectos.mjs");
const { rutasAsesores } = await import("./asesores.mjs");

const app = express();
rutasTasas(app);
rutasProspectos(app);
rutasAsesores(app);
app.listen(4300, () => {
  if (!archivo) {
    console.warn(
      `No encontré el archivo .env en ${process.cwd()}: la página saldrá sin tasas. Cópialo de .env.example.`,
    );
  } else if (!process.env.DIRECTUS_TOKEN) {
    console.warn(
      `El .env (${archivo}) no tiene DIRECTUS_TOKEN (¿la línea empieza con # o tiene otro nombre?): la página saldrá sin tasas.`,
    );
  }
  console.log("API de tasas en http://localhost:4300/api/tasas");
});
