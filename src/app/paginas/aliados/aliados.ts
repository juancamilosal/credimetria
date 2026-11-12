import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { REGLAS_ALIADOS } from '../../core/datos/reglas-aliados';
import { AliadosService } from '../../core/servicios/aliados.service';

/**
 * Lista pública de quienes pueden recibir los datos de un prospecto: los
 * asesores publicados en la colección `asesores` de Directus.
 */
@Component({
  selector: 'app-aliados',
  imports: [RouterLink],
  templateUrl: './aliados.html',
  styleUrl: './aliados.css',
})
export class Aliados {
  private readonly servicio = inject(AliadosService);

  protected readonly aliados = this.servicio.aliados;
  protected readonly cargando = this.servicio.cargando;
  protected readonly sinConexion = this.servicio.sinConexion;
  /** Sin asesores publicados: "Próximamente tus asesores". */
  protected readonly ejemplo = computed(
    () =>
      !this.cargando() && !this.sinConexion() && this.aliados().length === 0,
  );

  constructor() {
    void this.servicio.cargar();
  }

  protected readonly reglas = REGLAS_ALIADOS;

  /** "Asesor de ejemplo" → "AE". */
  protected iniciales(nombre: string): string {
    return nombre
      .split(/\s+/)
      .filter((p) => p.length > 2)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
}
