import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Agent from '@/lib/db/models/Agent';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { updateAgentPromptInPythonAPI } from '@/lib/elevenlabs/pythonApi';

// PATCH update agent prompt
export async function PATCH(
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

    const {
      first_message,
      system_prompt,
      language,
      voice_id,
      greeting_message,
      escalationRules,
      knowledge_base_ids,
    } = await request.json();

    // Validation
    if (!first_message || !system_prompt || !language) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'first_message, system_prompt, and language are required',
          },
        },
        { status: 400 }
      );
    }

    if (!knowledge_base_ids || !Array.isArray(knowledge_base_ids)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'knowledge_base_ids is required and must be an array',
          },
        },
        { status: 400 }
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

    // Update in Python API
    try {
      await updateAgentPromptInPythonAPI(id, {
        first_message,
        system_prompt,
        language,
        voice_id: voice_id || agent.voice_id,
        greeting_message,
        escalationRules,
        knowledge_base_ids,
      });
    } catch (pythonApiError) {
      console.error('Python API error:', pythonApiError);
      // Continue with local update even if Python API fails
    }

    // Update in local database
    agent.first_message = first_message;
    agent.system_prompt = system_prompt;
    agent.language = language;
    if (voice_id) agent.voice_id = voice_id;
    if (greeting_message) agent.greeting_message = greeting_message;
    if (escalationRules) agent.escalationRules = escalationRules;
    agent.knowledge_base_ids = knowledge_base_ids;
    agent.updatedAt = new Date();

    await agent.save();

    return NextResponse.json({
      success: true,
      message: 'Agent prompt updated successfully',
      data: {
        _id: String(agent._id),
        userId: String(agent.userId),
        agent_id: agent.agent_id,
        name: agent.name,
        first_message: agent.first_message,
        system_prompt: agent.system_prompt,
        language: agent.language,
        voice_id: agent.voice_id,
        greeting_message: agent.greeting_message,
        escalationRules: agent.escalationRules,
        knowledge_base_ids: agent.knowledge_base_ids,
        tool_ids: agent.tool_ids,
        updatedAt: agent.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update agent prompt error:', error);

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
