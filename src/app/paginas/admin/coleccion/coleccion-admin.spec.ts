import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { SesionAdmin } from '../../../core/servicios/sesion-admin.service';
import { ColeccionAdmin, slug, valorParaGuardar } from './coleccion-admin';
import { ASESORES, REPORTES } from './colecciones';
import { ConfigColeccion } from './config';

type Llamada = [string, string, unknown?];

describe('Administración de colecciones', () => {
  let fixture: ComponentFixture<ColeccionAdmin>;
  let html: HTMLElement;
  let llamadas: Llamada[];
  let datos: Record<string, unknown[]>;

  async function crear(config: ConfigColeccion) {
    llamadas = [];
    TestBed.configureTestingModule({
      imports: [ColeccionAdmin],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { coleccion: config } } },
        },
        {
          provide: SesionAdmin,
          useValue: {
            usuario: () => ({ id: '1', email: 'a@b.co', nombre: 'Admin' }),
            urlImagen: (id: string) => `https://api/assets/${id}`,
            salir: async () => {},
            pedir: async (metodo: string, ruta: string, cuerpo?: unknown) => {
              llamadas.push([metodo, ruta, cuerpo]);
              if (metodo === 'GET') {
                const col = ruta.split('/items/')[1]?.split('?')[0];
                return datos[col] ?? [];
              }
              if (metodo === 'DELETE') return undefined;
              return { ...(cuerpo as object), id: 'nuevo-id' };
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ColeccionAdmin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    html = fixture.nativeElement;
  }

  beforeEach(() => {
    datos = {
      asesores: [
        {
          id: 'alexandra-rojas-garcia',
          estado: 'publicado',
          nombre: 'Alexandra Rojas García',
          empresa: 'Fuerza de ventas',
          verificado: true,
          entidades: ['BBVA', 'Davivienda'],
          foto: 'f1',
        },
        {
          id: 'pedro',
          estado: 'borrador',
          nombre: 'Pedro Ruiz',
          entidades: [],
        },
      ],
      reportes_asesores: [
        {
          id: 1,
          estado: 'nuevo',
          asesor: 'alexandra-rojas-garcia',
          motivo: 'cobro_adelantado',
          nombre: 'Ana',
          descripcion: 'Me pidió plata',
        },
      ],
    };
  });

  it('convierte los campos al guardar y arma el identificador', () => {
    expect(slug('Ana María Gómez Ñ')).toBe('ana-maria-gomez-n');
    const lista = ASESORES.campos.find((c) => c.campo === 'entidades')!;
    expect(valorParaGuardar(lista, 'BBVA, Davivienda,, BBVA')).toEqual([
      'BBVA',
      'Davivienda',
    ]);
    const numero = ASESORES.campos.find((c) => c.campo === 'orden')!;
    expect(valorParaGuardar(numero, '2')).toBe(2);
    expect(valorParaGuardar(numero, '')).toBeNull();
    const texto = ASESORES.campos.find((c) => c.campo === 'empresa')!;
    expect(valorParaGuardar(texto, '  ')).toBeNull();
  });

  it('lista los asesores con su foto y filtra por estado y por texto', async () => {
    await crear(ASESORES);
    expect(html.querySelectorAll('tbody tr').length).toBe(2);
    expect(html.querySelector('img.miniatura')?.getAttribute('src')).toBe(
      'https://api/assets/f1',
    );
    const publicado = [...html.querySelectorAll('.filtros button')].find((b) =>
      b.textContent?.includes('Publicado'),
    ) as HTMLButtonElement;
    expect(publicado.textContent).toContain('1');
    publicado.click();
    fixture.detectChanges();
    expect(html.querySelectorAll('tbody tr').length).toBe(1);
    const buscar = html.querySelector<HTMLInputElement>('.buscar')!;
    buscar.value = 'pedro';
    buscar.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(html.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('al editar solo manda lo que cambió', async () => {
    await crear(ASESORES);
    (html.querySelector('tbody tr') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const empresa = html.querySelector<HTMLInputElement>('#ad-empresa')!;
    empresa.value = 'Asesores SAS';
    empresa.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.componentInstance.guardar();
    const patch = llamadas.find((l) => l[0] === 'PATCH')!;
    expect(patch[1]).toBe('/items/asesores/alexandra-rojas-garcia');
    expect(patch[2]).toEqual({ empresa: 'Asesores SAS' });
  });

  it('crea un asesor nuevo con el identificador en minúsculas', async () => {
    await crear(ASESORES);
    (html.querySelector('.nuevo') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const poner = (id: string, v: string) => {
      const el = html.querySelector<HTMLInputElement>(id)!;
      el.value = v;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    poner('#ad-id', 'Carlos Pérez');
    poner('#ad-nombre', 'Carlos Pérez');
    poner('#ad-ciudades', 'Cali, Palmira');
    await fixture.componentInstance.guardar();
    const post = llamadas.find((l) => l[0] === 'POST')!;
    expect(post[1]).toBe('/items/asesores');
    const cuerpo = post[2] as Record<string, unknown>;
    expect(cuerpo['id']).toBe('carlos-perez');
    expect(cuerpo['estado']).toBe('publicado');
    expect(cuerpo['ciudades']).toEqual(['Cali', 'Palmira']);
  });

  it('los reportes no se crean aquí, muestran el asesor por su nombre y se borran con confirmación', async () => {
    await crear(REPORTES);
    expect(html.querySelector('.nuevo')).toBeNull();
    expect(html.querySelector('tbody tr')?.textContent).toContain(
      'Alexandra Rojas García',
    );
    (html.querySelector('tbody tr') as HTMLElement).click();
    fixture.detectChanges();
    spyOn(window, 'confirm').and.returnValue(true);
    await fixture.componentInstance.borrar();
    fixture.detectChanges();
    expect(
      llamadas.some(
        (l) => l[0] === 'DELETE' && l[1] === '/items/reportes_asesores/1',
      ),
    ).toBeTrue();
    expect(html.querySelectorAll('tbody tr').length).toBe(0);
  });
});
