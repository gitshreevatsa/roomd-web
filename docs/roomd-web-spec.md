> **Historical document.** This is the build spec roomd-web was written from.
> roomd-web is now built (v0.3.0) and several decisions here changed during
> implementation:
>
> - **Not deployed.** Railway is referenced throughout; nothing is deployed.
>   Both services run locally.
> - **Cloudflare R2 was dropped.** The `src/lib/r2.ts` stub and its env vars were
>   removed in v0.3.0 rather than left as dead code.
> - **`GET /admin/me` exists.** It was added as this spec asked.
> - **The session must not carry `apiKey`.** This spec's session shape includes it.
>   Doing that leaks a team-wide bearer token to the browser via
>   `/api/auth/session`. The key now lives only in Redis, encrypted, and is read
>   server-side by `getServerIdentity()` in `src/lib/session.ts`.
>
> For current facts see `CHANGELOG.md`.

---

# roomd-web — Full Build Spec

> Read this entire file before writing any code.
> This is the single source of truth for the roomd-web build.

---

## What is this project?

**roomd** is a running backend MCP server that lets multiple Claude Code instances share structured context, plans, API contracts, and events in real time. It is already built and deployed on Railway.

**roomd-web** is the web UI for roomd — a dashboard where a human operator:
- Creates rooms (namespaced workspaces for a project)
- Gets setup snippets to paste into Claude Code
- Watches what agents are doing (tasks, events, context, presence)
- Manages API keys and invite tokens

---

## roomd backend — what already exists

### Location
`/Users/shreyaspadmakiran/roomd/roomd/`

### Stack
Bun + Hono + @modelcontextprotocol/sdk + @upstash/redis + zod + nanoid + TypeScript strict

### Deployed
Railway. The URL is whatever Railway assigned (set as env var `ROOMD_URL` in roomd-web).

### Auth model
Every HTTP request to roomd must include `Authorization: Bearer <secret>`.

Secrets resolve to a **teamId** — the team identity that owns rooms and data.

Three types of secrets:
1. **Static env keys** — `API_KEYS=teamId:secret,teamId:secret,...` set in Railway dashboard
2. **Dynamic keys** — created via `/admin/keys`, stored in Redis. Same team-wide access as static.
3. **Invite tokens** — created via `/admin/rooms/:roomId/invite`, scoped to one room only. Bearer of this token can only access that specific room.

### Room ownership
The first team to call any tool on a `roomId` claims it. Subsequent calls by a different team get `"Room not found or access denied"`. Invite tokens bypass ownership but are room-scoped.

### HTTP endpoints on roomd

```
GET  /health                                    public, no auth
GET  /room/:roomId                              public, shows room summary

POST   /mcp                                     auth required — MCP JSON-RPC
GET    /mcp                                     auth required — MCP SSE stream

POST   /admin/keys                              create dynamic team key → returns secret ONCE
GET    /admin/keys                              list team's keys (secrets masked as ****xxxx)
DELETE /admin/keys/:keyId                       revoke a key by keyId

POST   /admin/rooms/:roomId/invite              create room-scoped invite token → returns token ONCE
                                                body: { expiresIn?: number }  (seconds, optional)
GET    /admin/rooms/:roomId/invites             list active invites for room (tokens masked)
DELETE /admin/rooms/:roomId/invites/:tokenId    revoke an invite
```

### MCP tools (called via POST /mcp with JSON-RPC)

All tools take `roomId: string` as first parameter.

```
read_plan          — get all tasks with status/owner
update_task        — change task status or owner
add_task           — add a new task
get_my_tasks       — tasks owned by a specific agentId
get_my_summary     — one-shot: tasks + unread events + context count + presence

write_context      — store api_contract / arch_decision / note / change_request / task
read_context       — get one context entry by id
list_context       — list all context entries, optional type filter

post_event         — post an event to the room bus
read_events        — get recent N events
get_unread_events  — events since last cursor (per agent)
mark_event_read    — mark event as read by agentId
get_event_reads    — who has read an event
reply_to_event     — threaded reply to an event

heartbeat          — signal agent is alive, returns presence
get_presence       — who is online/offline in the room

acquire_lock       — distributed lock via Redis SET NX
release_lock       — release a lock
list_locks         — list active locks
```

