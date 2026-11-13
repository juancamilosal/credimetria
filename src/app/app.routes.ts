import { soloAdmin } from './core/guardas/solo-admin';
import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import {
  ASESORES,
  PROSPECTOS,
  REPORTES,
  SOLICITUDES,
} from './paginas/admin/coleccion/colecciones';

export const routes: Routes = [
  {
    path: '',
    title: 'Credimetría · Compara con datos, no con promesas',
    data: {
      descripcion:
        'Compara con datos, no con promesas: mira la tasa que anuncian y la que de verdad cobran bancos, cooperativas y financieras en Colombia, y recibe asesoría gratis.',
    },
    loadComponent: () =>
      import('./paginas/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'ranking',
    title: 'Ranking de tasas · Credimetría',
    data: {
      descripcion:
        'Ranking de tasas de crédito en Colombia: libre inversión, libranza, vehículo y vivienda. La tasa que anuncia cada banco frente a la que de verdad cobra según la Superfinanciera.',
    },
    loadComponent: () =>
      import('./paginas/ranking/ranking').then((m) => m.Ranking),
  },
  {
    path: 'simulador',
    title: 'Simulador de crédito · Credimetría',
    data: {
      descripcion:
        '¿Te ofrecieron un crédito? Mira la tasa real y los costos escondidos. O calcula tu cuota, la tabla de pagos y compara entidades con lo que de verdad cobran.',
    },
    loadComponent: () =>
      import('./paginas/simulador/simulador-pagina').then(
        (m) => m.SimuladorPagina,
      ),
  },
  // Compara tu oferta quedó dentro del simulador (12 nov 2026).
  {
    path: 'compara-tu-oferta',
    redirectTo: () =>
      inject(Router).createUrlTree(['/simulador'], {
        queryParams: { modo: 'oferta' },
      }),
  },
  // Dirección anterior de la página (12 nov 2026).
  { path: 'si-tienes-reportes', redirectTo: 'creditos-para-reportados' },
  {
    path: 'creditos-para-reportados',
    title: 'Créditos para reportados · Credimetría',
    data: {
      descripcion:
        'Créditos para reportados en centrales de riesgo: entidades que prestan a personas reportadas, con su registro oficial verificado: vigiladas por la Superfinanciera y operadoras de libranza inscritas en el RUNEOL.',
    },
    loadComponent: () =>
      import('./paginas/reportados/reportados').then((m) => m.Reportados),
  },
  {
    path: 'asesoria',
    title: 'Asesoría gratis · Credimetría',
    data: {
      descripcion:
        'Pide asesoría gratis: un asesor de crédito aliado y verificado te ayuda a conseguir la mejor tasa. Sin cobros por adelantado.',
    },
    loadComponent: () =>
      import('./paginas/asesoria/asesoria').then((m) => m.Asesoria),
  },
  {
    path: 'aliados',
    title: 'Asesores aliados · Credimetría',
    data: {
      descripcion:
        'Conoce a los asesores de crédito aliados de Credimetría: verificados, con las entidades, productos y ciudades en que trabajan, y sus reglas.',
    },
    loadComponent: () =>
      import('./paginas/aliados/aliados').then((m) => m.Aliados),
  },
  {
    path: 'aliados/quiero-ser-aliado',
    title: 'Quiero ser aliado · Credimetría',
    data: {
      descripcion:
        '¿Eres asesor de crédito? Únete a Credimetría y recibe solicitudes de personas que ya compararon tasas. Verificamos tu vínculo con las entidades.',
    },
    loadComponent: () =>
      import('./paginas/quiero-ser-aliado/quiero-ser-aliado').then(
        (m) => m.QuieroSerAliado,
      ),
  },
  {
    path: 'aliados/reportar',
    title: 'Reportar un asesor · Credimetría',
    data: {
      descripcion:
        '¿Un asesor te pidió dinero por adelantado o no respetó las reglas? Repórtalo a Credimetría: revisamos cada reporte y retiramos de la lista a quien incumpla.',
    },
    loadComponent: () =>
      import('./paginas/reportar-asesor/reportar-asesor').then(
        (m) => m.ReportarAsesor,
      ),
  },
  {
    path: 'politica-de-datos',
    title: 'Política de tratamiento de datos · Credimetría',
    data: {
      descripcion:
        'Política de tratamiento de datos personales de Credimetría según la Ley 1581 de 2012: qué datos recogemos, para qué, con quién los compartimos y tus derechos.',
    },
    loadComponent: () =>
      import('./paginas/politica-datos/politica-datos').then(
        (m) => m.PoliticaDatos,
      ),
  },
  {
    path: 'admin/entrar',
    title: 'Administración · Credimetría',
    data: { noIndexar: true },
    loadComponent: () =>
      import('./paginas/admin/entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: 'admin/tasas',
    title: 'Configuración de tasas · Credimetría',
    data: { noIndexar: true },
    canActivate: [soloAdmin],
    loadComponent: () =>
      import('./paginas/admin/tasas/tasas-admin').then((m) => m.TasasAdmin),
  },
  {
    path: 'admin/prospectos',
    title: 'Prospectos · Administración · Credimetría',
    data: { noIndexar: true, coleccion: PROSPECTOS },
    canActivate: [soloAdmin],
    loadComponent: () =>
      import('./paginas/admin/coleccion/coleccion-admin').then(
        (m) => m.ColeccionAdmin,
      ),
  },
  {
    path: 'admin/asesores',
    title: 'Asesores aliados · Administración · Credimetría',
    data: { noIndexar: true, coleccion: ASESORES },
    canActivate: [soloAdmin],
    loadComponent: () =>
      import('./paginas/admin/coleccion/coleccion-admin').then(
        (m) => m.ColeccionAdmin,
      ),
  },
  {
    path: 'admin/solicitudes-aliados',
    title: 'Solicitudes de aliados · Administración · Credimetría',
    data: { noIndexar: true, coleccion: SOLICITUDES },
    canActivate: [soloAdmin],
    loadComponent: () =>
      import('./paginas/admin/coleccion/coleccion-admin').then(
        (m) => m.ColeccionAdmin,
      ),
  },
  {
    path: 'admin/reportes',
    title: 'Reportes de asesores · Administración · Credimetría',
    data: { noIndexar: true, coleccion: REPORTES },
    canActivate: [soloAdmin],
    loadComponent: () =>
      import('./paginas/admin/coleccion/coleccion-admin').then(
        (m) => m.ColeccionAdmin,
      ),
  },
  { path: 'admin/pdf', redirectTo: 'admin/tasas' },
  { path: 'admin', redirectTo: 'admin/tasas' },
  {
    // Cualquier otra dirección: "Página no encontrada" con estado 404.
    path: '**',
    title: 'Página no encontrada · Credimetría',
    data: { noIndexar: true },
    loadComponent: () =>
      import('./paginas/no-encontrada/no-encontrada').then(
        (m) => m.NoEncontrada,
      ),
  },
];
