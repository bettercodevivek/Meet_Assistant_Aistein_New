import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { getMetaLeadsService } from '@/lib/metaLeads/getMetaLeadsService';

function authorizeCron(request: NextRequest): boolean | 'missing_secret' {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return 'missing_secret';
  }
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) {
    return true;
  }
  return request.headers.get('x-cron-secret') === secret;
}

async function runMetaLeadsSync() {
  await connectDB();
  const { runPeriodicLeadSync } = await getMetaLeadsService();
  return runPeriodicLeadSync();
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  try {
    const auth = authorizeCron(request);
    if (auth === 'missing_secret') {
      return NextResponse.json(
        { success: false, message: 'CRON_SECRET is not configured' },
        { status: 503 },
      );
    }
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const result = (await runMetaLeadsSync()) as { forms: number };
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
