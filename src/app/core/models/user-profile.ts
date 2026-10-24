import type { DocumentSnapshot } from 'firebase/firestore';

/** users/{uid}. Only the display name is public; the email stays in Authentication. */
export interface UserProfile {
  readonly uid: string;
  readonly displayName: string;
}

export function profileFromSnapshot(snapshot: DocumentSnapshot): UserProfile | null {
  const data = snapshot.data();
  if (!data || typeof data['displayName'] !== 'string') return null;
  return { uid: snapshot.id, displayName: data['displayName'] };
}
