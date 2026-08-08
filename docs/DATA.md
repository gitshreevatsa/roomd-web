# Data we store

roomd and roomd-web share one Upstash Redis. This is what personal data looks like
and how to erase it.

## roomd-web (dashboard) — Identity v2

| Key pattern | Contents |
|---|---|
| `app:user:{id}` | User record (email, name, active teamId, encrypted API key, auth methods, `isOperator?`) |
| `app:user:email:{email}` | Index → user id (one human) |
| `app:user:keyhint:{sha256(apiKey)[0:32]}` | Index → user id (apiKey login lookup) |
| `app:user:apikey:{teamId}` | **Deprecated** exclusive identity; kept as owner pointer (NX) during migration |
| `app:team:{teamId}:owner` | Owner user id for a team |
| `app:membership:{userId}:{teamId}` | MembershipRecord `{ userId, teamId, role, createdAt }` |
| `app:team:{teamId}:members` | Set of user ids |
| `app:user:{userId}:teams` | Set of team ids |
| `app:invite:keyhint:{digest}` | Pending teammate invite → `{ email, teamId }` (TTL) |
| `app:user:{provider}:{externalId}` | OAuth link → user id |
| `app:users` | Set of user ids |
| `app:waitlist` / `app:waitlist:meta:{email}` | Waitlist signup (stores issued `teamId`) |
| `app:org-invites` / `app:org-invite:meta:{email}` | Direct owner invites |
| `app:rooms:{userId}` / `app:room:{roomId}` | Dashboard room metadata only |

**Invariants**

- One human ↔ one `UserRecord` (email / keyhint indexes).
- Team access is via `MembershipRecord`, not by sharing a user row.
- A user's `apiKey` is their own key and is never overwritten by another person's login.
- Operator authz uses `UserRecord.isOperator` (+ `OPERATOR_USER_IDS` break-glass), not live master-key equality.

## roomd (MCP server)

Room coordination data is keyed by `roomId` (plans, context, events, presence).
API keys are stored as **SHA-256 digests** only (never the raw secret).
Dynamic keys and invites are team/room scoped; no email is required on the server.

## Erasure

- **Self-service:** signed-in users can `DELETE /api/account` (dashboard).
  - **Owner:** revokes all team dyn keys, strips team memberships, deletes their user row.
  - **Member:** revokes that member's dyn key only, removes membership, deletes their user row.
- **Operator:** Owner → Users → Delete (same effect, plus invite/waitlist rows
  when deleted from those tables).
- **Room data:** idle rooms expire after 30 days of no tool calls (TTL).

## Contact

For erasure requests beyond self-service, contact the deployment operator.
