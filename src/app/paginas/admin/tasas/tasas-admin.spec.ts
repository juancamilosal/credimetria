import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DocumentoPdf, FuenteAdmin } from '../../../core/modelos/documento';
import { TasaAdmin } from '../../../core/modelos/tasa-admin';
import { DocumentosAdminService } from '../../../core/servicios/documentos-admin.service';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';
import { TasasAdminService } from '../../../core/servicios/tasas-admin.service';
import { leerDecimal, TasasAdmin } from './tasas-admin';

registerLocaleData(localeEsCo);

const BBVA = { codigo: 'bbva', nombre: 'BBVA', logo: 'logo-bbva' };

const fuentes: FuenteAdmin[] = [
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
];

function documento(cambios: Partial<DocumentoPdf>): DocumentoPdf {
  return {
    id: 10,
    fuente: 2,
    archivo: { id: 'f10', filename_download: 'tasas-sep.pdf', filesize: 1000 },
    estado: 'actual',
    vigente_desde: '2026-09-01',
    origen: 'manual',
    huella: null,
    notas: null,
    date_created: '2026-09-02T15:00:00Z',
    user_created: { first_name: 'Juan', last_name: 'Salazar' },
    ...cambios,
  };
}

const docActual = documento({});
const docNuevo = documento({
  id: 11,
  estado: 'nuevo',
  vigente_desde: '2026-10-05',
  archivo: { id: 'f11', filename_download: 'tasas-oct.pdf', filesize: 1000 },
});

function tasa(cambios: Partial<TasaAdmin>): TasaAdmin {
  return {
    id: 1,
    producto: 'libre-inversion',
    valor_desde: 1.7,
    valor_hasta: 2.12,
    unidad: 'MV',
    ea_desde: 22.42,
    ea_hasta: 28.56,
    tipo_tasa: 'fija',
    sistema_amortizacion: 'cuota_fija',
    frase: null,
    vigente_desde: '2026-09-01',
    capturada: null,
    estado: 'publicada',
    revisada_en: '2026-09-02T16:00:00Z',
    notas: null,
    entidad: BBVA,
    fuente: null,
    revisada_por: { first_name: 'Juan', last_name: 'Salazar' },
    captura: null,
    documento: {
      id: 10,
      estado: 'actual',
      vigente_desde: '2026-09-01',
      archivo: { id: 'f10', filename_download: 'tasas-sep.pdf' },
    },
    ...cambios,
  };
}

const publicada = tasa({});
const porAprobar = tasa({
  id: 2,
  valor_desde: 1.77,
  ea_desde: 23.47,
  estado: 'por_revisar',
  vigente_desde: '2026-10-05',
  revisada_en: null,
  revisada_por: null,
  frase: 'Tasa Mínima 23,47 % E.A. 1,77 % M.V.',
  documento: {
    id: 11,
    estado: 'nuevo',
    vigente_desde: '2026-10-05',
    archivo: { id: 'f11', filename_download: 'tasas-oct.pdf' },
  },
});

