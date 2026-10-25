import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIRECTUS_URL } from '../config/directus';
import {
  CLAVE_SESION_ADMIN,
  mensajeError,
  SesionAdmin,
  SinPermisoAdmin,
} from './sesion-admin.service';

const BASE = 'https://directus.prueba';

describe('SesionAdmin', () => {
  let sesion: SesionAdmin;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.removeItem(CLAVE_SESION_ADMIN);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIRECTUS_URL, useValue: BASE },
      ],
    });
    sesion = TestBed.inject(SesionAdmin);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(CLAVE_SESION_ADMIN);
  });

  /** Deja correr las promesas hasta la siguiente petición. */
  const esperar = () => new Promise((r) => setTimeout(r));

  function responderUsuario(admin: boolean) {
    const yo = http.expectOne((r) => r.url.startsWith(`${BASE}/users/me`));
    expect(yo.request.headers.get('Authorization')).toBe('Bearer acceso-1');
    yo.flush({
      data: {
        id: 'u1',
        email: 'juan@valkiriacode.com',
        first_name: 'Juan',
        last_name: 'Salazar',
        role: { policies: [{ policy: { admin_access: admin } }] },
        policies: [],
      },
    });
  }

  it('entra con una cuenta de administrador', async () => {
    const entrada = sesion.entrar('juan@valkiriacode.com', 'secreta');
    const login = http.expectOne(`${BASE}/auth/login`);
    expect(login.request.body).toEqual({
      email: 'juan@valkiriacode.com',
      password: 'secreta',
      mode: 'json',
    });
    login.flush({ data: { access_token: 'acceso-1', refresh_token: 'r-1' } });
    await esperar();
    responderUsuario(true);
    await entrada;
    expect(sesion.usuario()?.nombre).toBe('Juan Salazar');
    expect(sessionStorage.getItem(CLAVE_SESION_ADMIN)).toBe('r-1');
  });

  it('no deja entrar a una cuenta sin acceso de administrador', async () => {
    const entrada = sesion.entrar('otra@correo.com', 'clave');
    http
      .expectOne(`${BASE}/auth/login`)
      .flush({ data: { access_token: 'acceso-1', refresh_token: 'r-1' } });
    await esperar();
    responderUsuario(false);
    await esperar();
    http.expectOne(`${BASE}/auth/logout`).flush({});
    await expectAsync(entrada).toBeRejectedWithError(SinPermisoAdmin);
    expect(sesion.usuario()).toBeNull();
    expect(sessionStorage.getItem(CLAVE_SESION_ADMIN)).toBeNull();
  });

  it('renueva el token vencido y repite la petición', async () => {
    sessionStorage.setItem(CLAVE_SESION_ADMIN, 'r-viejo');
    const pedido = sesion.pedir<number[]>('GET', '/items/tasas_publicadas');
    http
      .expectOne(`${BASE}/items/tasas_publicadas`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await esperar();
    const renovar = http.expectOne(`${BASE}/auth/refresh`);
    expect(renovar.request.body.refresh_token).toBe('r-viejo');
    renovar.flush({ data: { access_token: 'acceso-2', refresh_token: 'r-2' } });
    await esperar();
    const repetido = http.expectOne(`${BASE}/items/tasas_publicadas`);
    expect(repetido.request.headers.get('Authorization')).toBe(
      'Bearer acceso-2',
    );
    repetido.flush({ data: [1, 2] });
    expect(await pedido).toEqual([1, 2]);
    expect(sessionStorage.getItem(CLAVE_SESION_ADMIN)).toBe('r-2');
  });

  it('sin sesión guardada no intenta restaurar', async () => {
    expect(await sesion.restaurar()).toBeFalse();
  });

  it('explica los errores en palabras', () => {
    expect(mensajeError(new SinPermisoAdmin())).toContain('no tiene permiso');
  });
});
