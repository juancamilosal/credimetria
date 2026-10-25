import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DocumentoPdf } from '../../../core/modelos/documento';
import { DocumentosAdminService } from '../../../core/servicios/documentos-admin.service';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';
import { PdfTasas } from './pdf-tasas';

registerLocaleData(localeEsCo);

const doc = (cambios: Partial<DocumentoPdf>): DocumentoPdf => ({
  id: 1,
  fuente: 2,
  archivo: { id: 'f1', filename_download: 'tasas-sep.pdf', filesize: 204800 },
  estado: 'actual',
  vigente_desde: '2026-09-01',
  origen: 'manual',
  huella: null,
  notas: null,
  date_created: '2026-09-02T15:00:00Z',
  user_created: { first_name: 'Juan', last_name: 'Salazar' },
  ...cambios,
});

describe('PdfTasas', () => {
  let servicio: jasmine.SpyObj<DocumentosAdminService>;

  async function crear() {
    servicio = jasmine.createSpyObj<DocumentosAdminService>(
      'DocumentosAdminService',
      [
        'entidades',
        'fuentes',
        'documentos',
        'cargar',
        'usarComoActual',
        'descartar',
        'agregarFuente',
        'editarFuente',
      ],
    );
    servicio.entidades.and.resolveTo([
      { codigo: 'bbva', nombre: 'BBVA', logo: 'logo-bbva' },
      { codigo: 'davivienda', nombre: 'Davivienda', logo: null },
    ]);
    servicio.fuentes.and.resolveTo([
      {
        id: 1,
        producto: 'libre-inversion',
        tipo: 'pagina',
        url: 'https://www.bbva.com.co/li.html',
        url_indice: null,
        entidad: 'bbva',
      },
      {
        id: 2,
        producto: 'libre-inversion',
        tipo: 'pdf',
        url: 'https://www.bbva.com.co/tasas.pdf',
        url_indice: 'https://www.bbva.com.co/tasas-y-tarifas.html',
        entidad: 'bbva',
      },
      {
        id: 4,
        producto: 'libre-inversion',
        tipo: 'pagina',
        url: 'https://www.davivienda.com/li',
        url_indice: null,
        entidad: 'davivienda',
      },
    ]);
    servicio.documentos.and.resolveTo([
      doc({}),
      doc({
        id: 2,
        estado: 'nuevo',
        vigente_desde: '2026-10-05',
        archivo: {
          id: 'f2',
          filename_download: 'tasas-oct.pdf',
          filesize: 300000,
        },
        origen: 'robot',
      }),
      doc({
        id: 3,
        estado: 'anterior',
        vigente_desde: '2026-08-01',
        archivo: { id: 'f3', filename_download: 'tasas-ago.pdf', filesize: 1 },
      }),
    ]);
    TestBed.configureTestingModule({
      imports: [PdfTasas],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        { provide: DocumentosAdminService, useValue: servicio },
        {
          provide: SesionAdmin,
          useValue: {
            usuario: signal({ id: 'u1', email: 'a@b.co', nombre: 'Juan' }),
            urlImagen: (id: string | null) =>
              id ? `https://d/assets/${id}` : null,
            urlArchivo: (id: string) => `https://d/assets/${id}`,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PdfTasas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('muestra el PDF actual y el nuevo de cada banco', async () => {
    const { html } = await crear();
    const bbva = html.querySelectorAll('.banco')[0];
    const actual = bbva.querySelector('[aria-label="PDF actual"]')!;
    expect(actual.textContent).toContain('tasas-sep.pdf');
    expect(actual.textContent).toContain('1 sept 2026');
    expect(actual.textContent).toContain('Juan Salazar');
    expect(actual.querySelector('a')!.getAttribute('href')).toBe(
      'https://d/assets/f1',
    );
    const nuevo = bbva.querySelector('[aria-label="PDF nuevo"]')!;
    expect(nuevo.textContent).toContain('tasas-oct.pdf');
    expect(nuevo.textContent).toContain('el robot');
    expect(bbva.querySelector('.anteriores summary')?.textContent).toContain(
      '(1)',
    );
    expect(html.querySelector('.pendientes')?.textContent).toContain(
      '1 PDF nuevo por revisar',
    );
  });

  it('usa el nuevo como actual y guarda el anterior', async () => {
    const { fixture, html } = await crear();
    servicio.usarComoActual.and.resolveTo();
    [...html.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Usar como actual'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    const [nuevo, actual] = servicio.usarComoActual.calls.mostRecent().args;
    expect(nuevo.id).toBe(2);
    expect(actual?.id).toBe(1);
    const bbva = html.querySelectorAll('.banco')[0];
    expect(
      bbva.querySelector('[aria-label="PDF actual"]')!.textContent,
    ).toContain('tasas-oct.pdf');
    expect(bbva.querySelector('.anteriores summary')?.textContent).toContain(
      '(2)',
    );
  });

  it('pide la dirección del PDF a un banco que no la tiene', async () => {
    const { fixture, html } = await crear();
    servicio.agregarFuente.and.resolveTo({
      id: 9,
      producto: 'libre-inversion',
      tipo: 'pdf',
      url: 'https://www.davivienda.com/tasas.pdf',
      url_indice: null,
      entidad: 'davivienda',
    });
    const davivienda = html.querySelectorAll('.banco')[1];
    expect(davivienda.textContent).toContain('todavía no tiene la dirección');
    const [campo, indice] =
      davivienda.querySelectorAll<HTMLInputElement>('input[type="url"]');
    campo.value = 'https://www.davivienda.com/tasas.pdf';
    campo.dispatchEvent(new Event('input'));
    indice.value = 'https://www.davivienda.com/tasas-y-tarifas';
    indice.dispatchEvent(new Event('input'));
    [...davivienda.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Agregar'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.agregarFuente).toHaveBeenCalledWith(
      'davivienda',
      'libre-inversion',
      {
        url: 'https://www.davivienda.com/tasas.pdf',
        url_indice: 'https://www.davivienda.com/tasas-y-tarifas',
      },
    );
    expect(html.querySelectorAll('.banco')[1].textContent).toContain(
      'Cargar PDF',
    );
  });

  it('carga un PDF nuevo con su vigencia', async () => {
    const { fixture, html } = await crear();
    servicio.cargar.and.resolveTo(
      doc({
        id: 7,
        estado: 'nuevo',
        archivo: { id: 'f7', filename_download: 'nuevo.pdf', filesize: 10 },
      }),
    );
    const bbva = html.querySelectorAll('.banco')[0];
    bbva.querySelector<HTMLButtonElement>('.cargar')!.click();
    fixture.detectChanges();
    const archivo = bbva.querySelector<HTMLInputElement>('input[type="file"]')!;
    const pdf = new File(['%PDF'], 'nuevo.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'files', { value: [pdf] });
    archivo.dispatchEvent(new Event('change'));
    const fecha = bbva.querySelector<HTMLInputElement>('input[type="date"]')!;
    fecha.value = '2026-11-01';
    fecha.dispatchEvent(new Event('input'));
    bbva.querySelector<HTMLFormElement>('.carga')!.requestSubmit();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.cargar).toHaveBeenCalledWith(2, pdf, '2026-11-01');
    expect(html.querySelector('.aviso-ok')?.textContent).toContain(
      'PDF de BBVA cargado',
    );
  });

  it('corrige la dirección del PDF y la página de tasas y tarifas', async () => {
    const { fixture, html } = await crear();
    servicio.editarFuente.and.callFake(async (id, d) => ({
      id,
      producto: 'libre-inversion',
      tipo: 'pdf',
      entidad: 'bbva',
      ...d,
    }));
    const bbva = html.querySelectorAll('.banco')[0];
    [...bbva.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Editar direcciones'))!
      .click();
    fixture.detectChanges();
    const [campo] =
      bbva.querySelectorAll<HTMLInputElement>('.direcciones input');
    expect(campo.value).toBe('https://www.bbva.com.co/tasas.pdf');
    campo.value = 'https://www.bbva.com.co/tasas-nov.pdf';
    campo.dispatchEvent(new Event('input'));
    [...bbva.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Guardar direcciones'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.editarFuente).toHaveBeenCalledWith(2, {
      url: 'https://www.bbva.com.co/tasas-nov.pdf',
      url_indice: 'https://www.bbva.com.co/tasas-y-tarifas.html',
    });
    expect(bbva.querySelector('.enlaces a')!.getAttribute('href')).toBe(
      'https://www.bbva.com.co/tasas-nov.pdf',
    );
  });

  it('no acepta la página índice vacía como dirección del PDF', async () => {
    const { fixture, html } = await crear();
    const davivienda = html.querySelectorAll('.banco')[1];
    [...davivienda.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Agregar'))!
      .click();
    fixture.detectChanges();
    expect(servicio.agregarFuente).not.toHaveBeenCalled();
    expect(html.querySelector('.aviso-error')?.textContent).toContain(
      'dirección directa del PDF',
    );
  });
});
