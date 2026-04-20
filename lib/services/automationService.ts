import mongoose from 'mongoose';
import Automation from '@/lib/db/models/Automation';
import PhoneConversation from '@/lib/db/models/PhoneConversation';
import Customer from '@/lib/db/models/Customer';
import User from '@/lib/db/models/User';
import BatchCall from '@/lib/db/models/BatchCall';
import Agent from '@/lib/db/models/Agent';
import Meeting from '@/lib/db/models/Meeting';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import { findRecipientByPhoneInBatch } from '@/lib/batchCalling/batchRecipientLookup';
import {
  extractAppointmentFieldsWithOpenAI,
  phoneTranscriptToPlainText,
} from '@/lib/utils/extractAppointmentForAutomation';
import {
  formatGoogleSheetAppendRange,
  parseGoogleSpreadsheetId,
} from '@/lib/utils/googleSheetsAutomation';
import { googleSheetsService } from './googleSheetsService';
import { googleCalendarService } from './googleCalendarService';
import { gmailService } from './gmailService';
import { getPythonApiBaseUrl } from '@/lib/elevenlabs/pythonApi';

export interface AutomationExecutionContext {
  contact: any;
  conversation: any;
  /** ElevenLabs / Python API conversation id (required for extract). */
  elevenConversationId?: string;
  agent?: {
    mongoKnowledgeBaseIds: string[];
    language: string;
    voice_id?: string;
  };
  triggerData: {
    batch_id: string;
    conversation_id: string;
    contactId: string;
  };
  extracted: any;
  appointment: any;
  organizationId?: string;
  userId: string;
  now: Date;
  calendar_event?: any;
  meeting_link?: string;
  /** MeetAssistant room created for the guest to join (same KB as configured). */
  app_meeting?: { meetingId: string; shareUrl: string };
}

type ActionResult = { ok: boolean; detail?: string; failed?: boolean };

/** Do not use call extraction for identity — CSV is source of truth for contact.* */
const STRIP_FROM_EXTRACTED = new Set([
  'name',
  'email',
  'phone',
  'customer_name',
  'customer_email',
  'customer_phone',
]);

function labelForActionType(type: string): string {
  const map: Record<string, string> = {
    aistein_extract_data: 'Extract appointment (from call transcript)',
    aistein_google_sheet_append_row: 'Append row to Google Sheet',
    aistein_google_calendar_create_event: 'Create Google Calendar event',
    aistein_create_app_meeting: 'Create MeetAssistant link',
    aistein_send_email: 'Send email',
  };
  return map[type] || type;
}

async function syncContactFromBatchCsv(
  customer: InstanceType<typeof Customer>,
  batchCall: { recipients?: Array<{ phone_number: string; name: string; email?: string }> } | null,
  phoneFromConversation: string | undefined,
): Promise<void> {
  if (!batchCall?.recipients?.length || !phoneFromConversation) return;
  const row = findRecipientByPhoneInBatch(batchCall.recipients, phoneFromConversation);
  if (!row) return;

  const name = row.name?.trim() || customer.name;
  const email =
    row.email != null && String(row.email).trim() !== ''
      ? String(row.email).trim()
      : customer.email;
  const phone = row.phone_number || customer.phone;

  customer.name = name;
  customer.email = email;
  customer.phone = phone;
  await customer.save();
}

