import {getApp, getApps, initializeApp} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  doc,
  getDocFromServer,
  getFirestore,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export let db: Firestore = createFirestoreInstance();
export const auth = getAuth(app);

export function getActiveDb(): Firestore {
  const internal = db as unknown as {_terminated?: boolean} | null;
  if (!internal || internal._terminated) {
    db = createFirestoreInstance();
  }
  return db;
}

void setPersistence(auth, inMemoryPersistence).catch(() => undefined);

async function deleteIndexedDb(name: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearAuthAndCacheIndexedDbs(): Promise<void> {
  const knownNames = new Set<string>([
    'firebaseLocalStorageDb',
    'firebase-heartbeat-database',
    'firebase-installations-database',
  ]);
  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      for (const info of dbs) {
        if (
          info.name &&
          (info.name.includes('firebase') || info.name.includes('firestore'))
        ) {
          knownNames.add(info.name);
        }
      }
    } catch {
      // Ignore environments where indexedDB.databases() is unavailable
    }
  }
  await Promise.all(Array.from(knownNames).map(deleteIndexedDb));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(getActiveDb(), 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function initFirebaseAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function googleSignIn(_forceAccountSelect = true): Promise<User> {
  await setPersistence(auth, inMemoryPersistence).catch(() => undefined);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function logoutGoogle(): Promise<void> {
  await signOut(auth);
  await clearAuthAndCacheIndexedDbs();
}

export async function resetFirestoreCache(): Promise<void> {
  const currentDb = db;
  try {
    await terminate(currentDb);
  } catch {
    // Ignore terminate errors if listeners are inactive
  }
  try {
    await clearIndexedDbPersistence(currentDb);
  } catch {
    // Ignore IndexedDB persistence clear errors
  }
  await clearAuthAndCacheIndexedDbs();
  db = createFirestoreInstance();
}
