import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ComparaOferta } from '../compara-oferta/compara-oferta';
import { Foto } from '../../compartido/foto/foto';
import { TablaRanking } from '../../compartido/tabla-ranking/tabla-ranking';
import { FOTOS } from '../../core/datos/fotos';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';
import { Simulador } from './calculadora/simulador';
import { Comparador } from './comparador/comparador';

/** Lo que la persona quiere hacer en el simulador (`?modo=` en la dirección). */
export type ModoSimulador = 'oferta' | 'calcular';

/**
 * Página del simulador, con dos caminos (12 nov 2026, antes eran dos páginas):
 * "Me ofrecieron un crédito" (el chat de Compara tu oferta) y "Quiero calcular
 * un crédito" (la calculadora, el comparador de dos entidades y las 3 tasas
 * más bajas del producto elegido). /compara-tu-oferta redirige a ?modo=oferta.
 */
@Component({
  selector: 'app-simulador-pagina',
  imports: [
    RouterLink,
    Foto,
    Simulador,
    Comparador,
    TablaRanking,
    ComparaOferta,
  ],
  template: `
    <section class="cabecera">
      <div class="wrap cabeza">
        <div class="cabecera-texto">
          <h1>Simulador de crédito</h1>
          <p>¿Qué quieres hacer?</p>
          <div class="modos" role="group" aria-label="Qué quieres hacer">
            <button
              type="button"
              class="modo"
              [attr.aria-pressed]="modo() === 'oferta'"
              (click)="elegir('oferta')"
            >
              <b>Me ofrecieron un crédito</b>
              <span>Mira la tasa real y los costos escondidos</span>
            </button>
            <button
              type="button"
              class="modo"
              [attr.aria-pressed]="modo() === 'calcular'"
              (click)="elegir('calcular')"
            >
              <b>Quiero calcular un crédito</b>
              <span>Cuota, tabla de pagos y comparar entidades</span>
            </button>
          </div>
        </div>
        <app-foto
          class="cabeza-foto"
          [foto]="foto"
          tamanos="(max-width: 760px) 100vw, 420px"
          [prioritaria]="true"
        />
      </div>
    </section>

    @if (modo() === 'oferta') {
      <section class="sim" aria-label="Revisa tu oferta">
        <app-compara-oferta [incrustado]="true" />
        <p class="wrap nota privado">
          Tus respuestas no se guardan ni se envían: todo se calcula en tu
          navegador.
        </p>
      </section>
    } @else {
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
    }
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
    .modos {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 4px;
    }
    .modo {
      font: inherit;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px 18px;
      min-height: 44px;
      border-radius: var(--cm-r-tarjeta);
      border: 2px solid var(--cm-linea);
      background: var(--cm-blanco);
      color: var(--cm-tinta);
      cursor: pointer;
    }
    .modo b {
      font-size: 17px;
    }
    .modo span {
      font-size: 14px;
      color: var(--cm-gris);
    }
    .modo:hover {
      border-color: var(--cm-gris);
    }
    .modo[aria-pressed='true'] {
      border-color: var(--cm-marca-700);
      background: var(--cm-marca-100);
    }
    .modo[aria-pressed='true'] b {
      color: var(--cm-enlace);
    }
    .privado {
      text-align: center;
      margin-top: 12px;
    }
    @media (max-width: 520px) {
      .modos {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SimuladorPagina {
  private readonly tasas = inject(TasasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly modo = signal<ModoSimulador>(
    this.ruta.snapshot.queryParamMap.get('modo') === 'oferta'
      ? 'oferta'
      : 'calcular',
  );

  constructor() {
    // También al volver a entrar por el menú o por un enlace con ?modo=oferta.
    this.ruta.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((p) =>
        this.modo.set(p.get('modo') === 'oferta' ? 'oferta' : 'calcular'),
      );
  }

  /** Cambia de camino y lo deja en la dirección para poder compartirlo. */
  protected elegir(modo: ModoSimulador): void {
    this.modo.set(modo);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { modo: modo === 'oferta' ? 'oferta' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

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
