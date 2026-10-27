/**
 * Fotos de la marca. Los originales están en `src/assets/`; en
 * `public/imagenes/` hay dos tamaños en WebP (`<nombre>-640.webp` y
 * `<nombre>-1280.webp`) generados a partir de ellos.
 */
export interface Foto {
  nombre: string;
  /** Texto alternativo para lectores de pantalla. */
  alt: string;
  /** Proporción original (ancho y alto del tamaño de 1280). */
  ancho: number;
  alto: number;
}

export const FOTOS = {
  mujerGraficas: {
    nombre: 'mujer-portatil-graficas',
    alt: 'Mujer revisando gráficas en su portátil en una mesa de trabajo',
    ancho: 1280,
    alto: 853,
  },
  hombrePapeles: {
    nombre: 'hombre-revisa-papeles-cocina',
    alt: 'Hombre pensativo revisando los papeles de un crédito en la mesa de la cocina',
    ancho: 1280,
    alto: 800,
  },
  docente: {
    nombre: 'docente-celular-salon',
    alt: 'Docente revisando su celular en el escritorio de un salón de clase',
    ancho: 1280,
    alto: 956,
  },
  parejaPensionados: {
    nombre: 'pareja-pensionados-tablet',
    alt: 'Pareja de pensionados mirando una tableta en la sala',
    ancho: 1280,
    alto: 956,
  },
  jovenCarro: {
    nombre: 'joven-carro-nuevo',
    alt: 'Joven junto a su carro con las llaves en la mano, frente a su casa',
    ancho: 1280,
    alto: 714,
  },
  familiaVivienda: {
    nombre: 'familia-vivienda-nueva',
    alt: 'Familia entrando feliz a su apartamento nuevo',
    ancho: 1280,
    alto: 714,
  },
  mujerOferta: {
    nombre: 'mujer-revisa-oferta-credito',
    alt: 'Mujer revisando en el celular una oferta de crédito en la cocina',
    ancho: 1280,
    alto: 714,
  },
} satisfies Record<string, Foto>;
