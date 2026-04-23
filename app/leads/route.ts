import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { getMetaLeadsService } from '@/lib/metaLeads/getMetaLeadsService';
import { routeLogger } from '@/lib/metaLeads/routeLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { listLeads } = await getMetaLeadsService();
    const { searchParams } = new URL(request.url);
    const result = await listLeads({
      form_id: searchParams.get('form_id') || undefined,
      created_time_from: searchParams.get('created_time_from') || undefined,
      created_time_to: searchParams.get('created_time_to') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    routeLogger.error({ msg: 'leads_list_error', err: String(e) });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