Calling a tool via HTTP:
```http
POST /mcp
Authorization: Bearer <secret>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_plan",
    "arguments": { "roomId": "my-project" }
  }
}
```

### Redis key schema (roomd owns these — do not touch from roomd-web)
```
{roomId}:plan
{roomId}:context:{id}
{roomId}:context:index
{roomId}:events
{roomId}:agents
{roomId}:lock:{resource}
{roomId}:locks
{roomId}:heartbeat:{agentId}
{roomId}:cursor:{agentId}
{roomId}:event_reads:{eventId}
room:{roomId}:owner
ratelimit:{teamId}:{window}
dynkey:{secret}
dynkeyid:{keyId}
dynkeys:{teamId}
invite:{token}
inviteid:{tokenId}
room:{roomId}:invites
```

---

## roomd-web — what to build

### Location
`/Users/shreyaspadmakiran/roomd/roomd-web/`

Create this as a brand-new Next.js project here.

### Stack
- **Next.js 14+** (App Router, TypeScript, Tailwind CSS)
- **Auth.js v5** (NextAuth) — modular auth providers
- **Upstash Redis** — same instance as roomd, `app:` key prefix
- **shadcn/ui** — component library
- **Cloudflare R2** — file storage (S3-compatible, add later, guard with `R2_ENABLED` env var)

### Environment variables
```bash
# Auth
NEXTAUTH_SECRET=                  # random string, openssl rand -base64 32
NEXTAUTH_URL=                     # https://your-roomd-web.railway.app
AUTH_MODE=apikey                  # apikey | email | both  (see Auth Strategy section)

# Same Upstash Redis as roomd
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# roomd backend
ROOMD_URL=                   # https://your-roomd.railway.app
ROOMD_MASTER_KEY=            # a static team key with admin access on roomd

# Only needed when AUTH_MODE=email or both
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# R2 — add these later, guarded by R2_ENABLED=false for now
R2_ENABLED=false
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

---

## Auth strategy — modular, phased rollout

This is a business decision baked into code. Read carefully.

### The three phases

**Phase 1 — Invite only (`AUTH_MODE=apikey`)**
- Login page shows only: "Enter your API key"
- Below that: "Don't have access? Join the waitlist →" (captures email into Redis)
- Operator manually creates keys via `/admin` page → emails key to each waitlist person
- User pastes key → logs in → session stores `{ teamId, apiKey, authMethod: "apikey" }`

**Phase 2 — Open access (`AUTH_MODE=both`)**
- Login page shows both options with a toggle: "API Key" | "Email / Google / GitHub"
- Existing API key holders still log in exactly as before
- New users can sign up with email or OAuth
- Migration path: API key holders can link their email/OAuth in account settings

**Phase 3 — Email only (`AUTH_MODE=email`)**
- Only email/OAuth shown on login page
- API key login code still exists, just not rendered
- Flip back to `apikey` or `both` any time

### Clean migration (Phase 1 → Phase 2)

When Phase 2 launches:
- An existing API key holder creates an email/OAuth account
- During signup they can enter their API key to link accounts
- App stores the association: `app:user:apikey:{teamId}` → userId
- Now they can log in either way — same teamId, same room access
- Their existing rooms are unchanged because teamId is unchanged

### How the auth module works in code

```
src/lib/auth/
  index.ts          — reads AUTH_MODE, exports only the active providers
  apikey.ts         — API key credentials provider
  email.ts          — email/password credentials provider
  google.ts         — Google OAuth provider
  github.ts         — GitHub OAuth provider
