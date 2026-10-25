import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VERSION_POLITICA } from '../../core/servicios/prospectos.service';

/**
 * Lugar de la política de tratamiento de datos. El texto legal aún no está
 * escrito; debe publicarse aquí antes de abrir el formulario de asesoría.
 */
@Component({
  selector: 'app-politica-datos',
  imports: [RouterLink],
  template: `
    <section class="banda">
      <div class="wrap banda-cabeza">
        <h1>Política de tratamiento de datos</h1>
        <p>Cómo cuidamos tus datos personales, según la Ley 1581 de 2012.</p>
      </div>
    </section>
    <div class="wrap contenido">
      <div class="tarjeta">
        <span class="etq etq-oro">Borrador · versión {{ version }}</span>
        <p>
          Estamos terminando el texto completo de la política. Mientras tanto,
          esto es lo esencial:
        </p>
        <ul>
          <li>
            Solo compartimos tus datos con los
            <a routerLink="/aliados">asesores aliados publicados</a>, y solo si
            marcas la autorización.
          </li>
          <li>Te contactan máximo 2 asesores, por los canales que elijas.</li>
          <li>Puedes pedir que borremos tus datos cuando quieras.</li>
        </ul>
      </div>
    </div>
  `,
  styles: `
    .contenido {
      padding-top: 32px;
    }
    .tarjeta {
      max-width: 72ch;
      gap: 12px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `,
})
export class PoliticaDatos {
  protected readonly version = VERSION_POLITICA;
}
