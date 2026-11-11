import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VERSION_POLITICA } from '../../core/servicios/prospectos.service';
import { PoliticaDatos, RESPONSABLE } from './politica-datos';

describe('PoliticaDatos', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [PoliticaDatos],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(PoliticaDatos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('tiene las 13 secciones con el índice', () => {
    const html = crear();
    expect(html.querySelectorAll('article > section').length).toBe(13);
    expect(html.querySelectorAll('.indice li').length).toBe(13);
  });

  it('cita la Ley 1581, los plazos y los horarios de la Ley 2300', () => {
    const texto = crear().textContent!;
    expect(texto).toContain('Ley Estatutaria 1581 de 2012');
    expect(texto).toContain('10 días hábiles');
    expect(texto).toContain('15 días hábiles');
    expect(texto).toContain('Ley 2300 de 2023');
    expect(texto).toContain(VERSION_POLITICA);
    expect(texto).toContain(RESPONSABLE.correo);
  });

  it('avisa que es borrador mientras falten datos del responsable', () => {
    const html = crear();
    const completo =
      RESPONSABLE.nombre && RESPONSABLE.identificacion && RESPONSABLE.domicilio;
    expect(!!html.querySelector('.pendiente')).toBe(!completo);
  });
});