```

`auth/index.ts` exports `providers` array. To disable a provider, comment out one import. Nothing else changes. The session shape `{ user: { id, teamId, apiKey?, email? } }` is identical regardless of login method.

### Session shape
```typescript
interface Session {
  user: {
    id: string         // internal user id (for Redis lookups)
    teamId: string     // maps to roomd team
    apiKey: string     // the Bearer token used for roomd calls
    email?: string
    name?: string
  }
}
```

For API key login: `apiKey = the key they typed`, `teamId = resolved from roomd`
For email login: `apiKey = the stored key for their teamId`, `teamId = from user record`

---

## Database schema — Redis (`app:` prefix)

```
app:user:{userId}              → UserRecord (JSON)
app:user:email:{email}         → userId
app:user:google:{googleId}     → userId
app:user:github:{githubId}     → userId
app:user:apikey:{teamId}       → userId   (links a teamId to a web app user)

app:rooms:{userId}             → SET of roomIds
app:room:{roomId}              → RoomMeta (JSON)

app:waitlist                   → SET of emails
```

```typescript
interface UserRecord {
  id: string
  email?: string
  name?: string
  passwordHash?: string    // only if email auth
  teamId: string
  apiKey: string           // the live Bearer token for roomd
  authMethods: ('apikey' | 'email' | 'google' | 'github')[]
  createdAt: string
}

interface RoomMeta {
  roomId: string
  name: string
  createdBy: string        // userId
  createdAt: string
}
```

---

## File / folder structure to build

```
roomd-web/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local.example
│
└── src/
    ├── app/
    │   ├── layout.tsx                     root layout, fonts, providers
    │   ├── page.tsx                       redirect → /dashboard or /login
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx             see Login Page spec below
    │   │   ├── register/page.tsx          email+name+password (only when AUTH_MODE!=apikey)
    │   │   └── waitlist/page.tsx          "You're on the list" + email capture
    │   │
    │   ├── (app)/
    │   │   ├── layout.tsx                 sidebar + top nav, requires auth
    │   │   ├── dashboard/page.tsx         room list + create button
    │   │   ├── rooms/
    │   │   │   ├── new/page.tsx           create room form
    │   │   │   └── [roomId]/
    │   │   │       ├── page.tsx           room dashboard (4 tabs)
    │   │   │       └── setup/page.tsx     setup guide shown after creation
    │   │   └── admin/
    │   │       └── page.tsx               API key + invite management
    │   │
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       ├── waitlist/route.ts           POST — add email
    │       ├── rooms/
    │       │   ├── route.ts               GET list, POST create
    │       │   └── [roomId]/
    │       │       ├── route.ts           GET room data (proxies roomd tools)
    │       │       ├── tasks/[taskId]/route.ts  PATCH update status
    │       │       └── invite/route.ts    POST create, GET list, DELETE revoke
    │       └── admin/
    │           ├── keys/route.ts          POST create, GET list
    │           └── keys/[keyId]/route.ts  DELETE revoke
    │
    ├── lib/
    │   ├── auth/
    │   │   ├── index.ts                   exports providers based on AUTH_MODE
    │   │   ├── apikey.ts                  API key credentials provider
    │   │   ├── email.ts                   email/password credentials provider
    │   │   ├── google.ts                  Google OAuth
    │   │   └── github.ts                 GitHub OAuth
    │   ├── redis.ts                       Upstash Redis client (app: namespace helpers)
    │   ├── collab.ts                      typed HTTP client for roomd
    │   └── utils.ts                       slugify, nanoid wrappers, cn()
    │
    ├── components/
    │   ├── ui/                            shadcn primitives (Button, Card, Badge, etc.)
    │   ├── TaskBoard.tsx                  kanban + list view toggle
    │   ├── AgentPresence.tsx              agent cards with live status dots
    │   ├── EventFeed.tsx                  chronological event list
    │   ├── ContextGrid.tsx                context entries grouped by type
    │   ├── SetupSnippet.tsx               copy-to-clipboard code blocks
    │   ├── RoomCard.tsx                   room summary card for dashboard
    │   └── CopyButton.tsx                 one-click copy with checkmark feedback
    │
    └── types.ts                           shared TypeScript types
