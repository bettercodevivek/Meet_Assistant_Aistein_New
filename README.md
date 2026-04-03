# AI Avatar Studio / Meet Assistant

Full-stack **Next.js** application that combines **HeyGen Interactive Avatar** (real-time streaming avatars), **user accounts** (admin & regular users), **knowledge bases**, and **MongoDB-backed** conversation history—with optional **OpenAI** summaries when resuming sessions.

![Demo](./public/demo.png)

---

## Table of contents

1. [What this project does](#what-this-project-does)
2. [Tech stack](#tech-stack)
3. [Architecture overview](#architecture-overview)
4. [Repository structure](#repository-structure)
5. [Environment variables](#environment-variables)
6. [Prerequisites](#prerequisites)
7. [Installation & setup](#installation--setup)
8. [Running the app](#running-the-app)
9. [npm scripts](#npm-scripts)
10. [Authentication & routing](#authentication--routing)
11. [Database models](#database-models)
12. [API reference](#api-reference)
13. [HeyGen & avatar flow](#heygen--avatar-flow)
14. [Admin panel](#admin-panel)
15. [Utility scripts](#utility-scripts)
16. [Security notes](#security-notes)
17. [Additional documentation](#additional-documentation)
18. [HeyGen resources](#heygen-resources)

---

## What this project does

| Feature | Description |
|--------|-------------|
| **Interactive avatar sessions** | Connects to HeyGen Streaming API; video + voice + text chat via `@heygen/streaming-avatar`. |
| **Accounts** | Register/login; JWT stored in `httpOnly` cookie `auth_token`. |
| **Roles** | `admin` and `user`; admins get extra dashboard pages and `/api/admin/*` access. |
| **Knowledge bases** | Per-user name + system **prompt**; each conversation links to one knowledge base. |
| **Conversations** | Stored with avatar/voice/language metadata; **messages** stored for history. |
| **Continue session** | `POST /api/conversations/[id]/continue` rebuilds context (optional OpenAI summary + KB prompt). |
| **Admin** | User management, stats, all conversations, KB management, HeyGen API key UI (writes `.env.local`). |

---

## Tech stack

| Layer | Packages / tools |
|--------|------------------|
| **Framework** | Next.js 15 (App Router), React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 3, PostCSS |
| **Avatar SDK** | `@heygen/streaming-avatar` |
| **Database** | MongoDB via Mongoose 8, `mongodb` driver |
| **Auth** | `jsonwebtoken`, `bcryptjs` |
| **Optional AI** | OpenAI API (fetch in `lib/utils/summaryGenerator.ts`; `openai` package in deps) |
| **UI primitives** | Radix UI (`@radix-ui/react-select`, `switch`, `toggle-group`) |
| **Hooks** | `ahooks` |
| **Dates** | `date-fns` |
| **CLI env** | `dotenv` (Node scripts) |

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                           │
│  Pages: /, /login, /register, /dashboard/*, chat, admin UI      │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js (App Router + Route Handlers)               │
│  • middleware.ts → cookie check for page routes (not /api)       │
│  • /api/* → requireAuth / requireAdmin + MongoDB               │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬──────────────────┐
    ▼           ▼           ▼                  ▼
 MongoDB     HeyGen API   OpenAI (opt.)    Static assets
```

- **Server** holds `HEYGEN_API_KEY` and exchanges it for short-lived streaming tokens.
- **Client** uses `NEXT_PUBLIC_BASE_API_URL` and the token with the HeyGen SDK.
- **API routes** authenticate via `Cookie: auth_token`, not via the edge middleware (middleware excludes `/api`).

---

## Repository structure

```
meetassistant-aistein/
├── app/
│   ├── (auth)/                 # Login & register layouts/pages
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/            # Authenticated app shell + sidebar
│   │   └── dashboard/
│   │       ├── page.tsx        # Home: new chat, recent conversations
│   │       ├── chat/[id]/      # Live HeyGen session for conversation
│   │       ├── chats/          # List + detail (non-streaming views)
│   │       ├── knowledge-bases/
│   │       └── admin/          # Admin dashboard, users, conversations
│   ├── api/                    # REST-style route handlers
│   │   ├── auth/               # login, logout, register, me
│   │   ├── get-access-token/   # HeyGen streaming token
│   │   ├── conversations/      # CRUD, messages, end, continue
│   │   ├── knowledge-bases/
│   │   └── admin/              # stats, users, KB, conversations, api-key
│   ├── lib/constants.ts        # Avatar IDs, STT languages, etc.
│   ├── layout.tsx
│   ├── page.tsx                # Root: redirect by /api/auth/me
│   └── error.tsx
├── components/
│   ├── InteractiveAvatar.tsx   # HeyGen provider + session UI
│   ├── AvatarSession/          # Video, controls, text/audio input, history
│   ├── AvatarConfig/           # Avatar/voice/config fields
│   ├── Sidebar.tsx
│   ├── NavBar.tsx, Button.tsx, Input.tsx, Select.tsx, Icons.tsx
│   └── logic/                  # Hooks: streaming, voice/text chat, context
├── lib/
│   ├── auth/
│   │   ├── auth.ts             # JWT + bcrypt helpers
│   │   ├── middleware.ts       # getAuthUser, requireAuth
│   │   └── adminMiddleware.ts  # requireAdmin
│   ├── db/
│   │   ├── mongodb.ts          # Cached Mongoose connection
│   │   └── models/             # User, Conversation, Message, KnowledgeBase
│   └── utils/
│       └── summaryGenerator.ts # OpenAI or template summaries
├── scripts/
│   ├── createAdmin.js          # Seed first admin (uses .env.local + .env)
│   ├── migrateUsers.js
│   └── fixAdminRole.js
├── styles/
│   └── globals.css
├── public/                     # Static files, images
├── middleware.ts               # Edge: protect pages with auth_token
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
├── README.md                   # This file
├── QUICK_START.md              # Admin panel quick start
└── ADMIN_PANEL_IMPLEMENTATION.md
```

---

## Environment variables

Create **`.env`** and/or **`.env.local`** (Next.js loads both; local overrides for same keys in many setups). Scripts under `scripts/` load **`.env.local` first**, then **`.env`**.

| Variable | Required | Description |
|----------|----------|-------------|
| `HEYGEN_API_KEY` | **Yes** (for avatar) | HeyGen API key from [HeyGen Settings → API](https://app.heygen.com/settings?nav=Subscriptions%20%26%20API) |
| `NEXT_PUBLIC_BASE_API_URL` | **Yes** (for avatar) | HeyGen API base URL, e.g. `https://api.heygen.com` |
| `MONGODB_URI` | Recommended | MongoDB connection string. Default in app code: `mongodb://localhost:27017/ai_avatar_studio` |
| `JWT_SECRET` | **Production** | Secret for signing JWTs. Code falls back to a placeholder if unset (dev only). |
| `OPENAI_API_KEY` | No | Enables richer conversation summaries on continue; otherwise template-based summary. |
| `LIVEKIT_URL` | **Yes** (public meets) | WebSocket URL for your LiveKit project, e.g. `wss://your-project.livekit.cloud` (same value as the Python agent). Used to mint guest tokens and dispatch `liveavatar-agent`. |
| `LIVEKIT_API_KEY` | **Yes** (public meets) | LiveKit API key (server-side only). |
| `LIVEKIT_API_SECRET` | **Yes** (public meets) | LiveKit API secret (server-side only). |

**Example `.env` template:**

```env
HEYGEN_API_KEY=your_heygen_api_key
NEXT_PUBLIC_BASE_API_URL=https://api.heygen.com
MONGODB_URI=mongodb://localhost:27017/ai_avatar_studio
JWT_SECRET=your-long-random-secret
OPENAI_API_KEY=sk-optional
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

---

## Prerequisites

- **Node.js** + **npm** (see [Node/npm install](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/))
- **MongoDB** reachable at `MONGODB_URI` (local install, Docker, or Atlas)
- **HeyGen** account with API access for Interactive / Streaming Avatar

---

## Installation & setup

```bash
git clone <repository-url>
cd meetassistant-aistein
npm install
```

1. Copy the [environment variables](#environment-variables) into `.env` or `.env.local`.
2. Start MongoDB (or point `MONGODB_URI` to a hosted cluster).
3. Create the first admin user:

```bash
node scripts/createAdmin.js
```

4. Start the dev server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).  
   - Root `/` sends you to `/dashboard` or `/login` based on session.  
   - Log in with the credentials printed by `createAdmin.js` (customize the script if you changed username/password).

> **Note:** `middleware.ts` only whitelists **`/login`** as a public path besides `/`. If **`/register`** redirects to login when logged out, add `/register` to `publicPaths` in `middleware.ts`.

---

## Running the app

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (default: port 3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |

---

## npm scripts

Defined in `package.json`:

- `dev` → `next dev`
- `build` → `next build`
- `start` → `next start`
- `lint` → `eslint . --ext .ts,.tsx,.js,.jsx`

---

## Authentication & routing

- **Login** sets `auth_token` (**httpOnly** cookie, 7-day JWT).
- **`lib/auth/middleware.ts`**: `getAuthUser`, `requireAuth` read the cookie and verify JWT.
- **`middleware.ts` (Edge)**: Redirects unauthenticated users to `/login` for matched page routes; skips `/api`, `_next/*`, `favicon.ico`, `public`.
- **API routes** must call `requireAuth` / `requireAdmin` themselves; they are **not** protected by the Edge matcher.

---

## Database models

Defined under `lib/db/models/`:

### User (`User.ts`)

- `username` (unique), `email` (optional, sparse unique)
- `password` (bcrypt hash)
- `role`: `admin` | `user`
- `isActive`, `createdAt`, `lastLoginAt`, `createdBy` (optional ref to admin)

### KnowledgeBase (`KnowledgeBase.ts`)

- `userId` → User
- `name`, `prompt` (system / KB instructions)
- `createdAt`, `updatedAt`

### Conversation (`Conversation.ts`)

- `userId` → User
- `avatarId`, optional `voiceId`, `language`
- `knowledgeBaseId` → KnowledgeBase
- `title`, `status`: `active` | `completed`
- `sessionContext`, `conversationSummary` (for resumed sessions)
- `createdAt`, `lastMessageAt`

### Message (`Message.ts`)

- `conversationId` → Conversation
- `role`: `user` | `assistant`
- `content`, `timestamp`

---

## API reference

Base URL: same origin (e.g. `http://localhost:3000`). Most routes expect `Cookie: auth_token`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Body: credentials → sets cookie |
| POST | `/api/auth/logout` | Clears cookie |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Current user from JWT |

### HeyGen

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/get-access-token` | Returns HeyGen streaming token (uses `HEYGEN_API_KEY`) |

### Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/conversations` | List current user’s conversations |
| POST | `/api/conversations` | Create (avatarId, knowledgeBaseId, etc.) |
| GET | `/api/conversations/[id]` | Single conversation |
| PATCH | `/api/conversations/[id]` | Update |
| DELETE | `/api/conversations/[id]` | Delete |
| GET | `/api/conversations/[id]/messages` | Messages |
| POST | `/api/conversations/[id]/messages` | Add message |
| POST | `/api/conversations/[id]/end` | End session |
| POST | `/api/conversations/[id]/continue` | Resume: summary + sessionContext |
| POST | `/api/conversations/[id]/livekit-session` | Guest: header `x-guest-token`. Creates LiveKit room `meet-{conversationId}`, dispatches `liveavatar-agent` with `{ conversationId }` metadata, returns `{ serverUrl, roomName, token }` for `livekit-client`. |

### Knowledge bases

| Method | Path | Description |
|--------|------|-------------|
| GET, POST | `/api/knowledge-bases` | List / create |
| GET, PATCH, DELETE | `/api/knowledge-bases/[id]` | One KB (scoped to user) |

### Admin (requires `role: admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard stats |
| GET, POST | `/api/admin/users` | List / create users |
| GET, PATCH, DELETE | `/api/admin/users/[id]` | User CRUD |
| POST | `/api/admin/users/[id]/password` | Reset password |
| GET | `/api/admin/users/[id]/knowledge-bases` | User’s KBs |
| GET | `/api/admin/conversations` | All conversations |
| GET, PATCH, DELETE | `/api/admin/knowledge-bases/[id]` | Manage any KB |
| GET, POST | `/api/admin/api-key` | Read/update HeyGen key (writes `.env.local`) |

---

## Public meet links & LiveKit

Guest **`/meet/[meetingId]`** sessions connect to **your** LiveKit project: the app calls **`POST /api/conversations/[id]/livekit-session`** (with `x-guest-token`) to create the room, dispatch the **`liveavatar-agent`** worker (same name as in `Liveavatar/src/agent.py`), and return a guest JWT. Run the Python agent against the **same** `LIVEKIT_*` credentials. **LiveAvatar’s API only accepts a UUID for `avatar_id`:** HeyGen-style ids on the meeting (e.g. `Amelia_standing_…`) are omitted from dispatch metadata, and the agent falls back to **`LIVEAVATAR_AVATAR_ID`** in `Liveavatar/.env` (must be a UUID from LiveAvatar). Dashboard chats that use HeyGen Streaming Avatar are unchanged.

## HeyGen & avatar flow

1. User starts a chat from **`/dashboard`** (modal: avatar, voice, language, knowledge base).
2. App creates a **Conversation** via `POST /api/conversations`.
3. Chat UI loads **`/dashboard/chat/[id]`** and calls **`POST /api/get-access-token`**.
4. Server calls HeyGen `streaming.create_token` with `HEYGEN_API_KEY`.
5. **`InteractiveAvatar`** / **`StreamingAvatarProvider`** use `NEXT_PUBLIC_BASE_API_URL` + token to start the session.
6. Avatar and voice IDs: see [labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar) and `app/lib/constants.ts`.

---

## Admin panel

- **Sidebar** loads `/api/auth/me` and shows **Admin Dashboard** + **User Management** for `role === 'admin'`.
- Pages under `app/(dashboard)/dashboard/admin/`.
- Full operational guide: **`QUICK_START.md`**.

---

## Utility scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `createAdmin.js` | `node scripts/createAdmin.js` | Create admin if none exists (edit file for username/password) |
| `migrateUsers.js` | `node scripts/migrateUsers.js` | User schema migration |
| `fixAdminRole.js` | `node scripts/fixAdminRole.js` | Fix admin role in DB |

All use Mongoose and load env from **`.env.local` then `.env`**.

---

## Security notes

1. Set a strong **`JWT_SECRET`** in production; do not rely on the code default.
2. **`/api/admin/api-key`** can write secrets to disk; restrict server access and backups.
3. Keep **`.env` / `.env.local`** out of git (see `.gitignore`).
4. Use **HTTPS** in production (`secure` cookie flags already depend on `NODE_ENV` in auth routes).

---

## Additional documentation

| File | Content |
|------|---------|
| `QUICK_START.md` | Admin login, user management, troubleshooting |
| `ADMIN_PANEL_IMPLEMENTATION.md` | Admin implementation details |

---

## HeyGen resources

- Interactive Avatar lab: [labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar)
- API / subscription settings: [app.heygen.com/settings](https://app.heygen.com/settings?nav=Subscriptions%20%26%20API)
- Streaming Avatar SDK discussions: [StreamingAvatarSDK](https://github.com/HeyGen-Official/StreamingAvatarSDK/discussions)
- [Interactive Avatar 101 (pricing & overview)](https://help.heygen.com/en/articles/9182113-interactive-avatar-101-your-ultimate-guide)

---

## License / origin

This project builds on the **HeyGen Interactive Avatar Next.js** demo pattern (Next.js + HeyGen SDK). Adapt branding, secrets, and deployment for your own **Meet Assistant** / **AI Avatar Studio** product.
# Meet-assistant-aistein