export async function triggerAutomation(
  conversationId: string,
  customerId: string,
  userId: string,
): Promise<void> {
  try {
    const automations = await Automation.find({
      userId,
      isActive: true,
      'trigger.type': 'batch_call_completed',
    });

    if (automations.length === 0) {
      console.log('[Automation] No active automations found for batch_call_completed trigger');
      return;
    }

    const conversation = await PhoneConversation.findById(conversationId);
    const customer = await Customer.findById(customerId);

    if (!conversation || !customer) {
      console.error('[Automation] Conversation or customer not found');
      return;
    }

    const userOid = new mongoose.Types.ObjectId(userId);
    const batchCall = conversation.metadata?.batch_call_id
      ? await BatchCall.findOne({
          batch_call_id: conversation.metadata.batch_call_id,
          userId: userOid,
        }).lean()
      : null;

    await syncContactFromBatchCsv(
      customer,
      batchCall,
      conversation.metadata?.phone_number,
    );

    const customerFresh = await Customer.findById(customerId);
    if (!customerFresh) return;

    let agentLean: { mongoKnowledgeBaseIds?: string[]; language?: string; voice_id?: string } | null =
      null;
    if (batchCall?.agent_id) {
      agentLean = await Agent.findOne({
        agent_id: batchCall.agent_id,
        userId: userOid,
      })
        .select('mongoKnowledgeBaseIds language voice_id')
        .lean();
    }

    const elevenConversationId =
      typeof conversation.metadata?.conversation_id === 'string'
        ? conversation.metadata.conversation_id
        : undefined;

    const context: AutomationExecutionContext = {
      contact: {
        _id: String(customerFresh._id),
        name: customerFresh.name,
        email: customerFresh.email,
        phone: customerFresh.phone,
      },
      conversation: {
        _id: String(conversation._id),
        transcript: conversation.transcript,
        metadata: conversation.metadata,
      },
      elevenConversationId,
      agent: agentLean
        ? {
            mongoKnowledgeBaseIds: agentLean.mongoKnowledgeBaseIds || [],
            language: agentLean.language || 'en',
            voice_id: agentLean.voice_id,
          }
        : undefined,
      triggerData: {
        batch_id: conversation.metadata?.batch_call_id,
        conversation_id: String(conversation._id),
        contactId: String(customerFresh._id),
      },
      extracted: null,
      appointment: null,
      organizationId: conversation.organizationId?.toString(),
      userId,
      now: new Date(),
    };

    for (const automation of automations) {
      console.log(`[Automation] Executing automation: ${automation.name}`);
      await executeAutomationWithTrace(
        conversationId,
        String(automation._id),
        automation.name,
        automation.actions,
        context,
      );
    }
  } catch (error) {
    console.error('[Automation] Error triggering automation:', error);
  }
}

