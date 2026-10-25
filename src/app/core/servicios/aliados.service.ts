import { Injectable } from '@angular/core';
import { ALIADOS_EJEMPLO } from '../datos/aliados';
import { Aliado } from '../modelos/aliado';

/** Lista pública de asesores aliados. En producción sale de la base de datos. */
@Injectable({ providedIn: 'root' })
export class AliadosService {
  readonly ejemplo = true;

  lista(): Aliado[] {
    return ALIADOS_EJEMPLO;
  }
}
