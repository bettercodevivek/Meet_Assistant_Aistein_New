import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Conversation from '@/lib/db/models/Conversation';
import '@/lib/db/models/KnowledgeBase';
import Message from '@/lib/db/models/Message';
import User from '@/lib/db/models/User';
import { requireAuth } from '@/lib/auth/middleware';

// GET single conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = requireAuth(request);
    await connectDB();
    
    const { id } = await params;
    
    // Get full user details to check role
    const user = await User.findById(authUser.userId);
    
    // Build query - admin can see all conversations, regular users only their own
    const query: any = { _id: id };
    if (user?.role !== 'admin') {
      query.userId = authUser.userId;
    }
    
    const conversation = await Conversation.findOne(query).populate('knowledgeBaseId');
    
    if (!conversation) {
      return NextResponse.json(
        { success: false, message: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    const messages = await Message.find({ conversationId: id })
      .sort({ timestamp: 1 });
    
    // Handle cases where knowledgeBaseId might be null or deleted
    const knowledgeBase = conversation.knowledgeBaseId ? {
      id: String((conversation.knowledgeBaseId as any)._id),
      name: (conversation.knowledgeBaseId as any).name,
      firstMessage: (conversation.knowledgeBaseId as any).firstMessage ?? '',
      prompt: (conversation.knowledgeBaseId as any).prompt,
    } : {
      id: '',
      name: 'Deleted Knowledge Base',
      firstMessage: '',
      prompt: '',
    };
    
    return NextResponse.json({
      success: true,
      conversation: {
        id: String(conversation._id),
        title: conversation.title,
        avatarId: conversation.avatarId,
        voiceId: conversation.voiceId,
        language: conversation.language,
        knowledgeBase,
        status: conversation.status,
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
        messages: messages.map(msg => ({
          id: String(msg._id),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    
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

