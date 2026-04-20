import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IGoogleIntegration {
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: Date;
  email?: string;
}

export interface IGoogleWorkspaceIntegration {
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: Date;
  email?: string;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastLoginAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  isActive: boolean;
  /** Optional; used by voice agent / CRM-style lookups */
  phone?: string;
  googleIntegration?: IGoogleIntegration;
  googleWorkspaceIntegration?: IGoogleWorkspaceIntegration;
  /** Up to 5 LiveAvatar public catalog picks (id from api.liveavatar.com). */
  favoriteLiveAvatars?: { id: string; name: string }[];
  /** Defaults for batch automation step “Create MeetAssistant link” when node fields are empty. */
  meetAutomationDefaults?: {
    knowledgeBaseId?: string;
    avatarId?: string;
  };
}

const GoogleIntegrationSchema = new Schema(
  {
    refreshToken: { type: String, required: true },
    accessToken: String,
    accessTokenExpiresAt: Date,
    email: String,
  },
  { _id: false },
);

const GoogleWorkspaceIntegrationSchema = new Schema(
  {
    refreshToken: { type: String, required: true },
    accessToken: String,
    accessTokenExpiresAt: Date,
    email: String,
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: false,
    sparse: true, // Allow null values but enforce uniqueness when present
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  phone: {
    type: String,
    trim: true,
    required: false,
  },
  googleIntegration: {
    type: GoogleIntegrationSchema,
    required: false,
  },
  googleWorkspaceIntegration: {
    type: GoogleWorkspaceIntegrationSchema,
    required: false,
  },
  favoriteLiveAvatars: {
    type: [
      {
        id: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
      },
    ],
    default: [],
  },
  meetAutomationDefaults: {
    type: {
      knowledgeBaseId: { type: String, trim: true },
      avatarId: { type: String, trim: true },
    },
    required: false,
    default: undefined,
  },
});

const existingUser = mongoose.models.User as Model<IUser> | undefined;
if (existingUser && !existingUser.schema.path('meetAutomationDefaults')) {
  mongoose.deleteModel('User');
}

export default (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

