import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  listKnowledgeBaseDocuments,
  ingestDocument,
} from '@/lib/elevenlabs/pythonApi';
import VoiceKnowledgeBaseDocument from '@/lib/db/models/VoiceKnowledgeBaseDocument';
import mongoose from 'mongoose';

// GET list documents
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor') || undefined;
    const page_size = searchParams.get('page_size')
      ? parseInt(searchParams.get('page_size')!)
      : undefined;

    console.log('[GET /api/v1/knowledge-base] Request:', {
      userId: user.userId,
      cursor,
      page_size,
    });

    // Fetch from local database filtered by user ID
    const documents = await VoiceKnowledgeBaseDocument.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .limit(page_size || 50);

    const response = {
      documents: documents.map((doc) => ({
        document_id: doc.document_id,
        name: doc.name,
        source_type: doc.source_type,
        status: doc.status,
        created_at_unix: doc.created_at_unix,
        folder_path: doc.folder_path,
        prompt: doc.prompt,
        firstMessage: doc.firstMessage,
        mongoKnowledgeBaseId: doc.mongoKnowledgeBaseId,
      })),
    };

    console.log('[GET /api/v1/knowledge-base] Response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('List knowledge base documents error:', error);

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

// POST ingest document (unified)
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const firstMessage = formData.get('firstMessage') as string;
    const mongoKnowledgeBaseId = formData.get('mongo_knowledge_base_id') as string;

    const payload = {
      source_type: formData.get('source_type'),
      name: formData.get('name'),
      prompt,
      firstMessage,
    };

    console.log('[POST /api/v1/knowledge-base] Request:', {
      userId: user.userId,
      payload,
    });

    const response = await ingestDocument(formData);

    console.log('[POST /api/v1/knowledge-base] Python API Response:', response);

    // Save document to local database with user ID
    if (response.document_id && response.name) {
      await VoiceKnowledgeBaseDocument.create({
        userId: user.userId,
        document_id: response.document_id,
        name: response.name,
        source_type: (formData.get('source_type') as string) || 'text',
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

    console.log('[POST /api/v1/knowledge-base] Final Response:', response);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Ingest document error:', error);

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
