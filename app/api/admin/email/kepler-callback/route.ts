import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminMiddleware';
import { getAppSettings } from '@/lib/db/getAppSettings';
import { publicAppOrigin } from '@/lib/meetings/publicOrigin';

function pickEmail(searchParams: URLSearchParams): string {
  const candidates = [
    'email',
    'user_email',
    'userEmail',
    'user_email_address',
  ];
  for (const key of candidates) {
    const v = searchParams.get(key);
    if (v && v.trim().includes('@')) {
      return v.trim();
    }
  }
  return '';
}

/**
 * Kepler redirects here after Google OAuth with the authorized Gmail in query params.
 */
export async function GET(request: NextRequest) {
  const origin = publicAppOrigin(request);
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/dashboard/admin/email?error=${code}`, origin));

  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const url = new URL(request.url);
  const email = pickEmail(url.searchParams);

  if (!email) {
    return fail('missing_email');
  }

  try {
    const settings = await getAppSettings();
    settings.keplerGmailEmail = email;
    settings.updatedAt = new Date();
    await settings.save();
  } catch (e) {
    console.error('Kepler callback save error:', e);
    return fail('save_failed');
  }

  return NextResponse.redirect(new URL('/dashboard/admin/email?connected=1', origin));
}
