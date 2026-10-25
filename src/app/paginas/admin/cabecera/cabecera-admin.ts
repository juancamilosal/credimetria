import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';

/** Cabecera de la administración: título y la cuenta con "Salir". */
@Component({
  selector: 'app-cabecera-admin',
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

  protected async salir(): Promise<void> {
    await this.sesion.salir();
    this.router.navigateByUrl('/admin/entrar');
  }
}
