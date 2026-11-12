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
import {
  provideRouter,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';

import { routes } from './app.routes';
import { TasasService } from './core/servicios/tasas.service';
import { recargarSiVersionVieja } from './core/utilidades/version-nueva';

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
      // Después de publicar una versión nueva, una pestaña abierta pide
      // archivos que ya no existen: se recarga sola en vez de quedarse sin
      // responder.
      withNavigationErrorHandler((error) => {
        recargarSiVersionVieja(error);
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
