// Cloudflare Pages Function: forwards /api/* to the Render backend.
// Browsers then only talk to the pages.dev address, so networks that fail to
// resolve or block *.onrender.com still work, and CORS is not needed.
// Optional env vars (Pages > Settings > Variables and Secrets):
//   API_ORIGIN    default https://buhostelsapi.onrender.com
//   PROXY_SECRET  same value as on Render, so the backend can see each visitor's real IP
const DEFAULT_ORIGIN = 'https://buhostelsapi.onrender.com';
const DROP = ['host', 'origin', 'referer', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'x-proxy-secret', 'x-client-ip'];

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const target = String(env.API_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, '') + url.pathname + url.search;

  const headers = new Headers(request.headers);
  DROP.forEach((h) => headers.delete(h));
  const ip = request.headers.get('cf-connecting-ip');
  if (env.PROXY_SECRET && ip) {
    headers.set('x-proxy-secret', env.PROXY_SECRET);
    headers.set('x-client-ip', ip);
  }

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

  try {
    const res = await fetch(target, init);
    return new Response(res.body, res);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'The server is waking up or unreachable. Please try again in a moment.' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
