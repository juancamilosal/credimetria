import { Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';

/** Cabecera de la administración: título y la cuenta con "Salir". */
@Component({
  selector: 'app-cabecera-admin',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <section class="cabecera">
      <div class="wrap cabeza">
        <div class="cabecera-texto">
          <h1>{{ titulo() }}</h1>
          <p>{{ texto() }}</p>
        </div>
        @if (usuario(); as u) {
          <div class="cuenta">
            <span class="nota">{{ u.nombre }}</span>
            <button type="button" class="btn btn-borde" (click)="salir()">
              Salir
            </button>
          </div>
        }
      </div>
      <nav class="wrap menu" aria-label="Administración">
        @for (s of secciones; track s.ruta) {
          <a [routerLink]="s.ruta" routerLinkActive="activo">{{ s.texto }}</a>
        }
      </nav>
    </section>
  `,
  styles: `
    .cabeza {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
    }
    .menu {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-top: 4px;
      padding-bottom: 14px;
    }
    .menu a {
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid var(--cm-linea);
      background: var(--cm-blanco);
      color: var(--cm-tinta);
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
    }
    .menu a.activo {
      background: var(--cm-marca-700);
      border-color: var(--cm-marca-700);
      color: #fff;
    }
    .cuenta {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `,
})
export class CabeceraAdmin {
  private readonly sesion = inject(SesionAdmin);
  private readonly router = inject(Router);

  readonly titulo = input.required<string>();
  readonly texto = input.required<string>();
  protected readonly usuario = this.sesion.usuario;
  protected readonly secciones = [
    { ruta: '/admin/tasas', texto: 'Tasas' },
    { ruta: '/admin/prospectos', texto: 'Prospectos' },
    { ruta: '/admin/asesores', texto: 'Asesores' },
    { ruta: '/admin/solicitudes-aliados', texto: 'Solicitudes de aliados' },
    { ruta: '/admin/reportes', texto: 'Reportes' },
  ];

  protected async salir(): Promise<void> {
    await this.sesion.salir();
    this.router.navigateByUrl('/admin/entrar');
  }
}
