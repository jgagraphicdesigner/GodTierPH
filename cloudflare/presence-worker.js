const ACTIVE_TTL_SECONDS = 60;
const MAX_LIST_PAGES = 5;
const ALLOWED_ORIGINS = new Set([
  'https://www.godtierph.com',
  'https://godtierph.com',
  'http://www.godtierph.com',
  'http://godtierph.com',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.godtierph.com';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

function cleanSessionId(value) {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);

  return cleaned || crypto.randomUUID();
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (!text || text.length > 2048) return {};
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

async function hashValue(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function countActiveIpHashes(kv, now) {
  const hashes = new Set();
  const expiredKeys = [];
  let cursor;
  let page = 0;

  do {
    const list = await kv.list({
      prefix: 'presence:',
      limit: 1000,
      cursor,
    });

    for (const item of list.keys) {
      const metadata = item.metadata || {};
      const seen = Number(metadata.seen || 0);

      if (seen && now - seen > ACTIVE_TTL_SECONDS * 1000) {
        expiredKeys.push(item.name);
        continue;
      }

      const ipHash = metadata.ipHash || item.name.split(':').pop();
      if (ipHash) hashes.add(ipHash);
    }

    cursor = list.list_complete ? undefined : list.cursor;
    page += 1;
  } while (cursor && page < MAX_LIST_PAGES);

  await Promise.all(expiredKeys.slice(0, 50).map((key) => kv.delete(key)));
  return hashes.size;
}

async function presence(request, env) {
  if (!env.GODTIERPH_PRESENCE) {
    return jsonResponse(request, { error: 'Presence storage is not configured.' }, 500);
  }

  const now = Date.now();
  const body = request.method === 'POST' ? await readJson(request) : {};
  const sessionId = cleanSessionId(body.sessionId);
  const ip = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
  const salt = env.PRESENCE_SALT || 'godtierph-presence-v1';
  const ipHash = await hashValue(salt + ':' + ip);
  const key = 'presence:' + sessionId + ':' + ipHash;

  if (request.method === 'POST' && body.active === false) {
    await env.GODTIERPH_PRESENCE.delete(key);
  } else if (request.method === 'POST') {
    await env.GODTIERPH_PRESENCE.put(key, '1', {
      expirationTtl: ACTIVE_TTL_SECONDS,
      metadata: {
        ipHash,
        seen: now,
      },
    });
  }

  const online = await countActiveIpHashes(env.GODTIERPH_PRESENCE, now);

  return jsonResponse(request, {
    online: Math.max(online, request.method === 'POST' && body.active === false ? 0 : 1),
    ttl: ACTIVE_TTL_SECONDS,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (url.pathname !== '/api/presence') {
      return jsonResponse(request, { error: 'Not found' }, 404);
    }

    if (!['GET', 'POST'].includes(request.method)) {
      return jsonResponse(request, { error: 'Method not allowed' }, 405);
    }

    return presence(request, env);
  },
};
