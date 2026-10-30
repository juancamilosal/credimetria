import {
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
 * (Ley 1581) y guarda la prueba de esa autorización.
 */
@Component({
  selector: 'app-asesoria',
  imports: [ReactiveFormsModule, RouterLink, EntradaMoneda],
  templateUrl: './asesoria.html',
  styleUrl: './asesoria.css',
})
export class Asesoria {
  private readonly tasas = inject(TasasService);
  private readonly prospectos = inject(ProspectosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly formulario =
    viewChild.required<ElementRef<HTMLElement>>('formulario');
  /** Entidad elegida en el ranking, si llegó desde allí. */
  private entidad: string | null = null;
  /** Urgencia, solo si la trae el enlace (inicio o Compara tu oferta). */
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

  protected readonly autorizo = toSignal(
    this.form.controls.autorizo.valueChanges,
    { initialValue: false },
  );

  /** Texto que explica de dónde viene la persona. */
  protected readonly vieneDe = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly enviado = signal<string | null>(null);
  protected readonly enviando = signal(false);
  /** El servidor no la pudo guardar: se queda en el formulario. */
  protected readonly fallo = signal(false);

  constructor() {
    this.llenarDesdeEnlace(inject(ActivatedRoute).snapshot.queryParamMap);
  }

  /** Muestra el error de un campo solo después de tocarlo o de intentar enviar. */
  protected mostrarError(nombre: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  protected errorCanales(): boolean {
    return this.form.hasError('sinCanal') && this.intentoEnviar();
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
    this.intentoEnviar.set(true);
    this.form.markAllAsTouched();
    if (!this.form.controls.autorizo.value || this.enviando()) return;
    if (this.form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const v = this.form.getRawValue();
    const monto = leerNumero(v.monto);
    const prospecto = this.prospectos.armar(
      {
        producto: v.producto as ProductoInteres,
        monto: monto > 0 ? monto : null,
        ciudad: v.ciudad.trim(),
        urgencia: this.urgencia,
        nombres: v.nombres.trim(),
        apellidos: v.apellidos.trim(),
        celular: v.celular.replace(/\D/g, ''),
        canales: v.canales,
        correo: v.correo.trim(),
        entidad: this.entidad,
      },
      this.router.url,
    );
    this.enviando.set(true);
    this.fallo.set(false);
    try {
      await this.prospectos.enviar(prospecto);
    } catch {
      this.fallo.set(true);
      return;
    } finally {
      this.enviando.set(false);
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
      this.vieneDe.set(`Desde Compara tu oferta: ${nombre}${conMonto}.`);
    } else if (origen === 'ranking' && this.entidad && nombre) {
      this.vieneDe.set(`Desde el ranking: ${this.entidad}, ${nombre}.`);
    }
  }

  private enfocarPrimerError(): void {
    queueMicrotask(() => {
      const campo = this.formulario().nativeElement.querySelector<HTMLElement>(
        '[aria-invalid="true"], .error',
      );
      campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (campo instanceof HTMLInputElement)
        campo.focus({ preventScroll: true });
    });
  }
}
