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
import { EntradaMoneda } from '../../../compartido/entrada-moneda/entrada-moneda';
import {
  formatoPesos,
  PesosPipe,
  TasaPipe,
} from '../../../compartido/pipes/formato';
import { USURA_CONSUMO } from '../../../core/datos/tasas';
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
  'Sin marcar, la cuota baja cada mes: abonas lo mismo a capital y los intereses se calculan sobre lo que aún debes. Empiezas pagando más, pero pagas menos intereses. Márcala si tu banco te cobra la misma cuota todos los meses, como suele pasar en libre inversión, libranza y vehículo.';

/** Suma de las cuotas de una tabla. */
function totalPagado(tabla: CuotaAmortizacion[]): number {
  return tabla.reduce((suma, fila) => suma + fila.cuota, 0);
}

/** Productos que se pueden simular (vivienda tiene su propio cálculo). */
const PRODUCTOS_SIMULADOR: Producto[] = [
  'libre-inversion',
  'libranza',
  'compra-cartera',
  'vehiculo',
];

/**
 * La persona escribe la tasa que le ofrecieron y ve al instante su cuota y
 * cuánto se ahorraría con la entidad que cobra menos. Se recalcula al
 * cambiar cualquier campo, sin botón de calcular.
 */
@Component({
  selector: 'app-simulador',
  imports: [RouterLink, EntradaMoneda, PesosPipe, TasaPipe],
  templateUrl: './simulador.html',
  styleUrl: './simulador.css',
})
export class Simulador {
  private readonly tasas = inject(TasasService);

  protected readonly productos = this.tasas.productos.filter((p) =>
    PRODUCTOS_SIMULADOR.includes(p.id),
  );
  protected readonly plazos = [12, 24, 36, 48, 60, 72];

  /**
   * Producto, monto y plazo los comparte con la página: el ranking resumido y
   * el comparador de dos entidades usan los mismos.
   */
  readonly producto = model<Producto>('libre-inversion');
  readonly monto = model(20_000_000);
  readonly plazo = model(48);
  protected readonly montoTexto = signal(formatoPesos(this.monto()).slice(1));
  protected readonly tasaTexto = signal('26,38');

  protected readonly tasa = computed(() => leerNumero(this.tasaTexto()));
  protected readonly listo = computed(
    () => this.monto() > 0 && this.tasa() > 0,
  );

  protected readonly ayudaCuotaFija = AYUDA_CUOTA_FIJA;
  /** Sin marcar, cuota decreciente; marcada, cuota fija (sistema francés). */
  protected readonly fija = signal(false);
  protected readonly sistema = computed<SistemaAmortizacion>(() =>
    this.fija() ? 'fija' : 'decreciente',
  );
  /** Globo de ayuda abierto (para tocarlo en el celular). */
  protected readonly ayudaAbierta = signal(false);

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
  protected readonly superaUsura = computed(
    () => this.tasa() > USURA_CONSUMO.tasa,
  );

  protected cambiarProducto(valor: string): void {
    if (this.tasas.esProducto(valor)) this.producto.set(valor);
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
