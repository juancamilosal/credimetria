import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // La administración depende de la sesión del navegador: no se prerenderiza.
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Las tasas cambian cada semana: cada visita se arma en el servidor con
  // los datos de Directus del momento, en vez de prerenderizar al compilar.
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
