import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ayuda } from '../../compartido/ayuda/ayuda';
import { Chips } from '../../compartido/chips/chips';
import { Foto } from '../../compartido/foto/foto';
import {
  PesosPipe,
  PuntosPipe,
  TasaPipe,
} from '../../compartido/pipes/formato';
import {
  MONTO_RANKING,
  MONTO_VIVIENDA,
  PLAZO_RANKING,
  PLAZO_VIVIENDA,
} from '../../compartido/tabla-ranking/tabla-ranking';
import { cuotaMensual } from '../../core/utilidades/credito';
import {
  AYUDA_DIFERENCIA,
  esVivienda,
  FUENTE_PROMEDIO,
} from '../../core/datos/tasas';
import { FOTOS } from '../../core/datos/fotos';
import { URGENCIAS } from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';
import { EsqueletoImagen } from '../../compartido/esqueleto-imagen/esqueleto-imagen';

/** Cada cuánto pasa al siguiente producto "Las 3 tasas más bajas". */
export const ROTAR_CADA_MS = 10_000;

/**
 * Inicio: qué hace Credimetría, las 3 tasas más bajas de cada producto (van
 * rotando cada 10 segundos),
 * cómo funciona, con qué entidades comparamos y la entrada a la asesoría.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    DatePipe,
    RouterLink,
    Ayuda,
    Chips,
    Foto,
    PesosPipe,
    PuntosPipe,
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
  /** La rotación está detenida (cursor o foco encima, o el botón de pausa). */
  protected readonly encima = signal(false);
  protected readonly enPausa = signal(false);
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
  protected readonly rotarCadaMs = ROTAR_CADA_MS;
  /** Cambia cada vez que arranca un intervalo (la barra vuelve a empezar). */
  protected readonly vuelta = signal(0);
  private reloj: ReturnType<typeof setInterval> | null = null;
  private readonly pestanas = viewChild<ElementRef<HTMLElement>>('pestanas');
  protected readonly hayUsura = computed(() =>
    this.mejores().some((t) => t.hastaUsura),
  );
  protected readonly entidades = this.tasas.entidadesConLogo;
  protected readonly fotos = FOTOS;
  protected readonly fuente = FUENTE_PROMEDIO;
  protected readonly ayudaDiferencia = AYUDA_DIFERENCIA;

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
        this.enPausa.set(true);
      this.arrancar();
    });
    inject(DestroyRef).onDestroy(() => this.parar());
  }

  /** Muestra el producto de la pestaña tocada y vuelve a contar 10 s. */
  protected elegir(posicion: number): void {
    this.actual.set(posicion);
    this.arrancar();
    this.verPestana();
  }

  /**
   * En el celular las pestañas no caben: desplaza la fila (no la página)
   * para que se vea la del producto que se muestra.
   */
  private verPestana(): void {
    setTimeout(() => {
      const fila = this.pestanas()?.nativeElement;
      const activa = fila?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!fila || !activa) return;
      const izquierda =
        activa.offsetLeft - (fila.clientWidth - activa.offsetWidth) / 2;
      fila.scrollTo({ left: Math.max(0, izquierda), behavior: 'smooth' });
    });
  }

  protected alternarPausa(): void {
    this.enPausa.update((p) => !p);
    this.arrancar();
  }

  protected ponerEncima(encima: boolean): void {
    this.encima.set(encima);
    this.arrancar();
  }

  private arrancar(): void {
    this.parar();
    this.vuelta.update((v) => v + 1);
    if (this.enPausa() || this.encima()) return;
    this.reloj = setInterval(() => {
      // Las tasas pueden llegar después de arrancar: sin dos productos, espera.
      const cuantos = this.productosTop().length;
      if (cuantos < 2) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      this.actual.update((i) => (i + 1) % cuantos);
      this.vuelta.update((v) => v + 1);
      this.verPestana();
    }, ROTAR_CADA_MS);
  }

  private parar(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  protected readonly pasos = [
    {
      titulo: 'Compara',
      texto:
        'Mira la tasa que anuncia cada entidad al lado de la que cobra en promedio.',
    },
    {
      titulo: 'Cuéntanos qué necesitas',
      texto: 'Producto, monto y cuándo lo necesitas. Toma menos de un minuto.',
    },
    {
      titulo: 'Un asesor aliado te contacta',
      texto:
        'Máximo 2 asesores verificados. Nunca te cobran nada por adelantado.',
    },
  ];
}
