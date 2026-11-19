import {getApp, getApps, initializeApp} from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
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
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

void setPersistence(auth, browserLocalPersistence).catch(() => undefined);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
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

export async function googleSignIn(forceAccountSelect = false): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: forceAccountSelect ? 'select_account' : 'select_account',
  });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function logoutGoogle(): Promise<void> {
  await signOut(auth);
}

export async function resetFirestoreCache(): Promise<void> {
  try {
    await terminate(db);
  } catch {
    // Ignore terminate errors if listeners are inactive
  }
  try {
    await clearIndexedDbPersistence(db);
  } catch {
    // Ignore IndexedDB persistence clear errors
  }
}
