import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TasaAdmin } from '../../../core/modelos/tasa-admin';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';
import { TasasAdminService } from '../../../core/servicios/tasas-admin.service';
import { leerDecimal, TasasAdmin } from './tasas-admin';

function tasa(cambios: Partial<TasaAdmin>): TasaAdmin {
  return {
    id: 1,
    producto: 'libre-inversion',
    valor_desde: 1.3,
    valor_hasta: 2.13,
    unidad: 'MV',
    ea_desde: 16.77,
    ea_hasta: 28.77,
    tipo_tasa: 'fija',
    sistema_amortizacion: 'no_dice',
    frase: 'Desde 1.30% hasta 2.13%',
    vigente_desde: '2026-07-01',
    capturada: '2026-10-25T17:00:00Z',
    estado: 'por_revisar',
    revisada_en: null,
    notas: null,
    entidad: { codigo: 'bancolombia', nombre: 'Bancolombia', logo: 'logo-1' },
    fuente: {
      id: 3,
      tipo: 'pagina',
      url: 'https://www.bancolombia.com/personas/creditos/consumo/credito-libre-inversion',
      url_indice: null,
    },
    revisada_por: null,
    ...cambios,
  };
}

registerLocaleData(localeEsCo);

describe('TasasAdmin', () => {
  let servicio: jasmine.SpyObj<TasasAdminService>;

  async function crear() {
    servicio = jasmine.createSpyObj<TasasAdminService>('TasasAdminService', [
      'listar',
      'fuentes',
      'cambiarEstado',
      'guardar',
      'crear',
    ]);
    servicio.listar.and.resolveTo([
      tasa({}),
      tasa({
        id: 2,
        estado: 'publicada',
        entidad: { codigo: 'av-villas', nombre: 'AV Villas', logo: null },
      }),
    ]);
    servicio.fuentes.and.resolveTo([]);
    TestBed.configureTestingModule({
      imports: [TasasAdmin],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        { provide: TasasAdminService, useValue: servicio },
        {
          provide: SesionAdmin,
          useValue: {
            usuario: signal({ id: 'u1', email: 'a@b.co', nombre: 'Juan' }),
            urlImagen: (id: string | null) =>
              id ? `https://directus.prueba/assets/${id}` : null,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TasasAdmin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('muestra las tasas por revisar con la fecha y el enlace de la fuente', async () => {
    const { html } = await crear();
    const tarjetas = html.querySelectorAll('.tasa');
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].textContent).toContain('Bancolombia');
    expect(tarjetas[0].textContent).toContain('1,30 % a 2,13 % M.V.');
    expect(tarjetas[0].textContent).toContain('1 jul 2026');
    const enlace = tarjetas[0].querySelector<HTMLAnchorElement>('.fuente a')!;
    expect(enlace.href).toContain('bancolombia.com');
    expect(enlace.target).toBe('_blank');
    expect(enlace.textContent).toContain('bancolombia.com');
  });

  it('filtra por estado', async () => {
    const { fixture, html } = await crear();
    const publicadas = [
      ...html.querySelectorAll<HTMLButtonElement>('.filtro'),
    ].find((b) => b.textContent!.includes('Publicadas'))!;
    expect(publicadas.textContent).toContain('1');
    publicadas.click();
    fixture.detectChanges();
    expect(html.querySelector('.tasa h2')?.textContent).toContain('AV Villas');
  });

  it('publica una tasa', async () => {
    const { fixture, html } = await crear();
    servicio.cambiarEstado.and.resolveTo(tasa({ estado: 'publicada' }));
    const publicar = [
      ...html.querySelectorAll<HTMLButtonElement>('.tasa button'),
    ].find((b) => b.textContent!.includes('Publicar'))!;
    publicar.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.cambiarEstado).toHaveBeenCalledWith(1, 'publicada');
    expect(html.querySelectorAll('.tasa').length).toBe(0);
  });

  it('corrige una tasa y calcula la E.A.', async () => {
    const { fixture, html } = await crear();
    servicio.guardar.and.callFake(async (_id, cambios) => tasa({ ...cambios }));
    [...html.querySelectorAll<HTMLButtonElement>('.tasa button')]
      .find((b) => b.textContent!.includes('Editar'))!
      .click();
    fixture.detectChanges();
    const desde = html.querySelector<HTMLInputElement>('#tfDesde')!;
    desde.value = '1,25';
    desde.dispatchEvent(new Event('input'));
    [...html.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Calcular E.A.'))!
      .click();
    fixture.detectChanges();
    expect(html.querySelector<HTMLInputElement>('#tfEaDesde')!.value).toBe(
      '16,08',
    );
    html.querySelector<HTMLFormElement>('.formulario')!.requestSubmit();
    await fixture.whenStable();
    expect(servicio.guardar).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ valor_desde: 1.25, ea_desde: 16.08 }),
    );
  });

  it('lee decimales con coma o punto', () => {
    expect(leerDecimal('1,3')).toBe(1.3);
    expect(leerDecimal('16.77 %')).toBe(16.77);
    expect(leerDecimal('')).toBeNull();
  });

  it('muestra el logo de la entidad junto al nombre', async () => {
    const { fixture, html } = await crear();
    const logo = html.querySelector<HTMLImageElement>('.tasa .logo img')!;
    expect(logo.src).toBe('https://directus.prueba/assets/logo-1');
    expect(logo.alt).toBe('');
    // Sin logo, solo el nombre.
    [...html.querySelectorAll<HTMLButtonElement>('.filtro')]
      .find((b) => b.textContent!.includes('Publicadas'))!
      .click();
    fixture.detectChanges();
    expect(html.querySelector('.tasa .logo')).toBeNull();
    expect(html.querySelector('.tasa h2')?.textContent).toContain('AV Villas');
  });
});
