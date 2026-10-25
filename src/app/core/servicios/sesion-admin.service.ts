import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DIRECTUS_URL } from '../config/directus';

/** Clave en sessionStorage: la sesión dura lo que dure la pestaña abierta. */
export const CLAVE_SESION_ADMIN = 'credimetria-admin';

export interface UsuarioAdmin {
  id: string;
  email: string;
  nombre: string;
}

interface Tokens {
  access_token: string;
  refresh_token: string;
}

interface Politicas {
  policy: { admin_access: boolean } | null;
}

interface UsuarioDirectus {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: { policies: Politicas[] } | null;
  policies: Politicas[] | null;
}

/** La cuenta existe pero no es administradora de Directus. */
export class SinPermisoAdmin extends Error {}

/** Mensaje para la persona según el error de Directus. */
export function mensajeError(error: unknown): string {
  if (error instanceof SinPermisoAdmin) {
    return 'Esta cuenta no tiene permiso para configurar las tasas.';
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa tu internet e inténtalo de nuevo.';
    }
    if (error.status === 401) return 'Correo o contraseña incorrectos.';
    if (error.status === 403) return 'Tu cuenta no tiene permiso para esto.';
  }
  return 'Algo salió mal. Inténtalo de nuevo.';
}

/**
 * Sesión de administración contra Directus. Solo entran cuentas con acceso de
 * administrador. El token de acceso vive en memoria y el de renovación en
 * sessionStorage, así que recargar la página no cierra la sesión pero cerrar
 * la pestaña sí.
 */
@Injectable({ providedIn: 'root' })
export class SesionAdmin {
  private readonly http = inject(HttpClient);
  private readonly base = inject(DIRECTUS_URL);
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  private acceso: string | null = null;
  private renovando: Promise<void> | null = null;
  private restaurando: Promise<boolean> | null = null;

  readonly usuario = signal<UsuarioAdmin | null>(null);

  async entrar(email: string, clave: string): Promise<void> {
    const r = await firstValueFrom(
      this.http.post<{ data: Tokens }>(`${this.base}/auth/login`, {
        email,
        password: clave,
        mode: 'json',
      }),
    );
    this.guardar(r.data);
    try {
      await this.cargarUsuario();
    } catch (error) {
      await this.salir();
      throw error;
    }
  }

  /** Recupera la sesión guardada en la pestaña; `false` si no hay. */
  restaurar(): Promise<boolean> {
    if (this.usuario()) return Promise.resolve(true);
    if (!this.enNavegador || !this.leerRenovacion()) {
      return Promise.resolve(false);
    }
    this.restaurando ??= this.renovar()
      .then(() => this.cargarUsuario())
      .then(() => true)
      .catch(() => {
        this.limpiar();
        return false;
      })
      .finally(() => (this.restaurando = null));
    return this.restaurando;
  }

  async salir(): Promise<void> {
    const renovacion = this.leerRenovacion();
    this.limpiar();
    if (!renovacion) return;
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/auth/logout`, {
          refresh_token: renovacion,
          mode: 'json',
        }),
      );
    } catch {
      // Si el servidor no responde, la sesión ya quedó cerrada en el navegador.
    }
  }

  /**
   * Dirección de una imagen de Directus, reducida al alto pedido. Los archivos
   * no son públicos y una `<img>` no manda encabezados: el token va en la
   * dirección.
   */
  urlImagen(id: string | null, alto: number): string | null {
    if (!id || !this.acceso) return null;
    const params = new URLSearchParams({
      height: String(alto),
      fit: 'inside',
      format: 'webp',
      access_token: this.acceso,
    });
    return `${this.base}/assets/${id}?${params}`;
  }

  /** Dirección de un archivo de Directus para abrirlo (PDF o imagen). */
  urlArchivo(id: string): string | null {
    if (!this.acceso) return null;
    return `${this.base}/assets/${id}?access_token=${encodeURIComponent(this.acceso)}`;
  }

  /** Llama a Directus con el token; si venció, lo renueva una vez y reintenta. */
  async pedir<T>(
    metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<T> {
    try {
      return await this.llamar<T>(metodo, ruta, cuerpo);
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        throw error;
      }
      await this.renovar();
      return this.llamar<T>(metodo, ruta, cuerpo);
    }
  }

  private async llamar<T>(
    metodo: string,
    ruta: string,
    cuerpo?: unknown,
  ): Promise<T> {
    const r = await firstValueFrom(
      this.http.request<{ data: T }>(metodo, `${this.base}${ruta}`, {
        body: cuerpo,
        headers: this.acceso ? { Authorization: `Bearer ${this.acceso}` } : {},
      }),
    );
    // DELETE responde sin cuerpo.
    return r?.data as T;
  }

  private renovar(): Promise<void> {
    this.renovando ??= (async () => {
      const renovacion = this.leerRenovacion();
      if (!renovacion) throw new Error('Sin sesión');
      try {
        const r = await firstValueFrom(
          this.http.post<{ data: Tokens }>(`${this.base}/auth/refresh`, {
            refresh_token: renovacion,
            mode: 'json',
          }),
        );
        this.guardar(r.data);
      } catch (error) {
        this.limpiar();
        throw error;
      }
    })().finally(() => (this.renovando = null));
    return this.renovando;
  }

  private async cargarUsuario(): Promise<void> {
    const yo = await this.pedir<UsuarioDirectus>(
      'GET',
      '/users/me?fields=id,email,first_name,last_name,' +
        'role.policies.policy.admin_access,policies.policy.admin_access',
    );
    const politicas = [...(yo.role?.policies ?? []), ...(yo.policies ?? [])];
    if (!politicas.some((p) => p.policy?.admin_access)) {
      throw new SinPermisoAdmin();
    }
    const nombre = [yo.first_name, yo.last_name].filter(Boolean).join(' ');
    this.usuario.set({
      id: yo.id,
      email: yo.email,
      nombre: nombre || yo.email,
    });
  }

  private guardar(tokens: Tokens): void {
    this.acceso = tokens.access_token;
    try {
      sessionStorage.setItem(CLAVE_SESION_ADMIN, tokens.refresh_token);
    } catch {
      // Sin almacenamiento: la sesión dura hasta recargar.
    }
  }

  private leerRenovacion(): string | null {
    try {
      return sessionStorage.getItem(CLAVE_SESION_ADMIN);
    } catch {
      return null;
    }
  }

  private limpiar(): void {
    this.acceso = null;
    this.usuario.set(null);
    try {
      sessionStorage.removeItem(CLAVE_SESION_ADMIN);
    } catch {
      // Nada que borrar.
    }
  }
}
