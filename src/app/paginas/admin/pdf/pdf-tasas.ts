import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import {
  DocumentoPdf,
  EntidadAdmin,
  FuenteAdmin,
} from '../../../core/modelos/documento';
import { Producto } from '../../../core/modelos/tasa';
import {
  Direcciones,
  DocumentoRepetido,
  DocumentosAdminService,
} from '../../../core/servicios/documentos-admin.service';
import {
  mensajeError,
  SesionAdmin,
} from '../../../core/servicios/sesion-admin.service';
import { TasasService } from '../../../core/servicios/tasas.service';
import { CabeceraAdmin } from '../cabecera/cabecera-admin';

/** Lo que se muestra de un banco y un producto. */
interface TarjetaPdf {
  clave: string;
  entidad: EntidadAdmin;
  producto: Producto;
  pdf: FuenteAdmin | null;
  pagina: FuenteAdmin | null;
  actual: DocumentoPdf | null;
  nuevos: DocumentoPdf[];
  anteriores: DocumentoPdf[];
}

/**
 * PDF de tasas de los bancos: por cada banco y producto, el PDF actual, los
 * nuevos por aceptar (cargados a mano o por el robot) y los anteriores.
 */
@Component({
  selector: 'app-pdf-tasas',
  imports: [DatePipe, NgTemplateOutlet, CabeceraAdmin],
  templateUrl: './pdf-tasas.html',
  styleUrl: './pdf-tasas.css',
})
export class PdfTasas implements OnInit {
  private readonly servicio = inject(DocumentosAdminService);
  private readonly sesion = inject(SesionAdmin);
  private readonly tasas = inject(TasasService);

  protected readonly entidades = signal<EntidadAdmin[]>([]);
  protected readonly fuentes = signal<FuenteAdmin[]>([]);
  protected readonly documentos = signal<DocumentoPdf[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  /** Tarjeta con el formulario de cargar PDF abierto. */
  protected readonly cargandoEn = signal<string | null>(null);
  protected readonly ocupado = signal<string | null>(null);
  private archivo: File | null = null;
  private vigencia = '';
  /** Tarjeta con el formulario de direcciones abierto. */
  protected readonly editandoEn = signal<string | null>(null);
  protected url = '';
  protected urlIndice = '';

  protected readonly tarjetas = computed<TarjetaPdf[]>(() => {
    const fuentes = this.fuentes();
    const documentos = this.documentos();
    return this.entidades().flatMap((entidad) => {
      const propias = fuentes.filter((f) => f.entidad === entidad.codigo);
      const productos = [...new Set(propias.map((f) => f.producto))];
      if (!productos.length) productos.push('libre-inversion');
      return productos.map((producto) => {
        const deProducto = propias.filter((f) => f.producto === producto);
        const pdf = deProducto.find((f) => f.tipo === 'pdf') ?? null;
        const docs = pdf ? documentos.filter((d) => d.fuente === pdf.id) : [];
        return {
          clave: `${entidad.codigo}:${producto}`,
          entidad,
          producto,
          pdf,
          pagina: deProducto.find((f) => f.tipo === 'pagina') ?? null,
          actual: docs.find((d) => d.estado === 'actual') ?? null,
          nuevos: docs.filter((d) => d.estado === 'nuevo'),
          anteriores: docs.filter((d) => d.estado === 'anterior'),
        };
      });
    });
  });
  protected readonly porAceptar = computed(
    () => this.documentos().filter((d) => d.estado === 'nuevo').length,
  );

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }

