import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { tasasPublicas } from '../../servidor/tasas.mjs';
import { CARGADOR_TASAS } from './core/servicios/tasas.service';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // En el servidor las tasas se leen directo (sin pasar por /api/tasas).
    { provide: CARGADOR_TASAS, useValue: tasasPublicas },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
