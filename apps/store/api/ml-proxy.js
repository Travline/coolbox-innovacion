// Keep the session cookie on the storefront origin in Vercel.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, 'http://localhost');
  const route = url.pathname === '/api/ml-proxy'
    ? `/api/ml/${request.query?.ml_path ?? url.searchParams.get('ml_path') ?? ''}`
    : url.pathname;
  const match = /^\/api\/ml\/(login|logout|session|dashboard|active|runs(?:\/[a-f0-9-]{36})?)$/.exec(route);
  if (!match) return response.status(404).json({ detail: 'Ruta no encontrada' });
  if (!['GET', 'POST'].includes(request.method)) {
    return response.status(405).json({ detail: 'Método no permitido' });
  }
  const backend = process.env.ML_API_URL;
  if (!backend) return response.status(503).json({ detail: 'Servicio ML sin configurar' });

  const headers = new Headers();
  for (const name of ['origin', 'cookie', 'content-type']) {
    if (typeof request.headers[name] === 'string') headers.set(name, request.headers[name]);
  }
  url.searchParams.delete('ml_path');
  try {
    const body = request.method === 'POST' && request.body !== undefined
      ? typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      : undefined;
    const upstream = await fetch(new URL(route + url.search, backend), {
      method: request.method,
      headers,
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(75_000),
    });
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) response.setHeader('Set-Cookie', cookies);
    const contentType = upstream.headers.get('content-type') ?? '';
    if (upstream.status !== 204 && !contentType.includes('application/json')) {
      return response.status(503).json({ detail: 'Servicio ML temporalmente no disponible' });
    }
    if (contentType) response.setHeader('Content-Type', contentType);
    return response.status(upstream.status).send(await upstream.text());
  } catch {
    return response.status(503).json({ detail: 'Servicio ML temporalmente no disponible' });
  }
}
