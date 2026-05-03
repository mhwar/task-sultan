import { getStore } from '@netlify/blobs';

const STORE_NAME = 'task-sultan-data';
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const uid = url.searchParams.get('uid');
  const coll = url.searchParams.get('coll');

  if (!uid || !coll) return json({ error: 'Missing uid or coll' }, 400);

  if (uid === '__probe' && coll === '__probe') {
    try {
      const store = getStore(STORE_NAME);
      await store.get('__probe', { type: 'json' });
      return json({ ok: true });
    } catch (err) {
      return json({ error: 'Blobs unavailable: ' + err.message }, 503);
    }
  }

  const store = getStore(STORE_NAME);
  const key = `${uid}/${coll}`;

  try {
    if (req.method === 'GET') {
      const items = (await store.get(key, { type: 'json' })) || [];
      return json(items);
    }

    if (req.method === 'POST') {
      const data = await req.json();
      const items = (await store.get(key, { type: 'json' })) || [];
      const id = `nb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      items.push({ id, ...data });
      await store.setJSON(key, items);
      return json({ id });
    }

    if (req.method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'Missing id' }, 400);
      const data = await req.json();
      const items = (await store.get(key, { type: 'json' })) || [];
      const updated = items.map((it) => (it.id === id ? { ...it, ...data } : it));
      await store.setJSON(key, updated);
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'Missing id' }, 400);
      const items = (await store.get(key, { type: 'json' })) || [];
      const filtered = items.filter((it) => it.id !== id);
      await store.setJSON(key, filtered);
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

export const config = {
  path: '/api/data',
};
