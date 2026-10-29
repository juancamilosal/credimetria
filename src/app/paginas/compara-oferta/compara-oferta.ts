import {
  EntradaMoneda,
  formatoMonto,
} from '../../compartido/entrada-moneda/entrada-moneda';
import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  formatoPesos,
  formatoTasa,
  PesosPipe,
  TasaPipe,
} from '../../compartido/pipes/formato';
import {
  esVivienda,
  plazosDe,
  textoPlazo,
  USURA_CONSUMO,
} from '../../core/datos/tasas';
import { URGENCIAS } from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';
import {
  efectivaAnualDeMensual,
  leerNumero,
} from '../../core/utilidades/credito';
import {
  calcularOferta,
  DatosOferta,
  leerTasa,
  ResultadoOferta,
  TipoOferta,
} from './oferta';

const MONTO_MINIMO = 1_000_000;

/** Un pedazo de texto de un mensaje del bot; `cifra` lo pone en negrilla. */
interface Parte {
  texto: string;
  cifra?: boolean;
}

type Mensaje =
  | { id: number; tipo: 'bot'; partes: Parte[] }
  | { id: number; tipo: 'yo'; texto: string }
  | { id: number; tipo: 'cartel'; texto: string }
  | {
      id: number;
      tipo: 'resultado';
      datos: DatosOferta;
      resultado: ResultadoOferta;
      usura: number | null;
    };

/** Un mensaje antes de recibir su id. */
type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;

interface Opcion {
  texto: string;
  valor: string;
  principal?: boolean;
}

/** Lo que se muestra abajo del chat para responder. */
type Zona =
  | { tipo: 'nada' }
  | { tipo: 'empezar' }
  | {
      tipo: 'opciones';
      pregunta: string;
      opciones: Opcion[];
      alElegir: (opcion: Opcion) => void;
    }
  | {
      tipo: 'entrada';
      pregunta: string;
      placeholder: string;
      /** Monto en pesos: se escribe con puntos de miles. */
      moneda: boolean;
      /** Mensaje de error, o '' si el valor sirve. */
      validar: (texto: string) => string;
      /** Texto de la burbuja de la persona. */
      mostrar: (texto: string) => string;
      alEnviar: (texto: string) => void;
    };

/**
 * Chat guiado, sin IA: preguntas fijas con botones. La persona escribe lo que
 * le ofreció un asesor y ve la tasa que de verdad pagaría, los costos dentro
 * de la cuota y cuánto ahorraría con la entidad que menos cobra. Nada se
 * guarda ni se envía: todo se calcula en el navegador.
 */
