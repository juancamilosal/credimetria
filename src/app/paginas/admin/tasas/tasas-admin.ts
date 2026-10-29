import { DatePipe, formatDate, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  inject,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, Meta, SafeResourceUrl } from '@angular/platform-browser';
import { formatoTasa, TasaPipe } from '../../../compartido/pipes/formato';
import {
  DocumentoPdf,
  EntidadAdmin,
  FuenteAdmin,
} from '../../../core/modelos/documento';
import { Producto } from '../../../core/modelos/tasa';
import {
  CambiosTasa,
  SistemaTasa,
  TasaAdmin,
  TipoTasa,
  UNIDADES_TASA,
  UnidadTasa,
} from '../../../core/modelos/tasa-admin';
import {
  Direcciones,
  DocumentoRepetido,
  DocumentosAdminService,
} from '../../../core/servicios/documentos-admin.service';
import {
  mensajeError,
  SesionAdmin,
} from '../../../core/servicios/sesion-admin.service';
import { TasasAdminService } from '../../../core/servicios/tasas-admin.service';
import { TasasService } from '../../../core/servicios/tasas.service';
import { esVivienda, USURA_CONSUMO } from '../../../core/datos/tasas';
import {
  efectivaAnualDeMensual,
  tasaMensual,
} from '../../../core/utilidades/credito';
import { pendienteDelMes } from '../../../core/utilidades/mes';
import { CabeceraAdmin } from '../cabecera/cabecera-admin';
import { EsqueletoImagen } from '../../../compartido/esqueleto-imagen/esqueleto-imagen';

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

/** El PDF que se muestra: la copia resaltada si la hay, si no el original. */
export function verPdf(d: {
  archivo: { id: string };
  archivo_resaltado?: { id: string } | null;
}): string {
  return d.archivo_resaltado?.id ?? d.archivo.id;
}

/** Un banco y un producto: lo publicado, lo que espera aprobación y su historia. */
interface TarjetaTasa {
  clave: string;
  entidad: EntidadAdmin;
  producto: Producto;
  pdf: FuenteAdmin | null;
  pagina: FuenteAdmin | null;
  /** Donde se cargan los archivos: la del PDF o, si no publica PDF, la página. */
  carga: FuenteAdmin | null;
  publicada: TasaAdmin | null;
  porAprobar: TasaAdmin[];
  historial: TasaAdmin[];
  documentos: DocumentoPdf[];
  /** Fuentes que se cargan a mano (Davivienda, Lulo Bank, Falabella). */
  manuales: FuenteAdmin[];
  /** Manual y nadie la ha revisado este mes: hay que cargarla. */
  porCargar: boolean;
}

/** "Bogotá" → "bogota", para buscar sin importar tildes ni mayúsculas. */
function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Primero lo que espera aprobación, luego lo por cargar, luego lo demás. */
function orden(t: TarjetaTasa): number {
  return t.porAprobar.length ? 0 : t.porCargar ? 1 : 2;
}

/** Lo que se ve al comparar los dos PDF. */
interface Comparacion {
  titulo: string;
  /** Tarjeta y tasa por aprobar, para aprobarla sin cerrar la comparación. */
  clave: string;
  tasa: number;
  izquierda: { titulo: string; url: SafeResourceUrl | null } | null;
  derecha: { titulo: string; url: SafeResourceUrl | null };
}

/**
 * Configuración de tasas: por cada banco y producto, la tasa publicada con
 * su PDF y la que espera aprobación con el suyo, para compararlas (también
 * los dos PDF lado a lado), corregirla y aprobarla en la misma pantalla.
 */
