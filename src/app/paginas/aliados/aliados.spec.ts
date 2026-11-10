import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Aliados } from './aliados';

describe('Aliados', () => {
  it('mientras no hay asesores reales dice "Próximamente tus asesores"', () => {
    TestBed.configureTestingModule({
      imports: [Aliados],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(Aliados);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.proximamente')?.textContent).toContain(
      'Próximamente tus asesores',
    );
    // No se muestran los asesores de ejemplo ni el aviso de prueba.
    expect(html.textContent).not.toContain('de ejemplo');
    expect(html.textContent).not.toContain('Versión de prueba');
    expect(html.textContent).toContain('¿Eres asesor de crédito?');
  });
});
