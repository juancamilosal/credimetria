import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  TitleStrategy,
} from '@angular/router';
import { filter } from 'rxjs';

export const SITIO = 'https://credimetria.com';
/** Imagen para compartir el enlace (1200 × 630). */
export const IMAGEN_COMPARTIR = `${SITIO}/compartir.png`;
const DESCRIPCION_INICIO =
  'Compara con datos, no con promesas: mira la tasa que anuncian y la que de verdad cobran bancos, cooperativas y financieras en Colombia, y recibe asesoría gratis.';

/** Lo que cada ruta declara en `data` para buscadores y redes. */
export interface DatosSeo {
  descripcion?: string;
  /** La página no se indexa ni lleva canonical (404, administración). */
  noIndexar?: boolean;
}

/**
 * Descripción, enlace canonical, Open Graph y Twitter de cada página. Lee
 * `data.descripcion` de la ruta activa y el título que pone el router; corre
 * también en el servidor, así Google y WhatsApp lo ven sin JavaScript.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly documento = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly titulos = inject(TitleStrategy);

  iniciar(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.aplicar());
  }

  private aplicar(): void {
    let ruta: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    const datos = (ruta.data ?? {}) as DatosSeo;
    // El título de la ruta (el mismo que pone el router en la pestaña).
    const titulo =
      this.titulos.buildTitle(this.router.routerState.snapshot) ??
      this.documento.title;
    const descripcion = datos.descripcion ?? DESCRIPCION_INICIO;
    const camino = this.router.url.split(/[?#]/)[0];
    const url = SITIO + (camino === '/' ? '/' : camino);

    this.meta.updateTag({ name: 'description', content: descripcion });
    this.meta.updateTag({
      name: 'robots',
      content: datos.noIndexar ? 'noindex' : 'index, follow',
    });
    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: descripcion });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: IMAGEN_COMPARTIR });
    this.meta.updateTag({ name: 'twitter:title', content: titulo });
    this.meta.updateTag({ name: 'twitter:description', content: descripcion });
    this.canonical(datos.noIndexar ? null : url);
  }

  private canonical(url: string | null): void {
    let enlace = this.documento.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!url) {
      enlace?.remove();
      return;
    }
    if (!enlace) {
      enlace = this.documento.createElement('link');
      enlace.setAttribute('rel', 'canonical');
      this.documento.head.appendChild(enlace);
    }
    enlace.setAttribute('href', url);
  }
}
