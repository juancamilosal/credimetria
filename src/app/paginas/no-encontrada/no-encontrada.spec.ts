import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoEncontrada } from './no-encontrada';

describe('NoEncontrada', () => {
  it('dice "Página no encontrada", enlaza al inicio y al ranking y responde 404', () => {
    const respuesta: ResponseInit = { status: 200 };
    TestBed.configureTestingModule({
      imports: [NoEncontrada],
      providers: [
        provideRouter([]),
        { provide: RESPONSE_INIT, useValue: respuesta },
      ],
    });
    const fixture = TestBed.createComponent(NoEncontrada);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain(
      'Página no encontrada',
    );
    const enlaces = [...html.querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(enlaces).toEqual(['/', '/ranking']);
    expect(respuesta.status).toBe(404);
  });
});
