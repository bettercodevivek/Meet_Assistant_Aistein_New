import mongoose, { Schema, Model, Document } from "mongoose";

export interface IConversation extends Document {
  userId?: mongoose.Types.ObjectId;
  guestName?: string;
  /** Stable per-browser key for a meeting; avoids duplicate sessions / enables reconnect */
  guestSessionKey?: string;
  guestAccessToken?: string;
  meetingId?: mongoose.Types.ObjectId;
  avatarId: string;
  voiceId?: string;
  language?: string;
  knowledgeBaseId: mongoose.Types.ObjectId;
  title: string;
  status: "active" | "completed";
  sessionContext?: string;
  conversationSummary?: string;
  /** Set when summary was analyzed (OpenAI); undefined = never checked */
  appointmentBooked?: boolean;
  appointmentCheckedAt?: Date;
  /** Inferred appointment / meeting time when appointmentBooked is true */
  appointmentAt?: Date;
  /** Short description of the booked commitment */
  appointmentDetails?: string;
  createdAt: Date;
  lastMessageAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  guestName: {
    type: String,
    trim: true,
  },
  guestSessionKey: {
    type: String,
    trim: true,
    maxlength: 128,
    index: true,
  },
  guestAccessToken: {
    type: String,
    select: false,
  },
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: "Meeting",
  },
  avatarId: {
    type: String,
    required: true,
  },
  voiceId: {
    type: String,
  },
  language: {
    type: String,
  },
  knowledgeBaseId: {
    type: Schema.Types.ObjectId,
    ref: "KnowledgeBase",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active",
  },
  sessionContext: {
    type: String,
    default: "",
  },
  conversationSummary: {
    type: String,
    default: "",
  },
  appointmentBooked: {
    type: Boolean,
  },
  appointmentCheckedAt: {
    type: Date,
  },
  appointmentAt: {
    type: Date,
  },
  appointmentDetails: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
});

ConversationSchema.pre("validate", function (next) {
  const hasUser = this.userId != null;
  const hasGuest =
    typeof this.guestName === "string" && this.guestName.trim().length > 0;
  if (hasUser === hasGuest) {
    next(new Error("Conversation must have either userId or guestName"));
    return;
  }
  if (hasGuest && !this.guestAccessToken) {
    next(new Error("Guest conversations require guestAccessToken"));
    return;
  }
  next();
});

export default (mongoose.models.Conversation as Model<IConversation>) ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);
