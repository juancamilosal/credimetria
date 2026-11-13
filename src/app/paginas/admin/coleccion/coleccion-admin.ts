import { DatePipe } from '@angular/common';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  SesionAdmin,
  mensajeError,
} from '../../../core/servicios/sesion-admin.service';
import { CabeceraAdmin } from '../cabecera/cabecera-admin';
import { CampoAdmin, ConfigColeccion } from './config';

type Registro = Record<string, unknown>;

/**
 * Datos de una solicitud de aliado para crear el asesor (de "Solicitudes de
 * aliados" a "Asesores" sin volver a escribirlos).
 */
@Injectable({ providedIn: 'root' })
export class BorradorAsesor {
  readonly datos = signal<Registro | null>(null);
}

/** "Ana María Gómez" → "ana-maria-gomez" (identificador del asesor). */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** Valor de un campo para guardar en Directus a partir del formulario. */
export function valorParaGuardar(campo: CampoAdmin, valor: unknown): unknown {
  if (campo.tipo === 'lista') {
    const texto = Array.isArray(valor) ? valor.join(', ') : String(valor ?? '');
    return [
      ...new Set(
        texto
          .split(/[,;\n]/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
  }
  if (campo.tipo === 'booleano') return valor === true;
  if (campo.tipo === 'numero') {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(String(valor).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof valor === 'string') return valor.trim() || null;
  return valor ?? null;
}

/**
 * Administración de una colección de Directus (prospectos, asesores,
 * solicitudes de aliados, reportes): lista con buscador y filtro por estado,
 * y un formulario para crear, editar y borrar. La configuración de cada
 * sección (campos, columnas, estados) viene en la ruta (`colecciones.ts`).
 */
@Component({
  selector: 'app-coleccion-admin',
  imports: [CabeceraAdmin, FormsModule, DatePipe],
  templateUrl: './coleccion-admin.html',
  styleUrl: './coleccion-admin.css',
})
export class ColeccionAdmin {
  private readonly sesion = inject(SesionAdmin);
  private readonly router = inject(Router);
  private readonly borradorAsesor = inject(BorradorAsesor);
  protected readonly config = inject(ActivatedRoute).snapshot.data[
    'coleccion'
  ] as ConfigColeccion;

  protected readonly registros = signal<Registro[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly filtroEstado = signal('');
  /** Registro abierto en el formulario (o uno nuevo). */
  protected readonly abierto = signal<Registro | null>(null);
  protected readonly esNuevo = signal(false);
  protected readonly borrador = signal<Registro>({});
  protected readonly guardando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly subiendo = signal<string | null>(null);
  /** Opciones de los campos `relacion` (por ejemplo, los asesores). */
  protected readonly relaciones = signal<Record<string, Registro[]>>({});

  protected readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    const campoEstado = this.config.estado?.campo;
    return this.registros().filter(
      (r) =>
        (!estado || !campoEstado || r[campoEstado] === estado) &&
        (!q ||
          this.config.buscar.some((c) =>
            String(r[c] ?? '')
              .toLowerCase()
              .includes(q),
          )),
    );
  });

  /** Cuántos hay en cada estado (para los botones del filtro). */
  protected readonly conteo = computed(() => {
    const campo = this.config.estado?.campo;
    const cuenta: Record<string, number> = {};
    if (!campo) return cuenta;
    for (const r of this.registros()) {
      const e = String(r[campo] ?? '');
      cuenta[e] = (cuenta[e] ?? 0) + 1;
    }
    return cuenta;
  });

  constructor() {
    void this.cargar().then(() => {
      // Viene de "Crear asesor con estos datos" en una solicitud.
      const desde = this.borradorAsesor.datos();
      if (this.config.coleccion === 'asesores' && desde) {
        this.borradorAsesor.datos.set(null);
        this.nuevo(desde);
      }
    });
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const lista = await this.sesion.pedir<Registro[]>(
        'GET',
        `/items/${this.config.coleccion}?limit=-1&fields=*&sort=${this.config.orden}`,
      );
      this.registros.set(lista ?? []);
      for (const c of this.config.campos) {
        if (c.tipo !== 'relacion' || !c.relacion) continue;
        const opciones = await this.sesion.pedir<Registro[]>(
          'GET',
          `/items/${c.relacion.coleccion}?limit=-1&fields=id,${c.relacion.etiqueta}&sort=${c.relacion.etiqueta}`,
        );
        this.relaciones.update((r) => ({
          ...r,
          [c.campo]: opciones ?? [],
        }));
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Texto de una celda de la lista. */
  protected celda(r: Registro, campo: string): string {
    const v = r[campo];
    if (v === null || v === undefined || v === '') return '—';
    const def = this.config.campos.find((c) => c.campo === campo);
    if (def?.tipo === 'opciones') {
      return def.opciones?.find((o) => o.valor === v)?.texto ?? String(v);
    }
    if (def?.tipo === 'relacion' && def.relacion) {
      const rel = this.relaciones()[campo]?.find((x) => x['id'] === v);
      return String(rel?.[def.relacion.etiqueta] ?? v);
    }
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  }

  protected textoEstado(valor: unknown): string {
    return (
      this.config.estado?.opciones.find((o) => o.valor === valor)?.texto ??
      String(valor ?? '—')
    );
  }

  protected urlFoto(id: unknown, alto = 96): string | null {
    return typeof id === 'string' ? this.sesion.urlImagen(id, alto) : null;
  }

  protected abrir(r: Registro): void {
    this.mensaje.set(null);
    this.esNuevo.set(false);
    this.abierto.set(r);
    this.borrador.set(this.paraEditar(r));
  }

  protected nuevo(datos: Registro = {}): void {
    this.mensaje.set(null);
    this.esNuevo.set(true);
    const base: Registro = { ...datos };
    if (this.config.estado && base[this.config.estado.campo] === undefined) {
      base[this.config.estado.campo] = this.config.estado.opciones[0]?.valor;
    }
    this.abierto.set(base);
    this.borrador.set(this.paraEditar(base));
  }

  protected cerrar(): void {
    this.abierto.set(null);
  }

  /** Las listas se editan como texto separado por comas. */
  private paraEditar(r: Registro): Registro {
    const copia: Registro = { ...r };
    for (const c of this.config.campos) {
      if (c.tipo === 'lista' && Array.isArray(copia[c.campo])) {
        copia[c.campo] = (copia[c.campo] as string[]).join(', ');
      }
      if (
        c.tipo === 'fecha' &&
        typeof copia[c.campo] === 'string' &&
        !c.soloLectura
      ) {
        copia[c.campo] = (copia[c.campo] as string).slice(0, 10);
      }
    }
    return copia;
  }

  protected poner(campo: string, valor: unknown): void {
    this.borrador.update((b) => ({ ...b, [campo]: valor }));
  }

  protected json(v: unknown): string {
    return v ? JSON.stringify(v, null, 2) : '—';
  }

  protected editable(c: CampoAdmin): boolean {
    if (c.soloLectura) return false;
    if (c.soloAlCrear) return this.esNuevo();
    return true;
  }

  /** Los campos que se muestran en el formulario (al crear, sin los de solo lectura). */
  protected camposFormulario(): CampoAdmin[] {
    return this.config.campos.filter((c) => !(this.esNuevo() && c.soloLectura));
  }

  async guardar(): Promise<void> {
    const original = this.abierto();
    if (!original || this.guardando()) return;
    const b = this.borrador();
    const cuerpo: Registro = {};
    for (const c of this.config.campos) {
      if (!this.editable(c)) continue;
      const valor = valorParaGuardar(c, b[c.campo]);
      if (c.obligatorio && (valor === null || valor === '')) {
        this.mensaje.set(`Falta: ${c.etiqueta}.`);
        return;
      }
      const antes = valorParaGuardar(c, this.paraEditar(original)[c.campo]);
      if (this.esNuevo() || JSON.stringify(valor) !== JSON.stringify(antes)) {
        cuerpo[c.campo] = valor;
      }
    }
    if (this.esNuevo() && this.config.llaveManual) {
      cuerpo[this.config.llave] = slug(String(cuerpo[this.config.llave] ?? ''));
    }
    if (!this.esNuevo() && Object.keys(cuerpo).length === 0) {
      this.mensaje.set('No hay cambios.');
      return;
    }
    this.guardando.set(true);
    this.mensaje.set(null);
    try {
      const guardado = this.esNuevo()
        ? await this.sesion.pedir<Registro>(
            'POST',
            `/items/${this.config.coleccion}`,
            cuerpo,
          )
        : await this.sesion.pedir<Registro>(
            'PATCH',
            `/items/${this.config.coleccion}/${encodeURIComponent(String(original[this.config.llave]))}`,
            cuerpo,
          );
      const llave = this.config.llave;
      this.registros.update((lista) =>
        this.esNuevo()
          ? [guardado, ...lista]
          : lista.map((r) => (r[llave] === guardado[llave] ? guardado : r)),
      );
      this.esNuevo.set(false);
      this.abierto.set(guardado);
      this.borrador.set(this.paraEditar(guardado));
      this.mensaje.set('Guardado.');
    } catch (e) {
      this.mensaje.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async borrar(): Promise<void> {
    const r = this.abierto();
    if (!r || this.esNuevo()) return;
    const nombre = this.config.tituloRegistro(r);
    if (!globalThis.confirm?.(`¿Borrar "${nombre}"? No se puede deshacer.`)) {
      return;
    }
    const llave = this.config.llave;
    try {
      await this.sesion.pedir(
        'DELETE',
        `/items/${this.config.coleccion}/${encodeURIComponent(String(r[llave]))}`,
      );
      this.registros.update((lista) =>
        lista.filter((x) => x[llave] !== r[llave]),
      );
      this.abierto.set(null);
    } catch (e) {
      this.mensaje.set(mensajeError(e));
    }
  }

  /** Sube la imagen a la carpeta de Directus y la deja en el campo. */
  async subirImagen(campo: CampoAdmin, evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.subiendo.set(campo.campo);
    this.mensaje.set(null);
    try {
      const datos = new FormData();
      if (campo.carpeta) {
        const carpetas = await this.sesion.pedir<{ id: string }[]>(
          'GET',
          `/folders?filter=${encodeURIComponent(JSON.stringify({ name: { _eq: campo.carpeta } }))}&fields=id`,
        );
        if (carpetas?.[0]) datos.append('folder', carpetas[0].id);
      }
      const titulo = String(this.borrador()['nombre'] ?? archivo.name);
      datos.append('title', titulo);
      datos.append('file', archivo, archivo.name);
      const subido = await this.sesion.pedir<{ id: string }>(
        'POST',
        '/files',
        datos,
      );
      this.poner(campo.campo, subido.id);
      this.mensaje.set('Foto subida. Guarda para que quede en el registro.');
    } catch (e) {
      this.mensaje.set(mensajeError(e));
    } finally {
      this.subiendo.set(null);
    }
  }

  /** Desde una solicitud de aliado: abre "Nuevo asesor" con sus datos. */
  protected crearAsesor(): void {
    const s = this.abierto();
    if (!s) return;
    this.borradorAsesor.datos.set({
      id: slug(String(s['nombre'] ?? '')),
      estado: 'borrador',
      nombre: s['nombre'],
      empresa:
        s['empresa'] ??
        this.config.campos
          .find((c) => c.campo === 'tipo')
          ?.opciones?.find((o) => o.valor === s['tipo'])?.texto,
      entidades: s['entidades'],
      productos: s['productos'],
      ciudades: s['ciudades'],
      cedula: s['cedula'],
      celular: s['celular'],
      correo: s['correo'],
      notas: `Solicitud de aliado #${s['id']}.`,
    });
    void this.router.navigateByUrl('/admin/asesores');
  }
}
