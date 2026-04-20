/**
 * Utility functions for ElevenLabs Python API integration
 * These functions communicate with the Python API endpoint specified in PYTHON_API_URL
 */

/** Trim + strip trailing slashes so `.env` typos (e.g. trailing space) do not break routes (404). */
export function getPythonApiBaseUrl(): string {
  const raw = process.env.PYTHON_API_URL || 'https://elvenlabs-voiceagent.onrender.com';
  return raw.trim().replace(/\/+$/, '');
}

const PYTHON_API_URL = getPythonApiBaseUrl();
const ELEVENLABS_API_URL = process.env.ELEVENLABS_API_URL || 'https://api.eu.residency.elevenlabs.io/v1';
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const POST_CALL_WEBHOOK_ID = process.env.POST_CALL_WEBHOOK_ID;

export interface CreateAgentResponse {
  agent_id: string;
  name: string;
}

export interface UpdateAgentPromptResponse {
  success: boolean;
  message: string;
}

export interface SyncAgentResponse {
  success: boolean;
  message: string;
}

export interface RegisterPhoneNumberResponse {
  phone_number_id: string;
  elevenlabs_phone_number_id: string;
}

export interface CreatePhoneNumberResponse {
  phone_number_id: string;
  elevenlabs_phone_number_id?: string;
}

export interface SubmitBatchCallResponse {
  id: string;
  name: string;
  agent_id: string;
  status: string;
  phone_number_id: string;
  phone_provider: string;
  created_at_unix: number;
  scheduled_time_unix: number;
  timezone: string;
  total_calls_dispatched: number;
  total_calls_scheduled: number;
  total_calls_finished: number;
  last_updated_at_unix: number;
  retry_count: number;
  agent_name: string;
}

export interface BatchCallStatusResponse {
  id: string;
  name: string;
  agent_id: string;
  status: string;
  phone_number_id: string;
  phone_provider: string;
  created_at_unix: number;
  scheduled_time_unix: number;
  timezone: string;
  total_calls_dispatched: number;
  total_calls_scheduled: number;
  total_calls_finished: number;
  last_updated_at_unix: number;
  retry_count: number;
  agent_name: string;
  recipients?: Array<{
    phone_number?: string;
    name?: string;
    status?: string;
    call_status?: string;
    outcome?: string;
    conversation_id?: string;
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> };
  }>;
}

export interface KnowledgeBaseDocument {
  document_id: string;
  id: string;
  name: string;
  folder_path: string[];
  source_type: 'text' | 'url' | 'file';
  type?: string;
  status?: string;
  created_at_unix?: number;
  collection_name?: string;
  collectionName?: string;
}

export interface ListDocumentsResponse {
  documents: KnowledgeBaseDocument[];
  cursor?: string;
}

/**
 * Create a new agent via Python API
 */
export async function createAgentInPythonAPI(data: {
  name: string;
  first_message: string;
  system_prompt: string;
  language: string;
  voice_id?: string;
  knowledge_base_ids: string[];
}): Promise<CreateAgentResponse> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create agent: ${error}`);
  }

  return response.json();
}

/**
 * Update agent prompt via Python API
 */
export async function updateAgentPromptInPythonAPI(
  agent_id: string,
  data: {
    first_message: string;
    system_prompt: string;
    language: string;
    voice_id?: string;
    greeting_message?: string;
    escalationRules?: string[];
    knowledge_base_ids: string[];
  }
): Promise<UpdateAgentPromptResponse> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/agents/${agent_id}/prompt`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update agent prompt: ${error}`);
  }

  return response.json();
}

/**
 * Sync agent to ElevenLabs via Python API
 */
export async function syncAgentToElevenLabs(agent_id: string): Promise<SyncAgentResponse> {
  const response = await fetch(
    `${PYTHON_API_URL}/api/v1/agents/${encodeURIComponent(agent_id)}/sync`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ELEVEN_API_KEY}`,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    const url = `${PYTHON_API_URL}/api/v1/agents/${encodeURIComponent(agent_id)}/sync`;
    throw new Error(
      `Failed to sync agent: HTTP ${response.status} ${response.statusText} — ${body} (url: ${url})`,
    );
  }

  return response.json();
}

/**
 * Create phone number in Python API (for Twilio numbers)
 */