  async ngOnInit(): Promise<void> {
    try {
      const [entidades, fuentes, documentos] = await Promise.all([
        this.servicio.entidades(),
        this.servicio.fuentes(),
        this.servicio.documentos(),
      ]);
      this.entidades.set(entidades);
      this.fuentes.set(fuentes);
      this.documentos.set(documentos);
    } catch (error) {
      this.error.set(mensajeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nombreProducto(id: string): string {
    return this.tasas.esProducto(id) ? this.tasas.nombre(id) : id;
  }

  protected logo(entidad: EntidadAdmin): string | null {
    return this.sesion.urlImagen(entidad.logo, 56);
  }

  protected enlace(documento: DocumentoPdf): string | null {
    return this.sesion.urlArchivo(documento.archivo.id);
  }

  protected quien(documento: DocumentoPdf): string {
    if (documento.origen === 'robot') return 'el robot';
    const u = documento.user_created;
    return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '—';
  }

  /** 412.345 bytes → "403 KB". */
  protected tamano(bytes: number | null): string {
    if (!bytes) return '';
    return bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  protected abrirCarga(t: TarjetaPdf): void {
    this.archivo = null;
    this.vigencia = '';
    this.aviso.set('');
    this.cargandoEn.set(t.clave);
  }

  protected elegirArchivo(evento: Event): void {
    this.archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected escribirVigencia(evento: Event): void {
    this.vigencia = (evento.target as HTMLInputElement).value;
  }

  protected escribir(campo: 'url' | 'urlIndice', evento: Event): void {
    this[campo] = (evento.target as HTMLInputElement).value;
  }

  protected editarDirecciones(t: TarjetaPdf): void {
    this.url = t.pdf?.url ?? '';
    this.urlIndice = t.pdf?.url_indice ?? '';
    this.editandoEn.set(t.clave);
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

  protected async cargar(t: TarjetaPdf): Promise<void> {
    if (!t.pdf) return;
    if (!this.archivo) {
      this.error.set('Elige el PDF que quieres cargar.');
      return;
    }
    const fuente = t.pdf.id;
    const archivo = this.archivo;
    await this.trabajar(t.clave, async () => {
      try {
        const nuevo = await this.servicio.cargar(
          fuente,
          archivo,
          this.vigencia || null,
        );
        this.documentos.update((lista) => [nuevo, ...lista]);
        this.cargandoEn.set(null);
        this.aviso.set(
          `PDF de ${t.entidad.nombre} cargado. Ábrelo y, si está bien, úsalo como actual.`,
        );
      } catch (error) {
        if (!(error instanceof DocumentoRepetido)) throw error;
        const estado = {
          nuevo: 'nuevo',
          actual: 'actual',
          anterior: 'anterior',
        }[error.existente.estado];
        this.error.set(
          `Ese PDF ya está guardado (como ${estado}). No se cargó de nuevo.`,
        );
      }
    });
  }

  protected async usarComoActual(
    t: TarjetaPdf,
    nuevo: DocumentoPdf,
  ): Promise<void> {
    await this.trabajar(t.clave, async () => {
      await this.servicio.usarComoActual(nuevo, t.actual);
      this.documentos.update((lista) =>
        lista.map((d) =>
          d.id === nuevo.id
            ? { ...d, estado: 'actual' }
            : d.id === t.actual?.id
              ? { ...d, estado: 'anterior' }
              : d,
        ),
      );
      this.aviso.set(`El PDF nuevo de ${t.entidad.nombre} ya es el actual.`);
    });
  }

  protected async descartar(t: TarjetaPdf, nuevo: DocumentoPdf): Promise<void> {
    await this.trabajar(t.clave, async () => {
      await this.servicio.descartar(nuevo);
      this.documentos.update((lista) => lista.filter((d) => d.id !== nuevo.id));
      this.aviso.set('PDF descartado.');
    });
  }

  protected async agregarFuente(t: TarjetaPdf): Promise<void> {
    const direcciones = this.direcciones();
    if (!direcciones) return;
    await this.trabajar(t.clave, async () => {
      const fuente = await this.servicio.agregarFuente(
        t.entidad.codigo,
        t.producto,
        direcciones,
      );
      this.fuentes.update((lista) => [...lista, fuente]);
      this.url = this.urlIndice = '';
      this.aviso.set(`Fuente PDF de ${t.entidad.nombre} agregada.`);
    });
  }

  protected async guardarDirecciones(t: TarjetaPdf): Promise<void> {
    const direcciones = this.direcciones();
    if (!direcciones || !t.pdf) return;
    const id = t.pdf.id;
    await this.trabajar(t.clave, async () => {
      const fuente = await this.servicio.editarFuente(id, direcciones);
      this.fuentes.update((lista) =>
        lista.map((f) => (f.id === fuente.id ? fuente : f)),
      );
      this.editandoEn.set(null);
      this.aviso.set(`Direcciones de ${t.entidad.nombre} guardadas.`);
    });
  }

  private async trabajar(clave: string, tarea: () => Promise<void>) {
    this.ocupado.set(clave);
    this.error.set('');
    try {
      await tarea();
    } catch (error) {
      this.error.set(mensajeError(error));
    } finally {
      this.ocupado.set(null);
    }
  }
}
