import { NextRequest } from 'next/server';

/**
 * Public origin for share links, OAuth redirects, and invite emails.
 *
 * On localhost / loopback, always uses the **incoming request** origin so the port
 * matches the browser (avites `NEXT_PUBLIC_APP_URL` pointing at :3001 while the app runs on :3000).
 * In production, prefers `NEXT_PUBLIC_APP_URL` when set (canonical public URL).
 */
export function publicAppOrigin(request: NextRequest): string {
  const u = new URL(request.url);
  const requestOrigin = `${u.protocol}//${u.host}`;

  const host = u.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]';

  if (isLoopback) {
    return requestOrigin;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }

  return requestOrigin;
}

export function meetingShareUrl(origin: string, meetingId: string): string {
  return `${origin.replace(/\/$/, '')}/meet/${meetingId}`;
}