```

---

## Page specs

### Login page (`/login`)

Reads `AUTH_MODE` from `process.env` (server component or passed as prop).

```
AUTH_MODE=apikey:
  ┌─────────────────────────────────┐
  │  roomd                     │
  │  Agent coordination dashboard   │
  │                                 │
  │  [API Key input field]          │
  │  [Sign in →]                   │
  │                                 │
  │  This is invite-only.           │
  │  Don't have access?             │
  │  → Join the waitlist            │
  └─────────────────────────────────┘

AUTH_MODE=both:
  Same as above but with a toggle at top:
  [API Key]  |  [Email / Google / GitHub]
  Toggle switches between the two forms.

AUTH_MODE=email:
  Standard email+password form.
  Google and GitHub OAuth buttons below.
```

API key validation: make a GET request to `${ROOMD_URL}/health` is not enough — instead call `GET ${ROOMD_URL}/admin/keys` with the entered key. If 200, key is valid and we know the teamId. Actually better: POST to /mcp with `tools/list` — if 200, key works.

Actually simplest validation: call `GET /room/ping-test-{random}` — this is public but we can validate key via `GET /admin/keys`. If returns 200, key is valid. Store `{ apiKey, teamId }` in session. TeamId comes from the DynKey response or we need a `GET /admin/me` endpoint — add this to roomd if it doesn't exist.

**Add to roomd:** `GET /admin/me` → returns `{ teamId }` for the authenticated key. This is how the app discovers the teamId for an API key login.

### Dashboard page (`/dashboard`)

- If no rooms: empty state with "Create your first room" CTA and 3-bullet explainer
- If has rooms: grid of `RoomCard` components

**RoomCard:**
- Room name (large)
- Room ID in monospace with copy button
- Status pill: `● N agents online` (green if >0, gray if 0) or `never connected`
- `N/M tasks done` progress
- `Last activity: X min ago` (from most recent event timestamp)
- Click → goes to `/rooms/[roomId]`

### Create room page (`/rooms/new`)

Two fields:
1. **Room name** — free text, e.g. "My SaaS Backend"
2. **Room ID** — auto-generated slug from name as user types (debounced), editable
   - Format: lowercase, hyphens only, max 32 chars
   - Real-time validation: only `[a-z0-9-]` allowed
   - "This is what your agents use in tool calls"
   - If slug collides with an existing room, append `-{4 random chars}`

On submit: POST to `/api/rooms` → creates room metadata in Redis → redirects to `/rooms/[roomId]/setup`

### Setup page (`/rooms/[roomId]/setup`)

Shown immediately after room creation. Also accessible from room header → "Setup guide" button.

Three steps, full page or modal:

**Step 1 — settings.json snippet**
```
Add this to your project's .claude/settings.json

┌──────────────────────────────────────────────────┐
│ {                                                │
│   "mcpServers": {                                │
│     "roomd": {                              │
│       "type": "http",                            │
│       "url": "https://roomd.railway.app/mcp"│
│       "headers": {                               │
│         "Authorization": "Bearer ••••••••••••"   │
│       }                                          │
│     }                                            │
│   }                                              │
│ }                                                │
└──────────────────────────────────────────────────┘
[👁 Reveal key]                        [Copy snippet]
```
- Secret masked by default (`••••`), reveal toggle shows it
- Copy button copies the full JSON with the real secret

**Step 2 — First prompt**
```
Paste this at the start of your Claude Code session:

