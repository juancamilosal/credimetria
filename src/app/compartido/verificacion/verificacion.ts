import {
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  model,
  viewChild,
} from '@angular/core';
import { inject } from '@angular/core';
import { TurnstileService } from '../../core/servicios/turnstile.service';

/**
 * Widget de Cloudflare Turnstile: deja el token en `token` (null mientras no
 * hay o si venció) y marca `fallo` si el widget no carga. Solo corre en el
 * navegador. `reiniciar()` pide otro token (cada uno sirve una sola vez).
 */
@Component({
  selector: 'app-verificacion',
  template: '<div #caja class="turnstile"></div>',
})
export class Verificacion implements OnDestroy {
  private readonly turnstile = inject(TurnstileService);
  readonly token = model<string | null>(null);
  readonly fallo = model(false);

  private readonly caja = viewChild.required<ElementRef<HTMLElement>>('caja');
  private widgetId: string | null = null;
  private montado = false;
  private destruido = false;

  constructor() {
    afterRenderEffect(() => {
      const caja = this.caja().nativeElement;
      if (this.montado) return;
      this.montado = true;
      void this.montar(caja);
    });
  }

  private async montar(caja: HTMLElement): Promise<void> {
    try {
      const id = await this.turnstile.mostrar(caja, {
        token: (t) => {
          this.token.set(t);
          this.fallo.set(false);
        },
        vencido: () => this.token.set(null),
        error: () => {
          this.token.set(null);
          this.fallo.set(true);
        },
      });
      if (this.destruido) {
        this.turnstile.quitar(id);
        return;
      }
      this.widgetId = id;
    } catch {
      this.fallo.set(true);
    }
  }

  reiniciar(): void {
    this.token.set(null);
    if (this.widgetId) this.turnstile.reiniciar(this.widgetId);
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.widgetId) this.turnstile.quitar(this.widgetId);
  }
}
