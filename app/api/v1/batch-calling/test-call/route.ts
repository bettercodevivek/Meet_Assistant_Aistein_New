import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Agent from '@/lib/db/models/Agent';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { submitBatchCall } from '@/lib/elevenlabs/pythonApi';

// POST test call - submit a single-call batch for testing
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const { agent_id, phone_number_id, phone_number, customer_name, email } =
      await request.json();

    console.log('[POST /api/v1/batch-calling/test-call] Request:', {
      userId: user.userId,
      agent_id,
      phone_number_id,
      phone_number,
      customer_name,
    });

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    if (!agent_id || !phone_number_id || !phone_number) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'agent_id, phone_number_id, and phone_number are required',
          },
        },
        { status: 422 }
      );
    }

    // Validate agent exists
    const agent = await Agent.findOne({ agent_id, userId: userOid });
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Agent not found' },
        },
        { status: 404 }
      );
    }

    // Validate phone number exists
    const phoneNumber = await PhoneNumber.findOne({
      phone_number_id,
      userId: userOid,
    });
    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Phone number not found' },
        },
        { status: 404 }
      );
    }

    // Use elevenlabs_phone_number_id if available, otherwise use local phone_number_id
    const effectivePhoneNumberId = phoneNumber.elevenlabs_phone_number_id || phone_number_id;

    // Submit a single-recipient batch call as a test
    const pythonApiResponse = await submitBatchCall({
      agent_id,
      call_name: `Test call - ${customer_name || phone_number}`,
      phone_number_id: effectivePhoneNumberId,
      recipients: [
        {
          phone_number,
          name: customer_name || 'Test',
          email: email || undefined,
        },
      ],
    });

    console.log('[POST /api/v1/batch-calling/test-call] Python API Response:', pythonApiResponse);

    return NextResponse.json({
      success: true,
      message: 'Test call initiated successfully',
      data: pythonApiResponse,
    });
  } catch (error) {
    console.error('Test call error:', error);

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
