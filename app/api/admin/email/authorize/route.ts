import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminMiddleware';
import { keplerEmailApiBaseUrl } from '@/lib/email/keplerEmailClient';
import { publicAppOrigin } from '@/lib/meetings/publicOrigin';

/**
 * Redirects admin to Kepler Gmail OAuth. After success, Kepler redirects to
 * `/api/admin/email/kepler-callback` with the authorized email in query params.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const base = keplerEmailApiBaseUrl();
    if (!base) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/admin/email?error=kepler_not_configured',
          publicAppOrigin(request),
        ),
      );
    }

    const origin = publicAppOrigin(request);
    const callbackUrl = `${origin}/api/admin/email/kepler-callback`;
    const authorizeUrl = `${base}/email/authorize?redirect_url=${encodeURIComponent(callbackUrl)}`;

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    console.error('Admin email authorize error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/admin/email?error=authorize_failed', request.url),
    );
  }
}
