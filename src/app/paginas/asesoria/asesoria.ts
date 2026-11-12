import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { EntradaMoneda } from '../../compartido/entrada-moneda/entrada-moneda';
import { formatoPesos } from '../../compartido/pipes/formato';
import {
  ProductoInteres,
  URGENCIAS,
  Urgencia,
} from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { ProspectosService } from '../../core/servicios/prospectos.service';
import { TasasService } from '../../core/servicios/tasas.service';
import { TurnstileService } from '../../core/servicios/turnstile.service';
import { leerNumero } from '../../core/utilidades/credito';

const MONTO_MINIMO = 1_000_000;

/** Ciudades que se sugieren mientras escribe (puede escribir cualquiera). */
const CIUDADES = [
  'Bogotá',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Cartagena',
  'Bucaramanga',
  'Cúcuta',
  'Pereira',
  'Manizales',
  'Ibagué',
  'Santa Marta',
  'Villavicencio',
  'Pasto',
  'Neiva',
  'Armenia',
  'Montería',
  'Valledupar',
  'Popayán',
  'Tunja',
  'Sincelejo',
];

/** Tarjetas del tipo de crédito; vivienda se precisa debajo. */
export type TipoCredito =
  | 'libranza'
  | 'libre-inversion'
  | 'vehiculo'
  | 'vivienda';
const TIPOS: { id: TipoCredito; nombre: string; detalle: string }[] = [
  {
    id: 'libranza',
    nombre: 'Libranza',
    detalle: 'Se descuenta de tu nómina o pensión',
  },
  {
    id: 'libre-inversion',
    nombre: 'Libre inversión',
    detalle: 'Para lo que necesites',
  },
  {
    id: 'vehiculo',
    nombre: 'Vehículo',
    detalle: 'Carro o moto, nuevo o usado',
  },
  { id: 'vivienda', nombre: 'Vivienda', detalle: 'Comprar casa o apartamento' },
];

/** Productos que acepta el formulario (desde un enlace). */
const ORDEN_PRODUCTOS: Producto[] = [
  'libranza',
  'libre-inversion',
  'vehiculo',
  'vivienda-vis',
  'vivienda-no-vis',
  'leasing-vis',
  'leasing-no-vis',
];

/** El monto es opcional; si lo escribe, que sea de al menos $1.000.000. */
function montoOpcional(
  control: AbstractControl<string>,
): ValidationErrors | null {
  if (!control.value.trim()) return null;
  return leerNumero(control.value) >= MONTO_MINIMO
    ? null
    : { montoMinimo: true };
}

function celularColombiano(
  control: AbstractControl<string>,
): ValidationErrors | null {
  return /^3\d{9}$/.test(control.value.replace(/\D/g, ''))
    ? null
    : { celular: true };
}

/** Al menos un canal. */
function canalesValidos(grupo: AbstractControl): ValidationErrors | null {
  const { whatsapp, llamada, correo } = grupo.get('canales')!.value;
  return whatsapp || llamada || correo ? null : { sinCanal: true };
}

/** Nombres y apellidos se guardan en mayúsculas (con tildes y ñ). */
export const mayusculas = (texto: string) =>
  texto.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-CO');

/** El correo siempre: allí le llega la confirmación de la solicitud. */
function correoValido(
  control: AbstractControl<string>,
): ValidationErrors | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(control.value.trim())
    ? null
    : { correo: true };
}

/**
 * Formulario de prospecto en una sola pantalla corta: qué crédito le
 * interesa, la ciudad y cómo contactarla. Ingresos, reportes y demás los
 * pregunta el asesor. Solo se envía con la autorización de datos marcada
 * (Ley 1581) y guarda la prueba de esa autorización. Cloudflare Turnstile
 * comprueba que no sea un bot: sin su token el botón no se habilita.
 */
@Component({
  selector: 'app-asesoria',
  imports: [ReactiveFormsModule, RouterLink, EntradaMoneda],
  templateUrl: './asesoria.html',
  styleUrl: './asesoria.css',
})
export class Asesoria implements OnDestroy {
  private readonly tasas = inject(TasasService);
  private readonly prospectos = inject(ProspectosService);
  private readonly router = inject(Router);
  private readonly turnstile = inject(TurnstileService);
  private readonly fb = inject(FormBuilder).nonNullable;
  /** Entidad elegida en el ranking, si llegó desde allí. */
  private entidad: string | null = null;
  /** Urgencia, solo si la trae el enlace (inicio o la oferta del simulador). */
  private urgencia: Urgencia | null = null;

