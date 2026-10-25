import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  mensajeError,
  SesionAdmin,
} from '../../../core/servicios/sesion-admin.service';

/** Entrada a la administración con la cuenta de Directus. */
@Component({
  selector: 'app-entrar',
  imports: [ReactiveFormsModule],
  templateUrl: './entrar.html',
  styleUrl: './entrar.css',
})
export class Entrar implements OnInit {
  private readonly sesion = inject(SesionAdmin);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    clave: ['', Validators.required],
  });
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly intento = signal(false);

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }

  async ngOnInit(): Promise<void> {
    if (await this.sesion.restaurar()) this.irAdentro();
  }

  protected invalido(campo: 'email' | 'clave'): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected async entrar(): Promise<void> {
    this.intento.set(true);
    this.error.set('');
    if (this.form.invalid || this.enviando()) return;
    this.enviando.set(true);
    try {
      const { email, clave } = this.form.getRawValue();
      await this.sesion.entrar(email.trim(), clave);
      this.irAdentro();
    } catch (error) {
      this.error.set(mensajeError(error));
      this.form.controls.clave.setValue('');
    } finally {
      this.enviando.set(false);
    }
  }

  private irAdentro(): void {
    const volver = this.ruta.snapshot.queryParamMap.get('volver');
    this.router.navigateByUrl(
      volver?.startsWith('/admin') ? volver : '/admin/tasas',
    );
  }
}
