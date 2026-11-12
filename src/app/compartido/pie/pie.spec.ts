import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CORTE_PRUEBA, TASAS_PRUEBA } from '../../core/datos/tasas-prueba';
import { TASAS_INICIALES } from '../../core/servicios/tasas.service';
import { Pie } from './pie';

describe('Pie', () => {
  it('ya no dice que los asesores aliados son de ejemplo', () => {
    TestBed.configureTestingModule({
      imports: [Pie],
      providers: [
        provideRouter([]),
        {
          provide: TASAS_INICIALES,
          // Tasas reales (no de ejemplo), como en producción.
          useValue: {
            tasas: TASAS_PRUEBA,
            corte: { ...CORTE_PRUEBA, ejemplo: false },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Pie);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent!;
    expect(texto).toContain('Credimetría no es una entidad financiera');
    expect(texto).not.toContain('versión de prueba');
    // Aviso de independencia en todas las páginas.
    expect(texto.replace(/\s+/g, ' ')).toContain(
      'Las marcas pertenecen a sus dueños: Credimetría es independiente y no tiene relación comercial con ellas.',
    );
  });
});