describe('TasasAdmin', () => {
  let admin: jasmine.SpyObj<TasasAdminService>;
  let docs: jasmine.SpyObj<DocumentosAdminService>;
  let descargar: jasmine.Spy;
  let fixture: ComponentFixture<TasasAdmin>;
  let html: HTMLElement;

  async function crear() {
    admin = jasmine.createSpyObj<TasasAdminService>('TasasAdminService', [
      'listar',
      'cambiarEstado',
      'guardar',
      'aprobar',
      'crearDesdeDocumento',
    ]);
    docs = jasmine.createSpyObj<DocumentosAdminService>(
      'DocumentosAdminService',
      [
        'entidades',
        'fuentes',
        'documentos',
        'cargar',
        'agregarFuente',
        'editarFuente',
      ],
    );
    admin.listar.and.resolveTo([porAprobar, publicada]);
    docs.entidades.and.resolveTo([
      BBVA,
      { codigo: 'davivienda', nombre: 'Davivienda', logo: null },
    ]);
    docs.fuentes.and.resolveTo(fuentes);
    docs.documentos.and.resolveTo([docNuevo, docActual]);
    descargar = jasmine
      .createSpy('descargar')
      .and.callFake(
        async () => new Blob(['%PDF'], { type: 'application/pdf' }),
      );
    TestBed.configureTestingModule({
      imports: [TasasAdmin],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        { provide: TasasAdminService, useValue: admin },
        { provide: DocumentosAdminService, useValue: docs },
        {
          provide: SesionAdmin,
          useValue: {
            usuario: signal({ id: 'u1', email: 'a@b.co', nombre: 'Juan' }),
            urlImagen: (id: string | null) =>
              id ? `https://d/assets/${id}` : null,
            urlArchivo: (id: string) => `https://d/assets/${id}`,
            descargar,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(TasasAdmin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    html = fixture.nativeElement;
  }

  const boton = (raiz: ParentNode, texto: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(texto),
    )!;

  async function esperar() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra la tasa publicada y la que espera aprobación, cada una con su PDF', async () => {
    await crear();
    const bbva = html.querySelector('.banco')!;
    const hoy = bbva.querySelector('[aria-label="Publicada hoy"]')!;
    expect(hoy.textContent).toContain('1,70 % a 2,12 % M.V.');
    expect(hoy.textContent).toContain('tasas-sep.pdf');
    expect(hoy.querySelector('.doc a')!.getAttribute('href')).toBe(
      'https://d/assets/f10',
    );
    const nueva = bbva.querySelector('[aria-label="Por aprobar"]')!;
    expect(nueva.textContent).toContain('1,77 % a 2,12 % M.V.');
    expect(nueva.textContent).toContain('tasas-oct.pdf');
    expect(nueva.textContent).toContain('5 oct 2026');
    // Lo que cambia frente a la publicada.
    expect(nueva.querySelector('.cambios')?.textContent).toContain(
      'mín. ▲ +1,05 pts',
    );
    expect(nueva.querySelector('.cambios')?.textContent).toContain(
      'máx. igual',
    );
    expect(bbva.textContent).toContain('Tasas y tarifas');
  });

  it('aprueba: la nueva se publica y la anterior pasa al historial', async () => {
    await crear();
    admin.aprobar.and.resolveTo({ ...porAprobar, estado: 'publicada' });
    const bbva = html.querySelector('.banco')!;
    boton(bbva, 'Aprobar').click();
    await esperar();
    const [nueva, antes, documentos] = admin.aprobar.calls.mostRecent().args;
    expect(nueva.id).toBe(2);
    expect(antes?.id).toBe(1);
    expect(documentos.map((d) => d.id)).toEqual([11, 10]);
    expect(
      bbva.querySelector('[aria-label="Publicada hoy"]')!.textContent,
    ).toContain('1,77 %');
    expect(
      bbva.querySelector('[aria-label="Por aprobar"]')!.textContent,
    ).toContain('Nada por aprobar');
    expect(bbva.querySelector('.historial summary')?.textContent).toContain(
      '(1)',
    );
  });

  it('compara los dos PDF lado a lado', async () => {
    await crear();
    boton(html.querySelector('.banco')!, 'Comparar PDF').click();
    await esperar();
    expect(descargar).toHaveBeenCalledWith('f11');
    expect(descargar).toHaveBeenCalledWith('f10');
    const dialogo = html.querySelector('.comparar')!;
    expect(dialogo.getAttribute('role')).toBe('dialog');
    expect(dialogo.querySelectorAll('iframe').length).toBe(2);
    expect(dialogo.textContent).toContain('PDF actual');
    expect(dialogo.textContent).toContain('Por aprobar');
    boton(dialogo, 'Cerrar').click();
    fixture.detectChanges();
    expect(html.querySelector('.comparar')).toBeNull();
  });

  it('carga un PDF nuevo y abre la tasa unida a él para escribir los valores', async () => {
    await crear();
    const subido = documento({
      id: 12,
      estado: 'nuevo',
      archivo: { id: 'f12', filename_download: 'nov.pdf', filesize: 1 },
    });
    docs.cargar.and.resolveTo(subido);
    admin.crearDesdeDocumento.and.resolveTo(
      tasa({
        id: 3,
        estado: 'por_revisar',
        valor_desde: null,
        valor_hasta: null,
        ea_desde: null,
        ea_hasta: null,
        documento: {
          id: 12,
          estado: 'nuevo',
          vigente_desde: null,
          archivo: { id: 'f12', filename_download: 'nov.pdf' },
        },
      }),
    );
    const bbva = html.querySelector('.banco')!;
    boton(bbva, 'Cargar PDF nuevo').click();
    fixture.detectChanges();
    const campo = bbva.querySelector<HTMLInputElement>('input[type="file"]')!;
    const pdf = new File(['%PDF'], 'nov.pdf', { type: 'application/pdf' });
    Object.defineProperty(campo, 'files', { value: [pdf] });
    campo.dispatchEvent(new Event('change'));
    bbva.querySelector<HTMLFormElement>('.carga')!.requestSubmit();
    await esperar();
    expect(docs.cargar).toHaveBeenCalledWith(2, pdf, null);
    expect(admin.crearDesdeDocumento).toHaveBeenCalledWith(fuentes[1], subido);
    expect(bbva.querySelector<HTMLSelectElement>('#tfDocumento')!.value).toBe(
      '12',
    );
  });

  it('corrige una tasa, calcula la E.A. y guarda de qué PDF salió', async () => {
    await crear();
    admin.guardar.and.callFake(
      async (_id, cambios) =>
        // Directus devuelve el PDF ya expandido, no solo su id.
        ({
          ...porAprobar,
          ...cambios,
          documento: porAprobar.documento,
        }) as TasaAdmin,
    );
    const bbva = html.querySelector('.banco')!;
    [...bbva.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.trim() === 'Editar')!
      .click();
    fixture.detectChanges();
    const desde = bbva.querySelector<HTMLInputElement>('#tfDesde')!;
    desde.value = '1,25';
    desde.dispatchEvent(new Event('input'));
    boton(bbva, 'Calcular E.A.').click();
    fixture.detectChanges();
    expect(bbva.querySelector<HTMLInputElement>('#tfEaDesde')!.value).toBe(
      '16,08',
    );
    bbva.querySelector<HTMLFormElement>('.formulario')!.requestSubmit();
    await esperar();
    expect(admin.guardar).toHaveBeenCalledWith(
      2,
      jasmine.objectContaining({
        documento: 11,
        valor_desde: 1.25,
        ea_desde: 16.08,
      }),
    );
  });

  it('a un banco sin PDF le pide la dirección', async () => {
    await crear();
    docs.agregarFuente.and.resolveTo({
      id: 9,
      producto: 'libre-inversion',
      tipo: 'pdf',
      url: 'https://www.davivienda.com/t.pdf',
      url_indice: null,
      entidad: 'davivienda',
    });
    const davivienda = html.querySelectorAll('.banco')[1];
    expect(davivienda.textContent).toContain('primero agrega su dirección');
    boton(davivienda, 'Agregar dirección del PDF').click();
    fixture.detectChanges();
    const [campo] =
      davivienda.querySelectorAll<HTMLInputElement>('input[type="url"]');
    campo.value = 'https://www.davivienda.com/t.pdf';
    campo.dispatchEvent(new Event('input'));
    boton(davivienda, 'Guardar direcciones').click();
    await esperar();
    expect(docs.agregarFuente).toHaveBeenCalledWith(
      'davivienda',
      'libre-inversion',
      {
        url: 'https://www.davivienda.com/t.pdf',
        url_indice: null,
      },
    );
    expect(html.querySelectorAll('.banco')[1].textContent).toContain(
      'Cargar PDF nuevo',
    );
  });

  it('filtra los bancos con algo por aprobar', async () => {
    await crear();
    const filtro = boton(html, 'Por aprobar');
    expect(filtro.textContent).toContain('1');
    filtro.click();
    fixture.detectChanges();
    expect(html.querySelectorAll('.banco').length).toBe(1);
  });

  it('lee decimales con coma o punto', () => {
    expect(leerDecimal('1,3')).toBe(1.3);
    expect(leerDecimal('16.77 %')).toBe(16.77);
    expect(leerDecimal('')).toBeNull();
  });
});
