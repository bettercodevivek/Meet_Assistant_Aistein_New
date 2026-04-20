import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Automation from '@/lib/db/models/Automation';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';

// GET all automations
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const automations = await Automation.find({ userId: userOid })
      .sort({ createdAt: -1 });
    
    return NextResponse.json({
      success: true,
      data: automations,
    });
  } catch (error) {
    console.error('Get automations error:', error);
    
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

// POST create new automation
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    
    const { name, description, trigger, actions } = await request.json();

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const nameTrim = typeof name === 'string' ? name.trim() : '';
    if (!nameTrim) {
      return NextResponse.json(
        { success: false, message: 'Automation name is required' },
        { status: 400 }
      );
    }

    const automation = await Automation.create({
      userId: userOid,
      name: nameTrim,
      description: description?.trim() || '',
      trigger: trigger || { type: 'batch_call_completed' },
      actions: actions || [],
      isActive: true,
    });
    
    return NextResponse.json({
      success: true,
      data: automation,
    });
  } catch (error) {
    console.error('Create automation error:', error);
    
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