async function executeAutomationWithTrace(
  conversationId: string,
  automationId: string,
  automationName: string,
  actions: any[],
  context: AutomationExecutionContext,
): Promise<void> {
  const steps: Array<{
    type: string;
    label: string;
    status: 'completed' | 'skipped' | 'failed';
    detail?: string;
    at: string;
  }> = [];

  for (const action of actions) {
    const at = new Date().toISOString();
    const label = labelForActionType(action.type);
    try {
      let result: ActionResult = { ok: false, detail: 'Unknown action' };

      switch (action.type) {
        case 'aistein_extract_data':
          result = await executeExtractData(action.config, context);
          break;
        case 'aistein_google_sheet_append_row':
          result = await executeGoogleSheets(action.config, context);
          break;
        case 'aistein_google_calendar_create_event':
          result = await executeGoogleCalendar(action.config, context);
          break;
        case 'aistein_create_app_meeting':
          result = await executeCreateAppMeeting(action.config, context);
          break;
        case 'aistein_send_email':
          result = await executeEmail(action.config, context);
          break;
        default:
          console.log(`[Automation] Unknown action type: ${action.type}`);
          result = { ok: false, failed: true, detail: `Unknown action: ${action.type}` };
      }

      const status = result.ok
        ? 'completed'
        : result.failed
          ? 'failed'
          : 'skipped';
      steps.push({
        type: action.type,
        label,
        status,
        detail: result.ok ? undefined : result.detail,
        at,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Automation] Error executing action ${action.type}:`, error);
      steps.push({
        type: action.type,
        label,
        status: 'failed',
        detail: msg,
        at,
      });
    }
  }

  const ranAt = new Date().toISOString();
  await PhoneConversation.findByIdAndUpdate(conversationId, {
    $push: {
      'metadata.automation_runs': {
        automationId,
        automationName,
        ranAt,
        steps,
      },
    },
  });
}

async function executeExtractData(config: any, context: AutomationExecutionContext): Promise<ActionResult> {
  try {
    const PYTHON_API_URL = getPythonApiBaseUrl();

    const externalConvId =
      context.elevenConversationId || context.conversation?.metadata?.conversation_id;
    if (!externalConvId || typeof externalConvId !== 'string') {
      return {
        ok: false,
        failed: true,
        detail: 'Missing ElevenLabs conversation id on this call',
      };
    }

    const response = await fetch(
      `${PYTHON_API_URL}/api/v1/conversations/${externalConvId}/extract`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELEVEN_API_KEY}`,
        },
        body: JSON.stringify({
          extraction_type: config.extraction_type || 'appointment',
          extraction_prompt: config.extraction_prompt,
          json_example: config.json_example,
        }),
      },
    );

    if (!response.ok) {
      const t = await response.text();
      const plain = phoneTranscriptToPlainText(context.conversation?.transcript);
      const fallback =
        plain.length >= 5
          ? await extractAppointmentFieldsWithOpenAI(plain, {
              extraction_prompt: config.extraction_prompt,
              json_example: config.json_example,
            })
          : null;

      if (fallback && typeof fallback === 'object') {
        console.warn(
          '[Automation] Python extract unavailable; used OpenAI fallback on transcript:',
          t.slice(0, 120),
        );
        return applyExtractedPayload(fallback, context);
      }

      return {
        ok: false,
        failed: true,
        detail: `Extract API failed: ${t.slice(0, 200)}${!process.env.OPENAI_API_KEY ? ' (set OPENAI_API_KEY for transcript fallback when Python extract is missing)' : ''}`,
      };
    }

    const extractedData = await response.json();
    let payload: unknown = extractedData;
    if (
      pythonExtractMissingBooking(extractedData) &&
      process.env.OPENAI_API_KEY
    ) {
      const plain = phoneTranscriptToPlainText(context.conversation?.transcript);
      if (plain.length >= 20) {
        const fb = await extractAppointmentFieldsWithOpenAI(plain, {
          extraction_prompt: config.extraction_prompt,
          json_example: config.json_example,
        });
        if (fb && openAiExtractLooksStrong(fb)) {
          console.warn(
            '[Automation] Python extract missing booking or date/time; using OpenAI result from stored transcript',
          );
          payload = fb;
        }
      }
    }
    return applyExtractedPayload(payload, context);
  } catch (error) {
    console.error('[Automation] Extract data error:', error);
    return {
      ok: false,
      failed: true,
      detail: error instanceof Error ? error.message : 'Extract failed',
    };
  }
}

function pythonExtractMissingBooking(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return true;
  const d = data as Record<string, unknown>;
  if (d.appointment_booked !== true) return true;
  const dateOk = typeof d.date === 'string' && d.date.trim().length > 0;
  const timeOk = typeof d.time === 'string' && d.time.trim().length > 0;
  return !dateOk || !timeOk;
}

function openAiExtractLooksStrong(data: Record<string, unknown>): boolean {
  return (
    data.appointment_booked === true &&
    typeof data.date === 'string' &&
    data.date.trim().length > 0 &&
    typeof data.time === 'string' &&
    data.time.trim().length > 0
  );
}

function calculateTimePlus30(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes + 30, 0);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function applyExtractedPayload(
  extractedData: unknown,
  context: AutomationExecutionContext,
): ActionResult {
  if (!extractedData || typeof extractedData !== 'object' || Array.isArray(extractedData)) {
    return { ok: false, failed: true, detail: 'Invalid extract response' };
  }
  const data = extractedData as Record<string, unknown>;
  STRIP_FROM_EXTRACTED.forEach((k) => {
    delete data[k];
  });

  context.extracted = data;

  if (data.appointment_booked !== undefined) {
    context.appointment = {
      booked: Boolean(data.appointment_booked),
      date: typeof data.date === 'string' ? data.date : undefined,
      time: typeof data.time === 'string' ? data.time : undefined,
      time_plus_30: data.time ? calculateTimePlus30(String(data.time)) : undefined,
      confidence: typeof data.confidence === 'string' ? data.confidence : undefined,
    };
  }

  console.log('[Automation] Extract data completed:', data);
  return { ok: true };
}

