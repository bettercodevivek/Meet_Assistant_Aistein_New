import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminMiddleware';
import { getAppSettings } from '@/lib/db/getAppSettings';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const settings = await getAppSettings();
    settings.keplerGmailEmail = '';
    settings.updatedAt = new Date();
    await settings.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 },
      );
    }
    console.error('Admin email disconnect error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
