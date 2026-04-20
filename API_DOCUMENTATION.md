# API Documentation - Agent, Knowledge Base, Phone Number & Batch Calling Endpoints

This document provides comprehensive API documentation for implementing similar endpoints in other projects. All endpoints require authentication via Bearer token.

---

## Table of Contents
1. [Agent Endpoints](#agent-endpoints)
2. [Knowledge Base Endpoints](#knowledge-base-endpoints)
3. [Phone Number Endpoints](#phone-number-endpoints)
4. [Batch Calling Endpoints](#batch-calling-endpoints)

---

## Agent Endpoints

### Base URL
```
/api/v1/agents
```

### 1. Create Agent

**Endpoint:** `POST /api/v1/agents`

**Description:** Create a new AI voice agent with specified configuration.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Customer Support Agent",
  "first_message": "Hello! How can I help you today?",
  "system_prompt": "You are a helpful customer service agent. Assist users with their inquiries.",
  "language": "en",
  "voice_id": "eleven_multilingual_v2",
  "knowledge_base_ids": ["doc_123", "doc_456"]
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Agent name |
| first_message | string | Yes | Initial message the agent says |
| system_prompt | string | Yes | System prompt for the agent |
| language | string | Yes | Language code (e.g., "en", "es") |
| voice_id | string | No | ElevenLabs voice ID |
| knowledge_base_ids | array | Yes | Array of knowledge base document IDs |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Agent created successfully",
  "data": {
    "_id": "64a1b2c3d4e5f67890abcdef",
    "userId": "64a1b2c3d4e5f67890abc123",
    "agent_id": "agent_abc123xyz456",
    "name": "Customer Support Agent",
    "first_message": "Hello! How can I help you today?",
    "system_prompt": "You are a helpful customer service agent. Assist users with their inquiries.",
    "language": "en",
    "voice_id": "eleven_multilingual_v2",
    "greeting_message": "Hello! How can I help you today?",
    "escalationRules": [],
    "knowledge_base_ids": ["doc_123", "doc_456"],
    "tool_ids": ["tool_prod_123", "tool_ord_456"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Agent name is required"
  }
}
```

---

### 2. Get All Agents

**Endpoint:** `GET /api/v1/agents`

**Description:** Retrieve all agents for the authenticated user.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f67890abcdef",
      "userId": "64a1b2c3d4e5f67890abc123",
      "agent_id": "agent_abc123xyz456",
      "name": "Customer Support Agent",
      "first_message": "Hello! How can I help you today?",
      "system_prompt": "You are a helpful customer service agent.",
      "language": "en",
      "voice_id": "eleven_multilingual_v2",
      "knowledge_base_ids": ["doc_123"],
      "tool_ids": ["tool_prod_123"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 3. Get Agent by ID

**Endpoint:** `GET /api/v1/agents/:id`

**Description:** Retrieve a single agent by its MongoDB _id.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | MongoDB _id of the agent |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f67890abcdef",
    "userId": "64a1b2c3d4e5f67890abc123",
    "agent_id": "agent_abc123xyz456",
    "name": "Customer Support Agent",
    "first_message": "Hello! How can I help you today?",
    "system_prompt": "You are a helpful customer service agent.",
    "language": "en",
    "voice_id": "eleven_multilingual_v2",
    "knowledge_base_ids": ["doc_123"],
    "tool_ids": ["tool_prod_123"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found"
  }
}
```

---

### 4. Update Agent Prompt

**Endpoint:** `PATCH /api/v1/agents/:agent_id/prompt`

**Description:** Update an agent's prompt configuration.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agent_id | string | Yes | Python API agent_id (e.g., "agent_xxx") |

**Request Body:**
```json
{
  "first_message": "Hi there! How can I assist you?",
  "system_prompt": "You are a helpful assistant. Answer questions concisely.",
  "language": "en",
  "voice_id": "eleven_multilingual_v2",
  "greeting_message": "Welcome to our service!",
  "escalationRules": ["user says transfer", "sentiment negative"],
  "knowledge_base_ids": ["doc_123", "doc_456"]
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| first_message | string | Yes | Updated first message |
| system_prompt | string | Yes | Updated system prompt |
| language | string | Yes | Language code |
| voice_id | string | No | ElevenLabs voice ID |
| greeting_message | string | No | Agent-level greeting message |
| escalationRules | array | No | Escalation conditions |
| knowledge_base_ids | array | Yes | Array of knowledge base IDs |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Agent prompt updated successfully",
  "data": {
    "_id": "64a1b2c3d4e5f67890abcdef",
    "agent_id": "agent_abc123xyz456",
    "name": "Customer Support Agent",
    "first_message": "Hi there! How can I assist you?",
    "system_prompt": "You are a helpful assistant. Answer questions concisely.",
    "language": "en",
    "voice_id": "eleven_multilingual_v2",
    "greeting_message": "Welcome to our service!",
    "escalationRules": ["user says transfer", "sentiment negative"],
    "knowledge_base_ids": ["doc_123", "doc_456"],
    "tool_ids": ["tool_prod_123", "tool_ord_456"],
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### 5. Sync Agent to ElevenLabs

**Endpoint:** `POST /api/v1/agents/:agent_id/sync`

**Description:** Sync agent configuration to ElevenLabs (enables tools, attaches webhooks).

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agent_id | string | Yes | Python API agent_id |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Agent synced successfully to ElevenLabs",
  "data": {
    "synced": true
  }
}
```

---

### 6. Delete Agent

**Endpoint:** `DELETE /api/v1/agents/:id`

**Description:** Delete an agent by its MongoDB _id.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | MongoDB _id of the agent |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

---

## Knowledge Base Endpoints

### Base URL
```
/api/v1/knowledge-base
```

### 1. List Documents

**Endpoint:** `GET /api/v1/knowledge-base`

**Description:** List all knowledge base documents for the authenticated user with pagination.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | No | Pagination cursor |
| page_size | number | No | Number of items per page (default: 30, max: 100) |

**Response (200 OK):**
```json
{
  "documents": [
    {
      "id": "doc_abc123xyz456",
      "document_id": "doc_abc123xyz456",
      "name": "Product Documentation",
      "type": "file",
      "status": "ready",
      "created_at_unix": 1705314000,
      "folder_path": [],
      "collection_name": "product_documentation",
      "collectionName": "product_documentation"
    }
  ],
  "cursor": "doc_xyz789abc123"
}
```

---

### 2. Ingest Document (Unified)

**Endpoint:** `POST /api/v1/knowledge-base/ingest`

**Description:** Ingest a document into the knowledge base from text, URL, or file.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source_type | string | Yes | "text", "url", or "file" |
| name | string | No | Document name |
| parent_folder_id | string | No | Parent folder ID |
| text | string | No | Text content (if source_type=text) |
| url | string | No | URL to scrape (if source_type=url) |
| file | file | No | File to upload (if source_type=file) |

**Example - Text Ingestion:**
```bash
curl -X POST https://api.example.com/api/v1/knowledge-base/ingest \
  -H "Authorization: Bearer <token>" \
  -F "source_type=text" \
  -F "name=My Document" \
  -F "text=This is the document content."
```

**Example - URL Ingestion:**
```bash
curl -X POST https://api.example.com/api/v1/knowledge-base/ingest \
  -H "Authorization: Bearer <token>" \
  -F "source_type=url" \
  -F "name=Website Docs" \
  -F "url=https://example.com/docs"
```

**Example - File Ingestion:**
```bash
curl -X POST https://api.example.com/api/v1/knowledge-base/ingest \
  -H "Authorization: Bearer <token>" \
  -F "source_type=file" \
  -F "name=Manual.pdf" \
  -F "file=@/path/to/manual.pdf"
```

**Response (201 Created):**
```json
{
  "document_id": "doc_abc123xyz456",
  "id": "doc_abc123xyz456",
  "name": "My Document",
  "folder_path": [],
  "source_type": "text"
}
```

---

### 3. Create from Text

**Endpoint:** `POST /api/v1/knowledge-base/text`

**Description:** Create a knowledge base document from text content.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Company Policies",
  "text": "This document contains company policies...",
  "parent_folder_id": "folder_123"
}
```

**Response (201 Created):**
```json
{
  "document_id": "doc_abc123xyz456",
  "id": "doc_abc123xyz456",
  "name": "Company Policies",
  "folder_path": [],
  "source_type": "text"
}
```

---

### 4. Create from URL

**Endpoint:** `POST /api/v1/knowledge-base/url`

**Description:** Create a knowledge base document by scraping a URL.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Website Content",
  "url": "https://example.com/documentation",
  "parent_folder_id": "folder_123"
}
```

**Response (201 Created):**
```json
{
  "document_id": "doc_abc123xyz456",
  "id": "doc_abc123xyz456",
  "name": "Website Content",
  "folder_path": [],
  "source_type": "url"
}
```

---

### 5. Create from File

**Endpoint:** `POST /api/v1/knowledge-base/file`

**Description:** Create a knowledge base document from a file upload (PDF, Excel, etc.).

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Document name |
| parent_folder_id | string | No | Parent folder ID |
| file | file | Yes | File to upload |

**Response (201 Created):**
```json
{
  "document_id": "doc_abc123xyz456",
  "id": "doc_abc123xyz456",
  "name": "Uploaded File",
  "folder_path": [],
  "source_type": "file"
}
```

---

### 6. Get Document

**Endpoint:** `GET /api/v1/knowledge-base/:document_id`

**Description:** Retrieve a single knowledge base document by ID.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| document_id | string | Yes | Document ID |

**Response (200 OK):**
```json
{
  "id": "doc_abc123xyz456",
  "document_id": "doc_abc123xyz456",
  "name": "Product Documentation",
  "type": "file",
  "status": "ready",
  "created_at_unix": 1705314000
}
```

---

### 7. Delete Document

**Endpoint:** `DELETE /api/v1/knowledge-base/:document_id`

**Description:** Delete a knowledge base document by ID.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| document_id | string | Yes | Document ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document doc_abc123xyz456 deleted successfully"
}
```

---

## Phone Number Endpoints

### Base URL
```
/api/v1/phone-numbers
```

### 1. List Phone Numbers

**Endpoint:** `GET /api/v1/phone-numbers`

**Description:** List all phone numbers for the authenticated user/organization with pagination.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | No | Pagination cursor |
| page_size | number | No | Number of items per page (default: 30, max: 100) |

**Response (200 OK):**
```json
{
  "phone_numbers": [
    {
      "phone_number_id": "phnum_abc123xyz456",
      "label": "Main Business Line",
      "phone_number": "+1234567890",
      "provider": "twilio",
      "supports_outbound": true,
      "supports_inbound": false,
      "elevenlabs_phone_number_id": "phnum_elvn789xyz123",
      "created_at_unix": 1705314000,
      "agent_id": "agent_abc123"
    }
  ],
  "cursor": "phnum_xyz789abc123"
}
```

---

### 2. Create Phone Number (Twilio)

**Endpoint:** `POST /api/v1/phone-numbers`

**Description:** Create a new Twilio phone number for outbound calls.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "label": "Main Business Line",
  "phone_number": "+1234567890",
  "sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token": "your_twilio_auth_token"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | Yes | Display label for the phone number |
| phone_number | string | Yes | Phone number in E.164 format |
| sid | string | Yes | Twilio Account SID |
| token | string | Yes | Twilio Auth Token |

**Response (201 Created):**
```json
{
  "phone_number_id": "phnum_abc123xyz456"
}
```

**Error Response (422):**
```json
{
  "detail": [
    {
      "loc": ["body"],
      "msg": "Invalid request body",
      "type": "value_error"
    }
  ]
}
```

---

### 3. Create SIP Trunk Phone Number

**Endpoint:** `POST /api/v1/phone-numbers/sip-trunk`

**Description:** Create a SIP trunk phone number with inbound/outbound configuration.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "label": "SIP Trunk Line",
  "phone_number": "+1234567890",
  "provider": "sip_trunk",
  "supports_inbound": true,
  "supports_outbound": true,
  "inbound_trunk_config": {
    "address": "sip.example.com:5060",
    "media_encryption": "srtp",
    "credentials": {
      "username": "sip_user",
      "password": "sip_password"
    }
  },
  "outbound_trunk_config": {
    "address": "sip.outbound.com:5060",
    "credentials": {
      "username": "outbound_user",
      "password": "outbound_password"
    },
    "media_encryption": "srtp",
    "transport": "udp"
  }
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | Yes | Display label |
| phone_number | string | Yes | Phone number in E.164 format |
| provider | string | Yes | Must be "sip_trunk" |
| supports_inbound | boolean | No | Enable inbound calls (default: false) |
| supports_outbound | boolean | No | Enable outbound calls (default: true) |
| inbound_trunk_config | object | Conditional | Required if supports_inbound=true |
| outbound_trunk_config | object | Conditional | Required if supports_outbound=true |

**inbound_trunk_config Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| address | string | Yes | SIP server address |
| media_encryption | string | No | Encryption type (e.g., "srtp") |
| credentials | object | No | SIP credentials |
| credentials.username | string | No | SIP username |
| credentials.password | string | No | SIP password |

**outbound_trunk_config Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| address | string | Yes | SIP server address |
| credentials | object | Yes | SIP credentials |
| credentials.username | string | Yes | SIP username |
| credentials.password | string | Yes | SIP password |
| media_encryption | string | No | Encryption type |
| transport | string | No | Transport protocol (e.g., "udp") |

**Response (201 Created):**
```json
{
  "phone_number_id": "phnum_abc123xyz456"
}
```

---

### 4. Register Phone Number with Python API

**Endpoint:** `POST /api/v1/phone-numbers/:phone_number_id/register`

**Description:** Register an existing phone number with the ElevenLabs Python API.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone_number_id | string | Yes | Phone number ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Phone number registered successfully with ElevenLabs",
  "data": {
    "phone_number_id": "phnum_abc123xyz456",
    "elevenlabs_phone_number_id": "phnum_elvn789xyz123"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PHONE_NUMBER",
    "message": "Phone number must support outbound calls to register with ElevenLabs"
  }
}
```

---

### 5. Get Phone Number by ID

**Endpoint:** `GET /api/v1/phone-numbers/:phone_number_id`

**Description:** Retrieve a single phone number by ID.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone_number_id | string | Yes | Phone number ID |

**Response (200 OK):**
```json
{
  "phone_number_id": "phnum_abc123xyz456",
  "phone_number": "+1234567890",
  "label": "Main Business Line",
  "provider": "twilio",
  "created_at_unix": 1705314000,
  "supports_inbound": false,
  "supports_outbound": true,
  "elevenlabs_phone_number_id": "phnum_elvn789xyz123",
  "agent_id": "agent_abc123"
}
```

---

### 6. Update Phone Number

**Endpoint:** `PATCH /api/v1/phone-numbers/:phone_number_id`

**Description:** Update phone number configuration (assign agent, update SIP settings, etc.).

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone_number_id | string | Yes | Phone number ID |

**Request Body:**
```json
{
  "label": "Updated Label",
  "agent_id": "agent_xyz789",
  "supports_inbound": true,
  "supports_outbound": true,
  "inbound_trunk_config": {
    "address": "sip.example.com:5060",
    "media_encryption": "srtp",
    "credentials": {
      "username": "sip_user",
      "password": "sip_password"
    }
  },
  "outbound_trunk_config": {
    "address": "sip.outbound.com:5060",
    "credentials": {
      "username": "outbound_user",
      "password": "outbound_password"
    },
    "media_encryption": "srtp",
    "transport": "udp"
  }
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | No | Updated display label |
| agent_id | string | No | Agent ID to assign for inbound calls |
| supports_inbound | boolean | No | Enable/disable inbound |
| supports_outbound | boolean | No | Enable/disable outbound |
| inbound_trunk_config | object | No | Updated inbound SIP config |
| outbound_trunk_config | object | No | Updated outbound SIP config |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Phone number updated successfully",
  "data": {
    "phone_number_id": "phnum_abc123xyz456",
    "label": "Updated Label",
    "phone_number": "+1234567890",
    "agent_id": "agent_xyz789",
    "supports_inbound": true,
    "supports_outbound": true
  }
}
```

---

### 7. Delete Phone Number

**Endpoint:** `DELETE /api/v1/phone-numbers/:phone_number_id`

**Description:** Delete a phone number by ID.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone_number_id | string | Yes | Phone number ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Phone number deleted successfully"
}
```

---

## Batch Calling Endpoints

### Base URL
```
/api/v1/batch-calling
```

### 1. Submit Batch Call

**Endpoint:** `POST /api/v1/batch-calling/submit`

**Description:** Submit a batch calling job to call multiple recipients.

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "agent_id": "agent_abc123xyz456",
  "call_name": "Customer Follow-up Campaign",
  "phone_number_id": "phnum_abc123xyz456",
  "recipients": [
    {
      "phone_number": "+1234567890",
      "name": "John Doe",
      "email": "john@example.com",
      "dynamic_variables": {
        "customer_id": "12345",
        "order_value": "500"
      }
    },
    {
      "phone_number": "+0987654321",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ]
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agent_id | string | Yes | Agent ID to use for calls |
| call_name | string | Yes | Name for this batch call |
| phone_number_id | string | Yes | Phone number ID to use (must be registered with ElevenLabs) |
| recipients | array | Yes | Array of recipient objects |

**Recipient Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phone_number | string | Yes | Recipient phone number in E.164 format |
| name | string | Yes | Recipient name |
| email | string | No | Recipient email |
| dynamic_variables | object | No | Custom variables for personalization |

**Response (201 Created) - Synchronous:**
```json
{
  "id": "batch_abc123xyz456",
  "name": "Customer Follow-up Campaign",
  "agent_id": "agent_abc123xyz456",
  "status": "scheduled",
  "phone_number_id": "phnum_elvn789xyz123",
  "phone_provider": "twilio",
  "created_at_unix": 1705314000,
  "scheduled_time_unix": 1705314000,
  "timezone": "UTC",
  "total_calls_dispatched": 0,
  "total_calls_scheduled": 2,
  "total_calls_finished": 0,
  "last_updated_at_unix": 1705314000,
  "retry_count": 0,
  "agent_name": "Customer Support Agent"
}
```

**Response (202 Accepted) - Queued:**
```json
{
  "success": true,
  "message": "Batch call job enqueued for processing",
  "job_id": "job_abc123xyz456",
  "recipients_count": 2,
  "status": "queued"
}
```

**Error Response (422):**
```json
{
  "detail": [
    {
      "loc": ["body"],
      "msg": "agent_id, call_name, and recipients (non-empty array) are required",
      "type": "value_error"
    }
  ]
}
```

---

### 2. Get All Batch Calls

**Endpoint:** `GET /api/v1/batch-calling`

**Description:** Get all batch calls for the user's organization with status sync from Python API.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| includeCancelled | boolean | No | Include cancelled batch calls (default: false) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f67890abcdef",
      "userId": "64a1b2c3d4e5f67890abc123",
      "organizationId": "64a1b2c3d4e5f67890abc456",
      "batch_call_id": "batch_abc123xyz456",
      "name": "Customer Follow-up Campaign",
      "agent_id": "agent_abc123xyz456",
      "status": "completed",
      "phone_number_id": "phnum_elvn789xyz123",
      "phone_provider": "twilio",
      "created_at_unix": 1705314000,
      "scheduled_time_unix": 1705314000,
      "timezone": "UTC",
      "total_calls_dispatched": 2,
      "total_calls_scheduled": 2,
      "total_calls_finished": 2,
      "last_updated_at_unix": 1705317600,
      "retry_count": 0,
      "agent_name": "Customer Support Agent",
      "call_name": "Customer Follow-up Campaign",
      "recipients_count": 2,
      "conversations_synced": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Batch Job Status

**Endpoint:** `GET /api/v1/batch-calling/:jobId`

**Description:** Get the status of a specific batch call job.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| jobId | string | Yes | Batch call job ID |

**Response (200 OK):**
```json
{
  "id": "batch_abc123xyz456",
  "name": "Customer Follow-up Campaign",
  "agent_id": "agent_abc123xyz456",
  "status": "in_progress",
  "phone_number_id": "phnum_elvn789xyz123",
  "phone_provider": "twilio",
  "created_at_unix": 1705314000,
  "scheduled_time_unix": 1705314000,
  "timezone": "UTC",
  "total_calls_dispatched": 1,
  "total_calls_scheduled": 2,
  "total_calls_finished": 0,
  "last_updated_at_unix": 1705314300,
  "retry_count": 0,
  "agent_name": "Customer Support Agent"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "BATCH_CALL_NOT_FOUND",
    "message": "Batch call not found or does not belong to your organization"
  }
}
```

---

### 4. Get Batch Job Calls

**Endpoint:** `GET /api/v1/batch-calling/:jobId/calls`

**Description:** Get individual call results for a batch job with pagination.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| jobId | string | Yes | Batch call job ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by call status (e.g., "completed", "failed") |
| cursor | string | No | Pagination cursor |
| page_size | number | No | Number of items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "calls": [
      {
        "call_id": "call_abc123",
        "phone_number": "+1234567890",
        "name": "John Doe",
        "status": "completed",
        "duration_seconds": 120,
        "started_at_unix": 1705314100,
        "ended_at_unix": 1705314220
      }
    ],
    "cursor": "call_xyz789",
    "total_count": 2
  }
}
```

