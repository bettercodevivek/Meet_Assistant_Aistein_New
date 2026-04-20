import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  listKnowledgeBaseDocuments,
  ingestDocument,
} from '@/lib/elevenlabs/pythonApi';
import VoiceKnowledgeBaseDocument from '@/lib/db/models/VoiceKnowledgeBaseDocument';

// POST create document from file
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const firstMessage = formData.get('firstMessage') as string;
    const mongoKnowledgeBaseId = formData.get('mongo_knowledge_base_id') as string;
    const fileName = formData.get('file') as File;

    console.log('[POST /api/v1/knowledge-base/file] Request:', {
      userId: user.userId,
      payload: {
        fileName: fileName?.name,
        prompt,
        firstMessage,
      },
    });

    const response = await ingestDocument(formData);

    console.log('[POST /api/v1/knowledge-base/file] Python API Response:', response);

    // Save document to local database with user ID
    if (response.document_id && response.name) {
      await VoiceKnowledgeBaseDocument.create({
        userId: user.userId,
        document_id: response.document_id,
        name: response.name,
        source_type: 'file',
        status: response.status,
        created_at_unix: response.created_at_unix,
        folder_path: response.folder_path || [],
        prompt,
        firstMessage,
        mongoKnowledgeBaseId:
          typeof mongoKnowledgeBaseId === 'string' && mongoKnowledgeBaseId.trim()
            ? mongoKnowledgeBaseId.trim()
            : undefined,
      });
    }

    console.log('[POST /api/v1/knowledge-base/file] Final Response:', response);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create file document error:', error);

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
