import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
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
import { Chips } from '../../compartido/chips/chips';
import { formatoPesos, PesosPipe } from '../../compartido/pipes/formato';
import { URGENCIAS, Urgencia } from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { ProspectosService } from '../../core/servicios/prospectos.service';
import { TasasService } from '../../core/servicios/tasas.service';
import { leerNumero } from '../../core/utilidades/credito';

const MONTO_MINIMO = 1_000_000;

/** Montos de un toque para no tener que escribir. */
const MONTOS_RAPIDOS = [5_000_000, 10_000_000, 20_000_000, 50_000_000];

/** Ciudades con más solicitudes; "Otra" deja escribirla. */
const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga'];
const OTRA = 'Otra';

/** Productos en el orden del formulario: compra de cartera primero. */
const ORDEN_PRODUCTOS: Producto[] = [
  'compra-cartera',
  'libranza',
  'libre-inversion',
  'vehiculo',
  'vivienda',
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

/** Al menos un canal, y el correo si marcó "Correo". */
function canalesValidos(grupo: AbstractControl): ValidationErrors | null {
  const { whatsapp, llamada, correo } = grupo.get('canales')!.value;
  const errores: ValidationErrors = {};
  if (!whatsapp && !llamada && !correo) errores['sinCanal'] = true;
  const email = String(grupo.get('correo')!.value).trim();
  if (correo && !/^\S+@\S+\.\S+$/.test(email)) errores['correo'] = true;
  return Object.keys(errores).length ? errores : null;
}

/**
 * Formulario de prospecto en una sola pantalla corta: qué crédito le
 * interesa, la ciudad y cómo contactarla. Ingresos, reportes y demás los
 * pregunta el asesor. Solo se envía con la autorización de datos marcada
 * (Ley 1581) y guarda la prueba de esa autorización.
 */
@Component({
  selector: 'app-asesoria',
  imports: [ReactiveFormsModule, RouterLink, Chips, PesosPipe],
  templateUrl: './asesoria.html',
  styleUrl: './asesoria.css',
})
export class Asesoria {
  private readonly tasas = inject(TasasService);
  private readonly prospectos = inject(ProspectosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly injector = inject(Injector);
  private readonly formulario =
    viewChild.required<ElementRef<HTMLElement>>('formulario');
  /** Entidad elegida en el ranking, si llegó desde allí. */
  private entidad: string | null = null;
  /** Urgencia, solo si la trae el enlace (inicio o Compara tu oferta). */
  private urgencia: Urgencia | null = null;

  protected readonly opcionesProducto = ORDEN_PRODUCTOS.map((id) => ({
    valor: id,
    texto: this.tasas.nombre(id),
  }));
  protected readonly opcionesCiudad = [...CIUDADES, OTRA].map((c) => ({
    valor: c,
    texto: c,
  }));
  protected readonly montosRapidos = MONTOS_RAPIDOS;
  protected readonly conectado = this.prospectos.conectado;

  protected readonly form = this.fb.group(
    {
      producto: ['', Validators.required],
      monto: ['', montoOpcional],
      ciudad: ['', Validators.required],
      nombre: ['', Validators.required],
      celular: ['', celularColombiano],
      canales: this.fb.group({ whatsapp: true, llamada: false, correo: false }),
      correo: [''],
      autorizo: [false, Validators.requiredTrue],
    },
    { validators: canalesValidos },
  );

  protected readonly autorizo = toSignal(
    this.form.controls.autorizo.valueChanges,
    { initialValue: false },
  );
  protected readonly quiereCorreo = toSignal(
    this.form.controls.canales.controls.correo.valueChanges,
    { initialValue: false },
  );

  /** Muestra el campo para escribir un monto que no está en los botones. */
  protected readonly otroMonto = signal(false);
  /** Ciudad elegida en los botones ('Otra' muestra el campo para escribirla). */
  protected readonly ciudadElegida = signal('');
  /** Texto que explica de dónde viene la persona. */
  protected readonly vieneDe = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly enviado = signal<string | null>(null);

  constructor() {
    this.llenarDesdeEnlace(inject(ActivatedRoute).snapshot.queryParamMap);
  }

  /** Muestra el error de un campo solo después de tocarlo o de intentar enviar. */
  protected mostrarError(nombre: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  protected errorGrupo(error: 'sinCanal' | 'correo'): boolean {
    return this.form.hasError(error) && this.intentoEnviar();
  }

  protected elegirMonto(monto: number): void {
    this.otroMonto.set(false);
    this.form.controls.monto.setValue(formatoPesos(monto).slice(1));
  }

  protected escribirOtroMonto(): void {
    this.otroMonto.set(true);
    this.form.controls.monto.setValue('');
    this.enfocar('#asMonto');
  }

  protected formatearMonto(): void {
    const valor = leerNumero(this.form.controls.monto.value);
    if (valor > 0)
      this.form.controls.monto.setValue(formatoPesos(valor).slice(1));
  }

  protected elegirCiudad(ciudad: string): void {
    this.ciudadElegida.set(ciudad);
    this.form.controls.ciudad.setValue(ciudad === OTRA ? '' : ciudad);
    if (ciudad === OTRA) {
      this.form.controls.ciudad.markAsUntouched();
      this.enfocar('#asCiudad');
    }
  }

  protected async enviar(): Promise<void> {
    this.intentoEnviar.set(true);
    this.form.markAllAsTouched();
    if (!this.form.controls.autorizo.value) return;
    if (this.form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const v = this.form.getRawValue();
    const monto = leerNumero(v.monto);
    const prospecto = this.prospectos.armar(
      {
        producto: v.producto as Producto,
        monto: monto > 0 ? monto : null,
        ciudad: v.ciudad.trim(),
        urgencia: this.urgencia,
        nombre: v.nombre.trim(),
        celular: v.celular.replace(/\D/g, ''),
        canales: v.canales,
        correo: v.canales.correo ? v.correo.trim() : null,
        entidad: this.entidad,
      },
      this.router.url,
    );
    await this.prospectos.enviar(prospecto);
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
    }
    if (monto > 0) {
      this.form.controls.monto.setValue(formatoPesos(monto).slice(1));
      this.otroMonto.set(!MONTOS_RAPIDOS.includes(monto));
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

  /** Pone el foco en un elemento cuando ya está en pantalla. */
  private enfocar(selector: string): void {
    afterNextRender(
      () =>
        this.formulario()
          .nativeElement.querySelector<HTMLElement>(selector)
          ?.focus(),
      { injector: this.injector },
    );
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