async function executeGoogleSheets(config: any, context: AutomationExecutionContext): Promise<ActionResult> {
  try {
    const spreadsheet_id = parseGoogleSpreadsheetId(
      (typeof config.spreadsheet_id === 'string' && config.spreadsheet_id.trim()) ||
        process.env.AUTOMATION_GOOGLE_SHEET_ID?.trim() ||
        '',
    );
    const range = formatGoogleSheetAppendRange(
      typeof config.sheet_tab === 'string' ? config.sheet_tab : undefined,
      (typeof config.range === 'string' && config.range.trim()) ||
        process.env.AUTOMATION_GOOGLE_SHEET_RANGE?.trim() ||
        undefined,
    );
    const values = config.values;

    if (!spreadsheet_id || !range || !Array.isArray(values) || values.length === 0) {
      return {
        ok: false,
        detail:
          'Missing spreadsheet_id, range, or values — set them in the automation, or set AUTOMATION_GOOGLE_SHEET_ID (and optionally AUTOMATION_GOOGLE_SHEET_RANGE) in the server environment',
      };
    }

    const resolvedValues = values.map((value: any) => {
      if (typeof value === 'string') {
        return resolveVariables(value, context);
      }
      return value;
    });

    await googleSheetsService.appendRow(
      context.userId,
      context.organizationId || '',
      spreadsheet_id,
      range,
      resolvedValues,
      typeof config.sheet_tab === 'string' ? config.sheet_tab : undefined,
    );

    console.log('[Automation] Google Sheets action completed');
    return { ok: true };
  } catch (error) {
    console.error('[Automation] Google Sheets error:', error);
    return {
      ok: false,
      failed: true,
      detail: error instanceof Error ? error.message : 'Sheets failed',
    };
  }
}

async function executeGoogleCalendar(config: any, context: AutomationExecutionContext): Promise<ActionResult> {
  try {
    if (!context.appointment || !context.appointment.booked) {
      return { ok: false, detail: 'Skipped: no booked appointment in extraction' };
    }

    const { summary, description, startTime, endTime, attendees } = config;

    const resolvedSummary = resolveVariables(summary || '', context);
    const resolvedStart = resolveVariables(startTime || '', context);
    const resolvedEnd = resolveVariables(endTime || '', context);

    if (!resolvedStart || !resolvedEnd) {
      return { ok: false, detail: 'Skipped: missing start/end date-time in config' };
    }

    const resolvedAttendees = attendees
      ? attendees.map((attendee: any) => ({
          email: resolveVariables(attendee.email, context),
          displayName: attendee.displayName || context.contact?.name,
        }))
      : [];

    const timeZone =
      typeof config.timeZone === 'string' && config.timeZone.trim()
        ? config.timeZone.trim()
        : undefined;

    const result = await googleCalendarService.createEvent(
      context.userId,
      context.organizationId || '',
      {
        summary: resolvedSummary,
        description: resolveVariables(description || '', context),
        start: {
          dateTime: resolvedStart,
          ...(timeZone ? { timeZone } : {}),
        },
        end: {
          dateTime: resolvedEnd,
          ...(timeZone ? { timeZone } : {}),
        },
        attendees: resolvedAttendees,
      },
    );

    context.calendar_event = {
      eventId: result.eventId,
      htmlLink: result.htmlLink,
      hangoutLink: result.hangoutLink,
    };

    if (!context.meeting_link && result.hangoutLink) {
      context.meeting_link = result.hangoutLink;
    }

    console.log('[Automation] Google Calendar action completed');
    return { ok: true };
  } catch (error) {
    console.error('[Automation] Google Calendar error:', error);
    return {
      ok: false,
      failed: true,
      detail: error instanceof Error ? error.message : 'Calendar failed',
    };
  }
}

async function loadUserMeetAutomationDefaults(userOid: mongoose.Types.ObjectId): Promise<{
  knowledgeBaseId: string;
  avatarId: string;
}> {
  const u = await User.findById(userOid).select('meetAutomationDefaults').lean();
  const d = u?.meetAutomationDefaults as
    | { knowledgeBaseId?: string; avatarId?: string }
    | undefined;
  return {
    knowledgeBaseId: d?.knowledgeBaseId?.trim() || '',
    avatarId: d?.avatarId?.trim() || '',
  };
}

