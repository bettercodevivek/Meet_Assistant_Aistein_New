import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Agent from '@/lib/db/models/Agent';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import mongoose from 'mongoose';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { createAgentInPythonAPI, syncAgentToElevenLabs } from '@/lib/elevenlabs/pythonApi';
import { resolveVoiceKnowledgeBaseIdsForAgent } from '@/lib/services/knowledgeBaseIngestion';

// GET all agents
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

    const agents = await Agent.find({ userId: userOid }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: agents.map((agent) => ({
        _id: String(agent._id),
        userId: String(agent.userId),
        agent_id: agent.agent_id,
        name: agent.name,
        first_message: agent.first_message,
        system_prompt: agent.system_prompt,
        language: agent.language,
        voice_id: agent.voice_id,
        knowledge_base_ids: agent.knowledge_base_ids,
        mongoKnowledgeBaseIds: agent.mongoKnowledgeBaseIds ?? [],
        tool_ids: agent.tool_ids,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get agents error:', error);

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

// POST create new agent
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const body = await request.json();
    const {
      name,
      first_message,
      system_prompt,
      language,
      voice_id,
      mongoKnowledgeBaseIds,
    } = body;

    console.log('[POST /api/v1/agents] Request:', {
      userId: user.userId,
      payload: { name, language, voice_id, mongoKnowledgeBaseIds },
    });

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Validation
    if (!name || !first_message || !system_prompt || !language) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name, first_message, system_prompt, and language are required',
          },
        },
        { status: 400 }
      );
    }

    const mongoIds: string[] = Array.isArray(mongoKnowledgeBaseIds)
      ? mongoKnowledgeBaseIds.filter((id: unknown) => typeof id === 'string' && id.trim())
      : [];

    let mergedSystemPrompt = typeof system_prompt === 'string' ? system_prompt.trim() : '';
    if (mongoIds.length > 0) {
      const oids = mongoIds
        .map((id) => {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch {
            return null;
          }
        })
        .filter((x): x is mongoose.Types.ObjectId => x !== null);
      const kbs = await KnowledgeBase.find({
        _id: { $in: oids },
        userId: userOid,
      }).sort({ name: 1 });
      for (const kb of kbs) {
        const block = kb.prompt?.trim();
        if (!block) continue;
        mergedSystemPrompt += `\n\n## Knowledge: ${kb.name}\n${block}`;
      }
    }

    const voiceKnowledgeBaseIds = await resolveVoiceKnowledgeBaseIdsForAgent(userOid, mongoIds);

    // Create agent in Python API first (to get the correct agent_id)
    let pythonApiAgentId: string;
    try {
      const pythonApiResponse = await createAgentInPythonAPI({
        name,
        first_message,
        system_prompt: mergedSystemPrompt,
        language,
        voice_id: voice_id || 'eleven_multilingual_v2',
        knowledge_base_ids: voiceKnowledgeBaseIds,
      });
      pythonApiAgentId = pythonApiResponse.agent_id;
      console.log('[POST /api/v1/agents] Python API agent_id:', pythonApiAgentId);
    } catch (pythonApiError) {
      console.error('Python API error:', pythonApiError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PYTHON_API_ERROR',
            message: 'Failed to create agent in ElevenLabs. Please try again.',
          },
        },
        { status: 502 }
      );
    }

    // Create agent in local database with Python API's agent_id
    const agent = await Agent.create({
      userId: userOid,
      agent_id: pythonApiAgentId,
      name,
      first_message,
      system_prompt: mergedSystemPrompt,
      language,
      voice_id: voice_id || 'eleven_multilingual_v2',
      greeting_message: first_message,
      escalationRules: [],
      knowledge_base_ids: voiceKnowledgeBaseIds,
      mongoKnowledgeBaseIds: mongoIds,
      tool_ids: [],
    });

    // Auto-sync agent to ElevenLabs
    try {
      await syncAgentToElevenLabs(pythonApiAgentId);
      console.log('[POST /api/v1/agents] Agent synced to ElevenLabs:', pythonApiAgentId);
    } catch (syncError) {
      console.error('[POST /api/v1/agents] Sync failed (agent created but not synced):', syncError);
      // Agent is created, just not synced - don't fail the request
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Agent created successfully',
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
          mongoKnowledgeBaseIds: agent.mongoKnowledgeBaseIds ?? [],
          tool_ids: agent.tool_ids,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create agent error:', error);

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
