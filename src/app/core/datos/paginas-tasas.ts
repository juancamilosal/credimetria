import { Producto } from '../modelos/tasa';

/**
 * Una página por tipo de crédito (/tasas/<slug>), para que cada una pueda
 * salir en Google con su búsqueda ("tasas crédito de vehículo", "tasa
 * crédito hipotecario VIS"…). Cada página muestra la tabla del ranking de
 * ese producto, un resumen con las cifras del corte y estos textos.
 *
 * Los textos son hechos generales y estables (leyes, cómo funciona el
 * producto); las cifras salen siempre de las tasas del momento. Sin
 * recomendaciones de entidades.
 */
export interface PreguntaFija {
  pregunta: string;
  respuesta: string;
}

export interface PaginaTasas {
  producto: Producto;
  slug: string;
  /** Lo que va en "Tasas de …": "crédito de vehículo". */
  nombre: string;
  /** Pestaña y resultado de Google. */
  titulo: string;
  descripcion: string;
  /** Primer párrafo, debajo del título. */
  intro: string;
  /** "Lo que debes saber": frases cortas. */
  claves: string[];
  preguntas: PreguntaFija[];
  /** Es crédito de consumo: le aplica la tasa de usura. */
  consumo: boolean;
}

const PREPAGO_CONSUMO: PreguntaFija = {
  pregunta: '¿Puedo pagar el crédito antes sin multa?',
  respuesta:
    'Sí. Por la Ley 1555 de 2012, en los créditos de hasta 880 salarios mínimos puedes abonar o pagar todo antes de tiempo sin penalidad.',
};

const PREPAGO_VIVIENDA: PreguntaFija = {
  pregunta: '¿Puedo pagar el crédito de vivienda antes sin multa?',
  respuesta:
    'Sí. La Ley 546 de 1999 permite abonar o pagar por anticipado el crédito de vivienda sin penalidad. Al abonar, puedes pedir que baje la cuota o el plazo.',
};

const VIS: PreguntaFija = {
  pregunta: '¿Qué es una vivienda VIS?',
  respuesta:
    'La vivienda de interés social (VIS) es la que vale hasta 135 salarios mínimos, o hasta 150 en algunas ciudades grandes y sus alrededores. La que vale más es No VIS.',
};

