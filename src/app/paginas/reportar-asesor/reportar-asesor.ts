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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AliadosService } from '../../core/servicios/aliados.service';
import {
  MOTIVOS_REPORTE,
  MotivoReporte,
  ReportesService,
  TEXTO_AUTORIZACION_REPORTE,
} from '../../core/servicios/reportes.service';
import { TurnstileService } from '../../core/servicios/turnstile.service';

/** Valor del selector cuando el asesor no está en la lista. */
const OTRO = 'otro';

function celularOpcional(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const v = control.value.replace(/\D/g, '');
  return !v || /^3\d{9}$/.test(v) ? null : { celular: true };
}

function correoValido(
  control: AbstractControl<string>,
): ValidationErrors | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(control.value.trim())
    ? null
    : { correo: true };
}

/** Si eligió "No está en la lista", el nombre del asesor es obligatorio. */
function nombreSiOtro(grupo: AbstractControl): ValidationErrors | null {
  const { asesor, asesorNombre } = grupo.value;
  return asesor === OTRO && !asesorNombre?.trim() ? { sinNombre: true } : null;
}

/**
 * Formulario para reportar a un asesor que incumplió las reglas: cuál
 * (de los publicados en Directus, o uno que no está en la lista), qué pasó y
 * cómo contactar a quien reporta. Con Turnstile y la autorización de datos.
 */
@Component({
  selector: 'app-reportar-asesor',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reportar-asesor.html',
  styleUrl: './reportar-asesor.css',
})
export class ReportarAsesor implements OnDestroy {
  private readonly aliadosServicio = inject(AliadosService);
  private readonly reportes = inject(ReportesService);
  private readonly turnstile = inject(TurnstileService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly aliados = this.aliadosServicio.aliados;
  protected readonly motivos = MOTIVOS_REPORTE;
  protected readonly otro = OTRO;
  protected readonly textoAutorizacion = TEXTO_AUTORIZACION_REPORTE;

  protected readonly form = this.fb.group(
    {
      asesor: ['', Validators.required],
      asesorNombre: ['', Validators.maxLength(120)],
      motivo: ['', Validators.required],
      descripcion: [
        '',
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(3000),
        ],
      ],
      fechaContacto: [''],
      nombre: ['', [Validators.required, Validators.maxLength(120)]],
      correo: ['', correoValido],
      celular: ['', celularOpcional],
      autorizo: [false, Validators.requiredTrue],
    },
    { validators: nombreSiOtro },
  );

  protected readonly valido = signal(false);
  protected readonly esOtro = signal(false);
  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly fallo = signal(false);
  protected readonly token = signal<string | null>(null);
  private readonly errorWidget = signal(false);
  private readonly rechazada = signal(false);
  protected readonly falloVerificacion = computed(
    () => this.errorWidget() || this.rechazada(),
  );
  /** Nombre del asesor elegido, para el mensaje final. */
  protected readonly nombreAsesor = signal<string | null>(null);

  private readonly cajaTurnstile =
    viewChild<ElementRef<HTMLElement>>('turnstile');
  private cajaActual: HTMLElement | null = null;
  private widgetId: string | null = null;
  private destruido = false;

  constructor() {
    const pedido = inject(ActivatedRoute).snapshot.queryParamMap.get('asesor');
    void this.aliadosServicio.cargar().then(() => {
      if (pedido && this.aliados().some((a) => a.id === pedido)) {
        this.form.controls.asesor.setValue(pedido);
      }
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.valido.set(this.form.valid);
      this.esOtro.set(this.form.controls.asesor.value === OTRO);
    });
    // Turnstile solo en el navegador (afterRenderEffect no corre en SSR).
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

  protected mostrarError(nombre: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || this.intento());
  }

  protected errorNombreAsesor(): boolean {
    return (
      this.form.hasError('sinNombre') &&
      (this.form.controls.asesorNombre.touched || this.intento())
    );
  }

  protected async enviar(): Promise<void> {
    this.intento.set(true);
    const token = this.token();
    if (this.enviando() || this.form.invalid || !token) return;
    const v = this.form.getRawValue();
    const enLista = v.asesor !== OTRO;
    this.enviando.set(true);
    this.fallo.set(false);
    this.rechazada.set(false);
    try {
      await this.reportes.enviar(
        {
          asesor: enLista ? v.asesor : null,
          asesorNombre: enLista ? null : v.asesorNombre.trim(),
          motivo: v.motivo as MotivoReporte,
          descripcion: v.descripcion.trim(),
          fechaContacto: v.fechaContacto || null,
          nombre: v.nombre.trim(),
          correo: v.correo.trim(),
          celular: v.celular.replace(/\D/g, '') || null,
        },
        this.router.url,
        token,
      );
    } catch (e) {
      const verificacion =
        e instanceof HttpErrorResponse &&
        e.status === 400 &&
        e.error?.error === 'verificacion';
      (verificacion ? this.rechazada : this.fallo).set(true);
      return;
    } finally {
      this.enviando.set(false);
      this.token.set(null);
      if (this.widgetId) this.turnstile.reiniciar(this.widgetId);
    }
    this.nombreAsesor.set(
      enLista
        ? (this.aliados().find((a) => a.id === v.asesor)?.nombre ?? null)
        : v.asesorNombre.trim(),
    );
    this.enviado.set(true);
    globalThis.scrollTo?.(0, 0);
  }
}
