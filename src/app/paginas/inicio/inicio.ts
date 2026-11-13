import {
  AVISO_INDEPENDENCIA,
  QUIERO_ESTA_CONTACTA,
} from '../../core/datos/avisos';
import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chips } from '../../compartido/chips/chips';
import { Foto } from '../../compartido/foto/foto';
import { PesosPipe, TasaPipe } from '../../compartido/pipes/formato';
import {
  MONTO_RANKING,
  MONTO_VIVIENDA,
  PLAZO_RANKING,
  PLAZO_VIVIENDA,
} from '../../compartido/tabla-ranking/tabla-ranking';
import { cuotaMensual } from '../../core/utilidades/credito';
import { esVivienda, FUENTE_PROMEDIO } from '../../core/datos/tasas';
import { FOTOS } from '../../core/datos/fotos';
import { URGENCIAS } from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { AnaliticaService } from '../../core/servicios/analitica.service';
import { TasasService } from '../../core/servicios/tasas.service';
import { EsqueletoImagen } from '../../compartido/esqueleto-imagen/esqueleto-imagen';

/** Cada cuánto pasa al siguiente producto "Las 3 tasas más bajas". */
export const ROTAR_CADA_MS = 7_000;

/**
 * Inicio: qué hace Credimetría, las 3 tasas más bajas de cada producto (van
 * rotando cada 7 segundos; flechas a los lados),
 * cómo funciona, con qué entidades comparamos y la entrada a la asesoría.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    DatePipe,
    RouterLink,
    Chips,
    Foto,
    PesosPipe,
    TasaPipe,
    EsqueletoImagen,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly tasas = inject(TasasService);

  protected readonly corte = this.tasas.corte;

  /**
   * Productos de "Las 3 tasas más bajas", en el orden en que rotan: todos los
   * que tienen al menos una entidad con tasa.
   */
  protected readonly productosTop = computed(() =>
    this.tasas.productos.filter((p) => this.tasas.ranking(p.id).length),
  );
  /** Posición del producto que se ve. */
  protected readonly actual = signal(0);
  /** La rotación se detiene con el cursor o el foco encima. */
  protected readonly encima = signal(false);
  /** Con "reducir movimiento" no rota sola. */
  private quieta = false;
  /** Hacia dónde entran las tarjetas: la flecha que se tocó. */
  protected readonly direccion = signal<'derecha' | 'izquierda'>('derecha');
  protected readonly producto = computed<Producto>(
    () =>
      this.productosTop()[this.actual() % (this.productosTop().length || 1)]
        ?.id ?? 'libre-inversion',
  );
  /** "libre inversión", "crédito hipotecario VIS"… para el título. */
  protected readonly nombreProducto = computed(() => {
    const nombre = this.tasas.nombre(this.producto());
    return nombre.charAt(0).toLowerCase() + nombre.slice(1);
  });
  /** Monto y plazo de ejemplo para la cuota (vivienda: a 20 años). */
  protected readonly monto = computed(() =>
    esVivienda(this.producto()) ? MONTO_VIVIENDA : MONTO_RANKING,
  );
  protected readonly plazo = computed(() =>
    esVivienda(this.producto()) ? PLAZO_VIVIENDA : PLAZO_RANKING,
  );
  protected readonly mejores = computed(() => {
    const monto = this.monto();
    const plazo = this.plazo();
    return this.tasas
      .ranking(this.producto())
      .slice(0, 3)
      .map((t) => {
        const cuota = cuotaMensual(monto, t.tasaReal, plazo);
        return {
          ...t,
          diferencia:
            t.tasaAnunciada === null ? null : t.tasaReal - t.tasaAnunciada,
          cuota,
          total: Math.round(cuota) * plazo,
        };
      });
  });
  private reloj: ReturnType<typeof setInterval> | null = null;
  protected readonly entidades = this.tasas.entidadesConLogo;
  protected readonly fotos = FOTOS;
  protected readonly fuente = FUENTE_PROMEDIO;
  protected readonly contacta = QUIERO_ESTA_CONTACTA;
  private readonly analitica = inject(AnaliticaService);

  protected quiero(entidad: string, producto: string): void {
    this.analitica.clicQuieroEsta(entidad, '/', producto);
  }
  protected readonly independencia = AVISO_INDEPENDENCIA;

  /** Tarjetas con foto por tipo de crédito; cada una lleva a su ranking. */
  protected readonly productos = computed(() =>
    (
      [
        {
          id: 'libre-inversion',
          texto: 'Para lo que necesites, sin explicar en qué lo vas a usar.',
          foto: FOTOS.hombrePapeles,
        },
        {
          id: 'libranza',
          texto:
            'Para empleados, docentes y pensionados: la cuota se descuenta de la nómina.',
          foto: FOTOS.docente,
        },
        {
          id: 'vehiculo',
          texto: 'Para estrenar carro, nuevo o usado.',
          foto: FOTOS.jovenCarro,
        },
        {
          id: 'vivienda-no-vis',
          titulo: 'Vivienda',
          texto:
            'Para comprar casa o apartamento a largo plazo: VIS, No VIS y leasing habitacional.',
          foto: FOTOS.familiaVivienda,
        },
      ] as const
    ).map((p) => ({
      ...p,
      id: p.id as Producto,
      titulo: 'titulo' in p ? p.titulo : this.tasas.nombre(p.id),
      mejor: this.tasas.mejor(p.id),
    })),
  );

  protected readonly urgencias = URGENCIAS.map((u) => ({
    valor: u.id,
    texto: u.texto,
  }));
  protected readonly urgencia = signal<string>('ya');

  constructor() {
    // Solo en el navegador (en el servidor la página sale con el primero).
    afterNextRender(() => {
      // Con "reducir movimiento" no rota sola: se cambia con las pestañas.
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        this.quieta = true;
      this.arrancar();
    });
    inject(DestroyRef).onDestroy(() => this.parar());
  }

  /** Con las flechas: el producto anterior o el siguiente, y vuelve a contar. */
  protected anterior(): void {
    this.mover(-1);
  }

  protected siguiente(): void {
    this.mover(1);
  }

  private mover(paso: number): void {
    const cuantos = this.productosTop().length;
    if (!cuantos) return;
    this.direccion.set(paso < 0 ? 'izquierda' : 'derecha');
    this.actual.update((i) => (i + paso + cuantos) % cuantos);
    this.arrancar();
  }

  protected ponerEncima(encima: boolean): void {
    this.encima.set(encima);
    this.arrancar();
  }

  private arrancar(): void {
    this.parar();
    if (this.quieta || this.encima()) return;
    this.reloj = setInterval(() => {
      // Las tasas pueden llegar después de arrancar: sin dos productos, espera.
      const cuantos = this.productosTop().length;
      if (cuantos < 2) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      this.direccion.set('derecha');
      this.actual.update((i) => (i + 1) % cuantos);
    }, ROTAR_CADA_MS);
  }

  private parar(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  protected readonly pasos = [
    {
      titulo: 'Compara las tasas',
      ruta: '/ranking',
      enlace: 'Ver el ranking',
      texto:
        'Mira qué banco cobra menos de verdad, con datos oficiales. Es gratis y no pedimos tus datos.',
    },
    {
      titulo: 'Calcula tu cuota',
      ruta: '/simulador',
      enlace: 'Abrir el simulador',
      texto:
        'Cuánto pagarías al mes y en total, o si la oferta que te hicieron es buena.',
    },
    {
      titulo: 'Pide asesoría gratis',
      ruta: '/asesoria',
      enlace: 'Pedir asesoría',
      texto:
        'Si quieres, un asesor aliado verificado te ayuda a conseguir el crédito. Nunca cobra por adelantado.',
    },
  ];
}
