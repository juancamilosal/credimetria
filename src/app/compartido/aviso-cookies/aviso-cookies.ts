import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnaliticaService } from '../../core/servicios/analitica.service';

/**
 * Aviso de cookies abajo de la pantalla: Google Analytics solo mide si la
 * persona acepta. Sale hasta que elija (y otra vez desde "Preferencias de
 * cookies" en el pie).
 */
@Component({
  selector: 'app-aviso-cookies',
  imports: [RouterLink],
  template: `
    @if (analitica.mostrarAviso()) {
      <section class="aviso" role="region" aria-label="Aviso de cookies">
        <p>
          Usamos cookies de Google Analytics para contar las visitas y mejorar
          Credimetría. No las usamos para publicidad.
          <a routerLink="/politica-de-datos" fragment="datos">Más información</a
          >.
        </p>
        <div class="botones">
          <button
            type="button"
            class="btn btn-borde"
            (click)="analitica.rechazar()"
          >
            Rechazar
          </button>
          <button
            type="button"
            class="btn btn-principal"
            (click)="analitica.aceptar()"
          >
            Aceptar
          </button>
        </div>
      </section>
    }
  `,
  styles: `
    .aviso {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 50;
      max-width: 760px;
      margin-inline: auto;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 18px;
      background: var(--cm-blanco);
      border: 1px solid var(--cm-linea);
      border-radius: var(--cm-r-tarjeta);
      box-shadow: 0 14px 40px -16px rgb(15 27 42 / 0.45);
    }
    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .botones {
      display: flex;
      gap: 8px;
      flex: none;
    }
    .btn {
      min-height: 42px;
      padding: 8px 18px;
    }
    @media (max-width: 600px) {
      .aviso {
        flex-direction: column;
        align-items: stretch;
        left: 8px;
        right: 8px;
        bottom: 8px;
      }
      .botones .btn {
        flex: 1;
      }
    }
  `,
})
export class AvisoCookies {
  protected readonly analitica = inject(AnaliticaService);
}