---

### 5. Get Batch Job Results

**Endpoint:** `GET /api/v1/batch-calling/:jobId/results`

**Description:** Get batch job results with optional transcripts.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| jobId | string | Yes | Batch call job ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| include_transcript | boolean | No | Include call transcripts (default: true) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "batch_call_id": "batch_abc123xyz456",
    "results": [
      {
        "call_id": "call_abc123",
        "phone_number": "+1234567890",
        "name": "John Doe",
        "status": "completed",
        "transcript": "Agent: Hello, this is... Customer: Hi, I have a question...",
        "summary": "Customer inquired about product pricing",
        "sentiment": "positive"
      }
    ]
  }
}
```

---

### 6. Cancel Batch Job

**Endpoint:** `POST /api/v1/batch-calling/:jobId/cancel`

**Description:** Cancel an active or scheduled batch call job.

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| jobId | string | Yes | Batch call job ID |

**Response (200 OK):**
```json
{
  "id": "batch_abc123xyz456",
  "status": "cancelled",
  "message": "Batch call cancelled successfully"
}
```

---

### 7. Sync Batch Call Conversations

**Endpoint:** `POST /api/v1/batch-calling/:jobId/sync`

**Description:** Manually sync batch call conversations (create conversation records from completed calls).

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| jobId | string | Yes | Batch call job ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch call conversations synced successfully"
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "detail": "Invalid or missing authentication token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden",
  "detail": "You do not have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "detail": "An unexpected error occurred"
}
```