  protected readonly tipos = TIPOS;
  protected readonly ciudades = CIUDADES;
  /** Tarjeta elegida. */
  protected readonly tipo = signal<TipoCredito | null>(null);
  /**
   * Producto de vivienda exacto si llegó en el enlace (ranking, simulador):
   * se guarda sin preguntarlo; si no, el prospecto dice solo "vivienda".
   */
  private viviendaDelEnlace: Producto | null = null;

  protected readonly form = this.fb.group(
    {
      producto: ['', Validators.required],
      monto: ['', montoOpcional],
      ciudad: ['', Validators.required],
      nombres: ['', Validators.required],
      apellidos: ['', Validators.required],
      celular: ['', celularColombiano],
      canales: this.fb.group({ whatsapp: true, llamada: false, correo: false }),
      correo: ['', correoValido],
      autorizo: [false, Validators.requiredTrue],
    },
    { validators: canalesValidos },
  );

  /** Texto que explica de dónde viene la persona. */
  protected readonly vieneDe = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly enviado = signal<string | null>(null);
  protected readonly enviando = signal(false);
  /** El servidor no la pudo guardar: se queda en el formulario. */
  protected readonly fallo = signal(false);
  /**
   * Hasta dónde se ve el formulario: 1 el tipo de crédito; 2 monto y ciudad;
   * 3 los datos de contacto; 4 la autorización. Avanza a medida que la
   * persona llena lo anterior y nunca se devuelve.
   */
  protected readonly paso = signal(1);
  /** Todo lleno y la autorización marcada: el botón se habilita. */
  protected readonly completo = signal(false);
  /** Token de Turnstile; sirve para un solo envío. */
  protected readonly token = signal<string | null>(null);
  /** El widget de Turnstile no cargó o falló (se borra con un token nuevo). */
  private readonly errorWidget = signal(false);
  /** El servidor rechazó la verificación (se borra al volver a enviar). */
  private readonly rechazada = signal(false);
  /** Mensaje de que no se pudo comprobar que no es un robot. */
  protected readonly falloVerificacion = computed(
    () => this.errorWidget() || this.rechazada(),
  );
  /** Contenedor del widget, justo encima del botón. */
  private readonly cajaTurnstile =
    viewChild<ElementRef<HTMLElement>>('turnstile');
  private cajaActual: HTMLElement | null = null;
  private widgetId: string | null = null;
  private destruido = false;