@Component({
  selector: 'app-compara-oferta',
  imports: [EntradaMoneda, PesosPipe, TasaPipe],
  templateUrl: './compara-oferta.html',
  styleUrl: './compara-oferta.css',
})
export class ComparaOferta {
  private readonly tasas = inject(TasasService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly respuesta = viewChild<ElementRef<HTMLElement>>('respuesta');

  protected readonly corte = this.tasas.corte;
  protected readonly textoPlazo = textoPlazo;
  protected readonly mesUsura = USURA_CONSUMO.mes;
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly zona = signal<Zona>({ tipo: 'nada' });
  protected readonly valorEntrada = signal('');
  protected readonly error = signal('');

  private datos: Partial<DatosOferta> = {};
  private siguienteId = 0;

  constructor() {
    this.cargarEjemplo();
  }

  /** Empieza una conversación nueva con los datos de la persona. */
  iniciar(): void {
    this.datos = {};
    this.mensajes.set([]);
    this.bot(
      'Hola. Cuéntame qué te ofrecieron y te digo cuánto te cobran de verdad.',
    );
    this.preguntarProducto();
  }

  protected elegir(opcion: Opcion): void {
    const zona = this.zona();
    if (zona.tipo !== 'opciones') return;
    this.yo(opcion.texto);
    zona.alElegir(opcion);
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    const zona = this.zona();
    if (zona.tipo !== 'entrada') return;
    const texto = this.valorEntrada().trim();
    const error = zona.validar(texto);
    this.error.set(error);
    if (error) return;
    this.yo(zona.mostrar(texto));
    zona.alEnviar(texto);
  }

  protected nombreProducto(producto: Producto): string {
    return this.tasas.nombre(producto);
  }

  // Preguntas

  private preguntarProducto(): void {
    this.bot('¿Qué crédito te ofrecieron?');
    this.opciones(
      'Elige una opción',
      this.tasas.productos.map((p) => ({ texto: p.nombre, valor: p.id })),
      (o) => {
        this.datos.producto = o.valor as Producto;
        this.preguntarMonto();
      },
    );
  }

  private preguntarMonto(): void {
    this.bot('¿Cuánto dinero te prestan?');
    this.entrada({
      pregunta: 'Monto en pesos',
      placeholder: 'Ej. 20.000.000',
      moneda: true,
      validar: (t) =>
        leerNumero(t) < MONTO_MINIMO
          ? 'Escribe un monto de al menos $1.000.000.'
          : '',
      mostrar: (t) => '$' + formatoMonto(t),
      alEnviar: (t) => {
        this.datos.monto = leerNumero(t);
        this.preguntarPlazo();
      },
    });
  }

  private preguntarPlazo(): void {
    const producto = this.datos.producto;
    this.bot('¿A cuántos meses?');
    this.opciones(
      'Plazo',
      plazosDe(producto).map((n) => ({
        texto: textoPlazo(n),
        valor: String(n),
      })),
      (o) => {
        this.datos.plazo = Number(o.valor);
        this.preguntarQueDijeron();
      },
    );
  }

  private preguntarQueDijeron(): void {
    this.bot('¿Qué te dijo el asesor?');
    this.opciones(
      'Elige lo que te dieron',
      [
        { texto: 'Una tasa efectiva anual (E.A.)', valor: 'ea' },
        { texto: 'Una tasa mensual (M.V.)', valor: 'mv' },
        { texto: 'Solo la cuota', valor: 'cuota' },
      ],
      (o) => {
        this.datos.tipo = o.valor as TipoOferta;
        this.datos.tasaDicha = null;
        this.datos.tasaMensualDicha = null;
        if (o.valor === 'cuota') this.preguntarCuota(true);
        else this.preguntarTasa();
      },
    );
  }

  private preguntarTasa(): void {
    const anual = this.datos.tipo === 'ea';
    this.bot(
      anual
        ? '¿Qué tasa efectiva anual te dijeron?'
        : '¿Qué tasa mensual te dijeron?',
    );
    this.entrada({
      pregunta: anual ? 'Tasa en % E.A.' : 'Tasa en % mensual',
      placeholder: anual ? 'Ej. 26,38' : 'Ej. 2,1',
      moneda: false,
      validar: (t) => {
        const tasa = leerTasa(t);
        if (!tasa)
          return `Escribe la tasa, por ejemplo ${anual ? '26,38' : '2,1'}.`;
        if (!anual && tasa > 6)
          return 'Una tasa mensual suele estar entre 0,5 % y 3 %. ¿Seguro que no es anual?';
        if (anual && tasa > 100) return 'Esa tasa parece muy alta. Revísala.';
        return '';
      },
      mostrar: (t) =>
        `${formatoTasa(leerTasa(t))} ${anual ? 'E.A.' : 'mensual'}`,
      alEnviar: (t) => {
        const tasa = leerTasa(t);
        if (anual) {
          this.datos.tasaDicha = tasa;
        } else {
          this.datos.tasaMensualDicha = tasa;
          this.datos.tasaDicha = efectivaAnualDeMensual(tasa);
          this.bot(
            `Una tasa de ${formatoTasa(tasa)} mensual equivale a `,
            {
              texto: `${formatoTasa(this.datos.tasaDicha)} efectivo anual`,
              cifra: true,
            },
            '.',
          );
        }
        this.preguntarSiCuota();
      },
    });
  }

  private preguntarSiCuota(): void {
    this.bot('¿Te dijeron la cuota mensual, con seguros incluidos?');
    this.opciones(
      'Cuota',
      [
        { texto: 'Sí', valor: 'si' },
        { texto: 'No me la dijeron', valor: 'no' },
      ],
      (o) => {
        if (o.valor === 'si') this.preguntarCuota(false);
        else {
          this.datos.cuota = null;
          this.mostrarResultado();
        }
      },
    );
  }

  private preguntarCuota(sola: boolean): void {
    this.bot(
      sola
        ? '¿Cuánto es la cuota mensual que te dijeron?'
        : 'Escribe la cuota mensual, con seguros incluidos.',
    );
    this.entrada({
      pregunta: 'Cuota mensual en pesos',
      placeholder: 'Ej. 700.000',
      moneda: true,
      validar: (t) => {
        const cuota = leerNumero(t);
        if (!cuota) return 'Escribe la cuota en pesos.';
        if (cuota <= this.datos.monto! / this.datos.plazo!)
          return 'Con esa cuota no alcanzas a pagar el monto en ese plazo. Revisa los datos.';
        return '';
      },
      mostrar: (t) => '$' + formatoMonto(t),
      alEnviar: (t) => {
        this.datos.cuota = leerNumero(t);
        this.mostrarResultado();
      },
    });
  }

  // Resultado y cierre

  private mostrarResultado(ejemplo = false): void {
    const datos = this.datos as DatosOferta;
    // La usura de consumo no aplica a vivienda, que tiene su propio límite.
    const usura = esVivienda(datos.producto) ? null : USURA_CONSUMO.tasa;
    const resultado = calcularOferta(
      datos,
      this.tasas.mejor(datos.producto),
      usura,
    );
    this.bot('Listo. Esto es lo que encontré:');
    this.agregar({ tipo: 'resultado', datos: { ...datos }, resultado, usura });
    if (ejemplo) return;

    this.bot(
      resultado.veredicto === 'bien'
        ? 'Tu oferta se ve bien. Igual, ¿quieres que un asesor aliado la revise contigo? Es gratis.'
        : '¿Quieres que un asesor aliado intente conseguirte una mejor tasa? Es gratis.',
    );
    this.opciones(
      'Asesoría gratis',
      [
        { texto: 'Sí, quiero mejorarla', valor: 'si', principal: true },
        { texto: 'No, gracias', valor: 'no' },
      ],
      (o) => {
        if (o.valor === 'si') {
          this.preguntarCuando();
          return;
        }
        this.bot(
          'Listo. Guarda estos números para negociar con tu banco. Puedes empezar de nuevo cuando quieras.',
        );
        this.zona.set({ tipo: 'nada' });
      },
    );
  }

  private preguntarCuando(): void {
    this.bot('¿Cuándo necesitas el crédito?');
    this.opciones(
      'Urgencia',
      URGENCIAS.map((u) => ({ texto: u.texto, valor: u.id })),
      (o) => {
        this.bot('Te llevo al formulario de asesoría con tus datos.');
        this.zona.set({ tipo: 'nada' });
        this.router.navigate(['/asesoria'], {
          queryParams: {
            producto: this.datos.producto,
            monto: this.datos.monto,
            urgencia: o.valor,
            origen: 'oferta',
          },
        });
      },
    );
  }

  /** Conversación ya resuelta que se ve al abrir la página. */
  private cargarEjemplo(): void {
    this.mensajes.set([]);
    this.agregar({
      tipo: 'cartel',
      texto:
        'Ejemplo de una conversación. Toca "Comparar mi oferta" para hacerlo con tus datos.',
    });
    this.bot(
      'Hola. Cuéntame qué te ofrecieron y te digo cuánto te cobran de verdad.',
    );
    this.bot('¿Qué crédito te ofrecieron?');
    this.yo(this.tasas.nombre('libre-inversion'));
    this.bot('¿Cuánto dinero te prestan?');
    this.yo(formatoPesos(20_000_000));
    this.bot('¿A cuántos meses?');
    this.yo('48 meses');
    this.bot('¿Qué te dijo el asesor?');
    this.yo('Una tasa efectiva anual (E.A.)');
    this.bot('¿Qué tasa efectiva anual te dijeron?');
    this.yo(`${formatoTasa(26.38)} E.A.`);
    this.bot('¿Te dijeron la cuota mensual, con seguros incluidos?');
    this.yo('Sí');
    this.bot('Escribe la cuota mensual, con seguros incluidos.');
    this.yo(formatoPesos(700_000));
    this.datos = {
      producto: 'libre-inversion',
      monto: 20_000_000,
      plazo: 48,
      tipo: 'ea',
      tasaDicha: 26.38,
      tasaMensualDicha: null,
      cuota: 700_000,
    };
    this.mostrarResultado(true);
    this.zona.set({ tipo: 'empezar' });
  }

  // Piezas del chat

  private agregar(mensaje: SinId<Mensaje>): void {
    const conId = { ...mensaje, id: this.siguienteId++ } as Mensaje;
    this.mensajes.update((lista) => [...lista, conId]);
  }

  private bot(...partes: (string | Parte)[]): void {
    this.agregar({
      tipo: 'bot',
      partes: partes.map((p) => (typeof p === 'string' ? { texto: p } : p)),
    });
  }

  private yo(texto: string): void {
    this.agregar({ tipo: 'yo', texto });
  }

  private opciones(
    pregunta: string,
    opciones: Opcion[],
    alElegir: (opcion: Opcion) => void,
  ): void {
    this.error.set('');
    this.zona.set({ tipo: 'opciones', pregunta, opciones, alElegir });
    this.enfocarRespuesta();
  }

  private entrada(
    zona: Omit<Extract<Zona, { tipo: 'entrada' }>, 'tipo'>,
  ): void {
    this.error.set('');
    this.valorEntrada.set('');
    this.zona.set({ tipo: 'entrada', ...zona });
    this.enfocarRespuesta();
  }

  /** Pone el foco en la respuesta nueva y la deja a la vista. */
  private enfocarRespuesta(): void {
    if (!this.enNavegador) return;
    afterNextRender(
      () => {
        const zona = this.respuesta()?.nativeElement;
        const foco = zona?.querySelector<HTMLElement>('input, button');
        foco?.focus({ preventScroll: true });
        const caja = zona?.getBoundingClientRect();
        if (caja && caja.bottom > window.innerHeight) {
          zona!.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      },
      { injector: this.injector },
    );
  }
}
