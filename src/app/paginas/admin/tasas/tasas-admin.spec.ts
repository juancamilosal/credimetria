import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DocumentoPdf, FuenteAdmin } from '../../../core/modelos/documento';
import { TasaAdmin } from '../../../core/modelos/tasa-admin';
import {
  DocumentoRepetido,
  DocumentosAdminService,
} from '../../../core/servicios/documentos-admin.service';
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
    hasta_origen: 'entidad',
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
    await crearCon([porAprobar, publicada]);
  }

  async function crearCon(lista: TasaAdmin[], deBancos = fuentes) {
    admin = jasmine.createSpyObj<TasasAdminService>('TasasAdminService', [
      'listar',
      'cambiarEstado',
      'guardar',
      'aprobar',
      'crearDesdeDocumento',
      'unirDocumento',
      'leerPdf',
      'eliminar',
      'restaurar',
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
        'reemplazarArchivo',
        'descartar',
        'guardarResaltado',
        'cambiarVigencia',
      ],
    );
    admin.leerPdf.and.resolveTo({ leida: false, problemas: ['Sin regla.'] });
    admin.listar.and.resolveTo(lista);
    docs.entidades.and.resolveTo([
      BBVA,
      { codigo: 'davivienda', nombre: 'Davivienda', logo: null },
    ]);
    docs.fuentes.and.resolveTo(deBancos);
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

  it('abre y compara la copia con la tasa resaltada, si la hay', async () => {
    await crearCon([
      {
        ...porAprobar,
        documento: {
          ...porAprobar.documento!,
          archivo_resaltado: { id: 'r11' },
        },
      },
      publicada,
    ]);
    const nueva = html.querySelector('[aria-label="Por aprobar"]')!;
    expect(nueva.querySelector('a.abrir')?.getAttribute('href')).toBe(
      'https://d/assets/r11',
    );
    expect(nueva.querySelector('.resaltado a')?.getAttribute('href')).toBe(
      'https://d/assets/f11',
    );
    boton(html.querySelector('.banco')!, 'Comparar PDF').click();
    await esperar();
    expect(descargar).toHaveBeenCalledWith('r11');
    expect(descargar).not.toHaveBeenCalledWith('f11');
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

  it('aprueba desde la comparación sin cerrarla antes', async () => {
    await crear();
    admin.aprobar.and.resolveTo({ ...porAprobar, estado: 'publicada' });
    boton(html.querySelector('.banco')!, 'Comparar PDF').click();
    await esperar();
    const tasa = html.querySelector(
      '.comparar [aria-label="Tasa por aprobar"]',
    )!;
    expect(tasa.textContent).toContain('1,77 % a 2,12 % M.V.');
    boton(tasa, 'Editar').click();
    fixture.detectChanges();
    expect(tasa.querySelector('form')).not.toBeNull();
    // El formulario no se repite detrás, en la tarjeta.
    expect(html.querySelectorAll('form.formulario').length).toBe(1);
    boton(tasa, 'Cancelar').click();
    fixture.detectChanges();
    boton(tasa, 'Aprobar').click();
    await esperar();
    expect(admin.aprobar.calls.mostRecent().args[0].id).toBe(2);
    expect(html.querySelector('.comparar')).toBeNull();
    expect(html.textContent).toContain('aprobada y publicada');
  });

  /** Elige y carga un PDF en la primera tarjeta. */
  async function cargarEn(bbva: Element, pdf: File) {
    boton(bbva, 'Cargar PDF nuevo').click();
    fixture.detectChanges();
    const campo = bbva.querySelector<HTMLInputElement>(
      '.carga input[type="file"]',
    )!;
    Object.defineProperty(campo, 'files', { value: [pdf] });
    campo.dispatchEvent(new Event('change'));
    bbva.querySelector<HTMLFormElement>('.carga')!.requestSubmit();
    await esperar();
  }

  const subido = documento({
    id: 12,
    estado: 'nuevo',
    vigente_desde: null,
    archivo: { id: 'f12', filename_download: 'nov.pdf', filesize: 1 },
  });
  const docSubido = {
    id: 12,
    estado: 'nuevo' as const,
    vigente_desde: null,
    archivo: { id: 'f12', filename_download: 'nov.pdf' },
  };

  it('carga un PDF y lo une a la tasa por aprobar sin borrar sus valores', async () => {
    await crear();
    docs.cargar.and.resolveTo(subido);
    admin.unirDocumento.and.resolveTo({ ...porAprobar, documento: docSubido });
    const bbva = html.querySelector('.banco')!;
    const pdf = new File(['%PDF'], 'nov.pdf', { type: 'application/pdf' });
    await cargarEn(bbva, pdf);
    expect(docs.cargar).toHaveBeenCalledWith(2, pdf, null);
    expect(admin.unirDocumento).toHaveBeenCalledWith(porAprobar, subido);
    expect(admin.crearDesdeDocumento).not.toHaveBeenCalled();
    // El formulario abre con los valores que ya tenía y el PDF nuevo.
    expect(bbva.querySelector<HTMLSelectElement>('#tfDocumento')!.value).toBe(
      '12',
    );
    expect(bbva.querySelector<HTMLInputElement>('#tfDesde')!.value).toBe(
      '1,77',
    );
    expect(html.textContent).toContain('Las tasas quedaron como estaban');
  });

  it('lee el PDF cargado y llena el formulario con lo leído', async () => {
    await crear();
    docs.cargar.and.resolveTo(subido);
    admin.unirDocumento.and.resolveTo({ ...porAprobar, documento: docSubido });
    admin.leerPdf.and.resolveTo({
      leida: true,
      problemas: [],
      tasa: {
        unidad: 'MV',
        valor_desde: 1.3,
        valor_hasta: 2.118,
        ea_desde: 16.76,
        ea_hasta: 28.59,
        hasta_origen: 'usura',
        vigente_desde: '2026-10-19',
        frase: 'Créditos de Libranza 1,30%',
        solo_maxima: false,
        usura_mes: 'octubre de 2026',
      },
      resaltado: btoa('%PDF resaltado'),
    });
    docs.guardarResaltado.and.resolveTo({
      ...subido,
      archivo_resaltado: { id: 'r12' },
    });
    const bbva = html.querySelector('.banco')!;
    const pdf = new File(['%PDF'], 'nov.pdf', { type: 'application/pdf' });
    await cargarEn(bbva, pdf);
    expect(admin.leerPdf).toHaveBeenCalledWith('bbva', 'libre-inversion', pdf);
    expect(bbva.querySelector<HTMLInputElement>('#tfDesde')!.value).toBe('1,3');
    expect(bbva.querySelector<HTMLInputElement>('#tfHasta')!.value).toBe(
      '2,118',
    );
    expect(docs.guardarResaltado).toHaveBeenCalledWith(
      subido,
      btoa('%PDF resaltado'),
    );
    expect(html.textContent).toContain('Leí sus tasas y llené el formulario');
    // No guarda solo: espera a que se revise.
    expect(admin.guardar).not.toHaveBeenCalled();
  });

  it('si el PDF ya estaba cargado en la tarjeta, lo vuelve a usar y a leer', async () => {
    await crear();
    // El mismo PDF que ya tiene la tasa por aprobar (documento 11).
    docs.cargar.and.rejectWith(new DocumentoRepetido(docNuevo));
    const pdf = new File(['%PDF'], 'oct.pdf', { type: 'application/pdf' });
    await cargarEn(html.querySelector('.banco')!, pdf);
    expect(admin.unirDocumento).not.toHaveBeenCalled();
    expect(admin.crearDesdeDocumento).not.toHaveBeenCalled();
    expect(admin.leerPdf).toHaveBeenCalledWith('bbva', 'libre-inversion', pdf);
    expect(html.textContent).toContain('ya estaba cargado: lo volví a usar');
    expect(html.textContent).not.toContain('No se cargó de nuevo');
  });

  it('un PDF repetido de otro banco sigue sin cargarse', async () => {
    await crear();
    docs.cargar.and.rejectWith(
      new DocumentoRepetido(documento({ id: 50, fuente: 99 })),
    );
    await cargarEn(
      html.querySelector('.banco')!,
      new File(['%PDF'], 'otro.pdf', { type: 'application/pdf' }),
    );
    expect(html.textContent).toContain('No se cargó de nuevo');
  });

  it('sin tasa por aprobar, la nueva copia los valores de la publicada', async () => {
    await crearCon([publicada]);
    docs.cargar.and.resolveTo(subido);
    admin.crearDesdeDocumento.and.resolveTo(
      tasa({ id: 3, estado: 'por_revisar', documento: docSubido }),
    );
    await cargarEn(
      html.querySelector('.banco')!,
      new File(['%PDF'], 'nov.pdf', { type: 'application/pdf' }),
    );
    expect(admin.crearDesdeDocumento).toHaveBeenCalledWith(
      fuentes[1],
      subido,
      publicada,
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
    [
      ...bbva
        .querySelector('[aria-label="Por aprobar"]')!
        .querySelectorAll<HTMLButtonElement>('button'),
    ]
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

  it('a un banco que solo publica en su página le carga un pantallazo', async () => {
    const pagina: FuenteAdmin = {
      id: 5,
      producto: 'libre-inversion',
      tipo: 'pagina',
      url: 'https://www.davivienda.com/tasas',
      url_indice: null,
      entidad: 'davivienda',
    };
    await crearCon([], [...fuentes, pagina]);
    const subido = documento({ id: 13, fuente: 5, estado: 'nuevo' });
    docs.cargar.and.resolveTo(subido);
    admin.crearDesdeDocumento.and.resolveTo(
      tasa({ id: 4, estado: 'por_revisar', documento: null }),
    );
    const davivienda = html.querySelectorAll('.banco')[1];
    expect(davivienda.textContent).not.toContain('primero agrega');
    boton(davivienda, 'Cargar página o pantallazo').click();
    fixture.detectChanges();
    const campo = davivienda.querySelector<HTMLInputElement>(
      '.carga input[type="file"]',
    )!;
    expect(campo.accept).toContain('image/png');
    const imagen = new File(['png'], 'tasas.png', { type: 'image/png' });
    Object.defineProperty(campo, 'files', { value: [imagen] });
    campo.dispatchEvent(new Event('change'));
    davivienda.querySelector<HTMLFormElement>('.carga')!.requestSubmit();
    await esperar();
    expect(docs.cargar).toHaveBeenCalledWith(5, imagen, null);
    expect(admin.crearDesdeDocumento).toHaveBeenCalledWith(
      pagina,
      subido,
      null,
    );
  });

  it('aprueba una tasa que solo tiene la máxima (GNB en libranza)', async () => {
    await crearCon([
      {
        ...porAprobar,
        valor_desde: null,
        ea_desde: null,
        valor_hasta: 1.85,
        ea_hasta: 24.6,
      },
    ]);
    const nueva = html.querySelector('[aria-label="Por aprobar"]')!;
    expect(nueva.textContent).toContain('hasta 24,60 %');
    expect(nueva.textContent).not.toContain('—');
    expect(boton(nueva, 'Aprobar').disabled).toBeFalse();
  });

  it('no deja aprobar una tasa sin valores', async () => {
    await crearCon([
      {
        ...porAprobar,
        valor_desde: null,
        ea_desde: null,
        valor_hasta: null,
        ea_hasta: null,
      },
    ]);
    const nueva = html.querySelector('[aria-label="Por aprobar"]')!;
    expect(boton(nueva, 'Aprobar').disabled).toBeTrue();
  });

  it('no tiene botón de rechazar: lo que está mal se corrige', async () => {
    await crear();
    const nueva = html.querySelector('[aria-label="Por aprobar"]')!;
    expect(nueva.textContent).not.toContain('Rechazar');
    expect(nueva.textContent).toContain('Editar');
  });

  it('deja al final los bancos sin nada por aprobar', async () => {
    await crearCon([
      tasa({
        id: 5,
        estado: 'por_revisar',
        entidad: { codigo: 'davivienda', nombre: 'Davivienda', logo: null },
      }),
    ]);
    const nombres = [...html.querySelectorAll('.banco h2')].map((h) =>
      h.textContent!.trim(),
    );
    expect(nombres).toEqual(['Davivienda', 'BBVA']);
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

  it('si el banco no publica máxima, usa el tope de usura y lo aclara', async () => {
    await crear();
    admin.guardar.and.callFake(
      async (_id, cambios) =>
        ({
          ...porAprobar,
          ...cambios,
          documento: porAprobar.documento,
        }) as TasaAdmin,
    );
    const bbva = html.querySelector('.banco')!;
    [
      ...bbva
        .querySelector('[aria-label="Por aprobar"]')!
        .querySelectorAll<HTMLButtonElement>('button'),
    ]
      .find((b) => b.textContent!.trim() === 'Editar')!
      .click();
    fixture.detectChanges();
    boton(bbva, 'Usar tope de usura').click();
    fixture.detectChanges();
    expect(bbva.querySelector<HTMLInputElement>('#tfHasta')!.value).toBe(
      '2,118',
    );
    expect(bbva.querySelector<HTMLInputElement>('#tfEaHasta')!.value).toBe(
      '28,59',
    );
    expect(bbva.querySelector<HTMLSelectElement>('#tfOrigen')!.value).toBe(
      'usura',
    );
    bbva.querySelector<HTMLFormElement>('.formulario')!.requestSubmit();
    await esperar();
    expect(admin.guardar).toHaveBeenCalledWith(
      2,
      jasmine.objectContaining({
        valor_hasta: 2.118,
        ea_hasta: 28.59,
        hasta_origen: 'usura',
      }),
    );
    expect(
      bbva.querySelector('[aria-label="Por aprobar"] .tope')?.textContent,
    ).toContain('tope de usura');
  });

  it('elimina la tasa publicada y su PDF con un segundo toque, y vuelve la anterior', async () => {
    const anterior = tasa({
      id: 0,
      estado: 'anterior',
      valor_desde: 1.6,
      revisada_en: '2026-08-02T16:00:00Z',
      documento: {
        id: 9,
        estado: 'anterior',
        vigente_desde: '2026-08-01',
        archivo: { id: 'f9', filename_download: 'tasas-ago.pdf' },
      },
    });
    await crearCon([porAprobar, publicada, anterior]);
    admin.eliminar.and.resolveTo();
    admin.restaurar.and.resolveTo({ ...anterior, estado: 'publicada' });
    docs.descartar.and.resolveTo();
    const hoy = () =>
      html.querySelector('.banco [aria-label="Publicada hoy"]')!;
    const eliminar = hoy().querySelector<HTMLButtonElement>('.eliminar')!;
    eliminar.click();
    fixture.detectChanges();
    expect(admin.eliminar).not.toHaveBeenCalled();
    expect(eliminar.textContent).toContain('Toca otra vez');
    eliminar.click();
    await esperar();
    expect(admin.eliminar).toHaveBeenCalledWith(1);
    expect(docs.descartar).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 10 }),
    );
    expect(admin.restaurar).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 0 }),
    );
    expect(hoy().textContent).toContain('1,60 %');
    expect(html.querySelector('.aviso-ok')?.textContent).toContain(
      'Volvió a quedar publicada',
    );
  });

  it('cambia el archivo del PDF de la tasa publicada', async () => {
    await crear();
    docs.reemplazarArchivo.and.resolveTo({
      ...docActual,
      archivo: {
        id: 'f20',
        filename_download: 'tasas-sep-bien.pdf',
        filesize: 1,
      },
    });
    const hoy = html.querySelector('.banco [aria-label="Publicada hoy"]')!;
    const campo = hoy.querySelector<HTMLInputElement>('.cambiar input')!;
    const pdf = new File(['%PDF'], 'tasas-sep-bien.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(campo, 'files', { value: [pdf] });
    campo.dispatchEvent(new Event('change'));
    await esperar();
    expect(docs.reemplazarArchivo).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 10 }),
      pdf,
    );
    expect(hoy.textContent).toContain('tasas-sep-bien.pdf');
  });

  it('la publicada se puede editar; por aprobar no muestra cambiar ni eliminar PDF', async () => {
    await crear();
    const hoy = html.querySelector('.banco [aria-label="Publicada hoy"]')!;
    boton(hoy, 'Editar').click();
    fixture.detectChanges();
    expect(hoy.querySelector('#tfDesde')).not.toBeNull();
    const nueva = html.querySelector('.banco [aria-label="Por aprobar"]')!;
    expect(nueva.querySelector('.eliminar')).toBeNull();
    expect(nueva.querySelector('.cambiar')).toBeNull();
  });

  it('oculta la frase, las notas y quién aprobó hasta tocar "Ver más detalle"', async () => {
    await crear();
    const nueva = html.querySelector('.banco [aria-label="Por aprobar"]')!;
    const detalle = nueva.querySelector<HTMLDetailsElement>('.detalle')!;
    expect(detalle.open).toBeFalse();
    expect(detalle.querySelector('summary')?.textContent).toContain(
      'Ver más detalle',
    );
    expect(detalle.querySelector('blockquote')?.textContent).toContain(
      'Tasa Mínima 23,47 %',
    );
    const hoy = html.querySelector('.banco [aria-label="Publicada hoy"]')!;
    expect(hoy.querySelector('.detalle')?.textContent).toContain(
      'Aprobada por Juan Salazar',
    );
  });
});
