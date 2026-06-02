import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, addDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error('Firebase configuration is missing or invalid. Please check firebase-applet-config.json');
}

const app = initializeApp(firebaseConfig);
console.log('Firebase initialized with Project ID:', firebaseConfig.projectId);
// Use initializeFirestore instead of getFirestore for advanced stability settings
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache({}), // Force memory cache to avoid IndexedDB locking bugs in iFrames
  experimentalForceLongPolling: true, // Bypass potential WebChannel issues in sandboxed environments
}, firebaseConfig.firestoreDatabaseId);

// Disable offline persistence logic - already handled by memoryLocalCache above

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signInEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const signUpEmail = async (email: string, pass: string, fullName: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(userCredential.user, { displayName: fullName });
  
  // Write to 'mail' collection to trigger Firebase Extension (Trigger Email)
  try {
    await addDoc(collection(db, 'mail'), {
      to: email,
      message: {
        subject: 'Welcome to IzyFlow!',
        text: `Hi ${fullName},\n\nWelcome to IzyFlow! We're excited to have you on board. Start managing your finances today.\n\nBest,\nThe IzyFlow Team`,
        html: `<h3>Hi ${fullName},</h3><p>Welcome to IzyFlow! We're excited to have you on board. Start managing your finances today.</p><p>Best,<br>The IzyFlow Team</p>`
      }
    });
  } catch (e) {
    console.error('Failed to queue welcome email:', e);
  }

  return userCredential;
};
export const logOut = () => signOut(auth);

export interface FirestoreErrorInfo {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: string, path: string | null) {
  const isQuotaError = error.code === 'resource-exhausted' || 
                      (error.message && error.message.includes('Quota limit exceeded'));

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaError) {
    console.warn('Firestore Quota Exceeded for:', path);
    // We don't throw for quota errors to allow components to continue with cached data if available
    return { isQuotaError: true, ...errInfo };
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
