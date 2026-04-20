import mongoose from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import Customer from '@/lib/db/models/Customer';
import PhoneConversation from '@/lib/db/models/PhoneConversation';
import type { IBatchCall } from '@/lib/db/models/BatchCall';
import { findRecipientByPhoneInBatch } from '@/lib/batchCalling/batchRecipientLookup';
import { triggerAutomation } from '@/lib/services/automationService';
import { getPythonApiBaseUrl } from '@/lib/elevenlabs/pythonApi';

const PYTHON_API_URL = getPythonApiBaseUrl();

/**
 * After batch status is merged from the Python API into `batchCall.recipients`
 * (via `applyPythonSyncToBatchCall`), create/update phone conversations and run
 * batch_call_completed automations. Safe to call on every poll — idempotent per
 * `batch_call_id` + phone via `PhoneConversation` lookup and
 * `automation_triggered_phones`.
 */
export async function processCompletedBatchRecipientsForAutomation(
  batchCall: HydratedDocument<IBatchCall>,
  userOid: mongoose.Types.ObjectId,
): Promise<void> {
  const recipients = batchCall.recipients || [];

  for (const recipient of recipients) {
    if (recipient.call_status !== 'completed') continue;
    if (!recipient.conversation_id || !recipient.phone_number) continue;
    if (batchCall.automation_triggered_phones.includes(recipient.phone_number)) {
      continue;
    }

    console.log(
      `[BatchAutomationSync] Processing completed call for ${recipient.phone_number}, conversation_id: ${recipient.conversation_id}`,
    );

    try {
      const transcriptResponse = await fetch(
        `${PYTHON_API_URL}/api/v1/conversations/${recipient.conversation_id}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.ELEVEN_API_KEY}`,
          },
        },
      );

      if (!transcriptResponse.ok) {
        console.error(
          `[BatchAutomationSync] Failed to fetch transcript for ${recipient.conversation_id}`,
        );
        continue;
      }

      const transcriptData = await transcriptResponse.json();
      const transcriptPayload = transcriptData.transcript ?? {};

      const row = findRecipientByPhoneInBatch(
        batchCall.recipients || [],
        recipient.phone_number,
      );
      const csvName = row?.name?.trim() || 'Contact';
      const csvEmail =
        row?.email != null && String(row.email).trim() !== ''
          ? String(row.email).trim()
          : undefined;
      const csvPhone = row?.phone_number || recipient.phone_number;

      let customer = await Customer.findOne({
        phone: csvPhone,
        userId: userOid,
      });

      if (!customer) {
        customer = await Customer.create({
          userId: userOid,
          name: csvName,
          email: csvEmail,
          phone: csvPhone,
          source: 'batch',
        });
      } else {
        customer.name = csvName || customer.name;
        if (csvEmail !== undefined) {
          customer.email = csvEmail;
        }
        customer.phone = csvPhone || customer.phone;
        await customer.save();
      }

      let conversation = await PhoneConversation.findOne({
        userId: userOid,
        'metadata.batch_call_id': batchCall.batch_call_id,
        'metadata.phone_number': recipient.phone_number,
      });

      if (!conversation) {
        conversation = await PhoneConversation.create({
          userId: userOid,
          customerId: customer._id,
          channel: 'phone',
          status: 'closed',
          transcript: transcriptPayload,
          isAiManaging: true,
          metadata: {
            batch_call_id: batchCall.batch_call_id,
            conversation_id: recipient.conversation_id,
            phone_number: recipient.phone_number,
            duration_seconds: transcriptData.metadata?.call_duration_secs || 0,
            call_successful: true,
            source: 'batch',
          },
        });
        console.log(
          `[BatchAutomationSync] Created conversation ${conversation._id} for ${recipient.phone_number}`,
        );
      } else {
        conversation.transcript = transcriptPayload;
        if (conversation.metadata) {
          conversation.metadata.duration_seconds =
            transcriptData.metadata?.call_duration_secs ??
            conversation.metadata.duration_seconds ??
            0;
        }
        await conversation.save();
      }

      const runs = conversation.metadata?.automation_runs;
      const alreadyRan = Array.isArray(runs) && runs.length > 0;
      if (!alreadyRan) {
        await triggerAutomation(
          String(conversation._id),
          String(customer._id),
          userOid.toString(),
        );
      }

      if (!batchCall.automation_triggered_phones.includes(recipient.phone_number)) {
        batchCall.automation_triggered_phones.push(recipient.phone_number);
        await batchCall.save();
      }
    } catch (error) {
      console.error(
        `[BatchAutomationSync] Error processing recipient ${recipient.phone_number}:`,
        error,
      );
    }
  }

  if (
    batchCall.total_calls_finished >= batchCall.total_calls_scheduled &&
    !batchCall.conversations_synced
  ) {
    batchCall.conversations_synced = true;
    await batchCall.save();
  }
}
