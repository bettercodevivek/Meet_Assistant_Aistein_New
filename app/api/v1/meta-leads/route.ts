import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { getMetaLeadsService } from '@/lib/metaLeads/getMetaLeadsService';
import BatchCall from '@/lib/db/models/BatchCall';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function getLeadPhone(data: unknown): string {
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const fromPhoneNumber = obj.phone_number;
  if (typeof fromPhoneNumber === 'string' && fromPhoneNumber.trim()) return fromPhoneNumber.trim();
  const fromPhone = obj.phone;
  if (typeof fromPhone === 'string' && fromPhone.trim()) return fromPhone.trim();
  return '';
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }
    const { listLeads } = await getMetaLeadsService();
    const { searchParams } = new URL(request.url);
    const result = (await listLeads({
      form_id: searchParams.get('form_id') || undefined,
      created_time_from: searchParams.get('created_time_from') || undefined,
      created_time_to: searchParams.get('created_time_to') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })) as {
      data?: Array<Record<string, unknown>>;
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
    };

    const rows = Array.isArray(result.data) ? result.data : [];
    const phones = rows.map((row) => getLeadPhone(row.data)).filter(Boolean);
    const uniquePhones = Array.from(new Set(phones));
    const phoneSet = new Set<string>();

    if (uniquePhones.length > 0) {
      const normalizedPhones = uniquePhones.map((p) => normalizePhone(p)).filter(Boolean);
      const batchCalls = await BatchCall.find({
        userId: userOid,
        $or: [
          { 'recipients.phone_number': { $in: uniquePhones } },
          { 'recipients.phone_number': { $in: normalizedPhones } },
        ],
      })
        .select('recipients.phone_number')
        .lean();

      for (const batch of batchCalls) {
        const recipients = Array.isArray(batch?.recipients) ? batch.recipients : [];
        for (const recipient of recipients) {
          const raw = typeof recipient?.phone_number === 'string' ? recipient.phone_number.trim() : '';
          if (!raw) continue;
          phoneSet.add(raw);
          const normalized = normalizePhone(raw);
          if (normalized) phoneSet.add(normalized);
        }
      }
    }

    const dataWithTags = rows.map((row) => {
      const rawPhone = getLeadPhone(row.data);
      const normalizedPhone = normalizePhone(rawPhone);
      const batch_submitted =
        (rawPhone && phoneSet.has(rawPhone)) ||
        (normalizedPhone && phoneSet.has(normalizedPhone)) ||
        false;
      return {
        ...row,
        batch_submitted,
      };
    });

    return NextResponse.json({ success: true, ...result, data: dataWithTags });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
