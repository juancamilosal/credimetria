import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { DIRECTUS_URL } from './core/config/directus';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // En el servidor, la dirección de Directus se puede cambiar con la
    // variable DIRECTUS_URL (por ejemplo, para probar con otros datos).
    ...(process.env['DIRECTUS_URL']
      ? [{ provide: DIRECTUS_URL, useValue: process.env['DIRECTUS_URL'] }]
      : []),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
