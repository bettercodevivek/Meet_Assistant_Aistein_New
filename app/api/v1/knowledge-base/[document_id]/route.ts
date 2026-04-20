import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getDocument, deleteDocument } from '@/lib/elevenlabs/pythonApi';
import VoiceKnowledgeBaseDocument from '@/lib/db/models/VoiceKnowledgeBaseDocument';

// GET document by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ document_id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { document_id } = await params;

    // Check if document belongs to user
    const localDoc = await VoiceKnowledgeBaseDocument.findOne({
      document_id,
      userId: user.userId,
    });

    if (!localDoc) {
      return NextResponse.json(
        { success: false, message: 'Document not found' },
        { status: 404 }
      );
    }

    const response = await getDocument(document_id);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get document error:', error);

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

// DELETE document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ document_id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { document_id } = await params;

    console.log('[DELETE /api/v1/knowledge-base/[document_id]] Request:', {
      userId: user.userId,
      document_id,
    });

    // Check if document belongs to user
    const localDoc = await VoiceKnowledgeBaseDocument.findOne({
      document_id,
      userId: user.userId,
    });

    if (!localDoc) {
      return NextResponse.json(
        { success: false, message: 'Document not found' },
        { status: 404 }
      );
    }

    const response = await deleteDocument(document_id);

    console.log('[DELETE /api/v1/knowledge-base/[document_id]] Python API Response:', response);

    // Delete from local database
    await VoiceKnowledgeBaseDocument.deleteOne({ document_id, userId: user.userId });

    console.log('[DELETE /api/v1/knowledge-base/[document_id]] Final Response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Delete document error:', error);

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
