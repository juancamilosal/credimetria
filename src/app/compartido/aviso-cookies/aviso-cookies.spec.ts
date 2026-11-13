import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AnaliticaService,
  HOSTS_ANALITICA,
} from '../../core/servicios/analitica.service';
import { AvisoCookies } from './aviso-cookies';

describe('Aviso de cookies y Google Analytics', () => {
  const CLAVE = 'credimetria-cookies';
  const etiqueta = () =>
    document.head.querySelector('script[src*="googletagmanager.com/gtm.js"]');

  function crear(hosts: string[] = ['otro-sitio.com']) {
    TestBed.configureTestingModule({
      imports: [AvisoCookies],
      providers: [
        provideRouter([]),
        { provide: HOSTS_ANALITICA, useValue: hosts },
      ],
    });
    const fixture = TestBed.createComponent(AvisoCookies);
    const analitica = TestBed.inject(AnaliticaService);
    analitica.iniciar();
    fixture.detectChanges();
    return { fixture, analitica, html: fixture.nativeElement as HTMLElement };
  }

  function boton(html: HTMLElement, texto: string) {
    return [...html.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === texto,
    )!;
  }

  beforeEach(() => {
    localStorage.removeItem(CLAVE);
    etiqueta()?.remove();
    delete (window as { dataLayer?: unknown }).dataLayer;
  });

  afterEach(() => {
    localStorage.removeItem(CLAVE);
    etiqueta()?.remove();
  });

  it('pregunta mientras la persona no haya elegido y no carga Analytics', () => {
    const { html } = crear([location.hostname]);
    expect(html.textContent).toContain('Usamos cookies de Google Analytics');
    expect(etiqueta()).toBeNull();
  });

  it('al aceptar guarda la elección, oculta el aviso y carga la etiqueta de Google', () => {
    const { fixture, html } = crear([location.hostname]);
    boton(html, 'Aceptar').click();
    fixture.detectChanges();
    expect(localStorage.getItem(CLAVE)).toBe('aceptadas');
    expect(html.querySelector('.aviso')).toBeNull();
    expect(etiqueta()?.getAttribute('src')).toContain('id=GTM-NLJW2HG2');
  });

  it('al rechazar no carga nada y los eventos no se envían', () => {
    const { fixture, html, analitica } = crear([location.hostname]);
    boton(html, 'Rechazar').click();
    fixture.detectChanges();
    expect(localStorage.getItem(CLAVE)).toBe('rechazadas');
    analitica.evento('generate_lead', { formulario: 'asesoria' });
    expect(etiqueta()).toBeNull();
    const capa = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
    expect(JSON.stringify(capa)).not.toContain('generate_lead');
  });

  it('fuera de credimetria.com nunca carga la etiqueta, aunque acepte', () => {
    const { fixture, html } = crear(['credimetria.com']);
    boton(html, 'Aceptar').click();
    fixture.detectChanges();
    expect(etiqueta()).toBeNull();
  });

  it('si ya eligió no vuelve a preguntar, salvo desde "Preferencias de cookies"', () => {
    localStorage.setItem(CLAVE, 'rechazadas');
    const { fixture, html, analitica } = crear();
    expect(html.querySelector('.aviso')).toBeNull();
    analitica.cambiarPreferencias();
    fixture.detectChanges();
    expect(html.querySelector('.aviso')).not.toBeNull();
  });
});
