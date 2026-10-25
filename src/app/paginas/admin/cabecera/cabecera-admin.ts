import { Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';

/** Cabecera de la administración: título, pestañas y la cuenta con "Salir". */
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
      <nav class="wrap pestanas" aria-label="Administración">
        <a
          routerLink="/admin/tasas"
          routerLinkActive="activa"
          ariaCurrentWhenActive="page"
          >Tasas</a
        >
        <a
          routerLink="/admin/pdf"
          routerLinkActive="activa"
          ariaCurrentWhenActive="page"
          >PDF de tasas</a
        >
      </nav>
    </section>
  `,
  styles: `
    .cabecera {
      padding-bottom: 0;
    }
    .cabeza {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
    }
    .cuenta {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pestanas {
      display: flex;
      gap: 4px;
      margin-top: 20px;
    }
    .pestanas a {
      padding: 12px 16px;
      font-weight: 700;
      color: var(--cm-gris);
      text-decoration: none;
      border-bottom: 3px solid transparent;
    }
    .pestanas a:hover {
      color: var(--cm-tinta);
    }
    .pestanas a.activa {
      color: var(--cm-marca-700);
      border-bottom-color: var(--cm-marca-700);
    }
  `,
})
export class CabeceraAdmin {
  private readonly sesion = inject(SesionAdmin);
  private readonly router = inject(Router);

  readonly titulo = input.required<string>();
  readonly texto = input.required<string>();
  protected readonly usuario = this.sesion.usuario;

  protected async salir(): Promise<void> {
    await this.sesion.salir();
    this.router.navigateByUrl('/admin/entrar');
  }
}
