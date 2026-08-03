// Writes dist/_headers after `expo export` — Cloudflare Workers static assets
// read this file for per-path response headers. Mirrors the caching policy
// previously set in vercel.json: never cache the HTML shell, cache hashed
// bundles forever.
import { writeFileSync } from 'node:fs';

const headers = `/
  Cache-Control: no-cache, no-store, must-revalidate

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable
`;

writeFileSync(new URL('../dist/_headers', import.meta.url), headers);
console.log('dist/_headers written');