async function resolveMongoKnowledgeBaseIdForMeet(
  config: any,
  context: AutomationExecutionContext,
  userOid: mongoose.Types.ObjectId,
  userDefaultKbId: string,
): Promise<string> {
  const fromConfig =
    typeof config.knowledge_base_id === 'string' && config.knowledge_base_id.trim()
      ? config.knowledge_base_id.trim()
      : '';
  if (fromConfig) return fromConfig;

  const fromAgent = context.agent?.mongoKnowledgeBaseIds?.[0];
  if (fromAgent && typeof fromAgent === 'string' && fromAgent.trim()) {
    return fromAgent.trim();
  }

  if (userDefaultKbId) return userDefaultKbId;

  const fromEnv = process.env.AUTOMATION_DEFAULT_KNOWLEDGE_BASE_ID?.trim();
  if (fromEnv) return fromEnv;

  const anyKb = await KnowledgeBase.findOne({ userId: userOid })
    .sort({ updatedAt: -1 })
    .select('_id')
    .lean();
  return anyKb?._id ? String(anyKb._id) : '';
}

function resolveLiveAvatarIdForMeet(config: any, userDefaultAvatarId: string): string {
  return (
    (typeof config.avatar_id === 'string' && config.avatar_id.trim()) ||
    userDefaultAvatarId ||
    process.env.AUTOMATION_DEFAULT_AVATAR_ID?.trim() ||
    process.env.LIVEAVATAR_AVATAR_ID?.trim() ||
    ''
  );
}