---

## Data Models

### Agent Model
```typescript
interface IAgent {
  _id: string;
  userId: string;
  agent_id: string;          // From Python API
  name: string;
  first_message: string;
  system_prompt: string;
  language: string;
  voice_id?: string;
  greeting_message?: string;
  escalationRules?: string[];
  knowledge_base_ids: string[];
  tool_ids: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Phone Number Model
```typescript
interface IPhoneNumber {
  phone_number_id: string;
  label: string;
  phone_number: string;
  sid: string;               // Twilio Account SID
  token: string;             // Twilio Auth Token
  provider?: string;         // 'twilio', 'sip_trunk', 'sip'
  organizationId?: string;
  userId?: string;
  created_at_unix?: number;
  supports_inbound?: boolean;
  supports_outbound?: boolean;
  inbound_trunk_config?: {
    address: string;
    media_encryption?: string;
    credentials?: {
      username: string;
      password: string;
    };
  };
  outbound_trunk_config?: {
    address: string;
    credentials: {
      username: string;
      password: string;
    };
    media_encryption?: string;
    transport?: string;
  };
  elevenlabs_phone_number_id?: string;
  agent_id?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Batch Call Model
```typescript
interface IBatchCall {
  _id: string;
  userId: string;
  organizationId: string;
  batch_call_id: string;     // From Python API
  name: string;
  agent_id: string;
  status: string;            // 'scheduled', 'in_progress', 'completed', 'cancelled', 'failed'
  phone_number_id: string;   // ElevenLabs phone_number_id
  phone_provider: string;
  created_at_unix: number;
  scheduled_time_unix: number;
  timezone?: string;
  total_calls_dispatched: number;
  total_calls_scheduled: number;
  total_calls_finished: number;
  last_updated_at_unix: number;
  retry_count: number;
  agent_name: string;
  call_name: string;
  recipients_count: number;
  conversations_synced?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Knowledge Base Document Model
```typescript
interface IKnowledgeBaseDocument {
  id: string;
  document_id: string;
  name: string;
  type: string;              // 'text', 'url', 'file'
  status: string;            // 'ready', 'processing', 'failed'
  created_at_unix: number;
  folder_path?: string[] | string;
  collection_name?: string;
  source_payload?: {
    text?: string;
    url?: string;
    file_name?: string;
    file_type?: string;
    file_size_bytes?: number;
  };
}
```

---

## Notes

1. **Authentication:** All endpoints require a valid Bearer token in the Authorization header.
2. **Pagination:** List endpoints support cursor-based pagination. Use the returned `cursor` to fetch the next page.
3. **Phone Number Registration:** Phone numbers must be registered with ElevenLabs before they can be used for batch calling.
4. **Tool IDs:** Agent tool_ids are automatically populated from environment variables (PRODUCTS_TOOL_ID, ORDERS_TOOL_ID) and email templates.
5. **Voice Configuration:** The `voice_id` in agent configuration is also updated in `conversation_config.tts` to ensure the voice is used in actual calls.
6. **Background Processing:** Batch calls may be processed synchronously or via a background queue depending on system configuration.
7. **Error Handling:** Always check the response status code and handle errors appropriately.

---

## Environment Variables Required

For agent and phone number functionality, the following environment variables should be configured:

```
PYTHON_API_URL=https://your-python-api.com
PRODUCTS_TOOL_ID=tool_prod_xxx
ORDERS_TOOL_ID=tool_ord_xxx
POST_CALL_WEBHOOK_ID=webhook_xxx
```

---

## Example Usage

### Creating an Agent with Knowledge Base

```bash
# Step 1: Create knowledge base document
curl -X POST https://api.example.com/api/v1/knowledge-base/text \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Info",
    "text": "Our products include..."
  }'

# Step 2: Create agent with knowledge base
curl -X POST https://api.example.com/api/v1/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Agent",
    "first_message": "Hi! I can help you with our products.",
    "system_prompt": "You are a sales assistant.",
    "language": "en",
    "voice_id": "eleven_multilingual_v2",
    "knowledge_base_ids": ["doc_abc123xyz456"]
  }'
```

### Setting Up Phone Number and Batch Call

```bash
# Step 1: Create Twilio phone number
curl -X POST https://api.example.com/api/v1/phone-numbers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Business Line",
    "phone_number": "+1234567890",
    "sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "token": "your_auth_token"
  }'

# Step 2: Submit batch call
curl -X POST https://api.example.com/api/v1/batch-calling/submit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_abc123xyz456",
    "call_name": "Follow-up Campaign",
    "phone_number_id": "phnum_abc123xyz456",
    "recipients": [
      {
        "phone_number": "+1234567890",
        "name": "John Doe"
      }
    ]
  }'
```

---

*End of Documentation*
