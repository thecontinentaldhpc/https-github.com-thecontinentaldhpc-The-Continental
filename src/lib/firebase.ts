import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { GMAIL_SCOPES, NOTIFICATION_EMAIL, resolveRoleForEmail } from './editorialRules';
import {
  isValidFirestoreId,
  normalizeSavedArticleDoc,
  sortReadingListNewestFirst,
  toSavedArticlePayload,
  type SavedArticleInput,
} from './readingList';
import type { SavedArticleItem } from '../types/publication';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

// In-memory cache ONLY for Gmail API OAuth access token (never stored in localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;
let connectedGmailEmail: string | null = null;
let isConnectingGmail = false;
const gmailAuthListeners = new Set<() => void>();

function notifyGmailAuthListeners() {
  for (const listener of gmailAuthListeners) {
    listener();
  }
}

onAuthStateChanged(auth, (fbUser) => {
  if (!fbUser && !isConnectingGmail) {
    cachedGmailAccessToken = null;
    connectedGmailEmail = null;
    notifyGmailAuthListeners();
  }
});

export function subscribeGmailAuthChange(listener: () => void): () => void {
  gmailAuthListeners.add(listener);
  return () => {
    gmailAuthListeners.delete(listener);
  };
}

export function getGmailAuthState(): { connected: boolean; email: string | null; accessToken: string | null } {
  return {
    connected: Boolean(cachedGmailAccessToken),
    email: connectedGmailEmail,
    accessToken: cachedGmailAccessToken,
  };
}

export function clearCachedGmailToken(): void {
  cachedGmailAccessToken = null;
  connectedGmailEmail = null;
  notifyGmailAuthListeners();
}

export async function connectGmailForNotifications(): Promise<{ email: string; accessToken: string }> {
  const gmailProvider = new GoogleAuthProvider();
  for (const scope of GMAIL_SCOPES) {
    gmailProvider.addScope(scope);
  }
  gmailProvider.setCustomParameters({
    prompt: 'consent select_account',
    login_hint: NOTIFICATION_EMAIL,
  });

  isConnectingGmail = true;
  try {
    const result = await signInWithPopup(auth, gmailProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google did not return a Gmail authorization token. Please try again and allow Gmail access.');
    }
    cachedGmailAccessToken = credential.accessToken;
    connectedGmailEmail = (result.user.email || NOTIFICATION_EMAIL).toLowerCase();
    notifyGmailAuthListeners();
    return {
      email: connectedGmailEmail,
      accessToken: cachedGmailAccessToken,
    };
  } finally {
    isConnectingGmail = false;
  }
}

export function normalizePhoneNumberInput(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  // Default to +91 when a standard 10-digit Indian mobile number is entered without country code
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return `+${cleaned.replace(/^\+*/, '')}`;
}

export function createPhoneRecaptcha(container: HTMLElement): RecaptchaVerifier {
  container.innerHTML = '';
  return new RecaptchaVerifier(auth, container, {
    size: 'invisible',
  });
}

