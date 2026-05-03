import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, getDocs,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth, db, appId, missingEnvKeys, firebaseInitError } from './firebase.js';

const hasFirebase = missingEnvKeys.length === 0 && !firebaseInitError;
const NETLIFY_ENDPOINT = '/api/data';
const LOCAL_UID_KEY = 'task-sultan:uid';
const POLL_INTERVAL = 8000;

let mode = hasFirebase ? 'firebase' : 'local';
export const getMode = () => mode;

const getOrCreateLocalUid = () => {
  let uid = localStorage.getItem(LOCAL_UID_KEY);
  if (!uid) {
    uid = crypto.randomUUID
      ? `u-${crypto.randomUUID()}`
      : `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LOCAL_UID_KEY, uid);
  }
  return uid;
};

const probeNetlify = async () => {
  try {
    const res = await fetch(`${NETLIFY_ENDPOINT}?uid=__probe&coll=__probe`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
};

const localKey = (uid, coll) => `task-sultan:${appId}:${uid}:${coll}`;
const readLocal = (uid, coll) => {
  try {
    return JSON.parse(localStorage.getItem(localKey(uid, coll)) || '[]');
  } catch {
    return [];
  }
};
const writeLocal = (uid, coll, items) =>
  localStorage.setItem(localKey(uid, coll), JSON.stringify(items));

const localSubs = new Map();
const notifyLocal = (uid, coll) => {
  localSubs.get(`${uid}:${coll}`)?.forEach((cb) => cb(readLocal(uid, coll)));
};

const fetchNetlify = async (uid, coll) => {
  const res = await fetch(
    `${NETLIFY_ENDPOINT}?uid=${encodeURIComponent(uid)}&coll=${encodeURIComponent(coll)}`
  );
  if (!res.ok) throw new Error(`netlify ${res.status}`);
  return res.json();
};

const netlifySubs = new Map();
const refreshNetlify = async (uid, coll) => {
  const key = `${uid}:${coll}`;
  const entry = netlifySubs.get(key);
  if (!entry) return;
  try {
    const items = await fetchNetlify(uid, coll);
    entry.lastValue = items;
    entry.cbs.forEach((cb) => cb(items));
  } catch {}
};

export const initAuth = (onUser) => {
  if (hasFirebase) {
    mode = 'firebase';
    signInAnonymously(auth).catch(() => {});
    return onAuthStateChanged(auth, (u) => onUser(u, 'firebase'));
  }

  const uid = getOrCreateLocalUid();
  (async () => {
    mode = (await probeNetlify()) ? 'netlify' : 'local';
    onUser({ uid }, mode);
  })();
  return () => {};
};

export const subscribe = (uid, coll, cb) => {
  if (mode === 'firebase') {
    const ref = collection(db, 'artifacts', appId, 'users', uid, coll);
    return onSnapshot(
      query(ref),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }

  if (mode === 'netlify') {
    const key = `${uid}:${coll}`;
    if (!netlifySubs.has(key)) {
      netlifySubs.set(key, { cbs: new Set(), lastValue: null, timer: null });
    }
    const entry = netlifySubs.get(key);
    entry.cbs.add(cb);
    if (entry.lastValue) cb(entry.lastValue);
    refreshNetlify(uid, coll);
    if (!entry.timer) {
      entry.timer = setInterval(() => refreshNetlify(uid, coll), POLL_INTERVAL);
    }
    return () => {
      entry.cbs.delete(cb);
      if (entry.cbs.size === 0 && entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
      }
    };
  }

  const key = `${uid}:${coll}`;
  if (!localSubs.has(key)) localSubs.set(key, new Set());
  localSubs.get(key).add(cb);
  cb(readLocal(uid, coll));
  const onStorage = (e) => {
    if (e.key === localKey(uid, coll)) cb(readLocal(uid, coll));
  };
  window.addEventListener('storage', onStorage);
  return () => {
    localSubs.get(key)?.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
};

export const getAll = async (uid, coll) => {
  if (mode === 'firebase') {
    const ref = collection(db, 'artifacts', appId, 'users', uid, coll);
    const snap = await getDocs(query(ref));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  if (mode === 'netlify') return fetchNetlify(uid, coll);
  return readLocal(uid, coll);
};

export const add = async (uid, coll, data) => {
  if (mode === 'firebase') {
    const ref = collection(db, 'artifacts', appId, 'users', uid, coll);
    const res = await addDoc(ref, data);
    return { id: res.id };
  }
  if (mode === 'netlify') {
    const res = await fetch(
      `${NETLIFY_ENDPOINT}?uid=${encodeURIComponent(uid)}&coll=${encodeURIComponent(coll)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    const result = await res.json();
    refreshNetlify(uid, coll);
    return result;
  }
  const items = readLocal(uid, coll);
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  items.push({ id, ...data });
  writeLocal(uid, coll, items);
  notifyLocal(uid, coll);
  return { id };
};

export const update = async (uid, coll, id, data) => {
  if (mode === 'firebase') {
    return updateDoc(doc(db, 'artifacts', appId, 'users', uid, coll, id), data);
  }
  if (mode === 'netlify') {
    await fetch(
      `${NETLIFY_ENDPOINT}?uid=${encodeURIComponent(uid)}&coll=${encodeURIComponent(coll)}&id=${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    refreshNetlify(uid, coll);
    return;
  }
  const items = readLocal(uid, coll).map((it) => (it.id === id ? { ...it, ...data } : it));
  writeLocal(uid, coll, items);
  notifyLocal(uid, coll);
};

export const remove = async (uid, coll, id) => {
  if (mode === 'firebase') {
    return deleteDoc(doc(db, 'artifacts', appId, 'users', uid, coll, id));
  }
  if (mode === 'netlify') {
    await fetch(
      `${NETLIFY_ENDPOINT}?uid=${encodeURIComponent(uid)}&coll=${encodeURIComponent(coll)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    refreshNetlify(uid, coll);
    return;
  }
  const items = readLocal(uid, coll).filter((it) => it.id !== id);
  writeLocal(uid, coll, items);
  notifyLocal(uid, coll);
};
