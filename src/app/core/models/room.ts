import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';

/**
 * A copy of the newest message, kept on the room so the room list needs no
 * extra reads. `createdAt` stays a Timestamp: the rules compare it exactly.
 */
export interface LastMessage {
  readonly id: string;
  readonly senderId: string;
  readonly text: string;
  readonly createdAt: Timestamp | null;
  readonly deleted: boolean;
}

interface RoomBase {
  readonly id: string;
  readonly memberIds: readonly string[];
  readonly lastMessage: LastMessage | null;
  readonly lastActivityAt: Timestamp | null;
}

/** rooms/{roomId} with `type: 'group'`: named, owned, joined by invite code. */
export interface GroupRoom extends RoomBase {
  readonly type: 'group';
  readonly name: string;
  readonly ownerId: string;
  readonly inviteCode: string;
}

/** rooms/{uidA_uidB} with `type: 'direct'`: two members, no name. */
export interface DirectRoom extends RoomBase {
  readonly type: 'direct';
}

export type Room = GroupRoom | DirectRoom;

function timestampOrNull(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null;
}

function lastMessageFrom(value: unknown): LastMessage | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as DocumentData;
  return {
    id: String(data['id']),
    senderId: String(data['senderId']),
    text: String(data['text'] ?? ''),
    createdAt: timestampOrNull(data['createdAt']),
    deleted: data['deleted'] === true,
  };
}

/** Reads a room, estimating server timestamps that are still pending locally. */
export function roomFromSnapshot(snapshot: DocumentSnapshot): Room | null {
  const data = snapshot.data({ serverTimestamps: 'estimate' });
  if (!data) return null;
  const base: RoomBase = {
    id: snapshot.id,
    memberIds: Array.isArray(data['memberIds']) ? data['memberIds'] : [],
    lastMessage: lastMessageFrom(data['lastMessage']),
    lastActivityAt: timestampOrNull(data['lastActivityAt']),
  };
  if (data['type'] === 'direct') return { ...base, type: 'direct' };
  return {
    ...base,
    type: 'group',
    name: String(data['name'] ?? ''),
    ownerId: String(data['ownerId'] ?? ''),
    inviteCode: String(data['inviteCode'] ?? ''),
  };
}

/** The other member of a 1-to-1 room. */
export function directPartnerId(room: DirectRoom, myUid: string): string {
  return room.memberIds.find((uid) => uid !== myUid) ?? myUid;
}
