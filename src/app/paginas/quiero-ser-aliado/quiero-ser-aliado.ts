import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Verificacion } from '../../compartido/verificacion/verificacion';
import { REGLAS_PARA_ASESOR } from '../../core/datos/reglas-aliados';
import { AnaliticaService } from '../../core/servicios/analitica.service';
import {
  PRODUCTOS_ALIADO,
  SolicitudesAliadosService,
  TEXTO_AUTORIZACION_ALIADO,
  TIPOS_ALIADO,
  VINCULOS,
} from '../../core/servicios/solicitudes-aliados.service';
import { TasasService } from '../../core/servicios/tasas.service';

const celular = (c: AbstractControl<string>): ValidationErrors | null =>
  /^3\d{9}$/.test(c.value.replace(/\D/g, '')) ? null : { celular: true };
const cedula = (c: AbstractControl<string>): ValidationErrors | null =>
  /^\d{5,12}$/.test(c.value.replace(/\D/g, '')) ? null : { cedula: true };
const correo = (c: AbstractControl<string>): ValidationErrors | null =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value.trim()) ? null : { correo: true };

/** "Bogotá, Cali ,  Pasto" → ["Bogotá", "Cali", "Pasto"]. */
export const separar = (texto: string): string[] =>
  [
    ...new Set(
      texto
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ].slice(0, 40);

/**
 * "Quiero ser aliado": un asesor deja sus datos, con qué entidades,
 * productos y ciudades trabaja, cómo demuestra su vínculo y acepta las 5
 * reglas. Se guarda en Directus (`solicitudes_aliados`) y avisa por correo.
 */
@Component({
  selector: 'app-quiero-ser-aliado',
  imports: [ReactiveFormsModule, RouterLink, Verificacion],
  templateUrl: './quiero-ser-aliado.html',
  styleUrl: './quiero-ser-aliado.css',
})
export class QuieroSerAliado {
  private readonly solicitudes = inject(SolicitudesAliadosService);
  private readonly router = inject(Router);
  private readonly analitica = inject(AnaliticaService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly tipos = TIPOS_ALIADO;
  protected readonly vinculos = VINCULOS;
  protected readonly productos = PRODUCTOS_ALIADO;
  protected readonly reglas = REGLAS_PARA_ASESOR;
  protected readonly entidadesConocidas = inject(TasasService).listaEntidades;
  protected readonly textoAutorizacion = TEXTO_AUTORIZACION_ALIADO.replace(
    'política de tratamiento de datos.',
    '',
  );

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    cedula: ['', cedula],
    celular: ['', celular],
    correo: ['', correo],
    ciudad: ['', [Validators.required, Validators.maxLength(80)]],
    tipo: ['', Validators.required],
    empresa: ['', Validators.maxLength(120)],
    entidades: [[] as string[]],
    otrasEntidades: [''],
    productos: [[] as string[]],
    ciudades: ['', Validators.required],
    experiencia: ['', [Validators.required, Validators.pattern(/^\d{1,2}$/)]],
    vinculo: ['', Validators.required],
    mensaje: ['', Validators.maxLength(2000)],
    reglas: [false, Validators.requiredTrue],
    autorizo: [false, Validators.requiredTrue],
  });

  private readonly verificacion = viewChild(Verificacion);
  protected readonly token = signal<string | null>(null);
  protected readonly falloWidget = signal(false);
  private readonly rechazada = signal(false);
  protected readonly falloVerificacion = computed(
    () => this.falloWidget() || this.rechazada(),
  );
  protected readonly valido = signal(false);
  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly fallo = signal(false);

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.valido.set(this.completo()));
  }

  /** Entidades elegidas y escritas, sin repetir. */
  private entidades(): string[] {
    const v = this.form.getRawValue();
    return [...new Set([...v.entidades, ...separar(v.otrasEntidades)])];
  }

  private completo(): boolean {
    return (
      this.form.valid &&
      this.entidades().length > 0 &&
      this.form.controls.productos.value.length > 0 &&
      separar(this.form.controls.ciudades.value).length > 0
    );
  }

  protected marcado(lista: 'entidades' | 'productos', valor: string): boolean {
    return this.form.controls[lista].value.includes(valor);
  }

  protected alternar(lista: 'entidades' | 'productos', valor: string): void {
    const control = this.form.controls[lista];
    const actual = control.value;
    control.setValue(
      actual.includes(valor)
        ? actual.filter((v) => v !== valor)
        : [...actual, valor],
    );
    control.markAsTouched();
  }

  protected mostrarError(nombre: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || this.intento());
  }

  protected faltaEntidad(): boolean {
    return this.intento() && this.entidades().length === 0;
  }

  protected faltaProducto(): boolean {
    return this.intento() && this.form.controls.productos.value.length === 0;
  }

  protected async enviar(): Promise<void> {
    this.intento.set(true);
    const token = this.token();
    if (this.enviando() || !this.completo() || !token) return;
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.fallo.set(false);
    this.rechazada.set(false);
    try {
      await this.solicitudes.enviar(
        {
          nombre: v.nombre.trim().replace(/\s+/g, ' '),
          cedula: v.cedula.replace(/\D/g, ''),
          celular: v.celular.replace(/\D/g, ''),
          correo: v.correo.trim(),
          ciudad: v.ciudad.trim(),
          tipo: v.tipo,
          empresa: v.empresa.trim() || null,
          entidades: this.entidades(),
          productos: v.productos,
          ciudades: separar(v.ciudades),
          experiencia: Number(v.experiencia),
          vinculo: v.vinculo,
          mensaje: v.mensaje.trim() || null,
          aceptaReglas: v.reglas,
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
      this.verificacion()?.reiniciar();
    }
    this.analitica.evento('solicitud_aliado', { tipo: v.tipo });
    this.enviado.set(true);
    globalThis.scrollTo?.(0, 0);
  }
}
