// Cloudflare Worker: serves the static app (via the ASSETS binding) and
// implements POST /api/sync — cloud backup keyed by a secret sync code.
//
// Same request/response contract as the previous Vercel function
// (api/sync.js), so the client (src/data/sync.ts) is unchanged:
//   POST /api/sync { code, action: 'push'|'pull', data? }
//
// Storage: Workers KV (SYNC_KV binding). The sync code itself is never
// stored — a SHA-256 hash of it keys the record.

const MAX_PAYLOAD_BYTES = 900_000;

async function hashCode(code) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSync(request, env) {
  if (request.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'Body must be JSON.' });
  }

  const { code, action, data } = payload ?? {};
  if (typeof code !== 'string' || code.trim().length < 6) {
    return json(400, { error: 'Sync code must be at least 6 characters.' });
  }
  const key = 'itc:user:' + (await hashCode(code.trim()));

  if (action === 'push') {
    if (typeof data !== 'string' || data.length === 0) {
      return json(400, { error: 'Missing data payload.' });
    }
    if (data.length > MAX_PAYLOAD_BYTES) {
      return json(413, { error: 'Payload too large.' });
    }
    const updatedAt = Date.now();
    await env.SYNC_KV.put(key, JSON.stringify({ updatedAt, data }));
    return json(200, { ok: true, updatedAt });
  }

  if (action === 'pull') {
    const raw = await env.SYNC_KV.get(key);
    if (!raw) {
      return json(200, { ok: true, empty: true });
    }
    const record = JSON.parse(raw);
    return json(200, { ok: true, updatedAt: record.updatedAt, data: record.data });
  }

  return json(400, { error: 'Unknown action.' });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/sync') {
      try {
        return await handleSync(request, env);
      } catch (e) {
        return json(500, { error: 'Sync failed: ' + (e?.message ?? e) });
      }
    }
    // Everything else: static assets, with SPA fallback (see wrangler.jsonc).
    return env.ASSETS.fetch(request);
  },
};