export async function sendPhoneOtpCode(
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

export async function syncUserProfileToFirestore(params: {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName: string;
  emailVerified: boolean;
}) {
  const cleanEmail = (params.email || '').trim().toLowerCase().slice(0, 180);
  const cleanPhone = (params.phoneNumber || '').trim().slice(0, 32);
  if (!cleanEmail && !cleanPhone) return;

  const userPath = `users/${params.uid}`;
  const privatePath = `users/${params.uid}/private/info`;
  const role = cleanEmail ? resolveRoleForEmail(cleanEmail, params.emailVerified) : 'reader';
  const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : cleanPhone || 'Reader';
  const safeName = (params.displayName || fallbackName).slice(0, 120);

  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: params.uid,
        displayName: safeName,
        role,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: safeName,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const privRef = doc(db, 'users', params.uid, 'private', 'info');
    const privSnap = await getDoc(privRef);
    const privatePayload: Record<string, unknown> = {
      uid: params.uid,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      ...(cleanPhone ? { phoneNumber: cleanPhone } : {}),
      updatedAt: serverTimestamp(),
    };
    if (!privSnap.exists()) {
      await setDoc(privRef, {
        ...privatePayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, privatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function createSubmissionInFirestore(params: {
  id: string;
  submissionCode: string;
  authorUid: string;
  authorName: string;
  authorEmail: string;
  title: string;
  categoryId: string;
}) {
  const path = `submissions/${params.id}`;
  try {
    await setDoc(doc(db, 'submissions', params.id), {
      id: params.id,
      submissionCode: params.submissionCode.slice(0, 40),
      authorUid: params.authorUid,
      authorName: params.authorName.slice(0, 120),
      authorEmail: params.authorEmail.toLowerCase().slice(0, 180),
      title: params.title.slice(0, 220),
      categoryId: params.categoryId.slice(0, 128),
      status: 'Submitted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createAdminNotificationInFirestore(params: {
  id: string;
  eventType: 'user_login' | 'user_registered' | 'newsletter_subscribe' | 'submission_received' | 'contact_message';
  actorUid: string;
  actorEmail: string;
  actorName: string;
  subject: string;
  message: string;
}) {
  const path = `admin_notifications/${params.id}`;
  try {
    await setDoc(doc(db, 'admin_notifications', params.id), {
      id: params.id,
      eventType: params.eventType,
      recipientEmail: NOTIFICATION_EMAIL,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail.toLowerCase().slice(0, 180),
      actorName: (params.actorName || params.actorEmail).slice(0, 120),
      subject: params.subject.slice(0, 220),
      message: params.message.slice(0, 1000),
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

async function ensureParentUserProfileExists(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;

  const fbUser = auth.currentUser;
  const cleanEmail = (fbUser?.email || '').trim().toLowerCase().slice(0, 180);
  const cleanPhone = (fbUser?.phoneNumber || '').trim().slice(0, 32);
  const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : cleanPhone || 'Reader';
  const displayName = (fbUser?.displayName || fallbackName).slice(0, 120);
  const role = cleanEmail ? resolveRoleForEmail(cleanEmail, Boolean(fbUser?.emailVerified)) : 'reader';

  await setDoc(userRef, {
    uid,
    displayName,
    role,
    lastLoginAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveArticleForLaterInFirestore(
  uid: string,
  article: SavedArticleInput
): Promise<SavedArticleItem> {
  if (!isValidFirestoreId(uid) || !isValidFirestoreId(article.id)) {
    throw new Error('Invalid identifier while saving article to Firestore.');
  }
  const path = `users/${uid}/saved_articles/${article.id}`;
  const payload = toSavedArticlePayload(article, uid);

  try {
    await ensureParentUserProfileExists(uid);
    const ref = doc(db, 'users', uid, 'saved_articles', article.id);
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ...payload,
        savedAt: serverTimestamp(),
      });
      return {
        ...payload,
        featuredImageUrl: payload.featuredImageUrl ?? null,
        savedAt: new Date().toISOString(),
      };
    }

    await updateDoc(ref, {
      title: payload.title,
      summary: payload.summary,
      slug: payload.slug,
    });
    const normalized = normalizeSavedArticleDoc(
      { ...existingSnap.data(), ...payload },
      article.id
    );
    if (normalized) return normalized;
    return {
      ...payload,
      featuredImageUrl: payload.featuredImageUrl ?? null,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeSavedArticleFromFirestore(uid: string, articleId: string): Promise<void> {
  if (!isValidFirestoreId(uid) || !isValidFirestoreId(articleId)) {
    throw new Error('Invalid identifier while removing saved article.');
  }
  const path = `users/${uid}/saved_articles/${articleId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'saved_articles', articleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchSavedArticlesFromFirestore(uid: string): Promise<SavedArticleItem[]> {
  if (!isValidFirestoreId(uid)) return [];
  const path = `users/${uid}/saved_articles`;
  try {
    const q = query(collection(db, 'users', uid, 'saved_articles'), orderBy('savedAt', 'desc'));
    const snap = await getDocs(q);
    const items = snap.docs
      .map((d) => normalizeSavedArticleDoc(d.data() as Record<string, unknown>, d.id))
      .filter((x): x is SavedArticleItem => x !== null);
    return sortReadingListNewestFirst(items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeSavedArticlesFromFirestore(
  uid: string,
  onData: (items: SavedArticleItem[]) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!isValidFirestoreId(uid)) {
    onData([]);
    return () => {};
  }
  const path = `users/${uid}/saved_articles`;
  const q = query(collection(db, 'users', uid, 'saved_articles'), orderBy('savedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => normalizeSavedArticleDoc(d.data() as Record<string, unknown>, d.id))
        .filter((x): x is SavedArticleItem => x !== null);
      onData(sortReadingListNewestFirst(items));
    },
    (err) => {
      if (onError) {
        onError(err);
      } else {
        console.error('Firestore reading list listener error:', path, err);
      }
    }
  );
}