@Component({
  selector: 'app-tasas-admin',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    TasaPipe,
    CabeceraAdmin,
    EsqueletoImagen,
  ],
  templateUrl: './tasas-admin.html',
  styleUrl: './tasas-admin.css',
})
export class TasasAdmin implements OnInit, OnDestroy {
  private readonly admin = inject(TasasAdminService);
  private readonly docs = inject(DocumentosAdminService);
  private readonly sesion = inject(SesionAdmin);
  private readonly tasasPublicas = inject(TasasService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly locale = inject(LOCALE_ID);

  protected readonly unidades = UNIDADES_TASA;
  protected readonly productos = this.tasasPublicas.productos;

  protected readonly entidades = signal<EntidadAdmin[]>([]);
  protected readonly fuentes = signal<FuenteAdmin[]>([]);
  protected readonly documentos = signal<DocumentoPdf[]>([]);
  protected readonly tasas = signal<TasaAdmin[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  /** Qué tarjetas se ven: todas, las que esperan aprobación o las por cargar. */
  protected readonly vista = signal<'todos' | 'aprobar' | 'cargar'>('todos');
  /** Texto del buscador por nombre de entidad. */
  protected readonly buscar = signal('');
  protected readonly producto = signal<string>('todos');
  /** Id de la tasa que se edita. */
  protected readonly editando = signal<number | null>(null);
  /** Tarjeta con el formulario de cargar PDF o de direcciones abierto. */
  protected readonly cargandoEn = signal<string | null>(null);
  protected readonly direccionesEn = signal<string | null>(null);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly comparando = signal<Comparacion | null>(null);
  /**
   * Después de cargar el PDF de un banco manual en una tarjeta: el mismo
   * archivo, para ofrecerlo en sus otros productos (Davivienda trae libre
   * inversión, libranza y vivienda en un solo PDF).
   */
  protected readonly ofrecerOtros = signal<{
    clave: string;
    archivo: File;
    vigencia: string | null;
  } | null>(null);
  /** La tarjeta y la tasa que se comparan, siempre con sus datos al día. */
  protected readonly comparada = computed(() => {
    const cmp = this.comparando();
    const c = cmp && this.tarjetas().find((x) => x.clave === cmp.clave);
    const t = c?.porAprobar.find((x) => x.id === cmp!.tasa);
    return c && t ? { c, t } : null;
  });
  /** Tasa cuyo PDF se pidió eliminar y espera el segundo toque. */
  protected readonly confirmandoBorrar = signal<number | null>(null);
  private enlacesBlob: string[] = [];
  private archivo: File | null = null;
  private vigencia = '';
  protected url = '';
  protected urlIndice = '';

  /** Todas las tarjetas (banco y producto), sin filtros. */
  private readonly todas = computed<TarjetaTasa[]>(() => {
    const fuentes = this.fuentes();
    const tasas = this.tasas();
    const documentos = this.documentos();
    return this.entidades().flatMap((entidad) => {
      const propias = fuentes.filter((f) => f.entidad === entidad.codigo);
      const productos = new Set<Producto>(propias.map((f) => f.producto));
      for (const t of tasas) {
        if (t.entidad.codigo === entidad.codigo) productos.add(t.producto);
      }
      if (!productos.size) productos.add('libre-inversion');
      return [...productos].map((producto) => {
        const deProducto = propias.filter((f) => f.producto === producto);
        const pdf = deProducto.find((f) => f.tipo === 'pdf') ?? null;
        const pagina = deProducto.find((f) => f.tipo === 'pagina') ?? null;
        const ids = deProducto.map((f) => f.id);
        const manuales = deProducto.filter((f) => f.como_extraer === 'manual');
        const suyas = tasas.filter(
          (t) => t.entidad.codigo === entidad.codigo && t.producto === producto,
        );
        return {
          clave: `${entidad.codigo}:${producto}`,
          entidad,
          producto,
          pdf,
          pagina,
          carga: pdf ?? pagina,
          publicada: suyas.find((t) => t.estado === 'publicada') ?? null,
          porAprobar: suyas.filter((t) => t.estado === 'por_revisar'),
          historial: suyas.filter(
            (t) => t.estado === 'anterior' || t.estado === 'rechazada',
          ),
          // Los PDF y los pantallazos de sus páginas.
          documentos: documentos.filter((d) => ids.includes(d.fuente)),
          manuales,
          porCargar: manuales.some((f) => pendienteDelMes(f.ultima_revision)),
        };
      });
    });
  });

  protected readonly tarjetas = computed<TarjetaTasa[]>(() =>
    this.todas()
      .filter(
        (t) =>
          (this.producto() === 'todos' || t.producto === this.producto()) &&
          (this.vista() !== 'aprobar' || t.porAprobar.length > 0) &&
          (this.vista() !== 'cargar' || t.porCargar) &&
          sinTildes(t.entidad.nombre).includes(sinTildes(this.buscar())),
      )
      // Primero lo que espera aprobación, luego lo que hay que cargar a mano
      // este mes y al final lo que está al día.
      .sort((a, b) => orden(a) - orden(b)),
  );
  protected readonly pendientes = computed(
    () => this.tasas().filter((t) => t.estado === 'por_revisar').length,
  );
  /** Tarjetas manuales que nadie ha revisado este mes (sin el filtro). */
  protected readonly cuentaPorCargar = computed(
    () =>
      new Set(
        this.fuentes()
          .filter(
            (f) =>
              f.como_extraer === 'manual' && pendienteDelMes(f.ultima_revision),
          )
          .map((f) => `${f.entidad}:${f.producto}`),
      ).size,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    documento: [''],
    valor_desde: [''],
    valor_hasta: [''],
    unidad: ['MV' as UnidadTasa | ''],
    ea_desde: [''],
    ea_hasta: [''],
    hasta_origen: ['entidad' as 'entidad' | 'usura'],
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
    try {
      const [entidades, fuentes, documentos, tasas] = await Promise.all([
        this.docs.entidades(),
        this.docs.fuentes(),
        this.docs.documentos(),
        this.admin.listar(),
      ]);
      this.entidades.set(entidades);
      this.fuentes.set(fuentes);
      this.documentos.set(documentos);
      this.tasas.set(tasas);
    } catch (error) {
      this.error.set(mensajeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.soltarBlobs();
  }

  protected nombreProducto(id: string): string {
    return this.tasasPublicas.esProducto(id)
      ? this.tasasPublicas.nombre(id)
      : id;
  }

  protected logo(entidad: EntidadAdmin): string | null {
    return this.sesion.urlImagen(entidad.logo, 56);
  }

  protected readonly verPdf = verPdf;

  protected urlArchivo(id: string): string | null {
    return this.sesion.urlArchivo(id);
  }

  /** "1,30 % a 2,13 % M.V." o "desde 1,10 % N.M.V." */
  protected publica(t: TasaAdmin): string {
    const unidad = t.unidad ? ' ' + UNIDAD_TEXTO[t.unidad] : '';
    // Banco que solo publica la máxima (GNB en libranza).
    if (t.valor_desde === null)
      return t.valor_hasta === null
        ? 'Sin escribir'
        : `hasta ${formatoTasa(t.valor_hasta)}${unidad} (solo publica la máxima)`;
    return t.valor_hasta === null
      ? `desde ${formatoTasa(t.valor_desde)}${unidad}`
      : `${formatoTasa(t.valor_desde)} a ${formatoTasa(t.valor_hasta)}${unidad}`;
  }

  /**
   * Sin tasas escritas no se puede aprobar. Basta el desde o el hasta: hay
   * bancos que solo publican la máxima (GNB en libranza).
   */
  protected sinValores(t: TasaAdmin): boolean {
    return t.valor_desde === null && t.valor_hasta === null;
  }

  /** Cambio frente a la publicada: "▲ +0,03 pts", "▼ −1,20 pts" o "". */
  protected cambio(nueva: number | null, antes: number | null | undefined) {
    if (nueva === null || antes === null || antes === undefined) return '';
    const dif = +(nueva - antes).toFixed(2);
    if (dif === 0) return 'igual';
    return `${dif > 0 ? '▲ +' : '▼ −'}${formatoTasa(Math.abs(dif)).replace(' %', '')} pts`;
  }

  protected revisor(t: TasaAdmin): string {
    const p = t.revisada_por;
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '';
  }

  protected quienCargo(d: DocumentoPdf | undefined): string {
    if (!d) return '';
    if (d.origen === 'robot') return 'el robot';
    const u = d.user_created;
    return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '';
  }

  /** La tarjeta (banco y producto) a la que pertenece una tasa. */
  protected tarjetaDe(t: TasaAdmin): TarjetaTasa {
    const clave = `${t.entidad.codigo}:${t.producto}`;
    return (
      this.tarjetas().find((c) => c.clave === clave) ?? {
        clave,
        entidad: t.entidad,
        producto: t.producto,
        pdf: null,
        pagina: null,
        carga: null,
        publicada: null,
        porAprobar: [],
        historial: [],
        documentos: [],
        manuales: [],
        porCargar: false,
      }
    );
  }

  protected documentoDe(t: TasaAdmin): DocumentoPdf | undefined {
    return this.documentos().find((d) => d.id === t.documento?.id);
  }

  // Aprobar, rechazar y editar

  protected async aprobar(c: TarjetaTasa, t: TasaAdmin): Promise<void> {
    await this.trabajar(c.clave, async () => {
      const aprobada = await this.admin.aprobar(t, c.publicada, c.documentos);
      const antes = c.publicada?.id;
      const pdf = t.documento?.id;
      this.tasas.update((lista) =>
        lista.map((x) =>
          x.id === aprobada.id
            ? aprobada
            : x.id === antes
              ? { ...x, estado: 'anterior' }
              : x,
        ),
      );
      if (pdf) {
        this.documentos.update((lista) =>
          lista.map((d) =>
            d.id === pdf
              ? { ...d, estado: 'actual' }
              : d.estado === 'actual' && c.documentos.some((x) => x.id === d.id)
                ? { ...d, estado: 'anterior' }
                : d,
          ),
        );
      }
      this.aviso.set(`Tasa de ${c.entidad.nombre} aprobada y publicada.`);
      this.cerrarComparacionDe(t.id);
    });
  }

  protected editar(t: TasaAdmin): void {
    this.form.reset({
      documento: t.documento ? String(t.documento.id) : '',
      valor_desde: escribirDecimal(t.valor_desde),
      valor_hasta: escribirDecimal(t.valor_hasta),
      unidad: t.unidad ?? '',
      ea_desde: escribirDecimal(t.ea_desde),
      ea_hasta: escribirDecimal(t.ea_hasta),
      hasta_origen: t.hasta_origen ?? 'entidad',
      tipo_tasa: t.tipo_tasa ?? '',
      sistema_amortizacion: t.sistema_amortizacion ?? 'no_dice',
      vigente_desde: t.vigente_desde ?? '',
      frase: t.frase ?? '',
      notas: t.notas ?? '',
    });
    this.editando.set(t.id);
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

  protected readonly usura = USURA_CONSUMO;
  protected readonly esVivienda = esVivienda;

  /**
   * La entidad no publica máxima: el "hasta" es el tope legal de usura del
   * mes (solo consumo; vivienda tiene otra regla).
   */
  protected usarUsura(): void {
    const { unidad } = this.form.getRawValue();
    const mensual = +(tasaMensual(USURA_CONSUMO.tasa) * 100).toFixed(3);
    this.form.patchValue({
      valor_hasta: escribirDecimal(
        unidad === 'EA' ? USURA_CONSUMO.tasa : mensual,
      ),
      ea_hasta: escribirDecimal(USURA_CONSUMO.tasa),
      hasta_origen: 'usura',
    });
  }

  protected async guardar(c: TarjetaTasa, id: number): Promise<void> {
    const v = this.form.getRawValue();
    const cambios: CambiosTasa = {
      documento: v.documento ? Number(v.documento) : null,
      valor_desde: leerDecimal(v.valor_desde),
      valor_hasta: leerDecimal(v.valor_hasta),
      unidad: v.unidad || null,
      ea_desde: leerDecimal(v.ea_desde),
      ea_hasta: leerDecimal(v.ea_hasta),
      hasta_origen: leerDecimal(v.ea_hasta) === null ? null : v.hasta_origen,
      tipo_tasa: v.tipo_tasa || null,
      sistema_amortizacion: v.sistema_amortizacion,
      vigente_desde: v.vigente_desde || null,
      frase: v.frase.trim() || null,
      notas: v.notas.trim() || null,
    };
    const tasa = this.tasas().find((x) => x.id === id);
    const documento = tasa ? this.documentoDe(tasa) : undefined;
    await this.trabajar(c.clave, async () => {
      this.reemplazar(await this.admin.guardar(id, cambios));
      // La vigencia del PDF va con la de su tasa.
      if (
        documento &&
        documento.id === cambios.documento &&
        documento.vigente_desde !== (cambios.vigente_desde ?? null)
      ) {
        const cambiado = await this.docs.cambiarVigencia(
          documento.id,
          cambios.vigente_desde ?? null,
        );
        this.documentos.update((lista) =>
          lista.map((d) => (d.id === cambiado.id ? cambiado : d)),
        );
      }
      this.editando.set(null);
    });
  }

  // Corregir o eliminar un PDF cargado por error

  /**
   * La tasa publicada se puede corregir: editar sus valores, cambiar el
   * archivo de su PDF o eliminarla si se aprobó por error.
   */
  protected corregible(t: TasaAdmin): boolean {
    return t.estado === 'publicada';
  }

  /** La tasa que vuelve a quedar publicada si se elimina la actual. */
  protected anteriorDe(c: TarjetaTasa): TasaAdmin | undefined {
    return c.historial
      .filter((x) => x.estado === 'anterior')
      .sort((a, b) =>
        (b.revisada_en ?? '').localeCompare(a.revisada_en ?? ''),
      )[0];
  }

  protected async cambiarArchivo(
    c: TarjetaTasa,
    t: TasaAdmin,
    evento: Event,
  ): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    const documento = this.documentoDe(t);
    if (!archivo || !documento) return;
    await this.trabajar(c.clave, async () => {
      try {
        const cambiado = await this.docs.reemplazarArchivo(documento, archivo);
        this.documentos.update((lista) =>
          lista.map((d) => (d.id === cambiado.id ? cambiado : d)),
        );
        this.tasas.update((lista) =>
          lista.map((x) =>
            x.documento?.id === cambiado.id
              ? {
                  ...x,
                  documento: {
                    ...x.documento,
                    archivo: {
                      id: cambiado.archivo.id,
                      filename_download: cambiado.archivo.filename_download,
                    },
                    archivo_resaltado: null,
                  },
                }
              : x,
          ),
        );
        this.aviso.set(`PDF de ${c.entidad.nombre} cambiado.`);
      } catch (error) {
        if (!(error instanceof DocumentoRepetido)) throw error;
        this.error.set('Ese PDF ya está guardado en otro registro.');
      }
    });
  }

  /**
   * Elimina la tasa publicada y su PDF, cuando se aprobaron por error. Si
   * hay una anterior, vuelve a quedar publicada. Pide un segundo toque.
   */
  protected async eliminarPublicada(
    c: TarjetaTasa,
    t: TasaAdmin,
  ): Promise<void> {
    if (this.confirmandoBorrar() !== t.id) {
      this.confirmandoBorrar.set(t.id);
      return;
    }
    const documento = this.documentoDe(t);
    const anterior = this.anteriorDe(c);
    await this.trabajar(c.clave, async () => {
      await this.admin.eliminar(t.id);
      if (documento) await this.docs.descartar(documento);
      const vuelve = anterior ? await this.admin.restaurar(anterior) : null;
      this.tasas.update((lista) =>
        lista
          .filter((x) => x.id !== t.id)
          .map((x) => (x.id === vuelve?.id ? vuelve : x)),
      );
      this.documentos.update((lista) =>
        lista
          .filter((d) => d.id !== documento?.id)
          .map((d) =>
            d.id === vuelve?.documento?.id ? { ...d, estado: 'actual' } : d,
          ),
      );
      this.confirmandoBorrar.set(null);
      this.aviso.set(
        vuelve
          ? `Tasa de ${c.entidad.nombre} eliminada. Volvió a quedar publicada la anterior.`
          : `Tasa de ${c.entidad.nombre} eliminada con su PDF.`,
      );
    });
  }

  // Cargar un PDF nuevo

  protected abrirCarga(c: TarjetaTasa): void {
    this.archivo = null;
    this.vigencia = '';
    this.cargandoEn.set(c.clave);
  }

  protected elegirArchivo(evento: Event): void {
    this.archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected escribirVigencia(evento: Event): void {
    this.vigencia = (evento.target as HTMLInputElement).value;
  }

  /**
   * Sube el PDF (o el pantallazo, si el banco solo publica en su página) y
   * crea la tasa por aprobar unida a él, lista para llenar.
   */
  protected async cargarPdf(c: TarjetaTasa): Promise<void> {
    const fuente = c.carga;
    if (!fuente) return;
    if (!this.archivo) {
      this.error.set(
        `Elige el ${fuente.tipo === 'pdf' ? 'PDF' : 'archivo'} que quieres cargar.`,
      );
      return;
    }
    const archivo = this.archivo;
    const vigencia = this.vigencia || null;
    const esPdf =
      archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name);
    const que = esPdf ? 'PDF' : 'pantallazo';
    await this.trabajar(c.clave, async () => {
      try {
        const { tasa, yaEstaba } = await this.cargarEn(c, archivo, vigencia);
        this.cargandoEn.set(null);
        this.editar(tasa);
        const cargado = yaEstaba
          ? `Ese ${que} de ${c.entidad.nombre} ya estaba cargado: lo volví a usar.`
          : `${que[0].toUpperCase() + que.slice(1)} de ${c.entidad.nombre} cargado.`;
        const sigue =
          c.porAprobar.length || c.publicada
            ? 'Las tasas quedaron como estaban: revisa que el archivo diga lo mismo y apruébalas.'
            : 'Escribe las tasas que trae y apruébalas.';
        this.aviso.set(`${cargado} ${sigue}`);
        if (esPdf && this.otrasManuales(c).length)
          this.ofrecerOtros.set({ clave: c.clave, archivo, vigencia });
      } catch (error) {
        if (!(error instanceof DocumentoRepetido)) throw error;
        this.error.set(`Ese ${que} ya está guardado. No se cargó de nuevo.`);
      }
    });
  }

  /**
   * Carga el archivo en la fuente de la tarjeta y deja la tasa por aprobar
   * unida a él. Si ese mismo archivo ya está cargado en esta tarjeta, se usa
   * el que hay (para actualizar la tasa).
   */
  private async cargarEn(
    c: TarjetaTasa,
    archivo: File,
    vigencia: string | null,
  ): Promise<{ tasa: TasaAdmin; yaEstaba: boolean }> {
    const fuente = c.carga!;
    let documento: DocumentoPdf;
    let yaEstaba = false;
    try {
      documento = await this.docs.cargar(fuente.id, archivo, vigencia);
      this.documentos.update((lista) => [documento, ...lista]);
    } catch (error) {
      if (
        !(error instanceof DocumentoRepetido) ||
        error.existente.fuente !== fuente.id
      )
        throw error;
      documento = error.existente;
      yaEstaba = true;
    }
    // No se borra lo que ya está escrito: si hay una tasa por aprobar, el
    // archivo se le une; si no, la nueva copia la publicada.
    const pendiente = c.porAprobar[0];
    const tasa = pendiente
      ? pendiente.documento?.id === documento.id
        ? pendiente
        : await this.admin.unirDocumento(pendiente, documento)
      : await this.admin.crearDesdeDocumento(fuente, documento, c.publicada);
    if (pendiente) this.reemplazar(tasa);
    else this.tasas.update((lista) => [tasa, ...lista]);
    await this.marcarRevisadas(c);
    return { tasa, yaEstaba };
  }

  /**
   * Los otros productos manuales del mismo banco que se cargan con el mismo
   * tipo de archivo (los 6 de Davivienda salen de un solo PDF).
   */
  protected otrasManuales(c: TarjetaTasa): TarjetaTasa[] {
    return this.todas().filter(
      (o) =>
        o.clave !== c.clave &&
        o.entidad.codigo === c.entidad.codigo &&
        o.manuales.length > 0 &&
        o.carga?.tipo === c.carga?.tipo,
    );
  }

  /**
   * La tarjeta a la que se le cargó el PDF que se ofrece en los otros
   * productos. Va arriba de la lista: en "Por cargar" la tarjeta ya salió.
   */
  protected readonly ofertaDe = computed(() => {
    const clave = this.ofrecerOtros()?.clave;
    return this.todas().find((c) => c.clave === clave) ?? null;
  });

  /** Nombres de los productos, para la pregunta: "Libranza, Leasing VIS…". */
  protected nombresDe(lista: TarjetaTasa[]): string {
    return lista.map((o) => this.nombreProducto(o.producto)).join(', ');
  }

  /** Usa el PDF recién cargado también en los otros productos del banco. */
  protected async usarEnOtros(c: TarjetaTasa): Promise<void> {
    const oferta = this.ofrecerOtros();
    if (!oferta || oferta.clave !== c.clave) return;
    await this.trabajar(c.clave, async () => {
      const hechos: string[] = [];
      for (const otra of this.otrasManuales(c)) {
        await this.cargarEn(otra, oferta.archivo, oferta.vigencia);
        hechos.push(this.nombreProducto(otra.producto));
      }
      this.ofrecerOtros.set(null);
      this.aviso.set(
        `El PDF de ${c.entidad.nombre} también quedó en ${hechos.join(', ')}. Revisa las tasas de cada uno y apruébalas.`,
      );
    });
  }

  // Fuentes manuales: pendientes desde el día 1 de cada mes

  /** Guarda que las fuentes manuales de la tarjeta se revisaron hoy. */
  private async marcarRevisadas(c: TarjetaTasa): Promise<void> {
    if (!c.manuales.length) return;
    const ids = c.manuales.map((f) => f.id);
    const fecha = await this.docs.marcarRevisadas(ids);
    this.fuentes.update((lista) =>
      lista.map((f) =>
        ids.includes(f.id) ? { ...f, ultima_revision: fecha } : f,
      ),
    );
  }

  /** El banco no cambió su PDF este mes: sale de "Por cargar". */
  protected async sigueIgual(c: TarjetaTasa): Promise<void> {
    await this.trabajar(c.clave, async () => {
      await this.marcarRevisadas(c);
      this.aviso.set(
        `${c.entidad.nombre} (${this.nombreProducto(c.producto)}) quedó revisado este mes.`,
      );
    });
  }

  /** Los otros productos manuales del banco que siguen por cargar. */
  protected otrasPorCargar(c: TarjetaTasa): TarjetaTasa[] {
    return this.otrasManuales(c).filter((o) => o.porCargar);
  }

  /** "Sigue igual" en todos los productos del banco que siguen por cargar. */
  protected async sigueIgualEnTodos(c: TarjetaTasa): Promise<void> {
    await this.trabajar(c.clave, async () => {
      const todas = [c, ...this.otrasPorCargar(c)];
      for (const t of todas) await this.marcarRevisadas(t);
      this.aviso.set(
        `${c.entidad.nombre} quedó revisado este mes en ${todas.length} productos.`,
      );
    });
  }

  /** "28 oct 2026" o "nunca", para la última revisión de una manual. */
  protected ultimaRevision(c: TarjetaTasa): string {
    const fechas = c.manuales
      .map((f) => f.ultima_revision)
      .filter((f): f is string => !!f)
      .sort();
    const ultima = fechas.at(-1);
    return ultima
      ? formatDate(ultima, 'd MMM y', this.locale, '-0500')
      : 'nunca';
  }

  // Comparar los dos PDF lado a lado

  protected async comparar(c: TarjetaTasa, t: TasaAdmin): Promise<void> {
    const nuevo = t.documento;
    if (!nuevo) return;
    const actual =
      c.publicada?.documento ??
      c.documentos.find((d) => d.estado === 'actual') ??
      null;
    await this.trabajar(c.clave, async () => {
      const [der, izq] = await Promise.all([
        this.enlaceBlob(verPdf(nuevo)),
        actual && actual.id !== nuevo.id
          ? this.enlaceBlob(verPdf(actual))
          : Promise.resolve(null),
      ]);
      const vigencia = (v: string | null | undefined) =>
        v
          ? `vigente desde ${formatDate(v, 'd MMM y', this.locale, 'UTC')}`
          : 'sin vigencia';
      this.comparando.set({
        titulo: `${c.entidad.nombre} · ${this.nombreProducto(c.producto)}`,
        clave: c.clave,
        tasa: t.id,
        izquierda:
          actual && izq
            ? {
                titulo: `PDF actual · ${vigencia(actual.vigente_desde)}`,
                url: izq,
              }
            : null,
        derecha: {
          titulo: `Por aprobar · ${vigencia(nuevo.vigente_desde)}`,
          url: der,
        },
      });
    });
  }

  protected cerrarComparacion(): void {
    this.comparando.set(null);
    this.editando.set(null);
    this.soltarBlobs();
  }

  /** Aprobada la tasa que se comparaba, ya no hay qué comparar. */
  private cerrarComparacionDe(id: number): void {
    if (this.comparando()?.tasa === id) this.cerrarComparacion();
  }

  private async enlaceBlob(id: string): Promise<SafeResourceUrl> {
    const blob = await this.sesion.descargar(id);
    const url = URL.createObjectURL(
      blob.type ? blob : new Blob([blob], { type: 'application/pdf' }),
    );
    this.enlacesBlob.push(url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private soltarBlobs(): void {
    for (const url of this.enlacesBlob) URL.revokeObjectURL(url);
    this.enlacesBlob = [];
  }

  // Direcciones del banco

  protected escribir(campo: 'url' | 'urlIndice', evento: Event): void {
    this[campo] = (evento.target as HTMLInputElement).value;
  }

  protected abrirDirecciones(c: TarjetaTasa): void {
    this.url = c.pdf?.url ?? '';
    this.urlIndice = c.pdf?.url_indice ?? '';
    this.direccionesEn.set(c.clave);
  }

  protected async guardarDirecciones(c: TarjetaTasa): Promise<void> {
    const direcciones = this.direcciones();
    if (!direcciones) return;
    const pdf = c.pdf;
    await this.trabajar(c.clave, async () => {
      const fuente = pdf
        ? await this.docs.editarFuente(pdf.id, direcciones)
        : await this.docs.agregarFuente(
            c.entidad.codigo,
            c.producto,
            direcciones,
          );
      this.fuentes.update((lista) =>
        pdf
          ? lista.map((f) => (f.id === fuente.id ? fuente : f))
          : [...lista, fuente],
      );
      this.direccionesEn.set(null);
      this.aviso.set(`Direcciones de ${c.entidad.nombre} guardadas.`);
    });
  }

  /** Revisa las dos direcciones; null si alguna no sirve (y lo avisa). */
  private direcciones(): Direcciones | null {
    const url = this.url.trim();
    const indice = this.urlIndice.trim();
    const valida = (u: string) => /^https?:\/\/\S+$/.test(u);
    if (!valida(url)) {
      this.error.set('Escribe la dirección directa del PDF (https://…).');
      return null;
    }
    if (indice && !valida(indice)) {
      this.error.set(
        'La página de tasas y tarifas debe ser una dirección completa (https://…).',
      );
      return null;
    }
    return { url, url_indice: indice || null };
  }

  private reemplazar(tasa: TasaAdmin): void {
    this.tasas.update((lista) =>
      lista.map((t) => (t.id === tasa.id ? tasa : t)),
    );
  }

  private async trabajar(clave: string, tarea: () => Promise<void>) {
    this.ocupado.set(clave);
    this.error.set('');
    this.aviso.set('');
    try {
      await tarea();
    } catch (error) {
      this.error.set(mensajeError(error));
    } finally {
      this.ocupado.set(null);
    }
  }
}
