import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Encabezado } from './compartido/encabezado/encabezado';
import { Pie } from './compartido/pie/pie';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Encabezado, Pie],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
