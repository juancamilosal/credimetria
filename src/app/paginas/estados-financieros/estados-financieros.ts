import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EntidadFinanciera } from '../../core/modelos/financiero';
import { FinancierosService } from '../../core/servicios/financieros.service';
import {
  analisisAutomatico,
  cambio,
  mesesCortos,
  periodoDelAnio,
  pesosCortos,
  pesosGrandes,
  porcentaje,
} from '../../core/utilidades/financieros';
import {
  armarGrafica,
  Metrica,
  METRICAS,
  TAMANOS,
} from '../../core/utilidades/grafica-lineas';

export interface Barra {
  etiqueta: string;
  texto: string;
  /** Alto de la barra dentro de su zona (0–100). */
  alto: number;
  negativa: boolean;
  /** Es el año en curso (va hasta el último corte). */
  enCurso: boolean;
}

/**
 * Estados financieros: cuánto gana cada entidad según el CUIF de la
 * Superfinanciera (las cifras salen solas) y, si ya está publicado en
 * Directus, el análisis escrito y el PDF del estado financiero.
 * En desarrollo: fuera del menú y del sitemap, y sin indexar.
 */
@Component({
  selector: 'app-estados-financieros',
  templateUrl: './estados-financieros.html',
  styleUrl: './estados-financieros.css',
})
export class EstadosFinancieros {
  private readonly router = inject(Router);
  private readonly servicio = inject(FinancierosService);

  protected readonly datos = this.servicio.datos;
  protected readonly cargando = this.servicio.cargando;
  protected readonly sinConexion = this.servicio.sinConexion;
  private readonly elegido = signal<string | null>(null);

  protected readonly pesos = pesosGrandes;
  protected readonly porcentaje = porcentaje;
  protected readonly cambio = cambio;
  protected readonly pesosCortos = pesosCortos;

  protected readonly metricas = METRICAS;

  protected readonly entidades = computed(() => this.datos()?.entidades ?? []);
  /** La elegida en la dirección (`?entidad=`); sin ella se ve la lista. */
  protected readonly entidad = computed<EntidadFinanciera | null>(
    () => this.entidades().find((e) => e.codigo === this.elegido()) ?? null,
  );

  /** Comparación: qué se compara y con cuáles (todos los que se marquen). */
  protected readonly metrica = signal<Metrica>('utilidad');
  /** Pantalla angosta (celular): la gráfica se dibuja con otras medidas. */
  private readonly angosta = signal(false);
  private readonly comparadosElegidos = signal<string[] | null>(null);
  protected readonly comparados = computed<EntidadFinanciera[]>(() => {
    const e = this.entidad();
    if (!e) return [];
    const otras = this.entidades().filter((x) => x.codigo !== e.codigo);
    const codigos =
      this.comparadosElegidos() ??
      // Por defecto, las 2 que más ganan (la lista ya viene ordenada).
      otras.slice(0, 2).map((x) => x.codigo);
    return codigos
      .map((c) => otras.find((x) => x.codigo === c))
      .filter((x): x is EntidadFinanciera => !!x);
  });
  /** Las casillas: todas las demás entidades, marcadas las que se comparan. */
  protected readonly casillas = computed(() => {
    const e = this.entidad();
    const marcadas = new Set(this.comparados().map((x) => x.codigo));
    return this.entidades()
      .filter((x) => x.codigo !== e?.codigo)
      .map((x) => ({
        codigo: x.codigo,
        nombre: x.nombre,
        marcada: marcadas.has(x.codigo),
        color: marcadas.has(x.codigo) ? this.color(x.codigo) : null,
      }));
  });
  /**
   * Un color para cada línea: la elegida en el azul de la marca y las demás
   * repartidas en el círculo de color (sirve para cualquier cantidad).
   */
  protected color(codigo: string): string {
    if (codigo === this.entidad()?.codigo) return 'var(--serie-0)';
    const i = this.comparados().findIndex((x) => x.codigo === codigo);
    return `hsl(${(28 + i * 137.5) % 360} 62% 48%)`;
  }
  protected readonly lineas = computed(() => {
    const e = this.entidad();
    return e
      ? armarGrafica(
          [e, ...this.comparados()],
          this.metrica(),
          this.angosta() ? TAMANOS.angosta : TAMANOS.ancha,
        )
      : null;
  });
  protected readonly nombresLineas = computed(
    () =>
      this.lineas()
        ?.lineas.map((l) => l.nombre)
        .join(', ') ?? '',
  );
  protected readonly auto = computed(() => {
    const e = this.entidad();
    return e ? analisisAutomatico(e) : null;
  });
  protected readonly periodo = computed(() => {
    const e = this.entidad();
    return e ? periodoDelAnio(e.actual.corte) : '';
  });
  protected readonly subtitulo = computed(() => {
    const base =
      'Utilidades de cada entidad según lo que reporta a la Superintendencia Financiera';
    const corte = this.datos()?.corte;
    if (!corte) return `${base}.`;
    const mes = periodoDelAnio(corte).replace(/^enero( a)? /, '');
    return `${base}, con corte a ${mes}.`;
  });

