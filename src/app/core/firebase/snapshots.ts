import { Observable } from 'rxjs';
import {
  onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';

/** A realtime document listener as an Observable: unsubscribing stops the listener. */
export function docSnapshots<T>(ref: DocumentReference<T>): Observable<DocumentSnapshot<T>> {
  return new Observable((subscriber) =>
    onSnapshot(
      ref,
      (snapshot) => subscriber.next(snapshot),
      (error) => subscriber.error(error),
    ),
  );
}

/** A realtime query listener as an Observable: unsubscribing stops the listener. */
export function querySnapshots<T>(query: Query<T>): Observable<QuerySnapshot<T>> {
  return new Observable((subscriber) =>
    onSnapshot(
      query,
      (snapshot) => subscriber.next(snapshot),
      (error) => subscriber.error(error),
    ),
  );
}
