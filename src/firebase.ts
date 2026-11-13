import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { UserProfile, WorkforceInput } from './types';
import { parseSsjWorkforceCsv } from './utils/csvParser';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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

export function toDateValue(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  let browser = 'Web Browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/')) browser = 'Apple Safari';

  let os = 'Desktop';
  if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} · ${os}`.slice(0, 120);
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function syncUserAndCreateSession(user: User): Promise<string> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const safeDisplayName = (
    user.displayName ||
    user.email?.split('@')[0] ||
    'เจ้าหน้าที่สาธารณสุข'
  ).slice(0, 120);
  const safeEmail = (user.email || '').slice(0, 254);
  const safePhoto = (user.photoURL || '').slice(0, 500);

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      const initialRole = safeEmail === 'cookkaimoph@gmail.com' ? 'admin' : 'officer';
      await setDoc(userRef, {
        uid: user.uid,
        email: safeEmail,
        displayName: safeDisplayName,
        photoURL: safePhoto,
        position:
          initialRole === 'admin'
            ? 'ผู้ดูแลระบบสารสนเทศ สสจ.ปัตตานี'
            : 'เจ้าหน้าที่กลุ่มงานทรัพยากรบุคคล',
        department: 'กลุ่มงานพัฒนาทรัพยากรบุคคลทางการแพทย์',
        facility: 'สำนักงานสาธารณสุขจังหวัดปัตตานี',
        role: initialRole,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: existingSnap.data().displayName || safeDisplayName,
        photoURL: safePhoto,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  const sessionId = generateId('sess');
  const sessionPath = `users/${user.uid}/sessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'sessions', sessionId), {
      userId: user.uid,
      email: safeEmail,
      provider: 'google.com',
      deviceLabel: getDeviceLabel(),
      status: 'active',
      loginAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, sessionPath);
  }
}

export async function signInWithGmail(): Promise<{ user: User; sessionId: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  if (!user.email || !user.emailVerified) {
    await signOut(auth);
    throw new Error('UNVERIFIED_EMAIL');
  }
  const sessionId = await syncUserAndCreateSession(user);
  return { user, sessionId };
}

export async function signOutFromGmail(
  userId?: string,
  sessionId?: string | null
): Promise<void> {
  if (userId && sessionId) {
    try {
      const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
      const snap = await getDoc(sessionRef);
      if (snap.exists() && snap.data().status === 'active') {
        await updateDoc(sessionRef, { status: 'signed_out' });
      }
    } catch (error) {
      console.warn('Unable to mark session signed out:', error);
    }
  }
  await signOut(auth);
}

export async function updateOfficerProfile(
  uid: string,
  updates: Pick<UserProfile, 'displayName' | 'position' | 'department' | 'facility'>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: updates.displayName.trim().slice(0, 120),
      position: updates.position.trim().slice(0, 100),
      department: updates.department.trim().slice(0, 120),
      facility: updates.facility.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLoginSession(
  uid: string,
  sessionId: string
): Promise<void> {
  const path = `users/${uid}/sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function sanitizeWorkforcePayload(input: WorkforceInput) {
  return {
    rowNo: Math.max(0, Math.min(10000, Math.round(input.rowNo || 0))),
    licenseNo: (input.licenseNo || '-').trim().slice(0, 32),
    fullName: input.fullName.trim().slice(0, 120),
    hospital: input.hospital.trim().slice(0, 120),
    district: input.district.trim().slice(0, 80),
    positionTitle: (input.positionTitle || '').trim().slice(0, 80),
    rankLevel: (input.rankLevel || '').trim().slice(0, 60),
    doctorType: (input.doctorType || '').trim().slice(0, 100),
    dutyStatus: input.dutyStatus,
    j18Status: input.j18Status,
    j18Hospital: (input.j18Hospital || '').trim().slice(0, 120),
    specialty: (input.specialty || '').trim().slice(0, 200),
    studySponsor: (input.studySponsor || '').trim().slice(0, 120),
    studyPeriod: (input.studyPeriod || '').trim().slice(0, 120),
    note: (input.note || '').trim().slice(0, 240),
  };
}

export async function createWorkforceRecord(
  uid: string,
  input: WorkforceInput
): Promise<void> {
  const recordId = generateId('wf');
  const path = `workforce/${recordId}`;
  try {
    await setDoc(doc(db, 'workforce', recordId), {
      ownerId: uid,
      ...sanitizeWorkforcePayload(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorkforceRecord(
  recordId: string,
  input: WorkforceInput
): Promise<void> {
  const path = `workforce/${recordId}`;
  try {
    await updateDoc(doc(db, 'workforce', recordId), {
      ...sanitizeWorkforcePayload(input),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWorkforceRecord(recordId: string): Promise<void> {
  const path = `workforce/${recordId}`;
  try {
    await deleteDoc(doc(db, 'workforce', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearWorkforceRecords(recordIds: string[]): Promise<void> {
  const chunkSize = 400;
  try {
    for (let i = 0; i < recordIds.length; i += chunkSize) {
      const chunk = recordIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, 'workforce', id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'workforce');
  }
}

export async function importWorkforceBatch(
  uid: string,
  items: WorkforceInput[],
  existingIdsToReplace?: string[]
): Promise<number> {
  if (existingIdsToReplace && existingIdsToReplace.length > 0) {
    await clearWorkforceRecords(existingIdsToReplace);
  }

  const chunkSize = 400;
  try {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        const id = `wf_${Date.now()}_${i + j}_${Math.random().toString(36).slice(2, 7)}`;
        batch.set(doc(db, 'workforce', id), {
          ownerId: uid,
          ...sanitizeWorkforcePayload(item),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return items.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'workforce');
  }
}

export async function loadOfficialSsjDataset(
  uid: string,
  existingIdsToReplace?: string[]
): Promise<number> {
  const res = await fetch('/assets/aistudio/____e57659ae.____________________2570');
  if (!res.ok) {
    throw new Error('ไม่พบไฟล์ฐานข้อมูลแพทย์ สสจ.ปัตตานี');
  }
  const csvText = await res.text();
  const { records } = parseSsjWorkforceCsv(csvText);
  if (records.length === 0) {
    throw new Error('ไม่พบรายการข้อมูลแพทย์ในไฟล์');
  }
  return importWorkforceBatch(uid, records, existingIdsToReplace);
}

export function getFirebaseCollectionRef(path: string) {
  return collection(db, path);
}
