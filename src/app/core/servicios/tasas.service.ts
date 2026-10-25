import { Injectable } from '@angular/core';
import { CORTE_TASAS, PRODUCTOS, TASAS } from '../datos/tasas';
import {
  CorteTasas,
  InfoProducto,
  Producto,
  TasaEntidad,
  TipoEntidad,
} from '../modelos/tasa';

/**
 * Punto único de acceso a las tasas. Hoy lee los datos de ejemplo; en la
 * Fase 1 leerá la base de datos que llena el recolector de la Superfinanciera.
 */
@Injectable({ providedIn: 'root' })
export class TasasService {
  readonly corte: CorteTasas = CORTE_TASAS;
  readonly productos: InfoProducto[] = PRODUCTOS;
  readonly tipos: TipoEntidad[] = ['Banco', 'Cooperativa', 'Financiera'];

  /**
   * Entidades de un producto ordenadas por la tasa que cobran, de menor a
   * mayor. El orden nunca depende de quién paga publicidad.
   */
  ranking(producto: Producto, tipo: TipoEntidad | null = null): TasaEntidad[] {
    return TASAS.filter(
      (t) => t.producto === producto && (tipo === null || t.tipo === tipo),
    ).sort((a, b) => a.tasaReal - b.tasaReal);
  }

  /** La entidad que menos cobra para un producto. */
  mejor(producto: Producto): TasaEntidad | undefined {
    return this.ranking(producto)[0];
  }

  nombre(producto: Producto): string {
    return this.productos.find((p) => p.id === producto)?.nombre ?? producto;
  }

  esProducto(valor: unknown): valor is Producto {
    return this.productos.some((p) => p.id === valor);
  }
}
