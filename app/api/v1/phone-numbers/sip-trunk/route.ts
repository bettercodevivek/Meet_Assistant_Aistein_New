import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { createPhoneNumberInPythonAPI } from '@/lib/elevenlabs/pythonApi';
import { nanoid } from 'nanoid';

// POST create SIP trunk phone number
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const body = await request.json();
    const {
      label,
      phone_number,
      provider,
      supports_inbound,
      supports_outbound,
      inbound_trunk_config,
      outbound_trunk_config,
    } = body;

    console.log('[POST /api/v1/phone-numbers/sip-trunk] Request:', {
      userId: user.userId,
      payload: {
        label,
        phone_number,
        provider,
        supports_inbound,
        supports_outbound,
        inbound_trunk_config: inbound_trunk_config
          ? {
              address: inbound_trunk_config.address,
              media_encryption: inbound_trunk_config.media_encryption,
            }
          : undefined,
        outbound_trunk_config: outbound_trunk_config
          ? {
              address: outbound_trunk_config.address,
              media_encryption: outbound_trunk_config.media_encryption,
              transport: outbound_trunk_config.transport,
              credentials: outbound_trunk_config.credentials
                ? { username: '***', password: '***' }
                : undefined,
            }
          : undefined,
      },
    });

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Validation
    if (!label || !phone_number || provider !== 'sip_trunk') {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body'],
              msg: 'label, phone_number are required and provider must be sip_trunk',
              type: 'value_error',
            },
          ],
        },
        { status: 422 }
      );
    }

    if (supports_inbound && !inbound_trunk_config) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body'],
              msg: 'inbound_trunk_config is required when supports_inbound is true',
              type: 'value_error',
            },
          ],
        },
        { status: 422 }
      );
    }

    if (supports_outbound && !outbound_trunk_config) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body'],
              msg: 'outbound_trunk_config is required when supports_outbound is true',
              type: 'value_error',
            },
          ],
        },
        { status: 422 }
      );
    }

    const phone_number_id = `phnum_${nanoid(12)}`;
    const created_at_unix = Math.floor(Date.now() / 1000);

    // Create phone number locally first
    const phoneNumber = await PhoneNumber.create({
      userId: userOid,
      phone_number_id,
      label,
      phone_number,
      provider: 'sip_trunk',
      supports_inbound: supports_inbound || false,
      supports_outbound: supports_outbound || true,
      inbound_trunk_config,
      outbound_trunk_config,
      created_at_unix,
    });

    // Register with Python API to get ElevenLabs ID
    try {
      const pythonApiResponse = await createPhoneNumberInPythonAPI({
        phone_number,
        provider: 'sip_trunk',
        supports_outbound: supports_outbound || true,
        supports_inbound: supports_inbound || false,
        label,
        inbound_trunk_config,
        outbound_trunk_config,
      });
      // Update local record with ElevenLabs ID
      phoneNumber.elevenlabs_phone_number_id = pythonApiResponse.phone_number_id;
      await phoneNumber.save();
      console.log('[POST /api/v1/phone-numbers/sip-trunk] Registered with Python API, ID:', pythonApiResponse.phone_number_id);
    } catch (pythonApiError) {
      console.error('[POST /api/v1/phone-numbers/sip-trunk] Failed to register with Python API (phone number created but not registered):', pythonApiError);
      // Phone number is created locally but not registered - won't work for batch calling
    }

    return NextResponse.json(
      {
        phone_number_id: phoneNumber.phone_number_id,
        elevenlabs_phone_number_id: phoneNumber.elevenlabs_phone_number_id || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create SIP trunk phone number error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
