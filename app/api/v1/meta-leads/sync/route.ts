import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getMetaLeadsService } from '@/lib/metaLeads/getMetaLeadsService';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    await connectDB();
    const { runPeriodicLeadSync } = await getMetaLeadsService();
    const result = (await runPeriodicLeadSync()) as { forms: number };
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