async function executeCreateAppMeeting(config: any, context: AutomationExecutionContext): Promise<ActionResult> {
  try {
    const userOid = new mongoose.Types.ObjectId(context.userId);
    const meetDefaults = await loadUserMeetAutomationDefaults(userOid);
    const kbId = await resolveMongoKnowledgeBaseIdForMeet(
      config,
      context,
      userOid,
      meetDefaults.knowledgeBaseId,
    );
    const avatarId = resolveLiveAvatarIdForMeet(config, meetDefaults.avatarId);

    if (!kbId || !avatarId) {
      return {
        ok: false,
        failed: true,
        detail:
          'Set knowledge_base_id and avatar_id on the Create MeetAssistant step, configure Meet automation defaults in the dashboard, attach a KB to the batch agent, or set AUTOMATION_DEFAULT_KNOWLEDGE_BASE_ID / AUTOMATION_DEFAULT_AVATAR_ID / LIVEAVATAR_AVATAR_ID.',
      };
    }

    const kb = await KnowledgeBase.findOne({ _id: kbId, userId: userOid });
    if (!kb) {
      return { ok: false, failed: true, detail: 'Knowledge base not found' };
    }

    if (
      !(typeof config.knowledge_base_id === 'string' && config.knowledge_base_id.trim()) &&
      !context.agent?.mongoKnowledgeBaseIds?.[0] &&
      !meetDefaults.knowledgeBaseId &&
      !process.env.AUTOMATION_DEFAULT_KNOWLEDGE_BASE_ID?.trim()
    ) {
      console.warn(
        '[Automation] create_app_meeting: using latest Knowledge Base for user (no step/agent/meet-defaults/env KB id)',
      );
    }

    const title = resolveVariables(config.title || 'Appointment — {{contact.name}}', context);
    const language = (config.language || context.agent?.language || 'en').trim();

    const meeting = await Meeting.create({
      createdBy: userOid,
      title: title.slice(0, 500),
      avatarId,
      ...(config.voice_id || context.agent?.voice_id
        ? { voiceId: config.voice_id || context.agent?.voice_id }
        : {}),
      language,
      knowledgeBaseId: kb._id,
      isReusable: Boolean(config.is_reusable),
      settings:
        config.settings && typeof config.settings === 'object' && !Array.isArray(config.settings)
          ? config.settings
          : {},
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const shareUrl = `${origin}/meet/${meeting.meetingId}`;
    context.app_meeting = { meetingId: meeting.meetingId, shareUrl };
    context.meeting_link = shareUrl;

    console.log('[Automation] MeetAssistant meeting created:', shareUrl);
    return { ok: true };
  } catch (error) {
    console.error('[Automation] create_app_meeting error:', error);
    return {
      ok: false,
      failed: true,
      detail: error instanceof Error ? error.message : 'MeetAssistant meeting failed',
    };
  }
}

function normalizeOutgoingEmailText(value: string): string {
  let fixed = value || '';

  // Repair common UTF-8/latin1 mojibake such as "Ã¢Â€Â”" -> "—".
  if (/[ÃÂâ]/.test(fixed)) {
    try {
      const recoded = Buffer.from(fixed, 'latin1').toString('utf8');
      if (recoded && !/�/.test(recoded) && recoded.length >= Math.floor(fixed.length * 0.8)) {
        fixed = recoded;
      }
    } catch {
      // keep original
    }
  }

  return fixed.replace(/\u00a0/g, ' ').trim();
}

async function executeEmail(config: any, context: AutomationExecutionContext): Promise<ActionResult> {
  try {
    const meetingLink =
      context.meeting_link ||
      context.app_meeting?.shareUrl ||
      context.calendar_event?.hangoutLink ||
      (await createMeetingLink(context));

    context.meeting_link = meetingLink || '';

    const to = resolveVariables(config.to, context);
    const subject = normalizeOutgoingEmailText(resolveVariables(config.subject, context));
    const body = normalizeOutgoingEmailText(resolveVariables(config.body, context));

    if (!to || !to.includes('@')) {
      return { ok: false, detail: 'Invalid or missing recipient email (use CSV email via {{contact.email}})' };
    }

    const user = await User.findById(context.userId);

    if (user && user.googleIntegration) {
      await gmailService.sendEmail(
        context.userId,
        context.organizationId || '',
        to,
        subject,
        body,
        true,
      );
      console.log('[Automation] Email sent via Gmail API');
      return { ok: true };
    }

    console.log('[Automation] Gmail integration not configured, email would be sent to:', to);
    return {
      ok: false,
      detail: 'Gmail not connected under Integrations — email was not sent',
    };
  } catch (error) {
    console.error('[Automation] Email error:', error);
    return {
      ok: false,
      failed: true,
      detail: error instanceof Error ? error.message : 'Email failed',
    };
  }
}

async function createMeetingLink(context: AutomationExecutionContext): Promise<string> {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const id = context.app_meeting?.meetingId || context.conversation?.metadata?.batch_call_id;
  if (!id) return '';
  return `${origin}/meet/${id}`;
}

function resolveVariables(template: string, context: AutomationExecutionContext): string {
  let result = template;

  result = result.replace(/\{\{contact\.name\}\}/g, context.contact.name || '');
  result = result.replace(/\{\{contact\.email\}\}/g, context.contact.email || '');
  result = result.replace(/\{\{contact\.phone\}\}/g, context.contact.phone || '');

  if (context.extracted) {
    Object.keys(context.extracted).forEach((key) => {
      if (STRIP_FROM_EXTRACTED.has(key)) return;
      const regex = new RegExp(`\\{\\{extracted\\.${escapeRegExp(key)}\\}\\}`, 'g');
      const v = context.extracted[key];
      result = result.replace(regex, v !== undefined && v !== null ? String(v) : '');
    });
  }

  if (context.appointment) {
    Object.keys(context.appointment).forEach((key) => {
      const regex = new RegExp(`\\{\\{appointment\\.${escapeRegExp(key)}\\}\\}`, 'g');
      const v = context.appointment[key];
      result = result.replace(regex, v !== undefined && v !== null ? String(v) : '');
    });
  }

  if (context.calendar_event) {
    result = result.replace(
      /\{\{calendar_event\.hangoutLink\}\}/g,
      context.calendar_event.hangoutLink || '',
    );
    result = result.replace(
      /\{\{calendar_event\.htmlLink\}\}/g,
      context.calendar_event.htmlLink || '',
    );
  }

  if (context.app_meeting) {
    result = result.replace(/\{\{app_meeting\.shareUrl\}\}/g, context.app_meeting.shareUrl || '');
    result = result.replace(/\{\{app_meeting\.meetingId\}\}/g, context.app_meeting.meetingId || '');
  }

  if (context.meeting_link) {
    result = result.replace(/\{\{meeting_link\}\}/g, context.meeting_link);
  }

  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
