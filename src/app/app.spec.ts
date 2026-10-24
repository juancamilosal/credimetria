import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el encabezado con la marca y el pie con el aviso', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('header')?.textContent).toContain('Credimetría');
    expect(html.querySelector('footer')?.textContent).toContain(
      'no es una entidad financiera',
    );
  });
});
