import { Component, computed, input } from '@angular/core';
import { Foto as DatosFoto } from '../../core/datos/fotos';

/**
 * Foto de la marca en dos tamaños (640 y 1280 px). El navegador elige el
 * adecuado según `tamanos`. Con `prioritaria` se carga de una vez (portada);
 * si no, se carga cuando está por aparecer en pantalla.
 */
@Component({
  selector: 'app-foto',
  template: `
    <img
      [src]="'/imagenes/' + foto().nombre + '-1280.webp'"
      [attr.srcset]="srcset()"
      [attr.sizes]="tamanos()"
      [alt]="foto().alt"
      [width]="foto().ancho"
      [height]="foto().alto"
      [attr.loading]="prioritaria() ? 'eager' : 'lazy'"
      [attr.fetchpriority]="prioritaria() ? 'high' : null"
      decoding="async"
    />
  `,
  styles: `
    :host {
      display: block;
      overflow: hidden;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class Foto {
  readonly foto = input.required<DatosFoto>();
  /** Ancho con el que se muestra, para elegir el tamaño (atributo `sizes`). */
  readonly tamanos = input('100vw');
  readonly prioritaria = input(false);

  protected readonly srcset = computed(() => {
    const ruta = '/imagenes/' + this.foto().nombre;
    return `${ruta}-640.webp 640w, ${ruta}-1280.webp 1280w`;
  });
}
