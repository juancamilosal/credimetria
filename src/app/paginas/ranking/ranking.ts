import { DatePipe, isPlatformBrowser, Location } from '@angular/common';
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
  MONTO_VIVIENDA,
  ORDEN_REAL,
  OrdenRanking,
  PLAZO_RANKING,
  PLAZO_VIVIENDA,
  TablaRanking,
  TODAS,
} from '../../compartido/tabla-ranking/tabla-ranking';
import { Producto, TipoEntidad } from '../../core/modelos/tasa';
import {
  esVivienda,
  FUENTE_PROMEDIO,
  plazosDe,
  textoPlazo,
} from '../../core/datos/tasas';
import { TasasService } from '../../core/servicios/tasas.service';
import { leerNumero } from '../../core/utilidades/credito';

/** Monto y plazo con que se calcula la cuota si la persona no los cambia. */
function porDefecto(producto: Producto): { monto: number; plazo: number } {
  // Vivienda: un apartamento a 20 años; consumo: $20.000.000 a 48 meses.
  return esVivienda(producto)
    ? { monto: MONTO_VIVIENDA, plazo: PLAZO_VIVIENDA }
    : { monto: MONTO_RANKING, plazo: PLAZO_RANKING };
}

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
  private readonly location = inject(Location);

  protected readonly corte = this.tasas.corte;
  protected readonly sinConexion = this.tasas.sinConexion;
  protected readonly cargando = this.tasas.cargando;
  protected readonly productos = this.tasas.productos;
  protected readonly tipos = [TODAS, ...this.tasas.tipos];
  /** Consumo hasta 72 meses; vivienda hasta 240 meses. */
  protected readonly plazos = computed(() => plazosDe(this.producto()));
  protected readonly textoPlazo = textoPlazo;
  protected readonly ordenes = ORDENES;
  protected readonly fuente = FUENTE_PROMEDIO;

  protected readonly producto = signal<Producto>('libre-inversion');
  protected readonly tipo = signal<string>(TODAS);
  protected readonly orden = signal<OrdenRanking>(ORDEN_REAL);
  protected readonly montoTexto = signal(formatoPesos(MONTO_RANKING).slice(1));
  protected readonly plazo = signal(PLAZO_RANKING);

  /** Monto para la cuota; si el campo queda vacío, el del producto. */
  protected readonly monto = computed(
    () => leerNumero(this.montoTexto()) || porDefecto(this.producto()).monto,
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
    if (this.cargando())
      return `${this.tasas.nombre(this.producto())}${tipo} · cargando…`;
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
        monto:
          this.monto() === porDefecto(this.producto()).monto
            ? null
            : this.monto(),
        plazo:
          this.plazo() === porDefecto(this.producto()).plazo
            ? null
            : this.plazo(),
        orden:
          columna === ORDEN_REAL.columna && dir === ORDEN_REAL.dir
            ? null
            : `${columna}-${dir}`,
      };
      // Solo se cambia la dirección, sin navegar: una navegación del router
      // sube la pantalla al inicio cada vez que se ordena o se filtra.
      const url = this.router.createUrlTree([], {
        relativeTo: this.ruta,
        queryParams,
      });
      this.location.replaceState(this.router.serializeUrl(url));
    });
  }

  /**
   * En el selector, vivienda es una sola opción; debajo se elige con dos
   * filtros aparte: crédito hipotecario o leasing habitacional, y VIS o No
   * VIS (la Superfinanciera los reporta por separado).
   */
  protected readonly opciones = [
    ...this.productos.filter((p) => !esVivienda(p.id)),
    { id: 'vivienda', nombre: 'Vivienda' },
  ];
  protected readonly esVivienda = esVivienda;
  /** La opción del selector que corresponde al producto. */
  protected readonly opcion = computed(() =>
    esVivienda(this.producto()) ? 'vivienda' : this.producto(),
  );
  protected readonly modalidad = computed<'hipotecario' | 'leasing'>(() =>
    this.producto().startsWith('leasing') ? 'leasing' : 'hipotecario',
  );
  protected readonly vis = computed<'vis' | 'no-vis'>(() =>
    this.producto().endsWith('-no-vis') ? 'no-vis' : 'vis',
  );

  protected elegirOpcion(valor: string): void {
    this.cambiarProducto(
      valor === 'vivienda'
        ? this.vivienda(this.modalidad(), this.vis())
        : valor,
    );
  }

  protected elegirModalidad(modalidad: 'hipotecario' | 'leasing'): void {
    this.cambiarProducto(this.vivienda(modalidad, this.vis()));
  }

  protected elegirVis(vis: 'vis' | 'no-vis'): void {
    this.cambiarProducto(this.vivienda(this.modalidad(), vis));
  }

  private vivienda(
    modalidad: 'hipotecario' | 'leasing',
    vis: 'vis' | 'no-vis',
  ): Producto {
    return `${modalidad === 'leasing' ? 'leasing' : 'vivienda'}-${vis}`;
  }

  protected cambiarProducto(valor: string): void {
    if (!this.tasas.esProducto(valor)) return;
    // Si el monto y el plazo son los del producto anterior, pasan a los del
    // nuevo (de libre inversión a vivienda cambian mucho).
    const antes = porDefecto(this.producto());
    const despues = porDefecto(valor);
    if (this.monto() === antes.monto && this.plazo() === antes.plazo) {
      this.montoTexto.set(formatoPesos(despues.monto).slice(1));
      this.plazo.set(despues.plazo);
    }
    // El plazo que no existe en el producto nuevo (240 meses en libre
    // inversión) pasa al de por defecto.
    if (!plazosDe(valor).includes(this.plazo())) this.plazo.set(despues.plazo);
    this.producto.set(valor);
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
    const defecto = porDefecto(this.producto());
    this.montoTexto.set(
      formatoPesos(monto > 0 ? monto : defecto.monto).slice(1),
    );
    this.plazo.set(
      plazosDe(this.producto()).includes(plazo) ? plazo : defecto.plazo,
    );
    if (
      COLUMNAS.includes(columna as ColumnaRanking) &&
      (dir === 'asc' || dir === 'desc')
    ) {
      this.orden.set({ columna: columna as ColumnaRanking, dir });
    }
  }
}