export const PAGINAS_TASAS: PaginaTasas[] = [
  {
    producto: 'libre-inversion',
    slug: 'credito-de-libre-inversion',
    nombre: 'crédito de libre inversión',
    titulo: 'Tasas de crédito de libre inversión por banco · Credimetría',
    descripcion:
      'Tasas de crédito de libre inversión en Colombia, banco por banco: la que anuncia cada entidad y la que de verdad cobra según la Superfinanciera, con la cuota estimada.',
    intro:
      'El crédito de libre inversión es un préstamo de consumo que puedes usar en lo que quieras: estudio, viajes, arreglos o pagar otras deudas. Aquí ves cuánto cobra de verdad cada entidad, según lo que reporta a la Superintendencia Financiera.',
    claves: [
      'No necesitas decir en qué vas a usar la plata.',
      'Los plazos suelen ir de 12 a 72 meses.',
      'Ninguna entidad puede cobrar más que la tasa de usura del mes.',
      'La tasa que te den depende de tus ingresos y de tu historial de pagos.',
    ],
    preguntas: [
      {
        pregunta: '¿Qué piden para un crédito de libre inversión?',
        respuesta:
          'Por lo general, ser mayor de edad, demostrar ingresos (desprendibles de nómina, extractos o declaración de renta) y tener buen historial en las centrales de riesgo. Cada entidad pone sus propios requisitos.',
      },
      PREPAGO_CONSUMO,
    ],
    consumo: true,
  },
  {
    producto: 'libranza',
    slug: 'credito-de-libranza',
    nombre: 'crédito de libranza',
    titulo: 'Tasas de crédito de libranza por banco · Credimetría',
    descripcion:
      'Tasas de crédito de libranza en Colombia para empleados y pensionados: lo que anuncia cada entidad y lo que de verdad cobra según la Superfinanciera.',
    intro:
      'En la libranza, la cuota se descuenta directo de tu nómina o de tu pensión, por un convenio entre la entidad y tu empleador o tu fondo de pensiones. Como el pago es más seguro, suele tener tasas más bajas que la libre inversión.',
    claves: [
      'Sirve si eres empleado de una empresa con convenio o pensionado.',
      'Los plazos pueden llegar a 144 meses (12 años).',
      'Por la Ley 1527 de 2012, después de los descuentos te debe quedar al menos la mitad de tu salario o pensión.',
      'Ninguna entidad puede cobrar más que la tasa de usura del mes.',
    ],
    preguntas: [
      {
        pregunta: '¿Me prestan por libranza si estoy reportado?',
        respuesta:
          'Algunas entidades estudian libranzas de personas reportadas, porque la cuota se descuenta de la nómina o la pensión. Mira cuáles en Créditos para reportados.',
      },
      {
        pregunta: '¿Qué pasa con la libranza si me cambio de trabajo?',
        respuesta:
          'El crédito sigue. Debes avisar a la entidad: si tu nuevo empleador también tiene convenio, el descuento pasa allá; si no, pagas la cuota directamente.',
      },
      PREPAGO_CONSUMO,
    ],
    consumo: true,
  },
  {
    producto: 'vehiculo',
    slug: 'credito-de-vehiculo',
    nombre: 'crédito de vehículo',
    titulo: 'Tasas de crédito de vehículo por banco · Credimetría',
    descripcion:
      'Tasas de crédito de vehículo en Colombia, banco por banco: lo que anuncia cada entidad, lo que de verdad cobra según la Superfinanciera y la cuota de tu carro.',
    intro:
      'El crédito de vehículo financia la compra de un carro o una moto, nuevos o usados. Antes de firmar en el concesionario, compara: la tasa que anuncian no siempre es la que cobran.',
    claves: [
      'El vehículo queda en prenda a favor de la entidad hasta que termines de pagar.',
      'Muchas entidades piden una cuota inicial.',
      'A la cuota súmale el seguro todo riesgo, que casi siempre es obligatorio.',
      'Ninguna entidad puede cobrar más que la tasa de usura del mes.',
    ],
    preguntas: [
      {
        pregunta: '¿Me conviene el crédito que ofrece el concesionario?',
        respuesta:
          'Puede que sí o puede que no: el concesionario trabaja con unas entidades y no con todas. Compara su oferta con las tasas de esta página o usa el simulador para ver si es buena.',
      },
      PREPAGO_CONSUMO,
    ],
    consumo: true,
  },
  {
    producto: 'vivienda-vis',
    slug: 'credito-hipotecario-vis',
    nombre: 'crédito hipotecario VIS',
    titulo: 'Tasas de crédito hipotecario VIS por banco · Credimetría',
    descripcion:
      'Tasas de crédito hipotecario para vivienda de interés social (VIS) en Colombia: lo que anuncia cada entidad y lo que de verdad cobra según la Superfinanciera.',
    intro:
      'El crédito hipotecario VIS financia la compra de una vivienda de interés social. La vivienda queda hipotecada a favor de la entidad hasta que termines de pagar. Aquí ves cuánto cobra de verdad cada entidad, en pesos.',
    claves: [
      'Por la Ley 546 de 1999, en VIS te pueden prestar hasta el 80 % del valor de la vivienda.',
      'El plazo va de 5 a 30 años.',
      'Si compras VIS, revisa si aplicas a algún subsidio de vivienda.',
      'A la cuota súmale los seguros de vida y de incendio y terremoto.',
    ],
    preguntas: [
      VIS,
      {
        pregunta: '¿Qué es mejor, crédito hipotecario o leasing habitacional?',
        respuesta:
          'En el hipotecario la vivienda es tuya desde el principio y queda hipotecada. En el leasing la entidad la compra y tú pagas cuotas con opción de compra al final. Compara la tasa de los dos para tu caso.',
      },
      PREPAGO_VIVIENDA,
    ],
    consumo: false,
  },
  {
    producto: 'vivienda-no-vis',
    slug: 'credito-hipotecario-no-vis',
    nombre: 'crédito hipotecario No VIS',
    titulo: 'Tasas de crédito hipotecario No VIS por banco · Credimetría',
    descripcion:
      'Tasas de crédito hipotecario No VIS en Colombia, banco por banco: lo que anuncia cada entidad y lo que de verdad cobra según la Superfinanciera.',
    intro:
      'El crédito hipotecario No VIS financia viviendas que valen más que el tope de vivienda de interés social. La vivienda queda hipotecada a favor de la entidad hasta que termines de pagar.',
    claves: [
      'Por la Ley 546 de 1999, en No VIS te pueden prestar hasta el 70 % del valor de la vivienda.',
      'El plazo va de 5 a 30 años.',
      'Puedes llevar tu crédito a otra entidad que te dé mejor tasa (compra de cartera).',
      'A la cuota súmale los seguros de vida y de incendio y terremoto.',
    ],
    preguntas: [
      VIS,
      {
        pregunta: '¿Puedo pasar mi crédito de vivienda a otro banco?',
        respuesta:
          'Sí, con una compra de cartera: otra entidad paga tu deuda y te queda debiendo a ella, con su tasa. Compara si el ahorro compensa los gastos del cambio.',
      },
      PREPAGO_VIVIENDA,
    ],
    consumo: false,
  },
  {
    producto: 'leasing-vis',
    slug: 'leasing-habitacional-vis',
    nombre: 'leasing habitacional VIS',
    titulo: 'Tasas de leasing habitacional VIS por banco · Credimetría',
    descripcion:
      'Tasas de leasing habitacional VIS en Colombia: lo que anuncia cada entidad y lo que de verdad cobra según la Superfinanciera.',
    intro:
      'En el leasing habitacional la entidad compra la vivienda y tú la usas pagando una cuota mensual, como un arriendo. Al final ejerces la opción de compra y la vivienda pasa a tu nombre. Esta página es para vivienda de interés social (VIS).',
    claves: [
      'Mientras pagas, la vivienda es de la entidad; al final pasa a tu nombre con la opción de compra.',
      'Te ahorras los gastos de constituir la hipoteca al comprar.',
      'La cuota y el valor de la opción de compra quedan pactados desde el principio.',
      'A la cuota súmale los seguros.',
    ],
    preguntas: [
      VIS,
      {
        pregunta: '¿Qué es la opción de compra?',
        respuesta:
          'Es el último pago, que se pacta desde el principio. Cuando lo haces, la entidad te pasa la vivienda a tu nombre.',
      },
      PREPAGO_VIVIENDA,
    ],
    consumo: false,
  },
  {
    producto: 'leasing-no-vis',
    slug: 'leasing-habitacional-no-vis',
    nombre: 'leasing habitacional No VIS',
    titulo: 'Tasas de leasing habitacional No VIS por banco · Credimetría',
    descripcion:
      'Tasas de leasing habitacional No VIS en Colombia, banco por banco: lo que anuncia cada entidad y lo que de verdad cobra según la Superfinanciera.',
    intro:
      'En el leasing habitacional la entidad compra la vivienda y tú la usas pagando una cuota mensual, como un arriendo. Al final ejerces la opción de compra y la vivienda pasa a tu nombre. Esta página es para vivienda No VIS.',
    claves: [
      'Mientras pagas, la vivienda es de la entidad; al final pasa a tu nombre con la opción de compra.',
      'Te ahorras los gastos de constituir la hipoteca al comprar.',
      'La cuota y el valor de la opción de compra quedan pactados desde el principio.',
      'A la cuota súmale los seguros.',
    ],
    preguntas: [
      {
        pregunta: '¿Qué es la opción de compra?',
        respuesta:
          'Es el último pago, que se pacta desde el principio. Cuando lo haces, la entidad te pasa la vivienda a tu nombre.',
      },
      PREPAGO_VIVIENDA,
    ],
    consumo: false,
  },
];

/** La página de un producto (para enlazarla desde el ranking). */
export function paginaDe(producto: Producto): PaginaTasas | undefined {
  return PAGINAS_TASAS.find((p) => p.producto === producto);
}
