import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  PLATFORM_ID,
} from '@angular/core';

/**
 * Esqueleto mientras carga una imagen (los logos de los bancos llegan por
 * /api/logos y, con Directus lento, el recuadro quedaba en blanco): el
 * contenedor de la imagen brilla en gris (`.img-cargando`, en styles.css)
 * hasta que la imagen carga o falla.
 */
@Directive({
  selector: 'img[appEsqueleto]',
  host: {
    '(load)': 'listo()',
    '(error)': 'listo()',
  },
})
export class EsqueletoImagen implements AfterViewInit {
  private readonly img = inject(ElementRef<HTMLImageElement>)
    .nativeElement as HTMLImageElement;

  // Solo en el navegador: en la página armada en el servidor el logo se ve
  // tal cual (si se marcara ahí, quedaría oculto hasta que cargue el JS).
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (this.enNavegador && !this.img.complete)
      this.contenedor()?.classList.add('img-cargando');
  }

  /** Si ya estaba en caché (o cargó antes de hidratar la página). */
  ngAfterViewInit(): void {
    if (this.img.complete) this.listo();
  }

  protected listo(): void {
    this.contenedor()?.classList.remove('img-cargando');
  }

  private contenedor(): HTMLElement | null {
    return this.img.parentElement ?? null;
  }
}