┌──────────────────────────────────────────────────┐
│ My collab room ID is: my-saas-backend            │
│                                                  │
│ Start by calling:                                │
│ get_my_summary({                                 │
│   roomId: "my-saas-backend",                     │
│   agentId: "agent-1"                             │
│ })                                               │
└──────────────────────────────────────────────────┘
                                       [Copy prompt]
```

**Step 3 — Go to dashboard**
```
[← Back to setup]              [Open room dashboard →]
```

### Room dashboard (`/rooms/[roomId]`)

**Header:**
```
My SaaS Backend                     [Setup guide]  [Invite]  [⚙]
my-saas-backend [copy]        ● 2 agents online
```

**Four tabs:** Tasks | Agents | Events | Context

All tabs poll on a 20–30s interval. Manual refresh button on each tab.

#### Tasks tab

Toggle between Kanban and List view (remember preference in localStorage).

**Kanban:** 4 columns — pending / in_progress / done / blocked
- Each card: task title, owner agent ID (or "unassigned"), updated timestamp
- Click a card → modal with full task details + status dropdown (calls `/api/rooms/[roomId]/tasks/[taskId]` PATCH)
- Progress bar across top: "3 of 7 tasks done"

**Empty state:**
```
No tasks yet
Agents add tasks using the add_task tool.
Example:
  add_task({ roomId: "my-saas-backend", title: "...", description: "..." })
```

#### Agents tab

Cards, refresh every 30s.

```
┌────────────────────────────┐
│ ● backend-claude           │  ← green dot = online (heartbeat < 120s)
│ online · last seen 12s ago │
│ Working on: Build auth API │  ← from owned in_progress task
└────────────────────────────┘

┌────────────────────────────┐
│ ○ frontend-claude          │  ← gray dot = offline
│ offline · last seen 4m ago │
│ No active task             │
└────────────────────────────┘
```

**Empty state:**
```
No agents have connected yet.
Follow the setup guide to connect your first Claude Code instance.
[Open setup guide →]
```

#### Events tab

Chronological list, newest first, last 50 events.

Each row:
- Color-coded left border by type:
  - `task_updated` → blue
  - `task_blocked` → red
  - `change_request` → orange
  - `contract_ready` → green
  - others → gray
- `from-agent → to-agent`  `event_type`  `2m ago`
- Expandable: click row to see full payload as formatted JSON

**Empty state:**
```
No events yet.
Events appear here as agents coordinate — task updates,
change requests, contract notifications, etc.
```

#### Context tab

Grid of cards, grouped by type.

Types: `api_contract` / `arch_decision` / `task` / `change_request` / `note`

Each card:
- Type badge (colored)
- Author agent ID
- Summary text
- Timestamp

Click → drawer slides in from right with:
- Full metadata (author, timestamp, consuming agents)
- Payload as syntax-highlighted JSON (use `react-json-view` or similar)

**Empty state:**
```
No context stored yet.
Agents write structured context using write_context —
API contracts, architecture decisions, notes, and more.
```

### Admin page (`/admin`)

Two sections:

**Section 1 — API Keys**

```
Your team's API keys
These keys grant full access to all rooms your team owns.

[+ Create new key]

┌─────────────────────────────────────────────────────┐
│ Key ID      Secret hint    Created         Action   │
│ abc1234567  ****a3x1       2026-06-01      [Revoke] │
│ def7890123  ****b7z9       2026-05-28      [Revoke] │
└─────────────────────────────────────────────────────┘
```

"Create new key" → modal shows the secret once:
```
┌─────────────────────────────────────────────┐
│ New API key created                         │
│                                             │
│ sk-a3x1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8  │
│ [Copy key]                                  │
│                                             │
│ Save this now. It won't be shown again.     │
│ Share it with the person you're inviting.   │
│                                             │
│ [Close]                                     │
└─────────────────────────────────────────────┘
```

**Section 2 — Room Invites**

Room-scoped tokens (let someone access one room, not all rooms).

Room selector dropdown (shows user's rooms) → then:

```
Invites for: my-saas-backend

