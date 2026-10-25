import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Credimetría · Compara con datos, no con promesas',
    loadComponent: () =>
      import('./paginas/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'ranking',
    title: 'Ranking de tasas · Credimetría',
    loadComponent: () =>
      import('./paginas/ranking/ranking').then((m) => m.Ranking),
  },
  {
    path: 'simulador',
    title: 'Simulador de crédito · Credimetría',
    loadComponent: () =>
      import('./paginas/simulador/simulador-pagina').then(
        (m) => m.SimuladorPagina,
      ),
  },
  {
    path: 'asesoria',
    title: 'Asesoría gratis · Credimetría',
    loadComponent: () =>
      import('./paginas/asesoria/asesoria').then((m) => m.Asesoria),
  },
  {
    path: 'aliados',
    title: 'Asesores aliados · Credimetría',
    loadComponent: () =>
      import('./paginas/aliados/aliados').then((m) => m.Aliados),
  },
  {
    path: 'politica-de-datos',
    title: 'Política de tratamiento de datos · Credimetría',
    loadComponent: () =>
      import('./paginas/politica-datos/politica-datos').then(
        (m) => m.PoliticaDatos,
      ),
  },
  { path: '**', redirectTo: '' },
];
