/**
 * The id of the 1-to-1 room between two users: both uids, sorted, joined by "_".
 * The rules require exactly this id, so a pair of users has one such room.
 */
export function directRoomId(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/** The two uids of a 1-to-1 room, in the order the rules require. */
export function directMemberIds(uidA: string, uidB: string): [string, string] {
  return uidA < uidB ? [uidA, uidB] : [uidB, uidA];
}
