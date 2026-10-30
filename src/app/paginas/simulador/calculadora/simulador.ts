import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ayuda } from '../../../compartido/ayuda/ayuda';
import { EntradaMoneda } from '../../../compartido/entrada-moneda/entrada-moneda';
import {
  formatoPesos,
  PesosPipe,
  TasaPipe,
} from '../../../compartido/pipes/formato';
import { esVivienda, plazosDe, USURA_CONSUMO } from '../../../core/datos/tasas';
import {
  MONTO_RANKING,
  MONTO_VIVIENDA,
  PLAZO_RANKING,
  PLAZO_VIVIENDA,
} from '../../../compartido/tabla-ranking/tabla-ranking';
import { Producto } from '../../../core/modelos/tasa';
import { TasasService } from '../../../core/servicios/tasas.service';
import {
  amortizacion,
  CuotaAmortizacion,
  leerNumero,
  SistemaAmortizacion,
} from '../../../core/utilidades/credito';

/** Explicación del globo de ayuda de la casilla "Cuota fija". */
const AYUDA_CUOTA_FIJA =
  'Sin marcar, la cuota baja cada mes: abonas lo mismo a capital y los intereses se calculan sobre lo que aún debes. Empiezas pagando más, pero pagas menos intereses. Márcala si tu banco te cobra la misma cuota todos los meses, como suele pasar en libre inversión, libranza y vehículo. En vivienda en pesos los bancos ofrecen las dos: cuota fija o abono constante a capital.';

/** Suma de las cuotas de una tabla. */
function totalPagado(tabla: CuotaAmortizacion[]): number {
  return tabla.reduce((suma, fila) => suma + fila.cuota, 0);
}

/** Tasa de ejemplo con que arranca el simulador en cada tipo de crédito. */
const TASA_CONSUMO = '26,38';
const TASA_VIVIENDA = '14,50';

/** Monto, plazo y tasa de ejemplo de un producto. */
function porDefecto(producto: Producto) {
  return esVivienda(producto)
    ? { monto: MONTO_VIVIENDA, plazo: PLAZO_VIVIENDA, tasa: TASA_VIVIENDA }
    : { monto: MONTO_RANKING, plazo: PLAZO_RANKING, tasa: TASA_CONSUMO };
}

/**
 * La persona escribe la tasa que le ofrecieron y ve al instante su cuota y
 * cuánto se ahorraría con la entidad que cobra menos. Se recalcula al
 * cambiar cualquier campo, sin botón de calcular.
 */
@Component({
  selector: 'app-simulador',
  imports: [RouterLink, Ayuda, EntradaMoneda, PesosPipe, TasaPipe],
  templateUrl: './simulador.html',
  styleUrl: './simulador.css',
})
export class Simulador {
  private readonly tasas = inject(TasasService);

  /**
   * Como en el ranking, vivienda es una sola opción; debajo se elige crédito
   * hipotecario o leasing habitacional, y VIS o No VIS.
   */
  protected readonly productos = [
    ...this.tasas.productos.filter((p) => !esVivienda(p.id)),
    { id: 'vivienda', nombre: 'Vivienda' },
  ];
  protected readonly esVivienda = esVivienda;

  /**
   * Producto, monto y plazo los comparte con la página: el ranking resumido y
   * el comparador de dos entidades usan los mismos.
   */
  readonly producto = model<Producto>('libre-inversion');
  readonly monto = model(20_000_000);
  readonly plazo = model(48);
  protected readonly montoTexto = signal(formatoPesos(this.monto()).slice(1));
  protected readonly tasaTexto = signal(TASA_CONSUMO);
  /** Consumo hasta 72 meses; vivienda hasta 240. */
  protected readonly plazos = computed(() => plazosDe(this.producto()));
  /** La opción del selector: "vivienda" para los cuatro de vivienda. */
  protected readonly opcion = computed(() =>
    esVivienda(this.producto()) ? 'vivienda' : this.producto(),
  );
  protected readonly modalidad = computed<'hipotecario' | 'leasing'>(() =>
    this.producto().startsWith('leasing') ? 'leasing' : 'hipotecario',
  );
  protected readonly vis = computed<'vis' | 'no-vis'>(() =>
    this.producto().endsWith('-no-vis') ? 'no-vis' : 'vis',
  );

