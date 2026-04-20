import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Automation from '@/lib/db/models/Automation';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid automation id' },
        { status: 400 },
      );
    }

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name, description, trigger, actions, isActive } = body as {
      name?: string;
      description?: string;
      trigger?: { type?: string };
      actions?: Array<{ type: string; config: Record<string, unknown> }>;
      isActive?: boolean;
    };

    const update: Record<string, unknown> = {};
    if (typeof name === 'string') {
      const t = name.trim();
      if (!t) {
        return NextResponse.json(
          { success: false, message: 'Automation name cannot be empty' },
          { status: 400 },
        );
      }
      update.name = t;
    }
    if (typeof description === 'string') {
      update.description = description.trim();
    }
    if (trigger !== undefined && typeof trigger === 'object' && trigger !== null) {
      update.trigger = trigger;
    }
    if (Array.isArray(actions)) {
      update.actions = actions;
    }
    if (typeof isActive === 'boolean') {
      update.isActive = isActive;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid fields to update' },
        { status: 400 },
      );
    }

    const doc = await Automation.findOneAndUpdate(
      { _id: id, userId: userOid },
      { $set: update },
      { new: true },
    );

    if (!doc) {
      return NextResponse.json(
        { success: false, message: 'Automation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error('Patch automation error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid automation id' },
        { status: 400 },
      );
    }

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const deleted = await Automation.findOneAndDelete({
      _id: id,
      userId: userOid,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Automation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete automation error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
