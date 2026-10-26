import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ReadMarkersService } from '@core/data/read-markers.service';
import { RoomService } from '@core/data/room.service';
import { I18nService } from '@core/i18n/i18n.service';

/**
 * The browser tab's title: "(2) #riders · K-Chat Toolkit (Firebase)". The count of rooms with
 * unread messages comes first, as in Slack, so a background tab shows activity.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly rooms = inject(RoomService);
  private readonly readMarkers = inject(ReadMarkersService);
  private readonly page = signal<string | null>(null);

  readonly unreadRooms = computed(
    () => (this.rooms.rooms() ?? []).filter((room) => this.readMarkers.isUnread(room)).length,
  );

  constructor() {
    effect(() => {
      const app = this.i18n.t('app.name');
      const page = this.page();
      const base = page ? `${page} · ${app}` : app;
      const unread = this.unreadRooms();
      this.title.setTitle(unread > 0 ? `(${unread}) ${base}` : base);
    });
  }

  /** Names the page on screen; null leaves only the app's name. */
  set(page: string | null): void {
    this.page.set(page);
  }
}
