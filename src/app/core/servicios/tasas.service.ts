import { HttpClient } from '@angular/common/http';
import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DIRECTUS_URL } from '../config/directus';
import { PRODUCTOS } from '../datos/tasas';
import {
  CorteTasas,
  InfoProducto,
  Producto,
  TasaEntidad,
  TipoEntidad,
} from '../modelos/tasa';

/** Tasas fijas en lugar de las de Directus (para las pruebas). */
export const TASAS_INICIALES = new InjectionToken<{
  tasas: TasaEntidad[];
  corte: CorteTasas;
}>('TASAS_INICIALES');

interface PublicadaDirectus {
  producto: Producto;
  ea_desde: string | null;
  ea_hasta: string | null;
  hasta_origen: 'entidad' | 'usura' | null;
  vigente_desde: string | null;
  entidad: {
    codigo: string;
    nombre: string;
    tipo: TipoEntidad;
    logo: string | null;
  };
  fuente: { url: string } | null;
}

interface PromedioDirectus {
  entidad: string;
  producto: Producto;
  tasa_ea: string | null;
  corte: string | null;
}

const numero = (valor: string | null) =>
  valor === null ? null : Number(valor);

/**
 * Punto único de acceso a las tasas. Al arrancar la página lee de Directus
 * las tasas publicadas (rango del PDF de cada entidad, ya aprobado) y lo que
 * cobra cada una en promedio según la Superfinanciera. La cuota y el orden
 * se calculan con el promedio.
 */
@Injectable({ providedIn: 'root' })
export class TasasService {
  // Opcional: en las pruebas las tasas llegan por TASAS_INICIALES.
  private readonly http = inject(HttpClient, { optional: true });
  private readonly base = inject(DIRECTUS_URL);
  private readonly iniciales = inject(TASAS_INICIALES, { optional: true });

  private readonly todas = signal<TasaEntidad[]>(this.iniciales?.tasas ?? []);
  readonly corte = signal<CorteTasas>(
    this.iniciales?.corte ?? {
      fuente: 'Superintendencia Financiera de Colombia',
      fecha: null,
      ejemplo: false,
    },
  );
  /** No se pudieron leer las tasas. */
  readonly sinConexion = signal(false);

  readonly productos: InfoProducto[] = PRODUCTOS;
  readonly tipos: TipoEntidad[] = ['Banco', 'Cooperativa', 'Financiera'];

  /** Nombres de todas las entidades que comparamos, en orden alfabético. */
  readonly listaEntidades = computed(() =>
    [...new Set(this.todas().map((t) => t.entidad))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    ),
  );

  /** Lee las tasas de Directus; si falla, la página queda sin tasas. */
  async cargar(): Promise<void> {
    if (this.iniciales) return;
    try {
      const [publicadas, promedios] = await Promise.all([
        this.leer<PublicadaDirectus>(
          '/items/tasas_publicadas?filter[estado][_eq]=publicada&limit=-1' +
            '&fields=producto,ea_desde,ea_hasta,hasta_origen,vigente_desde,' +
            'entidad.codigo,entidad.nombre,entidad.tipo,entidad.logo,fuente.url',
        ),
        this.leer<PromedioDirectus>(
          '/items/tasas_promedio?limit=-1&fields=entidad,producto,tasa_ea,corte',
        ),
      ]);
      const tasas: TasaEntidad[] = [];
      for (const p of publicadas) {
        const promedio = promedios.find(
          (x) => x.entidad === p.entidad.codigo && x.producto === p.producto,
        );
        const desde = numero(p.ea_desde);
        const real = numero(promedio?.tasa_ea ?? null) ?? desde;
        if (real === null) continue;
        tasas.push({
          entidad: p.entidad.nombre,
          tipo: p.entidad.tipo,
          producto: p.producto,
          tasaReal: real,
          tasaAnunciada: desde,
          tasaHasta: numero(p.ea_hasta),
          hastaUsura: p.hasta_origen === 'usura',
          vigencia: p.vigente_desde,
          pdf: p.fuente?.url ?? null,
          logo: p.entidad.logo
            ? `${this.base}/assets/${p.entidad.logo}?height=56&fit=inside&format=webp`
            : null,
        });
      }
      const cortes = promedios
        .map((x) => x.corte)
        .filter((c): c is string => !!c)
        .sort();
      this.todas.set(tasas);
      this.corte.update((c) => ({ ...c, fecha: cortes.at(-1) ?? null }));
      this.sinConexion.set(false);
    } catch {
      this.sinConexion.set(true);
    }
  }

  /**
   * Entidades de un producto ordenadas por la tasa que cobran, de menor a
   * mayor. El orden nunca depende de quién paga publicidad.
   */
  ranking(producto: Producto, tipo: TipoEntidad | null = null): TasaEntidad[] {
    return this.todas()
      .filter(
        (t) => t.producto === producto && (tipo === null || t.tipo === tipo),
      )
      .sort((a, b) => a.tasaReal - b.tasaReal);
  }

  /** La entidad que menos cobra para un producto. */
  mejor(producto: Producto): TasaEntidad | undefined {
    return this.ranking(producto)[0];
  }

  /** Nombres de todas las entidades que comparamos, en orden alfabético. */
  entidades(): string[] {
    return this.listaEntidades();
  }

  nombre(producto: Producto): string {
    return this.productos.find((p) => p.id === producto)?.nombre ?? producto;
  }

  esProducto(valor: unknown): valor is Producto {
    return this.productos.some((p) => p.id === valor);
  }

  private async leer<T>(ruta: string): Promise<T[]> {
    if (!this.http) throw new Error('Sin HttpClient');
    const r = await firstValueFrom(
      this.http.get<{ data: T[] }>(`${this.base}${ruta}`),
    );
    return r.data;
  }
}
