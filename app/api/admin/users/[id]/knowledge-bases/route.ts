import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import { requireAdmin } from '@/lib/auth/adminMiddleware';

// GET user's knowledge bases
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    await connectDB();
    
    const { id } = await params;
    
    // Verify user exists
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get user's knowledge bases
    const knowledgeBases = await KnowledgeBase.find({ userId: id })
      .sort({ createdAt: -1 });
    
    const kbsFormatted = knowledgeBases.map(kb => ({
      id: String(kb._id),
      name: kb.name,
      prompt: kb.prompt,
      firstMessage: kb.firstMessage ?? '',
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    }));
    
    return NextResponse.json({
      success: true,
      knowledgeBases: kbsFormatted,
      user: {
        id: String(user._id),
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Get user knowledge bases error:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

