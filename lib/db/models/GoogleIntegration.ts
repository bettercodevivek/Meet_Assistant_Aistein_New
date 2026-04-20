import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IGoogleIntegration extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  provider: string;

  // OAuth tokens
  accessToken: string;
  refreshToken: string;
  tokenExpiry?: Date;

  // Enabled services
  services: {
    sheets: boolean;
    drive: boolean;
    calendar: boolean;
    gmail: boolean;
  };

  // User profile info from Google
  googleProfile: {
    email: string;
    name?: string;
    picture?: string;
  };

  // Service-specific settings
  settings: {
    sheets?: {
      defaultSpreadsheetId?: string;
    };
    drive?: {
      defaultFolderId?: string;
    };
    calendar?: {
      defaultCalendarId?: string;
    };
  };

  status: 'active' | 'expired' | 'revoked';
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleIntegrationSchema = new Schema<IGoogleIntegration>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    provider: {
      type: String,
      default: 'google',
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    tokenExpiry: {
      type: Date,
    },
    services: {
      sheets: {
        type: Boolean,
        default: false,
      },
      drive: {
        type: Boolean,
        default: false,
      },
      calendar: {
        type: Boolean,
        default: false,
      },
      gmail: {
        type: Boolean,
        default: false,
      },
    },
    googleProfile: {
      email: {
        type: String,
        required: true,
      },
      name: {
        type: String,
      },
      picture: {
        type: String,
      },
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
    },
    lastSyncedAt: {
      type: Date,
    },
  },
  {
    collection: 'google_integrations',
    timestamps: true,
  }
);

GoogleIntegrationSchema.index({ userId: 1, organizationId: 1 });
GoogleIntegrationSchema.index({ 'googleProfile.email': 1 });

export default (mongoose.models.GoogleIntegration as Model<IGoogleIntegration>) ||
  mongoose.model<IGoogleIntegration>('GoogleIntegration', GoogleIntegrationSchema);
