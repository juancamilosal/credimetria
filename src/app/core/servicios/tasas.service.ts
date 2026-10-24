import { Injectable } from '@angular/core';
import { CORTE_TASAS, PRODUCTOS, TASAS } from '../datos/tasas';
import {
  CorteTasas,
  InfoProducto,
  Producto,
  TasaEntidad,
} from '../modelos/tasa';

/**
 * Punto único de acceso a las tasas. Hoy lee los datos de ejemplo; en la
 * Fase 1 leerá la base de datos que llena el recolector de la Superfinanciera.
 */
@Injectable({ providedIn: 'root' })
export class TasasService {
  readonly corte: CorteTasas = CORTE_TASAS;
  readonly productos: InfoProducto[] = PRODUCTOS;

  /** Las `cantidad` entidades con la tasa real más baja para un producto. */
  mejores(producto: Producto, cantidad = 3): TasaEntidad[] {
    return TASAS.filter((t) => t.producto === producto)
      .sort((a, b) => a.tasaReal - b.tasaReal)
      .slice(0, cantidad);
  }

  /** Promedio simple de la tasa real de un producto. */
  promedio(producto: Producto): number {
    const tasas = TASAS.filter((t) => t.producto === producto);
    if (!tasas.length) return 0;
    return tasas.reduce((suma, t) => suma + t.tasaReal, 0) / tasas.length;
  }

  /** La entidad con más distancia entre la tasa que anuncia y la que cobra. */
  mayorBrecha(producto: Producto): TasaEntidad | undefined {
    const brecha = (t: TasaEntidad) =>
      t.tasaAnunciada === null ? -1 : t.tasaReal - t.tasaAnunciada;
    return TASAS.filter(
      (t) => t.producto === producto && t.tasaAnunciada !== null,
    ).sort((a, b) => brecha(b) - brecha(a))[0];
  }

  producto(id: Producto): InfoProducto {
    return this.productos.find((p) => p.id === id) ?? this.productos[0];
  }
}
