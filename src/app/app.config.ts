import { isPlatformServer, registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { TasasService } from './core/servicios/tasas.service';

// Pesos y porcentajes con formato colombiano: $20.000.000 y 21,48 %.
registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    // En el servidor las tasas se leen de Directus antes de armar la página.
    // En el navegador no se espera: si no vinieron con la página, se piden
    // a /api/tasas mientras la tabla muestra el esqueleto.
    provideAppInitializer(() => {
      const carga = inject(TasasService).cargar();
      return isPlatformServer(inject(PLATFORM_ID)) ? carga : undefined;
    }),
  ],
};
