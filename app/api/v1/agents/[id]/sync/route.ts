import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Agent from '@/lib/db/models/Agent';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { syncAgentToElevenLabs } from '@/lib/elevenlabs/pythonApi';

// POST sync agent to ElevenLabs
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const { id } = await params;

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Find agent by agent_id (params.id is the agent_id from Python API)
    const agent = await Agent.findOne({
      agent_id: id,
      userId: userOid,
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        },
        { status: 404 }
      );
    }

    // Sync to ElevenLabs via Python API
    await syncAgentToElevenLabs(id);

    return NextResponse.json({
      success: true,
      message: 'Agent synced successfully to ElevenLabs',
      data: {
        synced: true,
      },
    });
  } catch (error) {
    console.error('Sync agent error:', error);

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