  /** Utilidad de cada año y la del año en curso, con su zona +/−. */
  protected readonly grafica = computed(() => {
    const e = this.entidad();
    if (!e) return null;
    const valores = [
      ...e.anual.map((a) => ({
        etiqueta: String(a.anio),
        valor: a.utilidad,
        enCurso: false,
      })),
      {
        etiqueta: `${e.actual.corte.slice(0, 4)} (${mesesCortos(e.actual.corte)})`,
        valor: e.actual.utilidad,
        enCurso: true,
      },
    ];
    const maxPos = Math.max(0, ...valores.map((v) => v.valor));
    const maxNeg = Math.max(0, ...valores.map((v) => -v.valor));
    const total = maxPos + maxNeg || 1;
    const barras: Barra[] = valores.map((v) => ({
      etiqueta: v.etiqueta,
      texto: pesosCortos(v.valor),
      negativa: v.valor < 0,
      enCurso: v.enCurso,
      alto:
        v.valor < 0
          ? (-v.valor / (maxNeg || 1)) * 100
          : (v.valor / (maxPos || 1)) * 100,
    }));
    return {
      barras,
      arriba: (maxPos / total) * 100,
      abajo: (maxNeg / total) * 100,
    };
  });

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((p) => this.elegido.set(p.get('entidad')));
    // Las cifras se piden desde el navegador: la página no se indexa
    // mientras está en desarrollo y así el servidor no espera al CUIF.
    this.servicio.cargar();
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const medir = () => this.angosta.set(window.innerWidth < 640);
      medir();
      window.addEventListener('resize', medir);
      inject(DestroyRef).onDestroy(() =>
        window.removeEventListener('resize', medir),
      );
    }
  }

  /**
   * Abre la ficha de una entidad: la lista se oculta. Se guarda en el
   * historial, así el botón "atrás" del navegador también vuelve a la lista.
   */
  protected elegir(codigo: string): void {
    this.comparadosElegidos.set(null);
    this.router.navigate([], { queryParams: { entidad: codigo } });
    this.arriba();
  }

  protected volver(): void {
    this.router.navigate([], { queryParams: {} });
    this.arriba();
  }

  /** Marca o desmarca un banco en la comparación. */
  protected alternar(codigo: string): void {
    const actuales = this.comparados().map((x) => x.codigo);
    this.comparadosElegidos.set(
      actuales.includes(codigo)
        ? actuales.filter((c) => c !== codigo)
        : [...actuales, codigo],
    );
  }

  /** Marca todos o ninguno. */
  protected todos(marcar: boolean): void {
    this.comparadosElegidos.set(
      marcar ? this.casillas().map((c) => c.codigo) : [],
    );
  }

  private arriba(): void {
    if (typeof window !== 'undefined')
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Iniciales cuando no hay logo: sin "Banco" ni "de", "la"…
   * ("Banco Caja Social" → CS); con una sola palabra, sus 2 primeras letras
   * ("BBVA" → BB, "Itaú" → IT).
   */
  protected iniciales_(nombre: string): string {
    let palabras = nombre.split(/\s+/).filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p));
    if (palabras.length > 1)
      palabras = palabras.filter((p) => p.toLowerCase() !== 'banco');
    if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
    return palabras
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
}
