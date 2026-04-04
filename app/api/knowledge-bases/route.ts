import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';

// GET all knowledge bases
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

    const knowledgeBases = await KnowledgeBase.find({ userId: userOid })
      .sort({ createdAt: -1 });
    
    return NextResponse.json({
      success: true,
      knowledgeBases: knowledgeBases.map(kb => ({
        id: String(kb._id),
        name: kb.name,
        prompt: kb.prompt,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get knowledge bases error:', error);
    
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

// POST create new knowledge base
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    
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
    if (!nameTrim || !promptTrim) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const knowledgeBase = await KnowledgeBase.create({
      userId: userOid,
      name: nameTrim,
      prompt: promptTrim,
    });
    
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
    console.error('Create knowledge base error:', error);
    
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

