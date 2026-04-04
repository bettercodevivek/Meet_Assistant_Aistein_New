import mongoose, { Schema, Model, Document } from 'mongoose';
import { nanoid } from 'nanoid';

export type MeetingStatus = 'waiting' | 'active' | 'completed';

export interface IMeeting extends Document {
  meetingId: string;
  createdBy: mongoose.Types.ObjectId;
  title: string;
  avatarId: string;
  /** LiveAvatar / LiveKit session API expects a UUID; optional when avatarId is already a UUID */
  liveAvatarAvatarUuid?: string;
  voiceId?: string;
  language: string;
  knowledgeBaseId: mongoose.Types.ObjectId;
  status: MeetingStatus;
  isReusable: boolean;
  maxSessions?: number;
  sessionCount: number;
  expiresAt?: Date;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema<IMeeting>(
  {
    meetingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => nanoid(12),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    avatarId: {
      type: String,
      required: true,
    },
    liveAvatarAvatarUuid: {
      type: String,
      trim: true,
    },
    voiceId: {
      type: String,
    },
    language: {
      type: String,
      required: true,
    },
    knowledgeBaseId: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeBase',
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed'],
      default: 'waiting',
    },
    isReusable: {
      type: Boolean,
      default: false,
    },
    maxSessions: {
      type: Number,
    },
    sessionCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default (mongoose.models.Meeting as Model<IMeeting>) ||
  mongoose.model<IMeeting>('Meeting', MeetingSchema);
