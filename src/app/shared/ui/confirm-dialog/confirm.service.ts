import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  /** Styles the confirm button as destructive. */
  readonly danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  readonly resolve: (confirmed: boolean) => void;
}

/** Asks a yes/no question in the app's own dialog. One question at a time. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pendingState = signal<PendingConfirm | null>(null);

  readonly pending = this.pendingState.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.pendingState()?.resolve(false);
    return new Promise((resolve) => this.pendingState.set({ ...options, resolve }));
  }

  /** Called by the dialog when it closes. */
  answer(confirmed: boolean): void {
    const pending = this.pendingState();
    this.pendingState.set(null);
    pending?.resolve(confirmed);
  }
}
