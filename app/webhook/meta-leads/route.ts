import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getMetaLeadsService } from '@/lib/metaLeads/getMetaLeadsService';
import { routeLogger } from '@/lib/metaLeads/routeLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expected = process.env.META_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && expected && token === expected && challenge) {
    routeLogger.info({ msg: 'meta_webhook_verify_ok' });
    return new NextResponse(challenge, { status: 200 });
  }
  routeLogger.warn({ msg: 'meta_webhook_verify_failed' });
  return new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    routeLogger.warn({ msg: 'meta_app_secret_missing' });
    return new NextResponse('Not configured', { status: 503 });
  }
  const { verifyMetaSignature, processWebhookBody } = await getMetaLeadsService();
  const rawBuffer = Buffer.from(await request.arrayBuffer());
  const sig = request.headers.get('x-hub-signature-256');
  if (!verifyMetaSignature(sig, rawBuffer, secret)) {
    routeLogger.warn({ msg: 'meta_webhook_invalid_signature' });
    return new NextResponse('Forbidden', { status: 403 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBuffer.toString('utf8'));
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
  routeLogger.info({ msg: 'meta_webhook_received' });
  after(() =>
    processWebhookBody(body).catch((e: unknown) => {
      routeLogger.error({ msg: 'meta_webhook_process_error', err: String(e) });
    }),
  );
  return new NextResponse('EVENT_RECEIVED', { status: 200 });
}
