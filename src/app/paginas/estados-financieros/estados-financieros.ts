import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  computed,
  inject,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DatosFinancieros,
  EntidadFinanciera,
} from '../../core/modelos/financiero';
import {
  analisisAutomatico,
  cambio,
  mesesCortos,
  periodoDelAnio,
  pesosCortos,
  pesosGrandes,
  porcentaje,
} from '../../core/utilidades/financieros';

/** Datos fijos en lugar de /api/financieros (para las pruebas). */
export const FINANCIEROS_INICIALES = new InjectionToken<DatosFinancieros>(
  'FINANCIEROS_INICIALES',
);

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
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly iniciales = inject(FINANCIEROS_INICIALES, {
    optional: true,
  });

  protected readonly datos = signal<DatosFinancieros | null>(
    this.iniciales ?? null,
  );
  protected readonly cargando = signal(!this.iniciales);
  protected readonly sinConexion = signal(false);
  private readonly elegido = signal<string | null>(null);

  protected readonly pesos = pesosGrandes;
  protected readonly porcentaje = porcentaje;
  protected readonly cambio = cambio;
  protected readonly pesosCortos = pesosCortos;

  protected readonly entidades = computed(() => this.datos()?.entidades ?? []);
  protected readonly entidad = computed<EntidadFinanciera | null>(() => {
    const lista = this.entidades();
    return lista.find((e) => e.codigo === this.elegido()) ?? lista[0] ?? null;
  });
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
    if (!this.iniciales && isPlatformBrowser(inject(PLATFORM_ID))) {
      this.http.get<DatosFinancieros>('/api/financieros').subscribe({
        next: (d) => {
          this.datos.set(d);
          this.cargando.set(false);
        },
        error: () => {
          this.sinConexion.set(true);
          this.cargando.set(false);
        },
      });
    }
  }

  protected elegir(codigo: string): void {
    this.router.navigate([], {
      queryParams: { entidad: codigo },
      replaceUrl: true,
    });
  }

  protected iniciales_(nombre: string): string {
    return nombre
      .split(/\s+/)
      .filter((p) => /^[A-ZÁÉÍÓÚÑ]/i.test(p))
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
}
