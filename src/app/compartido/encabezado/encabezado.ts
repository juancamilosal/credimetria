import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../logo/logo';

@Component({
  selector: 'app-encabezado',
  imports: [RouterLink, Logo],
  templateUrl: './encabezado.html',
  styleUrl: './encabezado.css',
})
export class Encabezado {
  protected readonly enlaces = [
    { texto: 'Mejores tasas', fragmento: 'mejores-tasas' },
    { texto: 'Qué hacemos', fragmento: 'que-hacemos' },
    { texto: 'Cómo funciona', fragmento: 'como-funciona' },
    { texto: 'Simulador', fragmento: 'simulador' },
  ];
}
