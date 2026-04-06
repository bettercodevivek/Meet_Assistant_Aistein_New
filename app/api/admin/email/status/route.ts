import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminMiddleware';
import { getAppSettings } from '@/lib/db/getAppSettings';
import { keplerEmailApiBaseUrl } from '@/lib/email/keplerEmailClient';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const settings = await getAppSettings();
    const email = (settings.keplerGmailEmail || '').trim();
    return NextResponse.json({
      success: true,
      connected: Boolean(email && email.includes('@')),
      email: email || null,
      keplerApiConfigured: Boolean(keplerEmailApiBaseUrl()),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 },
      );
    }
    console.error('Admin email status error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
