import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionAdmin } from '../servicios/sesion-admin.service';

/** Sin sesión de administrador, a la pantalla de entrar (y luego de vuelta). */
export const soloAdmin: CanActivateFn = async (_ruta, estado) => {
  const router = inject(Router);
  if (await inject(SesionAdmin).restaurar()) return true;
  return router.createUrlTree(['/admin/entrar'], {
    queryParams: { volver: estado.url },
  });
};
