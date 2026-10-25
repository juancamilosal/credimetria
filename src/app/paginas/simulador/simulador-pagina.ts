import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TablaRanking } from '../../compartido/tabla-ranking/tabla-ranking';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';
import { Simulador } from './calculadora/simulador';

/** Página del simulador: la calculadora y las 3 tasas más bajas del producto elegido. */
@Component({
  selector: 'app-simulador-pagina',
  imports: [RouterLink, Simulador, TablaRanking],
  template: `
    <section class="cabecera">
      <div class="wrap cabecera-texto">
        <h1>Simulador de crédito</h1>
        <p>
          Escribe la tasa que te ofrecieron y te mostramos si es buena, cuánto
          pagarías en total y quién te cobra menos.
        </p>
      </div>
    </section>

    <div class="wrap">
      <section class="sim" aria-label="Simulador">
        <app-simulador [(producto)]="producto" />
      </section>

      <section class="seccion" aria-labelledby="tituloTop">
        <div class="titulo-sec">
          <h2 id="tituloTop">Las que menos cobran</h2>
          <a routerLink="/ranking" [queryParams]="{ producto: producto() }">
            Ver ranking completo
          </a>
        </div>
        <app-tabla-ranking
          [filas]="top()"
          [producto]="producto()"
          [titulo]="nombreProducto() + ' · las 3 que menos cobran'"
        />
      </section>
    </div>
  `,
  styles: `
    .sim {
      padding-top: 32px;
    }
  `,
})
export class SimuladorPagina {
  private readonly tasas = inject(TasasService);

  protected readonly producto = signal<Producto>('libre-inversion');
  protected readonly top = computed(() =>
    this.tasas.ranking(this.producto()).slice(0, 3),
  );
  protected readonly nombreProducto = computed(() =>
    this.tasas.nombre(this.producto()),
  );
}
