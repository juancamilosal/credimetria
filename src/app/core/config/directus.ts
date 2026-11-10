import { InjectionToken } from '@angular/core';

/** Dirección del Directus de Credimetría (tasas, fuentes y entidades). */
export const DIRECTUS_URL = new InjectionToken<string>('DIRECTUS_URL', {
  factory: () => 'https://api.credimetria.com',
});
