import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AppError, isPermissionDenied } from '@core/errors/app-error';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { docSnapshots, querySnapshots } from '@core/firebase/snapshots';
import { LIMITS } from '@core/limits';
import { roomFromSnapshot, type DirectRoom, type GroupRoom, type Room } from '@core/models/room';
import { directMemberIds, directRoomId } from '@shared/utils/direct-room-id';
import { generateInviteCode, isInviteCode } from '@shared/utils/invite-code';

/** How many fresh codes to try when a generated invite code is already taken. */
const INVITE_ATTEMPTS = 3;

/**
 * Rooms: the live list of your rooms (one listener), and every write on a room.
 * Each write mirrors one `allow` branch of firestore.rules, named in its comment.
 */
@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);

  /** Your rooms, most recently active first; undefined while loading. */
  readonly rooms = toSignal(
    toObservable(this.auth.user).pipe(
      switchMap((user) => {
        if (!user) return of(user === null ? [] : undefined);
        const mine = query(
          collection(this.db, 'rooms'),
          where('memberIds', 'array-contains', user.uid),
          orderBy('lastActivityAt', 'desc'),
          limit(LIMITS.roomListLimit),
        );
        return querySnapshots(mine).pipe(
          map((snapshot) => snapshot.docs.map(roomFromSnapshot).filter((room) => room !== null)),
          catchError((error: unknown) => {
            // Right after the first deploy this is usually the composite index still building.
            console.error('Could not list rooms. Reload once the issue is fixed.', error);
            return of([]);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  readonly groups = computed(() =>
    (this.rooms() ?? []).filter((room): room is GroupRoom => room.type === 'group'),
  );

  readonly directs = computed(() =>
    (this.rooms() ?? []).filter((room): room is DirectRoom => room.type === 'direct'),
  );

  /** A room from the live list, if it is in there. */
  findRoom(roomId: string): Room | undefined {
    return this.rooms()?.find((room) => room.id === roomId);
  }

  /**
   * One room, live: for a room that is not in the list (beyond the newest
   * LIMITS.roomListLimit, or just left). Emits null when it is gone or unreadable.
   */
  watchRoom(roomId: string): Observable<Room | null> {
    return docSnapshots(doc(this.db, 'rooms', roomId)).pipe(
      map((snapshot) => roomFromSnapshot(snapshot)),
      catchError(() => of(null)),
    );
  }

  /** Creates a group you own, with its invite. Rules: isNewGroup() + invites `allow create`. */
  async createGroup(name: string): Promise<string> {
    const uid = this.auth.requireUid();
    const roomRef = doc(collection(this.db, 'rooms'));
    for (let attempt = 1; ; attempt++) {
      const code = generateInviteCode();
      const batch = writeBatch(this.db);
      batch.set(roomRef, {
        type: 'group',
        name,
        ownerId: uid,
        memberIds: [uid],
        inviteCode: code,
        lastJoin: null,
        lastMessage: null,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });
      batch.set(doc(this.db, 'invites', code), {
        roomId: roomRef.id,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
      try {
        await batch.commit();
        return roomRef.id;
      } catch (error) {
        // A taken code turns the invite write into a denied update: try another code.
        if (!isPermissionDenied(error) || attempt >= INVITE_ATTEMPTS) throw error;
      }
    }
  }

  /** Rules: isRename(). */
  renameGroup(roomId: string, name: string): Promise<void> {
    return updateDoc(doc(this.db, 'rooms', roomId), { name });
  }

  /** Swaps the invite code; the old code stops working. Rules: isInviteReset(). */
  async resetInvite(room: GroupRoom): Promise<string> {
    const uid = this.auth.requireUid();
    for (let attempt = 1; ; attempt++) {
      const code = generateInviteCode();
      const batch = writeBatch(this.db);
      batch.set(doc(this.db, 'invites', code), {
        roomId: room.id,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(this.db, 'rooms', room.id), { inviteCode: code });
      batch.delete(doc(this.db, 'invites', room.inviteCode));
      try {
        await batch.commit();
        return code;
      } catch (error) {
        if (!isPermissionDenied(error) || attempt >= INVITE_ATTEMPTS) throw error;
      }
    }
  }

  /** Rules: isMemberRemoval(). */
  removeMember(roomId: string, uid: string): Promise<void> {
    return updateDoc(doc(this.db, 'rooms', roomId), { memberIds: arrayRemove(uid) });
  }

  /** Rules: isLeave(). */
  leaveGroup(roomId: string): Promise<void> {
    const uid = this.auth.requireUid();
    return updateDoc(doc(this.db, 'rooms', roomId), { memberIds: arrayRemove(uid) });
  }

  /**
   * Joins the room behind an invite code and returns its id. Rules: isJoin().
   * Costs two or three reads: the invite, a check that you are not already in, then the join.
   */
  async joinWithCode(code: string): Promise<string> {
    if (!isInviteCode(code)) throw new AppError('invite-malformed');
    const uid = this.auth.requireUid();
    const invite = await getDoc(doc(this.db, 'invites', code));
    const roomId = invite.data()?.['roomId'];
    if (!invite.exists() || typeof roomId !== 'string') throw new AppError('invite-not-found');
    const roomRef = doc(this.db, 'rooms', roomId);
    try {
      await getDoc(roomRef);
      return roomId; // Readable, so you are already a member.
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
    }
    try {
      await updateDoc(roomRef, { memberIds: arrayUnion(uid), lastJoin: { uid, code } });
    } catch (error) {
      throw isPermissionDenied(error) ? new AppError('join-refused') : error;
    }
    return roomId;
  }

  /**
   * Opens the 1-to-1 room with another user, creating it on first use, and returns its id.
   * Rules: isNewDirect().
   */
  async openDirect(otherUid: string): Promise<string> {
    const uid = this.auth.requireUid();
    const roomId = directRoomId(uid, otherUid);
    const roomRef = doc(this.db, 'rooms', roomId);
    try {
      await getDoc(roomRef);
      return roomId;
    } catch (error) {
      // A room that does not exist yet is unreadable too.
      if (!isPermissionDenied(error)) throw error;
    }
    await setDoc(roomRef, {
      type: 'direct',
      memberIds: directMemberIds(uid, otherUid),
      lastMessage: null,
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
    return roomId;
  }

  /**
   * Deletes a group you own: its messages page by page, then the room and its
   * invite in one batch. Every message costs one read and one delete, so a long
   * history uses a visible share of the free daily quota (20,000 deletes).
   * Rules: messages `allow delete`, then rooms `allow delete`.
   */
  async deleteGroup(room: GroupRoom, onProgress?: (deleted: number) => void): Promise<void> {
    const messages = collection(this.db, 'rooms', room.id, 'messages');
    let deleted = 0;
    for (;;) {
      const page = await getDocs(query(messages, limit(LIMITS.messagePageSize)));
      if (page.empty) break;
      const batch = writeBatch(this.db);
      for (const message of page.docs) batch.delete(message.ref);
      await batch.commit();
      deleted += page.size;
      onProgress?.(deleted);
    }
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, 'rooms', room.id));
    batch.delete(doc(this.db, 'invites', room.inviteCode));
    await batch.commit();
  }
}
