const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { prompt, model = 'gemini-2.5-flash', apiKey: clientKey } = body || {};
  const apiKey = clientKey || Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return json(
      { error: 'لا يوجد مفتاح Gemini. الصق مفتاحك في إعدادات المحلل أو أضف GEMINI_API_KEY في Netlify.' },
      400
    );
  }

  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'Missing prompt' }, 400);
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const result = await upstream.json();
    if (!upstream.ok) {
      return json(
        { error: result?.error?.message || 'Gemini API error', status: upstream.status },
        502
      );
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return json({ text });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

export const config = {
  path: '/api/ai',
};
