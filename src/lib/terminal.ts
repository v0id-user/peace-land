// Requests from command-line HTTP clients get plain text instead of HTML.
const TERMINAL_UA = /^(curl|wget|httpie|xh)\//i;

export function isTerminal(request: Request): boolean {
  return TERMINAL_UA.test(request.headers.get('user-agent') ?? '');
}

export function text(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache');
  return new Response(body, { ...init, headers });
}
