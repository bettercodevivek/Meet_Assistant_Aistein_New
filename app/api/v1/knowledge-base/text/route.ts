import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  listKnowledgeBaseDocuments,
  ingestDocument,
} from '@/lib/elevenlabs/pythonApi';
import VoiceKnowledgeBaseDocument from '@/lib/db/models/VoiceKnowledgeBaseDocument';

// POST create document from text
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const body = await request.json();
    const {
      name,
      text,
      prompt,
      firstMessage,
      parent_folder_id,
      mongo_knowledge_base_id,
    } = body;

    console.log('[POST /api/v1/knowledge-base/text] Request:', {
      userId: user.userId,
      payload: { name, prompt, firstMessage, parent_folder_id },
    });

    if (!name || !text) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name and text are required',
          },
        },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append('source_type', 'text');
    formData.append('name', name);
    formData.append('text', text);
    if (prompt) formData.append('prompt', prompt);
    if (firstMessage) formData.append('firstMessage', firstMessage);
    if (parent_folder_id) {
      formData.append('parent_folder_id', parent_folder_id);
    }

    const response = await ingestDocument(formData);

    console.log('[POST /api/v1/knowledge-base/text] Python API Response:', response);

    // Save document to local database with user ID
    if (response.document_id && response.name) {
      await VoiceKnowledgeBaseDocument.create({
        userId: user.userId,
        document_id: response.document_id,
        name: response.name,
        source_type: 'text',
        status: response.status,
        created_at_unix: response.created_at_unix,
        folder_path: response.folder_path || [],
        prompt,
        firstMessage,
        mongoKnowledgeBaseId:
          typeof mongo_knowledge_base_id === 'string' && mongo_knowledge_base_id.trim()
            ? mongo_knowledge_base_id.trim()
            : undefined,
      });
    }

    console.log('[POST /api/v1/knowledge-base/text] Final Response:', response);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create document from text error:', error);

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
