import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { SeoService } from './seo.service';

@Component({ template: '' })
class Vacia {}

describe('SeoService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'ranking',
            title: 'Ranking de tasas · Credimetría',
            data: { descripcion: 'Ranking de tasas de crédito.' },
            component: Vacia,
          },
          {
            path: '**',
            title: 'Página no encontrada · Credimetría',
            data: { noIndexar: true },
            component: Vacia,
          },
        ]),
      ],
    });
    TestBed.inject(SeoService).iniciar();
  });

  it('pone la descripción, el canonical y Open Graph de cada ruta', async () => {
    await TestBed.inject(Router).navigateByUrl('/ranking?producto=libranza');
    const meta = TestBed.inject(Meta);
    const documento = TestBed.inject(DOCUMENT);
    expect(meta.getTag('name="description"')?.content).toBe(
      'Ranking de tasas de crédito.',
    );
    expect(meta.getTag('property="og:url"')?.content).toBe(
      'https://credimetria.com/ranking',
    );
    expect(meta.getTag('property="og:title"')?.content).toBe(
      'Ranking de tasas · Credimetría',
    );
    expect(meta.getTag('property="og:image"')?.content).toBe(
      'https://credimetria.com/compartir.png',
    );
    expect(
      documento.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe('https://credimetria.com/ranking');
  });

  it('la página no encontrada no se indexa ni lleva canonical', async () => {
    await TestBed.inject(Router).navigateByUrl('/glosario');
    const documento = TestBed.inject(DOCUMENT);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      'noindex',
    );
    expect(documento.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
