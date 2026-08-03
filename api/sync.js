// Vercel serverless function: cloud sync for In the Cards.
//
// The client POSTs { code, action, data? }:
//   - code:   the user's sync code (secret passphrase). We never store it —
//             only a SHA-256 hash keys the Redis record.
//   - action: 'push' stores the export bundle; 'pull' returns it.
//   - data:   (push only) the JSON export bundle as a string.
//
// Storage: the Upstash Redis attached to this Vercel project. Uses the REST
// API so no npm dependency is needed.

const crypto = require('crypto');

function redisEnv() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

// ~900 KB cap — a full bundle for heavy use is well under 1 MB; anything
// larger is more likely abuse than a real deck.
const MAX_PAYLOAD_BYTES = 900_000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const env = redisEnv();
  if (!env) {
    res.status(503).json({
      error:
        'Storage not connected. In the Vercel dashboard, open the Redis ' +
        'database under Storage and connect it to this project, then redeploy.',
    });
    return;
  }

  const { code, action, data } = req.body ?? {};
  if (typeof code !== 'string' || code.trim().length < 6) {
    res
      .status(400)
      .json({ error: 'Sync code must be at least 6 characters.' });
    return;
  }
  const key =
    'itc:user:' +
    crypto.createHash('sha256').update(code.trim()).digest('hex');

  try {
    if (action === 'push') {
      if (typeof data !== 'string' || data.length === 0) {
        res.status(400).json({ error: 'Missing data payload.' });
        return;
      }
      if (data.length > MAX_PAYLOAD_BYTES) {
        res.status(413).json({ error: 'Payload too large.' });
        return;
      }
      const updatedAt = Date.now();
      const record = JSON.stringify({ updatedAt, data });
      const r = await fetch(`${env.url}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.token}` },
        body: record,
      });
      if (!r.ok) {
        res.status(502).json({ error: 'Storage write failed.' });
        return;
      }
      res.status(200).json({ ok: true, updatedAt });
    } else if (action === 'pull') {
      const r = await fetch(`${env.url}/get/${key}`, {
        headers: { Authorization: `Bearer ${env.token}` },
      });
      if (!r.ok) {
        res.status(502).json({ error: 'Storage read failed.' });
        return;
      }
      const body = await r.json();
      if (!body.result) {
        res.status(200).json({ ok: true, empty: true });
        return;
      }
      const record = JSON.parse(body.result);
      res
        .status(200)
        .json({ ok: true, updatedAt: record.updatedAt, data: record.data });
    } else {
      res.status(400).json({ error: 'Unknown action.' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Sync failed: ' + (e?.message ?? e) });
  }
};
