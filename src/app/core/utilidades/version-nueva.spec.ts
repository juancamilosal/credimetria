import { NavigationError } from '@angular/router';
import { esVersionVieja, recargarSiVersionVieja } from './version-nueva';

describe('versión nueva de la página', () => {
  const error = new TypeError(
    'Failed to fetch dynamically imported module: https://credimetria.com/chunk-HOIRYNMZ.js',
  );

  function ventana() {
    const guardado = new Map<string, string>();
    const idas: string[] = [];
    return {
      idas,
      location: { assign: (u: string) => idas.push(u) } as unknown as Location,
      sessionStorage: {
        getItem: (k: string) => guardado.get(k) ?? null,
        setItem: (k: string, v: string) => guardado.set(k, v),
      } as unknown as Storage,
    };
  }

  it('reconoce el error de un archivo de una versión anterior', () => {
    expect(esVersionVieja(error)).toBeTrue();
    expect(esVersionVieja(new Error('Loading chunk 123 failed'))).toBeTrue();
    expect(
      esVersionVieja(new Error('Cannot read properties of undefined')),
    ).toBeFalse();
  });

  it('recarga en la dirección a la que iba, una sola vez por minuto', () => {
    const v = ventana();
    const evento = new NavigationError(1, '/ranking?producto=libranza', error);
    expect(recargarSiVersionVieja(evento, v, 1_000_000)).toBeTrue();
    expect(v.idas).toEqual(['/ranking?producto=libranza']);
    // Si vuelve a fallar enseguida, no entra en bucle.
    expect(recargarSiVersionVieja(evento, v, 1_010_000)).toBeFalse();
    expect(recargarSiVersionVieja(evento, v, 1_070_000)).toBeTrue();
  });

  it('no recarga por otros errores', () => {
    const v = ventana();
    const otro = new NavigationError(1, '/', new Error('otro error'));
    expect(recargarSiVersionVieja(otro, v)).toBeFalse();
    expect(v.idas).toEqual([]);
  });
});