export async function createPhoneNumberInPythonAPI(data: {
  phone_number: string;
  provider: string;
  supports_outbound: boolean;
  supports_inbound?: boolean;
  label?: string;
  sid?: string;
  token?: string;
  inbound_trunk_config?: any;
  outbound_trunk_config?: any;
}): Promise<CreatePhoneNumberResponse> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/phone-numbers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create phone number in Python API: ${error}`);
  }

  return response.json();
}

/**
 * Register phone number with ElevenLabs via Python API
 */
export async function registerPhoneNumberWithElevenLabs(
  phone_number_id: string
): Promise<RegisterPhoneNumberResponse> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/phone-numbers/${phone_number_id}/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to register phone number: ${error}`);
  }

  return response.json();
}

/**
 * Submit batch call via Python API
 */
export async function submitBatchCall(data: {
  agent_id: string;
  call_name: string;
  phone_number_id: string;
  recipients: Array<{
    phone_number: string;
    name: string;
    email?: string;
    dynamic_variables?: Record<string, any>;
  }>;
}): Promise<SubmitBatchCallResponse> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/batch-calling/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to submit batch call: ${error}`);
  }

  return response.json();
}

/**
 * Get batch call status via Python API
 */
export async function getBatchCallStatus(jobId: string): Promise<BatchCallStatusResponse> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/batch-calling/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get batch call status: ${error}`);
  }

  return response.json();
}

/**
 * Cancel batch call via Python API
 */
export async function cancelBatchCall(jobId: string): Promise<{ id: string; status: string; message: string }> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/batch-calling/${jobId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to cancel batch call: ${error}`);
  }

  return response.json();
}

/**
 * List knowledge base documents via Python API
 */
export async function listKnowledgeBaseDocuments(params?: {
  cursor?: string;
  page_size?: number;
}): Promise<ListDocumentsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.cursor) queryParams.append('cursor', params.cursor);
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

  const response = await fetch(
    `${PYTHON_API_URL}/api/v1/knowledge-base?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ELEVEN_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list knowledge base documents: ${error}`);
  }

  return response.json();
}

/**
 * Ingest document into knowledge base via Python API
 */
export async function ingestDocument(data: FormData): Promise<KnowledgeBaseDocument> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/knowledge-base/ingest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to ingest document: ${error}`);
  }

  return response.json();
}

/**
 * Create document from text via Python API
 */
export async function createDocumentFromText(data: {
  name: string;
  text: string;
  parent_folder_id?: string;
}): Promise<KnowledgeBaseDocument> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/knowledge-base/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create document from text: ${error}`);
  }

  return response.json();
}

/**
 * Create document from URL via Python API
 */
export async function createDocumentFromUrl(data: {
  name: string;
  url: string;
  parent_folder_id?: string;
}): Promise<KnowledgeBaseDocument> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/knowledge-base/url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create document from URL: ${error}`);
  }

  return response.json();
}

/**
 * Create document from file via Python API
 */
export async function createDocumentFromFile(data: FormData): Promise<KnowledgeBaseDocument> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/knowledge-base/file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
    body: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create document from file: ${error}`);
  }

  return response.json();
}

/**
 * Get document by ID via Python API
 */
export async function getDocument(document_id: string): Promise<KnowledgeBaseDocument> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/knowledge-base/${document_id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get document: ${error}`);
  }

  return response.json();
}

/**
 * Delete document via Python API
 */
export async function deleteDocument(document_id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/knowledge-base/${document_id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete document: ${error}`);
  }

  return response.json();
}

/**
 * List phone numbers via Python API
 */
export async function listPhoneNumbers(params?: {
  cursor?: string;
  page_size?: number;
}): Promise<{ phone_numbers: any[]; cursor?: string }> {
  const queryParams = new URLSearchParams();
  if (params?.cursor) queryParams.append('cursor', params.cursor);
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

  const response = await fetch(
    `${PYTHON_API_URL}/api/v1/phone-numbers?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ELEVEN_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list phone numbers: ${error}`);
  }

  return response.json();
}

/**
 * Get phone number by ID via Python API
 */
export async function getPhoneNumber(phone_number_id: string): Promise<any> {
  const response = await fetch(`${PYTHON_API_URL}/api/v1/phone-numbers/${phone_number_id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ELEVEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get phone number: ${error}`);
  }

  return response.json();
}
