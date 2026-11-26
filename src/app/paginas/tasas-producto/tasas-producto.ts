import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  PAGINAS_TASAS,
  PaginaTasas,
  PreguntaFija,
} from '../../core/datos/paginas-tasas';
import { esVivienda, FUENTE_PROMEDIO } from '../../core/datos/tasas';
import { TasasService } from '../../core/servicios/tasas.service';
import { cuotaMensual } from '../../core/utilidades/credito';
import {
  formatoTasa,
  PesosPipe,
  TasaPipe,
} from '../../compartido/pipes/formato';
import {
  MONTO_RANKING,
  MONTO_VIVIENDA,
  PLAZO_RANKING,
  PLAZO_VIVIENDA,
  TablaRanking,
} from '../../compartido/tabla-ranking/tabla-ranking';

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "2026-11-06" → "6 nov 2026". */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return a && m && d ? `${d} ${MESES[m - 1]} ${a}` : iso;
}

/** Id del JSON-LD de preguntas frecuentes en el <head>. */
const ID_FAQ = 'ld-preguntas';

/**
 * Página de un tipo de crédito (/tasas/<slug>): las tasas de ese producto
 * con un resumen del corte, lo que hay que saber y preguntas frecuentes
 * (también como JSON-LD para Google). El producto llega en `data.producto`
 * de la ruta (ver `PAGINAS_TASAS`).
 */
@Component({
  selector: 'app-tasas-producto',
  imports: [RouterLink, TablaRanking, PesosPipe, TasaPipe],
  templateUrl: './tasas-producto.html',
  styleUrl: './tasas-producto.css',
})
export class TasasProducto {
  private readonly tasas = inject(TasasService);
  private readonly documento = inject(DOCUMENT);
  protected readonly fuente = FUENTE_PROMEDIO;

  protected readonly pagina = toSignal(
    inject(ActivatedRoute).data.pipe(
      map(
        (d) =>
          PAGINAS_TASAS.find((p) => p.producto === d['producto']) ??
          PAGINAS_TASAS[0],
      ),
    ),
    { requireSync: true },
  );
  protected readonly producto = computed(() => this.pagina().producto);
  protected readonly otras = computed(() =>
    PAGINAS_TASAS.filter((p) => p !== this.pagina()),
  );

  protected readonly cargando = this.tasas.cargando;
  protected readonly sinConexion = this.tasas.sinConexion;
  protected readonly corte = computed(() =>
    fechaCorta(this.tasas.corte().fecha),
  );
  protected readonly usura = this.tasas.usura;

  protected readonly monto = computed(() =>
    esVivienda(this.producto()) ? MONTO_VIVIENDA : MONTO_RANKING,
  );
  protected readonly plazo = computed(() =>
    esVivienda(this.producto()) ? PLAZO_VIVIENDA : PLAZO_RANKING,
  );

  protected readonly filas = computed(() =>
    this.tasas.ranking(this.producto()),
  );
  /** Las que reportan a la Superfinanciera (las otras no entran al resumen). */
  private readonly conReporte = computed(() =>
    this.filas().filter((t) => !t.sinReporte),
  );

  protected readonly resumen = computed(() => {
    const lista = this.conReporte();
    if (!lista.length) return null;
    const mejor = lista[0];
    const peor = lista[lista.length - 1];
    const promedio =
      lista.reduce((suma, t) => suma + t.tasaReal, 0) / lista.length;
    const cuota = (tasa: number) =>
      Math.round(cuotaMensual(this.monto(), tasa, this.plazo()));
    return {
      mejor,
      peor,
      promedio,
      cantidad: lista.length,
      diferenciaMes: cuota(peor.tasaReal) - cuota(mejor.tasaReal),
    };
  });

  /** Preguntas con cifras del corte, más las fijas del producto. */
  protected readonly preguntas = computed<PreguntaFija[]>(() => [
    ...this.preguntasConCifras(this.pagina()),
    ...this.pagina().preguntas,
  ]);

  constructor() {
    // Las preguntas frecuentes también van para Google (resultados con
    // preguntas). Se arma en el servidor y se actualiza al cambiar de página.
    effect(() => this.ponerFaq(this.preguntas()));
    inject(DestroyRef).onDestroy(() =>
      this.documento.getElementById(ID_FAQ)?.remove(),
    );
  }

  private preguntasConCifras(p: PaginaTasas): PreguntaFija[] {
    const r = this.resumen();
    if (!r) return [];
    const corte = this.corte();
    const lista: PreguntaFija[] = [
      {
        pregunta: `¿Qué entidad cobra menos por el ${p.nombre}?`,
        respuesta: `Con el corte del ${corte}, ${r.mejor.entidad} cobró en promedio ${formatoTasa(r.mejor.tasaReal)} E.A., la tasa más baja de las ${r.cantidad} entidades que lo reportan a la Superintendencia Financiera. Tu tasa depende de tu perfil.`,
      },
      {
        pregunta: `¿Cuál es la tasa promedio del ${p.nombre} en Colombia?`,
        respuesta: `Entre las ${r.cantidad} entidades que lo reportan, el promedio es ${formatoTasa(r.promedio)} E.A. (corte del ${corte}). Va de ${formatoTasa(r.mejor.tasaReal)} a ${formatoTasa(r.peor.tasaReal)}.`,
      },
    ];
    if (p.consumo) {
      const u = this.usura();
      lista.push({
        pregunta: '¿Cuál es la tasa máxima que me pueden cobrar?',
        respuesta: `La tasa de usura de ${u.mes} es ${formatoTasa(u.tasa)} E.A. (${formatoTasa(u.mv)} mensual). Ninguna entidad puede cobrar más; si lo hace, es un delito.`,
      });
    }
    return lista;
  }

  private ponerFaq(preguntas: PreguntaFija[]): void {
    const head = this.documento.head;
    if (!head) return;
    let script = this.documento.getElementById(ID_FAQ);
    if (!script) {
      script = this.documento.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.id = ID_FAQ;
      head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: preguntas.map((q) => ({
        '@type': 'Question',
        name: q.pregunta,
        acceptedAnswer: { '@type': 'Answer', text: q.respuesta },
      })),
    });
  }
}
