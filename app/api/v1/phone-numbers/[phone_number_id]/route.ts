import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { getPhoneNumber } from '@/lib/elevenlabs/pythonApi';

// GET phone number by ID
export async function GET(
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

    return NextResponse.json({
      phone_number_id: phoneNumber.phone_number_id,
      phone_number: phoneNumber.phone_number,
      label: phoneNumber.label,
      provider: phoneNumber.provider,
      created_at_unix: phoneNumber.created_at_unix,
      supports_inbound: phoneNumber.supports_inbound,
      supports_outbound: phoneNumber.supports_outbound,
      elevenlabs_phone_number_id: phoneNumber.elevenlabs_phone_number_id,
      agent_id: phoneNumber.agent_id,
    });
  } catch (error) {
    console.error('Get phone number error:', error);

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

// PATCH update phone number
export async function PATCH(
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

    const {
      label,
      agent_id,
      supports_inbound,
      supports_outbound,
      inbound_trunk_config,
      outbound_trunk_config,
    } = await request.json();

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

    if (label !== undefined) phoneNumber.label = label;
    if (agent_id !== undefined) phoneNumber.agent_id = agent_id;
    if (supports_inbound !== undefined) phoneNumber.supports_inbound = supports_inbound;
    if (supports_outbound !== undefined) phoneNumber.supports_outbound = supports_outbound;
    if (inbound_trunk_config !== undefined) phoneNumber.inbound_trunk_config = inbound_trunk_config;
    if (outbound_trunk_config !== undefined) phoneNumber.outbound_trunk_config = outbound_trunk_config;
    phoneNumber.updatedAt = new Date();

    await phoneNumber.save();

    return NextResponse.json({
      success: true,
      message: 'Phone number updated successfully',
      data: {
        phone_number_id: phoneNumber.phone_number_id,
        label: phoneNumber.label,
        phone_number: phoneNumber.phone_number,
        agent_id: phoneNumber.agent_id,
        supports_inbound: phoneNumber.supports_inbound,
        supports_outbound: phoneNumber.supports_outbound,
      },
    });
  } catch (error) {
    console.error('Update phone number error:', error);

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

// DELETE phone number
export async function DELETE(
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

    const phoneNumber = await PhoneNumber.findOneAndDelete({
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

    return NextResponse.json({
      success: true,
      message: 'Phone number deleted successfully',
    });
  } catch (error) {
    console.error('Delete phone number error:', error);

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
