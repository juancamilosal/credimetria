import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chips } from '../../compartido/chips/chips';
import { formatoPesos } from '../../compartido/pipes/formato';
import {
  MONTO_RANKING,
  PLAZO_RANKING,
  TablaRanking,
} from '../../compartido/tabla-ranking/tabla-ranking';
import { Producto, TipoEntidad } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';

const TODAS = 'Todas';

/**
 * Lista completa por tasa real con filtros de producto y tipo de entidad.
 * Los filtros quedan en la dirección (?producto=…&tipo=…) para poder
 * compartir el enlace.
 */
@Component({
  selector: 'app-ranking',
  imports: [DatePipe, Chips, TablaRanking],
  templateUrl: './ranking.html',
  styleUrl: './ranking.css',
})
export class Ranking {
  private readonly tasas = inject(TasasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly corte = this.tasas.corte;
  protected readonly opcionesProducto = this.tasas.productos.map((p) => ({
    valor: p.id,
    texto: p.nombre,
  }));
  protected readonly opcionesTipo = [TODAS, ...this.tasas.tipos].map((t) => ({
    valor: t,
    texto: t,
  }));
  protected readonly notaCuota = `Cuota calculada para ${formatoPesos(MONTO_RANKING)} a ${PLAZO_RANKING} meses`;

  protected readonly producto = signal<string>('libre-inversion');
  protected readonly tipo = signal<string>(TODAS);

  protected readonly productoId = computed(() => this.producto() as Producto);
  protected readonly filas = computed(() =>
    this.tasas.ranking(
      this.productoId(),
      this.tipo() === TODAS ? null : (this.tipo() as TipoEntidad),
    ),
  );
  protected readonly titulo = computed(() => {
    const n = this.filas().length;
    return `${this.tasas.nombre(this.productoId())} · ${n} ${n === 1 ? 'entidad' : 'entidades'}`;
  });

  constructor() {
    const params = this.ruta.snapshot.queryParamMap;
    const producto = params.get('producto');
    const tipo = params.get('tipo');
    if (this.tasas.esProducto(producto)) this.producto.set(producto);
    if (tipo && this.opcionesTipo.some((t) => t.valor === tipo))
      this.tipo.set(tipo);

    // Al prerenderizar no hay dirección que actualizar.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    effect(() => {
      const queryParams = {
        producto: this.producto(),
        tipo: this.tipo() === TODAS ? null : this.tipo(),
      };
      this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams,
        replaceUrl: true,
      });
    });
  }
}