  protected readonly tasa = computed(() => leerNumero(this.tasaTexto()));
  protected readonly listo = computed(
    () => this.monto() > 0 && this.tasa() > 0,
  );

  protected readonly ayudaCuotaFija = AYUDA_CUOTA_FIJA;
  /** Lo que marcó la persona: sin marcar, cuota decreciente; marcada, fija. */
  protected readonly fijaElegida = signal(false);
  /** La libranza siempre es de cuota fija: la casilla queda marcada y bloqueada. */
  protected readonly soloFija = computed(() => this.producto() === 'libranza');
  /** Cuota fija (sistema francés) o decreciente (abono constante a capital). */
  protected readonly fija = computed(
    () => this.soloFija() || this.fijaElegida(),
  );
  protected readonly sistema = computed<SistemaAmortizacion>(() =>
    this.fija() ? 'fija' : 'decreciente',
  );

  protected readonly tabla = computed(() =>
    this.listo()
      ? amortizacion(this.monto(), this.tasa(), this.plazo(), this.sistema())
      : [],
  );
  /** Con cuota fija, la cuota; con decreciente, la primera (la más alta). */
  protected readonly cuota = computed(() => this.tabla()[0]?.cuota ?? 0);
  protected readonly ultimaCuota = computed(
    () => this.tabla().at(-1)?.cuota ?? 0,
  );
  protected readonly total = computed(() => totalPagado(this.tabla()));
  protected readonly totalIntereses = computed(
    () => this.total() - this.monto(),
  );

  protected readonly mejor = computed(() => this.tasas.mejor(this.producto()));
  private readonly tablaMejor = computed(() => {
    const mejor = this.mejor();
    return mejor
      ? amortizacion(this.monto(), mejor.tasaReal, this.plazo(), this.sistema())
      : [];
  });
  protected readonly cuotaMejor = computed(
    () => this.tablaMejor()[0]?.cuota ?? 0,
  );
  /** Ahorro con la mejor entidad, en la (primera) cuota y en todo el crédito. */
  protected readonly ahorro = computed(() =>
    this.mejor() && this.listo()
      ? {
          mes: this.cuota() - this.cuotaMejor(),
          total: this.total() - totalPagado(this.tablaMejor()),
        }
      : null,
  );
  /** La tasa escrita es igual o menor que la mejor del ranking. */
  protected readonly buenaTasa = computed(() => {
    const valor = this.ahorro();
    return valor !== null && valor.mes <= 0.5;
  });
  /** La tabla aparece al tocar "Simular" y luego sigue los cambios. */
  protected readonly simulado = signal(false);
  private readonly tablaCaja = viewChild<ElementRef<HTMLElement>>('tablaCaja');
  private readonly injector = inject(Injector);

  protected readonly usura = USURA_CONSUMO;
  /** La usura de consumo no aplica a vivienda. */
  protected readonly superaUsura = computed(
    () => !esVivienda(this.producto()) && this.tasa() > USURA_CONSUMO.tasa,
  );

  protected cambiarProducto(valor: string): void {
    const nuevo =
      valor === 'vivienda'
        ? this.vivienda(this.modalidad(), this.vis())
        : valor;
    if (!this.tasas.esProducto(nuevo)) return;
    // Entre consumo y vivienda cambian mucho el monto, el plazo y la tasa:
    // si siguen los de ejemplo, pasan a los del nuevo.
    const antes = porDefecto(this.producto());
    const despues = porDefecto(nuevo);
    if (this.monto() === antes.monto)
      this.cambiarMonto(formatoPesos(despues.monto).slice(1));
    if (this.tasaTexto() === antes.tasa) this.tasaTexto.set(despues.tasa);
    if (this.plazo() === antes.plazo || !plazosDe(nuevo).includes(this.plazo()))
      this.plazo.set(despues.plazo);
    this.producto.set(nuevo);
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

  protected simular(): void {
    if (!this.listo()) return;
    this.simulado.set(true);
    afterNextRender(
      () =>
        this.tablaCaja()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      { injector: this.injector },
    );
  }

  protected cambiarMonto(texto: string): void {
    this.montoTexto.set(texto);
    this.monto.set(leerNumero(texto));
  }
}
