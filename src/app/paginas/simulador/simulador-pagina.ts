import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Foto } from '../../compartido/foto/foto';
import { TablaRanking } from '../../compartido/tabla-ranking/tabla-ranking';
import { FOTOS } from '../../core/datos/fotos';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';
import { Simulador } from './calculadora/simulador';
import { Comparador } from './comparador/comparador';

/**
 * Página del simulador: la calculadora, el comparador de dos entidades y las
 * 3 tasas más bajas del producto elegido.
 */
@Component({
  selector: 'app-simulador-pagina',
  imports: [RouterLink, Foto, Simulador, Comparador, TablaRanking],
  template: `
    <section class="cabecera">
      <div class="wrap cabeza">
        <div class="cabecera-texto">
          <h1>Simulador de crédito</h1>
          <p>
            Escribe la tasa que te ofrecieron y te mostramos si es buena, cuánto
            pagarías en total y quién te cobra menos.
          </p>
        </div>
        <app-foto
          class="cabeza-foto"
          [foto]="foto"
          tamanos="(max-width: 760px) 100vw, 420px"
          [prioritaria]="true"
        />
      </div>
    </section>

    <div class="wrap">
      <section class="sim" aria-label="Simulador">
        <app-simulador
          [(producto)]="producto"
          [(monto)]="monto"
          [(plazo)]="plazo"
        />
      </section>

      <section class="seccion" aria-labelledby="tituloComparador">
        <app-comparador
          [producto]="producto()"
          [monto]="monto()"
          [plazo]="plazo()"
        />
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
    .cabeza {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 32px;
      align-items: center;
      padding-block: 8px;
    }
    .cabeza-foto {
      aspect-ratio: 16 / 9;
      border-radius: var(--cm-r-tarjeta);
    }
    @media (max-width: 760px) {
      .cabeza {
        grid-template-columns: 1fr;
        gap: 0;
        padding-bottom: 20px;
      }
    }
    .sim {
      padding-top: 32px;
    }
  `,
})
export class SimuladorPagina {
  private readonly tasas = inject(TasasService);
  protected readonly foto = FOTOS.mujerOferta;

  protected readonly producto = signal<Producto>('libre-inversion');
  protected readonly monto = signal(20_000_000);
  protected readonly plazo = signal(48);
  protected readonly top = computed(() =>
    this.tasas.ranking(this.producto()).slice(0, 3),
  );
  protected readonly nombreProducto = computed(() =>
    this.tasas.nombre(this.producto()),
  );
}
