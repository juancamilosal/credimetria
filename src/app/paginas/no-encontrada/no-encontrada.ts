import { Component, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Dirección que no existe (por ejemplo /glosario). En el servidor responde
 * con estado 404 para que Google no la indexe como una copia del inicio.
 */
@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  template: `
    <section class="wrap no-encontrada">
      <p class="codigo cifra">404</p>
      <h1>Página no encontrada</h1>
      <p class="nota">
        La dirección que buscas no existe o cambió. Puedes seguir desde aquí:
      </p>
      <div class="acciones">
        <a class="btn btn-principal" routerLink="/">Ir al inicio</a>
        <a class="btn btn-borde" routerLink="/ranking"
          >Ver el ranking de tasas</a
        >
      </div>
    </section>
  `,
  styles: `
    .no-encontrada {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      padding-block: 72px 96px;
    }
    .codigo {
      margin: 0;
      font-size: 64px;
      font-weight: 700;
      color: var(--cm-marca-700);
    }
    h1 {
      font-size: clamp(24px, 4vw, 34px);
      font-weight: 800;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 8px;
    }
  `,
})
export class NoEncontrada {
  constructor() {
    // Solo existe al armar la página en el servidor.
    const respuesta = inject(RESPONSE_INIT, { optional: true });
    if (respuesta) respuesta.status = 404;
  }
}