  constructor() {
    this.llenarDesdeEnlace(inject(ActivatedRoute).snapshot.queryParamMap);
    this.avanzar();
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.avanzar());
    // Solo en el navegador (afterRenderEffect no corre en SSR). El
    // formulario desaparece al enviar y vuelve con "volver": el widget se
    // quita y se monta otra vez con su contenedor.
    afterRenderEffect(() => {
      const caja = this.cajaTurnstile()?.nativeElement ?? null;
      if (caja === this.cajaActual) return;
      this.soltarWidget();
      this.cajaActual = caja;
      if (caja) void this.montarWidget(caja);
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.soltarWidget();
  }

  private async montarWidget(caja: HTMLElement): Promise<void> {
    try {
      const id = await this.turnstile.mostrar(caja, {
        token: (token) => {
          this.token.set(token);
          this.errorWidget.set(false);
        },
        vencido: () => this.token.set(null),
        error: () => {
          this.token.set(null);
          this.errorWidget.set(true);
        },
      });
      // Si el contenedor ya no está (envió o salió de la página), se quita.
      if (this.destruido || this.cajaActual !== caja) {
        this.turnstile.quitar(id);
        return;
      }
      this.widgetId = id;
    } catch {
      this.errorWidget.set(true);
    }
  }

  private soltarWidget(): void {
    if (this.widgetId) this.turnstile.quitar(this.widgetId);
    this.widgetId = null;
    this.cajaActual = null;
    this.token.set(null);
  }

  /** Muestra la parte siguiente cuando lo anterior ya está lleno. */
  private avanzar(): void {
    this.completo.set(this.form.valid);
    const c = this.form.controls;
    let hasta = 1;
    if (c.producto.valid) hasta = 2;
    if (hasta === 2 && c.ciudad.value.trim().length >= 3) hasta = 3;
    if (
      hasta === 3 &&
      c.nombres.valid &&
      c.apellidos.valid &&
      c.celular.valid &&
      c.correo.valid
    )
      hasta = 4;
    if (hasta > this.paso()) this.paso.set(hasta);
  }

  /** Muestra el error de un campo solo después de tocarlo o de intentar enviar. */
  protected mostrarError(nombre: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  /** El celular: solo números y máximo 10. */
  protected soloDigitos(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '').slice(0, 10);
    if (limpio !== input.value) {
      input.value = limpio;
      this.form.controls.celular.setValue(limpio);
    }
  }

  protected errorCanales(): boolean {
    return (
      this.form.hasError('sinCanal') &&
      (this.form.controls.canales.touched || this.intentoEnviar())
    );
  }

  protected elegirTipo(tipo: TipoCredito): void {
    this.tipo.set(tipo);
    this.actualizarProducto();
  }

  /** El producto del prospecto: el de la tarjeta. */
  private actualizarProducto(): void {
    const tipo = this.tipo();
    const producto =
      tipo === 'vivienda'
        ? (this.viviendaDelEnlace ?? 'vivienda')
        : (tipo ?? '');
    this.form.controls.producto.setValue(producto);
    this.form.controls.producto.markAsTouched();
  }

  protected async enviar(): Promise<void> {
    // El botón solo se habilita con todo lleno (ver `completo`).
    const token = this.token();
    if (this.enviando() || this.form.invalid || !token) return;
    this.intentoEnviar.set(true);
    const v = this.form.getRawValue();
    const monto = leerNumero(v.monto);
    const prospecto = this.prospectos.armar(
      {
        producto: v.producto as ProductoInteres,
        monto: monto > 0 ? monto : null,
        ciudad: v.ciudad.trim(),
        urgencia: this.urgencia,
        nombres: mayusculas(v.nombres),
        apellidos: mayusculas(v.apellidos),
        celular: v.celular.replace(/\D/g, ''),
        canales: v.canales,
        correo: v.correo.trim(),
        entidad: this.entidad,
      },
      this.router.url,
    );
    this.enviando.set(true);
    this.fallo.set(false);
    this.rechazada.set(false);
    try {
      await this.prospectos.enviar(prospecto, token);
    } catch (e) {
      const verificacion =
        e instanceof HttpErrorResponse &&
        e.status === 400 &&
        e.error?.error === 'verificacion';
      (verificacion ? this.rechazada : this.fallo).set(true);
      return;
    } finally {
      this.enviando.set(false);
      // Cada token sirve una sola vez: se pide otro, salga bien o mal.
      this.token.set(null);
      if (this.widgetId) this.turnstile.reiniciar(this.widgetId);
    }
    const urgencia = URGENCIAS.find((u) => u.id === this.urgencia);
    this.enviado.set(urgencia?.cuando ?? 'pronto');
    globalThis.scrollTo?.(0, 0);
  }

  protected volver(): void {
    this.enviado.set(null);
  }

  private llenarDesdeEnlace(params: ParamMap): void {
    const producto = params.get('producto');
    const monto = Number(params.get('monto'));
    const urgencia = params.get('urgencia');
    this.entidad = params.get('entidad');

    if (producto && ORDEN_PRODUCTOS.includes(producto as Producto)) {
      this.form.controls.producto.setValue(producto);
      if (/^(vivienda|leasing)-/.test(producto)) {
        this.tipo.set('vivienda');
        this.viviendaDelEnlace = producto as Producto;
      } else this.tipo.set(producto as TipoCredito);
    }
    if (monto > 0) {
      this.form.controls.monto.setValue(formatoPesos(monto).slice(1));
    }
    const conocida = URGENCIAS.find((u) => u.id === urgencia);
    if (conocida) this.urgencia = conocida.id;

    const origen = params.get('origen');
    const nombre =
      producto && this.tasas.esProducto(producto)
        ? this.tasas.nombre(producto)
        : null;
    const conMonto = monto > 0 ? ', ' + formatoPesos(monto) : '';
    if (origen === 'simulador' && nombre) {
      this.vieneDe.set(`Desde el simulador: ${nombre}${conMonto}.`);
    } else if (origen === 'oferta' && nombre) {
      this.vieneDe.set(`Desde el simulador (tu oferta): ${nombre}${conMonto}.`);
    } else if (origen === 'ranking' && this.entidad && nombre) {
      this.vieneDe.set(`Desde el ranking: ${this.entidad}, ${nombre}.`);
    } else if (origen === 'reportados') {
      this.vieneDe.set(
        this.entidad
          ? `Desde Créditos para reportados: ${this.entidad}.`
          : 'Desde Créditos para reportados.',
      );
    }
  }
}
