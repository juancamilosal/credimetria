import { Injectable } from '@angular/core';
import { ALIADOS } from '../datos/aliados';
import { Aliado } from '../modelos/aliado';

/** Lista pública de asesores aliados (`core/datos/aliados.ts`). */
@Injectable({ providedIn: 'root' })
export class AliadosService {
  /** Sin aliados todavía: /aliados dice "Próximamente tus asesores". */
  readonly ejemplo = ALIADOS.length === 0;

  lista(): Aliado[] {
    return ALIADOS;
  }
}