[+ Create invite]   Expires in: [24h ▾]

┌─────────────────────────────────────────────────────────────┐
│ Token ID    Hint       Created       Expires       Action   │
│ tok1234567  ****x1y2   2026-06-01    never         [Revoke] │
│ tok8901234  ****a3b4   2026-06-01    2026-06-02    [Revoke] │
└─────────────────────────────────────────────────────────────┘
```

Create invite → modal shows token once, same pattern as API key.

---

## roomd client library (`src/lib/collab.ts`)

Typed wrapper. All functions take `apiKey: string` — never use a hardcoded key.

```typescript
// Call any MCP tool
async function callTool(
  tool: string,
  args: Record<string, unknown>,
  apiKey: string
): Promise<unknown>

// Admin key management
async function createAdminKey(apiKey: string): Promise<{ keyId: string; secret: string; teamId: string; createdAt: string }>
async function listAdminKeys(apiKey: string): Promise<DynKey[]>
async function revokeAdminKey(keyId: string, apiKey: string): Promise<void>

// Room invite management
async function createRoomInvite(roomId: string, apiKey: string, expiresIn?: number): Promise<InviteToken>
async function listRoomInvites(roomId: string, apiKey: string): Promise<InviteToken[]>
async function revokeRoomInvite(tokenId: string, roomId: string, apiKey: string): Promise<void>

// Key validation (used during login)
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; teamId?: string }>
```

`validateApiKey` calls `GET /admin/keys` with the key — if 200, key is valid, teamId comes from the response data's `teamId` field. If 401, invalid.

**Important:** You need to add `GET /admin/me` to roomd that returns `{ teamId }` for the authenticated request. This is how login resolves teamId from a static env-var key (which doesn't appear in `GET /admin/keys` — that only lists dynamic keys). Alternatively: call `GET /admin/keys` and if it returns 200 (even empty array), the key is valid. For teamId from a static key, you'd need the `/admin/me` endpoint.

**Add to roomd (`src/index.ts`):**
```typescript
app.get("/admin/me", requireAuth, requireTeamKey, (c) => {
  const keyCtx = c.get("keyCtx") as KeyContext;
  return c.json({ teamId: keyCtx.teamId });
});
```

---

## Redis client (`src/lib/redis.ts`)

Uses same Upstash credentials as roomd. All keys prefixed `app:`.

Key functions needed:
```typescript
// Users
createUser(data: Omit<UserRecord, 'id'>): Promise<UserRecord>
getUserById(id: string): Promise<UserRecord | null>
getUserByEmail(email: string): Promise<UserRecord | null>
getUserByTeamId(teamId: string): Promise<UserRecord | null>
updateUser(id: string, patch: Partial<UserRecord>): Promise<void>
linkAuthMethod(userId: string, method: string, externalId: string): Promise<void>

// Rooms (web app metadata only — actual room data lives in roomd)
createRoom(meta: RoomMeta): Promise<void>
getRoomsForUser(userId: string): Promise<RoomMeta[]>
getRoomMeta(roomId: string): Promise<RoomMeta | null>

// Waitlist
addToWaitlist(email: string): Promise<void>
getWaitlist(): Promise<string[]>
```

---

## Cloudflare R2 — deferred

Do not build this yet. Add a stub in `src/lib/r2.ts`:
```typescript
const R2_ENABLED = process.env.R2_ENABLED === 'true';

export async function uploadFile(...): Promise<never> {
  throw new Error('R2 not enabled. Set R2_ENABLED=true and configure credentials.');
}
```

Guard all R2 UI with `{R2_ENABLED && <FileUpload />}`. This way the codebase is R2-ready without any R2 infra being required to run.

When R2 is ready:
- Use `@aws-sdk/client-s3` (R2 is S3-compatible)
- Endpoint: `https://{accountId}.r2.cloudflarestorage.com`
- File paths: `{roomId}/{nanoid()}-{filename}`
- Metadata in Redis: `app:file:{fileId}` → `{ fileId, roomId, name, s3Key, description, tags, size, uploadedBy, createdAt }`
- New roomd tools to add later: `upload_file`, `list_files`, `read_file`

