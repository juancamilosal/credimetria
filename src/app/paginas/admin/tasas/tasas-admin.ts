import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { formatoTasa, TasaPipe } from '../../../compartido/pipes/formato';
import {
  CambiosTasa,
  ESTADOS_TASA,
  EstadoTasa,
  FuenteTasa,
  SistemaTasa,
  TasaAdmin,
  TipoTasa,
  UNIDADES_TASA,
  UnidadTasa,
} from '../../../core/modelos/tasa-admin';
import {
  mensajeError,
  SesionAdmin,
} from '../../../core/servicios/sesion-admin.service';
import { TasasAdminService } from '../../../core/servicios/tasas-admin.service';
import { TasasService } from '../../../core/servicios/tasas.service';
import { efectivaAnualDeMensual } from '../../../core/utilidades/credito';

type Filtro = EstadoTasa | 'todas';

const UNIDAD_TEXTO: Record<UnidadTasa, string> = {
  MV: 'M.V.',
  NMV: 'N.M.V.',
  EA: 'E.A.',
};

/** "1,3" o "1.3" → 1.3; vacío → null. */
export function leerDecimal(texto: string): number | null {
  const limpio = texto.trim().replace('%', '').replace(',', '.');
  if (!limpio) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/** 1.3 → "1,3" para escribir en un campo. */
function escribirDecimal(valor: number | null): string {
  return valor === null ? '' : String(+valor.toFixed(4)).replace('.', ',');
}

/**
 * Configuración de tasas: la lista de lo que el robot (o una persona) sacó de
 * las páginas de las entidades, con su fecha y el enlace a la fuente, para
 * publicarlo, rechazarlo o corregirlo sin entrar a Directus.
 */
@Component({
  selector: 'app-tasas-admin',
  imports: [DatePipe, NgTemplateOutlet, ReactiveFormsModule, TasaPipe],
  templateUrl: './tasas-admin.html',
  styleUrl: './tasas-admin.css',
})
export class TasasAdmin implements OnInit {
  private readonly admin = inject(TasasAdminService);
  private readonly sesion = inject(SesionAdmin);
  private readonly tasasPublicas = inject(TasasService);
  private readonly router = inject(Router);

  protected readonly usuario = this.sesion.usuario;
  protected readonly estados = ESTADOS_TASA;
  protected readonly unidades = UNIDADES_TASA;
  protected readonly productos = this.tasasPublicas.productos;

  protected readonly tasas = signal<TasaAdmin[]>([]);
  protected readonly fuentes = signal<FuenteTasa[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly filtro = signal<Filtro>('por_revisar');
  protected readonly producto = signal<string>('todos');
  /** Id de la tasa que se edita, 'nueva' o null. */
  protected readonly editando = signal<number | 'nueva' | null>(null);
  protected readonly ocupado = signal<number | 'nueva' | null>(null);

  protected readonly cuantas = computed(() => {
    const conteo: Record<Filtro, number> = {
      por_revisar: 0,
      publicada: 0,
      rechazada: 0,
      todas: this.tasas().length,
    };
    for (const t of this.tasas()) conteo[t.estado]++;
    return conteo;
  });
  protected readonly visibles = computed(() =>
    this.tasas().filter(
      (t) =>
        (this.filtro() === 'todas' || t.estado === this.filtro()) &&
        (this.producto() === 'todos' || t.producto === this.producto()),
    ),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fuente: [''],
    valor_desde: [''],
    valor_hasta: [''],
    unidad: ['MV' as UnidadTasa | ''],
    ea_desde: [''],
    ea_hasta: [''],
    tipo_tasa: ['' as TipoTasa | ''],
    sistema_amortizacion: ['no_dice' as SistemaTasa],
    vigente_desde: [''],
    frase: [''],
    notas: [''],
  });

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [tasas, fuentes] = await Promise.all([
        this.admin.listar(),
        this.admin.fuentes(),
      ]);
      this.tasas.set(tasas);
      this.fuentes.set(fuentes);
    } catch (error) {
      this.error.set(mensajeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nombreProducto(id: string): string {
    return this.tasasPublicas.esProducto(id)
      ? this.tasasPublicas.nombre(id)
      : id;
  }

  /** "1,30 % a 2,13 % M.V." o "desde 1,10 % N.M.V." */
  protected publica(t: TasaAdmin): string {
    if (t.valor_desde === null) return '—';
    const unidad = t.unidad ? ' ' + UNIDAD_TEXTO[t.unidad] : '';
    return t.valor_hasta === null
      ? `desde ${formatoTasa(t.valor_desde)}${unidad}`
      : `${formatoTasa(t.valor_desde)} a ${formatoTasa(t.valor_hasta)}${unidad}`;
  }

  /** "bbva.com.co" para mostrar de dónde es el enlace. */
  protected sitio(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  protected revisor(t: TasaAdmin): string {
    const p = t.revisada_por;
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '';
  }

  protected async cambiarEstado(
    t: TasaAdmin,
    estado: EstadoTasa,
  ): Promise<void> {
    await this.trabajar(t.id, async () => {
      this.reemplazar(await this.admin.cambiarEstado(t.id, estado));
    });
  }

  protected editar(t: TasaAdmin): void {
    this.form.reset({
      fuente: '',
      valor_desde: escribirDecimal(t.valor_desde),
      valor_hasta: escribirDecimal(t.valor_hasta),
      unidad: t.unidad ?? '',
      ea_desde: escribirDecimal(t.ea_desde),
      ea_hasta: escribirDecimal(t.ea_hasta),
      tipo_tasa: t.tipo_tasa ?? '',
      sistema_amortizacion: t.sistema_amortizacion ?? 'no_dice',
      vigente_desde: t.vigente_desde ?? '',
      frase: t.frase ?? '',
      notas: t.notas ?? '',
    });
    this.editando.set(t.id);
  }

  protected nueva(): void {
    this.form.reset();
    this.form.controls.fuente.setValue(String(this.fuentes()[0]?.id ?? ''));
    this.editando.set('nueva');
  }

  protected cancelar(): void {
    this.editando.set(null);
  }

  /** Con la tasa mensual escrita, llena la E.A. */
  protected calcularEa(): void {
    const { unidad, valor_desde, valor_hasta } = this.form.getRawValue();
    const convertir = (texto: string) => {
      const valor = leerDecimal(texto);
      if (valor === null) return '';
      const ea = unidad === 'EA' ? valor : efectivaAnualDeMensual(valor);
      return escribirDecimal(+ea.toFixed(2));
    };
    this.form.patchValue({
      ea_desde: convertir(valor_desde),
      ea_hasta: convertir(valor_hasta),
    });
  }

  protected async guardar(): Promise<void> {
    const id = this.editando();
    if (id === null) return;
    const v = this.form.getRawValue();
    const cambios: CambiosTasa = {
      valor_desde: leerDecimal(v.valor_desde),
      valor_hasta: leerDecimal(v.valor_hasta),
      unidad: v.unidad || null,
      ea_desde: leerDecimal(v.ea_desde),
      ea_hasta: leerDecimal(v.ea_hasta),
      tipo_tasa: v.tipo_tasa || null,
      sistema_amortizacion: v.sistema_amortizacion,
      vigente_desde: v.vigente_desde || null,
      frase: v.frase.trim() || null,
      notas: v.notas.trim() || null,
    };
    await this.trabajar(id, async () => {
      if (id === 'nueva') {
        const fuente = this.fuentes().find((f) => String(f.id) === v.fuente);
        if (!fuente) throw new Error('Elige la fuente');
        const tasa = await this.admin.crear(fuente, cambios);
        this.tasas.update((lista) => [tasa, ...lista]);
        this.filtro.set('por_revisar');
      } else {
        this.reemplazar(await this.admin.guardar(id, cambios));
      }
      this.editando.set(null);
    });
  }

  protected async salir(): Promise<void> {
    await this.sesion.salir();
    this.router.navigateByUrl('/admin/entrar');
  }

  private reemplazar(tasa: TasaAdmin): void {
    this.tasas.update((lista) =>
      lista.map((t) => (t.id === tasa.id ? tasa : t)),
    );
  }

  private async trabajar(
    id: number | 'nueva',
    tarea: () => Promise<void>,
  ): Promise<void> {
    this.ocupado.set(id);
    this.error.set('');
    try {
      await tarea();
    } catch (error) {
      this.error.set(mensajeError(error));
    } finally {
      this.ocupado.set(null);
    }
  }
}
