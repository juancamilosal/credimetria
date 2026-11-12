import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import {
  rutasAsesores,
  rutasSolicitudesAliados,
} from '../servidor/asesores.mjs';
import { rutasProspectos } from '../servidor/prospectos.mjs';
import { rutasTasas } from '../servidor/tasas.mjs';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
// Dominios desde los que se arma la página en el servidor (protección contra
// SSRF). Otros dominios se agregan con la variable NG_ALLOWED_HOSTS
// (lista separada por comas).
const hostsExtra = (process.env['NG_ALLOWED_HOSTS'] ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const angularApp = new AngularNodeAppEngine({
  allowedHosts: [
    'localhost',
    'credimetria.co',
    '*.credimetria.co',
    'credimetria.com',
    '*.credimetria.com',
    '*.valkiriacode.com',
    ...hostsExtra,
  ],
  // Coolify (Traefik) y Cloudflare mandan estos encabezados. Si alguno no es
  // de confianza, Angular deja de armar la página en el servidor y la
  // entrega vacía (solo se arma en el navegador).
  trustProxyHeaders: [
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-for',
    'x-forwarded-port',
    'x-forwarded-server',
  ],
});

/**
 * /api/tasas y /api/logos/<entidad>: las tasas de Directus pasan por este
 * servidor (con el token del usuario "Lector web"), así el navegador nunca
 * ve Directus ni el token.
 */
rutasTasas(app);

/**
 * /api/prospectos: el formulario de asesoría. Guarda la solicitud en Directus
 * y manda el correo a la persona y al administrador.
 */
rutasProspectos(app);

/**
 * /api/asesores, /api/asesores/<id>/foto y /api/reportes-asesores: los
 * asesores aliados de Directus y los reportes contra ellos.
 */
rutasAsesores(app);

/** /api/solicitudes-aliados: el formulario "Quiero ser aliado". */
rutasSolicitudesAliados(app);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
