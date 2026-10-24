import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ProfileService } from '@core/data/profile.service';
import { ReadMarkersService } from '@core/data/read-markers.service';
import { RoomService } from '@core/data/room.service';
import { I18nService } from '@core/i18n/i18n.service';
import { directPartnerId, type DirectRoom, type Room } from '@core/models/room';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { LanguageSwitcher } from '@shared/ui/language-switcher/language-switcher';
import { decodeMentions, mentionsUser } from '@shared/utils/mentions';
import { singleLine } from '@shared/utils/text';

/** Rooms and direct messages, Slack style. Everything here comes from one Firestore listener. */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Avatar, Icon, LanguageSwitcher],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  protected readonly rooms = inject(RoomService);
  protected readonly profiles = inject(ProfileService);
  protected readonly readMarkers = inject(ReadMarkersService);
  protected readonly t = inject(I18nService).t;

  protected uid(): string {
    return this.auth.user()?.uid ?? '';
  }

  protected partnerId(room: DirectRoom): string {
    return directPartnerId(room, this.uid());
  }

  protected partnerName(room: DirectRoom): string {
    return this.profiles.profile(this.partnerId(room))()?.displayName ?? '…';
  }

  /** An unread last message that mentions you: the room shows "@" instead of a dot. */
  protected mentionsMe(room: Room): boolean {
    const last = room.lastMessage;
    return (
      !!last &&
      !last.deleted &&
      this.readMarkers.isUnread(room) &&
      mentionsUser(last.text, this.uid())
    );
  }

  /** "You: on my way", "An: on my way", or "No messages yet". */
  protected preview(room: Room): string {
    const last = room.lastMessage;
    if (!last) return this.t('preview.empty');
    if (last.deleted) return this.t('preview.deleted');
    const text = singleLine(decodeMentions(last.text, (uid) => this.nameOf(uid)));
    if (last.senderId === this.uid()) return this.t('preview.mine', { text });
    if (room.type === 'direct') return text;
    return this.t('preview.theirs', { name: this.nameOf(last.senderId), text });
  }

  private nameOf(uid: string): string {
    const profile = this.profiles.profile(uid)();
    return profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
  }
}
