import connectDB from "@/lib/db/mongodb";
import Conversation from "@/lib/db/models/Conversation";
import Meeting from "@/lib/db/models/Meeting";
import Message from "@/lib/db/models/Message";
import { analyzeAppointmentFromSummary } from "@/lib/utils/appointmentFromSummary";
import { generateConversationSummary } from "@/lib/utils/summaryGenerator";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Guest LiveKit sessions write messages on worker shutdown, which can lag the browser
 * POST .../end by a few seconds. Poll briefly so finalize sees the transcript.
 */
async function waitForLiveKitTranscript(
  conversationId: string,
  meetingId: unknown,
  maxMs: number,
): Promise<void> {
  if (!meetingId) return;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const n = await Message.countDocuments({ conversationId });
    if (n > 0) return;
    await sleep(750);
  }
}

/**
 * Mark a conversation completed with summary + optional single-use meeting closure.
 * Server-only; caller must enforce auth when invoked from user-facing routes.
 */
export async function finalizeConversationEndById(
  conversationId: string,
): Promise<boolean> {
  await connectDB();

  const existing = await Conversation.findById(conversationId);
  if (!existing || existing.status !== "active") {
    return false;
  }

  let messages = await Message.find({ conversationId }).sort({
    timestamp: 1,
  });

  if (messages.length === 0 && existing.meetingId) {
    await waitForLiveKitTranscript(conversationId, existing.meetingId, 22_000);
    messages = await Message.find({ conversationId }).sort({ timestamp: 1 });
  }

  const conversationSummary = await generateConversationSummary(
    messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
  );

  const update: Record<string, unknown> = {
    status: "completed",
    conversationSummary,
    lastMessageAt: new Date(),
  };

  if (conversationSummary.trim()) {
    const appt = await analyzeAppointmentFromSummary(conversationSummary);
    if (appt.appointmentBooked !== null) {
      update.appointmentBooked = appt.appointmentBooked;
      update.appointmentCheckedAt = new Date();
    }
    if (appt.appointmentBooked === true) {
      if (appt.appointmentAt) update.appointmentAt = appt.appointmentAt;
      if (appt.appointmentDetails) update.appointmentDetails = appt.appointmentDetails;
    } else if (appt.appointmentBooked === false) {
      update.appointmentAt = null;
      update.appointmentDetails = null;
    }
  }

  await Conversation.findByIdAndUpdate(conversationId, { $set: update });

  const meetingId = existing.meetingId;
  if (meetingId) {
    const meeting = await Meeting.findById(meetingId);
    if (meeting) {
      const activeForMeeting = await Conversation.countDocuments({
        meetingId,
        status: "active",
      });
      // Count runs after this conversation was marked completed — remaining actives are other guests.
      const othersStillInMeeting = activeForMeeting > 0;

      if (meeting.status === "waiting" && meeting.sessionCount > 0) {
        await Meeting.findByIdAndUpdate(meetingId, {
          $set: { status: "active" },
        });
      }

      if (!meeting.isReusable) {
        if (!othersStillInMeeting) {
          await Meeting.findByIdAndUpdate(meetingId, {
            $set: { status: "completed", isActive: false },
          });
        }
      } else if (!othersStillInMeeting) {
        await Meeting.findByIdAndUpdate(meetingId, {
          $set: { status: "active" },
          $unset: { roomTranscriptConversationId: "" },
        });
      } else {
        await Meeting.findByIdAndUpdate(meetingId, {
          $set: { status: "active" },
        });
      }
    }
  }

  return true;
}
