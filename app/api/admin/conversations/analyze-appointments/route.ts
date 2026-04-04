import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import Conversation from "@/lib/db/models/Conversation";
import { requireAdmin } from "@/lib/auth/adminMiddleware";
import { analyzeAppointmentFromSummary } from "@/lib/utils/appointmentFromSummary";

function adminError(error: unknown) {
  if (error instanceof Error && error.message === "Admin access required") {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 },
    );
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { success: false, message: "Internal server error" },
    { status: 500 },
  );
}

/**
 * POST — run OpenAI appointment classification on guest meeting conversations
 * that have a summary but have not been checked yet (or force re-check).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "OPENAI_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, Number(body.limit) || 25));
    const force = body.force === true;

    await connectDB();

    const baseFilter: Record<string, unknown> = {
      meetingId: { $exists: true, $ne: null },
      conversationSummary: { $exists: true, $nin: [null, ""] },
    };

    if (!force) {
      baseFilter.$or = [
        { appointmentCheckedAt: { $exists: false } },
        { appointmentCheckedAt: null },
      ];
    }

    const docs = await Conversation.find(baseFilter)
      .select("conversationSummary")
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .lean();

    let updated = 0;
    let skipped = 0;

    for (const doc of docs) {
      const id = doc._id;
      const summary =
        typeof doc.conversationSummary === "string"
          ? doc.conversationSummary
          : "";
      const appt = await analyzeAppointmentFromSummary(summary);
      if (appt.appointmentBooked === null) {
        skipped += 1;
        continue;
      }
      const set: Record<string, unknown> = {
        appointmentBooked: appt.appointmentBooked,
        appointmentCheckedAt: new Date(),
      };
      if (appt.appointmentBooked === true) {
        if (appt.appointmentAt) set.appointmentAt = appt.appointmentAt;
        if (appt.appointmentDetails) set.appointmentDetails = appt.appointmentDetails;
      } else {
        set.appointmentAt = null;
        set.appointmentDetails = null;
      }
      await Conversation.updateOne({ _id: id }, { $set: set });
      updated += 1;
    }

    return NextResponse.json({
      success: true,
      processed: docs.length,
      updated,
      skipped,
    });
  } catch (error) {
    console.error("Analyze appointments error:", error);
    return adminError(error);
  }
}
