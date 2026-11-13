import { TestBed } from '@angular/core/testing';
import { AnaliticaService, HOSTS_ANALITICA } from './analitica.service';

describe('AnaliticaService (Google Analytics sin aviso)', () => {
  const etiqueta = () =>
    document.head.querySelector('script[src*="googletagmanager.com/gtm.js"]');

  function crear(hosts: string[]) {
    TestBed.configureTestingModule({
      providers: [{ provide: HOSTS_ANALITICA, useValue: hosts }],
    });
    return TestBed.inject(AnaliticaService);
  }

  beforeEach(() => {
    etiqueta()?.remove();
    delete (window as { dataLayer?: unknown }).dataLayer;
  });

  afterEach(() => etiqueta()?.remove());

  it('en credimetria.com carga la etiqueta de Google sin preguntar y manda eventos', () => {
    localStorage.setItem('credimetria-cookies', 'rechazadas');
    const analitica = crear([location.hostname]);
    analitica.iniciar();
    expect(etiqueta()?.getAttribute('src')).toContain('id=GTM-NLJW2HG2');
    // La elección del aviso viejo ya no cuenta y se borra.
    expect(localStorage.getItem('credimetria-cookies')).toBeNull();
    analitica.evento('generate_lead', { formulario: 'asesoria' });
    const capa = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
    expect(JSON.stringify(capa)).toContain('generate_lead');
  });

  it('fuera de credimetria.com no carga nada ni manda eventos', () => {
    const analitica = crear(['credimetria.com']);
    analitica.iniciar();
    analitica.evento('generate_lead');
    expect(etiqueta()).toBeNull();
    const capa = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
    expect(JSON.stringify(capa)).not.toContain('generate_lead');
  });
});