---

## Things to add to roomd before or during roomd-web build

1. **`GET /admin/me`** — returns `{ teamId }` for the authenticated key. Needed for API key login to resolve teamId. Add to `src/index.ts` alongside the other admin routes.

2. That's it. Everything else roomd already supports.

---

## Room ID generation

```typescript
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32)
    .replace(/^-|-$/g, '');
}

async function uniqueRoomId(name: string, userId: string): Promise<string> {
  const base = slugify(name);
  const userRooms = await getRoomsForUser(userId);
  const existing = new Set(userRooms.map(r => r.roomId));
  if (!existing.has(base)) return base;
  return `${base}-${nanoid(4).toLowerCase()}`;
}
```

Room IDs are unique per user (not globally — roomd enforces isolation by team ownership, not by ID uniqueness).

---

## Key constraints and gotchas

1. **Never call roomd from browser-side JS.** All roomd calls go through Next.js API routes (`/api/...`). The API key must never appear in client-side code or network responses.

2. **The session `apiKey` field is sensitive.** Don't include it in any JSON response that the browser can see. Server components can use it; client components must fetch data via API routes.

3. **AUTH_MODE is a server-side env var.** Read it only in server components or API routes. Pass a boolean prop `hasEmailAuth={process.env.AUTH_MODE !== 'apikey'}` to client components.

4. **roomd is stateless.** Every tool call is a fresh HTTP request. There's no persistent connection to manage from roomd-web.

5. **Room data lives in roomd's Redis namespace.** roomd-web only stores metadata (room name, who created it, when). For task/event/context/presence data, always query roomd at runtime.

6. **Polling is fine for v1.** 20–30s intervals. No WebSockets needed yet.

---

## Build order recommendation

1. Project scaffold (package.json, next.config, tailwind, tsconfig)
2. `src/lib/redis.ts` — user + room Redis helpers
3. `src/lib/collab.ts` — roomd HTTP client
4. `src/lib/auth/` — modular auth providers
5. `src/app/api/auth/[...nextauth]/route.ts` — NextAuth config
6. Login page + session plumbing
7. Dashboard + create room flow
8. Setup guide page (the key UX moment)
9. Room dashboard — Tasks tab (most important)
10. Room dashboard — Agents, Events, Context tabs
11. Admin page (key management + invites)
12. Waitlist page
13. R2 stub

---

## Repository structure

```
roomd/
  roomd/          ← already built, do not modify unless adding GET /admin/me
  roomd-web/          ← build this
  roomd-web-spec.md   ← this file
```

---

## Summary of all decisions made

| Decision | Choice | Reason |
|---|---|---|
| Frontend framework | Next.js 14 App Router | SSR for auth, good DX |
| UI library | shadcn/ui + Tailwind | Fast, accessible, composable |
| Auth library | Auth.js v5 (NextAuth) | Handles sessions, multiple providers |
| Auth mode | `AUTH_MODE` env var, start with `apikey` | Business phasing without code changes |
| Session storage | JWT (stateless) | No extra Redis keys for sessions |
| User DB | Upstash Redis, `app:` prefix | Already provisioned, fast, no new infra |
| File storage | Cloudflare R2 (deferred) | S3-compatible, no egress fees, no region issues |
| R2 retrieval | Metadata registry in Redis + explicit agent fetch | Agents decide what to load based on task context |
| Polling vs WebSockets | Polling (20–30s) | Simple, reliable, upgrade later |
| roomd calls | Server-side only (API routes) | Never expose API keys to browser |
| Room ID | Slugified name, user-editable, deduplicated | Memorable, safe for tool calls |
| Secret display | Masked by default, reveal on click, shown once on creation | Security hygiene |
