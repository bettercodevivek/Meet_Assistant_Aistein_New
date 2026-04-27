import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getMetaLeadsService } from '@/lib/metaLeads/getMetaLeadsService';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    await connectDB();
    const { getPeriodicSyncStatus } = await getMetaLeadsService();
    const status = await getPeriodicSyncStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
