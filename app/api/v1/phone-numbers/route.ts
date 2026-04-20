import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { listPhoneNumbers, createPhoneNumberInPythonAPI } from '@/lib/elevenlabs/pythonApi';
import { nanoid } from 'nanoid';

// GET list phone numbers
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Get from local database
    const phoneNumbers = await PhoneNumber.find({ userId: userOid }).sort({
      createdAt: -1,
    });

    console.log('[GET /api/v1/phone-numbers] Response:', {
      count: phoneNumbers.length,
      phone_numbers: phoneNumbers.map((pn) => ({
        phone_number_id: pn.phone_number_id,
        label: pn.label,
        phone_number: pn.phone_number,
        provider: pn.provider,
        elevenlabs_phone_number_id: pn.elevenlabs_phone_number_id,
      })),
    });

    return NextResponse.json({
      phone_numbers: phoneNumbers.map((pn) => ({
        phone_number_id: pn.phone_number_id,
        label: pn.label,
        phone_number: pn.phone_number,
        provider: pn.provider,
        supports_outbound: pn.supports_outbound,
        supports_inbound: pn.supports_inbound,
        elevenlabs_phone_number_id: pn.elevenlabs_phone_number_id,
        created_at_unix: pn.created_at_unix,
        agent_id: pn.agent_id,
      })),
    });
  } catch (error) {
    console.error('List phone numbers error:', error);

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

// POST create phone number (Twilio)
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const body = await request.json();
    const { label, phone_number, sid, token } = body;

    console.log('[POST /api/v1/phone-numbers] Request:', {
      userId: user.userId,
      payload: { label, phone_number, sid: sid ? '***' : undefined },
    });

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Validation
    if (!label || !phone_number || !sid || !token) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body'],
              msg: 'label, phone_number, sid, and token are required',
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
      provider: 'twilio',
      supports_inbound: false,
      supports_outbound: true,
      twilio_sid: sid,
      twilio_token: token,
      created_at_unix,
    });

    // Register with Python API to get ElevenLabs ID
    try {
      const pythonApiResponse = await createPhoneNumberInPythonAPI({
        phone_number,
        provider: 'twilio',
        supports_outbound: true,
        supports_inbound: false,
        label,
        sid,
        token,
      });
      // Update local record with ElevenLabs ID
      phoneNumber.elevenlabs_phone_number_id = pythonApiResponse.phone_number_id;
      await phoneNumber.save();
      console.log('[POST /api/v1/phone-numbers] Registered with ElevenLabs, ID:', pythonApiResponse.phone_number_id);
    } catch (pythonApiError) {
      console.error('[POST /api/v1/phone-numbers] Failed to register with Python API (phone number created but not registered):', pythonApiError);
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
    console.error('Create phone number error:', error);

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
