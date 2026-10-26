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
import { EntradaMoneda } from '../../compartido/entrada-moneda/entrada-moneda';
import { formatoPesos, PesosPipe } from '../../compartido/pipes/formato';
import {
  ColumnaRanking,
  MONTO_RANKING,
  ORDEN_REAL,
  OrdenRanking,
  PLAZO_RANKING,
  TablaRanking,
  TODAS,
} from '../../compartido/tabla-ranking/tabla-ranking';
import { Producto, TipoEntidad } from '../../core/modelos/tasa';
import { FUENTE_PROMEDIO } from '../../core/datos/tasas';
import { TasasService } from '../../core/servicios/tasas.service';
import { leerNumero } from '../../core/utilidades/credito';

const PLAZOS = [12, 24, 36, 48, 60, 72, 120, 180, 240];

/** Opciones de orden para el celular, donde no se ven los títulos de la tabla. */
const ORDENES: { texto: string; orden: OrdenRanking }[] = [
  { texto: 'Tasa real: menor a mayor', orden: ORDEN_REAL },
  {
    texto: 'Tasa real: mayor a menor',
    orden: { columna: 'tasaReal', dir: 'desc' },
  },
  {
    texto: 'Anuncia: menor a mayor',
    orden: { columna: 'tasaAnunciada', dir: 'asc' },
  },
  {
    texto: 'Diferencia: mayor a menor',
    orden: { columna: 'diferencia', dir: 'desc' },
  },
  { texto: 'Entidad: A a Z', orden: { columna: 'entidad', dir: 'asc' } },
];

const COLUMNAS: ColumnaRanking[] = [
  'entidad',
  'tipo',
  'tasaAnunciada',
  'tasaReal',
  'diferencia',
  'cuota',
  'total',
];

/**
 * Lista completa por tasa real. Se ordena y se filtra por tipo desde los
 * títulos de la tabla, como en Excel; arriba se elige el producto y se
 * escribe el monto y el plazo para calcular la cuota de todas. Todo queda en
 * la dirección (?producto=…&tipo=…&monto=…&plazo=…&orden=…) para compartir
 * el enlace.
 */
@Component({
  selector: 'app-ranking',
  imports: [DatePipe, EntradaMoneda, PesosPipe, TablaRanking],
  templateUrl: './ranking.html',
  styleUrl: './ranking.css',
})
export class Ranking {
  private readonly tasas = inject(TasasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly corte = this.tasas.corte;
  protected readonly sinConexion = this.tasas.sinConexion;
  protected readonly productos = this.tasas.productos;
  protected readonly tipos = [TODAS, ...this.tasas.tipos];
  protected readonly plazos = PLAZOS;
  protected readonly ordenes = ORDENES;
  protected readonly fuente = FUENTE_PROMEDIO;

  protected readonly producto = signal<Producto>('libre-inversion');
  protected readonly tipo = signal<string>(TODAS);
  protected readonly orden = signal<OrdenRanking>(ORDEN_REAL);
  protected readonly montoTexto = signal(formatoPesos(MONTO_RANKING).slice(1));
  protected readonly plazo = signal(PLAZO_RANKING);

  /** Monto para la cuota; si el campo queda vacío, el de siempre. */
  protected readonly monto = computed(
    () => leerNumero(this.montoTexto()) || MONTO_RANKING,
  );
  protected readonly filas = computed(() =>
    this.tasas.ranking(
      this.producto(),
      this.tipo() === TODAS ? null : (this.tipo() as TipoEntidad),
    ),
  );
  /** Alguna entidad no publica máxima y su "hasta" es la usura. */
  protected readonly hayUsura = computed(() =>
    this.filas().some((t) => t.hastaUsura),
  );
  protected readonly titulo = computed(() => {
    const n = this.filas().length;
    const tipo = this.tipo() === TODAS ? '' : ` · ${this.tipo()}`;
    return `${this.tasas.nombre(this.producto())}${tipo} · ${n} ${n === 1 ? 'entidad' : 'entidades'}`;
  });
  /** Índice de la opción de orden del celular que coincide, o -1. */
  protected readonly ordenElegido = computed(() =>
    ORDENES.findIndex(
      (o) =>
        o.orden.columna === this.orden().columna &&
        o.orden.dir === this.orden().dir,
    ),
  );

  constructor() {
    this.leerDireccion();
    // Al prerenderizar no hay dirección que actualizar.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    effect(() => {
      const { columna, dir } = this.orden();
      const queryParams = {
        producto: this.producto(),
        tipo: this.tipo() === TODAS ? null : this.tipo(),
        monto: this.monto() === MONTO_RANKING ? null : this.monto(),
        plazo: this.plazo() === PLAZO_RANKING ? null : this.plazo(),
        orden:
          columna === ORDEN_REAL.columna && dir === ORDEN_REAL.dir
            ? null
            : `${columna}-${dir}`,
      };
      this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams,
        replaceUrl: true,
      });
    });
  }

  protected cambiarProducto(valor: string): void {
    if (this.tasas.esProducto(valor)) this.producto.set(valor);
  }

  protected elegirOrden(indice: string): void {
    const opcion = ORDENES[Number(indice)];
    if (opcion) this.orden.set(opcion.orden);
  }

  private leerDireccion(): void {
    const params = this.ruta.snapshot.queryParamMap;
    const producto = params.get('producto');
    const tipo = params.get('tipo');
    const monto = Number(params.get('monto'));
    const plazo = Number(params.get('plazo'));
    const [columna, dir] = (params.get('orden') ?? '').split('-');

    if (this.tasas.esProducto(producto)) this.producto.set(producto);
    if (tipo && this.tipos.includes(tipo)) this.tipo.set(tipo);
    if (monto > 0) this.montoTexto.set(formatoPesos(monto).slice(1));
    if (PLAZOS.includes(plazo)) this.plazo.set(plazo);
    if (
      COLUMNAS.includes(columna as ColumnaRanking) &&
      (dir === 'asc' || dir === 'desc')
    ) {
      this.orden.set({ columna: columna as ColumnaRanking, dir });
    }
  }
}
