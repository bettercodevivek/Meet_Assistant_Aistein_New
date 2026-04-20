import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { registerPhoneNumberWithElevenLabs } from '@/lib/elevenlabs/pythonApi';

// POST register phone number with ElevenLabs
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phone_number_id: string }> }
) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const { phone_number_id } = await params;

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    const phoneNumber = await PhoneNumber.findOne({
      phone_number_id,
      userId: userOid,
    });

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Phone number not found',
          },
        },
        { status: 404 }
      );
    }

    if (!phoneNumber.supports_outbound) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: 'Phone number must support outbound calls to register with ElevenLabs',
          },
        },
        { status: 400 }
      );
    }

    // Register with ElevenLabs via Python API
    const response = await registerPhoneNumberWithElevenLabs(phone_number_id);

    // Update local record with ElevenLabs phone number ID
    phoneNumber.elevenlabs_phone_number_id = response.elevenlabs_phone_number_id;
    await phoneNumber.save();

    return NextResponse.json({
      success: true,
      message: 'Phone number registered successfully with ElevenLabs',
      data: {
        phone_number_id: phoneNumber.phone_number_id,
        elevenlabs_phone_number_id: phoneNumber.elevenlabs_phone_number_id,
      },
    });
  } catch (error) {
    console.error('Register phone number error:', error);

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
