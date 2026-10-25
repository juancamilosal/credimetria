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
import { Chips } from '../../compartido/chips/chips';
import { formatoPesos } from '../../compartido/pipes/formato';
import {
  INGRESOS,
  Reporte,
  SALARIOS,
  URGENCIAS,
  Urgencia,
} from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { ProspectosService } from '../../core/servicios/prospectos.service';
import { TasasService } from '../../core/servicios/tasas.service';
import { leerNumero } from '../../core/utilidades/credito';

const MONTO_MINIMO = 1_000_000;

/** Productos en el orden del formulario: compra de cartera primero. */
const ORDEN_PRODUCTOS: Producto[] = [
  'compra-cartera',
  'libranza',
  'libre-inversion',
  'vehiculo',
  'vivienda',
];

function montoMinimo(
  control: AbstractControl<string>,
): ValidationErrors | null {
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
 * Formulario de prospecto. Solo se envía con la autorización de datos
 * marcada (Ley 1581) y guarda la prueba de esa autorización.
 */
@Component({
  selector: 'app-asesoria',
  imports: [ReactiveFormsModule, RouterLink, Chips],
  templateUrl: './asesoria.html',
  styleUrl: './asesoria.css',
})
export class Asesoria {
  private readonly tasas = inject(TasasService);
  private readonly prospectos = inject(ProspectosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  /** Entidad elegida en el ranking, si llegó desde allí. */
  private entidad: string | null = null;
  private readonly formulario =
    viewChild.required<ElementRef<HTMLElement>>('formulario');

  protected readonly opcionesProducto = ORDEN_PRODUCTOS.map((id) => ({
    valor: id,
    texto: this.tasas.nombre(id),
  }));
  protected readonly opcionesUrgencia = URGENCIAS.map((u) => ({
    valor: u.id,
    texto: u.texto,
  }));
  protected readonly ingresos = INGRESOS;
  protected readonly salarios = SALARIOS;
  protected readonly conectado = this.prospectos.conectado;

  protected readonly form = this.fb.group(
    {
      producto: ['compra-cartera' as string, Validators.required],
      monto: ['', montoMinimo],
      ingreso: [INGRESOS[0] as string],
      salario: [SALARIOS[0] as string],
      ciudad: ['', Validators.required],
      reporte: ['no' as Reporte],
      urgencia: ['ya' as string],
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
    {
      initialValue: false,
    },
  );
  protected readonly quiereCorreo = toSignal(
    this.form.controls.canales.controls.correo.valueChanges,
    { initialValue: false },
  );

  /** Texto que explica de dónde viene la persona (simulador o ranking). */
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

  protected formatearMonto(): void {
    const valor = leerNumero(this.form.controls.monto.value);
    if (valor > 0)
      this.form.controls.monto.setValue(formatoPesos(valor).slice(1));
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
    const prospecto = this.prospectos.armar(
      {
        producto: v.producto as Producto,
        monto: leerNumero(v.monto),
        ingreso: v.ingreso,
        salario: v.salario,
        ciudad: v.ciudad.trim(),
        reporte: v.reporte,
        urgencia: v.urgencia as Urgencia,
        nombre: v.nombre.trim(),
        celular: v.celular.replace(/\D/g, ''),
        canales: v.canales,
        correo: v.canales.correo ? v.correo.trim() : null,
        entidad: this.entidad,
      },
      this.router.url,
    );
    await this.prospectos.enviar(prospecto);
    const urgencia = URGENCIAS.find((u) => u.id === v.urgencia) ?? URGENCIAS[0];
    this.enviado.set(urgencia.cuando);
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
    if (monto > 0)
      this.form.controls.monto.setValue(formatoPesos(monto).slice(1));
    if (URGENCIAS.some((u) => u.id === urgencia)) {
      this.form.controls.urgencia.setValue(urgencia!);
    }

    const origen = params.get('origen');
    const nombre =
      producto && this.tasas.esProducto(producto)
        ? this.tasas.nombre(producto)
        : null;
    if (origen === 'simulador' && nombre) {
      this.vieneDe.set(
        `Desde el simulador: ${nombre}${monto > 0 ? ', ' + formatoPesos(monto) : ''}.`,
      );
    } else if (origen === 'oferta' && nombre) {
      this.vieneDe.set(
        `Desde Compara tu oferta: ${nombre}${monto > 0 ? ', ' + formatoPesos(monto) : ''}.`,
      );
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
