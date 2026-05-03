import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, getDocs,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth, db, appId, missingEnvKeys, firebaseInitError } from './firebase.js';

export const useFirebase = missingEnvKeys.length === 0 && !firebaseInitError;

const LOCAL_UID = 'local-user';
const localKey = (coll) => `task-sultan:${appId}:${LOCAL_UID}:${coll}`;
const readLocal = (coll) => {
  try {
    return JSON.parse(localStorage.getItem(localKey(coll)) || '[]');
  } catch {
    return [];
  }
};
const writeLocal = (coll, items) =>
  localStorage.setItem(localKey(coll), JSON.stringify(items));

const subscribers = new Map();
const notify = (coll) => {
  const items = readLocal(coll);
  subscribers.get(coll)?.forEach((cb) => cb(items));
};

export const initAuth = (onUser) => {
  if (useFirebase) {
    signInAnonymously(auth).catch(() => {});
    return onAuthStateChanged(auth, onUser);
  }
  queueMicrotask(() => onUser({ uid: LOCAL_UID }));
  return () => {};
};

export const subscribe = (uid, coll, cb) => {
  if (useFirebase) {
    const ref = collection(db, 'artifacts', appId, 'users', uid, coll);
    return onSnapshot(
      query(ref),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }
  if (!subscribers.has(coll)) subscribers.set(coll, new Set());
  subscribers.get(coll).add(cb);
  cb(readLocal(coll));
  const onStorage = (e) => {
    if (e.key === localKey(coll)) cb(readLocal(coll));
  };
  window.addEventListener('storage', onStorage);
  return () => {
    subscribers.get(coll)?.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
};

export const getAll = async (uid, coll) => {
  if (useFirebase) {
    const ref = collection(db, 'artifacts', appId, 'users', uid, coll);
    const snap = await getDocs(query(ref));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLocal(coll);
};

export const add = async (uid, coll, data) => {
  if (useFirebase) {
    const ref = collection(db, 'artifacts', appId, 'users', uid, coll);
    const res = await addDoc(ref, data);
    return { id: res.id };
  }
  const items = readLocal(coll);
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  items.push({ id, ...data });
  writeLocal(coll, items);
  notify(coll);
  return { id };
};

export const update = async (uid, coll, id, data) => {
  if (useFirebase) {
    return updateDoc(doc(db, 'artifacts', appId, 'users', uid, coll, id), data);
  }
  const items = readLocal(coll).map((it) => (it.id === id ? { ...it, ...data } : it));
  writeLocal(coll, items);
  notify(coll);
};

export const remove = async (uid, coll, id) => {
  if (useFirebase) {
    return deleteDoc(doc(db, 'artifacts', appId, 'users', uid, coll, id));
  }
  const items = readLocal(coll).filter((it) => it.id !== id);
  writeLocal(coll, items);
  notify(coll);
};
