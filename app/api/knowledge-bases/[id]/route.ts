import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';

// GET single knowledge base
export async function GET(
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
        { status: 401 },
      );
    }

    const knowledgeBase = await KnowledgeBase.findOne({
      _id: id,
      userId: userOid,
    });
    
    if (!knowledgeBase) {
      return NextResponse.json(
        { success: false, message: 'Knowledge base not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      knowledgeBase: {
        id: String(knowledgeBase._id),
        name: knowledgeBase.name,
        prompt: knowledgeBase.prompt,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get knowledge base error:', error);
    
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

// PUT update knowledge base
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    await connectDB();
    
    const { id } = await params;
    const { name, prompt } = await request.json();

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const nameTrim = typeof name === 'string' ? name.trim() : '';
    const promptTrim = typeof prompt === 'string' ? prompt.trim() : '';
    const knowledgeBase = await KnowledgeBase.findOneAndUpdate(
      { _id: id, userId: userOid },
      {
        ...(nameTrim ? { name: nameTrim } : {}),
        ...(promptTrim ? { prompt: promptTrim } : {}),
        updatedAt: new Date(),
      },
      { new: true },
    );
    
    if (!knowledgeBase) {
      return NextResponse.json(
        { success: false, message: 'Knowledge base not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      knowledgeBase: {
        id: String(knowledgeBase._id),
        name: knowledgeBase.name,
        prompt: knowledgeBase.prompt,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update knowledge base error:', error);
    
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

// DELETE knowledge base
export async function DELETE(
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
        { status: 401 },
      );
    }

    const knowledgeBase = await KnowledgeBase.findOneAndDelete({
      _id: id,
      userId: userOid,
    });
    
    if (!knowledgeBase) {
      return NextResponse.json(
        { success: false, message: 'Knowledge base not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge base deleted successfully',
    });
  } catch (error) {
    console.error('Delete knowledge base error:', error);
    
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

