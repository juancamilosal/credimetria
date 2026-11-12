import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chips, OpcionChip } from '../../compartido/chips/chips';
import {
  ENLACE_RUNEOL,
  ENLACE_SUPERFINANCIERA,
  ENTIDADES_VISIBLES,
  EntidadReportados,
  FECHA_CONSULTA_REGISTROS,
  NivelEntidad,
} from '../../core/datos/entidades-reportados';

/**
 * Créditos para reportados: entidades que prestan a personas reportadas,
 * en dos niveles (vigiladas por la Superfinanciera y operadoras de libranza
 * inscritas en el RUNEOL), sin tasas, con su registro y la asesoría de los
 * aliados.
 */
@Component({
  selector: 'app-reportados',
  imports: [RouterLink, Chips, NgTemplateOutlet],
  templateUrl: './reportados.html',
  styleUrl: './reportados.css',
})
export class Reportados {
  protected readonly fecha = FECHA_CONSULTA_REGISTROS;

  protected readonly tipos: OpcionChip[] = [
    { valor: 'todas', texto: 'Todas' },
    { valor: '1', texto: 'Vigiladas por la Superfinanciera' },
    { valor: '2', texto: 'Operadoras de libranza' },
  ];
  /** Solo las especialidades que tiene alguna entidad visible. */
  protected readonly especialidades: OpcionChip[] = [
    { valor: 'todas', texto: 'Todas' },
    ...[
      { valor: 'pensionados', texto: 'Pensionados' },
      { valor: 'empleados', texto: 'Empleados con convenio' },
      { valor: 'docentes', texto: 'Docentes' },
      { valor: 'fuerza-publica', texto: 'Policía y Fuerzas Militares' },
    ].filter((o) =>
      ENTIDADES_VISIBLES.some((e) =>
        e.filtros.includes(o.valor as EntidadReportados['filtros'][number]),
      ),
    ),
  ];

  protected readonly tipo = signal('todas');
  protected readonly especialidad = signal('todas');

  private readonly filtradas = computed(() =>
    ENTIDADES_VISIBLES.filter(
      (e) =>
        (this.tipo() === 'todas' || String(e.nivel) === this.tipo()) &&
        (this.especialidad() === 'todas' ||
          e.filtros.includes(
            this.especialidad() as EntidadReportados['filtros'][number],
          )),
    ),
  );

  protected readonly vigiladas = computed(() =>
    this.filtradas().filter((e) => e.nivel === 1),
  );
  protected readonly operadoras = computed(() =>
    this.filtradas().filter((e) => e.nivel === 2),
  );

  protected verNivel(nivel: NivelEntidad): boolean {
    return this.tipo() === 'todas' || this.tipo() === String(nivel);
  }

  protected enlaceRegistro(entidad: EntidadReportados): string {
    return entidad.nivel === 1 ? ENLACE_SUPERFINANCIERA : ENLACE_RUNEOL;
  }

  protected asesoria(entidad?: EntidadReportados): Record<string, string> {
    return entidad
      ? { origen: 'reportados', entidad: entidad.nombre }
      : { origen: 'reportados' };
  }
}
